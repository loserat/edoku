const test=require('node:test'),assert=require('node:assert/strict');
const {matchDocument}=require('../services/productDocumentMatchingService');
const {aliasFor}=require('../services/manufacturerSourcePolicy');
const {retryAfterPolicyChange,POLICY}=require('../services/productDocumentVerificationService');
const {historicalSample}=require('../services/documentationMaterialPolicy');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {readJson,writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {scopes}=require('../src/api/schemas');
const raw={listId:'devices',position:1,manufacturer:'NIEDAX',model:'RAW 60.300',variant:'60 × 300 mm (H × B innen), Gesamtbreite 422 mm'};
const rawText='NIEDAX Modell-Nr.: RAW 60.300\nHöhe H x Breite B (innen): 60 x 300 mm\nGesamtbreite B1: 422 mm';
const match=(text,target=raw)=>matchDocument({pages:[{page:1,text}],totalPages:1,pageText:'',sourceLinked:true,targets:[target]}).targets[0];
test('RAW prüft Innenmaß und Gesamtbreite mit exakten Achsen statt Verpackungszahlen',()=>{
 assert.equal(match(rawText).state,'matched');assert.equal(match(rawText).variantEvidence,'niedax_raw_inside_and_total_width');
 for(const text of [rawText.replace('422 mm','423 mm'),rawText.replace('60 x 300','300 x 60'),rawText.replace('Gesamtbreite B1:','Verpackung:'),rawText+'\nGesamtbreite B1: 423 mm',rawText.replace('RAW 60.300','RAW 60.200')])assert.notEqual(match(text).state,'matched',text);
 assert.notEqual(match(rawText,{...raw,manufacturer:'Anderer Hersteller'}).state,'matched');
});
test('OBO-Verpackungsbezeichnung ist nur über den bestätigten exakten Artikelalias zulässig',()=>{
 assert.equal(aliasFor('OBO Bettermann','GS-KUP70 (VE2)'),'6277290');assert.equal(aliasFor('OBO Bettermann','GS-KUP70 (VE3)'),null);
 const {pageEvidence,linkedPdf,pdfLinks}=require('../services/manufacturerPageService');
 const pageUrl='https://www.obo.de/de-de/produkte/kupplung-gs-kup70-120-6277290.html',sourceUrl='https://www.obo.de/datasheet/de-de/6277290/GS-KUP70-6277290-de_DE.pdf';
 const html=`<main><h1>Kupplung GS-KUP70</h1><p>Art.Nr. 6277290</p><a href="${sourceUrl}">Datenblatt (PDF)</a></main>`;
 assert.ok(pageEvidence({html,pageUrl,sourceUrl,model:'GS-KUP70 (VE2)',documentModel:'6277290'}).matched);assert.equal(pdfLinks(html,pageUrl)[0].sourceUrl,sourceUrl);assert.ok(linkedPdf(html,pageUrl,sourceUrl).linked);
 assert.equal(linkedPdf(html,pageUrl,'https://www.obo.de/out/media/LFS-GS-KUP70-6277290-de.pdf').linked,false);
 assert.equal(pageEvidence({html:html.replaceAll('6277290','6277294').replaceAll('GS-KUP70','GS-KUP90'),pageUrl:pageUrl.replace('6277290','6277294'),sourceUrl,model:'GS-KUP70 (VE2)',documentModel:'6277290'}).matched,false);
 const target={...raw,manufacturer:'OBO Bettermann',model:'GS-KUP70 (VE2)',documentModel:'6277290',variant:'120 × 70 mm (L × B)',pageArticleConfirmed:true};
 const pdf='OBO\nArtikelnummer: 6277290\nTyp: GS-KUP70\nAbmessungen\nLänge\nBreite\n120 mm\n70 mm';
 assert.equal(match(pdf,target).state,'matched');
 for(const wrong of [pdf.replace('120 mm','121 mm'),pdf.replace('6277290','6277294'),pdf.replace('Abmessungen','Verpackungsabmessungen'),pdf+'\nArtikelnummer: 6277294'])assert.notEqual(match(wrong,target).state,'matched');
 assert.notEqual(match(pdf.replace('120 mm','120.000 mm'),target).state,'matched');
});
test('Versionswechsel öffnet nur belegte passende v5-Blocker; neue und fremde Blocker bleiben bestehen',()=>{
 const record={outcome:'blocked',verificationPolicy:'manufacturer_pdf_article_variant_v5',reason:'variant_not_confirmed'};
 assert.equal(retryAfterPolicyChange(record,raw),true);assert.equal(retryAfterPolicyChange({...record,verificationPolicy:POLICY},raw),false);
 assert.equal(retryAfterPolicyChange(record,{...raw,model:'RBA 60.300'}),false);assert.equal(retryAfterPolicyChange(record,{...raw,variant:'rot'}),false);
 assert.equal(retryAfterPolicyChange({...record,reason:'SOURCE_HTTP_ERROR'},raw),false);
 assert.equal(retryAfterPolicyChange({...record,reason:'manufacturer_page_article_not_confirmed'},{manufacturer:'OBO Bettermann',model:'GS-KUP70 (VE2)'}),true);
 assert.equal(retryAfterPolicyChange({...record,reason:'manufacturer_page_article_not_confirmed'},{manufacturer:'OBO Bettermann',model:'GS-KUP70 (VE3)'}),false);
 assert.equal(retryAfterPolicyChange({...record,verificationPolicy:'unknown-policy'},raw),false);
});
test('Historische Bemerkungsmarker erkennen, echte Materialbelege und Verneinungen beibehalten',()=>{
 for(const bemerkung of ['Beispieldatensatz',' Testposition ','Musterposition; historisch'])assert.equal(historicalSample({bemerkung}),true);
 for(const bemerkung of ['Kein Beispieldatensatz; tatsächlich geliefert.','ME01 A117; Einbau nicht belegt.','Prüfung einer Testposition im Labor.'])assert.equal(historicalSample({bemerkung}),false);
});
test('Echter MCP-Plan respektiert Blocker vor Zuordnungskonflikt und recherchiert keine markierten Muster',async()=>{
 const area='Kabeltragsysteme / Verlegesysteme';
 const f=await fixture({setup:async({root})=>{const files=dataFilesForProject(root,'alice','same');await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area]});await writeJson(files.dokumentenmatrix,[]);await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,aktiv:true,export:true,titel:'Technische Geräte',positionen:[{pos:1,hersteller:'NIEDAX',typ:'RAW 60.300',system:'KTS',abmessung:raw.variant,datenblattId:'retained-original'},{pos:2,hersteller:'NIEDAX',typ:'RLC 60.200',bemerkung:'Beispieldatensatz'},{pos:3,hersteller:'Testhersteller',typ:'REAL-100',system:'KTS',abmessung:'100 mm'}]}]);}});
 const token=f.makeToken('alice',{scopes}).token,request=(p,o={})=>f.request(p,{token,...o}),client=mcpClient(f.base,token,true);
 try{
  const job=(await request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Künstlicher Nachweis: Blocker erhalten, Muster auslassen, andere Artikel weiterbearbeiten.',requirements:[{id:'sample_sheet',title:'Historische Musteranforderung',category:'Datenblätter',device:{listId:'devices',position:2,manufacturer:'NIEDAX',model:'RLC 60.200'}}]}})).data.data;
  const before=(await request('/projects/same/device-lists/devices?limit=5')).data.data.positionen.items;
  const status=(await request('/projects/same/documentation-status?assistantJobId='+job.id)).data.data;assert.equal(status.requirements[0].applicable,false);assert.equal(status.requirements[0].fulfilled,false);assert.equal(status.requirements[0].exclusionReason,'historical_example');assert.equal((await request('/projects/same/assistant/jobs/'+job.id)).data.data.requirements.length,1);
  const coverage=async()=>(await request('/projects/same/datasheet-coverage?status=all&limit=5')).data.data;
  let c=await coverage();assert.equal(c.summary.articles,2);assert.equal(c.summary.excludedPositions,1);assert.equal(c.items.find(x=>x.model==='RAW 60.300').status,'assignment_conflict');
  const article=c.items.find(x=>x.model==='RAW 60.300');
  const body={articleId:article.id,outcome:'blocked',reason:'Neue Variante noch nicht bestätigt, unverändert zurückstellen.',sources:['https://products.niedax.de/niedax_de/raw-60-300.html'],evidence:{sourceLabel:'Synthetischer Prüfbefund',sourceQuote:'variant_not_confirmed'}};
  assert.equal((await request('/projects/same/datasheet-searches',{method:'POST',headers:{'If-Match':(await request('/projects/same')).etag},body})).status,200);
  c=await coverage();assert.equal(c.items.find(x=>x.id===article.id).status,'blocked');
  await client.initialize();const result=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:job.id,limit:1}})).result;assert.ok(!result.isError,JSON.stringify(result));const plan=result.structuredContent.data;
  assert.equal(plan.execution.action,'continue');assert.notEqual(plan.nextAction.target?.articleId,article.id);assert.equal(plan.datasheets.blocked,1);assert.ok(Buffer.byteLength(JSON.stringify(result))<8192);
  assert.deepEqual((await request('/projects/same/device-lists/devices?limit=5')).data.data.positionen.items,before);assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
  const files=dataFilesForProject(f.root,'alice','same'),p=await readJson(files.projekt);p.datenblattRecherche.at(-1).verificationPolicy='manufacturer_pdf_article_variant_v5';await writeJson(files.projekt,p);c=await coverage();assert.equal(c.items.find(x=>x.id===article.id).status,'assignment_conflict');
  assert.equal((await readJson(files.projekt)).datenblattRecherche.length,1);
  const lists=await readJson(files.geraetelisten);lists[0].positionen=[lists[0].positionen[1]];await writeJson(files.geraetelisten,lists);
  const onlySamples=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:job.id,limit:1}})).result.structuredContent.data;
  assert.equal(onlySamples.readiness.canGenerate,false);assert.equal(onlySamples.execution.action,'ask_batch');assert.equal(onlySamples.datasheets.articles,0);
 }finally{await client.close();await f.cleanup();}
});
test('Bestehende Freigabe bleibt bei geprüfter Variantenaktualisierung erhalten; andere PDF-Bytes werden nicht übernommen',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path'),store=require('../services/projectDataStoreService');
 const page='https://products.niedax.de/niedax_de/raw-60-300.html',pdfUrl='https://products.niedax.de/raw.pdf';
 const makePdf=async suffix=>{const doc=await require('pdf-lib').PDFDocument.create(),p=doc.addPage();['NIEDAX',...rawText.split('\n'),suffix].filter(Boolean).forEach((line,i)=>p.drawText(line,{x:30,y:750-i*20,size:11}));return Buffer.from(await doc.save());};
 const f=await fixture({productChecks:true,setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same'),area='Kabeltragsysteme / Verlegesysteme';
  await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area]});await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,aktiv:true,export:true,positionen:[{pos:1,hersteller:'NIEDAX',typ:'RAW 60.300',system:'KTS',abmessung:''}]}]);
  await fs.writeFile(path.join(root,'page.html'),`<h1>RAW 60.300</h1><a href="${pdfUrl}">Datenblatt PDF</a>`);await fs.writeFile(path.join(root,'original.pdf'),await makePdf(''));
  await fs.writeFile(path.join(root,'product-source-fixture.json'),JSON.stringify({[page]:'page.html',[pdfUrl]:'original.pdf'}));
 }});
 const token=f.makeToken('alice',{scopes}).token,req=(p,o={})=>f.request(p,{token,...o});try{
  const job=(await req('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Künstliche alte Freigabe und spätere Variantenangabe prüfen.'}})).data.data;
  const metadata={title:'Künstliches RAW-Datenblatt',category:'Datenblätter',sourceLabel:'Synthetische Herstellerquelle',reason:'Technischer Nachweis ohne reale Daten.',manufacturerPageUrl:page,sourceUrl:pdfUrl,deviceReferences:[{listId:'devices',position:1,manufacturer:'NIEDAX',model:'RAW 60.300',variant:''}]};
  const proposed=await req('/projects/same/assistant/jobs/'+job.id+'/manufacturer-documents',{method:'POST',body:{metadata}});assert.equal(proposed.status,201,JSON.stringify(proposed.data));const doc=proposed.data.data;
  // Simulated human viewing/approval ONLY in this isolated artificial fixture.
  const assistant=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});await assistant.content('alice',job.id,doc.id);assistant.viewed('alice',job.id,doc.id,doc.sha256);
  await assistant.approve('alice',job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:metadata.title,category:metadata.category}});
  const approved=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),files=dataFilesForProject(f.root,'alice','same'),attachment=(await readJson(files.anhaenge))[0];
  const patch=async abmessung=>{const r=await req('/projects/same/device-lists/devices/positions/1',{method:'PATCH',headers:{'If-Match':(await req('/projects/same')).etag},body:{abmessung}});assert.equal(r.status,200,JSON.stringify(r.data));};
  const link=async()=>req('/projects/same/approved-document-links',{method:'POST',headers:{'If-Match':(await req('/projects/same')).etag},body:{attachmentId:attachment.id,devices:[{listId:'devices',position:1,manufacturer:'NIEDAX',model:'RAW 60.300'}]}});
  await patch(raw.variant);assert.equal((await req('/projects/same/datasheet-coverage')).data.data.items[0].status,'assignment_conflict');
  let result=await link();assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.data.revalidated,true);assert.equal((await req('/projects/same/datasheet-coverage')).data.data.summary.approved,1);
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),approved);assert.equal((await readJson(files.anhaenge))[0].deviceReferences[0].variant,raw.variant);
  const before=await readJson(files.anhaenge);await patch(raw.variant.replace('422','423'));result=await link();assert.equal(result.status,422);assert.deepEqual(await readJson(files.anhaenge),before);
  await patch('60 × 300 mm');await fs.writeFile(path.join(f.root,'original.pdf'),await makePdf('Neue Herstellerrevision, nicht freigegeben.'));result=await link();assert.equal(result.status,409,JSON.stringify(result.data));assert.equal(result.data.error.code,'APPROVED_SOURCE_CHANGED');assert.deepEqual(await readJson(files.anhaenge),before);
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(doc.id),approved);assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,1);
 }finally{await f.cleanup();}
});
