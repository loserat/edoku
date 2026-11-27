const path=require('node:path');
const {parse,fault}=require('../src/api/validation');
const {query}=require('../src/api/manufacturerLinkSchemas');
const {readJson}=require('./jsonService');
const {downloadResource}=require('./mcpDocumentSourceService');
const {trustedPage,aliasFor}=require('./manufacturerSourcePolicy');
const {pdfLinks,productFragment,pageEvidence,systemManualEvidence}=require('./manufacturerPageService');
const {loadProjectWorkspace}=require('./projectWorkspaceService');
const {createDocumentAssistantService}=require('./documentAssistantService');
const store=require('./projectDataStoreService');
const {encodedBytes}=require('./statusQueryService');
function compact(result) {
 while(result.candidates.length&&encodedBytes(result)>6144){result.candidates.pop();result.moreCandidates=true;}
 if(encodedBytes(result)>6144||result.state==='found'&&!result.candidates.length)throw fault('Rechercheantwort zu groß; kürzere Produktadresse verwenden.',413,'RESPONSE_LIMIT');
 return result;
}
const POLICY='manufacturer_link_discovery_v1';
function createManufacturerLinkService(root,{sourceLoader=downloadResource}={}) {
 const assistant=createDocumentAssistantService(root);
 async function inspect(userId,projectId,jobId,input) {
  return store.withProjectDataTransaction(async()=>{
   const args=parse(query,input);assistant.project(userId,projectId);
   const job=assistant.get(userId,jobId);if(job.projectId!==projectId)throw fault('Auftrag wurde nicht gefunden.',404,'NOT_FOUND');
   const data=await loadProjectWorkspace(root,userId,projectId);
   const lists=data.geraetelisten.filter(l=>l.id===args.listId&&l.aktiv!==false&&data.leistungsbereiche.aktiv.includes(l.leistungsbereich));
   const rows=lists.length===1?lists[0].positionen.filter((r,i)=>Number(r.pos||i+1)===args.position):[];
   if(rows.length!==1)throw fault('Aktive Geräteposition wurde nicht eindeutig gefunden.',404,'NOT_FOUND');
   const row=rows[0];
   if(!row.hersteller||!row.typ)throw fault('Hersteller und Artikel zuerst klären.',409,'DEVICE_IDENTITY_REQUIRED');
   const base={policy:POLICY,projectId,jobId,jobVersion:job.version,category:args.category,manufacturerPageUrl:args.manufacturerPageUrl,
    deviceReference:{listId:args.listId,position:args.position,manufacturer:row.hersteller,model:row.typ},
    fileApproval:'manual_gui_per_file',proposalCreated:false,pdfDownloaded:false,fullTextReturned:false,htmlRequests:0};
   const material=require('./documentationMaterialPolicy'),excluded=material.manualExcluded(row)||material.explicit(data.projekt)&&material.excluded(row,data.projekt);
   if(excluded)return compact({...base,state:'excluded',reason:excluded,candidates:[]});
   const extra=await readJson(path.join(root,'config/manufacturerSources.json'),{});
   const aliases=await readJson(path.join(root,'config/manufacturerArticleAliases.json'),{});
   if(!trustedPage(row.hersteller,args.manufacturerPageUrl,extra))return compact({...base,state:'blocked',reason:'manufacturer_source_unconfirmed',candidates:[]});
   try {
    base.htmlRequests++;const page=await sourceLoader(args.manufacturerPageUrl,{kind:'html',projectHtml:true,maxBytes:768*1024});
    if(!trustedPage(row.hersteller,page.finalUrl,extra))return compact({...base,state:'blocked',reason:'manufacturer_redirect_unconfirmed',candidates:[]});
    let html=page.bytes.toString('utf8');const fragment=productFragment(html,page.finalUrl);
    if(fragment){
     base.htmlRequests++;const part=await sourceLoader(fragment,{kind:'html',projectHtml:true,maxBytes:768*1024});
     if(new URL(part.finalUrl).origin!==new URL(page.finalUrl).origin)return compact({...base,state:'blocked',reason:'manufacturer_fragment_redirect_unconfirmed',candidates:[]});
     html+='\n'+part.bytes.toString('utf8');
    }
    const documentModel=aliasFor(row.hersteller,row.typ,aliases);
    const candidates=pdfLinks(html,page.finalUrl).map(link=>{
     const direct=pageEvidence({html,pageUrl:page.finalUrl,sourceUrl:link.sourceUrl,model:row.typ});
     const alias=!direct.matched&&documentModel?pageEvidence({html,pageUrl:page.finalUrl,sourceUrl:link.sourceUrl,model:row.typ,documentModel}):null;
     const system=lists[0].leistungsbereich==='Brandschutzabschottungen'&&args.category==='Bedienungsanleitungen'?systemManualEvidence({html,pageUrl:page.finalUrl,sourceUrl:link.sourceUrl,model:row.typ}):null;
     if(!direct.matched&&!direct.familyTarget&&!alias?.matched&&!system)return null;
     const manual=/anleitung|manual|instruction|montage|installation|operating/i.test(link.label);
     const sheet=/datenblatt|datasheet|data.sheet|pdf_datasheets|pro-doc-dat/i.test(link.label+' '+link.sourceUrl);
     // Guides can be general product attachments; the existing verifier remains binding.
     if(args.category==='Bedienungsanleitungen'&&!manual)return null;
     return {...link,kind:manual?'manual':sheet?'datasheet':'unclassified',binding:system?'system_component':direct.familyTarget||direct.matched&&!direct.documentModel?'product_article':'confirmed_article_alias',rank:args.category==='Datenblätter'?(sheet?0:manual?2:1):0};
    }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.sourceUrl.localeCompare(b.sourceUrl));
    const selected=args.category==='Datenblätter'&&candidates.some(c=>c.kind==='datasheet')?candidates.filter(c=>c.kind==='datasheet'):candidates;
    return compact({...base,state:selected.length?'found':'not_found',reason:selected.length?null:'no_bound_pdf_link',candidateCount:selected.length,moreCandidates:selected.length>3,candidates:selected.slice(0,3).map(({rank,...link})=>link),nextStep:'Exakten Kandidaten mit dieser Herstellerseite an edoku_propose_document übergeben; bestehende Artikel-/Variantenprüfung und manuelle Einzelfreigabe bleiben erforderlich.'});
   } catch(error) {
    if(error.apiCode)throw error;
    return compact({...base,state:'blocked',reason:error.code?.startsWith('SOURCE_')?error.code:'manufacturer_link_fetch_failed',candidates:[]});
   }
  });
 }
 return {inspect};
}
module.exports={createManufacturerLinkService,POLICY};
