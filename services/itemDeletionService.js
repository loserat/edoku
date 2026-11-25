const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {connection}=require('./dbService');
const {createIntegrationService,parse,fault}=require('./integrationService');
const {dataFilesForProject}=require('./projectArchiveService');
const {resolveAttachmentFile}=require('./attachmentService');
const {assertSafePath}=require('./pathService');
const {readJson,writeJson}=require('./jsonService');
const store=require('./projectDataStoreService');
const {projectResetGeneration}=require('./idempotencyService');
const {target:targetSchema,deletionInput,confirmation}=require('../src/api/deletionSchemas');
const {id}=require('../src/api/schemas');
const {changes,reverse}=require('./deletionPatchService');
const {resolveDeviceReferences}=require('./deviceDocumentService');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function fileHash(file){const h=crypto.createHash('sha256');for await(const chunk of syncFs.createReadStream(file))h.update(chunk);return h.digest('hex');}
function createItemDeletionService(root,{db=connection(),checkStorage=async()=>{}}={}){
  const integration=createIntegrationService(root);
  const has=table=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const rows=(table,sql,args)=>has(table)?db.prepare(sql).all(...args):[];
  function schema(){db.exec(`CREATE TABLE IF NOT EXISTS project_item_deletions(
    id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,kind TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN('deleted','restored')),snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),snapshot_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,restored_at TEXT,FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id));
    CREATE INDEX IF NOT EXISTS project_item_deletions_scope ON project_item_deletions(user_id,project_id,created_at);
    CREATE TABLE IF NOT EXISTS project_item_deletion_events(
    id INTEGER PRIMARY KEY,deletion_id TEXT NOT NULL REFERENCES project_item_deletions(id),user_id TEXT NOT NULL,project_id TEXT NOT NULL,
    action TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),created_at TEXT NOT NULL);`);}
  function sqlState(user,project){
    return {
      jobs:rows('documentation_jobs','SELECT * FROM documentation_jobs WHERE user_id=? AND project_id=? ORDER BY id',[user,project]),
      proposals:rows('document_proposals','SELECT p.* FROM document_proposals p JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY p.id',[user,project]),
      requirements:rows('documentation_requirements','SELECT r.* FROM documentation_requirements r JOIN documentation_jobs j ON j.id=r.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY r.job_id,r.id',[user,project]),
      reviews:rows('document_review_views','SELECT v.* FROM document_review_views v JOIN document_proposals p ON p.id=v.proposal_id JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY v.proposal_id,v.user_id',[user,project])
    };
  }
  function assertIdle(user,project){
    if(has('documentation_exports')&&db.prepare("SELECT 1 FROM documentation_exports WHERE user_id=? AND project_id=? AND state='running' AND lease_until>?").get(user,project,Date.now()))throw fault('Ein Export läuft noch; danach erneut versuchen.',409,'DELETE_EXPORT_BUSY');
  }
  function jobExports(user,project,jobId){return rows('documentation_exports',"SELECT id,state FROM documentation_exports WHERE user_id=? AND project_id=? AND assistant_job_id=? AND state IN('queued','waiting_input','waiting_review','running') ORDER BY id",[user,project,jobId]);}
  async function inspect(auth,projectId,raw){
    integration.project(auth,projectId);const target=parse(targetSchema,raw),files=dataFilesForProject(root,auth.user.id,projectId),docs={};
    for(const name of store.PROJECT_DOCUMENTS)docs[name]=await readJson(path.join(files.dataDir,name));
    const after=structuredClone(docs),sql=sqlState(auth.user.id,projectId),archiveFiles=[],blockers=[];
    const lists=after['geraetelisten.json'],attachments=after['anhaenge.json'],project=after['projekt.json'];
    let label,links=0,selected={jobs:[],proposals:[],requirements:[],reviews:[]};
    const addFile=async file=>{await assertSafePath(root,file,{type:'file'});const stat=await fs.stat(file);archiveFiles.push({path:path.relative(root,file).split(path.sep).join('/'),bytes:stat.size,sha256:await fileHash(file)});};
    if(target.kind==='device'){
      const matches=lists.filter(x=>x.id===target.listId);
      if(matches.length!==1||!Array.isArray(matches[0].positionen))throw fault('Geräteliste nicht eindeutig gefunden.',404,'NOT_FOUND');
      const list=matches[0];
      if(list.positionen.some(x=>!Number.isSafeInteger(x.pos)||x.pos<1)||new Set(list.positionen.map(x=>x.pos)).size!==list.positionen.length)throw fault('Positionsnummern vor dem Löschen in der GUI bereinigen.',409,'LEGACY_DEVICE_FORMAT');
      const device=list.positionen.find(x=>x.pos===target.position);if(!device)throw fault('Geräteposition nicht gefunden.',404,'NOT_FOUND');
      label=[device.hersteller,device.typ,'Pos. '+device.pos].filter(Boolean).join(' · ');
      const refers=x=>x&&x.listId===target.listId&&x.position===target.position;
      for(const r of sql.requirements){const v=JSON.parse(r.payload);if([v.device,...(v.devices||[])].some(refers)||(v.dependsOn||[]).some(ref=>ref.subject?.kind==='device'&&refers(ref.subject)))blockers.push({kind:'requirement',jobId:r.job_id,id:r.id});}
      for(const p of sql.proposals){const v=JSON.parse(p.metadata);if(p.state==='pending'&&!v.supersededBy&&!v.withdrawal&&(v.deviceReferences||[]).some(refers))blockers.push({kind:'proposal',jobId:p.job_id,id:p.id});}
      for(const j of sql.jobs)for(const q of JSON.parse(j.questions))if(!q.obsolete&&(q.targets||[]).some(x=>(x.kind==='device'&&refers(x))||(x.kind==='fact'&&x.subject?.kind==='device'&&refers(x.subject))))blockers.push({kind:'question',jobId:j.id,id:q.id});
      list.positionen=list.positionen.filter(x=>x.pos!==target.position);
      for(const a of attachments)if(a.deviceReferences?.some(refers)){a.deviceReferences=a.deviceReferences.filter(x=>!refers(x));links++;}
    }else if(target.kind==='document'){
      const matches=attachments.filter(x=>x.id===target.attachmentId);if(matches.length!==1)throw fault('Dokument nicht eindeutig gefunden.',404,'NOT_FOUND');
      const a=matches[0];label=a.title||a.originalName||a.id;
      await addFile(await resolveAttachmentFile(root,files,a.relativePath));
      after['anhaenge.json']=attachments.filter(x=>x.id!==a.id);
      for(const list of lists)for(const p of list.positionen||[])for(const key of ['datenblattId','bedienungsanleitungId'])if(p[key]===a.id){p[key]='';links++;}
      for(const p of after['brandschutz.json'])for(const key of ['foto_vorher','foto_nachher'])if(p[key]===a.relativePath){p[key]='';links++;}
      for(const [key,value]of Object.entries(project.dokumentInhalte||{}))if(value?.attachmentId===a.id){delete project.dokumentInhalte[key];links++;}
    }else{
      const job=sql.jobs.find(x=>x.id===target.jobId);if(!job)throw fault('Assistentenauftrag nicht gefunden.',404,'NOT_FOUND');
      for(const entry of jobExports(auth.user.id,projectId,job.id))blockers.push({kind:'export',id:entry.id});
      label='Assistentenauftrag '+job.id;
      selected={jobs:[job],proposals:sql.proposals.filter(x=>x.job_id===job.id),requirements:sql.requirements.filter(x=>x.job_id===job.id),reviews:[]};
      const proposalIds=new Set(selected.proposals.map(x=>x.id));selected.reviews=sql.reviews.filter(x=>proposalIds.has(x.proposal_id));
      if(project.assistantWorkflow?.jobId===job.id){delete project.assistantWorkflow;links++;}
      const folder=path.join(root,'storage/users',auth.user.id,'assistant',parse(id,job.id));
      async function walk(dir){await assertSafePath(root,dir,{allowMissing:true});let entries;try{entries=await fs.readdir(dir,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e;}for(const entry of entries){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else await addFile(file);}}
      await walk(folder);
    }
    const patches=changes(docs,after),generation=projectResetGeneration(db,auth.user.id,projectId),etag='"'+integration.revision(auth,projectId)+'"';
    return {target,label,docs,after,patches,sql:selected,allSql:sql,files:archiveFiles,blockers,links,generation,etag,checkpoint:hash([auth.user.id,projectId,etag,target,docs,sql,archiveFiles,generation,blockers])};
  }
  async function preview(auth,projectId,target){
    const s=await inspect(auth,projectId,target);
    return {projectId,target:s.target,label:s.label,etag:s.etag,previewCheckpoint:s.checkpoint,canDelete:s.blockers.length===0,blockerCount:s.blockers.length,blockers:s.blockers.slice(0,5),affected:{links:s.links,proposals:s.sql.proposals.length,requirements:s.sql.requirements.length,files:s.files.length},recovery:'project_item_trash',fileApproval:'manual_gui_per_file',...(s.target.kind==='job'?{warning:'Auftrag und seine Anforderungen/Vorschläge entfallen. Bereits übernommene Dokumente und deren Freigaben bleiben erhalten.'}:{})};
  }
  const folderFor=(auth,deletionId)=>path.join(root,'storage/users',auth.user.id,'item-trash',parse(id,deletionId));
  async function saveFiles(auth,deletionId,entries){
    const folder=folderFor(auth,deletionId);await assertSafePath(root,folder,{allowMissing:true});await fs.mkdir(folder,{recursive:true,mode:0o700});
    for(let i=0;i<entries.length;i++){
      const entry=entries[i],source=path.join(root,entry.path),dest=path.join(folder,String(i));
      await assertSafePath(root,source,{type:'file'});await assertSafePath(root,dest,{allowMissing:true});
      try{await fs.copyFile(source,dest,syncFs.constants.COPYFILE_EXCL)}catch(e){if(e.code!=='EEXIST')throw e;}
      if(await fileHash(dest)!==entry.sha256)throw fault('Dateisicherung stimmt nicht mit der Vorschau überein.',409,'DELETE_BACKUP_INVALID');
    }
  }
  const receipt=(row,s)=>({deletionId:row.id,projectId:row.project_id,target:s.target,label:s.label,state:row.state,createdAt:row.created_at,restoredAt:row.restored_at||null,recoverable:row.state==='deleted',fileApproval:'manual_gui_per_file'});
  async function remove(auth,projectId,target,etag,raw,deletionId,onCommit){
    const input=parse(deletionInput,raw),s=await inspect(auth,projectId,target);assertIdle(auth.user.id,projectId);
    if(etag!==s.etag||input.previewCheckpoint!==s.checkpoint)throw fault('Löschvorschau ist veraltet; erneut prüfen.',412,'DELETE_PREVIEW_STALE');
    if(s.blockers.length)throw fault('Eintrag wird noch von Anforderungen, Rückfragen, offenen Vorschlägen oder Exporten verwendet. Bezüge zuerst ausdrücklich klären.',409,'DELETE_REFERENCES_EXIST');
    await checkStorage(auth.user.id,s.files.reduce((sum,x)=>sum+x.bytes,0));
    await saveFiles(auth,deletionId,s.files);
    if((await inspect(auth,projectId,target)).checkpoint!==s.checkpoint)throw fault('Bestand während der Sicherung geändert.',412,'DELETE_PREVIEW_STALE');
    const snapshot={target:s.target,label:s.label,patches:s.patches,sql:s.sql,files:s.files,generation:s.generation};
    const row={id:deletionId,user_id:auth.user.id,project_id:projectId,kind:s.target.kind,state:'deleted',snapshot:JSON.stringify(snapshot),created_at:new Date().toISOString()};
    const result=receipt(row,snapshot);
    return integration.mutate(auth,projectId,etag,async files=>{
      for(const name of store.PROJECT_DOCUMENTS)if(hash(s.docs[name])!==hash(s.after[name]))await writeJson(path.join(files.dataDir,name),s.after[name]);
      // Auch ein reiner Auftragsvorgang benötigt eine atomare Projektversion.
      store.writeProjectMetadata(root,auth.user.id,projectId,{updatedAt:row.created_at});
      store.onProjectDataCommit(()=>{
        assertIdle(auth.user.id,projectId);
        if(hash(sqlState(auth.user.id,projectId))!==hash(s.allSql))throw fault('Aufträge oder Dateientscheidungen wurden geändert.',412,'DELETE_PREVIEW_STALE');
        schema();
        if(target.kind==='job'){
          if(jobExports(auth.user.id,projectId,target.jobId).length)throw fault('Für diesen Auftrag ist noch ein Export offen. Erst abbrechen oder abschließen.',409,'DELETE_REFERENCES_EXIST');
          db.prepare('DELETE FROM document_review_views WHERE proposal_id IN(SELECT id FROM document_proposals WHERE job_id=?)').run(target.jobId);
          db.prepare('DELETE FROM document_proposals WHERE job_id=?').run(target.jobId);
          db.prepare('DELETE FROM documentation_requirements WHERE job_id=?').run(target.jobId);
          db.prepare('DELETE FROM documentation_jobs WHERE id=? AND user_id=? AND project_id=?').run(target.jobId,auth.user.id,projectId);
        }
        db.prepare('INSERT INTO project_item_deletions(id,user_id,project_id,kind,state,snapshot,snapshot_hash,created_at)VALUES(?,?,?,?,?,?,?,?)').run(row.id,row.user_id,row.project_id,row.kind,row.state,row.snapshot,hash(row.snapshot),row.created_at);
        event(row,'deleted',input);
        onCommit?.(result);
      });return result;
    });
  }
  function event(row,action,input){db.prepare('INSERT INTO project_item_deletion_events(deletion_id,user_id,project_id,action,payload,created_at)VALUES(?,?,?,?,?,?)').run(row.id,row.user_id,row.project_id,action,JSON.stringify(input),new Date().toISOString());}
  function list(auth,projectId,{limit,offset}){
    integration.project(auth,projectId);if(!has('project_item_deletions'))return {items:[],total:0,limit,offset};
    const all=db.prepare('SELECT id,project_id,snapshot,snapshot_hash,state,created_at,restored_at FROM project_item_deletions WHERE user_id=? AND project_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').all(auth.user.id,projectId,limit,offset);
    const items=all.map(row=>{const s=validated(row);const events=db.prepare('SELECT action,payload,created_at FROM project_item_deletion_events WHERE deletion_id=? ORDER BY id').all(row.id).map(x=>({action:x.action,createdAt:x.created_at,...JSON.parse(x.payload)}));return {...receipt(row,s),events};});
    return {items,total:db.prepare('SELECT count(*) n FROM project_item_deletions WHERE user_id=? AND project_id=?').get(auth.user.id,projectId).n,limit,offset};
  }
  function validated(row){if(hash(row.snapshot)!==row.snapshot_hash)throw fault('Papierkorbnachweis ist beschädigt.',409,'DELETE_BACKUP_INVALID');return JSON.parse(row.snapshot);}
  async function restore(auth,projectId,deletionId,etag,raw,onCommit){
    integration.project(auth,projectId);const input=parse(confirmation,raw);parse(id,deletionId);
    const row=has('project_item_deletions')&&db.prepare('SELECT * FROM project_item_deletions WHERE id=? AND user_id=? AND project_id=?').get(deletionId,auth.user.id,projectId);
    if(!row)throw fault('Papierkorbeintrag nicht gefunden.',404,'NOT_FOUND');
    if(row.state!=='deleted')throw fault('Eintrag wurde bereits wiederhergestellt.',409,'ALREADY_RESTORED');
    const s=validated(row),generation=projectResetGeneration(db,auth.user.id,projectId);
    if(generation!==s.generation)throw fault('Projekt wurde inzwischen zurückgesetzt. Alte Einträge nicht automatisch zurückholen.',409,'RESTORE_RESET_CONFLICT');
    assertIdle(auth.user.id,projectId);
    const sql=sqlState(auth.user.id,projectId);
    for(const j of s.sql.jobs)if(db.prepare('SELECT 1 FROM documentation_jobs WHERE id=?').get(j.id))throw fault('Auftragskennung wird bereits verwendet.',409,'RESTORE_CONFLICT');
    const files=dataFilesForProject(root,auth.user.id,projectId),docs={};for(const name of store.PROJECT_DOCUMENTS)docs[name]=await readJson(path.join(files.dataDir,name));
    let restored;try{restored=reverse(docs,s.patches)}catch{throw fault('Betroffene Daten wurden inzwischen geändert. Wiederherstellung würde sie überschreiben.',409,'RESTORE_CONFLICT');}
    // Nur Bezüge prüfen, die diese Wiederherstellung tatsächlich zurückbringt.
    const affectedIds=new Set(s.patches.filter(p=>p.path[0]==='anhaenge.json'&&typeof p.path[1]==='object'&&p.path[1].key==='id').map(p=>p.path[1].value));
    for(const a of restored['anhaenge.json'].filter(a=>affectedIds.has(a.id)&&a.deviceReferences?.length)){
      try{resolveDeviceReferences(restored['geraetelisten.json'],a.deviceReferences,a.category,a.mimeType)}catch{throw fault('Gerät oder Artikelvariante wurde geändert; alte Dokumentzuordnung nicht wiederherstellen.',409,'RESTORE_REFERENCE_CONFLICT');}
    }
    if(etag!=='"'+integration.revision(auth,projectId)+'"')throw fault('Projektstand wurde geändert.',412,'PRECONDITION_FAILED');
    const folder=folderFor(auth,deletionId);
    for(let i=0;i<s.files.length;i++){
      const entry=s.files[i],saved=path.join(folder,String(i)),original=path.join(root,entry.path);
      await assertSafePath(root,saved,{type:'file'});
      if(await fileHash(saved)!==entry.sha256)throw fault('Dateisicherung wurde verändert.',409,'DELETE_BACKUP_INVALID');
      await assertSafePath(root,original,{allowMissing:true});
      try{if(await fileHash(original)!==entry.sha256)throw fault('Originalpfad enthält eine andere Datei.',409,'RESTORE_FILE_CONFLICT');}
      catch(e){if(e.code!=='ENOENT')throw e;await fs.mkdir(path.dirname(original),{recursive:true});await fs.copyFile(saved,original,syncFs.constants.COPYFILE_EXCL);}
    }
    const restoredAt=new Date().toISOString(),result={...receipt(row,s),state:'restored',restoredAt,recoverable:false};
    return integration.mutate(auth,projectId,etag,async files=>{
      for(const name of store.PROJECT_DOCUMENTS)if(hash(docs[name])!==hash(restored[name]))await writeJson(path.join(files.dataDir,name),restored[name]);
      store.writeProjectMetadata(root,auth.user.id,projectId,{updatedAt:restoredAt});
      store.onProjectDataCommit(()=>{
        assertIdle(auth.user.id,projectId);
        if(hash(sqlState(auth.user.id,projectId))!==hash(sql))throw fault('Aufträge/Dateientscheidungen geändert.',412,'PRECONDITION_FAILED');
        if(!db.prepare("UPDATE project_item_deletions SET state='restored',restored_at=? WHERE id=? AND state='deleted' AND snapshot_hash=?").run(restoredAt,row.id,row.snapshot_hash).changes)throw fault('Papierkorbeintrag wurde geändert.',409,'RESTORE_CONFLICT');
        for(const [table,entries]of [['documentation_jobs',s.sql.jobs],['document_proposals',s.sql.proposals],['documentation_requirements',s.sql.requirements],['document_review_views',s.sql.reviews]])for(const entry of entries){const columns=Object.keys(entry);db.prepare('INSERT INTO '+table+'('+columns.join(',')+')VALUES('+columns.map(()=>'?').join(',')+')').run(...Object.values(entry));}
        event(row,'restored',input);onCommit?.(result);
      });return result;
    });
  }
  return {preview,remove,restore,list};
}
module.exports={createItemDeletionService};
