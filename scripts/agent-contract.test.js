const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const {bounded}=require('../services/agentContractService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {readJson}=require('../services/jsonService');

test('Agentenvertrag: kompakte Defaults, begrenzte Details und unveränderte Checkpoints',async()=>{
 const f=await fixture(),key=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,key,true);
 try {
  const api='/projects/same',job=(await f.request(api+'/assistant/jobs',{token:key,method:'POST',body:{instruction:'Künstlichen Auftrag für den begrenzten Agentenvertrag anlegen.'}})).data.data;
  const raw=async route=>{const r=await fetch(f.base+'/api/v1'+route,{headers:{Authorization:'Bearer '+key}});return {status:r.status,body:await r.json()}};
  const compact=await raw(api+'/assistant/jobs/'+job.id);assert.equal(compact.status,200);assert.equal(compact.body.data.documents,undefined);assert.equal(compact.body.data.questions,undefined);assert.ok(compact.body.data.version);
  const first=await raw(api+'/next-action?jobId='+job.id);assert.equal(first.body.data.view,'compact');assert.equal(first.body.data.structure,undefined);
  const same=await raw(api+'/next-action?jobId='+job.id+'&sinceCheckpoint='+first.body.data.checkpoint);assert.equal(same.body.data.changed,false);assert.equal(same.body.data.nextAction,undefined);
  const changedPage=await raw(api+'/next-action?jobId='+job.id+'&limit=2&sinceCheckpoint='+first.body.data.checkpoint);assert.notEqual(changedPage.body.data.changed,false);
  assert.equal((await raw(api+'/next-action?limit=100')).status,400);
  assert.equal((await raw(api+'/assistant/jobs/'+job.id+'?limit=100')).status,400);
  f.db.prepare('UPDATE documentation_jobs SET instruction=? WHERE id=?').run('L'.repeat(40000),job.id);
  assert.equal((await raw(api+'/assistant/jobs/'+job.id)).status,200);
  const oversized=await raw(api+'/assistant/jobs/'+job.id+'?view=full');assert.equal(oversized.status,413);assert.equal(oversized.body.error.code,'RESPONSE_LIMIT');
  assert.throws(()=>bounded({text:'ü'.repeat(20000)}),/Antwort zu groß/);
  await client.initialize();let page=await client.rawRpc('tools/list',{}),pages=0;const catalog=[];while(page.result){assert.ok(Buffer.byteLength(JSON.stringify(page))<8192);catalog.push(...page.result.tools);pages++;if(!page.result.nextCursor)break;page=await client.rawRpc('tools/list',{cursor:page.result.nextCursor});}assert.ok(pages>1);assert.equal(new Set(catalog.map(x=>x.name)).size,catalog.length);assert.equal((await client.rawRpc('tools/list',{cursor:'bad'})).error!==undefined,true);
  assert.ok(!catalog.some(t=>/approve|freigeben/i.test(t.name)));assert.ok(catalog.every(t=>t.description.length<1000));
  const result=(await client.rpc('tools/call',{name:'edoku_get_documentation_job',arguments:{projectId:'same',jobId:job.id}})).result;
  assert.equal(result.structuredContent.data.questions,undefined);assert.ok(result.content[0].text.length<600);assert.ok(!result.content[0].text.includes('L'.repeat(100)));
  const defaults=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:job.id}})).result;assert.equal(defaults.structuredContent.data.view,'compact');
  const textClient=mcpClient(f.base,key,false,'','text');try{await textClient.initialize();const reply=(await textClient.rpc('tools/call',{name:'edoku_get_documentation_job',arguments:{projectId:'same',jobId:job.id}})).result;assert.equal(reply.structuredContent,undefined);assert.equal(JSON.parse(reply.content[0].text).data.id,job.id);}finally{await textClient.close()}
 }finally{await client.close();await f.cleanup()}
});

test('Fortschrittsänderung per MCP bleibt bei großem Auftrag kompakt und erhält die übrigen Daten',async()=>{
 const f=await fixture(),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);
 try{
  const req=(route,options={})=>f.request(route,{token,...options});
  const job=(await req('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Künstlicher großer Auftrag für kompakte Fortschrittsantwort.'}})).data.data;
  f.db.prepare('UPDATE documentation_jobs SET instruction=? WHERE id=?').run('K'.repeat(18000),job.id);
  await client.initialize();
  const r=(await client.rpc('tools/call',{name:'edoku_update_documentation_job',arguments:{projectId:'same',jobId:job.id,update:{message:'Nur neuer Fortschritt, keine Dateientscheidung.'}}})).result;
  assert.equal(r.isError,undefined,JSON.stringify(r));assert.equal(r.structuredContent.data.id,job.id);assert.ok(JSON.stringify(r).length<2000);
  assert.equal(f.db.prepare('SELECT instruction,message FROM documentation_jobs WHERE id=?').get(job.id).instruction,'K'.repeat(18000));
  const invalid=await req('/projects/same/assistant/jobs/'+job.id+'?view=invalid',{method:'PATCH',body:{message:'Darf nicht gespeichert werden.'}});
  assert.equal(invalid.status,400);assert.equal(f.db.prepare('SELECT message FROM documentation_jobs WHERE id=?').get(job.id).message,'Nur neuer Fortschritt, keine Dateientscheidung.');
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
 }finally{await client.close();await f.cleanup();}
});

test('Chatentscheidungen: Antworten und Wartezustände atomar, dauerhaft, zielbezogen und wiederholungssicher',async()=>{
 const f=await fixture(),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);
 try {
  const req=(route,options={})=>f.request(route,{token,...options}),root='/projects/same';
  const job=(await req(root+'/assistant/jobs',{method:'POST',body:{instruction:'Künstliche nachzureichende Originalunterlagen ohne automatische Freigabe testen.',requirements:[{id:'plans',title:'Tatsächlicher Bestandsplan',category:'Stromlaufpläne'},{id:'other',title:'Andere weiterhin offene Unterlage',category:'Messprotokolle'}]}})).data.data;
  const route=root+'/assistant/jobs/'+job.id;
  const questionAdded=await req(route+'/questions',{method:'POST',body:{version:job.version,question:{id:'delivery',prompt:'Wann kommt der Bestandsplan?',required:true,stage:'evidence',context:'Echte Unterlage nachreichen.',targets:[{kind:'requirement',requirementId:'plans'}]}}});assert.equal(questionAdded.status,200,JSON.stringify(questionAdded.data));
  const service=createDocumentAssistantService(f.root,{verificationService:f.productVerification}),files=dataFilesForProject(f.root,'alice','same');
  const version=()=>service.get('alice',job.id).version,etag=async()=>(await req(root)).etag;
  const body={jobVersion:version(),evidence:{sourceLabel:'Künstlicher Testchat',sourceQuote:'Den Plan reiche ich nach, bitte bis dahin warten.'},answers:[{questionId:'delivery',answer:'Der Benutzer reicht den Plan nach.',disposition:'confirmed'}],decisions:[{target:{kind:'requirement',requirementId:'plans'},state:'awaiting_user',reason:'Der Benutzer hat die Nachreichung des echten Bestandsplans zugesagt.',resumeCondition:'Wenn der echte Bestandsplan vorliegt.'}]};
  const key='chat_decision_same_001',headers={'If-Match':await etag(),'Idempotency-Key':key};
  const saved=await req(route+'/decisions',{method:'POST',headers,body});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.data.receipt.savedAnswers,1);assert.equal(saved.data.data.receipt.savedDecisions,2);assert.equal(saved.data.data.plan.nextAction.target.requirementId,'other');
  assert.equal(service.get('alice',job.id).questions[0].answer,body.answers[0].answer);
  const work=(await req(route+'/document-work')).data.data;assert.equal(work.total,2);assert.equal(work.items[0].state,'awaiting_user');
  assert.equal((await req(route+'/decisions',{method:'POST',headers,body})).status,200);assert.equal((await readJson(files.projekt,{})).assistantDecisionHistory.length,1);
  const before=await readJson(files.projekt,{}),beforeJob=service.get('alice',job.id);
  const oversized={...body,jobVersion:version(),answers:Array.from({length:10},()=>({questionId:'delivery',answer:'x'.repeat(2000),disposition:'confirmed'})),decisions:[]};assert.equal((await req(route+'/decisions',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_input_too_large'},body:oversized})).status,413);
  const invalid={...body,jobVersion:version(),answers:[],decisions:[{target:{kind:'requirement',requirementId:'other'},state:'awaiting_user',reason:'Zweite Unterlage soll im künstlichen Test nachgereicht werden.'},{target:{kind:'requirement',requirementId:'unknown'},state:'awaiting_user',reason:'Dieses Ziel existiert im künstlichen Test absichtlich nicht.'}]};
  assert.equal((await req(route+'/decisions',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_decision_invalid'},body:invalid})).status,409);
  assert.deepEqual(await readJson(files.projekt,{}),before);assert.deepEqual(service.get('alice',job.id),beforeJob);
  const stale={...body,evidence:{...body.evidence,sourceQuote:'Ein neuer Testbeleg.'}};assert.equal((await req(route+'/decisions',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_decision_stale'},body:stale})).status,412);
  assert.equal((await f.request(route+'/decisions',{token:f.makeToken('bob',{scopes}).token,method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_decision_foreign'},body})).status,404);
  f.db.exec("CREATE TRIGGER fail_capture BEFORE UPDATE OF questions ON documentation_jobs BEGIN SELECT RAISE(ABORT,'synthetic capture failure'); END");
  try {const fail={...body,jobVersion:version(),answers:[{questionId:'delivery',answer:'Neue künstliche Antwort.',disposition:'confirmed'}],decisions:[]};assert.equal((await req(route+'/decisions',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_decision_atomic'},body:fail})).status,500);assert.deepEqual(await readJson(files.projekt,{}),before);assert.deepEqual(service.get('alice',job.id),beforeJob);}finally{f.db.exec('DROP TRIGGER fail_capture')}
  await client.initialize();const input={jobVersion:version(),evidence:{sourceLabel:'Neuer künstlicher Chatbeleg',sourceQuote:'Der Plan ist jetzt vorhanden; bitte weiterarbeiten.'},decisions:[{target:{kind:'requirement',requirementId:'plans'},state:'resume',reason:'Neue bestätigte Unterlage ermöglicht die weitere Bearbeitung.'}]};
  const result=(await client.rpc('tools/call',{name:'edoku_record_chat_decision',arguments:{projectId:'same',jobId:job.id,etag:await etag(),requestId:'chat_decision_resume',input}})).result;assert.ok(!result.isError,JSON.stringify(result));assert.equal(result.structuredContent.data.receipt.savedDecisions,1);
  await f.restart();const after=(await req(route+'/document-work?history=true')).data.data;assert.deepEqual(after.items.map(x=>x.state),['awaiting_user','resume','resume']);
  assert.equal((await readJson(files.projekt,{})).assistantDecisionHistory.length,2);
  const automatic={jobVersion:version(),evidence:{sourceLabel:'Künstlicher Chat',sourceQuote:'Der Plan ist doch noch nicht da, bitte zurückstellen.'},answers:[{questionId:'delivery',answer:'Originalplan ist noch nicht vorhanden.',disposition:'deferred',reason:'Benutzer benötigt mehr Zeit für den tatsächlichen Bestandsplan.'}]};
  const auto=await req(route+'/decisions',{method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_auto_defer'},body:automatic});assert.equal(auto.status,200,JSON.stringify(auto.data));assert.equal(auto.data.data.receipt.savedDecisions,1);assert.equal(auto.data.data.plan.nextAction.target.requirementId,'other');
  const records=(await req(route+'/decisions')).data.data;assert.equal(records.total,3);assert.equal(records.items[2].evidence.sourceQuote,automatic.evidence.sourceQuote);
  const reader=f.makeToken('alice',{scopes:['assistant:read','assistant:write']}).token;assert.equal((await f.request(route+'/decisions',{token:reader,method:'POST',headers:{'If-Match':await etag(),'Idempotency-Key':'chat_no_rights'},body:automatic})).status,403);
  assert.equal(service.get('alice',job.id).documents.length,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM document_review_views').get().n,0);
 }finally{await client.close();await f.cleanup()}
});

test('MCP-Transport stoppt große Standardantworten; explizite Vollansicht bleibt begrenzt verfügbar',async()=>{
 const http=require('node:http');
 const f=await fixture(),token=f.makeToken('alice',{scopes}).token;
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,data:{id:'same',projekt:{text:'x'.repeat(12000)},status:'active',revision:'same:1'},requestId:'00000000-0000-4000-8000-000000000001'}))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const client=mcpClient('http://127.0.0.1:'+server.address().port,token);
 try {
  await client.initialize();const call=async args=>(await client.rpc('tools/call',{name:'edoku_get_project',arguments:{projectId:'same',...args}})).result;
  const compact=await call({});assert.equal(compact.isError,true);const error=JSON.parse(compact.content[0].text);assert.equal(error.code,'RESPONSE_LIMIT');assert.equal(error.maxBytes,8192);assert.equal(error.writeOutcome,'not_applicable');
  const full=await call({view:'full'});assert.ok(!full.isError);assert.equal(full.structuredContent.data.projekt.text.length,12000);assert.ok(full.content[0].text.length<600);
 }finally{await client.close();await new Promise(resolve=>server.close(resolve));await f.cleanup()}
});
