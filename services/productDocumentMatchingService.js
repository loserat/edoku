const {dimensionEvidence}=require('./productDimensionEvidenceService');
const normal=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('de').replace(/[®™]/g,'').replace(/ß/g,'ss');
const plain=value=>normal(value).replace(/[^a-z0-9äöü]/g,'');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const millimetres=value=>Number(String(value).replace(/(?<=\d)\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.'));
function hasIdentifier(text,id){
 if(!id)return false;
 const code=normal(id).trim();
 const pattern=[...code].map((c,i)=>/\s|-/.test(c)?'[ \\t-]*':escape(c)+(/[\p{L}\p{N}]/u.test(c)&&/[\p{L}\p{N}]/u.test(code[i+1]||'')?'[ \\t]*':'')).join('');
 return new RegExp('(?<![\\p{L}\\p{N}])'+pattern+'(?![\\p{L}\\p{N}])','iu').test(normal(text));
}
const label=/(?<![\p{L}])(?:art(?:ikel)?[.\s-]*(?:nr\.?|nummer|no\.?)|bestell[.\s-]*(?:nr\.?|nummer|code)|order\s*(?:no\.?|number)|article\s*(?:no\.?|number)|item\s*(?:no\.?|number)|r[eé]f[eé]rence|modell(?:[.\s-]*(?:nr\.?|nummer))?|model|typ(?:e)?|produktname|product\s*(?:name|code)|12nc|sku|mpn)(?![\p{L}])\s*\)?\s*[:#-]?\s*([^\n]{1,100})/giu;
function labeledIds(text){return [...String(text).matchAll(label)].map(m=>{
 let value=m[1];
 // Common PDF layout: Item number | GTIN, then article | GTIN on the next row.
 if(/^\s*(?:GTIN|EAN)\s*$/i.test(value))value+=' '+(String(text).slice(m.index+m[0].length).match(/^[ \t]*\n[ \t]*([^\n]{1,120})/)?.[1]||'');
 return {text:value,index:m.index};
});}
function labeledGtins(text){
 const result=[];
 for(const m of String(text).matchAll(/\b(?:GTIN|EAN)\b[^\n]{0,100}(?:\n[^\n]{0,120})?/gi))
  for(const n of m[0].matchAll(/(?<![\p{L}\p{N}])\d{13,14}(?![\p{L}\p{N}])/gu))result.push(n[0]);
 return [...new Set(result)];
}
function primaryArticle(text){
 return labeledIds(text).find(x=>!/^\s*(?:EUR\b|Preis\b|Price\b|Raum\b|Room\b|Anzahl\b|Quantity\b|GTIN\s*$|EAN\s*$)/i.test(x.text));
}
function tableArticle(text,id){
 const lines=String(text).split('\n');
 for(let i=0;i<lines.length;i++){
  const columns=lines[i].trim().split(/\s{2,}/);
  const index=columns.findIndex(c=>/^(?:Bestell[.\s-]*(?:Nr\.?|nummer)|Art(?:ikel)?[.\s-]*(?:Nr\.?|nummer|No\.?)|Item\s*(?:number|No\.?)|Article\s*(?:number|No\.?))$/i.test(c));
  if(columns.length<2||columns.length>32||index<0)continue;
  const rows=[];
  for(let j=i+1;j<Math.min(lines.length,i+51);j++){
   if(!lines[j].trim())continue;
   const cells=lines[j].trim().split(/\s{2,}/);
   if(cells.length!==columns.length)break;
   rows.push({cells,line:lines[j]});
  }
  const selected=rows.find(x=>plain(x.cells[index])===plain(id)&&hasIdentifier(x.cells[index],id));
  if(selected)return {text:[lines[i],selected.line].join('\n'),single:rows.length===1};
 }
 return null;
}
function conduitTable(text,id,family){
 const inner=/Art[.-]*Nr\.?\s*:[^\n]*Type[^\n]*Innen\s*Ø\s*Außen\s*Ø/i.test(text);
 const outer=/Art[.-]*Nr\.?\s*:[^\n]*Type[^\n]*Außen\s*Ø[^\n]*Inhalt/i.test(text);
 if(!inner&&!outer)return null;
 const rows=[];
 for(const m of String(text).matchAll(/^(\d{3})[ \t]+(\d{2})[ \t]+(\d{3})[ \t]+(\d+)[ \t]+(\d+(?:[.,]\d+)?)[ \t]+(\d+(?:[.,]\d+)?)[^\n]*/gm)){
  const article=m[1]+m[2]+m[3];
  if(id?article===id:Number(m[4])===family?.nominalSize)rows.push({article,nominalSize:Number(m[4]),text:m[0]+(inner?'\nAußen × Innen '+m[6]+' × '+m[5]+' mm':'\nAußen Ø '+m[5]+' mm')});
 }
 return rows.length===1?rows[0]:null;
}
function verticalProductTable(text,id){
 const lines=String(text).split('\n').map(x=>x.trim()).filter(Boolean);
 const sku=String(text).match(/Artikelnummer\s*:\s*(\d{6,})/i)?.[1];
 if(!sku||new Set([...String(text).matchAll(/Artikelnummer\s*:\s*(\d{6,})/gi)].map(x=>x[1])).size!==1)return null;
 for(let i=0;i<lines.length-2;i++)if(/^Artikelnummer$/i.test(lines[i])&&/^Typ$/i.test(lines[i+1])){
  const at=lines.findIndex((x,j)=>j>i+1&&j<i+25&&x===sku);
  if(at>i&&hasIdentifier(lines[at+1],id)&&plain(lines[at+1])===plain(id))return text;
 }
 return null;
}
function verticalDimensions(text){
 const lines=String(text).split('\n').map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length-4;i++)if(/^Abmessungen$/i.test(lines[i])&&/^Länge$/i.test(lines[i+1])&&/^Breite$/i.test(lines[i+2])&&!/^Höhe$/i.test(lines[i+3])){
  const l=lines[i+3].match(/^(\d+(?:[.,]\d+)?)\s*mm$/i)?.[1],b=lines[i+4].match(/^(\d+(?:[.,]\d+)?)\s*mm$/i)?.[1];
  if(l&&b)return `Länge: ${l} mm\nBreite: ${b} mm`;
 }
 for(let i=0;i<lines.length-6;i++)if(/^Abmessungen$/i.test(lines[i])&&/^Länge$/i.test(lines[i+1])&&/^Breite$/i.test(lines[i+2])&&/^Höhe$/i.test(lines[i+3])){
  const numbers=lines.slice(i+4,i+7).map(x=>x.match(/^(\d[\d.,]*)\s*mm$/i)?.[1]);
  if(numbers.every(Boolean)){
   const n=x=>x.replace(/(?<=\d)\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
   const [l,b,h]=numbers.map(n);return 'Länge × Breite × Höhe '+l+' × '+b+' × '+h+' mm\nHöhe × Breite '+h+' × '+b+' mm';
  }
 }
 return '';
}
const colorGroups=[['weiß','weiss','white','blanc','wit'],['schwarz','black','noir','zwart'],['grau','grey','gray','gris','grijs'],['rot','red','rouge','rood'],['blau','blue','bleu','blauw']];
function variantFound(text,variant){
 if(!variant)return true;
 const planarLabels=String(variant).match(/^(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*mm\s*\(\s*L\s*[×x]\s*B\s*\)$/i);
 if(planarLabels){
  const values=label=>[...String(text).matchAll(new RegExp('(?:^|\\n)\\s*'+label+'\\s*:?\\s*(\\d+(?:[.,]\\d+)?)\\s*mm\\b','gi'))].map(m=>millimetres(m[1]));
  const l=values('Länge'),b=values('Breite');return l.length>0&&b.length>0&&l.every(n=>n===millimetres(planarLabels[1]))&&b.every(n=>n===millimetres(planarLabels[2]));
 }
 const pair=String(variant).match(/^Höhe\s+(\d+(?:[.,]\d+)?)\s*mm,\s*Breite\s+(\d+(?:[.,]\d+)?)\s*mm$/i);
 if(pair){const n=x=>x.replace(',','.').replace(/\.0+$/,'');const pattern='Höhe\\s+H\\s*x\\s*Breite\\s+B\\s*:\\s*'+escape(n(pair[1]))+'(?:[.,]0+)?\\s*x\\s*'+escape(n(pair[2]))+'(?:[.,]0+)?\\s*mm\\b';return new RegExp(pattern,'i').test(text);}
 const parts=String(variant).split(/\s*[·;]\s*/).filter(Boolean);
 if(!parts.length||parts.some(x=>!plain(x)))return false;
 return parts.every(part=>{
  const group=colorGroups.find(g=>g.map(normal).includes(normal(part)));
  if(group)return group.some(x=>new RegExp('(?<![\\p{L}])'+escape(normal(x))+'(?![\\p{L}])','iu').test(normal(text)));
  const dimension=value=>normal(value).replace(/[×✕]/g,'x').replace(/(\d),(?=\d)/g,'$1.').replace(/(\d+)\.0+(?![0-9])/g,'$1').replace(/[^a-z0-9äöü.]/g,'');
  const needle=dimension(part),haystack=dimension(text);
  const planar=needle.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm$/);
  if(planar&&new RegExp('(?<![0-9.])'+escape(planar[1])+'x'+escape(planar[2])+'x[0-9]+(?:\\.[0-9]+)?mm(?![a-z0-9])').test(haystack))return true;
  // Numeric dimensions must not match a larger conductor count/size (1x16 vs 11x16).
  return new RegExp((/^\d/.test(needle)?'(?<![0-9.])':'')+escape(needle)+(/\d$/.test(needle)?'(?![0-9.])':'')).test(haystack);
 });
}
// NIEDAX describes the usable width of KTUM arms as their support length.
// Only that named family/label may resolve the legacy project wording "mm breit".
function cantileverVariantFound(text, variant, target) {
 if (plain(target.manufacturer) !== 'niedax' || !/^KTUM\s+\d+(?:\s+(?:F|E3|E5))?$/i.test(target.model)) return false;
 const expected=String(variant).match(/^(\d+(?:[.,]\d+)?)\s*mm\s+breit$/i);
 if (!expected || !hasIdentifier(text,target.documentModel||target.model)) return false;
 const values=[...String(text).matchAll(/Auflagelänge\s+L\s*:\s*(\d+(?:[.,]\d+)?)\s*mm\b/gi)].map(m=>Number(m[1].replace(',','.')));
 return values.length>0 && values.every(n=>n===Number(expected[1].replace(',','.')));
}
function rawVariantFound(text,variant,target){
 if(plain(target.manufacturer)!=='niedax'||!/^RAW\s+\d+\.\d+$/i.test(target.model)||!hasIdentifier(text,target.model))return false;
 const expected=String(variant).match(/^(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*mm\s*\(\s*H\s*[×x]\s*B\s+innen\s*\)\s*,\s*Gesamtbreite\s+(\d+(?:[.,]\d+)?)\s*mm$/i);
 if(!expected)return false;
 const inner=[...String(text).matchAll(/Höhe\s+H\s*[×x]\s*Breite\s+B\s*\(innen\)\s*:\s*(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*mm\b/gi)];
 const total=[...String(text).matchAll(/Gesamtbreite\s+B1\s*:\s*(\d+(?:[.,]\d+)?)\s*mm\b/gi)];
 const n=millimetres;
 return inner.length>0&&total.length>0&&inner.every(m=>n(m[1])===n(expected[1])&&n(m[2])===n(expected[2]))&&total.every(m=>n(m[1])===n(expected[3]));
}
function matchDocument({pages,totalPages,truncated,pageText,sourceLinked,manual,targets}){
 const results=targets.map(t=>{
  const brand=plain(t.manufacturer),publishers=require('./manufacturerSourcePolicy').publisherNames(t.manufacturer),brandInPdf=pages.some(p=>publishers.some(name=>hasIdentifier(p.text,name))||(brand==='obobettermann'&&hasIdentifier(p.text,'OBO')));
  let evidence,via='pdf_article';
  for(const p of pages){
   if(t.familyTarget){
    const brandMatches=String(t.manufacturer).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='frankische';
    // Older conduit sheets append the five-digit EN classification to the
    // family heading. It is not the variant/SKU (the table must still bind it).
    const ownHeading=p.text.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,8).some(line=>plain(line.replace(/\s+\d{5}\s*$/,''))===plain(t.familyTarget.model));
    const row=brandMatches&&ownHeading&&conduitTable(p.text,null,t.familyTarget);
    if(row){evidence={page:p.page,...row};t={...t,documentModel:row.article};via='pdf_article_table';break;}
    continue;
   }
   if(brand==='niedax'){
    const blocks=[...p.text.matchAll(/Ausschreibungstext([\s\S]{0,6500}?)NIEDAX\s+Modell-Nr\.\s*:\s*([^\n]+)/gi)];
    const own=blocks.filter(row=>hasIdentifier(row[2],t.documentModel||t.model)&&plain(row[2])===plain(t.documentModel||t.model));
    if(own.length===1){evidence={page:p.page,text:own[0][0]};break;}
   }
   const row=tableArticle(p.text,t.documentModel||t.model);
   if(row){
    const own=labeledIds(p.text).every(x=>hasIdentifier(x.text,t.documentModel||t.model)||/^(?:GTIN|EAN)\b/i.test(x.text));
    evidence={page:p.page,text:row.single&&own?p.text:row.text};via='pdf_article_table';break;}
   const conduit=conduitTable(p.text,t.documentModel||t.model);
   if(conduit){evidence={page:p.page,...conduit};via='pdf_article_table';break;}
   const vertical=verticalProductTable(p.text,t.documentModel||t.model);
   if(vertical){evidence={page:p.page,text:vertical};via='pdf_product_column';break;}
   const candidates=labeledIds(p.text).filter(x=>hasIdentifier(x.text,t.documentModel||t.model));
   if(candidates.length){const at=candidates[0].index;let window=p.text.slice(at,at+500);
    const identifiers=labeledIds(p.text).filter(x=>x.index>at);if(identifiers.length)window=p.text.slice(at,Math.min(at+500,identifiers[0].index));
    const unique=labeledIds(p.text).every(x=>hasIdentifier(x.text,t.documentModel||t.model));
    if(unique)window=p.text;
    evidence={page:p.page,text:window};break;
   }
  }
  if(!evidence&&t.pageArticleConfirmed&&sourceLinked&&plain(t.documentModel||t.model).length>=4)for(const p of pages){const heading=p.text.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,8).find(x=>plain(x)===plain(t.documentModel||t.model));if(heading){const at=p.text.indexOf(heading),next=labeledIds(p.text).find(x=>x.index>at&&!hasIdentifier(x.text,t.documentModel||t.model));evidence={page:p.page,text:p.text.slice(at,next?.index)};via='pdf_product_heading';break;}}
  if(!evidence&&t.documentModel&&/^\d{13,14}$/.test(t.documentModel))for(const p of pages){if(labeledGtins(p.text).includes(t.documentModel)){evidence={page:p.page,text:p.text};via='pdf_article';break;}}
  const onPage=t.pageArticleConfirmed||labeledIds(pageText).some(x=>hasIdentifier(x.text,t.documentModel||t.model));
  if(!evidence&&manual&&sourceLinked&&onPage&&brandInPdf){
   // Explicit product-specific manufacturer link is stronger than a fuzzy family name.
   evidence={page:pages[0]?.page||1,text:pageText+'\n'+pages.map(p=>p.text).join('\n')};via='manufacturer_product_manual_link';
  }
  if(t.systemModel){
   // Never let the generic manual fallback accept a different system or a
   // component named only on the website. The original PDF must confirm both.
   evidence=undefined;
   if(manual&&sourceLinked&&onPage&&hasIdentifier(pages[0]?.text||'',t.systemModel)){
    for(const p of pages){
     if(!/systemkomponenten/i.test(p.text))continue;
     const line=p.text.split('\n').find(x=>hasIdentifier(x,t.model));
     if(line){evidence={page:p.page,text:line};via='manufacturer_system_manual_link';break;}
    }
   }
  }
  const variant=t.variant||'';
  if(evidence){const sku=evidence.text.match(/Artikelnummer\s*:\s*(\d{6,})/i)?.[1];if(sku)for(const p of pages){const ids=[...p.text.matchAll(/Artikelnummer\s*:\s*(\d{6,})/gi)].map(m=>m[1]);if(ids.length&&ids.every(id=>id===sku))evidence.text+='\n'+verticalDimensions(p.text);}}
  // A graphical logo is acceptable only with the exact labeled PDF article AND
  // a labeled GTIN also present beside that article on its trusted product page.
  const gtin=evidence&&['pdf_article','pdf_article_table'].includes(via)&&sourceLinked?labeledGtins(evidence.text).find(x=>t.sourceGtins?.includes(x)):undefined;
  const manufacturerFound=brandInPdf||Boolean(gtin);
  const variantMatch=Boolean(evidence)&&String(variant).split(/\s*[·;]\s*/).every(part=>variantFound(evidence.text,part)||dimensionEvidence(evidence.text,part,t)||(/^Nenngröße\s+(\d+)$/i.test(part)&&/fr[aä]nkische/i.test(t.manufacturer)&&evidence.nominalSize===Number(part.match(/\d+/)[0]))||cantileverVariantFound(evidence.text,part,t)||rawVariantFound(evidence.text,part,t)||(/^Typ\s+(.+)$/i.test(part)&&hasIdentifier(t.model,part.match(/^Typ\s+(.+)$/i)[1])&&hasIdentifier(evidence.text,t.documentModel||t.model)));
  if(evidence&&t.documentModel&&['pdf_article','pdf_article_table'].includes(via))via='manufacturer_link_alias';
  return {listId:t.listId,position:t.position,manufacturer:t.manufacturer,model:t.model,variant,...(t.documentModel?{documentModel:t.documentModel}:{}),
   ...(evidence&&cantileverVariantFound(evidence.text,variant,t)?{variantEvidence:'niedax_ktum_support_length'}:{}),manufacturerMatched:manufacturerFound,manufacturerEvidence:brandInPdf?'pdf_text':gtin?'manufacturer_product_gtin':null,...(gtin?{gtin}:{}),articleMatched:Boolean(evidence),variantMatched:variantMatch,variantRequired:Boolean(variant),via:evidence?via:null,page:evidence?.page||null,
   ...(evidence&&rawVariantFound(evidence.text,variant,t)?{variantEvidence:'niedax_raw_inside_and_total_width'}:{}),
   state:manufacturerFound&&evidence&&variantMatch?'matched':'unclear',
   reason:!manufacturerFound?'manufacturer_not_in_pdf':!evidence?'article_not_confirmed':!variantMatch?'variant_not_confirmed':null,
   excerpt:evidence?evidence.text.replace(/\s+/g,' ').slice(0,160):''};
 });
 return {state:results.length&&results.every(x=>x.state==='matched')?'matched':'unclear',targets:results,totalPages,pagesChecked:pages.length,truncated:Boolean(truncated),fullTextReturned:false};
}
module.exports={matchDocument,hasIdentifier,labeledIds,labeledGtins,primaryArticle,variantFound,normal,plain};
