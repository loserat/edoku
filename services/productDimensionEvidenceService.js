// Optional stored catalogue dimensions still need exact, named product evidence.
// No inferred tolerances, packaging dimensions or neighbouring SKU measurements.
const number='\\d+(?:[.,]\\d+)*';
const mm=value=>Number(String(value).replace(/(?<=\d)\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.'));
function allMatch(text,pattern,expected){
 const found=[...String(text).matchAll(new RegExp(pattern,'gi'))];
 return found.length>0&&found.every(row=>expected.every((value,index)=>mm(row[index+1])===mm(value)));
}
function dimensionEvidence(text,variant,target={}){
 const simple=String(variant).match(new RegExp('^('+number+')\\s*[×x]\\s*('+number+')(?:\\s*[×x]\\s*('+number+'))?\\s*mm$','i'));
 if(simple){
  const brand=String(target.manufacturer||'').toLowerCase().replace(/[^a-z]/g,''),[a,b,c]=simple.slice(1);
  if(brand==='niedax'&&/^KSL\s+\d+\.\d+\/\d+\s+S$/i.test(target.model||'')&&c){
   const pair='(?:Höhe\\s+H(?:\\s*\\(außen\\))?\\s*[×x]\\s*Breite\\s+B(?:\\s*\\(außen\\))?|Abmessungen\\s*\\(ca\\.?\\s*Maße\\)\\s*H\\s*[×x]\\s*B)\\s*:\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\b';
   return allMatch(text,pair,[a,b])&&allMatch(text,'Lieferlänge\\s+L\\s*:\\s*('+number+')\\s*mm\\b',[c]);
  }
  const dimensions='Länge\\s*[×x]\\s*Breite\\s*[×x]\\s*Höhe\\s*:?\\s*';
  if(brand==='obobettermann'&&target.model==='GS-OTRW'&&!c)return allMatch(text,dimensions+'('+number+')\\s*[×x]\\s*('+number+')\\s*[×x]\\s*'+number+'\\s*mm\\b',[b,a]);
  if(brand==='obobettermann'&&target.model==='GS-TW70'&&c)return allMatch(text,dimensions+'('+number+')\\s*[×x]\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\b',[c,b,a]);
 }
 const triple=String(variant).match(new RegExp('^('+number+')\\s*[×x]\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\s*\\(\\s*L\\s*[×x]\\s*B\\s*[×x]\\s*H\\s*\\)$','i'));
 if(triple)return allMatch(text,'Länge\\s*[×x]\\s*Breite\\s*[×x]\\s*Höhe\\s*:?\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\b',triple.slice(1));
 const pair=String(variant).match(new RegExp('^(ca\\.\\s*)?('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\s*\\(\\s*H\\s*[×x]\\s*(B|lichte\\s+B|Umkantung)\\s*\\)(?:,\\s*(?:Lieferlänge\\s+('+number+')\\s*mm|('+number+')\\s*°))?$','i'));
 if(pair){
  if(pair[1]&&!/Abmessungen\s*\(ca\.?\s*Maße\)/i.test(text))return false;
  const inside=/lichte/i.test(pair[4]),fold=/Umkantung/i.test(pair[4]);
  const label=fold?'Umkantung(?:\\s+U)?':inside?'Breite\\s+B\\s*\\(innen\\)':'Breite\\s+B';
  const exact=allMatch(text,'Höhe\\s+H\\s*[×x]\\s*'+label+'\\s*:\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\b',[pair[2],pair[3]]);
  const nominal=pair[1]&&pair[4].toUpperCase()==='B'&&allMatch(text,'Abmessungen\\s*\\(ca\\.?\\s*Maße\\)\\s*H\\s*[×x]\\s*B\\s*:\\s*('+number+')\\s*[×x]\\s*('+number+')\\s*mm\\b',[pair[2],pair[3]]);
  if(!exact&&!nominal)return false;
  if(pair[5]&&!allMatch(text,'Lieferlänge\\s+L\\s*:\\s*('+number+')\\s*mm\\b',[pair[5]]))return false;
  if(pair[6]&&!new RegExp('(?<![\\d.,])'+pair[6].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*°').test(text))return false;
  return true;
 }
 const connector=String(variant).match(new RegExp('^Höhe\\s+('+number+')\\s*mm,\\s*für\\s+Rinnen\\s+mit\\s+('+number+')\\s*mm\\s+Kantenhöhe$','i'));
 if(connector)return allMatch(text,'Höhe\\s+H\\s*:\\s*('+number+')\\s*mm\\b',[connector[1]])&&allMatch(text,'Verwendung\\s+für\\s*:\\s*Kabelrinnen\\s+mit\\s+('+number+')\\s*mm\\s+Kantenhöhe',[connector[2]]);
 return false;
}
module.exports={dimensionEvidence};
