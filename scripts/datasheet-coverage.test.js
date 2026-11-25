const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { writeJson, readJson } = require('../services/jsonService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const { createDocumentAssistantService } = require('../services/documentAssistantService');
const store = require('../services/projectDataStoreService');
const area = 'Beleuchtungsanlage';
async function setup() {
  const f = await fixture({ setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await writeJson(files.leistungsbereiche, { aktiv:[area], optionen:[area] });
    await writeJson(files.geraetelisten, [{ id:'devices', titel:'Bestand', leistungsbereich:area, aktiv:true, export:true, positionen:[
      {pos:1,hersteller:'Hersteller',typ:'A-10',beschreibung:'Reales Beispielgerät',custom:'behalten'},
      {pos:2,hersteller:'Hersteller',typ:'A-10',beschreibung:'Zweite Instanz'},
      {pos:3,hersteller:'Hersteller',typ:'PASSIV-20',beschreibung:'Technisches Systemzubehör'},
      {pos:4,hersteller:'WAGO',typ:'221-413',beschreibung:'Verbindungsklemme'},
      {pos:5,hersteller:'Alt',typ:'ALT',beschreibung:'Beispieldatensatz'},
      {pos:6,hersteller:'',typ:'Unbekannt'},
      {pos:7,hersteller:'',typ:''}
    ] },{id:'old',leistungsbereich:'Telekommunikation',aktiv:false,positionen:[{pos:1,hersteller:'Alt',typ:'INAKTIV'}]}]);
  } });
  const token = f.makeToken('alice',{scopes});
  const request = (url,opts={}) => f.request(url,{token:token.token,...opts});
  const get = async (filter='') => {const response=await request('/projects/same/datasheet-coverage'+filter);assert.equal(response.status,200,JSON.stringify(response.data));return response;};
  return {...f,request,get,token};
}
async function propose(f, references, title='Originaldatenblatt') {
  const api='/projects/same/assistant/jobs';
  const job=(await f.request(api,{method:'POST',body:{instruction:'Datenblätter für den gesamten bestätigten Bestand recherchieren.'}})).data.data;
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const pdf=await PDFDocument.create();pdf.addPage().drawText(title);
  const doc=await service.propose('alice',job.id,{title,category:'Datenblätter',sourceLabel:'Künstlicher Hersteller',reason:'Künstliche Quelle zur Prüfung',deviceReferences:references},{originalName:'Datenblatt.pdf',buffer:Buffer.from(await pdf.save())});
  return {job,service,doc,approve:()=>{service.viewed('alice',job.id,doc.id,doc.sha256);return service.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:'Datenblätter'}});}};
}
test('Technische Prüfsperre bleibt von Nichtfund/Freigabe getrennt und bleibt bei unpassender neuer Prüfrichtlinie erhalten',async()=>{
 const f=await setup();try{
  const initial=(await f.get()).data.data,item=initial.items.find(x=>x.model==='A-10');
  const record={articleId:item.id,outcome:'blocked',reason:'Originalquelle gefunden, Artikelprüfung technisch noch unklar.',sources:['https://manufacturer.example/ART-100.pdf'],evidence:{sourceLabel:'Künstlicher Prüfbeleg',sourceQuote:'variant_not_confirmed'}};
  const saved=await f.request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':(await f.request('/projects/same')).etag},body:record});
  assert.equal(saved.status,200,JSON.stringify(saved.data));
  const c=(await f.get('?status=blocked')).data.data;assert.equal(c.items.length,1);assert.equal(c.summary.blocked,1);assert.equal(c.summary.notFound,0);assert.equal(c.summary.complete,false);
  const files=dataFilesForProject(f.root,'alice','same'),project=await readJson(files.projekt);project.datenblattRecherche.at(-1).verificationPolicy='old-policy';await writeJson(files.projekt,project);
  assert.equal((await f.get()).data.data.items.find(x=>x.id===item.id).status,'blocked');
  assert.deepEqual(await readJson(files.anhaenge),[]);
 }finally{await f.cleanup();}
});
test('Datenblattabdeckung erfasst alle aktiven Artikel ohne Anforderungen, bündelt Instanzen und schützt Benutzergrenzen',async()=>{
  const f=await setup();
  try {
    const revision=(await f.request('/projects/same')).etag;
    const result=await f.get(),c=result.data.data;
    assert.equal(c.summary.articles,3);assert.equal(c.summary.positions,4);assert.equal(c.summary.research,2);assert.equal(c.summary.needsIdentity,1);
    assert.equal(c.items.find(item=>item.model==='A-10').references.length,2);
    assert.ok(c.items.some(item=>item.model==='PASSIV-20'));assert.ok(c.exclusions.some(item=>item.reason==='consumable'));
    assert.equal(c.summary.complete,false);assert.equal((await f.request('/projects/same')).etag,revision);
    const first=await f.get('?limit=1&offset=0');assert.equal(first.data.data.items.length,1);assert.equal(first.data.data.total,3);
    assert.equal((await f.get('?status=needs_identity')).data.data.total,1);
    const bob=f.makeToken('bob',{scopes});const foreign=await f.request('/projects/same/datasheet-coverage',{token:bob.token});
    assert.equal(foreign.status,200);assert.equal(foreign.data.data.items.length,0);
    const restricted=f.makeToken('alice',{scopes,projectIds:['second']});assert.equal((await f.request('/projects/same/datasheet-coverage',{token:restricted.token})).status,404);
    assert.equal((await f.request('/projects/absent/datasheet-coverage')).status,404);
    assert.equal((await f.request('/projects/same/datasheet-coverage',{token:f.key.token})).status,403);
    const files=dataFilesForProject(f.root,'alice','same');assert.equal((await readJson(files.geraetelisten))[0].positionen[0].custom,'behalten');
  }finally{await f.cleanup();}
});
test('Vorschlag bleibt ungeprüft; manuelle Freigabe, Wiederverwendung, Variantenwechsel und Dateiintegrität werden erkannt',async()=>{
  const f=await setup();
  try {
    let c=(await f.get()).data.data;let item=c.items.find(item=>item.model==='A-10');
    const p=await propose(f,item.references);
    c=(await f.get()).data.data;item=c.items.find(item=>item.model==='A-10');assert.equal(item.status,'pending');assert.equal(item.proposedPositions,2);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_review_views').get().n,0);
    const attachmentId=await p.approve();
    item=(await f.get()).data.data.items.find(item=>item.model==='A-10');assert.equal(item.status,'approved');assert.equal(item.linkedPositions,2);
    await f.request('/projects/same/device-lists/devices/positions',{method:'POST',headers:{'If-Match':(await f.get()).etag},body:{hersteller:'Hersteller',typ:'A-10'}});
    item=(await f.get()).data.data.items.find(item=>item.model==='A-10');assert.equal(item.status,'ready_to_link');assert.equal(item.uncoveredReferences.length,1);
    const linked=await f.request('/projects/same/approved-document-links',{method:'POST',headers:{'If-Match':(await f.get()).etag},body:{attachmentId,devices:item.uncoveredReferences.map(({revision,...ref})=>ref)}});assert.equal(linked.status,200,JSON.stringify(linked.data));
    assert.equal((await f.get()).data.data.items.find(item=>item.model==='A-10').status,'approved');
    const changed=await f.request('/projects/same/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':(await f.get()).etag},body:{farbe:'rot'}});assert.equal(changed.status,200);
    const variant=(await f.get()).data.data.items.find(item=>item.variant==='rot');assert.equal(variant.status,'assignment_conflict');
    const files=dataFilesForProject(f.root,'alice','same'),attachment=(await readJson(files.anhaenge)).find(doc=>doc.id===attachmentId);
    const file=await require('../services/attachmentService').resolveAttachmentFile(f.root,files,attachment.relativePath),bytes=await fs.readFile(file);
    await fs.writeFile(file,Buffer.from('%PDF-modified source'));
    assert.notEqual((await f.get()).data.data.items.find(item=>item.model==='A-10'&&!item.variant).status,'approved');
    await fs.writeFile(file,bytes);
    assert.equal(p.service.get('alice',p.job.id).documents[0].state,'approved');
    assert.equal((await readJson(files.geraetelisten))[0].positionen[0].custom,'behalten');
  }finally{await f.cleanup();}
});
test('Belegter Nichtfund bleibt unvollständig, verhindert Suchschleifen und wird nur ausdrücklich wieder aufgenommen',async()=>{
  const f=await setup();
  try {
    const job=(await f.request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Alle Artikel mit passenden Datenblättern abdecken.'}})).data.data;
    const c=await f.get(),article=c.data.data.items.find(item=>item.model==='PASSIV-20');
    const body={articleId:article.id,outcome:'not_found',reason:'Im geprüften Herstellerarchiv bisher keine passende Originalunterlage gefunden.',sources:['https://manufacturer.example.invalid/archive'],evidence:{sourceLabel:'Künstliche Recherche',sourceQuote:'Kein Treffer für die bestätigte Artikelnummer.'}};
    assert.equal((await f.request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':c.etag},body:{...body,sources:[]}})).status,400);
    assert.equal((await f.request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':c.etag},body})).status,200);
    assert.equal((await f.request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':c.etag},body})).status,412);
    const current=(await f.get()).data.data;assert.equal(current.items.find(item=>item.id===article.id).status,'not_found');assert.equal(current.summary.complete,false);
    const plan=(await f.request('/projects/same/next-action?jobId='+job.id)).data.data;
    assert.ok(!plan.agentActions.items.some(task=>task.target?.articleId===article.id));
    assert.ok(plan.agentActions.items.some(task=>task.code==='RESEARCH_DATASHEET'));
    assert.equal((await f.request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':(await f.get()).etag},body:{...body,outcome:'retry'}})).status,200);
    assert.equal((await f.get()).data.data.items.find(item=>item.id===article.id).status,'research');
    const viewer=f.makeToken('viewer',{scopes:scopes.filter(scope=>scope.endsWith(':read'))});assert.equal((await f.request('/projects/same/datasheet-searches',{token:viewer.token,method:'POST',body,headers:{'If-Match':(await f.get()).etag}})).status,403);
  }finally{await f.cleanup();}
});
test('Veralteter offener Vorschlag wird nach Typwechsel als Zuordnungskonflikt erkannt',async()=>{
  const f=await setup();
  try {
    const item=(await f.get()).data.data.items.find(item=>item.model==='A-10');
    const p=await propose(f,item.references);
    const changed=await f.request('/projects/same/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':(await f.get()).etag},body:{typ:'B-20'}});
    assert.equal(changed.status,200);
    const coverage=(await f.get()).data.data;
    assert.equal(coverage.items.find(item=>item.model==='B-20').status,'assignment_conflict');
    assert.equal(coverage.items.find(item=>item.model==='A-10').status,'pending');
    assert.equal(p.service.get('alice',p.job.id).documents[0].state,'pending');
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_review_views').get().n,0);
  }finally{await f.cleanup();}
});
test('Korrigierte Altkategorie erhält nur die explizite Datenblattpflicht desselben freigegebenen Originals',async()=>{
  const f=await setup();
  try {
    const job=(await f.request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Historische Kategorien gezielt prüfen und alle Freigaben erhalten.',requirements:[{id:'legacy_sheet',title:'Herstellerdatenblatt für A-10',category:'Nachweise'},{id:'certificate',title:'Herstellererklärung für A-10',category:'Nachweise'}]}})).data.data;
    const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic legacy original');
    const doc=await service.propose('alice',job.id,{title:'Herstellerdatenblatt A-10',category:'Nachweise',sourceLabel:'Künstliches Altarchiv',reason:'Regressionsprüfung einer historischen Fehlkategorie.',requirementIds:['legacy_sheet','certificate']},{originalName:'Alt.pdf',buffer:Buffer.from(await pdf.save())});
    service.viewed('alice',job.id,doc.id,doc.sha256);
    const attachmentId=await service.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:'Nachweise'}});
    const requirementsBefore=JSON.stringify(service.get('alice',job.id).requirements);
    const recategorized=await f.request('/projects/same/attachments/'+attachmentId,{method:'PATCH',headers:{'If-Match':(await f.get()).etag},body:{category:'Datenblätter'}});assert.equal(recategorized.status,200,JSON.stringify(recategorized.data));
    const article=(await f.get()).data.data.items.find(item=>item.model==='A-10');
    const link=await f.request('/projects/same/approved-document-links',{method:'POST',headers:{'If-Match':(await f.get()).etag},body:{attachmentId,devices:article.references}});assert.equal(link.status,200,JSON.stringify(link.data));
    const readiness=await require('../services/documentationReadinessService').createDocumentationReadinessService(f.root,{db:f.db,verificationService:f.productVerification}).inspect('alice','same',{assistantJobId:job.id});
    assert.equal(readiness.requirements.find(item=>item.id==='legacy_sheet').fulfilled,true);
    assert.equal(readiness.requirements.find(item=>item.id==='certificate').fulfilled,false);
    assert.equal(JSON.stringify(service.get('alice',job.id).requirements),requirementsBefore);
    assert.equal(service.get('alice',job.id).documents[0].state,'approved');
  }finally{await f.cleanup();}
});
test('Echter MCP liefert dieselbe Artikelabdeckung wie die API, ohne Freigabewerkzeug',async()=>{
  const f=await setup(),client=mcpClient(f.base,f.token.token,true);
  try {
    await client.initialize();const listed=(await client.rpc('tools/list',{})).result.tools;
    assert.ok(listed.some(tool=>tool.name==='edoku_datasheet_coverage'));assert.ok(listed.some(tool=>tool.name==='edoku_record_datasheet_search'));
    assert.ok(!listed.some(tool=>/approve|freigeben/i.test(tool.name)));
    const result=await client.rpc('tools/call',{name:'edoku_datasheet_coverage',arguments:{projectId:'same',status:'all',limit:10,offset:0}});
    assert.ok(!result.result.isError,JSON.stringify(result));assert.deepEqual(result.result.structuredContent.data.summary,(await f.get()).data.data.summary);
  }finally{await client.close();await f.cleanup();}
});
