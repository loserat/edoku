const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {PDFDocument}=require('pdf-lib');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {hasIdentifier,variantFound,matchDocument,labeledIds,primaryArticle}=require('../services/productDocumentMatchingService');
const {trustedPage}=require('../services/manufacturerSourcePolicy');
const {pageContent,linkedPdf,extractPdf}=require('../services/productDocumentVerificationService');
const {pageEvidence,productFragment,systemManualEvidence}=require('../services/manufacturerPageService');
const {createDocumentAssistantService}=require('../services/documentAssistantService');
const {readJson,writeJson}=require('../services/jsonService');
const {dataFilesForProject}=require('../services/projectArchiveService');
const store=require('../services/projectDataStoreService');
const {scopes}=require('../src/api/schemas');
const area='Elektroinstallation / DIN VDE 0100';
const target={listId:'devices',position:1,manufacturer:'Testhersteller',model:'ART-100',variant:'weiß'};
const matching=(text,t=target)=>matchDocument({pages:[{page:1,text}],totalPages:1,targets:[t]});

test('Brandschutz-Systemanleitung: Herstellerdomain, System und Komponente bleiben exakt gebunden',()=>{
 assert.ok(trustedPage('ZAPP-ZIMMERMANN','https://z-z.de/brandschutzsysteme/'));
 assert.ok(trustedPage('ZAPP-ZIMMERMANN GmbH','https://www.z-z.de/produkt'));
 for(const url of ['http://z-z.de/','https://z-z.de.attacker.example/','https://z-z.eu/','https://other.example/'])assert.ok(!trustedPage('ZAPP-ZIMMERMANN',url));
 assert.ok(!trustedPage('ZZ','https://z-z.de/'));
 const args={html:'<h1>ZZ® M21-S90</h1><h2>Systemkomponenten</h2><p>ZZ® 217 Brandschutzstein</p><p>ZZ® 330 Brandschutzschaum</p><h2>Downloads</h2><a href="/manual.pdf">ZZ® M21-S90 Montageanleitung</a>',pageUrl:'https://z-z.de/system',sourceUrl:'https://z-z.de/manual.pdf',model:'ZZ 330'};
 assert.ok(systemManualEvidence(args));
 assert.equal(systemManualEvidence({...args,model:'ZZ 3300'}),null);
 assert.equal(systemManualEvidence({...args,html:args.html.replace('Systemkomponenten','Zubehör')}),null);
 assert.equal(systemManualEvidence({...args,html:args.html.replace('M21-S90 Montageanleitung','M20-S90 Montageanleitung')}),null);
 assert.equal(systemManualEvidence({...args,sourceUrl:'https://z-z.de/unlinked.pdf'}),null);
 const t={...target,manufacturer:'ZAPP-ZIMMERMANN',model:'ZZ 330',variant:'',...systemManualEvidence(args)};
 const cover={page:1,text:'Montageanleitung ZZ M21-S90'},component={page:2,text:'Systemkomponenten\nZZ 217 Brandschutzstein\nZZ 330 Brandschutzschaum'},publisher={page:3,text:'ZAPP-ZIMMERMANN GmbH'};
 const check=(pages,extra={})=>matchDocument({pages,targets:[t],manual:true,sourceLinked:true,...extra});
 assert.equal(check([cover,component,publisher]).state,'matched');
 assert.equal(check([cover,component,publisher]).targets[0].via,'manufacturer_system_manual_link');
 assert.equal(check([{...cover,text:'Montageanleitung ZZ M20-S90'},component,publisher]).state,'unclear');
 assert.equal(check([cover,{...component,text:component.text.replace('ZZ 330','ZZ 3300')},publisher]).state,'unclear');
 assert.equal(check([cover,component,publisher],{manual:false}).state,'unclear');
 assert.equal(check([cover,component,publisher],{sourceLinked:false}).state,'unclear');
 assert.equal(check([cover,component]).state,'unclear');
 assert.equal(check([cover,component,publisher],{targets:[{...t,variant:'schwarz'}]}).state,'unclear');
});

test('Herstellerlayouts: HTML-base, echte Download-Komponenten und gebundene Produktfragmente',()=>{
 assert.ok(linkedPdf('<base href="https://www.wiska.com/"><a href="de/pdf/10060400/COMBI-308-LG.pdf">Datenblatt</a>','https://www.wiska.com/de/143/pde/10060400/combi-308-lg.html','https://www.wiska.com/de/pdf/10060400/COMBI-308-LG.pdf').linked);
 const w='<warema-download-list-item download-link="https://media.warema.com/manual.pdf">Bedienungs- und Installationsanleitung</warema-download-list-item>';
 assert.match(linkedPdf(w,'https://smartbuildings.warema.com/produkt','https://media.warema.com/manual.pdf').label,/Installationsanleitung/);
 assert.ok(!linkedPdf('<script><a href="/fake.pdf">Datenblatt</a></script>','https://manufacturer.example/','https://manufacturer.example/fake.pdf').linked);
 assert.ok(!linkedPdf('<script><a href="/fake.pdf">Datenblatt</a>','https://manufacturer.example/','https://manufacturer.example/fake.pdf').linked);
 assert.ok(linkedPdf('<a href="/catalog.download?uri=%2Fp%2F33291201.pdf&amp;file=33291201.pdf">Datenblatt</a>','https://www.spelsberg.de/catalog/33291201/','https://www.spelsberg.de/p/33291201.pdf').linked);
 assert.ok(!linkedPdf('<a href="/catalog.download?uri=https://attacker.example/fake.pdf&amp;file=fake.pdf">Datenblatt</a>','https://www.spelsberg.de/catalog/33291201/','https://attacker.example/fake.pdf').linked);
 const html='<div id="leafletProductContainer" data-mage-init=\'{"leafletProduct":{"ajaxUrl":"https://products.niedax.de/niedax_de/leafletproduct/catalog/leafletproduct/product_id/92092/"}}\'>';
 assert.equal(productFragment(html,'https://products.niedax.de/niedax_de/shs-15.html'),'https://products.niedax.de/niedax_de/leafletproduct/catalog/leafletproduct/product_id/92092/');
 assert.equal(productFragment(html.replace('products.niedax.de','attacker.example'),'https://products.niedax.de/niedax_de/shs-15.html'),null);
});

test('Produktidentität: Titel oder exakt gewählter Artikeldownload, niemals Zubehör auf fremder Seite',()=>{
 const check=(html,pageUrl='https://manufacturer.example/ART-100',sourceUrl='https://manufacturer.example/ART-100.pdf')=>pageEvidence({html,pageUrl,sourceUrl,model:'ART-100'}).matched;
 assert.ok(check('<h1>ART-100</h1><p>Artikelnummer 123456</p>'));
 assert.ok(check('<h1>Baureihe</h1><div class="active table-product-item"><div class="cms-col-ds-orderno">ART-100</div></div>'));
 assert.ok(!check('<h1>ART-200</h1><p>Art.-Nr. ART-200</p><p>Zubehör Art.-Nr. ART-100</p>'));
 assert.ok(!check('<h1>ART-200</h1><p>Art.-Nr. ART-200</p><p>Zubehör Art.-Nr. ART-100</p>','https://manufacturer.example/ART-200'));
 assert.ok(!check('<h1>Baureihe</h1><p>Art.-Nr. ART-1000</p>'));
 assert.ok(trustedPage('OBO Bettermann','https://www.obo.de/produkt'));
 assert.ok(!trustedPage('OBO Andere','https://www.obo.de/produkt'));
 assert.ok(trustedPage('KAISER','https://www.kaisergroup.com/produkt'));
 assert.ok(trustedPage('Walther','https://www.walther-electric.de/produkt'));
});

test('Globale Variante nur in eindeutigem Einartikeldatenblatt, nicht aus anderer Tabellenzeile',()=>{
 const one='Testhersteller\nFarbe weiß\nItem number   GTIN\nART-100   4015120431883';
 assert.equal(matching(one).state,'matched');
 const two=one+'\nART-200   4015120431884';
 assert.equal(matching(two).state,'unclear');
 assert.ok(variantFound('Höhe H x Breite B : 60 x 300 mm','Höhe 60 mm, Breite 300 mm'));
 assert.ok(!variantFound('Höhe H x Breite B : 300 x 60 mm','Höhe 60 mm, Breite 300 mm'));
 assert.ok(variantFound('Dimension 70x130x2000 mm','70 × 130 mm'));
 assert.ok(!variantFound('Dimension 70x130x2000 mm','130 × 70 mm'));
 assert.ok(!variantFound('Dimension 60x62x2000 mm','60 × 60 mm'));
 const pipe='Fränkische\nArt-Nr.:   Type   Innen Ø Außen Ø Inhalt VPE\nmm   mm\n222 10 025 25   21,7   25,0   57 m\n222 10 032 32   28,6   32,0   57 m';
 const pt={...target,manufacturer:'Fränkische',model:'FPKu-EM-F 32',documentModel:'22210032',variant:'32,0 × 28,6 mm'};
 assert.equal(matchDocument({pages:[{page:1,text:pipe}],targets:[pt]}).state,'matched');
 assert.equal(matchDocument({pages:[{page:1,text:pipe}],targets:[{...pt,variant:'32,0 × 21,7 mm'}]}).state,'unclear');
 const heading={...target,pageArticleConfirmed:true};
 assert.equal(matchDocument({pages:[{page:1,text:'Testhersteller\nART-100\nFarbe white'}],targets:[heading],sourceLinked:true}).state,'matched');
 assert.equal(matchDocument({pages:[{page:1,text:'Testhersteller\nART-1000\nFarbe white'}],targets:[heading],sourceLinked:true}).state,'unclear');
 assert.equal(matchDocument({pages:[{page:1,text:'Testhersteller\nART-100\nFarbe white'}],targets:[target],sourceLinked:true}).state,'unclear');
 assert.equal(matchDocument({pages:[{page:1,text:'Testhersteller\nART-100\nFarbe black\nArt.-Nr. ART-200\nFarbe white'}],targets:[heading],sourceLinked:true}).state,'unclear');
 const column='Testhersteller\nArtikelnummer: 123456\nStammdaten\nArtikelnummer\nTyp\nFarbe\n123456\nART-100\nwhite';
 assert.equal(matching(column).state,'matched');
 assert.equal(matching(column.replace('\nART-100\n','\nART-200\n')).state,'unclear');
 assert.equal(matching(column.replace('Artikelnummer: 123456','Artikelnummer: 123457')).state,'unclear');
 const dimensions='Artikelnummer: 123456\nAbmessungen\nLänge\nBreite\nHöhe\n2.000 mm\n130 mm\n70 mm';
 const measure=extra=>matchDocument({pages:[{page:1,text:column},{page:2,text:extra}],targets:[{...target,variant:'70 × 130 mm'}]});
 assert.equal(measure(dimensions).state,'matched');
 assert.equal(measure(dimensions.replace('123456','123457')).state,'unclear');
});

test('Artikelnummern und Varianten: keine Teiltreffer oder benachbarten Tabellenvarianten',()=>{
 assert.ok(hasIdentifier('Art.-Nr. 11962','11962'));
 assert.ok(!hasIdentifier('Art.-Nr. 119620','11962'));
 assert.ok(!hasIdentifier('31 Seiten / 230 V','31x'));
 assert.equal(matching('Testhersteller\nArt.-Nr. ART-100\nFarbe white').state,'matched');
 assert.equal(matching('Testhersteller\nArtikel ART-100\nweiß').state,'unclear');
 assert.equal(matching('Testhersteller\nArt.-Nr. ART-1000\nweiß').state,'unclear');
 assert.equal(matching('Fremdhersteller\nArt.-Nr. ART-100\nweiß').state,'unclear');
 assert.equal(matching('Testhersteller\nArt.-Nr. ART-100\nFarbe schwarz').state,'unclear');
 assert.equal(matching('Testhersteller\nArt.-Nr. ART-200\nFarbe weiß\nArt.-Nr. ART-100\nFarbe schwarz').state,'unclear');
 assert.ok(variantFound('Kabel 1 × 16 mm²','1x16 mm²'));
 assert.ok(!variantFound('Kabel 11x16 mm²','1x16 mm²'));
 assert.ok(!variantFound('Kabel 1x160 mm²','1x16 mm²'));
 assert.ok(variantFound('Kabel 3x2.5 mm²','3x2,5 mm²'));
 assert.ok(!variantFound('Kabel 3x25 mm²','3x2,5 mm²'));
 assert.equal(matching('Testhersteller\nArt.-Nr. ART-100',{...target,variant:''}).state,'matched');
});

test('Herstellerbindung: keine fremde Domain, Produktkennung oder andere PDF-Verknüpfung',()=>{
 assert.ok(trustedPage('BALS','https://catalogue.bals.com/p/11962'));
 assert.ok(!trustedPage('BALS','https://bals.com.attacker.example/p/11962'));
 assert.ok(!trustedPage('BALS','http://catalogue.bals.com/p/11962'));
 assert.ok(!trustedPage('Unbekannt','https://bals.com/p/11962'));
 const html='<script>Art.-Nr. WRONG</script><h1>Produkt</h1><p>Art.-Nr. ART-100</p><a href="/db.pdf?b=2&amp;a=1">Datenblatt</a>';
 assert.ok(!pageContent(html).includes('WRONG'));
 assert.ok(linkedPdf(html,'https://manufacturer.example/p/1','https://manufacturer.example/db.pdf?a=1&b=2&attachment=true').linked);
 assert.ok(!linkedPdf(html,'https://manufacturer.example/p/1','https://manufacturer.example/other.pdf').linked);
});

test('Reale ESYLUX-/Gira-Layouts: Spaltenköpfe, gruppierte Artikel und Herstellerbeleg über gebundene GTIN',()=>{
 assert.ok(trustedPage('ESYLUX','https://www.esylux.de/produkte/controller'));
 assert.ok(!trustedPage('ESYLUX','https://esylux.de.attacker.example/produkt'));
 assert.ok(hasIdentifier('Art.-Nr. 0211 03','021103'));
 assert.ok(!hasIdentifier('Art.-Nr. 0211 030','021103'));
 assert.ok(!hasIdentifier('Art.-Nr. 0211\n03','021103'));
 assert.equal(primaryArticle('Art.-Nr.\nEUR/Stück o. MwSt.\nArt.-Nr. 0211 03\nArt.-Nr. 0212 03').text,'0211 03');
 assert.equal(primaryArticle('Art.-Nr. 0212 03\nArt.-Nr. 0211 03').text,'0212 03');
 assert.equal(primaryArticle('Typ: NYM-J').text,'NYM-J');
 const text='DATA SHEET\nSMARTCONTROLLER APC20 PS DALI-2\nItem number   GTIN\nEC10431883   4015120431883\nProduct description';
 assert.ok(hasIdentifier(labeledIds(text)[0].text,'EC10431883'));
 const t={listId:'devices',position:1,manufacturer:'ESYLUX',model:'EC10431883',variant:'',sourceGtins:['4015120431883']};
 const check=(value=t,extra={})=>matchDocument({pages:[{page:1,text}],totalPages:1,targets:[value],sourceLinked:true,...extra});
 assert.equal(check().state,'matched');assert.equal(check().targets[0].manufacturerEvidence,'manufacturer_product_gtin');
 assert.equal(check({...t,sourceGtins:['4015120431884']}).state,'unclear');
 assert.equal(check({...t,model:'EC10431884'}).state,'unclear');
 assert.equal(check({...t,variant:'weiß'}).state,'unclear');
 assert.equal(check(t,{sourceLinked:false}).state,'unclear');
 assert.equal(check({...t,sourceGtins:[]}).state,'unclear');
 const table='Gira Standard 55 Reinweiß glänzend\nSpezifikation   Bestell-Nr.   VE   EUR/Stück o. MWSt.   PS   EAN\n1fach   0211 03   1/10/100   3,35   21   4010337211037\n2fach   0212 03   1/10/100   5,73   21   4010337212034';
 const gira={...t,manufacturer:'Gira',model:'021103',variant:''};
 const g=(model='021103')=>matchDocument({pages:[{page:1,text:table}],targets:[{...gira,model}]});
 assert.equal(g().state,'matched');assert.equal(g().targets[0].via,'pdf_article_table');
 assert.equal(g('0211030').state,'unclear');assert.equal(g('0211/03').state,'unclear');assert.equal(g('021203').state,'matched');
 const colors='Gira\nBestell-Nr.   Farbe\n0211 03   schwarz\n0212 03   weiß';
 assert.equal(matchDocument({pages:[{page:1,text:colors}],targets:[{...gira,variant:'weiß'}]}).state,'unclear');
});

async function pdfBytes(lines){const pdf=await PDFDocument.create(),page=pdf.addPage();lines.forEach((s,i)=>page.drawText(s,{x:25,y:780-i*22,size:11}));return Buffer.from(await pdf.save());}
async function preparedFixture(){
 const f=await fixture({productChecks:true,setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');
  await writeJson(files.geraetelisten,[{id:'devices',leistungsbereich:area,aktiv:true,export:true,positionen:[{pos:1,hersteller:'Testhersteller',typ:'ART-100',farbe:'weiß',custom:'erhalten'},{pos:2,hersteller:'Testhersteller',typ:'ART-100',farbe:'weiß'}]}]);
  await writeJson(files.leistungsbereiche,{aktiv:[area],optionen:[area]});
  await writeJson(path.join(root,'config/manufacturerSources.json'),{testhersteller:['manufacturer.example']});
 }});
 const key=f.makeToken('alice',{scopes}),request=(url,opts={})=>f.request(url,{token:key.token,...opts});
 const sources={},dir=path.join(f.root,'synthetic-products');await fs.mkdir(dir);
 async function source(name,{pageCode='ART-100',pdfCode='ART-100',color='white',brand='Testhersteller',manual=false,linked=true,blank=false}={}){
  const pageUrl=`https://manufacturer.example/p/${name}`,sourceUrl=`https://manufacturer.example/${name}.pdf`;
  const html=`<h1>${brand} Produkt</h1><p>Art.-Nr. ${pageCode}</p><p>Farbe ${color}</p><a href="${linked?sourceUrl:sourceUrl+'.other'}">${manual?'Montageanleitung':'Datenblatt'}</a>`;
  const bytes=await pdfBytes(blank?[]:[brand,manual?'Installation instructions':'Technical datasheet',...(pdfCode?[`Art.-Nr. ${pdfCode}`]:[]),`Farbe ${color}`]);
  await fs.writeFile(path.join(dir,name+'.html'),html);await fs.writeFile(path.join(dir,name+'.pdf'),bytes);
  sources[pageUrl]='synthetic-products/'+name+'.html';sources[sourceUrl]='synthetic-products/'+name+'.pdf';await writeJson(path.join(f.root,'product-source-fixture.json'),sources);
  return {manufacturerPageUrl:pageUrl,sourceUrl,bytes};
 }
 const job=(await request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Nur künstliche Herstellerbelege zur Prüfung vorschlagen.',requirements:[{id:'sheet',title:'Datenblatt',category:'Datenblätter',device:target}]}})).data.data;
 const url='/projects/same/assistant/jobs/'+job.id+'/manufacturer-documents';
 const meta=(s,extra={})=>({title:'Künstliches Herstellerdatenblatt',category:'Datenblätter',sourceLabel:'Künstlicher Hersteller',reason:'Artikel und Variante gezielt abgleichen.',manufacturerPageUrl:s.manufacturerPageUrl,sourceUrl:s.sourceUrl,deviceReferences:[target],...extra});
 return {...f,key,request,source,job,url,meta};
}

test('Echte PDF-Extraktion und API: prüfen, Cache nutzen, nur Vorschlag; GUI-Sichtung bleibt Pflicht',async()=>{
 const f=await preparedFixture();
 try{
  const s=await f.source('exact'),before=store.projectDataRevision(f.root,'alice','same');
  const check=await f.request(f.url,{method:'POST',body:{mode:'check',metadata:f.meta(s)}});
  assert.equal(check.status,200,JSON.stringify(check.data));assert.equal(check.data.data.state,'matched');
  assert.equal(check.data.data.proposalCreated,false);assert.equal(check.data.data.verification.cacheHit,false);
  assert.equal(check.data.data.verification.fullTextReturned,false);assert.ok(!JSON.stringify(check.data).includes('Technical datasheet'));
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
  assert.equal(store.projectDataRevision(f.root,'alice','same'),before);
  const create=await f.request(f.url,{method:'POST',body:{metadata:f.meta(s)}});
  assert.equal(create.status,201,JSON.stringify(create.data));const proposal=create.data.data;
  assert.equal(proposal.state,'pending');assert.equal(proposal.productVerification.cacheHit,true);
  assert.equal(proposal.productVerification.targets[0].variantMatched,true);
  const read=await f.request('/projects/same/assistant/jobs/'+f.job.id);assert.equal(read.status,200);
  const form=new FormData();form.set('metadata',JSON.stringify(f.meta(s)));form.set('file',new Blob([s.bytes]),'manufacturer.pdf');
  const multipart=await fetch(f.base+'/api/v1/projects/same/assistant/jobs/'+f.job.id+'/documents',{method:'POST',headers:{Authorization:'Bearer '+f.key.token},body:form});
  const multipartData=await multipart.json();assert.equal(multipart.status,201,JSON.stringify(multipartData));
  assert.equal(multipartData.data.id,proposal.id);const output=require('../src/api/responses');assert.ok(output.envelope(output.proposal).safeParse(multipartData).success);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
  assert.equal((await readJson(dataFilesForProject(f.root,'alice','same').anhaenge)).length,0);
  assert.equal(store.projectDataRevision(f.root,'alice','same'),before);
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const approval={reviewed:'on',sha256:proposal.sha256,revision:before,metadata:{title:proposal.title,category:proposal.category}};
  await assert.rejects(service.approve('alice',f.job.id,proposal.id,approval),e=>e.apiCode==='REVIEW_REQUIRED');
  // Only this synthetic user opens/confirms the file, using the real manual review path.
  await service.content('alice',f.job.id,proposal.id);service.viewed('alice',f.job.id,proposal.id,proposal.sha256);
  await service.approve('alice',f.job.id,proposal.id,approval);
  const attachments=await readJson(dataFilesForProject(f.root,'alice','same').anhaenge);
  assert.equal(attachments.length,1);assert.equal(service.get('alice',f.job.id).documents[0].state,'approved');
  const lists=await readJson(dataFilesForProject(f.root,'alice','same').geraetelisten);
  assert.equal(lists[0].positionen[0].custom,'erhalten');assert.ok(lists[0].positionen[0].datenblattId);
 }finally{await f.cleanup();}
});

test('Verbindlicher Schutz: unklare Quellen, Artikel, Varianten und gefälschte Nachweise erzeugen keinen Vorschlag',async()=>{
 const f=await preparedFixture();
 try{
  const before=store.projectDataRevision(f.root,'alice','same');
  for(const [name,opts,reason] of [
   ['wrong-page',{pageCode:'ART-200'},'manufacturer_page_article_not_confirmed'],
   ['not-linked',{linked:false},'pdf_not_linked_by_manufacturer'],
   ['wrong-article',{pdfCode:'ART-1000'},null],
   ['wrong-variant',{color:'black'},null],
   ['wrong-brand',{brand:'Fremdhersteller'},null],
   ['blank',{blank:true},'pdf_text_unreadable']
  ]){
   const s=await f.source(name,opts),r=await f.request(f.url,{method:'POST',body:{metadata:f.meta(s)}});
   assert.equal(r.status,422,name+JSON.stringify(r.data));assert.equal(r.data.error.code,'PRODUCT_DOCUMENT_UNCONFIRMED');
   assert.equal(r.data.error.verification.state,'unclear');if(reason)assert.equal(r.data.error.verification.reason,reason);
  }
  const good=await f.source('good'),forged=await f.request(f.url,{method:'POST',body:{metadata:f.meta(good,{productVerification:{state:'matched'}})}});
  assert.equal(forged.status,400);
  const missing=await f.request(f.url,{method:'POST',body:{metadata:f.meta(good,{manufacturerPageUrl:undefined})}});
  assert.equal(missing.status,422);assert.equal(missing.data.error.verification.reason,'manufacturer_page_and_pdf_url_required');
  const unknown=await f.request(f.url,{method:'POST',body:{metadata:f.meta(good,{manufacturerPageUrl:'https://attacker.example/product'})}});
  assert.equal(unknown.status,422);assert.equal(unknown.data.error.verification.reason,'manufacturer_source_unconfirmed');
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  await assert.rejects(service.propose('alice',f.job.id,f.meta(good),{buffer:await pdfBytes(['Other bytes']),originalName:'different.pdf'}),e=>e.apiCode==='PRODUCT_DOCUMENT_UNCONFIRMED'&&e.verification.reason==='uploaded_file_differs_from_manufacturer');
  await assert.rejects(service.propose('alice',f.job.id,f.meta(good,{sourceUrl:undefined,manufacturerPageUrl:undefined}),{buffer:good.bytes,originalName:'unchecked.pdf'}),e=>e.apiCode==='PRODUCT_DOCUMENT_UNCONFIRMED');
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
  assert.equal(store.projectDataRevision(f.root,'alice','same'),before);
 }finally{await f.cleanup();}
});

test('Anleitung: konkrete Herstellerverknüpfung plus Anleitungsinhalt; keine beliebige Baureihen-PDF',async()=>{
 const f=await preparedFixture();
 try{
  const manual=await f.source('manual',{manual:true,pdfCode:''});
  const check=await f.request(f.url,{method:'POST',body:{mode:'check',metadata:f.meta(manual,{category:'Bedienungsanleitungen'})}});
  assert.equal(check.data.data.state,'matched',JSON.stringify(check.data));
  assert.equal(check.data.data.verification.targets[0].via,'manufacturer_product_manual_link');
  const sheet=await f.source('not-a-manual');
  const check2=await f.request(f.url,{method:'POST',body:{metadata:f.meta(sheet,{category:'Bedienungsanleitungen'})}});
  assert.equal(check2.status,422);assert.equal(check2.data.error.verification.reason,'manual_link_not_confirmed');
  // A link named "Montageanleitung" alone cannot turn a datasheet into a manual.
  await fs.writeFile(path.join(f.root,'synthetic-products/not-a-manual.html'),'<h1>Produkt</h1><p>Art.-Nr. ART-100</p><a href="'+sheet.sourceUrl+'">Montageanleitung</a>');
  const check3=await f.request(f.url,{method:'POST',body:{metadata:f.meta(sheet,{category:'Bedienungsanleitungen'})}});
  assert.equal(check3.status,422);assert.equal(check3.data.error.verification.reason,'manual_content_not_confirmed');
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
 }finally{await f.cleanup();}
});

test('MCP: ohne lokalen Dateipfad prüfen/vorschlagen, kompakte Befunde und keine Agentenfreigabe',async()=>{
 const f=await preparedFixture(),client=mcpClient(f.base,f.key.token,true);
 try{
  await client.initialize();const tools=(await client.rpc('tools/list',{})).result.tools;
  assert.equal(tools.length,55);assert.ok(!tools.some(t=>/approve/.test(t.name)));
  const t=tools.find(t=>t.name==='edoku_propose_document');assert.ok(t.inputSchema.properties.mode);assert.ok(t.inputSchema.properties.metadata.properties.manufacturerPageUrl);
  const s=await f.source('mcp'),args={projectId:'same',jobId:f.job.id,mode:'check',metadata:f.meta(s)};
  const call=async a=>(await client.rpc('tools/call',{name:t.name,arguments:a})).result;
  const check=await call(args);assert.equal(check.isError,undefined,JSON.stringify(check));assert.equal(check.structuredContent.data.state,'matched');
  assert.equal(check.structuredContent.data.proposalCreated,false);assert.ok(JSON.stringify(check).length<4000);
  const proposed=await call({...args,mode:'propose'});assert.equal(proposed.structuredContent.data.state,'pending',JSON.stringify(proposed));
  assert.equal(proposed.structuredContent.data.productVerification.state,'matched');
  const bad=await f.source('mcp-bad',{color:'black'}),failure=await call({...args,metadata:f.meta(bad),mode:'propose'});
  assert.equal(failure.isError,true);assert.equal(JSON.parse(failure.content[0].text).verification.state,'unclear');
  assert.ok(JSON.stringify(failure).length<4000);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,1);
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
 }finally{await client.close();await f.cleanup();}
});

test('PDF-Auswertung bleibt begrenzt und meldet nicht lesbare Dateien sicher zurück',async()=>{
 const f=await preparedFixture();try{
  const pdf=await PDFDocument.create();for(let i=0;i<15;i++)pdf.addPage().drawText('Testhersteller Art.-Nr. ART-100');
  const file=path.join(f.root,'many.pdf');await fs.writeFile(file,await pdf.save());
  const result=await extractPdf(file);assert.equal(result.totalPages,15);assert.equal(result.pages.length,12);assert.equal(result.truncated,true);
  await fs.writeFile(file,'not a PDF');assert.equal((await extractPdf(file)).error,'PDF_TEXT_UNAVAILABLE');
 }finally{await f.cleanup();}
});

test('Prüfbeleg bleibt an Artikel, Variante und PDF-Hash gebunden; alter Cache ersetzt keine neue Prüfung',async()=>{
 const f=await preparedFixture();try{
  const s=await f.source('bound'),metadata=f.meta(s);
  const first=await f.request(f.url,{method:'POST',body:{mode:'check',metadata}});assert.equal(first.data.data.state,'matched');
  const files=dataFilesForProject(f.root,'alice','same'),lists=await readJson(files.geraetelisten);lists[0].positionen[0].farbe='schwarz';await writeJson(files.geraetelisten,lists);
  const changed=await f.request(f.url,{method:'POST',body:{mode:'check',metadata:{...metadata,deviceReferences:[{...target,variant:'schwarz'}]}}});
  assert.equal(changed.data.data.state,'unclear');assert.equal(changed.data.data.verification.cacheHit,false);
  // An unchanged former reference cannot silently select the modified device.
  assert.equal((await f.request(f.url,{method:'POST',body:{mode:'check',metadata}})).status,409);
  lists[0].positionen[0].farbe='weiß';await writeJson(files.geraetelisten,lists);
  const cache=path.join(f.root,'storage/users/alice/assistant',f.job.id,'product-checks',first.data.data.verification.sha256+'.pdf');
  await fs.writeFile(cache,'changed cached original');
  const corrupt=await f.request(f.url,{method:'POST',body:{mode:'check',metadata}});
  assert.equal(corrupt.data.data.state,'unclear');assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,0);
 }finally{await f.cleanup();}
});

test('Hersteller-Codealias ist offen ausgewiesen; gemeinsame Unterlage erhält beide Geräteinstanzen',async()=>{
 const f=await preparedFixture();try{
  const s=await f.source('ART-100-alias',{pageCode:'LEG-100',pdfCode:'LEG-100'});
  const unknownAlias=await f.request(f.url,{method:'POST',body:{metadata:f.meta(s)}});assert.equal(unknownAlias.status,422);
  await writeJson(path.join(f.root,'config/manufacturerArticleAliases.json'),{Testhersteller:{'ART-100':'LEG-100'}});
  const r=await f.request(f.url,{method:'POST',body:{metadata:f.meta(s,{deviceReferences:[target,{...target,position:2}]})}});
  assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.data.productVerification.state,'matched');
  assert.equal(r.data.data.productVerification.targets[0].documentModel,'LEG-100');
  assert.equal(r.data.data.productVerification.targets[0].via,'manufacturer_link_alias');
  assert.equal(r.data.data.deviceReferenceCount,2);assert.equal(r.data.data.productVerification.matchedTargets,2);
  assert.equal(r.data.data.state,'pending');assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
  assert.equal((await readJson(dataFilesForProject(f.root,'alice','same').geraetelisten))[0].positionen.length,2);
 }finally{await f.cleanup();}
});

test('Neue technische Einordnung bei GUI-Freigabe kann den verbindlichen Prüfer nicht umgehen',async()=>{
 const f=await preparedFixture();try{
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const doc=await service.propose('alice',f.job.id,{title:'Zunächst allgemeine Unterlage',category:'Allgemein',sourceLabel:'Künstliche Quelle',reason:'Kategorieänderung prüfen.'},{buffer:await pdfBytes(['Unchecked file']),originalName:'general.pdf'});
  await service.content('alice',f.job.id,doc.id);service.viewed('alice',f.job.id,doc.id,doc.sha256);
  await assert.rejects(service.approve('alice',f.job.id,doc.id,{reviewed:'on',sha256:doc.sha256,revision:store.projectDataRevision(f.root,'alice','same'),metadata:{title:doc.title,category:'Datenblätter',deviceReferences:[target]}}),e=>e.apiCode==='PRODUCT_DOCUMENT_UNCONFIRMED');
  assert.equal(service.get('alice',f.job.id).documents[0].state,'pending');
  assert.equal((await readJson(dataFilesForProject(f.root,'alice','same').anhaenge)).length,0);
 }finally{await f.cleanup();}
});

test('API/PDF-Worker: grafischer Hersteller mit Artikelspalte und identischer GTIN, falsche GTIN bleibt gesperrt',async()=>{
 const f=await preparedFixture();try{
  for(const [name,pageGtin,wanted]of [['gtin-good','4015120431883','matched'],['gtin-wrong','4015120431884','unclear']]){
   const source=await f.source(name);
   await fs.writeFile(path.join(f.root,'synthetic-products',name+'.html'),'<h1>Testhersteller Produkt</h1><p>Artikelnummer ART-100 GTIN '+pageGtin+'</p><a href="'+source.sourceUrl+'">Datenblatt</a>');
   await fs.writeFile(path.join(f.root,'synthetic-products',name+'.pdf'),await pdfBytes(['DATA SHEET','Farbe white','Item number   GTIN','ART-100   4015120431883']));
   const r=await f.request(f.url,{method:'POST',body:{metadata:f.meta(source)}});
   if(wanted==='matched'){assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.data.state,'pending');assert.equal(r.data.data.productVerification.targets[0].manufacturerEvidence,'manufacturer_product_gtin');}
   else{assert.equal(r.status,422);assert.equal(r.data.error.verification.state,'unclear');}
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,1);assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
 }finally{await f.cleanup();}
});

test('API/PDF-Worker: Gira-Spalten mit Tabellenkopf prüfen ausschließlich die passende Artikelzeile',async()=>{
 const f=await preparedFixture();try{
  for(const [name,color,wanted]of [['table-good','white',201],['table-wrong','black',422]]){
   const source=await f.source(name);
   await fs.writeFile(path.join(f.root,'synthetic-products',name+'.html'),'<h1>Testhersteller Produkt</h1><p>Art.-Nr.</p><p>EUR/Stück</p><p>Art.-Nr. ART-100</p><a href="'+source.sourceUrl+'">Datenblatt</a>');
   await fs.writeFile(path.join(f.root,'synthetic-products',name+'.pdf'),await pdfBytes(['Testhersteller','Spezifikation   Bestell-Nr.   Farbe','1fach   ART-100   '+color,'2fach   ART-1000   white']));
   const r=await f.request(f.url,{method:'POST',body:{metadata:f.meta(source)}});assert.equal(r.status,wanted,JSON.stringify(r.data));
   if(wanted===201)assert.equal(r.data.data.productVerification.targets[0].via,'pdf_article_table');
  }
  assert.equal(f.db.prepare('SELECT count(*) n FROM document_proposals').get().n,1);assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n,0);
 }finally{await f.cleanup();}
});


test('Brandschutz über HTTP/MCP: Systemanleitung prüfen, nur vorschlagen und erst nach synthetischer GUI-Sichtung verknüpfen',async()=>{
 const bs='Brandschutzabschottungen',ref={listId:'devices',position:1,manufacturer:'ZAPP-ZIMMERMANN',model:'ZZ 330',variant:''};
 const pageUrl='https://z-z.de/brandschutzsysteme/kombiabschottung/zz-m21-s90/',sourceUrl='https://z-z.de/media/manual.pdf';
 const f=await fixture({productChecks:true,setup:async({root})=>{
  const files=dataFilesForProject(root,'alice','same');
  await writeJson(files.geraetelisten,[{id:'devices',titel:'Brandschutzmaterial',leistungsbereich:bs,aktiv:true,export:true,kapitel:'13.1',positionen:[{pos:1,hersteller:ref.manufacturer,typ:ref.model,custom:'behalten'}]}]);
  await writeJson(files.leistungsbereiche,{aktiv:[bs],optionen:[bs]});
  await fs.mkdir(path.join(root,'synthetic-products'));
  await fs.writeFile(path.join(root,'synthetic-products/page.html'),'<h1>ZZ® M21-S90</h1><h2>Systemkomponenten</h2><p>ZZ® 217 Brandschutzstein</p><p>ZZ® 330 Brandschutzschaum</p><h2>Downloads</h2><a href="'+sourceUrl+'">ZZ® M21-S90 Montageanleitung</a>');
  const pdf=await PDFDocument.create();
  for(const lines of [['MONTAGEANLEITUNG','ZZ M21-S90'],['SYSTEMKOMPONENTEN','ZZ 217 Brandschutzstein','ZZ 330 Brandschutzschaum'],['ZAPP-ZIMMERMANN GmbH']]){
   const page=pdf.addPage();lines.forEach((s,i)=>page.drawText(s,{x:25,y:780-i*22,size:11}));
  }
  await fs.writeFile(path.join(root,'synthetic-products/manual.pdf'),await pdf.save());
  await writeJson(path.join(root,'product-source-fixture.json'),{[pageUrl]:'synthetic-products/page.html',[sourceUrl]:'synthetic-products/manual.pdf'});
 }});
 const key=f.makeToken('alice',{scopes}),client=mcpClient(f.base,key.token,true),request=(url,opts={})=>f.request(url,{token:key.token,...opts});
 try{
  const job=(await request('/projects/same/assistant/jobs',{method:'POST',body:{instruction:'Nur synthetische Montageanleitung prüfen.',requirements:[{id:'manual',title:'Montageanleitung ZZ M21-S90',category:'Bedienungsanleitungen'}]}})).data.data;
  const files=dataFilesForProject(f.root,'alice','same'),before=store.projectDataRevision(f.root,'alice','same');
  const meta={title:'ZZ M21-S90 Montageanleitung',category:'Bedienungsanleitungen',sourceLabel:'Synthetischer Herstellerbeleg',reason:'Exakte System- und Komponentenprüfung',manufacturerPageUrl:pageUrl,sourceUrl,requirementIds:['manual'],deviceReferences:[ref]};
  const endpoint='/projects/same/assistant/jobs/'+job.id+'/manufacturer-documents';
  const notASheet=await request(endpoint,{method:'POST',body:{metadata:{...meta,category:'Datenblätter',requirementIds:[]}}});
  assert.equal(notASheet.status,422);assert.equal(notASheet.data.error.verification.reason,'manufacturer_page_article_not_confirmed');
  await client.initialize();
  const entry=(await client.rpc('tools/call',{name:'edoku_next_action',arguments:{projectId:'same',jobId:job.id,limit:1}})).result;
  assert.ok(!entry.isError);
  const result=(await client.rpc('tools/call',{name:'edoku_propose_document',arguments:{projectId:'same',jobId:job.id,metadata:meta}})).result;
  assert.ok(!result.isError,JSON.stringify(result));const doc=result.structuredContent.data;
  assert.equal(doc.state,'pending');assert.equal(doc.attachmentId,null);assert.equal(doc.productVerification.state,'matched');
  assert.equal(doc.productVerification.targets[0].via,'manufacturer_system_manual_link');
  assert.equal(doc.productVerification.policy,'manufacturer_pdf_article_variant_v7');
  assert.equal(store.projectDataRevision(f.root,'alice','same'),before);
  assert.deepEqual(await readJson(files.anhaenge),[]);assert.deepEqual(await readJson(files.brandschutz),[]);
  assert.equal((await readJson(files.geraetelisten))[0].positionen[0].bedienungsanleitungId,undefined);
  const service=createDocumentAssistantService(f.root,{db:f.db,verificationService:f.productVerification});
  const approval={reviewed:'on',sha256:doc.sha256,revision:before,metadata:{title:doc.title,category:doc.category}};
  await assert.rejects(service.approve('alice',job.id,doc.id,approval),e=>e.apiCode==='REVIEW_REQUIRED');
  await service.content('alice',job.id,doc.id);service.viewed('alice',job.id,doc.id,doc.sha256);
  const attachmentId=await service.approve('alice',job.id,doc.id,approval);
  const lists=await readJson(files.geraetelisten);
  assert.equal(lists[0].positionen[0].bedienungsanleitungId,attachmentId);assert.equal(lists[0].positionen[0].custom,'behalten');
  const {normalizePostedGeraetelisten}=require('../services/geraetelistenService');
  assert.equal(normalizePostedGeraetelisten(lists)[0].positionen[0].bedienungsanleitungId,attachmentId);
  assert.deepEqual(await readJson(files.brandschutz),[]);
  const coverage=(await request('/projects/same/datasheet-coverage')).data.data;
  assert.equal(coverage.items[0].status,'research');assert.equal(coverage.summary.unsupported,0);
 }finally{await client.close();await f.cleanup();}
});
