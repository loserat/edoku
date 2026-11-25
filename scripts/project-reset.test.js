const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {writeJson,readJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {createProjectResetService}=require('../services/projectResetService');
const {PDFDocument}=require('pdf-lib');
async function setup({root}){
 const f=dataFilesForProject(root,'alice','same');
 await writeJson(f.projekt,{projektname:'Test',projektnummer:'0815-3',auftraggeber:'Künstlicher Auftraggeber',custom:{keep:true},assistantWorkflow:{jobId:'obsolete'},assistantDecisionHistory:[{old:true}],produktRecherche:[{old:true}],datenblattRecherche:[{old:true}],interneDokumente:{old:{text:'Alt'}},dokumentInhalte:{old:'Alt'}});
 await writeJson(f.geraetelisten,[{id:'devices',leistungsbereich:'Elektroinstallation / DIN VDE 0100',aktiv:true,positionen:[{pos:1,hersteller:'Synthetisch',typ:'T1'},{pos:2,hersteller:'Synthetisch',typ:'T2'}]},{id:'hidden',leistungsbereich:'Brandschutzabschottungen',aktiv:false,positionen:[{pos:1,hersteller:'Alt',typ:'Muster'}]}]);
 const directory=path.join(root,'storage/users/alice/projects/same/uploads');await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'old.txt'),'Künstliche Altdokumentdatei');
 const other=path.join(root,'storage/users/alice/projects/second/uploads');await fs.mkdir(other,{recursive:true});await fs.writeFile(path.join(other,'keep.txt'),'Anderes Projekt unverändert');
}
function otherState(f){return {users:f.db.prepare('SELECT id,email,name,role,status,current_project_id FROM users ORDER BY id').all(),documents:f.db.prepare("SELECT * FROM project_documents WHERE NOT(user_id='alice' AND project_id='same') ORDER BY user_id,project_id,name").all(),lists:f.db.prepare("SELECT * FROM project_device_positions WHERE NOT(user_id='alice' AND project_id='same') ORDER BY user_id,project_id,list_order,position_order").all()};}
async function ui(f){let csrf;const cookies=new Map();const request=async(url,options={})=>{const r=await fetch(f.base+url,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of r.headers.getSetCookie()){const p=line.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1))}return r};const page=async url=>{const r=await request(url);assert.equal(r.status,200);const html=await r.text();csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];return html};await page('/login');assert.equal((await request('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);return {request,page,post:(url,body)=>request(url,{method:'POST',body:new URLSearchParams({_csrf:csrf,...body})})};}

test('Projektreset: verifizierte Sicherung, tatsächliche Einzeldatei, alle Zeilen/Aufträge entfernt und andere Projekte unverändert',async()=>{
 const f=await fixture({setup}),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);
 try{
  const req=(url,options={})=>f.request(url,{token,...options}),root='/projects/same',jobInput={instruction:'Künstlicher kompletter Resettest mit erhaltenen anderen Projekten.'};
  const job=(await req(root+'/assistant/jobs',{method:'POST',headers:{'Idempotency-Key':'reset_old_job_key'},body:jobInput})).data.data;
  const otherJob=(await req('/projects/second/assistant/jobs',{method:'POST',body:{instruction:'Auftrag des anderen Projekts muss erhalten bleiben.'}})).data.data;
  const pdf=await PDFDocument.create();pdf.addPage().drawText('Nur synthetischer Resettest');const form=new FormData();form.set('metadata',JSON.stringify({title:'Synthetisches Datenblatt',category:'Datenblätter',sourceLabel:'Testquelle',reason:'Manuelle Einzelprüfung ausschließlich im künstlichen Test'}));form.set('file',new Blob([await pdf.save()]),'reset-test.pdf');
  const uploaded=await fetch(f.base+'/api/v1'+root+'/assistant/jobs/'+job.id+'/documents',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});assert.equal(uploaded.status,201);const doc=(await uploaded.json()).data;
  const browser=await ui(f),url='/assistent/auftraege/'+job.id+'/dateien/'+doc.id;await browser.page(url);await(await browser.request(url+'/inhalt')).arrayBuffer();
  assert.equal((await browser.post(url+'/uebernehmen',{reviewed:'on',sha256:doc.sha256,revision:(await req(root)).etag.slice(1,-1),title:doc.title,category:doc.category})).status,302);
  const queued=await req(root+'/export-jobs',{method:'POST',headers:{'Idempotency-Key':'reset_export_001'},body:{assistantJobId:job.id}});assert.equal(queued.status,202,JSON.stringify(queued.data));
  for(let n=0;n<30;n++){const r=await req(root+'/export-jobs/'+queued.data.data.id);if(['waiting_input','waiting_review'].includes(r.data.data.state))break;await new Promise(r=>setTimeout(r,30));}
  const files=dataFilesForProject(f.root,'alice','same'),oldDocs=f.db.prepare("SELECT name,payload,source_json FROM project_documents WHERE user_id='alice' AND project_id='same' ORDER BY name").all();
  const before=otherState(f),otherJobBefore=(await req('/projects/second/assistant/jobs/'+otherJob.id)).data.data;
  await client.initialize();const previewReply=(await client.rpc('tools/call',{name:'edoku_preview_project_reset',arguments:{projectId:'same'}})).result;assert.ok(!previewReply.isError,JSON.stringify(previewReply));let preview=previewReply.structuredContent.data;assert.equal(preview.counts.deviceRows,3);assert.equal(preview.counts.assistantJobs,1);assert.equal(preview.counts.proposals,1);assert.equal(preview.counts.attachments,1);
  const body=p=>({previewCheckpoint:p.previewCheckpoint,confirm:true,confirmProjectId:'same',confirmProjectNumber:'0815-3',evidence:{sourceLabel:'Künstlicher Benutzerchat',sourceQuote:'Nur das künstliche Testprojekt vollständig zurücksetzen.'}});
  assert.equal((await req(root+'/reset',{method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_bad_confirm'},body:{...body(preview),confirmProjectId:'second'}})).status,409);
  await req(root+'/assistant/jobs/'+job.id,{method:'PATCH',body:{message:'Nach der Vorschau geänderte künstliche Rückmeldung.'}});
  assert.equal((await req(root+'/reset',{method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_stale_preview'},body:body(preview)})).status,412);
  f.db.prepare("UPDATE documentation_exports SET state='running',lease_until=? WHERE id=?").run(Date.now()+60000,queued.data.data.id);preview=(await req(root+'/reset-preview')).data.data;
  assert.equal((await req(root+'/reset',{method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_busy_export'},body:body(preview)})).status,409);
  f.db.prepare("UPDATE documentation_exports SET state='waiting_input',lease_until=0,lease_owner=NULL WHERE id=?").run(queued.data.data.id);
  preview=(await req(root+'/reset-preview')).data.data;const input=body(preview),args={projectId:'same',etag:preview.etag,requestId:'reset_test_execute_001',input};
  const readOnly=f.makeToken('alice',{scopes:['projects:read']}).token;assert.equal((await f.request(root+'/reset',{token:readOnly,method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_read_only'},body:input})).status,403);
  const scoped=f.makeToken('alice',{scopes,projectIds:['second']}).token;assert.equal((await f.request(root+'/reset',{token:scoped,method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_wrong_scope'},body:input})).status,404);
  const result=(await client.rpc('tools/call',{name:'edoku_reset_project',arguments:args})).result;assert.ok(!result.isError,JSON.stringify(result));const receipt=result.structuredContent.data;assert.equal(receipt.backupVerified,true);assert.equal(receipt.cleanup.status,'complete',JSON.stringify(receipt.cleanup));
  const backup=path.join(f.root,receipt.backupPath),snapshot=JSON.parse(await fs.readFile(path.join(backup,'snapshot.json')));assert.equal(snapshot.proposals.length,1);assert.equal(snapshot.reviews.length,1);assert.deepEqual(snapshot.documentRows.map(x=>({name:x.name,payload:x.payload,source_json:x.source_json})),oldDocs);
  assert.equal((await req(root+'/assistant/jobs')).data.data.total,0);assert.equal((await req(root+'/attachments')).data.data.total,0);assert.equal((await req(root+'/export-jobs')).data.data.total,0);assert.equal((await req(root+'/datasheet-coverage')).data.data.summary.articles,0);
  assert.equal(f.db.prepare("SELECT count(*) n FROM project_device_positions WHERE user_id='alice' AND project_id='same'").get().n,0);
  assert.equal((await req(root+'/assistant/jobs/'+job.id)).status,404);assert.equal((await browser.request(url+'/inhalt')).status,404);
  await fs.writeFile(path.join(files.dataDir,'../uploads/old.txt'),'Künstliche Altdokumentdatei');await fs.writeFile(path.join(backup,'cleanup.json'),JSON.stringify({status:'pending'}));const resetService=createProjectResetService(f.root),auth={user:{id:'alice',role:'systemadmin'},token:{projectIds:null}};const parallel=await Promise.all([resetService.cleanup(auth,'same',receipt),resetService.cleanup(auth,'same',receipt)]);assert.ok(parallel.every(x=>x.status==='complete'));
  const data=await readJson(files.projekt,{});assert.equal(data.auftraggeber,'Künstlicher Auftraggeber');assert.deepEqual(data.custom,{keep:true});assert.equal(data.assistantWorkflow,undefined);assert.equal(data.produktRecherche,undefined);assert.deepEqual(await readJson(files.anhaenge,[]),[]);
  assert.deepEqual(otherState(f),before);assert.deepEqual((await req('/projects/second/assistant/jobs/'+otherJob.id)).data.data,otherJobBefore);assert.equal(await fs.readFile(path.join(f.root,'storage/users/alice/projects/second/uploads/keep.txt'),'utf8'),'Anderes Projekt unverändert');
  await f.restart();assert.equal((await req(root+'/datasheet-coverage')).data.data.summary.articles,0);assert.equal(f.db.prepare("SELECT count(*) n FROM project_device_positions WHERE user_id='alice' AND project_id='same'").get().n,0);
  // Getrennte SQLite-Kopie aus dem projektspezifischen Snapshot wiederherstellen.
  const restoredRoot=path.join(f.root,'reset-restore-proof');await fs.mkdir(restoredRoot,{recursive:true});const dbFile=path.join(restoredRoot,'app.db');await f.db.backup(dbFile);
  const Database=require('better-sqlite3'),restore=new Database(dbFile);restore.pragma('foreign_keys=ON');
  restore.transaction(()=>{
   const fields=Object.keys(snapshot.projectRecord).filter(k=>!['id','user_id'].includes(k));restore.prepare('UPDATE projects SET '+fields.map(k=>k+'=?').join(',')+' WHERE user_id=? AND id=?').run(...fields.map(k=>snapshot.projectRecord[k]),'alice','same');
   restore.prepare('UPDATE project_data_revisions SET version=? WHERE user_id=? AND project_id=?').run(snapshot.revisionRow.version,'alice','same');
   for(const record of snapshot.documentRows){const columns=Object.keys(record);restore.prepare('INSERT OR REPLACE INTO project_documents('+columns.join(',')+')VALUES('+columns.map(()=>'?').join(',')+')').run(...columns.map(k=>record[k]));}
   for(const [table,records]of [['documentation_jobs',snapshot.jobs],['documentation_requirements',snapshot.requirements],['document_proposals',snapshot.proposals],['document_review_views',snapshot.reviews],['documentation_exports',snapshot.exports]])for(const record of records){const columns=Object.keys(record);restore.prepare('INSERT INTO '+table+'('+columns.join(',')+')VALUES('+columns.map(()=>'?').join(',')+')').run(...columns.map(k=>record[k]));}
  })();
  assert.equal(restore.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(restore.pragma('foreign_key_check'),[]);assert.equal(restore.prepare("SELECT count(*) n FROM project_device_positions WHERE user_id='alice' AND project_id='same'").get().n,3);assert.equal(restore.prepare('SELECT count(*) n FROM documentation_jobs WHERE id=?').get(job.id).n,1);assert.deepEqual(restore.prepare("SELECT name,payload,source_json FROM project_documents WHERE user_id='alice' AND project_id='same' ORDER BY name").all(),oldDocs);restore.close();
  for(const entry of snapshot.files){const dest=path.join(restoredRoot,'files',entry.path);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(backup,'files',entry.path),dest);}
  assert.equal(await fs.readFile(path.join(restoredRoot,'files',path.relative(f.root,path.join(files.dataDir,'../uploads/old.txt'))),'utf8'),'Künstliche Altdokumentdatei');
  const next=(await req(root+'/next-action?view=compact')).data.data;assert.equal(next.reset.materialPolicy,'new_material_only');
  const fresh=(await req(root+'/assistant/jobs',{method:'POST',headers:{'Idempotency-Key':'reset_old_job_key'},body:jobInput})).data.data;assert.notEqual(fresh.id,job.id);
  await fs.writeFile(path.join(files.dataDir,'../uploads/old.txt'),'Künstliche Altdokumentdatei');
  const repeated=(await client.rpc('tools/call',{name:'edoku_reset_project',arguments:args})).result;assert.ok(!repeated.isError);assert.equal(repeated.structuredContent.data.resetId,receipt.resetId);assert.equal((await req(root+'/assistant/jobs')).data.data.total,1);assert.equal(await fs.readFile(path.join(files.dataDir,'../uploads/old.txt'),'utf8'),'Künstliche Altdokumentdatei');
 }finally{await client.close();await f.cleanup()}
});

test('Resetfehler: Datenbankfehler nimmt alle Änderungen zurück; beschädigte Sicherung oder Symlink löscht nichts',async()=>{
 const f=await fixture({setup}),token=f.makeToken('alice',{scopes}).token;
 try{
  const req=(url,options={})=>f.request(url,{token,...options}),root='/projects/same',job=(await req(root+'/assistant/jobs',{method:'POST',body:{instruction:'Künstlicher Reset mit absichtlich ausgelöstem Datenbankfehler.'}})).data.data;
  const files=dataFilesForProject(f.root,'alice','same'),before=await readJson(files.projekt,{}),preview=(await req(root+'/reset-preview')).data.data,input={previewCheckpoint:preview.previewCheckpoint,confirm:true,confirmProjectId:'same',confirmProjectNumber:'0815-3',evidence:{sourceLabel:'Test',sourceQuote:'Reset ausdrücklich im künstlichen Test ausführen.'}},headers={'If-Match':preview.etag,'Idempotency-Key':'reset_atomic_failure'};
  f.db.exec(`CREATE TRIGGER reset_concurrent AFTER UPDATE OF payload ON project_documents WHEN NEW.user_id='alice' AND NEW.project_id='same' AND NEW.name='geraetelisten.json' BEGIN INSERT INTO documentation_requirements(job_id,id,payload) VALUES('${job.id}','concurrent','{"id":"concurrent","title":"Gleichzeitig ergänzt","category":"Nachweise"}'); END`);
  try{assert.equal((await req(root+'/reset',{method:'POST',headers:{...headers,'Idempotency-Key':'reset_concurrent_change'},body:input})).status,412);assert.deepEqual(await readJson(files.projekt,{}),before);assert.equal(f.db.prepare("SELECT count(*) n FROM documentation_requirements WHERE id='concurrent'").get().n,0);}finally{f.db.exec('DROP TRIGGER reset_concurrent')}
  f.db.exec("CREATE TRIGGER reset_fail BEFORE DELETE ON documentation_jobs BEGIN SELECT RAISE(ABORT,'synthetic reset failure'); END");
  try{assert.equal((await req(root+'/reset',{method:'POST',headers,body:input})).status,500);assert.deepEqual(await readJson(files.projekt,{}),before);assert.equal((await req(root+'/assistant/jobs/'+job.id)).status,200);assert.equal(await fs.readFile(path.join(files.dataDir,'../uploads/old.txt'),'utf8'),'Künstliche Altdokumentdatei');assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='project_resets'").get(),undefined);}finally{f.db.exec('DROP TRIGGER reset_fail')}
  const done=await req(root+'/reset',{method:'POST',headers,body:input});assert.equal(done.status,200,JSON.stringify(done.data));assert.equal(done.data.data.cleanup.status,'complete');
  const symlink=path.join(files.dataDir,'../uploads/link');await fs.symlink(path.join(f.root,'storage/users/alice/projects/second/uploads/keep.txt'),symlink);assert.equal((await req(root+'/reset-preview')).status,409);await fs.unlink(symlink);
  await fs.writeFile(path.join(files.dataDir,'../uploads/again.txt'),'Zweite künstliche Datei');
  const service=createProjectResetService(f.root),auth={user:{id:'alice',role:'systemadmin'},token:{projectIds:null}},p=await service.preview(auth,'same');
  const copy=fs.copyFile;fs.copyFile=async(...args)=>{await copy(...args);await fs.writeFile(args[1],'absichtlich beschädigt')};
  try{await assert.rejects(service.execute(auth,'same',p.etag,{...input,previewCheckpoint:p.previewCheckpoint},'reset_corrupt_backup',()=>{}),/Sicherung/);assert.equal(await fs.readFile(path.join(files.dataDir,'../uploads/again.txt'),'utf8'),'Zweite künstliche Datei');}finally{fs.copyFile=copy}
 }finally{await f.cleanup()}
});

test('Gemeinsame Alt-Ausgaben bleiben erhalten und werden nach einem Reset keinem anderen Projekt zugeschlagen',async()=>{
 const f=await fixture({setup}),token=f.makeToken('alice',{scopes}).token;
 try{
  const crypto=require('node:crypto'),p={projektname:'Gemeinsame Alt-Ausgabe',projektnummer:'SHARED'},json=JSON.stringify(p),sha=crypto.createHash('sha256').update(json).digest('hex');
  for(const user of ['alice','bob'])f.db.prepare("UPDATE project_documents SET source_json=?,source_sha256=? WHERE user_id=? AND project_id='same' AND name='projekt.json'").run(json,sha,user);
  const {getProjectPaths,bindProjectScope,legacyOutputStatus}=require('../services/projectService'),legacy=getProjectPaths(f.root,p).projectPath;await fs.mkdir(legacy,{recursive:true});await fs.writeFile(path.join(legacy,'shared.pdf'),'Unveränderte gemeinsam zugeordnete Alt-Ausgabe');
  const req=(url,options={})=>f.request(url,{token,...options}),preview=(await req('/projects/same/reset-preview')).data.data;assert.equal(preview.sharedLegacyOutputs,'retained');
  const r=await req('/projects/same/reset',{method:'POST',headers:{'If-Match':preview.etag,'Idempotency-Key':'reset_shared_legacy'},body:{previewCheckpoint:preview.previewCheckpoint,confirm:true,confirmProjectId:'same',confirmProjectNumber:'0815-3',evidence:{sourceLabel:'Test',sourceQuote:'Nur das eigene Testprojekt zurücksetzen; gemeinsame Dateien erhalten.'}}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.data.cleanup.status,'complete');
  assert.equal(await fs.readFile(path.join(legacy,'shared.pdf'),'utf8'),'Unveränderte gemeinsam zugeordnete Alt-Ausgabe');assert.equal(legacyOutputStatus(f.root,bindProjectScope({...p},'bob','same')),'ambiguous');
 }finally{await f.cleanup()}
});
