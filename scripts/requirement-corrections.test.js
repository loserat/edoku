const test=require('node:test'),assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {writeJson,readJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const store=require('../services/projectDataStoreService');
const reference=position=>({listId:'devices',position,manufacturer:'Hersteller',model:'A-10',revision:'',variant:''});
async function setup(){
 const f=await fixture({setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');
  await writeJson(files.leistungsbereiche,{aktiv:['Beleuchtungsanlage'],optionen:['Beleuchtungsanlage']});
  await writeJson(files.geraetelisten,[{id:'devices',aktiv:true,export:true,leistungsbereich:'Beleuchtungsanlage',positionen:[
   {pos:1,hersteller:'Hersteller',typ:'A-10',beschreibung:'UV 01'},
   {pos:2,hersteller:'Hersteller',typ:'A-10',beschreibung:'UV 02'},
   {pos:3,hersteller:'Hersteller',typ:'A-10',beschreibung:'Gemeinsame Typreferenz, keine zusätzliche dritte Verteilung.'},
   {pos:4,hersteller:'Hersteller',typ:'OTHER',beschreibung:'Anderer Artikel'}]}]);
 }});
 try {
 const token=f.makeToken('alice',{scopes});
 const request=(route,opts={})=>f.request(route,{token:token.token,...opts});
 const job=(await request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Zwei reale Geräte und eine historische reine Typreferenz dokumentieren.',requirements:[{id:'sheet',title:'Herstellerdatenblatt A-10',category:'Nachweise',device:reference(3)}]}})).data.data;
 const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic approved manufacturer original');
 const doc=await service.propose('alice',job.id,{title:'Original A-10',category:'Nachweise',sourceLabel:'Künstlicher Hersteller',reason:'Isolierter Regressionstest',requirementIds:['sheet']},{originalName:'Original.pdf',buffer:Buffer.from(await pdf.save())});
 service.viewed('alice',job.id,doc.id,doc.sha256);
 const attachmentId=await service.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:'Nachweise'}});
 const etag=async()=>(await request('/projects/same')).etag;
 assert.equal((await request('/projects/same/attachments/'+attachmentId,{method:'PATCH',headers:{'If-Match':await etag()},body:{category:'Datenblätter'}})).status,200);
 assert.equal((await request('/projects/same/approved-document-links',{method:'POST',headers:{'If-Match':await etag()},body:{attachmentId,devices:[reference(1),reference(2)].map(({revision,...device})=>device)}})).status,200);
 const current=async()=>(await request('/projects/same/assistant/jobs/'+job.id)).data.data;
 const input=async()=>({version:(await current()).version,category:'Datenblätter',devices:[reference(1),reference(2)],evidence:{sourceLabel:'Künstliche Benutzerkorrektur',sourceQuote:'Die Anforderung soll UV 01 und UV 02 betreffen, keine dritte Verteilung.'}});
 const route='/projects/same/assistant/jobs/'+job.id+'/requirements/sheet';
 const correct=async(body,opts={})=>request(route,{method:'PATCH',headers:{'If-Match':await etag()},body,...opts});
 return {...f,request,token,service,job,doc,attachmentId,etag,current,input,route,correct,files:dataFilesForProject(f.root,'alice','same')};
 } catch(error) {await f.cleanup();throw error}
}
test('Explizite Korrektur verweist auf beide realen Geräte, erhält Original und Freigabe und protokolliert die alte Typreferenz',async()=>{
 const f=await setup();try{
  const old=(await f.current()).requirements[0],lists=await readJson(f.files.geraetelisten),attachments=await readJson(f.files.anhaenge);
  const proposalBefore=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(f.doc.id),viewsBefore=f.db.prepare('SELECT * FROM document_review_views').all();
  const before=(await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data;assert.equal(before.requirements[0].fulfilled,false);
  const result=await f.correct(await f.input());assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.data.id,'sheet');assert.equal(result.data.data.device,undefined);assert.deepEqual(result.data.data.devices,[reference(1),reference(2)]);
  const job=await f.current();assert.equal(job.requirements.length,1);assert.equal(job.documents[0].state,'approved');
  assert.deepEqual(await readJson(f.files.geraetelisten),lists);assert.deepEqual(await readJson(f.files.anhaenge),attachments);
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(f.doc.id),proposalBefore);assert.deepEqual(f.db.prepare('SELECT * FROM document_review_views').all(),viewsBefore);
  const history=(await readJson(f.files.projekt)).assistantRequirementCorrections;assert.equal(history.length,1);assert.deepEqual(history[0].previous,old);assert.deepEqual(history[0].corrected,job.requirements[0]);
  const status=(await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data;assert.equal(status.requirements[0].fulfilled,true);
  const cookies=new Map();const ui=async(route,opts={})=>{const response=await fetch(f.base+route,{redirect:'manual',...opts,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}});for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1))}return response};
  const login=await(await ui('/login')).text(),csrf=login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  assert.equal((await ui('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  const page=await ui('/assistent/auftraege/'+f.job.id+'?ansicht=angaben');assert.equal(page.status,200);assert.match(await page.text(),/2 Geräte · Positionen 1, 2/);
  assert.equal(require('../services/deviceDocumentService').referencesForDocument({category:'Datenblätter',requirementIds:['sheet']},job.requirements).length,2);
  assert.equal(require('../services/requirementScopeService').requirementScope({assistantWorkflow:{jobId:f.job.id,requirementScopes:[{id:'sheet',scope:'internal'}]}},f.job.id,job.requirements[0]),'documentation');
  const linked=await readJson(f.files.geraetelisten);delete linked[0].positionen[1].datenblattId;await writeJson(f.files.geraetelisten,linked);
  assert.equal((await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data.requirements[0].fulfilled,false);
  await writeJson(f.files.geraetelisten,lists);
  await f.request('/projects/same/device-lists/devices/positions/2',{method:'PATCH',headers:{'If-Match':await f.etag()},body:{typ:'Changed'}});
  assert.equal((await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data.requirements[0].fulfilled,false);
 }finally{await f.cleanup()}
});
test('Korrektur schützt Versionen und Rechte und lehnt Typreferenzen, fremde Artikel und verdeckte Änderungen ab',async()=>{
 const f=await setup();try{
  const input=await f.input(),original=JSON.stringify((await f.current()).requirements),revision=await f.etag();
  assert.equal((await f.correct(input,{headers:{}})).status,428);
  assert.equal((await f.correct({...input,version:'0'.repeat(64)})).status,412);
  assert.equal((await f.correct(input,{headers:{'If-Match':'"same:0"'}})).status,412);
  for(const [body,expected]of [[{...input,devices:[reference(3)]},409],[{...input,devices:[reference(1),reference(1)]},400],[{...input,devices:[{...reference(4),model:'OTHER'}]},409],[{...input,category:'Bedienungsanleitungen'},409],[{...input,fulfilled:true},400]])assert.equal((await f.correct(body)).status,expected);
  const limited=f.makeToken('alice',{scopes:['projects:read','assistant:write','devices:read']});assert.equal((await f.correct(input,{token:limited.token})).status,403);
  const foreign=f.makeToken('bob',{scopes});assert.equal((await f.correct(input,{token:foreign.token})).status,404);
  assert.equal((await f.request('/projects/second/assistant/jobs/'+f.job.id+'/requirements/sheet',{method:'PATCH',headers:{'If-Match':revision},body:input})).status,404);
  assert.equal((await f.request('/projects/same/assistant/jobs/'+f.job.id,{method:'PATCH',body:{requirements:[{...(await f.current()).requirements[0],category:'Datenblätter'}]}})).status,409);
  assert.equal(JSON.stringify((await f.current()).requirements),original);assert.equal(await f.etag(),revision);assert.equal((await readJson(f.files.projekt)).assistantRequirementCorrections,undefined);
  await f.request('/projects/same/assistant/jobs/'+f.job.id,{method:'PATCH',body:{message:'Zwischenzeitliche echte Änderung'}});assert.equal((await f.correct(input)).status,412);
 }finally{await f.cleanup()}
});
test('Korrekturhistorie und Anforderung werden bei einem Commitfehler gemeinsam zurückgerollt',async()=>{
 const f=await setup();try{
  const input=await f.input(),before=JSON.stringify((await f.current()).requirements),revision=await f.etag();
  await assert.rejects(store.withProjectDataTransaction(async()=>{await f.service.correctRequirement('alice',f.job.id,'sheet',input);store.onProjectDataCommit(()=>{throw Error('synthetic commit conflict')})}),/synthetic commit conflict/);
  assert.equal(JSON.stringify((await f.current()).requirements),before);assert.equal(await f.etag(),revision);assert.equal((await readJson(f.files.projekt)).assistantRequirementCorrections,undefined);
 }finally{await f.cleanup()}
});
test('Der echte MCP kann die belegte Geräteanforderung korrigieren und besitzt weiterhin keine Dateifreigabe',async()=>{
 const f=await setup(),client=mcpClient(f.base,f.token.token,true);try{
  await client.initialize();const tools=(await client.rpc('tools/list',{})).result.tools;assert.equal(tools.length,58);assert.ok(!tools.some(t=>/approve|freigeben/i.test(t.name)));
  const r=await client.rpc('tools/call',{name:'edoku_correct_requirement_devices',arguments:{projectId:'same',jobId:f.job.id,requirementId:'sheet',etag:await f.etag(),input:await f.input()}});assert.ok(!r.result.isError,JSON.stringify(r));assert.equal(r.result.structuredContent.data.devices.length,2);
 }finally{await client.close();await f.cleanup()}
});
