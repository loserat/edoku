const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {connection}=require('./dbService');
const {createIntegrationService}=require('./integrationService');
const {dataFilesForProject}=require('./projectArchiveService');
const {scopedProjectRoot,bindProjectScope,readableProjectPaths,legacyOutputStatus,projectFolderName}=require('./projectService');
const {syncDeviceListsPreservingFields}=require('./projectWorkspaceService');
const {readJson,writeJson}=require('./jsonService');
const {assertSafePath}=require('./pathService');
const store=require('./projectDataStoreService');
const {parse,fault}=require('../src/api/validation');
const {id}=require('../src/api/schemas');
const {resetInput}=require('../src/api/resetSchemas');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function fileHash(file){const h=crypto.createHash('sha256');for await(const chunk of syncFs.createReadStream(file))h.update(chunk);return h.digest('hex');}
const inside=(base,file)=>{const r=path.relative(base,file);return !r.startsWith('..')&&!path.isAbsolute(r);};
function createProjectResetService(root,{db=connection()}={}) {
 const integration=createIntegrationService(root),has=table=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
 const rows=(table,sql,args)=>has(table)?db.prepare(sql).all(...args):[];
 const cleanupJobs=new Map();
 const stableExportRows=entries=>entries.map(({next_check_at,lease_owner,lease_until,updated_at,...x})=>x);
 async function snapshot(auth,projectId){
  integration.project(auth,projectId);
  const projectRecord=db.prepare('SELECT * FROM projects WHERE user_id=? AND id=?').get(auth.user.id,projectId);
  const docs=db.prepare('SELECT * FROM project_documents WHERE user_id=? AND project_id=? ORDER BY name').all(auth.user.id,projectId);
  if(docs.length!==store.PROJECT_DOCUMENTS.length)throw fault('Reset benötigt den vollständigen SQLite-Projektspeicher.',409,'STORAGE_REQUIRED');
  const documents=Object.fromEntries(docs.map(x=>[x.name,JSON.parse(x.payload)])),project=documents['projekt.json'];
  const jobs=rows('documentation_jobs','SELECT * FROM documentation_jobs WHERE user_id=? AND project_id=? ORDER BY id',[auth.user.id,projectId]);
  const jobIds=jobs.map(j=>j.id);jobIds.forEach(x=>parse(id,x));
  const proposals=rows('document_proposals','SELECT p.* FROM document_proposals p JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY p.id',[auth.user.id,projectId]);
  const requirements=rows('documentation_requirements','SELECT r.* FROM documentation_requirements r JOIN documentation_jobs j ON j.id=r.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY r.id',[auth.user.id,projectId]);
  const reviews=rows('document_review_views','SELECT v.* FROM document_review_views v JOIN document_proposals p ON p.id=v.proposal_id JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY v.proposal_id,v.user_id',[auth.user.id,projectId]);
  const exports=rows('documentation_exports','SELECT * FROM documentation_exports WHERE user_id=? AND project_id=? ORDER BY id',[auth.user.id,projectId]);
  const scoped=bindProjectScope({...project},auth.user.id,projectId),legacy=legacyOutputStatus(root,scoped);
  const original=store.initialProjectDocument(root,auth.user.id,projectId,'projekt.json')||project;
  const legacyClaims=legacy==='none'?[]:[path.relative(root,path.join(root,'output/projekte',projectFolderName(original))).split(path.sep).join('/')];
  const roots=[scopedProjectRoot(root,auth.user.id,projectId),...readableProjectPaths(root,scoped).map(x=>x.projectPath),...jobIds.map(x=>path.join(root,'storage/users',auth.user.id,'assistant',x))];
  const files=new Map();
  async function walk(folder){await assertSafePath(root,folder,{allowMissing:true});let items;try{items=await fs.readdir(folder,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e;}
   for(const item of items){const file=path.join(folder,item.name);if(item.isSymbolicLink())throw fault('Symlink im Resetbereich: manuelle Prüfung erforderlich.',409,'RESET_SYMLINK');if(item.isDirectory())await walk(file);else if(item.isFile()){const key=path.relative(root,file).split(path.sep).join('/');if(!files.has(key)){const stat=await fs.stat(file);files.set(key,{path:key,bytes:stat.size,sha256:await fileHash(file)})}}else throw fault('Unbekannter Dateityp im Resetbereich.',409,'RESET_FILE_TYPE');}
  }
  for(const folder of roots.filter((x,i,a)=>!a.some((other,j)=>j!==i&&other!==x&&inside(other,x))))await walk(folder);
  const fileList=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
  const version=store.projectDataRevision(root,auth.user.id,projectId),stableExports=stableExportRows(exports);
  const checkpoint=hash([auth.user.id,projectId,version,docs,jobs,proposals,requirements,reviews,stableExports,fileList]);
  return {projectId,userId:auth.user.id,projectRecord,revisionRow:db.prepare('SELECT * FROM project_data_revisions WHERE user_id=? AND project_id=?').get(auth.user.id,projectId),project,documents,documentRows:docs,jobs,proposals,requirements,reviews,exports,files:fileList,checkpoint,etag:'"'+version+'"',legacy,legacyClaims,counts:{deviceRows:(documents['geraetelisten.json']||[]).reduce((n,x)=>n+(x.positionen||[]).length,0),attachments:(documents['anhaenge.json']||[]).length,assistantJobs:jobs.length,proposals:proposals.length,reviewViews:reviews.length,requirements:requirements.length,exports:exports.length,files:fileList.length,bytes:fileList.reduce((n,x)=>n+x.bytes,0)}};
 }
 async function preview(auth,projectId){const s=await snapshot(auth,projectId);return {projectId,projectName:s.project.projektname||'',projectNumber:s.project.projektnummer||'',etag:s.etag,previewCheckpoint:s.checkpoint,counts:s.counts,backupRequired:true,retained:['Projektkennung und Stammdaten','Listen- und Kapitelstruktur','Andere Projekte und Benutzer','Manuelle Dateifreigabe'],sharedLegacyOutputs:s.legacy==='ambiguous'?'retained':'none_or_exclusively_owned'};}
 const folderFor=(user,resetId)=>path.join(root,'storage/users',user,'project-reset-backups',parse(id,resetId));
 function cleared(s){
  const project={...s.project};for(const key of Object.keys(project))if(key.startsWith('assistant')||['produktRecherche','datenblattRecherche','interneDokumente','dokumentInhalte'].includes(key))delete project[key];
  const lists=syncDeviceListsPreservingFields(s.documents['geraetelisten.json']||[],s.documents['leistungsbereiche.json']?.aktiv||[],[]).map(x=>({...x,herstellerVorauswahl:'',systemartVorauswahl:'',positionen:[]}));
  return {...s.documents,'projekt.json':project,'geraetelisten.json':lists,'projektSysteme.json':[],'anhaenge.json':[],'brandschutz.json':[],'exportliste.json':[],'files.json':[]};
 }
 async function backup(s,resetId){
  const folder=folderFor(s.userId,resetId);await assertSafePath(root,folder,{allowMissing:true});
  try{const old=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));if(old.checkpoint!==s.checkpoint)throw fault('Vorhandene Sicherung gehört zu einem anderen Stand.',409,'RESET_BACKUP_CONFLICT');await verifyBackup(folder,old);return {folder,manifest:old};}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.mkdir(folder,{recursive:true,mode:0o700});
  const contents=JSON.stringify(s),snapshotHash=hash(contents);await fs.writeFile(path.join(folder,'snapshot.json'),contents,{mode:0o600});
  for(const entry of s.files){const dest=path.join(folder,'files',entry.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,entry.path),dest);if(await fileHash(dest)!==entry.sha256)throw fault('Sicherung stimmt nicht mit Dateistand überein.',409,'RESET_BACKUP_CHANGED');}
  const manifest={format:'edoku-project-reset',version:1,resetId,userId:s.userId,projectId:s.projectId,checkpoint:s.checkpoint,snapshotHash,files:s.files,clearedDocuments:cleared(s),createdAt:new Date().toISOString()};
  await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest),{mode:0o600});await verifyBackup(folder,manifest);return {folder,manifest};
 }
 async function verifyBackup(folder,manifest){const bytes=await fs.readFile(path.join(folder,'snapshot.json'),'utf8');if(hash(bytes)!==manifest.snapshotHash)throw fault('Sicherungsdaten sind beschädigt.',409,'RESET_BACKUP_INVALID');const saved=JSON.parse(bytes);if(saved.userId!==manifest.userId||saved.projectId!==manifest.projectId||saved.checkpoint!==manifest.checkpoint||hash(saved.files)!==hash(manifest.files)||hash(cleared(saved))!==hash(manifest.clearedDocuments))throw fault('Sicherungsmanifest ist unvollständig oder verändert.',409,'RESET_BACKUP_INVALID');for(const f of manifest.files){const file=path.resolve(folder,'files',f.path);if(!inside(path.join(folder,'files'),file)||await fileHash(file)!==f.sha256)throw fault('Sicherungsdatei ist beschädigt.',409,'RESET_BACKUP_INVALID');}}
 function schema(){db.exec(`CREATE TABLE IF NOT EXISTS project_reset_generations(user_id TEXT NOT NULL,project_id TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(user_id,project_id));CREATE TABLE IF NOT EXISTS project_resets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,receipt TEXT NOT NULL CHECK(json_valid(receipt)),created_at TEXT NOT NULL);`);}
 async function execute(auth,projectId,etag,raw,resetId,onCommit){
  const input=parse(resetInput,raw),s=await snapshot(auth,projectId);
  if(input.confirmProjectId!==projectId||input.confirmProjectNumber!==(s.project.projektnummer||''))throw fault('Projektbestätigung stimmt nicht überein.',409,'RESET_CONFIRMATION_MISMATCH');
  if(etag!==s.etag)throw fault('Projektstand wurde geändert.',412,'PRECONDITION_FAILED');if(input.previewCheckpoint!==s.checkpoint)throw fault('Resetvorschau ist veraltet.',412,'RESET_PREVIEW_STALE');
  if(s.exports.some(x=>x.state==='running'&&x.lease_until>Date.now()))throw fault('Ein Export läuft noch. Nach dessen Ende Vorschau erneut lesen.',409,'RESET_EXPORT_BUSY');
  const {manifest}=await backup(s,resetId),backupDigest=hash(manifest);
  if((await snapshot(auth,projectId)).checkpoint!==s.checkpoint)throw fault('Projekt während der Sicherung geändert; keine Daten gelöscht.',412,'RESET_PREVIEW_STALE');
  return integration.mutate(auth,projectId,etag,async files=>{
   const values=manifest.clearedDocuments;for(const name of store.PROJECT_DOCUMENTS)await writeJson(path.join(files.dataDir,name),values[name]);
   const receipt={resetId,projectId,projectName:s.project.projektname||'',projectNumber:s.project.projektnummer||'',backupVerified:true,backupDigest,backupPath:path.relative(root,folderFor(auth.user.id,resetId)),removed:s.counts,legacyClaims:s.legacyClaims,fileApproval:'manual_gui_per_file'};
   store.onProjectDataCommit(()=>{
    // Frage-/Dateientscheidungen sind nicht im Projekt-ETag enthalten: zusätzlich erneut prüfen.
    const currentJobs=rows('documentation_jobs','SELECT * FROM documentation_jobs WHERE user_id=? AND project_id=? ORDER BY id',[auth.user.id,projectId]);
    const currentProposals=rows('document_proposals','SELECT p.* FROM document_proposals p JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY p.id',[auth.user.id,projectId]);
    const currentRequirements=rows('documentation_requirements','SELECT r.* FROM documentation_requirements r JOIN documentation_jobs j ON j.id=r.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY r.id',[auth.user.id,projectId]);
    const currentReviews=rows('document_review_views','SELECT v.* FROM document_review_views v JOIN document_proposals p ON p.id=v.proposal_id JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=? ORDER BY v.proposal_id,v.user_id',[auth.user.id,projectId]);
    const currentExports=rows('documentation_exports','SELECT * FROM documentation_exports WHERE user_id=? AND project_id=? ORDER BY id',[auth.user.id,projectId]);
    if(hash([currentJobs,currentProposals,currentRequirements,currentReviews,stableExportRows(currentExports)])!==hash([s.jobs,s.proposals,s.requirements,s.reviews,stableExportRows(s.exports)]))throw fault('Auftrag, Dateientscheidung oder Export während Reset geändert.',412,'RESET_PREVIEW_STALE');
    for(const [table,column]of [['document_review_views','proposal_id'],['document_proposals','job_id'],['documentation_requirements','job_id']])if(has(table)){
     const condition=column==='proposal_id'?'SELECT p.id FROM document_proposals p JOIN documentation_jobs j ON j.id=p.job_id WHERE j.user_id=? AND j.project_id=?':'SELECT id FROM documentation_jobs WHERE user_id=? AND project_id=?';db.prepare('DELETE FROM '+table+' WHERE '+column+' IN ('+condition+')').run(auth.user.id,projectId);
    }
    if(has('documentation_exports'))db.prepare('DELETE FROM documentation_exports WHERE user_id=? AND project_id=?').run(auth.user.id,projectId);
    if(has('documentation_jobs'))db.prepare('DELETE FROM documentation_jobs WHERE user_id=? AND project_id=?').run(auth.user.id,projectId);
    for(const name of store.PROJECT_DOCUMENTS){const json=JSON.stringify(values[name]);db.prepare('UPDATE project_documents SET source_json=?,source_sha256=? WHERE user_id=? AND project_id=? AND name=?').run(json,hash(json),auth.user.id,projectId,name);}
    schema();db.prepare('INSERT INTO project_reset_generations(user_id,project_id,generation)VALUES(?,?,1) ON CONFLICT(user_id,project_id)DO UPDATE SET generation=generation+1').run(auth.user.id,projectId);
    db.prepare('INSERT INTO project_resets VALUES(?,?,?,?,?)').run(resetId,auth.user.id,projectId,JSON.stringify({...receipt,evidence:input.evidence}),new Date().toISOString());
    if(onCommit)onCommit(receipt);
   });return receipt;
  });
 }
 async function performCleanup(auth,projectId,receipt){
  integration.project(auth,projectId);const row=has('project_resets')&&db.prepare('SELECT * FROM project_resets WHERE id=? AND user_id=? AND project_id=?').get(receipt.resetId,auth.user.id,projectId);if(!row)throw fault('Resetnachweis fehlt.',409,'RESET_RECEIPT_MISSING');
  const folder=folderFor(auth.user.id,receipt.resetId),manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));if(hash(manifest)!==receipt.backupDigest)throw fault('Sicherungsmanifest wurde geändert.',409,'RESET_BACKUP_INVALID');await verifyBackup(folder,manifest);
  try{const previous=JSON.parse(await fs.readFile(path.join(folder,'cleanup.json'),'utf8'));if(previous.status==='complete')return previous;}catch(e){if(e.code!=='ENOENT')throw e;}
  const warnings=[];const dataDir=dataFilesForProject(root,auth.user.id,projectId).dataDir,sourceNames=new Set(store.PROJECT_DOCUMENTS.map(n=>path.relative(root,path.join(dataDir,n)).split(path.sep).join('/')));
  for(const entry of manifest.files){if(sourceNames.has(entry.path))continue;const source=path.join(root,entry.path);try{await assertSafePath(root,source,{type:'file'});if(await fileHash(source)!==entry.sha256){warnings.push({path:entry.path,reason:'changed'});continue;}await fs.unlink(source);}catch(e){if(e.code!=='ENOENT')warnings.push({path:entry.path,reason:'cleanup_failed'});}}
  for(const name of store.PROJECT_DOCUMENTS){const file=path.join(dataDir,name),key=path.relative(root,file).split(path.sep).join('/'),old=manifest.files.find(x=>x.path===key),json=JSON.stringify(manifest.clearedDocuments[name]);try{await assertSafePath(root,file,{allowMissing:true});let current;try{current=await fileHash(file)}catch(e){if(e.code!=='ENOENT')throw e;}if(current&&current!==old?.sha256&&current!==hash(json)){warnings.push({path:key,reason:'changed'});continue;}await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.reset-'+receipt.resetId+'.tmp';await fs.writeFile(tmp,json,{mode:0o600});await fs.rename(tmp,file);}catch{warnings.push({path:key,reason:'cleanup_failed'});}}
  const result={status:warnings.length?'pending':'complete',warnings:warnings.slice(0,10),warningCount:warnings.length,retrySameRequest:warnings.length>0};await fs.writeFile(path.join(folder,'cleanup.json'),JSON.stringify(result),{mode:0o600});return result;
 }
 async function cleanup(auth,projectId,receipt){const key=JSON.stringify([auth.user.id,projectId,receipt.resetId]);if(cleanupJobs.has(key))return cleanupJobs.get(key);const running=performCleanup(auth,projectId,receipt);cleanupJobs.set(key,running);try{return await running}finally{cleanupJobs.delete(key)}}
 return {preview,execute,cleanup};
}
module.exports={createProjectResetService};
