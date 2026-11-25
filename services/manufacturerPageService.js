// Static published evidence only; never execute publisher scripts or follow arbitrary endpoints.
const {hasIdentifier,labeledIds,labeledGtins,primaryArticle}=require('./productDocumentMatchingService');
function decode(s){return String(s).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
function cleanHtml(html){return html.replace(/<!--[\s\S]*?(?:-->|$)|<script\b[\s\S]*?(?:<\/script\s*>|$)|<style\b[\s\S]*?(?:<\/style\s*>|$)/gi,' ');}
function projectPageHtml(html){
 const clean=cleanHtml(html),main=clean.match(/<main\b[\s\S]*?<\/main\s*>/i);
 return main?(clean.match(/<base\b[^>]*>/i)?.[0]||'')+main[0]:clean;
}
function pageContent(html){
 const clean=cleanHtml(html),start=clean.search(/<h1\b/i);
 return decode((start>=0?clean.slice(start):clean).replace(/<\/(?:p|div|tr|li|h[1-6]|td|th)\s*>/gi,'\n').replace(/<(?:[^>\"']|\"[^\"]*\"|'[^']*')*>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').slice(0,50000);
}
function attrs(tag){const d={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))d[m[1].toLowerCase()]=decode(m[2]??m[3]);return d;}
function canonical(value){const u=new URL(value);u.hash='';u.searchParams.delete('attachment');u.searchParams.sort();return u.href;}
// Only published anchors are considered. These endpoints return original PDFs
// despite lacking a .pdf suffix; never synthesize or execute a download URL.
function pdfEndpoint(u){
 if(u.pathname.toLowerCase().endsWith('.pdf'))return true;
 if(u.hostname==='api.katalog.gira.de')return /^\/api\/datasheet\/getPDF\/[a-z]{2}_[A-Z]{2}\/\d{6}$/.test(u.pathname)&&!u.search;
 if(/(^|\.)fraenkische\.com$/i.test(u.hostname))return /^\/(?:[a-z]{2}(?:-[A-Z]{2})?)\/download\/(?:pro-doc-dat|produktdatenblatt)-[a-z0-9-]+$/i.test(u.pathname)&&u.searchParams.get('mode')==='file';
 if(/(^|\.)ledvance\.com$/i.test(u.hostname))return /^\/[a-z]{2}(?:-[a-z]{2})?\/product-datasheet\/\d+\/\d+$/i.test(u.pathname);
 if(/(^|\.)eltropa\.de$/i.test(u.hostname))return /^\/Produkt\/\d+\/export-to-pdf\/\d+$/.test(u.pathname);
 if(/(^|\.)hensel-electric\.(?:de|com)$/i.test(u.hostname))return /^\/[a-z]{2}-[a-z]{2}\/produkt\/\d+\/datasheet$/i.test(u.pathname);
 if(/(^|\.)rittal\.com$/i.test(u.hostname))return /^\/pdf-creator\/variant\/[a-z]{2}-[a-z]{2}\/\d+\/?$/i.test(u.pathname);
 if(u.hostname==='support.industry.siemens.com')return u.pathname==='/teddatasheet/'&&u.searchParams.get('format')==='pdf'&&/^[\w.-]{5,40}$/.test(u.searchParams.get('mlfbs')||'');
 if(/(^|\.)phoenixcontact\.com$/i.test(u.hostname))return /\/[^/]+-\d{6,10}$/.test(u.pathname)&&u.searchParams.get('type')==='pdf';
 if(u.hostname==='datasheet.weidmueller.com')return /^\/pdf\/[a-z]{2}(?:-[a-z]{2})?\/\d{10}\/scope\/\d+\/$/i.test(u.pathname);
 return false;
}
function linkedPdf(html,pageUrl,sourceUrl){
 const clean=cleanHtml(html),baseTag=clean.match(/<base\b[^>]*>/i);let base=pageUrl;
 try{if(baseTag)base=new URL(attrs(baseTag[0]).href,pageUrl).href;}catch{}
 const wanted=canonical(sourceUrl);
 for(const m of clean.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>|<warema-download-list-item\b[^>]*>[\s\S]*?<\/warema-download-list-item\s*>/gi)){
  const d=attrs(m[0].split('>')[0]),raw=d.href||d['download-link'];
  try{
   if(!raw)continue;
   const u=new URL(raw,base),uri=u.searchParams.get('uri'),file=u.searchParams.get('file');
   const wrapper=u.pathname.endsWith('.download')&&/^\/p\/\d+\.pdf$/.test(uri||'')&&file===uri.split('/').at(-1)?new URL(uri,u.origin).href:null;
   if(canonical(u.href)===wanted||(wrapper&&canonical(wrapper)===wanted))return {linked:true,label:decode(d.name||m[0].replace(/<(?:[^>\"']|\"[^\"]*\"|'[^']*')*>/g,' ')).trim().slice(0,200)};
  }catch{}
 }
 return {linked:false,label:''};
}
function pdfLinks(html,pageUrl) {
 const clean=cleanHtml(html),baseTag=clean.match(/<base\b[^>]*>/i);let base=pageUrl;
 try { if(baseTag) base=new URL(attrs(baseTag[0]).href,pageUrl).href; } catch {}
 const links=new Map();
 for(const m of clean.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>|<warema-download-list-item\b[^>]*>[\s\S]*?<\/warema-download-list-item\s*>/gi)) {
  const d=attrs(m[0].split('>')[0]),raw=d.href||d['download-link'];
  try {
   if(!raw)continue;
   let u=new URL(raw,base);const uri=u.searchParams.get('uri'),file=u.searchParams.get('file');
   if(u.pathname.endsWith('.download')&&/^\/p\/\d+\.pdf$/.test(uri||'')&&file===uri.split('/').at(-1))u=new URL(uri,u.origin);
   if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!pdfEndpoint(u)||u.href.length>2000)continue;
   const label=decode(d.title||d.name||m[0].replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,120)||(/\/api\/datasheet\/getPDF\//.test(u.pathname)?'Hersteller-Datenblatt':'');
   links.set(canonical(u.href),{sourceUrl:u.href,label});
   if(links.size>=100)break;
  } catch {}
 }
 return [...links.values()];
}
function productFragment(html,pageUrl){
 for(const tag of cleanHtml(html).matchAll(/<div\b[^>]*>/gi)){
  const d=attrs(tag[0]);if(d.id!=='leafletProductContainer'||!d['data-mage-init'])continue;
  try{const u=new URL(JSON.parse(d['data-mage-init']).leafletProduct.ajaxUrl,pageUrl),p=new URL(pageUrl);
   if(u.origin===p.origin&&/^\/[a-z_]+\/leafletproduct\/catalog\/leafletproduct\/product_id\/\d+\/$/i.test(u.pathname)&&!u.search&&!u.hash)return u.href;
  }catch{}
 }
 return null;
}
function pageEvidence({html,pageUrl,sourceUrl,model,documentModel}){
 const clean=cleanHtml(html),text=pageContent(html),wanted=documentModel||model;
 const heading=decode(cleanHtml(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]?.replace(/<(?:[^>\"']|\"[^\"]*\"|'[^']*')*>/g,' ')||'');
 const primary=primaryArticle(text.slice(0,3000));
 const inHeading=hasIdentifier(heading,wanted);
 const direct=hasIdentifier(primary?.text||'',wanted);
 // A variants page is selected by BOTH its product URL and its own exact PDF endpoint.
 // An accessory link or a matching row on an unrelated product page cannot select a product.
 const urlId=(value,id)=>hasIdentifier(decode(value).replace(/[./_-]/g,' '),id.replace(/[./_-]/g,' '));
 const selectedRow=[...clean.matchAll(/<div\b[^>]*class=[\"'][^\"']*\bactive\b[^\"']*\btable-product-item\b[^\"']*[\"'][^>]*>/gi)].some(m=>{const row=clean.slice(m.index,m.index+5000),value=row.match(/class=[\"'][^\"']*\bcms-col-ds-orderno\b[^\"']*[\"'][^>]*>([^<]+)/i)?.[1];return value&&hasIdentifier(decode(value),wanted);});
 const fragmentArticle=productFragment(html,pageUrl)&&labeledIds(text).some(x=>hasIdentifier(x.text,wanted));
 const aliasedArticle=documentModel&&labeledIds(text).some(x=>hasIdentifier(x.text,wanted));
 const selected=urlId(new URL(pageUrl).pathname,wanted)&&urlId(new URL(sourceUrl).pathname,wanted)&&(selectedRow||fragmentArticle||aliasedArticle);
 const gtinAlias=documentModel&&/^\d{13,14}$/.test(documentModel)&&hasIdentifier(decode(new URL(pageUrl).pathname),documentModel)&&new RegExp('\\b(?:GTIN|EAN|Product code)\\b[\\s\\S]{0,180}\\b'+documentModel+'\\b','i').test(text);
 const family=model.match(/^(.{4,})\s+\d+(?:[.,]\d+)?$/)?.[1];
 const familyAlias=documentModel&&family&&hasIdentifier(heading,family)&&labeledIds(text).some(x=>hasIdentifier(x.text,documentModel)&&hasIdentifier(text.slice(Math.max(0,x.index-120),x.index),model));
 const familyRow=!documentModel&&familyRowEvidence(clean,pageUrl,sourceUrl,model,heading);
 const matched=direct||inHeading||selected||Boolean(gtinAlias)||Boolean(familyAlias)||Boolean(familyRow);
 let sourceGtins=[];
 if(matched){
  // Keep GTIN evidence in the target's own labeled block, never a neighbour's row.
  const ids=labeledIds(text),at=ids.find(x=>hasIdentifier(x.text,wanted));
  if(at){const next=ids.find(x=>x.index>at.index);sourceGtins=labeledGtins(text.slice(at.index,Math.min(at.index+230,next?.index??Infinity)));}
  if(gtinAlias)sourceGtins=[documentModel];
 }
 if(familyRow)sourceGtins=familyRow.gtins;
 return {matched:matched&&!familyRow?.familyTarget,text,sourceGtins,...(familyRow?.article?{documentModel:familyRow.article}:{}),...(familyRow?.familyTarget?{familyTarget:familyRow.familyTarget}:{}),via:familyRow?'manufacturer_family_row':inHeading?'product_heading':selected?'selected_product_download':gtinAlias?'confirmed_gtin_alias':'primary_article'};
}
function familyRowEvidence(html,pageUrl,sourceUrl,model,heading){
 const page=new URL(pageUrl),pdf=new URL(sourceUrl);
 if(!/(^|\.)fraenkische\.com$/i.test(page.hostname)||pdf.origin!==page.origin||!pdfEndpoint(pdf)||!linkedPdf(html,pageUrl,sourceUrl).linked)return null;
 const code=String(model).match(/^(.+?)\s*(\d{2,3})(?:\s+(gr|grau))?$/i);if(!code)return null;
 const family=code[1].trim(),plain=require('./productDocumentMatchingService').plain;
 if(plain(heading.replace(/\bgrau\b/gi,''))!==plain(family))return null;
 if(!pdf.pathname.toLowerCase().endsWith('/pro-doc-dat-'+family.toLowerCase().replace(/\s+/g,'-'))&&!pdf.pathname.toLowerCase().endsWith('/pro-doc-dat-'+family.toLowerCase().replace(/\s+/g,'-')+'-grau'))return null;
 const hits=[];
 for(const m of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr\s*>/gi)){
  const cells=[...m[0].matchAll(/<td\b[^>]*>[\s\S]*?<\/td\s*>/gi)].map(x=>x[0]);
  const ids=cells.filter(x=>/class=["'][^"']*\bcart-variant__articlenumber\b/i.test(x));
  const descriptions=cells.filter(x=>/class=["'][^"']*\bcart-variant__description\b/i.test(x));
  if(ids.length!==1||descriptions.length!==1||!hasIdentifier(pageContent(descriptions[0]),model.replace(/\s+(?:gr|grau)$/i,'')))continue;
  const article=ids[0].match(/class=["'][^"']*\bcart-variant__external-id\b[^"']*["'][^>]*>\s*(\d{8})\s*</i)?.[1];
  const gtin=ids[0].match(/class=["'][^"']*\bcart-variant__international-id\b[^"']*["'][^>]*>\s*(\d{13,14})\s*</i)?.[1];
  if(!article||!gtin)continue;
  if(code[3]&&!/grau/i.test(pageContent(m[0])))continue;
  hits.push({article,gtins:[gtin]});
 }
 // An archived family may no longer publish individual variant rows. In that
 // case only the PDF's own exact family heading + unique Type/SKU row may finish
 // the binding. A published variant table missing this type is NOT a fallback.
 if(!hits.length&&!/cart-variant__articlenumber/i.test(html))return {familyTarget:{model:family,nominalSize:Number(code[2])},gtins:[]};
 return hits.length===1?hits[0]:null;
}
// A system manual can cover a named component without being that component's
// datasheet. Bind the exact system heading and manual link to its component section.
function systemManualEvidence({html,pageUrl,sourceUrl,model}){
 const clean=cleanHtml(html),heading=pageContent(clean.match(/<h1\b[^>]*>[\s\S]*?<\/h1\s*>/i)?.[0]||'').trim();
 const section=clean.match(/<h2\b[^>]*>\s*Systemkomponenten\s*<\/h2\s*>([\s\S]*?)(?=<h2\b|$)/i)?.[1];
 const link=linkedPdf(clean,pageUrl,sourceUrl);
 if(!heading||heading.length>100||!section||!hasIdentifier(pageContent(section),model)||!link.linked
  ||!/montageanleitung|installation\s+(?:manual|instructions)/i.test(link.label)||!hasIdentifier(link.label,heading))return null;
 return {systemModel:heading,pageArticleConfirmed:true};
}
module.exports={pdfLinks,decode,cleanHtml,projectPageHtml,pageContent,linkedPdf,productFragment,pageEvidence,systemManualEvidence};
