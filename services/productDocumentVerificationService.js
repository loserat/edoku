const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {downloadResource}=require('./mcpDocumentSourceService');
const {trustedPage,aliasFor}=require('./manufacturerSourcePolicy');
const {matchDocument,zz330TradeNameTarget}=require('./productDocumentMatchingService');
const {dataFilesForProject}=require('./projectArchiveService');
const {readJson,writeJson}=require('./jsonService');
const {assertSafePath}=require('./pathService');
const {resolveDeviceReferences,referenceKey}=require('./deviceDocumentService');
const store=require('./projectDataStoreService');
const {fault}=require('../src/api/validation');
const POLICY='manufacturer_pdf_article_variant_v10';
function retryAfterPolicyChange(record,target){
 if(record.outcome==='blocked'&&record.verificationPolicy==='manufacturer_pdf_article_variant_v9'){
  const brand=String(target.manufacturer||'').toLowerCase().replace(/[^a-z]/g,'');
  const issue=[record.reason,record.blockerCode,record.evidence?.sourceQuote].filter(Boolean).join(' ');
  return brand==='obobettermann'&&/^PLM D \d{4} FS$/i.test(target.model||'')&&/^[\d.,]+\s*[×x]\s*[\d.,]+\s*[×x]\s*[\d.,]+\s*mm$/i.test(target.variant||'')
   && /PDF_DIMENSION_LAYOUT_UNSUPPORTED|variant_not_confirmed/.test(issue)
   && !/SOURCE_|manufacturer_(?:source|page_article)_|pdf_not_linked|PROPOSAL_/.test(issue);
 }

 if(record.outcome==='blocked'&&record.verificationPolicy==='manufacturer_pdf_article_variant_v8'){
  const issue=[record.reason,record.evidence?.sourceQuote,record.blockerCode].filter(Boolean).join(' ');
  return zz330TradeNameTarget(target)&&/PRODUCT_DOCUMENT_UNCONFIRMED|article_not_confirmed/.test(issue)
   && !/SOURCE_|manufacturer_(?:source|page_article)_|pdf_not_linked|variant_not_confirmed|PROPOSAL_/.test(issue);
 }
 if(record.outcome!=='blocked'||!['manufacturer_pdf_article_variant_v5','manufacturer_pdf_article_variant_v6','manufacturer_pdf_article_variant_v7'].includes(record.verificationPolicy))return false;
 const reason=record.reason+' '+(record.evidence?.sourceQuote||'');
 const brand=String(target.manufacturer).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
 const sourceGap=/manufacturer_source_unconfirmed|Herstellerquelle[^.]*nicht bestätig/i.test(reason);
 const linkGap=/pdf_not_linked_by_manufacturer|manufacturer_page_article_not_confirmed|no_bound_pdf_link|PDF-Link[^.]*nicht bestätig/i.test(reason);
 if(record.verificationPolicy==='manufacturer_pdf_article_variant_v7'){
  return sourceGap&&['bega','sikora','siteco'].includes(brand)
   ||linkGap&&['abbstriebeljohn','striebeljohn','rittal'].includes(brand)
   ||/SOURCE_FILE_LIMIT/.test(reason)&&['berker','niedax'].includes(brand)
   ||/PROPOSAL_CONFLICT/.test(reason)&&brand==='obobettermann'&&target.model==='V-TEC VM32 LGR';
 }
 const publishers=['abbstotz','abbstriebeljohn','bachmann','berker','buschjaeger','cellpack','eaton','eltropa','esser','hegler','hensel','indexa','klauke','mersen','phoenixcontact','rittal','siemens','siteco','weidmuller'];
 if(sourceGap&&publishers.includes(brand))return true;
 if(linkGap&&(brand==='gira'&&/^\d{6}$/.test(target.model)||brand==='frankische'&&/^(?:AES-E|ALU Steck-ES|AMS-E|E-Ku-E|FPKu-EM-F|SMS-E-V|Staro Steck-ES-V)\s*\d{2,3}(?:\s+gr)?$/i.test(target.model)||brand==='ledvance'&&['PL625SUR.MOUNTKITH75','HBP75W84070DEGIP66PS'].includes(target.model)))return true;
 if(/variant_not_confirmed/.test(reason)){
  const shape=String(target.variant||'');
  if(brand==='niedax'&&/^KSL\s+\d+\.\d+\/\d+\s+S$/i.test(target.model)&&/^[\d.,]+\s*[×x]\s*[\d.,]+\s*[×x]\s*[\d.,]+\s*mm$/i.test(shape))return true;
  if(brand==='obobettermann'&&['GS-OTRW','GS-TW70'].includes(target.model)&&/^[\d.,]+\s*[×x]\s*[\d.,]+(?:\s*[×x]\s*[\d.,]+)?\s*mm$/i.test(shape))return true;
  if(brand==='niedax'&&/^(?:RBA|RGV|RLVC|RW|STL)\s/.test(target.model)&&(/\(\s*H\s*[×x]\s*(?:lichte\s+B|B|Umkantung)\s*\)/i.test(shape)||/^Höhe\s+[\d.,]+\s*mm,\s*für Rinnen mit/i.test(shape)))return true;
  if(brand==='obobettermann'&&['71GD6','GS-S70130RW'].includes(target.model)&&/\(\s*L\s*[×x]\s*B\s*[×x]\s*H\s*\)/i.test(shape))return true;
 }

 return brand==='niedax'&&/^RAW\s+\d+\.\d+$/i.test(target.model)&&/\(\s*H\s*[×x]\s*B\s+innen\s*\)\s*,\s*Gesamtbreite\s+\d+(?:[.,]\d+)?\s*mm$/i.test(target.variant||'')&&/variant_not_confirmed/.test(reason)
  ||brand==='obobettermann'&&target.model==='GS-KUP70 (VE2)'&&/manufacturer_page_article_not_confirmed|no_bound_pdf_link|pdf_not_linked_by_manufacturer/.test(reason);
}
const {pageContent,linkedPdf,productFragment,pageEvidence,systemManualEvidence}=require('./manufacturerPageService');
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const technical=category=>['Datenblätter','Bedienungsanleitungen'].includes(category);
function compactVerification(report){
 if(!report)return undefined;
 const {policy,state,reason,sha256,checkedAt,pagesChecked,totalPages,truncated,cacheHit}=report,targets=report.targets||[];
 return {policy,state,reason,resolution:require('./workflowBlockerService').verificationResolution(report),sha256,checkedAt,pagesChecked,totalPages,truncated,cacheHit,targetCount:report.targetCount??targets.length,matchedTargets:report.matchedTargets??targets.filter(x=>x.state==='matched').length,
  targets:targets.slice(0,3).map(({listId,position,manufacturer,model,documentModel,variant,variantRequired,variantMatched,state,reason,via,page,manufacturerEvidence,gtin,variantEvidence})=>({listId,position,manufacturer,model,documentModel,variant,variantRequired,variantMatched,state,reason,via,page,manufacturerEvidence,gtin,...(variantEvidence?{variantEvidence}:{})})),fullTextReturned:false,fileApproval:'manual_gui_per_file'};
}
async function extractPdf(file){
 try{
  const {stdout}=await run(process.execPath,['--max-old-space-size=160',path.join(__dirname,'workers/pdfTextWorker.mjs'),file],{timeout:10000,maxBuffer:400000,windowsHide:true});
  const result=JSON.parse(stdout);if(!Array.isArray(result.pages))throw Error();return result;
 }catch{return {pages:[],totalPages:0,truncated:false,error:'PDF_TEXT_UNAVAILABLE'};}
}
function createProductDocumentVerificationService(root,{sourceLoader=downloadResource,extract=extractPdf,clock=Date.now,checkStorage=require('./storageBudgetService').createStorageBudget(root)}={}){
 const inFlight=new Map();
 async function targets(userId,projectId,data){
  const files=dataFilesForProject(root,userId,projectId),lists=await readJson(files.geraetelisten,[]),refs=data.deviceReferences||[];
  if(!refs.length)return [];
  const resolved=resolveDeviceReferences(lists,refs,data.category,'application/pdf');
  return resolved.map(({list,position,reference})=>({listId:list.id,position:reference.position,manufacturer:String(position.hersteller).trim(),model:String(position.typ).trim(),variant:[position.abmessung,position.farbe].filter(Boolean).join(' · '),systemDocumentEligible:list.leistungsbereich==='Brandschutzabschottungen'}));
 }
 const fail=(state,reason,extra={})=>({policy:POLICY,state,reason,fileApproval:'manual_gui_per_file',fullTextReturned:false,...extra});
 function blocked(report){const error=fault('Hersteller-PDF und Artikel-/Variantenpassung sind noch nicht eindeutig bestätigt.',422,'PRODUCT_DOCUMENT_UNCONFIRMED');error.verification=report;return error;}
 async function perform(userId,projectId,jobId,data,bytes){
  const expected=await targets(userId,projectId,data),revision=store.projectDataRevision(root,userId,projectId);
  if(!expected.length)return {report:fail('unclear','device_targets_required'),bytes:null,revision};
  if(expected.length>20)return {report:fail('unclear','too_many_targets',{limit:20}),bytes:null,revision};
  if(!data.manufacturerPageUrl||!data.sourceUrl)return {report:fail('unclear','manufacturer_page_and_pdf_url_required'),bytes:null,revision};
  let extra,aliases;
  try{extra=await readJson(path.join(root,'config/manufacturerSources.json'),{});aliases=await readJson(path.join(root,'config/manufacturerArticleAliases.json'),{});}catch{return {report:fail('unclear','publisher_configuration_invalid'),bytes:null,revision};}
  if(!expected.every(t=>trustedPage(t.manufacturer,data.manufacturerPageUrl,extra)))return {report:fail('unclear','manufacturer_source_unconfirmed'),bytes:null,revision};
  const key=digest([POLICY,expected,data.category,data.manufacturerPageUrl,data.sourceUrl,aliases]),folder=path.join(root,'storage/users',userId,'assistant',jobId,'product-checks'),reportFile=path.join(folder,key+'.json');
  await assertSafePath(root,folder,{allowMissing:true});
  try{
   const saved=await readJson(reportFile);const file=path.join(folder,saved.sha256+'.pdf');await assertSafePath(root,file,{type:'file'});const cached=await fs.readFile(file);
   if(saved.binding===key&&saved.checkedAt>clock()-3600000&&digest(cached)===saved.sha256&&(!bytes||digest(bytes)===saved.sha256))return {report:{...saved.report,cacheHit:true},bytes:cached,revision};
  }catch(error){if(error.apiCode||error.status===403)throw error;}
  let page,pdf;
  try{page=await sourceLoader(data.manufacturerPageUrl,{kind:'html',maxBytes:768*1024,projectHtml:true});
   if(!expected.every(t=>trustedPage(t.manufacturer,page.finalUrl,extra)))return {report:fail('unclear','manufacturer_redirect_unconfirmed'),bytes:null,revision};
   let html=page.bytes.toString('utf8'),link=linkedPdf(html,page.finalUrl,data.sourceUrl);
   const fragment=productFragment(html,page.finalUrl);
   if(!link.linked&&fragment){
    const part=await sourceLoader(fragment,{kind:'html',maxBytes:768*1024,projectHtml:true});
    if(new URL(part.finalUrl).origin!==new URL(page.finalUrl).origin)return {report:fail('unclear','manufacturer_fragment_redirect_unconfirmed'),bytes:null,revision};
    html+='\n'+part.bytes.toString('utf8');link=linkedPdf(html,page.finalUrl,data.sourceUrl);
   }
   const text=pageContent(html);
   if(!link.linked)return {report:fail('unclear','pdf_not_linked_by_manufacturer'),bytes:null,revision};
   const bound=expected.map(t=>{
    const direct=pageEvidence({html,pageUrl:page.finalUrl,sourceUrl:data.sourceUrl,model:t.model});
    if(direct.matched)return {...t,...(direct.documentModel?{documentModel:direct.documentModel}:{}),sourceGtins:direct.sourceGtins,pageArticleConfirmed:true};
    if(direct.familyTarget&&data.category==='Datenblätter')return {...t,familyTarget:direct.familyTarget,pageArticleConfirmed:false,sourceGtins:[]};
    if(t.systemDocumentEligible&&data.category==='Bedienungsanleitungen'){
     const system=systemManualEvidence({html,pageUrl:page.finalUrl,sourceUrl:data.sourceUrl,model:t.model});
     if(system)return {...t,...system};
    }
    const alias=aliasFor(t.manufacturer,t.model,aliases);
    if(!alias)return null;
    const evidence=pageEvidence({html,pageUrl:page.finalUrl,sourceUrl:data.sourceUrl,model:t.model,documentModel:alias});
    // Rittal's page omits the catalogue dot; its PDF keeps the original notation.
    const pageOnlyFormatting=/^rittal$/i.test(t.manufacturer)&&alias===t.model.replace('.','');
    return evidence.matched?{...t,...(pageOnlyFormatting?{}:{documentModel:alias}),sourceGtins:evidence.sourceGtins,pageArticleConfirmed:true}:null;
   });
   if(bound.some(x=>!x))return {report:fail('unclear','manufacturer_page_article_not_confirmed'),bytes:null,revision};
   if(data.category==='Bedienungsanleitungen'&&!/anleitung|manual|instruction|montage|installation|operating/i.test(link.label))return {report:fail('unclear','manual_link_not_confirmed'),bytes:null,revision};
   pdf=await sourceLoader(data.sourceUrl,{kind:'pdf'});
   if(bytes&&digest(bytes)!==digest(pdf.bytes))return {report:fail('unclear','uploaded_file_differs_from_manufacturer'),bytes:null,revision};
   const sha=digest(pdf.bytes);await checkStorage(userId,pdf.bytes.length+16384);await fs.mkdir(folder,{recursive:true,mode:0o700});const file=path.join(folder,sha+'.pdf');await assertSafePath(root,file,{allowMissing:true});
   try{await fs.writeFile(file,pdf.bytes,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;if(digest(await fs.readFile(file))!==sha)throw Error('CACHE_FILE_CHANGED');}
   const extracted=await extract(file);
   if(data.category==='Bedienungsanleitungen'&&!extracted.pages.some(p=>/anleitung|manual|instruction|montage|installation|operating|assembly/i.test(p.text)))return {report:fail('unclear','manual_content_not_confirmed',{sha256:sha}),bytes:null,revision};
   const match=matchDocument({...extracted,pageText:text,sourceLinked:true,manual:data.category==='Bedienungsanleitungen',targets:bound});
   const report={policy:POLICY,...match,reason:extracted.error||(extracted.pages.every(p=>p.text.trim().length<10)?'pdf_text_unreadable':null),sha256:sha,source:{manufacturerPageUrl:data.manufacturerPageUrl,pdfUrl:data.sourceUrl,linked:true},checkedAt:new Date(clock()).toISOString(),fileApproval:'manual_gui_per_file',cacheHit:false};
   // No complete page or PDF text leaves the verifier. Evidence stays short and target-bound.
   report.targets=report.targets.map(({excerpt,...x})=>({...x,excerpt:excerpt.slice(0,140)}));
   await writeJson(reportFile,{binding:key,sha256:sha,checkedAt:clock(),report});
   store.assertProjectRevision(root,userId,projectId,revision);
   return {report,bytes:pdf.bytes,revision};
  }catch(error){
   if(error.apiCode||error.status===507||error.status===403)throw error;
   return {report:fail('unclear',error.code?.startsWith('SOURCE_')?error.code:'source_or_text_check_failed'),bytes:null,revision};
  }
 }
 async function check(userId,projectId,jobId,data,bytes){
  const key=digest([userId,projectId,jobId,data,bytes?digest(bytes):'source']);
  if(inFlight.has(key))return inFlight.get(key);
  const pending=perform(userId,projectId,jobId,data,bytes);inFlight.set(key,pending);try{return await pending}finally{inFlight.delete(key);}
 }
 return {check,targets,blocked,technical};
}
module.exports={createProductDocumentVerificationService,extractPdf,pageContent,linkedPdf,compactVerification,POLICY,retryAfterPolicyChange};
