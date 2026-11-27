const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {PDFDocument}=require('pdf-lib');
const {projectPageHtml,pdfLinks,linkedPdf,pageEvidence}=require('../services/manufacturerPageService');
const {aliasFor,trustedPage}=require('../services/manufacturerSourcePolicy');
const {matchDocument}=require('../services/productDocumentMatchingService');
const material=require('../services/documentationMaterialPolicy');
const {classify}=require('../services/workflowBlockerService');
const {retryAfterPolicyChange,POLICY}=require('../services/productDocumentVerificationService');
const page='https://de.mersen.com/de/products/example',pdf='https://de.mersen.com/files/example.pdf';
test('Unquoted published anchors: exact links, first duplicate wins, no attribute/script spoofing',()=>{
 const html=`<h1>ART-100</h1><a target=_blank href=/files/example.pdf>Produktdatenblatt</a>`;
 assert.equal(pdfLinks(html,page)[0].sourceUrl,pdf);assert.equal(linkedPdf(html,page,pdf).linked,true);
 assert.equal(pdfLinks(`<a href=/wrong.pdf href=${pdf}>Datenblatt</a>`,page)[0].sourceUrl,'https://de.mersen.com/wrong.pdf');
 for(const bad of [`<script><a href=${pdf}>Datenblatt</a></script>`,`<a data-href=${pdf}>Datenblatt</a>`,`<a href=javascript:alert(1)>Datenblatt</a>`])assert.equal(pdfLinks(bad,page).length,0);
 assert.equal(linkedPdf(`<a href=/wrong.pdf title='href=${pdf}'>Datenblatt</a>`,page,pdf).linked,false);
 assert.equal(pdfLinks(`<a title='A > B' href=${pdf}>Datenblatt</a>`,page)[0].sourceUrl,pdf);
});
test('Evidence projection removes presentation bytes, retains exact product evidence and only legitimate links',()=>{
 const html=`<main><nav>${'N'.repeat(900000)}<a href=/fake.pdf>Falsch</a></nav><h1>ART-100</h1><div data-view-model='${'x'.repeat(900000)}'><a href=${pdf}>Datenblatt</a></div><div id=leafletProductContainer data-mage-init='{"leafletProduct":{"ajaxUrl":"/de/leafletproduct/catalog/leafletproduct/product_id/1/"}}'></div><tr><td class='cart-variant__articlenumber decoration'><span class=cart-variant__external-id>12345678</span></td></tr></main>`;
 const out=projectPageHtml(html);assert.ok(Buffer.byteLength(out)<2048);assert.match(out,/ART-100/);assert.match(out,/leafletProductContainer/);assert.match(out,/cart-variant__external-id/);assert.equal(pdfLinks(out,page).length,1);assert.equal(linkedPdf(out,page,'https://de.mersen.com/fake.pdf').linked,false);
});
test('PDF.js wrapper: exact observed same-origin original only, no arbitrary viewer/file execution',()=>{
 const base='https://www.striebelundjohn.com/produkte/example',original='https://www.striebelundjohn.com/voltimum_product_catalog/pdf/123?name=example.pdf';
 const wrap=file=>`<a href="/libraries/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#zoom=page-height">PDF Download</a>`;
 assert.equal(pdfLinks(wrap(original),base)[0].sourceUrl,original);assert.equal(linkedPdf(wrap(original),base,original).linked,true);
 for(const wrong of ['https://other.example/voltimum_product_catalog/pdf/123?name=example.pdf','http://127.0.0.1/private.pdf','javascript:alert(1)','/unrelated/api?name=example.pdf'])assert.equal(pdfLinks(wrap(wrong),base).length,0);
 assert.equal(pdfLinks(wrap(original),'https://other.example/product').length,0);
 assert.equal(linkedPdf(wrap(original),base,original.replace('123','124')).linked,false);
});
test('Rittal formatting stays brand-bound and requires independent article evidence',()=>{
 assert.equal(aliasFor('Rittal','DK 7072.100'),'DK 7072100');assert.equal(aliasFor('Other','DK 7072.100'),null);
 assert.equal(aliasFor('Rittal','DK 7072.100',{Rittal:{'DK 7072.100':'EXPLICIT'}}),'EXPLICIT');
 const args={pageUrl:'https://www.rittal.com/ch-de/p?variantId=7072100',sourceUrl:'https://www.rittal.com/pdf-creator/variant/ch-de/7072100',model:'DK 7072.100',documentModel:'DK 7072100'};
 assert.equal(pageEvidence({...args,html:'<h1>Kantenschutz</h1><p>Artikel-Nr.: DK 7072100</p>'}).matched,true);
 assert.equal(pageEvidence({...args,html:'<h1>Other</h1><p>Artikel-Nr.: DK 7072101</p><a href=/accessory>DK 7072100</a>'}).matched,false);
});
test('Publisher roots are exact; broad lookalike hosts remain blocked',()=>{
 for(const [brand,url]of [['BEGA','https://www.bega.com/product'],['Sikora','https://www.sikora-notlicht.de/product'],['Siteco','https://www.siteco.de/product']]){assert.equal(trustedPage(brand,url,{}),true);assert.equal(trustedPage(brand,url.replace('.com/','.com.evil.example/').replace('.de/','.de.evil.example/'),{}),false);}
});
test('Concrete technical causes precede old generic variant flags, policy name is not variant evidence',()=>{
 assert.equal(classify({outcome:'blocked',blockerCode:'VARIANT_UNCONFIRMED',reason:'manufacturer_pdf_article_variant_v7: pdf_not_linked_by_manufacturer'}).code,'PDF_LINK_UNCONFIRMED');
 assert.equal(classify({outcome:'blocked',reason:'Artikel und Variante unbestätigt; SOURCE_HTTP_ERROR'}).code,'SOURCE_HTTP_ERROR');
 assert.equal(classify({outcome:'blocked',reason:'manufacturer_pdf_article_variant_v7 failed'}).kind,'technical');
 assert.equal(classify({outcome:'blocked',reason:'variant_not_confirmed'}).kind,'identity');
});
test('V7 resumes only supported repairs once; V8/network failures and excluded fuse research stay closed',()=>{
 const old={outcome:'blocked',verificationPolicy:'manufacturer_pdf_article_variant_v7',reason:'SOURCE_FILE_LIMIT'};
 assert.equal(retryAfterPolicyChange(old,{manufacturer:'Berker',model:'10118919'}),true);
 assert.equal(retryAfterPolicyChange({...old,verificationPolicy:POLICY},{manufacturer:'Berker',model:'10118919'}),false);
 assert.equal(retryAfterPolicyChange({...old,reason:'SOURCE_HTTP_ERROR'},{manufacturer:'Berker',model:'10118919'}),false);
 assert.equal(retryAfterPolicyChange({...old,reason:'pdf_not_linked_by_manufacturer'},{manufacturer:'MERSEN',model:'D02GG40V32'}),false);
});
test('Manual consumable scope preserves stored rows, other fuse types and unrelated legacy output',()=>{
 const row={pos:1,hersteller:'MERSEN',typ:'D02GG40V32',kategorie:material.MANUAL_CONSUMABLE_CATEGORY};
 assert.equal(material.excluded(row,{}),'manual_consumable');assert.equal(material.excluded({...row,kategorie:''},{}),null);
 const list={id:'devices',positionen:[row,{pos:2,typ:'5SE2316',beschreibung:'Schraubsicherung'},{pos:3,typ:'NYM-J 3x1,5'}]};const out=material.projectLists([list],{});
 assert.equal(list.positionen.length,3);assert.deepEqual(out[0].positionen.map(v=>v.pos),[2,3]);
 assert.throws(()=>material.assertIncluded(row,{}),{apiCode:'DOCUMENTATION_MATERIAL_EXCLUDED'});
 const fields=require('../services/geraetelistenService').deviceListFieldsForLeistungsbereich('Niederspannungsschaltanlagen / Verteilungen');assert.equal(fields.find(x=>x.name==='kategorie').guiVisible,false);
});
test('Explicit proposal storage upgrade preserves original rows and foreign keys; never migrates on dry-run',()=>{
 const Database=require('better-sqlite3'),db=new Database(':memory:'),storage=require('../services/documentProposalStorageService');
 try{
  db.pragma('foreign_keys=ON');db.exec(`CREATE TABLE documentation_jobs(id TEXT PRIMARY KEY);INSERT INTO documentation_jobs VALUES('j');CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('u');CREATE TABLE document_proposals(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES documentation_jobs(id),metadata TEXT NOT NULL CHECK(json_valid(metadata)),filename TEXT NOT NULL,mime_type TEXT NOT NULL,bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','approved','rejected')),created_at TEXT NOT NULL,decided_at TEXT,decided_by TEXT REFERENCES users(id),attachment_id TEXT,UNIQUE(job_id,sha256));CREATE TABLE document_review_views(proposal_id TEXT REFERENCES document_proposals(id));INSERT INTO document_proposals VALUES('p','j','{}','f','application/pdf',1,'hash','approved','now','now','u','a');INSERT INTO document_review_views VALUES('p');`);
  const rows=db.prepare('SELECT * FROM document_proposals').all();assert.deepEqual(storage.upgrade(db),{required:true,applied:false});assert.equal(storage.legacy(db),true);
  assert.equal(storage.upgrade(db,{apply:true}).rowsPreserved,1);assert.deepEqual(db.prepare('SELECT * FROM document_proposals').all(),rows);assert.equal(db.pragma('foreign_keys',{simple:true}),1);assert.deepEqual(db.pragma('foreign_key_check'),[]);assert.equal(storage.upgrade(db,{apply:true}).applied,false);
  assert.throws(()=>db.prepare('INSERT INTO document_proposals SELECT ?,job_id,metadata,filename,mime_type,bytes,sha256,state,created_at,decided_at,decided_by,attachment_id FROM document_proposals WHERE id=?').run('other','p'));
 }finally{db.close();}
});
test('API/MCP: corrected destination after withdrawal creates separate pending proposal and fresh viewing obligation',async()=>{
 const {fixture,mcpClient}=require('./helpers/integrationFixture'),{scopes}=require('../src/api/schemas'),{writeJson}=require('../services/jsonService'),{dataFilesForProject}=require('../services/projectArchiveService');
 const f=await fixture({setup:async({root})=>{const files=dataFilesForProject(root,'alice','same');await writeJson(files.leistungsbereiche,{aktiv:['Elektroinstallation / DIN VDE 0100'],optionen:['Elektroinstallation / DIN VDE 0100']});await writeJson(files.geraetelisten,[{id:'devices',aktiv:true,leistungsbereich:'Elektroinstallation / DIN VDE 0100',positionen:[{pos:1,hersteller:'Testhersteller',typ:'A1'},{pos:2,hersteller:'Testhersteller',typ:'A1'}]}]);}});
 const service=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification}),client=mcpClient(f.base,f.makeToken('alice',{scopes}).token,true);
 try{
  const job=service.create('alice','same',{instruction:'Synthetic withdrawal re-submission preservation test'}),p=await PDFDocument.create();p.addPage();const bytes=Buffer.from(await p.save());
  const ref=pos=>({listId:'devices',position:pos,manufacturer:'Testhersteller',model:'A1'}),metadata={title:'Synthetic original',category:'Datenblätter',sourceLabel:'Synthetic publisher',reason:'Synthetic source test',deviceReferences:[ref(1)]};
  const first=await service.propose('alice',job.id,metadata,{buffer:bytes,originalName:'example.pdf'});
  await service.content('alice',job.id,first.id);service.viewed('alice',job.id,first.id,first.sha256);
  service.withdrawProposals('alice',job.id,{version:service.get('alice',job.id).version,proposalIds:[first.id],reason:'Wrong destination in synthetic test',evidence:{sourceLabel:'Test user',sourceQuote:'Withdraw the wrong destination; retain the original.'}});
  const original=f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(first.id);
  assert.equal((await service.propose('alice',job.id,metadata,{buffer:bytes,originalName:'same.pdf'})).state,'withdrawn');
  await assert.rejects(service.propose('alice',job.id,{...metadata,title:'Other label'},{buffer:bytes,originalName:'same.pdf'}),{apiCode:'PROPOSAL_CONFLICT'});
  await assert.rejects(service.propose('alice',job.id,{...metadata,deviceReferences:[{...ref(1),variant:''}]},{buffer:bytes,originalName:'same.pdf'}),{apiCode:'PROPOSAL_CONFLICT'});
  const fixed={...metadata,deviceReferences:[ref(2)]};await assert.rejects(service.propose('alice',job.id,fixed,{buffer:bytes,originalName:'same.pdf'}),{apiCode:'PRECONDITION_REQUIRED'});
  const next=await service.propose('alice',job.id,{...fixed,expectedJobVersion:service.get('alice',job.id).version},{buffer:bytes,originalName:'same.pdf'});
  assert.notEqual(next.id,first.id);assert.equal(next.state,'pending');assert.equal(next.attachmentId,null);assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(first.id),original);
  await assert.rejects(service.approve('alice',job.id,next.id,{reviewed:'on',sha256:next.sha256}),{apiCode:'REVIEW_REQUIRED'});
  await client.initialize();const read=(await client.rpc('tools/call',{name:'edoku_get_documentation_job',arguments:{projectId:'same',jobId:job.id,section:'documents',entryId:next.id,limit:1}})).result;assert.ok(!read.isError,JSON.stringify(read));
 }finally{await client.close();await f.cleanup();}
});
test('API/MCP: explicit consumable category works in distribution lists, suppresses new research and preserves position',async()=>{
 const {fixture,mcpClient}=require('./helpers/integrationFixture'),{scopes}=require('../src/api/schemas'),{writeJson,readJson}=require('../services/jsonService'),{dataFilesForProject}=require('../services/projectArchiveService');
 const area='Niederspannungsschaltanlagen / Verteilungen',f=await fixture({setup:async({root})=>{const files=dataFilesForProject(root,'alice','same');await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});await writeJson(files.geraetelisten,[{id:'devices',aktiv:true,leistungsbereich:area,positionen:[{pos:1,hersteller:'MERSEN',typ:'D02GG40V32',system:'Test'},{pos:2,hersteller:'Siemens',typ:'5SE2316',system:'Test'}]}]);}});
 const token=f.makeToken('alice',{scopes}).token,client=mcpClient(f.base,token,true),service=require('../services/documentAssistantService').createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
 try{
  const job=service.create('alice','same',{instruction:'Synthetic explicit material scope test'});await client.initialize();
  const response=await f.request('/projects/same/device-lists/devices',{token});assert.equal(response.status,200);
  const result=(await client.rpc('tools/call',{name:'edoku_patch_device_position',arguments:{projectId:'same',listId:'devices',position:1,etag:response.etag,changes:{kategorie:material.MANUAL_CONSUMABLE_CATEGORY}}})).result;assert.ok(!result.isError,JSON.stringify(result));
  const saved=await readJson(dataFilesForProject(f.root,'alice','same').geraetelisten);assert.equal(saved[0].positionen.length,2);assert.equal(saved[0].positionen[0].typ,'D02GG40V32');
  const coverage=await require('../services/datasheetCoverageService').createDatasheetCoverageService(f.root).inspect('alice','same');assert.equal(coverage.summary.articles,1);assert.equal(coverage.exclusions[0].reason,'manual_consumable');
  assert.equal(material.excludedRequirement({projekt:{},geraetelisten:saved},{category:'Datenblätter',device:{listId:'devices',position:1}}),true);
  let called=false;const discovery=await require('../services/manufacturerLinkService').createManufacturerLinkService(f.root,{sourceLoader:async()=>{called=true;throw Error();}}).inspect('alice','same',job.id,{listId:'devices',position:1,manufacturerPageUrl:'https://www.mersen.com/example'});assert.equal(discovery.state,'excluded');assert.equal(called,false);
  const p=await PDFDocument.create();p.addPage();await assert.rejects(service.propose('alice',job.id,{title:'Excluded original',category:'Datenblätter',reason:'Synthetic test source',sourceLabel:'Synthetic',deviceReferences:[{listId:'devices',position:1,manufacturer:'MERSEN',model:'D02GG40V32'}]},{buffer:Buffer.from(await p.save()),originalName:'fake.pdf'}),{apiCode:'DOCUMENTATION_MATERIAL_EXCLUDED'});
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
 }finally{await client.close();await f.cleanup();}
});
