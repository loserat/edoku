const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {writeJson,readJson}=require('../services/jsonService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const {PDFDocument}=require('pdf-lib');
const confirmation={confirm:true,reason:'Ausdrückliche Korrektur im künstlichen Test',evidence:{sourceLabel:'Synthetischer Benutzerchat',sourceQuote:'Genau den genannten Testeintrag entfernen beziehungsweise wiederherstellen.'}};
async function setup({root}){
 const files=dataFilesForProject(root,'alice','same');
 await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:'Elektroinstallation / DIN VDE 0100',aktiv:true,positionen:[{pos:1,hersteller:'Testhersteller',typ:'T1',custom:'erhalten'},{pos:2,hersteller:'Testhersteller',typ:'T1'}]}]);
 await writeJson(files.leistungsbereiche,{aktiv:['Elektroinstallation / DIN VDE 0100'],optionen:['Elektroinstallation / DIN VDE 0100']});
}
async function context(){
 const f=await fixture({setup}),token=f.makeToken('alice',{scopes}).token;
 const req=(url,options={})=>f.request(url,{token,...options}),base='/projects/same';
 const etag=async()=>(await req(base)).etag;
 const preview=async target=>{const r=await req(base+'/deletions/preview?'+new URLSearchParams(target));assert.equal(r.status,200,JSON.stringify(r.data));return r.data.data;};
 const remove=async(target,key='delete_single_item',p)=>{p||=await preview(target);const route=target.kind==='device'?`/device-lists/${target.listId}/positions/${target.position}`:target.kind==='document'?'/attachments/'+target.attachmentId:'/assistant/jobs/'+target.jobId;return req(base+route,{method:'DELETE',headers:{'If-Match':p.etag,'Idempotency-Key':key},body:{...confirmation,previewCheckpoint:p.previewCheckpoint}});};
 const restore=async(id,key='restore_single_item')=>req(base+'/deletions/'+id+'/restore',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':key},body:confirmation});
 return {...f,serverBase:f.base,req,base,etag,preview,remove,restore,token};
}
async function approved(f){
 const assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),reference={listId:'devices',position:1,manufacturer:'Testhersteller',model:'T1'};
 const job=assistant.create('alice','same',{instruction:'Künstliche Dokumentation mit manuell geprüftem Original.',requirements:[{id:'sheet',title:'Datenblatt T1',category:'Datenblätter',device:reference}]});
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetisches Testdatenblatt');const bytes=Buffer.from(await pdf.save());
 const proposal=await assistant.propose('alice',job.id,{title:'T1 Datenblatt',category:'Datenblätter',sourceLabel:'Künstlicher Hersteller',reason:'Exakte Testvariante',requirementIds:['sheet'],deviceReferences:[reference]},{buffer:bytes,originalName:'test.pdf'});
 await assistant.content('alice',job.id,proposal.id);assistant.viewed('alice',job.id,proposal.id,proposal.sha256);
 const attachmentId=await assistant.approve('alice',job.id,proposal.id,{reviewed:'on',sha256:proposal.sha256,revision:(await f.etag()).slice(1,-1),metadata:{title:proposal.title,category:proposal.category}});
 const files=dataFilesForProject(f.root,'alice','same'),attachment=(await readJson(files.anhaenge)).find(x=>x.id===attachmentId);
 return {assistant,job,proposal,attachment,bytes};
}
function others(f){return f.db.prepare("SELECT user_id,project_id,name,payload FROM project_documents WHERE NOT(user_id='alice' AND project_id='same') ORDER BY user_id,project_id,name").all();}

test('Einzellöschung über MCP: Geräteposition, sichere Wiederholung, reservierte Nummer und gezielte Wiederherstellung',async()=>{
 const f=await context(),mcp=mcpClient(f.serverBase,f.token,true);
 try{
  await mcp.initialize();
  const call=async(name,args)=>{const result=await mcp.rpc('tools/call',{name,arguments:args});assert.ok(!result.result.isError,JSON.stringify(result));return result.result.structuredContent||JSON.parse(result.result.content[0].text);};
  const target={kind:'device',listId:'devices',position:1},before=others(f),p=(await call('edoku_preview_deletion',{projectId:'same',target})).data;
  assert.equal(p.canDelete,true);
  const removed=(await call('edoku_delete_device_position',{projectId:'same',listId:'devices',position:1,etag:p.etag,requestId:'device_delete_roundtrip',input:{...confirmation,previewCheckpoint:p.previewCheckpoint}})).data;
  assert.equal((await f.remove(target,'device_delete_roundtrip',p)).replayed,'true');
  const lists=()=>readJson(dataFilesForProject(f.root,'alice','same').geraetelisten);
  assert.deepEqual((await lists())[0].positionen.map(x=>x.pos),[2]);
  const added=await f.req(f.base+'/device-lists/devices/positions',{method:'POST',headers:{'If-Match':await f.etag(),'Idempotency-Key':'new_after_delete'},body:{hersteller:'Neu',typ:'T3'}});assert.equal(added.status,201);assert.equal(added.data.data.pos,3);
  const r=await f.restore(removed.deletionId);assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual((await lists())[0].positionen.map(x=>x.pos),[1,2,3]);assert.equal((await lists())[0].positionen[0].custom,'erhalten');
  assert.equal((await f.restore(removed.deletionId)).replayed,'true');
  assert.equal((await f.remove(target,'device_delete_roundtrip',p)).replayed,'true');assert.deepEqual((await lists())[0].positionen.map(x=>x.pos),[1,2,3]);
  const log=(await f.req(f.base+'/deletions?limit=1')).data.data;assert.equal(log.total,1);assert.deepEqual(log.items[0].events.map(x=>x.action),['deleted','restored']);assert.deepEqual(others(f),before);
  await f.restart();assert.deepEqual((await lists())[0].positionen.map(x=>x.pos),[1,2,3]);
 }finally{await mcp.close();await f.cleanup();}
});

test('Dokumentlöschung trennt Bezüge, lässt Pflichtquelle offen und stellt ausschließlich unveränderte freigegebene Originale wieder her',async()=>{
 const f=await context();try{
  const a=await approved(f),before=others(f),target={kind:'document',attachmentId:a.attachment.id};
  const r=await f.remove(target,'document_delete_roundtrip');assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.data.deletionId;
  const files=dataFilesForProject(f.root,'alice','same');assert.deepEqual(await readJson(files.anhaenge),[]);assert.equal((await readJson(files.geraetelisten))[0].positionen[0].datenblattId,'');
  const status=(await f.req(f.base+'/documentation-status')).data.data;assert.equal(status.requirements.find(x=>x.id==='sheet').fulfilled,false);
  assert.equal(a.assistant.get('alice',a.job.id).documents[0].state,'approved');
  const source=path.join(f.root,a.attachment.relativePath);await fs.writeFile(source,'Andere Datei am Originalpfad');
  assert.equal((await f.restore(id)).data.error.code,'RESTORE_FILE_CONFLICT');
  await fs.unlink(source);assert.equal((await f.restore(id)).status,200);assert.deepEqual(await fs.readFile(source),a.bytes);assert.equal((await readJson(files.geraetelisten))[0].positionen[0].datenblattId,a.attachment.id);
  assert.deepEqual((await readJson(files.anhaenge))[0].assistantProvenance,a.attachment.assistantProvenance);assert.deepEqual(others(f),before);
 }finally{await f.cleanup();}
});

test('Auftrag löschen/restore erhält übernommene Dateien, Freigabeherkunft, weitere Zuordnung und Originalentscheidungen',async()=>{
 const f=await context();try{
  const a=await approved(f),target={kind:'job',jobId:a.job.id},before=a.assistant.get('alice',a.job.id),files=dataFilesForProject(f.root,'alice','same');
  const project=await readJson(files.projekt);project.assistantWorkflow={jobId:a.job.id,documentScope:'internal',excludeConsumables:true};await writeJson(files.projekt,project);
  const r=await f.remove(target,'job_delete_roundtrip');assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.data.deletionId;
  assert.equal((await f.req(f.base+'/assistant/jobs/'+a.job.id)).status,404);assert.equal((await f.req(f.base+'/assistant/jobs')).data.data.total,0);assert.equal((await readJson(files.projekt)).assistantWorkflow,undefined);
  assert.deepEqual((await readJson(files.anhaenge))[0],a.attachment);
  const link=await f.req(f.base+'/approved-document-links',{method:'POST',headers:{'If-Match':await f.etag()},body:{attachmentId:a.attachment.id,devices:[{listId:'devices',position:2,manufacturer:'Testhersteller',model:'T1'}]}});assert.equal(link.status,200,JSON.stringify(link.data));
  assert.equal((await f.restore(id)).status,200);assert.deepEqual(a.assistant.get('alice',a.job.id),before);assert.equal((await readJson(files.geraetelisten))[0].positionen[1].datenblattId,a.attachment.id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views WHERE proposal_id=?').get(a.proposal.id).n,1);
 }finally{await f.cleanup();}
});

test('Löschschutz: Rechte, fremdes Projekt, veraltete Vorschau, offene Gerätebezüge, Rücknahme und Wiederherstellungskonflikt',async()=>{
 const f=await context();try{
  const target={kind:'device',listId:'devices',position:1},p=await f.preview(target),a=await approved(f);
  const stale=await f.remove(target,'delete_stale_preview',p);assert.equal(stale.status,412);
  const blocked=await f.preview(target);assert.equal(blocked.canDelete,false);assert.equal((await f.remove(target,'delete_blocked')).data.error.code,'DELETE_REFERENCES_EXIST');
  const exportJob=(await f.req(f.base+'/export-jobs',{method:'POST',headers:{'Idempotency-Key':'deletion_export_guard'},body:{assistantJobId:a.job.id}})).data.data;
  const jobPreview=await f.preview({kind:'job',jobId:a.job.id});assert.ok(jobPreview.blockers.some(x=>x.kind==='export'));
  assert.equal((await f.remove({kind:'job',jobId:a.job.id},'delete_export_blocked',jobPreview)).status,409);
  assert.equal((await f.req(f.base+'/export-jobs/'+exportJob.id+'/cancel',{method:'POST',body:{}})).status,200);
  const reader=f.makeToken('alice',{scopes:['projects:read','devices:read','documents:read','assistant:read']}).token;
  assert.equal((await f.req(f.base+'/attachments/'+a.attachment.id,{method:'DELETE',token:reader,headers:{'If-Match':await f.etag(),'Idempotency-Key':'readonly_delete'},body:{...confirmation,previewCheckpoint:blocked.previewCheckpoint}})).status,403);
  const scoped=f.makeToken('alice',{scopes,projectIds:['second']}).token;assert.equal((await f.req(f.base+'/deletions',{token:scoped})).status,404);
  const docTarget={kind:'document',attachmentId:a.attachment.id},dp=await f.preview(docTarget);
  f.db.exec("CREATE TRIGGER delete_failure BEFORE DELETE ON documentation_jobs BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
  const jobTarget={kind:'job',jobId:a.job.id},jp=await f.preview(jobTarget);assert.equal((await f.remove(jobTarget,'delete_sql_failure',jp)).status,500);f.db.exec('DROP TRIGGER delete_failure');assert.equal(a.assistant.get('alice',a.job.id).documents.length,1);
  // Der fehlgeschlagene Auftrag-Reset verändert Dokument-ETag und Vorschau nicht.
  const r=await f.remove(docTarget,'delete_restore_conflict',dp);assert.equal(r.status,200,JSON.stringify(r.data));
  await f.req(f.base+'/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':await f.etag()},body:{beschreibung:'Unabhängig ergänzter Einbauhinweis'}});
  // Unabhängige Felder bleiben erhalten; nur tatsächlich veränderte Löschziele sperren.
  assert.equal((await f.restore(r.data.data.deletionId)).status,200);
  const r2=await f.remove(docTarget,'delete_corrupt_backup');assert.equal(r2.status,200);
  await fs.writeFile(path.join(f.root,'storage/users/alice/item-trash',r2.data.data.deletionId,'0'),'Beschädigt');assert.equal((await f.restore(r2.data.data.deletionId,'restore_corrupt_backup')).data.error.code,'DELETE_BACKUP_INVALID');
 }finally{await f.cleanup();}
});

test('Wiederherstellung sperrt neue Artikelbezüge, Positionskollisionen und alte Resetgenerationen; Fehler rollen Protokoll und Daten gemeinsam zurück',async()=>{
 const f=await context();try{
  const a=await approved(f),target={kind:'document',attachmentId:a.attachment.id},r=await f.remove(target,'doc_new_article'),id=r.data.data.deletionId;
  await f.req(f.base+'/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':await f.etag()},body:{typ:'Anderer Artikel'}});
  assert.equal((await f.restore(id,'restore_wrong_article')).data.error.code,'RESTORE_REFERENCE_CONFLICT');
  await f.req(f.base+'/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':await f.etag()},body:{typ:'T1'}});
  f.db.exec("CREATE TRIGGER restore_failure BEFORE INSERT ON project_item_deletion_events WHEN NEW.action='restored' BEGIN SELECT RAISE(ABORT,'synthetic restore failure'); END");
  assert.equal((await f.restore(id,'restore_atomic_failure')).status,500);assert.deepEqual(await readJson(dataFilesForProject(f.root,'alice','same').anhaenge),[]);assert.equal(f.db.prepare('SELECT state FROM project_item_deletions WHERE id=?').get(id).state,'deleted');
  f.db.exec('DROP TRIGGER restore_failure');assert.equal((await f.restore(id,'restore_atomic_failure')).status,200);
  const token=f.makeToken('bob',{scopes}).token;assert.equal((await f.req(f.base+'/deletions/'+id+'/restore',{method:'POST',token,headers:{'If-Match':await f.etag(),'Idempotency-Key':'other_user_restore'},body:confirmation})).status,404);
  const second=await f.remove({kind:'device',listId:'devices',position:2},'device_restore_collision');assert.equal(second.status,200);
  const files=dataFilesForProject(f.root,'alice','same'),lists=await readJson(files.geraetelisten);lists[0].positionen.push({pos:2,typ:'Neuer anderer Eintrag'});await writeJson(files.geraetelisten,lists);
  assert.equal((await f.restore(second.data.data.deletionId,'restore_position_collision')).data.error.code,'RESTORE_CONFLICT');
  f.db.exec('CREATE TABLE IF NOT EXISTS project_reset_generations(user_id TEXT NOT NULL,project_id TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(user_id,project_id))');f.db.prepare('INSERT INTO project_reset_generations VALUES(?,?,?)').run('alice','same',1);
  assert.equal((await f.restore(second.data.data.deletionId,'restore_after_reset')).data.error.code,'RESTORE_RESET_CONFLICT');
 }finally{await f.cleanup();}
});

test('Alte Anlageschlüssel melden gelöschte Einträge statt Geisterdaten; offene Vorschläge bleiben nach Auftragswiederherstellung offen',async()=>{
 const f=await context();try{
  const body={hersteller:'Neu',typ:'T3'},create=()=>f.req(f.base+'/device-lists/devices/positions',{method:'POST',headers:{'If-Match':'"same:1"','Idempotency-Key':'old_device_create_key'},body});
  // Aktuellen ETag nur für die erste Anlage verwenden; Wiederholungen prüfen den Schlüssel.
  const first=await f.req(f.base+'/device-lists/devices/positions',{method:'POST',headers:{'If-Match':await f.etag(),'Idempotency-Key':'old_device_create_key'},body});assert.equal(first.status,201);
  assert.equal((await f.remove({kind:'device',listId:'devices',position:first.data.data.pos},'delete_created_device')).status,200);assert.equal((await create()).data.error.code,'RESOURCE_DELETED');
  const jobBody={instruction:'Künstlichen Auftrag mit offenem Dateivorschlag löschen und wiederherstellen.'},jobCreate=()=>f.req(f.base+'/assistant/jobs',{method:'POST',headers:{'Idempotency-Key':'old_job_create_key'},body:jobBody});
  const job=(await jobCreate()).data.data,assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),pdf=await PDFDocument.create();pdf.addPage();
  const proposal=await assistant.propose('alice',job.id,{title:'Offener Entwurf',category:'Allgemein',sourceLabel:'Testquelle',reason:'Künstliche Testdatei'},{buffer:Buffer.from(await pdf.save()),originalName:'pending.pdf'});
  const r=await f.remove({kind:'job',jobId:job.id},'delete_created_job');assert.equal(r.status,200);assert.equal((await jobCreate()).data.error.code,'RESOURCE_DELETED');
  assert.equal((await f.restore(r.data.data.deletionId,'restore_pending_job')).status,200);assert.equal(assistant.get('alice',job.id).documents.find(x=>x.id===proposal.id).state,'pending');assert.equal((await jobCreate()).replayed,'true');
 }finally{await f.cleanup();}
});
