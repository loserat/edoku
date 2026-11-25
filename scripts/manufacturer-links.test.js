const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const {createManufacturerLinkService}=require('../services/manufacturerLinkService');
const {pdfLinks}=require('../services/manufacturerPageService');
const {matchDocument}=require('../services/productDocumentMatchingService');
const {encodedBytes}=require('../services/statusQueryService');
const area='Elektroinstallation / DIN VDE 0100',page='https://products.niedax.de/niedax_de/ktum-300.html';
const pdf='https://products.niedax.de/media/leaflet/de/de/pdf_datasheets/NIEDAX-KTUM-300-de.pdf';
const fragment='https://products.niedax.de/niedax_de/leafletproduct/catalog/leafletproduct/product_id/123/';
const baseHtml=`<h1>KTUM 300</h1><div id="leafletProductContainer" data-mage-init='{"leafletProduct":{"ajaxUrl":"${fragment}"}}'></div>`;
const partHtml=`<p>NIEDAX Modell-Nr. : KTUM 300</p><a href="${pdf}">Datenblatt</a><a href="/manual.pdf">Montageanleitung</a>`;
const target={listId:'devices',position:1,manufacturer:'NIEDAX',model:'KTUM 300',variant:'305 mm breit'};
const match=(text,extra={})=>matchDocument({pages:[{page:2,text}],targets:[{...target,...extra}],totalPages:2});

test('KTUM: nutzbare Breite entspricht genau der bezeichneten Auflagelänge; keine pauschale Maßtoleranz',()=>{
 const text='Auflagehöhe H : 73 mm\nAuflagelänge L : 305 mm\nNIEDAX Modell-Nr. : KTUM 300';
 const positive=match(text);assert.equal(positive.state,'matched');assert.equal(positive.targets[0].variantEvidence,'niedax_ktum_support_length');
 for(const bad of [text.replace('305 mm','3050 mm'),text.replace('Auflagelänge L','Verpackungsbreite'),text+'\nAuflagelänge L : 405 mm',text.replace('KTUM 300','KTUM 400')])assert.equal(match(bad).state,'unclear');
 assert.equal(match(text,{manufacturer:'Anderer Hersteller'}).state,'unclear');
 assert.equal(match(text.replace(/KTUM 300/g,'RLVC 300'),{model:'RLVC 300'}).state,'unclear');
 assert.equal(match(text,{variant:'305 mm hoch'}).state,'unclear');
 assert.equal(match(text,{variant:'305 mm breit · schwarz'}).state,'unclear');
});
test('PDF-Links: relative Adressen, Entitäten und sichere Wrapper; keine Skriptausführung',()=>{
 const links=pdfLinks('<script><a href="/fake.pdf">Fake</a></script><a href="/sheet.pdf?a=1&amp;b=2">Datenblatt</a><a href="http://bad.example/a.pdf">Unsicher</a><a href="https://user:secret@bad.example/a.pdf">Unsicher</a><a href="javascript:alert(1)">Falsch</a>',page);
 assert.equal(links.length,1);assert.equal(links[0].sourceUrl,'https://products.niedax.de/sheet.pdf?a=1&b=2');
 assert.equal(pdfLinks('<a href="https://example.com/a.download?uri=%2Fp%2F123.pdf&amp;file=123.pdf">Datenblatt</a>',page)[0].sourceUrl,'https://example.com/p/123.pdf');
});
async function setup(){
 const f=await fixture({setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');
  await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});
  await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,aktiv:true,positionen:[{pos:1,hersteller:'NIEDAX',typ:'KTUM 300',abmessung:'305 mm breit',custom:'behalten'}]}]);
  // Dependency double exists ONLY inside this isolated fixture checkout.
  await fs.appendFile(path.join(root,'services/manufacturerLinkService.js'),`\nconst originalFactory=module.exports.createManufacturerLinkService;module.exports.createManufacturerLinkService=(root)=>originalFactory(root,{sourceLoader:async url=>({finalUrl:url,bytes:Buffer.from(url.includes('leafletproduct')?${JSON.stringify(partHtml)}:${JSON.stringify(baseHtml)})})});\n`);
 }});
 const assistant=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
 const job=assistant.create('alice','same',{instruction:'Synthetische kompakte Hersteller-Linkermittlung testen.'});
 return {...f,job,token:f.makeToken('alice',{scopes}).token};
}
const capture=f=>Object.fromEntries(['project_documents','project_data_revisions','documentation_jobs','document_proposals','document_review_views','project_device_positions'].map(name=>[name,JSON.stringify(f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all())]));
test('Linkermittlung: genau zwei HTML-Anfragen, richtiger Artikel, kleine Antwort, keine PDF/Projektänderung',async()=>{
 const f=await setup();
 try{
  const calls=[],loader=async(url,options)=>{calls.push({url,options});return {finalUrl:url,bytes:Buffer.from(url===page?baseHtml:partHtml)};};
  const before=capture(f),result=await createManufacturerLinkService(f.root,{sourceLoader:loader}).inspect('alice','same',f.job.id,{manufacturerPageUrl:page,listId:'devices',position:1});
  assert.equal(result.state,'found');assert.equal(result.htmlRequests,2);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].sourceUrl,pdf);assert.equal(result.pdfDownloaded,false);assert.equal(result.proposalCreated,false);assert.ok(encodedBytes(result)<6144);
  assert.deepEqual(calls.map(c=>c.url),[page,fragment]);assert.ok(calls.every(c=>c.options.kind==='html'));assert.deepEqual(capture(f),before);
  const wrong=await createManufacturerLinkService(f.root,{sourceLoader:loader}).inspect('alice','same',f.job.id,{manufacturerPageUrl:'https://other.example/product',listId:'devices',position:1});assert.equal(wrong.state,'blocked');assert.equal(calls.length,2);
  const redirect=await createManufacturerLinkService(f.root,{sourceLoader:async url=>({bytes:Buffer.from(baseHtml),finalUrl:url===page?page:'https://other.example/fragment'})}).inspect('alice','same',f.job.id,{manufacturerPageUrl:page,listId:'devices',position:1});assert.equal(redirect.reason,'manufacturer_fragment_redirect_unconfirmed');
  const noArticle=await createManufacturerLinkService(f.root,{sourceLoader:async url=>({bytes:Buffer.from('<h1>ART-999</h1><a href="/sheet.pdf">Datenblatt</a>'),finalUrl:url})}).inspect('alice','same',f.job.id,{manufacturerPageUrl:page,listId:'devices',position:1});assert.equal(noArticle.state,'not_found');
 }finally{await f.cleanup();}
});
test('Linkermittlung bleibt auch bei vielen langen Links kompakt und folgt keiner zweiten Fragmentkette',async()=>{
 const f=await setup();
 try{
  const body=Array.from({length:15},(_,i)=>`<a href="/media/leaflet/pdf_datasheets/${'a'.repeat(1400)}-${i}.pdf">Datenblatt</a>`).join('');
  let calls=0;
  const svc=createManufacturerLinkService(f.root,{sourceLoader:async url=>{calls++;return {finalUrl:url,bytes:Buffer.from(url===page?baseHtml:'<h1>KTUM 300</h1>'+baseHtml+body)};}});
  const result=await svc.inspect('alice','same',f.job.id,{manufacturerPageUrl:page,listId:'devices',position:1});
  assert.equal(calls,2);assert.equal(result.state,'found');assert.ok(result.candidates.length>0&&result.candidates.length<=3);assert.equal(result.candidateCount,15);assert.equal(result.moreCandidates,true);assert.ok(encodedBytes(result)<=6144);
  const blocked=await createManufacturerLinkService(f.root,{sourceLoader:async()=>{throw Object.assign(Error(),{code:'SOURCE_ADDRESS_BLOCKED'});}}).inspect('alice','same',f.job.id,{manufacturerPageUrl:page,listId:'devices',position:1});
  assert.equal(blocked.state,'blocked');assert.equal(blocked.reason,'SOURCE_ADDRESS_BLOCKED');assert.equal(blocked.htmlRequests,1);
 }finally{await f.cleanup();}
});
test('HTTP und echter MCP: Rechte, Auftrag/Ziel, 54 Werkzeuge und vollständige Ergebnisse unter 8 KiB',async()=>{
 const f=await setup(),client=mcpClient(f.base,f.token,false);
 try{
  const route='/projects/same/assistant/jobs/'+f.job.id+'/manufacturer-links',args={manufacturerPageUrl:page,listId:'devices',position:1};
  const url=route+'?'+new URLSearchParams(args),before=capture(f);
  const r=await f.request(url,{token:f.token});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.data.candidates[0].sourceUrl,pdf);
  const narrow=f.makeToken('alice',{scopes:['projects:read']}).token;assert.equal((await f.request(url,{token:narrow})).status,403);
  assert.equal((await f.request(url.replace('projects/same','projects/second'),{token:f.token})).status,404);
  assert.equal((await f.request(url+'&bad=true',{token:f.token})).status,400);
  assert.equal((await f.request(url.replace('position=1','position=2'),{token:f.token})).status,404);
  await client.initialize();const tools=(await client.rpc('tools/list',{})).result.tools;assert.equal(tools.length,22);assert.ok(!tools.some(t=>/approve/.test(t.name)));
  const result=(await client.rpc('tools/call',{name:'edoku_find_manufacturer_documents',arguments:{projectId:'same',jobId:f.job.id,...args}})).result;
  assert.ok(!result.isError,JSON.stringify(result));assert.equal(result.structuredContent.data.candidates[0].sourceUrl,pdf);assert.ok(Buffer.byteLength(JSON.stringify(result))<8192);assert.deepEqual(capture(f),before);
 }finally{await client.close();await f.cleanup();}
});
