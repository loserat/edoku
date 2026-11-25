const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {readJson,writeJson}=require('../services/jsonService');
const {emptyProjectDocuments}=require('../services/emptyProjectService');
const {createProject,dataFilesForProject,ensureCurrentProject}=require('../services/projectArchiveService');
const {createGeraeteliste,syncGeraetelistenFromLeistungsbereiche,addPosition}=require('../services/geraetelistenService');
const store=require('../services/projectDataStoreService');
const area='Elektroinstallation / DIN VDE 0100';
async function setup(){return fixture({setup:async({root})=>{
 const values={
  'projekt.json':{projektname:'FREMDPROJEKT',auftraggeber:'FREMDFIRMA',logoPfad:'privat.png',stockwerke:['FREMD'],assistantFacts:[{value:'GEHEIM'}]},
  'leistungsbereiche.json':{optionen:[area,'Brandschutzabschottungen'],aktiv:[area],systemAuswahl:{[area]:'FREMDSYSTEM'}},
  'geraetelisten.json':[{id:'demo',leistungsbereich:area,aktiv:true,herstellerVorauswahl:'MUSTER',positionen:[{pos:1,typ:'BEISPIELGERAET'}]}],
  'brandschutz.json':[{id:'demo_schott',aktiv:true,system:'BEISPIELSCHOTT'}],
  'projektSysteme.json':[{id:'demo_system',leistungsbereich:area}],
  'anhaenge.json':[{id:'demo_pdf',title:'FREMDANHANG'}],
  'files.json':[{path:'FREMD.pdf'}], 'exportliste.json':[{id:'demo_export'}],
  'dokumentenmatrix.json':[{id:'general',titel:'Allgemein',leistungsbereich:'Allgemein',aktiv:true,quelle:'System',bemerkung:'FREMDNOTIZ',attachments:['privat.pdf']},{id:'devices',titel:'Geräte',leistungsbereich:area,aktiv:true,quelle:'data/geraetelisten.json',bemerkung:'FREMDNOTIZ'},{id:'manual',titel:'Nachweis',leistungsbereich:area,aktiv:true,quelle:'storage/users/anderer/privat.pdf',filePath:'privat.pdf'}]
 };
 for(const[name,value]of Object.entries(values))await writeJson(path.join(root,'data',name),value);
 }});}
async function documents(f,id){const files=dataFilesForProject(f.root,'alice',id),result={};for(const name of store.PROJECT_DOCUMENTS)result[name]=await readJson(path.join(files.dataDir,name));return result;}
function assertEmpty(d){
 for(const key of ['geraetelisten.json','brandschutz.json','projektSysteme.json','anhaenge.json','files.json','exportliste.json'])assert.deepEqual(d[key],[],key);
 assert.deepEqual(d['leistungsbereiche.json'].aktiv,[]);assert.deepEqual(d['leistungsbereiche.json'].systemAuswahl,{});assert.ok(d['leistungsbereiche.json'].optionen.includes(area));
 assert.equal(d['projekt.json'].logoPfad,'');assert.equal(d['projekt.json'].assistantFacts,undefined);assert.ok(!JSON.stringify(d).includes('FREMD'));
 assert.equal(d['dokumentenmatrix.json'].length,3);assert.equal(d['dokumentenmatrix.json'][0].aktiv,true);assert.ok(d['dokumentenmatrix.json'].slice(1).every(r=>r.aktiv===false));
 assert.equal(d['dokumentenmatrix.json'][1].quelle,'data/geraetelisten.json');assert.equal(d['dokumentenmatrix.json'][2].quelle,'');assert.ok(d['dokumentenmatrix.json'].every(r=>!r.bemerkung&&!r.attachments&&!r.filePath));
}
const existing=f=>JSON.stringify(f.db.prepare("SELECT * FROM project_documents WHERE project_id='same' ORDER BY user_id,name").all());
test('Nur Struktur und ausdrücklich übergebene Stammdaten aus belasteten globalen Startdateien übernehmen',async()=>{
 const f=await setup();try{
  const d=await emptyProjectDocuments(path.join(f.root,'data'),{projektname:'Neuer Auftrag',auftraggeber:'Echte Eingabe',stockwerke:['EG'],assistantFacts:[{value:'NICHT ERLAUBT'}]});
  assertEmpty(d);assert.equal(d['projekt.json'].auftraggeber,'Echte Eingabe');assert.deepEqual(d['projekt.json'].stockwerke,['EG']);
  const accepted=Object.fromEntries(Object.keys(require('../src/api/schemas').projectCreate.shape).map(k=>[k,k==='stockwerke'?['EG']:'Eingabe '+k]));
  const all=await emptyProjectDocuments(path.join(f.root,'data'),accepted);for(const[k,v]of Object.entries(accepted))assert.deepEqual(all['projekt.json'][k],v,k);
 }finally{await f.cleanup();}
});
test('Gemeinsame Projektanlage erhält vorhandene Projekte, globale Vorlagen und idempotent gespeicherte Inhalte',async()=>{
 const f=await setup();try{
  const before=existing(f),global=await fs.readFile(path.join(f.root,'data/geraetelisten.json'));
  const created=await createProject(f.root,path.join(f.root,'data'),'alice',{projektname:'Leeres Projekt',projektnummer:'NEU'},{projectId:'empty_test',makeCurrent:false});
  assertEmpty(await documents(f,created.projectId));assert.equal(existing(f),before);assert.deepEqual(await fs.readFile(path.join(f.root,'data/geraetelisten.json')),global);
  const files=dataFilesForProject(f.root,'alice',created.projectId);
  await store.withProjectDataTransaction(()=>writeJson(files.geraetelisten,[{id:'imported',leistungsbereich:area,positionen:[{pos:1,typ:'Tatsaechlicher Import'}]}]));
  await createProject(f.root,path.join(f.root,'data'),'alice',{projektname:'Anderer Wiederholtext'},{projectId:'empty_test',makeCurrent:false});
  await ensureCurrentProject(f.root,path.join(f.root,'data'),'alice');
  assert.equal((await readJson(files.geraetelisten))[0].positionen[0].typ,'Tatsaechlicher Import');assert.equal(existing(f),before);
 }finally{await f.cleanup();}
});
test('Neue Listen bleiben ohne Platzhalterposition, ausgewählte Bestandslisten erhalten ihre Geräte',()=>{
 const list=createGeraeteliste(area,true);assert.deepEqual(list.positionen,[]);
 const selected=syncGeraetelistenFromLeistungsbereiche([], [area], []);assert.deepEqual(selected[0].positionen,[]);
 const added=addPosition(selected,selected[0].id);assert.equal(added[0].positionen.length,1);assert.equal(added[0].positionen[0].pos,1);
 added[0].positionen[0].typ='Bestand';assert.equal(syncGeraetelistenFromLeistungsbereiche(added,[area],[])[0].positionen[0].typ,'Bestand');
});
test('Echte API/MCP-Neuanlage bleibt leer und wechselt das bestehende GUI-Projekt nicht',async()=>{
 const f=await setup(),token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true);
 try{
  const before=existing(f);await client.initialize();const args={input:{projektname:'MCP leer',projektnummer:'NEU-MCP',auftraggeber:'Echte Eingabe',stockwerke:['EG']},requestId:'empty_project_idempotent_001'};
  const call=async()=>{const result=(await client.rpc('tools/call',{name:'edoku_create_project',arguments:args})).result;assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent.data;};
  const result=await call();assert.ok(result.id);const created=await documents(f,result.id);assertEmpty(created);assert.equal(created['projekt.json'].auftraggeber,'Echte Eingabe');
  assert.equal((await call()).id,result.id);assert.equal(f.db.prepare("SELECT current_project_id FROM users WHERE id='alice'").get().current_project_id,'same');assert.equal(existing(f),before);
  for(const table of ['documentation_jobs','document_proposals'])if(f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))assert.equal(f.db.prepare('SELECT count(*) n FROM '+table).get().n,0);
 }finally{await client.close();await f.cleanup();}
});
test('Echte GUI-Neuanlage startet leer, setzt nur dieses neue Projekt aktiv und erhält Bestandsdaten',async()=>{
 const f=await setup();try{
  const before=existing(f),cookies=new Map();
  const browser=async(route,options={})=>{const response=await fetch(f.base+route,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;};
  const login=await(await browser('/login')).text(),csrf=login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  assert.equal((await browser('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  const html=await(await browser('/projekte')).text(),token=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  const created=await browser('/projekte',{method:'POST',body:new URLSearchParams({_csrf:token,projektname:'GUI leer',projektnummer:'NEU-GUI'})});assert.equal(created.status,302);assert.equal(new URL(created.headers.get('location'),f.base).pathname,'/projekt');
  const id=f.db.prepare("SELECT current_project_id FROM users WHERE id='alice'").get().current_project_id;assert.notEqual(id,'same');assertEmpty(await documents(f,id));assert.equal(existing(f),before);
  assert.equal((await browser('/geraetelisten')).status,200);
 }finally{await f.cleanup();}
});
