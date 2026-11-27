const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {PDFDocument}=require('pdf-lib');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {readJson,writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const {repairOptions}=require('../services/deviceReferenceRepairService');
const {createDocumentWorkService}=require('../services/documentWorkService');
const {loadProjectWorkspace}=require('../services/projectWorkspaceService');
const material=require('../services/materialImportService');
const store=require('../services/projectDataStoreService');
const area='Elektroinstallation / DIN VDE 0100';
const row=(pos,typ='A1',extra={})=>({pos,hersteller:'Testhersteller',typ,...extra});
const list=positions=>({id:'devices',leistungsbereich:area,aktiv:true,positionen:positions});
const ref=(position,extra={})=>({listId:'devices',position,manufacturer:'Testhersteller',model:'A1',...extra});
const evidence={sourceLabel:'Künstlicher Testchat',sourceQuote:'Nicht verwendete Artikel ausnehmen; Fremdgerät gehört nicht zur Anlage; Karten nur im Materialnachweis belassen.'};

async function materialFixture(){
 const f=await fixture(),token=f.makeToken('alice',{scopes}).token,files=dataFilesForProject(f.root,'alice','same');
 const req=(route,opts={})=>f.request(route,{token,...opts});
 const etag=async()=>(await req('/projects/same')).etag;
 const write=async(input,opts={})=>req('/projects/same/material-import',{method:'POST',headers:{'If-Match':await etag()},body:{importId:'source',evidence,...input},...opts});
 await store.withProjectDataTransaction(async()=>{await writeJson(files.geraetelisten,[list([row(1,'Active')])]);await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});});
 for(const input of [{operation:'begin',expectedRows:7},{operation:'stage',rows:Array.from({length:7},(_,n)=>({rowId:'r'+(n+1),text:'Originalzeile '+(n+1),candidate:{hersteller:'Testhersteller',typ:n===4?'Active':'M'+(n+1)}}))},{operation:'finish'},{operation:'resolve',rows:Array.from({length:7},(_,n)=>({rowId:'r'+(n+1),disposition:'clarify',reason:'Verwendung bestätigen'}))}])assert.equal((await write(input)).status,200);
 const assistant=createDocumentAssistantService(f.root),job=assistant.create('alice','same',{instruction:'Künstliche Materialausnahmen ohne echte Projektdaten prüfen.'});
 const jobRoute='/projects/same/assistant/jobs/'+job.id;
 const add=async(id,rows,answer,quote=answer)=>{
  const question={id,prompt:'Welche Verwendung haben diese synthetischen Artikel?',stage:'materials',context:'Künstlicher Grenzfall.',targets:rows.map(rowId=>({kind:'material',importId:'source',rowId,field:'assignment'}))};
  const added=await req(jobRoute+'/questions',{method:'POST',body:{version:assistant.get('alice',job.id).version,question}});assert.equal(added.status,200,JSON.stringify(added.data));
  assistant.recordAnswers('alice',job.id,{version:assistant.get('alice',job.id).version,answers:[{questionId:id,answer,evidence:{...evidence,sourceQuote:quote}}]});
 };
 await add('scope',['r1','r2','r3'],evidence.sourceQuote);
 await add('later',['r4'],'Reiche ich nach');
 await add('active',['r5'],'Wurde nicht verwendet');
 const decision=(questionId='scope')=>({jobId:job.id,jobVersion:assistant.get('alice',job.id).version,questionId});
 return {...f,token,files,req,write,etag,assistant,job,jobRoute,add,decision};
}

test('Materialausnahmen: Originalbeleg, Ziel, Version, Rechte und aktive Geräte schützen atomare Abschlüsse',async()=>{
 const f=await materialFixture();try{
  const rows=[{rowId:'r1',disposition:'not_used',reason:'Bestätigt nicht verwendet'}];
  const before=await readJson(f.files.projekt),revision=await f.etag();
  const deny=async(input,status,code,options)=>{const r=await f.write({operation:'resolve',rows,userDecision:f.decision(),...input},options);assert.equal(r.status,status,JSON.stringify(r.data));if(code)assert.equal(r.data.error.code,code);assert.deepEqual(await readJson(f.files.projekt),before);assert.equal(await f.etag(),revision);};
  await deny({userDecision:undefined},400);
  await deny({evidence:{...evidence,sourceQuote:'Erfundener anderer Beleg'}},409,'MATERIAL_DECISION_EVIDENCE_MISMATCH');
  await deny({userDecision:{...f.decision(),jobVersion:'0'.repeat(64)}},412);
  await deny({rows:[...rows,{rowId:'r7',disposition:'out_of_scope',reason:'Kein Beleg für diese Zeile'}]},409,'MATERIAL_DECISION_TARGET_MISMATCH');
  await deny({rows:[rows[0],rows[0]]},400);
  await deny({rows:[{...rows[0],candidate:{typ:'geändert'}}]},400);
  await deny({userDecision:f.decision('later'),evidence:{...evidence,sourceQuote:'Reiche ich nach'},rows:[{...rows[0],rowId:'r4'}]},409,'MATERIAL_DECISION_DEFERRED');
  await deny({userDecision:f.decision('active'),evidence:{...evidence,sourceQuote:'Wurde nicht verwendet'},rows:[{...rows[0],rowId:'r5'}]},409,'MATERIAL_SCOPE_DEVICE_CONFLICT');
  const limited=f.makeToken('alice',{scopes:['projects:read','projects:write','devices:read']}).token;
  await deny({},403,'FORBIDDEN',{token:limited});
  assert.equal((await f.req('/projects/same/material-import?section=decision&rowId=r1',{token:limited})).status,403);
  const deferred=await f.req(f.jobRoute+'/decisions',{method:'POST',headers:{'If-Match':await f.etag(),'Idempotency-Key':'synthetic_scope_deferred'},body:{jobVersion:f.assistant.get('alice',f.job.id).version,evidence,answers:[{questionId:'scope',answer:evidence.sourceQuote,disposition:'deferred',reason:'Der Benutzer will diesen Punkt noch gesondert prüfen.'}]}});assert.equal(deferred.status,200,JSON.stringify(deferred.data));
  const denied=await f.write({operation:'resolve',rows,userDecision:f.decision()});assert.equal(denied.status,409);assert.equal(denied.data.error.code,'MATERIAL_DECISION_DEFERRED');
  assert.deepEqual((await readJson(f.files.projekt)).assistantMaterialImports,before.assistantMaterialImports);
  const other=f.assistant.create('alice','second',{instruction:'Fremder synthetischer Auftrag zur Rechteprüfung.'});
  assert.equal((await f.write({operation:'resolve',rows,userDecision:{jobId:other.id,jobVersion:other.version,questionId:'scope'}})).status,404);
  assert.equal(material.summary(await loadProjectWorkspace(f.root,'alice','same')).open,7);
 }finally{await f.cleanup()}
});

test('Materialausnahmen per MCP: drei Abschlussarten, kompakter Beleg, Leerlauf, Wiederaufnahme und Historie',async()=>{
 const f=await materialFixture(),client=mcpClient(f.base,f.token,true);try{
  const job=f.assistant.get('alice',f.job.id),work=createDocumentWorkService(f.root);
  const auth={user:{id:'alice'},token:{scopes,projectIds:null}};
  await work.record(auth,'same',job.id,await f.etag(),{jobVersion:job.version,target:{kind:'question',questionId:'scope'},state:'deferred',reason:'Künstlicher alter Wartezustand',resumeCondition:'Bestätigte Verwendung auswerten',evidence:{kind:'user',...evidence}});
  const beforeDevices=await readJson(f.files.geraetelisten),beforeAttachments=await readJson(f.files.anhaenge);
  // A legacy source pointer can now refer to a different product. Archive it,
  // never remove the unrelated current device or its approval.
  const p=await readJson(f.files.projekt);p.assistantMaterialImports.imports[0].rows[0].device={listId:'devices',position:1};await writeJson(f.files.projekt,p);
  await client.initialize();
  const call=async(name,args)=>{const r=(await client.rpc('tools/call',{name,arguments:args})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;};
  const rows=['not_used','out_of_scope','material_only'].map((disposition,n)=>({rowId:'r'+(n+1),disposition,reason:'Gespeicherte Benutzerentscheidung fachlich zugeordnet'}));
  const input={operation:'resolve',importId:'source',evidence,userDecision:f.decision(),rows};
  const result=await call('edoku_record_material_import',{projectId:'same',etag:await f.etag(),input});
  assert.equal(result.data.summary.open,4);for(const state of ['not_used','out_of_scope','material_only'])assert.equal(result.data.summary.counts[state],1);
  assert.ok(result.continuation);assert.ok(Buffer.byteLength(JSON.stringify(result))<7168);
  const after=await readJson(f.files.projekt),registry=after.assistantMaterialImports.imports[0];
  assert.deepEqual(registry.rows[0].scopeDecision.previousDevice,{listId:'devices',position:1});assert.equal(registry.rows[0].device,undefined);assert.equal(registry.rows[0].text,'Originalzeile 1');
  assert.equal(registry.history.at(-1).scopeChanges.length,3);
  const decision=await call('edoku_material_import',{projectId:'same',importId:'source',section:'decision',rowId:'r1'});
  assert.equal(decision.data.active,true);assert.equal(decision.data.decision.evidence.sourceQuote,evidence.sourceQuote);
  assert.ok(Buffer.byteLength(JSON.stringify(decision))<7168);
  const revision=await f.etag(),repeat=await call('edoku_record_material_import',{projectId:'same',etag:revision,input});assert.equal(repeat.data.changed,false);assert.equal(await f.etag(),revision);assert.deepEqual(await readJson(f.files.projekt),after);
  const data=await loadProjectWorkspace(f.root,'alice','same');assert.equal(material.questionRelevant(data,f.assistant.get('alice',job.id).questions.find(q=>q.id==='scope')),false);assert.equal(work.current(data,f.assistant.get('alice',job.id)).length,0);assert.equal(after.assistantWorkHistory.length,1);
  assert.equal((await f.write({operation:'resolve',rows:[{rowId:'r1',disposition:'clarify',reason:'Nicht still überschreiben'}]})).status,409);
  assert.equal((await f.write({...input,rows:[{...rows[0],disposition:'out_of_scope'}]})).status,409);
  assert.equal((await f.write({...input,rows:[{rowId:'r1',disposition:'resume'}]})).status,409);
  await f.add('reopen',['r1'],'Artikel M1 wird nun doch verwendet.');
  const resumed=await f.write({operation:'resolve',userDecision:f.decision('reopen'),evidence:{...evidence,sourceQuote:'Artikel M1 wird nun doch verwendet.'},rows:[{rowId:'r1',disposition:'resume'}]});assert.equal(resumed.status,200,JSON.stringify(resumed.data));assert.equal(resumed.data.data.summary.open,5);
  const final=(await readJson(f.files.projekt)).assistantMaterialImports.imports[0];assert.equal(final.history.at(-1).scopeChanges[0].before.disposition,'not_used');assert.equal(final.history.at(-1).scopeChanges[0].after,null);
  const superseded=await f.write({...input,userDecision:f.decision(),rows:[rows[0]]});assert.equal(superseded.status,409);assert.equal(superseded.data.error.code,'MATERIAL_DECISION_SUPERSEDED');
  assert.deepEqual(await readJson(f.files.geraetelisten),beforeDevices);assert.deepEqual(await readJson(f.files.anhaenge),beforeAttachments);assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
 }finally{await client.close();await f.cleanup()}
});

test('Doppelbezüge: sichere Anker, Mehrfachinstanzen, Varianten, Kollisionsschutz und begrenzte Pakete',()=>{
 const data={leistungsbereiche:{aktiv:[area]},geraetelisten:[list([row(1,'anderer Artikel'),row(7,'A1',{datenblattId:'file'})])]};
 const attachment={id:'file',category:'Datenblätter',mimeType:'application/pdf',deviceReferences:[ref(1),ref(7)]};
 let result=repairOptions(data,attachment);assert.equal(result.repairs.length,1);assert.equal(result.repairs[0].action,'remove_duplicate');assert.equal(result.repairs[0].keepIndex,1);
 attachment.deviceReferences=[ref(7),ref(7)];result=repairOptions(data,attachment);assert.equal(result.repairs[0].fromIndex,1);assert.equal(result.repairs[0].keepIndex,0);
 attachment.deviceReferences=[ref(1),ref(2),ref(7)];result=repairOptions(data,attachment);assert.equal(result.repairs.length,0);assert.ok(result.blocked.every(b=>b.code==='AMBIGUOUS_REFERENCE_MERGE'));
 attachment.deviceReferences=[ref(1),ref(7,{variant:'falsche Variante'})];assert.equal(repairOptions(data,attachment).repairs.length,0);
 attachment.deviceReferences=[ref(1,{variant:'falsche Variante'})];assert.equal(repairOptions(data,attachment).repairs.length,0);
 attachment.deviceReferences=[ref(1),ref(7)];data.geraetelisten[0].positionen[0]=row(1,'A1',{datenblattId:'anderes Original'});result=repairOptions(data,attachment);assert.equal(result.repairs.length,0);assert.equal(result.blocked[0].code,'EXISTING_DEVICE_INSTANCE_CONFLICT');
 data.geraetelisten[0].positionen=[row(7,'A1',{datenblattId:'file'}),row(8,'A1',{datenblattId:'file'})];assert.equal(repairOptions(data,attachment).repairs.length,0);
 data.geraetelisten[0].positionen=[row(7,'A1',{datenblattId:'file'})];data.geraetelisten[0].aktiv=false;assert.equal(repairOptions(data,attachment).repairs.length,0);
 data.geraetelisten[0].aktiv=true;
 attachment.deviceReferences=Array.from({length:6},()=>ref(7));result=repairOptions(data,attachment);assert.equal(result.repairs.length,3);assert.equal(result.remainingRepairs,2);assert.ok(Buffer.byteLength(JSON.stringify(result.repairs))<=5000);
});

test('API/MCP entfernt alte Doppelbezüge mit Originalprüfung und unveränderter Freigabe; gemischte Indizes bleiben stabil',async()=>{
 const f=await fixture(),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);try{
  const files=dataFilesForProject(f.root,'alice','same');
  await store.withProjectDataTransaction(async()=>{await writeJson(files.geraetelisten,[list([row(1),row(2,'A2')])]);await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});});
  const assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),job=assistant.create('alice','same',{instruction:'Künstliche alte Doppelbezüge ohne Bestandsdaten bereinigen.'});
  const pdf=await PDFDocument.create();pdf.addPage();
  const doc=await assistant.propose('alice',job.id,{title:'Künstliches geprüftes Original',category:'Datenblätter',sourceLabel:'Prüfdaten',reason:'Künstlicher Test',deviceReferences:[ref(1),ref(2,{model:'A2'})]},{buffer:Buffer.from(await pdf.save()),originalName:'test.pdf'});
  const metadata=JSON.parse(f.db.prepare('SELECT metadata FROM document_proposals WHERE id=?').get(doc.id).metadata);delete metadata.productVerificationPolicy;f.db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify(metadata),doc.id);
  await assistant.content('alice',job.id,doc.id);assistant.viewed('alice',job.id,doc.id,doc.sha256);
  await assistant.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:doc.category}});
  const originalDecision=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),attachmentId=assistant.get('alice',job.id).documents[0].attachmentId;
  const lists=await readJson(files.geraetelisten);lists[0].positionen[0].pos=7;lists[0].positionen[1].pos=8;await writeJson(files.geraetelisten,lists);
  const attachments=await readJson(files.anhaenge),attachment=attachments.find(a=>a.id===attachmentId);attachment.deviceReferences.push(ref(7));await writeJson(files.anhaenge,attachments);
  const beforeDevices=await readJson(files.geraetelisten),beforeRefs=structuredClone(attachment.deviceReferences);
  const file=await require('../services/attachmentService').resolveAttachmentFile(f.root,files,attachment.relativePath),originalBytes=await fs.readFile(file);
  await client.initialize();
  const call=async args=>{const r=(await client.rpc('tools/call',{name:'edoku_repair_document_references',arguments:{projectId:'same',attachmentId,...args}})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;};
  const preview=await call({mode:'preview'});assert.equal(preview.data.repairs.length,2);assert.deepEqual(new Set(preview.data.repairs.map(r=>r.action)),new Set(['rebind','remove_duplicate']));
  const url='/projects/same/attachments/'+attachmentId+'/device-repair',input={previewToken:preview.data.previewToken,evidence:{sourceLabel:'Künstlicher Test',sourceQuote:'Bestehende Zuordnung und aktueller Anker wurden eindeutig geprüft.'}};
  const bad=await f.request(url,{token,method:'POST',headers:{'If-Match':preview.etag},body:{...input,previewToken:'0'.repeat(64)}});assert.equal(bad.status,412);
  await fs.appendFile(file,'tampered');const changed=await f.request(url,{token,method:'POST',headers:{'If-Match':preview.etag},body:input});assert.equal(changed.status,409);assert.deepEqual((await readJson(files.anhaenge))[0].deviceReferences,beforeRefs);await fs.writeFile(file,originalBytes);
  const result=await call({mode:'apply',etag:preview.etag,input});assert.equal(result.data.duplicatesRemoved,1);assert.equal(result.data.repaired,2);assert.equal(result.data.approvalPreserved,true);
  const after=(await readJson(files.anhaenge)).find(a=>a.id===attachmentId);assert.deepEqual(after.deviceReferences.map(r=>r.position).sort((a,b)=>a-b),[7,8]);
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),originalDecision);assert.deepEqual(await readJson(files.geraetelisten),beforeDevices);assert.deepEqual(await fs.readFile(file),originalBytes);
  const history=(await readJson(files.projekt)).assistantReferenceRepairs;assert.deepEqual(history[0].before,beforeRefs);assert.deepEqual(history[0].after,after.deviceReferences);assert.equal(history[0].actions.length,2);
  assert.equal((await call({mode:'preview'})).data.state,'unchanged');
  const tools=(await client.rpc('tools/list',{})).result.tools;assert.equal(tools.length,58);assert.ok(!tools.some(t=>/approve/i.test(t.name)));
 }finally{await client.close();await f.cleanup()}
});
