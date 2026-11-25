const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {readJson,writeJson}=require('../services/jsonService');
const store=require('../services/projectDataStoreService');
const rules=require('../services/documentationMaterialPolicy');
const {filterExportGeraetelisten,buildDocumentationPlan}=require('../services/documentationPlanService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const area='Elektroinstallation / DIN VDE 0100';
const all={connectionTerminals:true,cablesAndWires:true,fasteningMaterial:true};
const none={connectionTerminals:false,cablesAndWires:false,fasteningMaterial:false};
const entries=[
 {pos:1,hersteller:'WAGO',typ:'221-413',beschreibung:'Verbindungsklemme'},
 {pos:2,hersteller:'Eupen',typ:'NYM-J 3x2,5',beschreibung:'Installationsleitung'},
 {pos:3,hersteller:'Test',typ:'Schraube SCREWSECRET',beschreibung:'Befestigung'},
 {pos:4,hersteller:'Test',typ:'KEEP-100',beschreibung:'Unterverteilung mit Verbindungsklemmen'},
 {pos:5,hersteller:'WAGO',typ:'750-430',beschreibung:'I/O-Modul mit Verbindungsklemmen'}
];
test('Gruppen konservativ erkennen: Material, technische Geräte und Zubehörhinweise unterscheiden',()=>{
 assert.deepEqual(entries.map(r=>rules.classify(r)),['connectionTerminals','cablesAndWires','fasteningMaterial',null,null]);
 for(const row of [{typ:'RLVC60.300',kategorie:'Befestigungsmaterial'},{typ:'KTUM 300',beschreibung:'Ausleger'},{typ:'ZZ330',beschreibung:'Brandschutz für Kabel'},{typ:'Leitungsschutzschalter'},{typ:'M100',beschreibung:'Messgerät für Kabel'},{typ:'Kabelkanal'},{typ:'MS 40',beschreibung:'Montageschiene',kategorie:'Befestigungsmaterial'},{typ:'N100',beschreibung:'Netzteil mit Verbindungsklemme'}])assert.equal(rules.classify(row),null,JSON.stringify(row));
 assert.throws(()=>rules.effective({assistantMaterialPolicy:{version:2,exclusions:all}}),e=>e.apiCode==='MATERIAL_POLICY_INVALID');
 assert.equal(rules.classify({hersteller:'WAGO®',typ:'221–413'}),'connectionTerminals');
 assert.equal(rules.classify({typ:'H07V-K'}),'cablesAndWires');
 assert.equal(rules.classify({typ:'R100',beschreibung:'Datenkabel S/FTP'}),'cablesAndWires');
 assert.equal(rules.effective({}).exclusions.cablesAndWires,false);assert.deepEqual(rules.effective({assistantWorkflow:{excludeConsumables:false}}).exclusions,none);
});
async function setup({many=false,explicit=true,noJob=false}={}){
 const f=await fixture({setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');
  await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area]});
  const project=await readJson(files.projekt);if(explicit)project.assistantMaterialPolicy={version:1,exclusions:all};await writeJson(files.projekt,project);
  await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,titel:'Testgeräte',aktiv:true,export:true,kapitel:'6.4',positionen:many?Array.from({length:400},(_,i)=>({...entries[1],pos:i+1})):entries}]);
  await writeJson(files.dokumentenmatrix,[{id:'devices',kapitel:'6.4',titel:'Geräteliste',leistungsbereich:area,quelle:'data/geraetelisten.json',dokumenttyp:'Kapitel',aktiv:true,export:true}]);
 }});
 const token=f.makeToken('alice',{scopes}).token;
 const request=(route,options={})=>f.request(route,{token,...options});
 const assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
 const job=noJob?null:assistant.create('alice','same',{instruction:'Synthetischen Materialumfang mit manuellen Dateientscheidungen prüfen.',requirements:[{id:'cable_sheet',title:'Kabeldatenblatt',category:'Datenblätter',device:{listId:'devices',position:2,manufacturer:'Eupen',model:'NYM-J 3x2,5'}}]});
 return {...f,token,request,assistant,job,files:dataFilesForProject(f.root,'alice','same')};
}
test('Kompakter MCP-Plan und Abdeckung lassen ausgeschlossene Artikel aus, ohne Positionen zu löschen',async()=>{
 const f=await setup(),client=mcpClient(f.base,f.token,true);try{
  const before=await readJson(f.files.geraetelisten);
  const coverage=await f.request('/projects/same/datasheet-coverage?limit=3');assert.equal(coverage.status,200);assert.equal(coverage.data.data.summary.articles,2);assert.equal(coverage.data.data.summary.excludedPositions,3);assert.deepEqual(coverage.data.data.materialExclusions,all);
  await client.initialize();const result=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:f.job.id,limit:3}})).result;
  assert.ok(!result.isError,JSON.stringify(result));assert.deepEqual(result.structuredContent.data.policy.materialExclusions,all);assert.ok(Buffer.byteLength(JSON.stringify(result))<8192);
  const status=(await f.request('/projects/same/documentation-status?assistantJobId='+f.job.id)).data.data;
  const req=status.requirements.find(r=>r.id==='cable_sheet');assert.equal(req.applicable,false);assert.equal(req.fulfilled,false);assert.equal(req.exclusionReason,'material_policy');
  assert.deepEqual(await readJson(f.files.geraetelisten),before);assert.equal(f.assistant.get('alice',f.job.id).requirements.length,1);
 }finally{await client.close();await f.cleanup();}
});
test('Viele ausgenommene Kabel bleiben als Zähler statt großer Ausschlussliste in der API',async()=>{
 const f=await setup({many:true});try{const result=await f.request('/projects/same/datasheet-coverage?limit=3');assert.equal(result.status,200,JSON.stringify(result.data));const d=result.data.data;assert.equal(d.summary.excludedPositions,400);assert.equal(d.exclusionsTotal,400);assert.equal(d.exclusions.length,3);assert.equal(d.exclusionsTruncated,true);assert.ok(Buffer.byteLength(JSON.stringify(result.data))<8192);}finally{await f.cleanup();}
});
test('Neue Übernahme/Unterlagen sind gesperrt, Linkermittlung lädt für ausgeschlossene Artikel nichts',async()=>{
 const f=await setup();try{
  const etag=(await f.request('/projects/same')).etag;
  const added=await f.request('/projects/same/device-lists/devices/positions',{method:'POST',headers:{'If-Match':etag},body:{hersteller:'Eupen',typ:'NYM-J 5x4'}});assert.equal(added.status,409);assert.equal(added.data.error.code,'DOCUMENTATION_MATERIAL_EXCLUDED');
  const finder=require('../services/manufacturerLinkService').createManufacturerLinkService(f.root,{sourceLoader:async()=>{throw Error('Must not load excluded product');}});
  const found=await finder.inspect('alice','same',f.job.id,{listId:'devices',position:2,manufacturerPageUrl:'https://www.eupen.com/product'});assert.equal(found.state,'excluded');assert.equal(found.htmlRequests,0);
  const guarded=createDocumentAssistantService(f.root,{db:f.db,verificationService:{technical:()=>true,check:async()=>{throw Error('Excluded PDF must not be loaded');}}});
  await assert.rejects(guarded.manufacturerDocument('alice',f.job.id,{metadata:{category:'Datenblätter',title:'Kabel',sourceLabel:'Synthetischer Hersteller',reason:'Ausnahme nicht umgehen.',manufacturerPageUrl:'https://www.eupen.com/product',sourceUrl:'https://www.eupen.com/file.pdf',deviceReferences:[{listId:'devices',position:2,manufacturer:'Eupen',model:'NYM-J 3x2,5'}]}}),e=>e.apiCode==='DOCUMENTATION_MATERIAL_EXCLUDED');
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);assert.equal((await readJson(f.files.geraetelisten))[0].positionen.length,5);
 }finally{await f.cleanup();}
});
test('MCP-Ablauf speichert Regeln und Beleg atomar; Legacy-Schalter überschreibt explizite Regeln nicht',async()=>{
 const f=await setup();try{
  const etag=()=>store.projectDataRevision(f.root,'alice','same');
  const start=async extra=>f.request('/projects/same/workflow',{method:'POST',headers:{'If-Match':'"'+etag()+'"'},body:{jobId:f.job.id,evidence:{sourceLabel:'Synthetischer Benutzerchat',sourceQuote:'Kabel und Verbindungsklemmen diesmal berücksichtigen.'},...extra}});
  const result=await start({materialExclusions:{...none,fasteningMaterial:true}});assert.equal(result.status,200,JSON.stringify(result.data));
  let project=await readJson(f.files.projekt);assert.equal(project.assistantMaterialHistory.length,1);assert.equal(project.assistantMaterialHistory[0].source,'mcp_workflow');
  const again=await start({excludeConsumables:true});assert.equal(again.status,200);project=await readJson(f.files.projekt);assert.deepEqual(project.assistantMaterialPolicy.exclusions,{...none,fasteningMaterial:true});assert.equal(project.assistantMaterialHistory.length,1);
 }finally{await f.cleanup();}
});
test('PDF-Geräteliste blendet Material aus und erneutes Einschalten stellt die Originalpositionen wieder dar',async()=>{
 const f=await setup();try{
  const data=await require('../services/projectWorkspaceService').loadProjectWorkspace(f.root,'alice','same'),before=JSON.stringify(data.geraetelisten);
  const lists=filterExportGeraetelisten(data.geraetelisten,data.leistungsbereiche,data.projekt);assert.deepEqual(lists[0].positionen.map(r=>r.pos),[4,5]);
  const files=await require('../services/pdfService').generateGeraetelisten(f.root,data.projekt,data.geraetelisten,data.systemSettings,data.matrix,data.leistungsbereiche,data.anhaenge);
  assert.equal(files.length,1);const parsed=await require('../services/productDocumentVerificationService').extractPdf(typeof files[0]==='string'?files[0]:files[0].filePath);
  const text=parsed.pages.map(p=>p.text).join(' ');assert.match(text,/KEEP-100/);assert.ok(!text.includes('221-413')&&!text.includes('NYM-J')&&!text.includes('SCREWSECRET'));
  assert.equal(JSON.stringify(data.geraetelisten),before);data.projekt.assistantMaterialPolicy.exclusions=none;assert.equal(filterExportGeraetelisten(data.geraetelisten,data.leistungsbereiche,data.projekt)[0].positionen.length,5);
  const justCable=[{...data.geraetelisten[0],positionen:[entries[1]]}];data.projekt.assistantMaterialPolicy.exclusions=all;assert.equal(filterExportGeraetelisten(justCable,data.leistungsbereiche,data.projekt).length,0);
  assert.ok(!buildDocumentationPlan(data.matrix,justCable,[],data.leistungsbereiche,data.projekt).some(x=>x.deviceListId));
 }finally{await f.cleanup();}
});
test('Bereits vorhandener Vorschlag und manuelle Dateientscheidung bleiben trotz neuer Materialregeln erhalten',async()=>{
 const f=await setup({explicit:false});try{
  const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage().drawText('SYNTHETIC LEGACY CABLE SHEET');
  const doc=await f.assistant.propose('alice',f.job.id,{title:'Vorhandenes Kabeldatenblatt',category:'Datenblätter',sourceLabel:'Künstliche Quelle',reason:'Bestand und manuelle Freigabe schützen.',requirementIds:['cable_sheet'],deviceReferences:[{listId:'devices',position:2,manufacturer:'Eupen',model:'NYM-J 3x2,5'}]},{buffer:Buffer.from(await pdf.save()),originalName:'synthetic.pdf'});
  const rowBefore=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id);
  await store.withProjectDataTransaction(async()=>{const project=await readJson(f.files.projekt);rules.save(project,all,{actor:'alice',source:'manual_gui',evidence:{selection:all}});await writeJson(f.files.projekt,project);});
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),rowBefore);
  // Human viewing/approval is simulated ONLY inside this artificial fixture.
  await f.assistant.content('alice',f.job.id,doc.id);f.assistant.viewed('alice',f.job.id,doc.id,doc.sha256);
  await f.assistant.approve('alice',f.job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:doc.category}});
  const files=await readJson(f.files.anhaenge);assert.equal(files.length,1);assert.equal(files[0].export,true);assert.equal(f.assistant.get('alice',f.job.id).documents[0].state,'approved');
  const lists=await readJson(f.files.geraetelisten);assert.ok(lists[0].positionen.find(r=>r.pos===2).datenblattId);
 }finally{await f.cleanup();}
});
test('GUI zeigt drei projektbezogene Häkchen und speichert mit CSRF/Version, auch ohne Auftrag',async()=>{
 const f=await setup({explicit:false,noJob:true});try{
  const cookies=new Map();const browser=async(route,options={})=>{const r=await fetch(f.base+route,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return r;};
  let html=await(await browser('/login')).text(),csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];assert.equal((await browser('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  html=await(await browser('/assistent')).text();assert.match(html,/Verbindungsklemmen nicht dokumentieren/);assert.match(html,/Kabel und Leitungen nicht dokumentieren/);assert.match(html,/Befestigungsmaterial nicht dokumentieren/);
  csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];const revision='"'+store.projectDataRevision(f.root,'alice','same')+'"',before=await readJson(f.files.geraetelisten);
  assert.equal((await browser('/assistent/materialregeln',{method:'POST',body:new URLSearchParams({projectId:'same',revision})})).status,403);
  const r=await browser('/assistent/materialregeln',{method:'POST',body:new URLSearchParams({_csrf:csrf,projectId:'same',revision,connectionTerminals:'on',cablesAndWires:'on',fasteningMaterial:'on'})});assert.equal(r.status,302);
  const project=await readJson(f.files.projekt);assert.deepEqual(project.assistantMaterialPolicy.exclusions,all);assert.equal(project.assistantMaterialHistory[0].source,'manual_gui');assert.deepEqual(await readJson(f.files.geraetelisten),before);
  assert.equal((await browser('/assistent/materialregeln',{method:'POST',body:new URLSearchParams({_csrf:csrf,projectId:'same',revision})})).status,412);
 }finally{await f.cleanup();}
});
