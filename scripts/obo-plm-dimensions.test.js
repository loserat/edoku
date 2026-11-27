const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {PDFDocument}=require('pdf-lib');
const {matchDocument}=require('../services/productDocumentMatchingService');
const {compactVerification,retryAfterPolicyChange,POLICY,extractPdf}=require('../services/productDocumentVerificationService');
const {classify}=require('../services/workflowBlockerService');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {scopes}=require('../src/api/schemas');
const {dataFilesForProject}=require('../services/projectArchiveService');
const {readJson,writeJson}=require('../services/jsonService');
const target={listId:'devices',position:1,manufacturer:'OBO Bettermann',model:'PLM D 0404 FS',variant:'40 × 44 × 2000 mm',pageArticleConfirmed:true};
const first='Technisches Datenblatt\nArtikelnummer: 7218000\nStammdaten\nArtikelnummer\nTyp\nDimension\n7218000\nPLM D 0404 FS\n40x44x2000\nOBO';
const second='Technisches Datenblatt\nArtikelnummer: 7218000\nAbmessungen\nLänge\nBreite\nHöhe\nMaß\nB\nMaß H\n2.000 mm\n40 mm\n44 mm\n40 mm\n44 mm\nTechnische Daten\nInnenhöhe\n38 mm';
const pages=()=>[{page:1,text:first},{page:2,text:second}];
const check=(p=pages(),options={})=>matchDocument({pages:p,totalPages:p.length,sourceLinked:true,manual:false,targets:[{...target}],...options});

test('OBO PLM: artikelgebundene mm-Tabelle belegt B/H/L ohne Einheiten am Stammdatenwert',()=>{
 const result=check();assert.equal(result.state,'matched');assert.equal(result.targets[0].variantEvidence,'obo_plm_bound_dimensions');assert.equal(result.targets[0].variantRequired,true);
 assert.equal(check([{page:1,text:first},{page:2,text:second.replace('Maß\nB\nMaß H\n','').replace('44 mm\n40 mm\n44 mm\n','44 mm\n')}]).state,'matched');
 for(const value of ['2000','2.000','2000,0'])assert.equal(check([{page:1,text:first},{page:2,text:second.replace('2.000',value)}]).state,'matched');
});
test('OBO PLM: fremde Artikel, vertauschte/abweichende Maße, widersprüchliche Tabellen und fehlende Einheiten bleiben gesperrt',()=>{
 const variants=[second.replaceAll('7218000','7218001'),second.replaceAll('40 mm','41 mm'),second.replace('2.000 mm','4000 mm'),second.replace('40 mm\n44 mm','44 mm\n40 mm'),second.replaceAll(' mm',''),second.replace('Maß H','Unbekannte Spalte'),second+'\nAbmessungen\nLänge\nBreite\nHöhe\n1000 mm\n40 mm\n44 mm\nTechnische Daten'];
 for(const value of variants)assert.equal(check([{page:1,text:first},{page:2,text:value}]).state,'unclear',value);
 assert.equal(check([{page:1,text:first}]).state,'unclear');
 for(const extra of [{sourceLinked:false},{manual:true},{truncated:true},{targets:[{...target,pageArticleConfirmed:false}]},{targets:[{...target,variant:'44 × 40 × 2000 mm'}]}])assert.equal(check(undefined,extra).state,'unclear',JSON.stringify(extra));
});
test('edoku unterscheidet technische Lesesperre von widersprüchlichen Maßen und gibt keine erfundene Datenfrage aus',()=>{
 const layout=compactVerification({...check([{page:1,text:first}]),policy:POLICY});
 assert.equal(layout.targets[0].reason,'dimension_layout_unconfirmed');assert.equal(layout.resolution.kind,'technical');assert.equal(layout.resolution.owner,'maintainer');assert.equal(layout.resolution.askUser,false);assert.deepEqual(layout.resolution.missingFields,[]);
 const mismatch=compactVerification(check([{page:1,text:first},{page:2,text:second.replaceAll('40 mm','41 mm')}]));assert.equal(mismatch.resolution.kind,'identity');
 const stored=classify({outcome:'blocked',blockerCode:'PDF_DIMENSION_LAYOUT_UNSUPPORTED',reason:'variant_not_confirmed bei Artikel 7218000'});assert.equal(stored.kind,'technical');assert.equal(stored.askUser,false);assert.deepEqual(stored.missingFields,[]);
});
test('V10 öffnet nur frühere OBO-PLM-Maßbefunde und erhält aktuelle, fremde sowie Quellen-/Freigabesperren',()=>{
 const record={outcome:'blocked',verificationPolicy:'manufacturer_pdf_article_variant_v9',blockerCode:'PDF_DIMENSION_LAYOUT_UNSUPPORTED',reason:'Maßtabelle nicht erkannt'};
 assert.equal(retryAfterPolicyChange(record,target),true);
 for(const patch of [{verificationPolicy:POLICY},{outcome:'not_found'},{reason:'SOURCE_FILE_LIMIT'},{reason:'manufacturer_source_unconfirmed'},{reason:'pdf_not_linked_by_manufacturer'},{reason:'PROPOSAL_CONFLICT'}])assert.equal(retryAfterPolicyChange({...record,...patch},target),false);
 for(const patch of [{manufacturer:'Anderer Hersteller'},{model:'GS-TW70'},{variant:'40 × 44 mm'}])assert.equal(retryAfterPolicyChange(record,{...target,...patch}),false);
});

test('Echte API/MCP: OBO-PDF bleibt Vorschlag, technische Befunde sind eindeutig, fehlende Angaben haben konkrete Ziele',async()=>{
 const area='Kabeltragsysteme / Verlegesysteme';
 const f=await fixture({productChecks:true,setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});
  await writeJson(files.geraetelisten,[{id:'devices',aktiv:true,leistungsbereich:area,positionen:[{pos:1,hersteller:target.manufacturer,typ:target.model,system:'PYROLINE Rapid PLM',abmessung:target.variant,installationStatus:'test_assumption',custom:'retained'}]}]);
 }});
 const token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true),request=(url,options={})=>f.request(url,{token,...options});
 try{
  const base='/projects/same',pageUrl='https://www.obo.de/test/plm',pdfUrl='https://www.obo.de/test/plm.pdf',badUrl='https://www.obo.de/test/incomplete.pdf';
  const makePdf=async(texts,name)=>{const pdf=await PDFDocument.create();for(const text of texts)pdf.addPage().drawText(text,{x:30,y:780,size:10,lineHeight:13});await fs.writeFile(path.join(f.root,name),await pdf.save());};
  await makePdf(['Synthetic retained original'],'retained.pdf');await makePdf([first,second],'obo.pdf');await makePdf([first],'incomplete.pdf');
  await fs.writeFile(path.join(f.root,'obo.html'),`<h1>PLM D 0404 FS</h1><p>7218000</p><a href="${pdfUrl}">Datenblatt</a><a href="${badUrl}">Datenblatt</a>`);
  await fs.writeFile(path.join(f.root,'product-source-fixture.json'),JSON.stringify({[pageUrl]:'obo.html',[pdfUrl]:'obo.pdf',[badUrl]:'incomplete.pdf'}));
  const assistant=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const job=assistant.create('alice','same',{instruction:'Künstlichen OBO-Test und konkrete fehlende Firma prüfen.',requirements:[{id:'company',title:'Ausführende Firma',category:'Allgemein',dependsOn:[{subject:{kind:'project'},key:'ausfuehrendeFirma'}]}]});
  const kept=await assistant.propose('alice',job.id,{title:'Künstlicher Bestandsbeleg',category:'Allgemein',sourceLabel:'Test',reason:'Bestandsschutz'}, {buffer:await fs.readFile(path.join(f.root,'retained.pdf')),originalName:'retained.pdf'});
  await assistant.content('alice',job.id,kept.id);assistant.viewed('alice',job.id,kept.id,kept.sha256);
  await assistant.approve('alice',job.id,kept.id,{reviewed:'on',sha256:kept.sha256,revision:(await request(base)).etag.slice(1,-1),metadata:{title:kept.title,category:kept.category}});
  const protectedRows=f.db.prepare('SELECT * FROM document_proposals').all(),views=f.db.prepare('SELECT * FROM document_review_views').all();
  const files=dataFilesForProject(f.root,'alice','same'),lists=await readJson(files.geraetelisten);
  const coverage=(await request(base+'/datasheet-coverage')).data.data.items[0];
  const project=await readJson(files.projekt);await writeJson(files.projekt,{...project,datenblattRecherche:[{articleId:coverage.id,outcome:'blocked',verificationPolicy:'manufacturer_pdf_article_variant_v9',blockerCode:'PDF_DIMENSION_LAYOUT_UNSUPPORTED',reason:'Maßtabelle nicht erkannt',sources:[pageUrl,pdfUrl],recordedAt:new Date().toISOString(),evidence:{sourceLabel:'Test',sourceQuote:'40x44x2000'}}]});
  assert.equal((await request(base+'/datasheet-coverage')).data.data.items[0].status,'research');
  await client.initialize();const call=async(name,args)=>{const r=(await client.rpc('tools/call',{name,arguments:args})).result;assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent.data;};
  const metadata={title:'OBO PLM Originaldatenblatt',category:'Datenblätter',manufacturerPageUrl:pageUrl,sourceUrl:pdfUrl,sourceLabel:'Künstliche Herstellerquelle',reason:'Maßtabelle prüfen',deviceReferences:[{listId:'devices',position:1,manufacturer:target.manufacturer,model:target.model}]};
  const bad=await call('edoku_propose_document',{projectId:'same',jobId:job.id,mode:'check',metadata:{...metadata,sourceUrl:badUrl}});
  assert.equal(bad.verification.resolution.kind,'technical');assert.deepEqual(bad.verification.resolution.missingFields,[]);assert.equal(bad.proposalCreated,false);
  const failed=(await client.rpc('tools/call',{name:'edoku_propose_document',arguments:{projectId:'same',jobId:job.id,metadata:{...metadata,sourceUrl:badUrl}}})).result;
  assert.equal(failed.isError,true);const error=JSON.parse(failed.content[0].text);assert.equal(error.verification.resolution.owner,'maintainer');assert.equal(error.verification.resolution.askUser,false);
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals').all(),protectedRows);assert.deepEqual(f.db.prepare('SELECT * FROM document_review_views').all(),views);
  const plan=(await request(base+'/next-action?jobId='+job.id+'&view=full&limit=10')).data.data;
  const retry=plan.agentActions.items.find(row=>row.code==='RETRY_DATASHEET_CHECK');assert.ok(retry.priorSources.includes(pdfUrl));assert.equal(retry.reuseOriginal,true);assert.deepEqual(retry.requiredInputs,['manufacturerPageUrl','sourceUrl']);
  const question=plan.agentActions.items.find(row=>row.code==='ASK_TARGETED_QUESTION');assert.equal(question.missingInformation.key,'ausfuehrendeFirma');assert.equal(question.missingInformation.owner,'user');assert.equal(question.missingInformation.state,'unknown');
  assert.ok(!plan.agentActions.items.some(row=>row.code==='ASK_TARGETED_QUESTION'&&['wallThicknessMm','fireResistanceMinutes','ortDerAusfuehrung','ausfuehrungsdatum','abmessung'].includes(row.target.key)));
  const proposed=await call('edoku_propose_document',{projectId:'same',jobId:job.id,metadata});assert.equal(proposed.state,'pending');assert.equal(proposed.attachmentId,null);assert.equal(proposed.productVerification.state,'matched');assert.equal(proposed.productVerification.targets[0].variantEvidence,'obo_plm_bound_dimensions');
  assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(kept.id),protectedRows[0]);assert.deepEqual(f.db.prepare('SELECT * FROM document_review_views').all(),views);assert.deepEqual(await readJson(files.geraetelisten),lists);
  const catalog=(await client.rpc('tools/list',{})).result.tools;assert.equal(catalog.length,58);assert.ok(!catalog.some(row=>/approve|freigeben/i.test(row.name)));
 }finally{await client.close();await f.cleanup();}
});

test('Privater Wiederholungstest des unveränderten OBO-Originaldownloads', {skip:!process.env.EDOKU_OBO_TEST_PDF},async()=>{
 const bytes=await fs.readFile(process.env.EDOKU_OBO_TEST_PDF);assert.equal(require('crypto').createHash('sha256').update(bytes).digest('hex'),'75ff75f8f901640af43f3dfda3c2403b53cbb18799f69390fe1c06d754d1c044');
 const parsed=await extractPdf(process.env.EDOKU_OBO_TEST_PDF);const result=check(parsed.pages,parsed);assert.equal(result.state,'matched');assert.equal(result.targets[0].variantEvidence,'obo_plm_bound_dimensions');
});
