const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../services/autonomousWorkflowService');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {readJson,writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const question=(id,field)=>({id,prompt:'Bitte '+field+' für dieses Projekt angeben.',required:true,stage:'project',context:'Synthetische tatsächliche Projektangabe.',targets:[{kind:'project',field}]});
test('Ausführungsregel priorisiert unabhängige Aufgaben vor Fragen und bleibt bei offenen Dateien aktiv',()=>{
 const q=question('q1','auftraggeber'),agent=[{id:'ask',code:'ASK_TARGETED_QUESTION',tool:'edoku_ask_question',question:q},{id:'research',code:'RESEARCH_DATASHEET',tool:'edoku_propose_document'}];
 const result=build({agent,user:[{id:'review',code:'REVIEW_FILE',channel:'edoku_gui'}],state:'open',pendingFiles:2});
 assert.equal(agent[0].id,'research');assert.equal(result.action,'continue');assert.equal(result.independentTasks,1);assert.equal(result.questionBatch,null);assert.equal(result.questions,1);assert.equal(result.stopReason,null);
});
test('Rückfragen bündeln sich thematisch mit maximal drei Fragen und ohne doppelte Ziele',()=>{
 const user=['auftraggeber','liegenschaft','baumassnahme','bearbeiter'].map((field,i)=>({id:'t'+i,code:'ANSWER_IN_CHAT',questionId:'q'+i,channel:'agent_chat',stage:'project',title:'Bitte '+field+' angeben.',targets:[{kind:'project',field}]}));
 user.push({...user[0],id:'duplicate'});user.push({id:'file',code:'REVIEW_FILE',channel:'edoku_gui'});
 const r=build({agent:[],user,state:'open',pendingFiles:1});assert.equal(r.action,'ask_batch');assert.equal(r.questions,4);assert.equal(r.questionBatch.topic,'Projektangaben');assert.equal(r.questionBatch.items.length,3);assert.equal(r.questionBatch.remaining,1);assert.ok(r.questionBatch.items.every(q=>q.registered));assert.ok(Buffer.byteLength(JSON.stringify(r.questionBatch))<2600);
});
test('Zentrale Priorität nutzt gespeicherte Antworten und vorhandene Originale vor neuer Recherche',()=>{
 const agent=['RESEARCH_DATASHEET','LINK_EXISTING_DATASHEET','APPLY_CONFIRMED_FACT','CREATE_JOB'].map((code,n)=>({id:String(n),code}));
 build({agent,user:[],state:'open'});assert.deepEqual(agent.map(t=>t.code),['CREATE_JOB','APPLY_CONFIRMED_FACT','LINK_EXISTING_DATASHEET','RESEARCH_DATASHEET']);
});
test('Dateiprüfung und externe Wartezustände erzeugen keine künstliche Agentenarbeit; abgeschlossene Aufträge bleiben abgeschlossen',()=>{
 assert.equal(build({agent:[],user:[],state:'open',pendingFiles:2}).stopReason,'manual_file_review');
 assert.equal(build({agent:[],user:[],state:'open'}).stopReason,'external_sources');
 assert.equal(build({agent:[],user:[],state:'closed'}).action,'complete');
 const q={id:'large',code:'ASK_TARGETED_QUESTION',tool:'edoku_ask_question',question:{...question('large','auftraggeber'),context:'X'.repeat(3000)}};
 const r=build({agent:[q],user:[],state:'open'});assert.equal(r.questionBatch.items[0].needsDetail,true);
});
async function setup(){
 const f=await fixture({setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same'),p=await readJson(files.projekt);
  Object.assign(p,{projektname:'Synthetisch',projektnummer:'A-1',auftraggeber:'Kunde',liegenschaft:'Halle',baumassnahme:'Installation'});await writeJson(files.projekt,p);
  const area='Elektroinstallation / DIN VDE 0100';await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area]});
  await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,titel:'Testgerät',aktiv:true,export:true,positionen:[{pos:1,hersteller:'Testhersteller',typ:'DEVICE-100',system:'Installation',beschreibung:'Technisches Gerät',abmessung:'100 mm'}]}]);await writeJson(files.dokumentenmatrix,[]);
 }});
 const token=f.makeToken('alice',{scopes}).token,request=(url,options={})=>f.request(url,{token,...options});
 const job=(await request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Synthetischer Ablauf: selbstständig recherchieren und notwendige Rückfragen bündeln.'}})).data.data;
 return {...f,serverBase:f.base,token,request,job,base:'/projects/same/assistant/jobs/'+job.id};
}
test('Echte API: Fragepaket atomar, dedupliziert und versionsgeschützt; Einzelaufruf bleibt kompatibel',async()=>{
 const f=await setup();try{
  const version=async()=>(await f.request(f.base)).data.data.version;
  const old=await version(),qs=[question('customer','auftraggeber'),question('site','liegenschaft')];
  let r=await f.request(f.base+'/questions',{method:'POST',body:{version:old,questions:qs}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.data.createdCount,2);assert.equal(r.data.data.questions.length,2);
  assert.equal((await f.request(f.base+'/questions',{method:'POST',body:{version:old,questions:qs}})).status,412);
  r=await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),questions:qs}});assert.equal(r.data.data.createdCount,0);
  r=await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),question:qs[0]}});assert.equal(r.data.data.created,false);assert.equal(r.data.data.question.id,'customer');
  const before=JSON.stringify((await f.request(f.base)).data.data);
  const invalid={...question('invalid','bearbeiter'),targets:[{kind:'device',listId:'foreign',position:1,field:'hersteller'}]};
  r=await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),questions:[question('good','bearbeiter'),invalid]}});assert.notEqual(r.status,200);assert.equal(JSON.stringify((await f.request(f.base)).data.data),before);
  r=await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),questions:[question('collision','bearbeiter'),question('collision','ortDerAusfuehrung')]}});assert.equal(r.status,409);assert.equal(JSON.stringify((await f.request(f.base)).data.data),before);
  assert.equal((await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),question:qs[0],questions:qs}})).status,400);
  assert.equal((await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),questions:[...qs,...qs]}})).status,400);
  const large=qs.map(q=>({...q,prompt:'X'.repeat(1000),context:'Y'.repeat(500),targets:Array.from({length:20},()=>q.targets[0])}));
  assert.equal((await f.request(f.base+'/questions',{method:'POST',body:{version:await version(),questions:large}})).status,400);
 }finally{await f.cleanup();}
});
test('Echter MCP-Ablauf arbeitet trotz Rückfragen/Dateivorschlag weiter und lässt Bestand/Freigaben unverändert',async()=>{
 const f=await setup(),client=mcpClient(f.serverBase,f.token,true);try{
  await client.initialize();const call=async(name,args)=>{const r=(await client.rpc('tools/call',{name,arguments:args})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent.data;};
  const jobsBefore=f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n;
  const registered=await call('edoku_ask_question',{projectId:'same',jobId:f.job.id,input:{version:f.job.version,questions:[question('one','auftraggeber'),question('two','liegenschaft')]}});assert.equal(registered.createdCount,2);
  const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage().drawText('SYNTHETIC INTERNAL FILE');
  const assistant=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  await assistant.propose('alice',f.job.id,{title:'Künstlicher Vorschlag',category:'Nachweise',sourceLabel:'Testquelle',reason:'Nur künstliche Dateifreigabesperre prüfen.'},{buffer:Buffer.from(await pdf.save()),originalName:'test.pdf'});
  const rawBefore=JSON.stringify(assistant.get('alice',f.job.id)),plan=await call('edoku_next_action',{projectId:'same',jobId:f.job.id,limit:1});
  assert.equal(plan.execution.action,'continue');assert.ok(plan.execution.independentTasks>0);assert.equal(plan.execution.pendingFiles,1);assert.equal(plan.policy.fileApproval,'manual_gui_per_file');assert.ok(!['ASK_TARGETED_QUESTION','ANSWER_IN_CHAT','REVIEW_FILE'].includes(plan.nextAction.code));assert.ok(Buffer.byteLength(JSON.stringify(plan))<7168);
  const unchanged=await call('edoku_next_action',{projectId:'same',jobId:f.job.id,limit:1,sinceCheckpoint:plan.checkpoint});assert.equal(unchanged.changed,false);assert.equal(unchanged.execution.onUnchanged,'do_not_repeat_without_new_evidence');
  assert.equal(JSON.stringify(assistant.get('alice',f.job.id)),rawBefore);assert.equal(f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n,jobsBefore);assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
 }finally{await client.close();await f.cleanup();}
});
test('Materialimport: vollständige Quellerfassung und fertige Zuordnung sind getrennt; reale Bezüge und Ausschlüsse prüfen',async()=>{
 const f=await setup();try{
  const evidence={sourceLabel:'Synthetische Materialliste',sourceQuote:'DEVICE-100, Schrauben, unbekanntes Gerät – drei bestätigte Testzeilen.'};
  const write=async input=>f.request('/projects/same/material-import',{method:'POST',headers:{'If-Match':(await f.request('/projects/same')).etag},body:{importId:'source_a',evidence,...input}});
  const files=dataFilesForProject(f.root,'alice','same'),before=await readJson(files.geraetelisten);
  assert.equal((await write({operation:'begin',expectedRows:3})).status,200);
  assert.equal((await write({operation:'stage',rows:[{rowId:'a',text:'DEVICE-100',candidate:{hersteller:'Testhersteller',typ:'DEVICE-100'}}]})).status,200);
  assert.equal((await write({operation:'finish'})).status,409);
  assert.equal((await write({operation:'stage',rows:[{rowId:'b',text:'Schrauben',candidate:{typ:'Schraube'}},{rowId:'c',text:'Unbekanntes Gerät'}]})).status,200);
  const bad=await write({operation:'resolve',rows:[{rowId:'a',disposition:'existing',device:{listId:'devices',position:99}}]});assert.equal(bad.status,409);
  assert.equal((await write({operation:'resolve',rows:[{rowId:'a',disposition:'existing',device:{listId:'devices',position:1}},{rowId:'c',disposition:'clarify',reason:'Welche konkrete Artikelnummer gehört zur dritten Zeile?'}]})).status,200);
  let r=await write({operation:'finish'});assert.equal(r.status,200);assert.equal(r.data.data.summary.recording,'complete');assert.equal(r.data.data.summary.assignmentComplete,false);assert.equal(r.data.data.summary.open,1);assert.equal(r.data.data.summary.counts.excluded,1);
  const plan=(await f.request('/projects/same/next-action?jobId='+f.job.id+'&view=compact')).data.data;assert.equal(plan.material.open,1);assert.equal(plan.execution.action,'continue');assert.notEqual(plan.nextAction.code,'ASK_TARGETED_QUESTION');
  const q={id:'material_question',prompt:'Welche Artikelnummer gehört zum unbekannten Gerät?',stage:'materials',context:'Dritte Zeile der synthetischen Quelle.',targets:[{kind:'material',importId:'source_a',rowId:'c',field:'assignment'}]};
  assert.equal((await f.request(f.base+'/questions',{method:'POST',body:{version:plan.jobVersion,question:q}})).status,200);
  r=await write({operation:'resolve',rows:[{rowId:'c',disposition:'existing',candidate:{hersteller:'Testhersteller',typ:'DEVICE-100'},device:{listId:'devices',position:1}}]});assert.equal(r.status,200);assert.equal(r.data.data.summary.assignmentComplete,true);
  const status=(await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data;assert.ok(!status.issues.some(x=>x.code==='ANSWER_REQUIRED'&&x.questionId===q.id));
  const job=(await f.request(f.base)).data.data;assert.equal(job.questions.find(x=>x.id===q.id).answer,'');
  assert.deepEqual(await readJson(files.geraetelisten),before);assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
  r=await f.request('/projects/same/material-import?status=all&limit=1');assert.equal(r.data.data.total,3);assert.equal(r.data.data.items.length,1);assert.equal(r.data.data.hasMore,true);
  assert.equal((await write({operation:'stage',rows:[{rowId:'d',text:'Nachträgliche Quelle'}]})).status,409);
  const next=await f.request('/projects/same/material-import',{method:'POST',headers:{'If-Match':(await f.request('/projects/same')).etag},body:{operation:'begin',importId:'source_b',expectedRows:1,evidence}});assert.equal(next.status,200);
  const old=(await f.request('/projects/same/material-import?importId=source_a&status=all')).data.data;assert.equal(old.summary.importId,'source_a');assert.equal(old.summary.assignmentComplete,true);assert.equal(old.total,3);
 }finally{await f.cleanup();}
});
test('Materialimport ist atomar und projektgebunden; reale Geräte werden nicht durch Importbehauptung ersetzt',async()=>{
 const f=await setup();try{
  const evidence={sourceLabel:'Test',sourceQuote:'Eindeutige synthetische Quellzeilen.'},base='/projects/same/material-import';
  const etag=(await f.request('/projects/same')).etag;
  assert.equal((await f.request(base,{method:'POST',headers:{'If-Match':etag},body:{importId:'one',operation:'begin',expectedRows:2,evidence}})).status,200);
  assert.equal((await f.request(base,{method:'POST',headers:{'If-Match':etag},body:{importId:'one',operation:'stage',rows:[{rowId:'a',text:'Test'}],evidence}})).status,412);
  const write=async extra=>f.request(base,{method:'POST',headers:{'If-Match':(await f.request('/projects/same')).etag},body:{importId:'one',evidence,...extra}});
  await write({operation:'stage',rows:[{rowId:'a',text:'Original'}]});
  const repeatRevision=(await f.request('/projects/same')).etag;
  const repeat=await write({operation:'stage',rows:[{rowId:'a',text:'Original'}]});assert.equal(repeat.data.data.changed,false);assert.equal((await f.request('/projects/same')).etag,repeatRevision);
  const before=(await f.request(base+'?status=all')).data.data;
  assert.equal((await write({operation:'stage',rows:[{rowId:'b',text:'Neue Zeile'},{rowId:'a',text:'Verändertes Original'}]})).status,409);
  assert.deepEqual((await f.request(base+'?status=all')).data.data,before);
  assert.equal((await write({operation:'resolve',rows:[{rowId:'a',disposition:'excluded'}]})).status,409);
  const reader=f.makeToken('alice',{scopes:['projects:read','devices:read']}).token;
  assert.equal((await f.request(base,{token:reader,method:'POST',headers:{'If-Match':(await f.request('/projects/same')).etag},body:{importId:'x',operation:'begin',expectedRows:1,evidence}})).status,403);
  const other=f.makeToken('bob',{scopes}).token;assert.equal((await f.request(base,{token:other})).status,200);assert.equal((await f.request(base,{token:other})).data.data.summary.source,'legacy_inventory');
 }finally{await f.cleanup();}
});
test('Neue Materialwerkzeuge führen die zentrale Reihenfolge über echtes MCP mit kompakten Antworten aus',async()=>{
 const f=await setup(),client=mcpClient(f.serverBase,f.token,true);try{
  await client.initialize();const call=async(name,args)=>{const r=(await client.rpc('tools/call',{name,arguments:args})).result;assert.ok(!r.isError,JSON.stringify(r));assert.ok(Buffer.byteLength(JSON.stringify(r))<8192);return r.structuredContent.data;};
  await call('edoku_next_action',{projectId:'same',jobId:f.job.id});
  const evidence={sourceLabel:'Synthetischer Chat',sourceQuote:'DEVICE-100 und Schrauben, zwei Materialzeilen.'};
  const record=async extra=>call('edoku_record_material_import',{projectId:'same',etag:(await f.request('/projects/same')).etag,input:{importId:'mcp_source',evidence,...extra}});
  await record({operation:'begin',expectedRows:2});
  await record({operation:'stage',rows:[{rowId:'device',text:'Testhersteller DEVICE-100',candidate:{hersteller:'Testhersteller',typ:'DEVICE-100'}},{rowId:'screws',text:'Schrauben'}]});
  const page=await call('edoku_material_import',{projectId:'same',limit:1});assert.equal(page.items[0].existingCandidates[0].position,1);
  await record({operation:'resolve',rows:[{rowId:'device',disposition:'existing',device:{listId:'devices',position:1}}]});
  const finished=await record({operation:'finish'});assert.equal(finished.summary.assignmentComplete,true);assert.equal(finished.summary.counts.excluded,1);
  const plan=await call('edoku_next_action',{projectId:'same',jobId:f.job.id});assert.equal(plan.material.assignmentComplete,true);assert.equal(plan.execution.action,'continue');assert.ok(!plan.nextAction.code.includes('MATERIAL'));
  const contract=require('../src/api/openapi').paths['/projects/{projectId}/material-import'];assert.ok(contract.post.parameters.some(p=>p.name==='If-Match'&&p.required));assert.ok(contract.get.parameters.some(p=>p.name==='rowId'&&p.in==='query'));
 }finally{await client.close();await f.cleanup();}
});
