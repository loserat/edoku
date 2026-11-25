const test=require('node:test'),assert=require('node:assert/strict');
const {trustedPage,domainsFor}=require('../services/manufacturerSourcePolicy');
const {pdfLinks,linkedPdf,pageEvidence}=require('../services/manufacturerPageService');
const {matchDocument}=require('../services/productDocumentMatchingService');
const {dimensionEvidence}=require('../services/productDimensionEvidenceService');
const {retryAfterPolicyChange,POLICY}=require('../services/productDocumentVerificationService');
const target={listId:'devices',position:1,manufacturer:'NIEDAX',model:'RLVC 60.200',variant:'60 × 200 mm (H × B), Lieferlänge 3.000 mm'};
const match=(text,t=target)=>matchDocument({pages:[{page:1,text}],targets:[t],totalPages:1,sourceLinked:true});
const own='NIEDAX\nAusschreibungstext\nAbmessungen (ca. Maße)\nHöhe H x Breite B : 60 x 200 mm\nLieferlänge L : 3000 mm\nNIEDAX Modell-Nr. : RLVC 60.200';
test('pure: belegte Herausgeber und Untermarken, sichere Grenzen und vorhandene Administratorregeln',()=>{
 const pairs={'ABB Stotz':'new.abb.com','ABB/Striebel & John':'www.striebelundjohn.com',Berker:'hager.com','Busch-Jaeger':'busch-jaeger.de',Bachmann:'www.bachmann.com',Cellpack:'electricalproducts.cellpack.com',Eaton:'eaton.com',ELTROPA:'eltropa.de',Esser:'esser-systems.com',HEGLER:'hegler.de',Hensel:'hensel-electric.de',INDEXA:'indexa.de',Klauke:'klauke.com',MERSEN:'mersen.com','Phoenix Contact':'phoenixcontact.com',Rittal:'rittal.com',Siemens:'support.industry.siemens.com',Siteco:'siteco.com','Weidmüller':'eshop.weidmueller.com'};
 for(const [manufacturer,host]of Object.entries(pairs)){
  assert.ok(trustedPage(manufacturer,'https://'+host+'/article'),manufacturer);
  for(const url of ['http://'+host+'/article','https://'+host+'.evil.example/article','https://'+host+':444/article','https://user:secret@'+host+'/article','https://example.com/article'])assert.equal(trustedPage(manufacturer,url),false,url);
 }
 assert.equal(trustedPage('Andere Marke','https://hager.com/article'),false);
 assert.deepEqual(domainsFor('ABB Stotz',{'ABB Stotz':['retained.example']}),['retained.example']);
 assert.deepEqual(domainsFor('Berker',{'Berker':['retained.example']}),['retained.example']);
 assert.deepEqual(domainsFor('ABB Stotz',{'ABB':['retained.example']}),['retained.example']);
 assert.equal(trustedPage('Berker','https://hager.com/article',{'BERKER':[]}),false);
 assert.deepEqual(domainsFor('Eigene Marke',{'Eigene Marke':['own.example']}),['own.example']);
 assert.equal(match('ABB\nTyp: S2C-H10',{...target,manufacturer:'ABB Stotz',model:'S2C-H10',variant:''}).state,'matched');
 assert.equal(match('HAGER\nTyp: 1675',{...target,manufacturer:'Berker',model:'1675',variant:''}).state,'matched');
 assert.equal(match('HAGER\nTyp: 1676',{...target,manufacturer:'Berker',model:'1675',variant:''}).state,'unclear');
});
test('pure: ausschließlich veröffentlichte PDF-Endpunkte ohne Endung, keine geratenen Generator-URLs',()=>{
 const urls=['https://api.katalog.gira.de/api/datasheet/getPDF/de_DE/021103','https://www.fraenkische.com/de-DE/download/pro-doc-dat-aes-e?context=electrical-installations-residential-buildings&mode=file','https://www.ledvance.com/de/product-datasheet/8625/136749?source=web','https://www.eltropa.de/Produkt/2810626/export-to-pdf/1','https://www.hensel-electric.de/de-de/produkt/23791/datasheet','https://www.rittal.com/pdf-creator/variant/de-de/7072100','https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SE2332','https://www.phoenixcontact.com/de-de/produkte/installationsklemme-akg-16-bu-0423014?type=pdf','https://datasheet.weidmueller.com/pdf/en/1876640000/scope/2/'];
 for(const sourceUrl of urls){const html=`<main><h1>Produkt</h1><a href="${sourceUrl.replaceAll('&','&amp;')}">Datenblatt</a></main>`;assert.equal(pdfLinks(html,'https://example.com/product')[0].sourceUrl,sourceUrl);assert.ok(linkedPdf(html,'https://example.com/product',sourceUrl).linked);}
 const real=urls[0],html=`<h1>021103</h1><a href="${real}">PDF</a><script><a href="https://evil.example/fake.pdf">Datenblatt</a></script>`;
 assert.equal(pdfLinks(html,'https://katalog.gira.de/de-DE/datenblatt/021103').length,1);
 assert.equal(linkedPdf(html,'https://katalog.gira.de/de-DE/datenblatt/021103',real.replace('de_DE','de-DE')+'?artikelnr=021103').linked,false);
 for(const bad of [real.replace('gira.de','gira.de.evil.example'),real.replace('getPDF','getText'),'https://evil.example/de/product-datasheet/1/2','https://www.fraenkische.com/de-DE/download/pro-doc-dat-aes-e?mode=page'])assert.equal(pdfLinks(`<a href="${bad}">PDF</a>`,'https://example.com').length,0);
});
const familyPage='https://www.fraenkische.com/de-DE/product/aes-e-alusteckendtulle';
const familyPdf='https://www.fraenkische.com/de-DE/download/pro-doc-dat-aes-e?mode=file';
const familyRow=(size,id,gtin)=>`<tr><td class="cart-variant__articlenumber"><div class="cart-variant__external-id">${id}</div><div class="cart-variant__international-id">${gtin}</div></td><td class="cart-variant__description">AES-E ${size}</td></tr>`;
const familyHtml=`<main><h1>AES-E</h1><table>${familyRow(25,'20990025','4013960187816')}${familyRow(32,'20990032','4013960187823')}</table><a href="${familyPdf}">Produktdatenblatt AES-E</a></main>`;
test('pure: Familienartikel aus eigener Typ-/Bestellnummern-/GTIN-Zeile binden, keine Nachbarvarianten',()=>{
 const inspect=(html=familyHtml,model='AES-E 25',sourceUrl=familyPdf)=>pageEvidence({html,pageUrl:familyPage,sourceUrl,model});
 const e=inspect();assert.equal(e.matched,true);assert.equal(e.documentModel,'20990025');assert.deepEqual(e.sourceGtins,['4013960187816']);
 assert.equal(inspect(familyHtml,'AES-E 26').matched,false);
 assert.equal(inspect(familyHtml.replace('<h1>AES-E</h1>','<h1>AMS-E</h1>')).matched,false);
 assert.equal(inspect(familyHtml,'AES-E 25',familyPdf.replace('aes-e','ams-e')).matched,false);
 assert.equal(inspect(familyHtml.replace('</table>',familyRow(25,'20990099','4013960187899')+'</table>')).matched,false);
 const pdf='FRÄNKISCHE\nArt-Nr.:   Type   Außen Ø   Inhalt   VPE\n209 90 025   25   35,3   50   STK\n209 90 032   32   44,0   50   STK';
 const t={...target,manufacturer:'Fränkische',model:'AES-E 25',documentModel:e.documentModel,variant:'',pageArticleConfirmed:true};
 assert.equal(match(pdf,t).state,'matched');assert.equal(match(pdf.replace('209 90 025','209 90 024'),t).state,'unclear');
 assert.equal(match(pdf.replace('209 90 025   25','209 90 032   32'),t).state,'unclear');
 const archived=familyHtml.replace(/<table>[\s\S]*?<\/table>/,'');
 const candidate=inspect(archived);assert.equal(candidate.matched,false);assert.deepEqual(candidate.familyTarget,{model:'AES-E',nominalSize:25});
 const familyTarget={...t,documentModel:undefined,familyTarget:candidate.familyTarget,variant:'Nenngröße 25'};
 const archivePdf='AES-E\n'+pdf;
 assert.equal(match(archivePdf,familyTarget).state,'matched');
 assert.equal(match(archivePdf.replace(/^AES-E/,'AES-E 44571'),familyTarget).state,'matched');
 assert.equal(match(archivePdf.replace(/^AES-E/,'AES-E 20990032'),familyTarget).state,'unclear');
 for(const bad of [archivePdf.replace(/^AES-E/,'AMS-E'),archivePdf.replace('209 90 025   25','209 90 025   32'),archivePdf+'\n209 90 099   25   35,3   50   STK'])assert.equal(match(bad,familyTarget).state,'unclear');
 assert.equal(match(archivePdf,{...familyTarget,variant:'Nenngröße 32'}).state,'unclear');
});
test('pure: eigene NIEDAX-Produktsektion und beschriftete Maße exakt prüfen, keine Verpackung oder Fremdartikel',()=>{
 assert.equal(match(own).state,'matched');
 for(const wrong of [own.replace('200 mm','201 mm'),own.replace('3000 mm','3001 mm'),own.replace('RLVC 60.200','RLVC 60.300'),own.replace('Höhe H x Breite B','Verpackungsmaß')])assert.equal(match(wrong).state,'unclear');
 assert.equal(match(own.replace('RLVC 60.200','RLVC 60.300')+'\nNIEDAX Modell-Nr. : RLVC 60.200').state,'unclear');
 assert.equal(dimensionEvidence('Länge × Breite × Höhe 2000 × 130 × 70 mm','2.000 × 130 × 70 mm (L × B × H)'),true);
 assert.equal(dimensionEvidence('Länge × Breite × Höhe 2000 × 130 × 71 mm','2.000 × 130 × 70 mm (L × B × H)'),false);
 assert.equal(dimensionEvidence('Abmessungen (ca. Maße) H x B : 60 x 200 mm\nLieferlänge L : 3000 mm','ca. 60 × 200 mm (H × B), Lieferlänge 3.000 mm'),true);
 assert.equal(dimensionEvidence('Höhe H x Breite B : 60 x 200 mm\nLieferlänge L : 3000 mm','ca. 60 × 200 mm (H × B), Lieferlänge 3.000 mm'),false);
 assert.equal(dimensionEvidence('Höhe H x Breite B (innen) : 60 x 202 mm\n135°','60 × 202 mm (H × lichte B), 45°'),false);
 const obo='Länge × Breite × Höhe 2000 × 24 × 54 mm';
 assert.equal(dimensionEvidence(obo,'54 × 24 × 2.000 mm',{manufacturer:'OBO Bettermann',model:'GS-TW70'}),true);
 assert.equal(dimensionEvidence(obo,'24 × 54 × 2.000 mm',{manufacturer:'OBO Bettermann',model:'GS-TW70'}),false);
 assert.equal(dimensionEvidence(obo,'54 × 24 × 2.000 mm',{manufacturer:'OBO Bettermann',model:'OTHER'}),false);
 assert.equal(dimensionEvidence('Länge × Breite × Höhe 2000 × 80 × 1 mm','80 × 2.000 mm',{manufacturer:'OBO Bettermann',model:'GS-OTRW'}),true);
 assert.equal(dimensionEvidence('Länge × Breite × Höhe 2000 × 81 × 1 mm','80 × 2.000 mm',{manufacturer:'OBO Bettermann',model:'GS-OTRW'}),false);
 assert.equal(dimensionEvidence('Abmessungen (ca. Maße) H x B : 60 x 300 mm\nLieferlänge L : 3000 mm','60 × 300 × 3.000 mm',{manufacturer:'NIEDAX',model:'KSL 60.303/3 S'}),true);
});
test('pure: Katalogmaße sind optional, Funktionserhalt und tatsächliche Brandschutzangaben bleiben Pflicht',()=>{
 const {deviceListFieldsForLeistungsbereich:fields}=require('../services/geraetelistenService');
 for(const area of ['Kabeltragsysteme / Verlegesysteme','Kabeltragsysteme / Verlegesysteme mit Funktionserhalt'])assert.equal(fields(area).find(f=>f.name==='abmessung').required,false);
 assert.equal(fields('Kabeltragsysteme / Verlegesysteme mit Funktionserhalt').find(f=>f.name==='funktionserhalt').required,true);
 const required=require('../services/brandschutzService').BRANDSCHUTZ_REQUIRED_FIELDS;assert.ok(required.length>0);
});
test('pure: nur konkret behobene V5/V6-Blocker wiederaufnehmen, V7 und Netzwerkfehler nicht wiederholen',()=>{
 const old={outcome:'blocked',verificationPolicy:'manufacturer_pdf_article_variant_v6',reason:'manufacturer_source_unconfirmed'};
 assert.equal(retryAfterPolicyChange(old,{manufacturer:'Berker',model:'1675'}),true);
 assert.equal(retryAfterPolicyChange({...old,verificationPolicy:POLICY},{manufacturer:'Berker',model:'1675'}),false);
 assert.equal(retryAfterPolicyChange({...old,verificationPolicy:'unknown-policy'},{manufacturer:'Berker',model:'1675'}),false);
 assert.equal(retryAfterPolicyChange({...old,reason:'SOURCE_HTTP_ERROR'},{manufacturer:'Berker',model:'1675'}),false);
 assert.equal(retryAfterPolicyChange({...old,reason:'variant_not_confirmed'},target),true);
 assert.equal(retryAfterPolicyChange({...old,reason:'manufacturer_page_article_not_confirmed'},{manufacturer:'Fränkische',model:'AES-E 25'}),true);
 assert.equal(retryAfterPolicyChange({...old,reason:'manufacturer_page_article_not_confirmed'},{manufacturer:'Fränkische',model:'UNKNOWN 25'}),false);
});
test('API/MCP: leere Katalogmaße, Wiederaufnahme, echte Neuprüfung und keine Schleife bei erneutem Blocker',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path');
 const {fixture,mcpClient}=require('./helpers/integrationFixture'),{scopes}=require('../src/api/schemas');
 const {dataFilesForProject}=require('../services/projectArchiveService'),{writeJson,readJson}=require('../services/jsonService');
 const store=require('../services/projectDataStoreService');
 const page='https://products.niedax.de/niedax_de/rlvc-60-200.html',source='https://products.niedax.de/rlvc.pdf';
 const f=await fixture({productChecks:true,setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same'),area='Kabeltragsysteme / Verlegesysteme';
  await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area]});await writeJson(files.dokumentenmatrix,[]);
  await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,aktiv:true,export:true,positionen:[{pos:1,hersteller:'NIEDAX',typ:target.model,system:'KTS',abmessung:''},{pos:2,hersteller:'NIEDAX',typ:'STL 60.303/3',system:'KTS',abmessung:''}]}]);
  const pdf=await require('pdf-lib').PDFDocument.create(),p=pdf.addPage();own.split('\n').forEach((line,i)=>p.drawText(line,{x:30,y:750-i*22,size:11}));
  await fs.writeFile(path.join(root,'original.pdf'),await pdf.save());await fs.writeFile(path.join(root,'page.html'),`<h1>RLVC 60.200</h1><a href="${source}">Datenblatt</a>`);
  await fs.writeFile(path.join(root,'product-source-fixture.json'),JSON.stringify({[page]:'page.html',[source]:'original.pdf'}));
 }});
 const token=f.makeToken('alice',{scopes}).token,req=(p,o={})=>f.request(p,{token,...o}),client=mcpClient(f.base,token,true);
 try{
  const job=(await req('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Isolierter synthetischer Nachweis ohne reale Projekt- oder Dateientscheidung.'}})).data.data;
  const metadata={title:'Synthetisches RLVC-Datenblatt',category:'Datenblätter',sourceLabel:'Künstliche Originalquelle',reason:'Technischer Test, kein reales Dokument.',manufacturerPageUrl:page,sourceUrl:source,deviceReferences:[{...target,variant:''}]};
  let r=await req('/projects/same/assistant/jobs/'+job.id+'/manufacturer-documents',{method:'POST',body:{metadata}});assert.equal(r.status,201,JSON.stringify(r.data));const doc=r.data.data;
  const assistant=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  // Synthetic viewing/approval exists solely in the disposable artificial fixture.
  await assistant.content('alice',job.id,doc.id);assistant.viewed('alice',job.id,doc.id,doc.sha256);
  await assistant.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:metadata.title,category:metadata.category}});
  const saved=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),files=dataFilesForProject(f.root,'alice','same'),attachment=(await readJson(files.anhaenge))[0];
  const patch=async value=>{const r=await req('/projects/same/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':(await req('/projects/same')).etag},body:{abmessung:value}});assert.equal(r.status,200);};
  const coverage=async()=>(await req('/projects/same/datasheet-coverage?status=all&limit=3')).data.data;
  const record=async()=>{const item=(await coverage()).items.find(x=>x.model===target.model);const r=await req('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':(await req('/projects/same')).etag},body:{articleId:item.id,outcome:'blocked',reason:'variant_not_confirmed nach tatsächlicher synthetischer Produktprüfung.',sources:[page,source],evidence:{sourceLabel:'Synthetische Verifikation',sourceQuote:'variant_not_confirmed'}}});assert.equal(r.status,200);return item.id;};
  await patch(target.variant);await record();let data=await readJson(files.projekt);data.datenblattRecherche.at(-1).verificationPolicy='manufacturer_pdf_article_variant_v6';await writeJson(files.projekt,data);
  assert.equal((await coverage()).items.find(x=>x.model===target.model).status,'assignment_conflict');
  await client.initialize();const plan=async()=>{const r=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:job.id,view:'full',limit:3}})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent.data;};
  let p=await plan();assert.ok(!p.agentActions.items.some(t=>t.code==='RESOLVE_VALIDATION'));assert.ok(!p.agentActions.items.some(t=>t.target?.field==='abmessung'));
  const list=(await req('/projects/same/device-lists/devices?limit=3')).data.data;assert.equal(list.fields.find(f=>f.name==='abmessung').required,false);
  const link=async()=>req('/projects/same/approved-document-links',{method:'POST',headers:{'If-Match':(await req('/projects/same')).etag},body:{attachmentId:attachment.id,devices:[{listId:'devices',position:1,manufacturer:'NIEDAX',model:target.model}]}});
  r=await link();assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.data.revalidated,true);assert.equal((await coverage()).summary.approved,1);
  await patch(target.variant.replace('200 mm','201 mm'));const before=await readJson(files.anhaenge);r=await link();assert.equal(r.status,422);assert.deepEqual(await readJson(files.anhaenge),before);
  const blockedId=await record();p=await plan();assert.ok(!p.agentActions.items.some(t=>t.target?.articleId===blockedId||t.code==='RESOLVE_VALIDATION'));assert.equal(p.execution.action,'continue');assert.ok(p.agentActions.items.some(t=>t.article?.model==='STL 60.303/3'));
  const status=(await req('/projects/same/documentation-status?assistantJobId='+job.id)).data.data;assert.ok(status.issues.some(i=>i.code==='DEVICE_DOCUMENT_CHANGED'));assert.ok(!status.issues.some(i=>i.code==='DEVICE_FIELD_MISSING'&&i.field==='abmessung'));
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),saved);assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,1);
  assert.equal((await readJson(files.geraetelisten))[0].positionen[1].abmessung,'');
 }finally{await client.close();await f.cleanup();}
});
