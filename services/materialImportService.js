const {readJson,writeJson}=require('./jsonService');
const {parse,fault}=require('../src/api/validation');
const schemas=require('../src/api/materialImportSchemas');
const policy=require('./documentationMaterialPolicy');
const {createIntegrationService}=require('./integrationService');
const {loadProjectWorkspace}=require('./projectWorkspaceService');
const POLICY='material_dependencies_v1';
const same=(a,b)=>String(a||'').normalize('NFKC').trim().toLocaleLowerCase('de')===String(b||'').normalize('NFKC').trim().toLocaleLowerCase('de');
function registry(project){
 const r=project.assistantMaterialImports;
 if(r===undefined)return null;
 if(r?.version!==1||!Array.isArray(r.imports)||r.imports.length>20)throw fault('Materialimport-Register ist ungültig.',409,'MATERIAL_IMPORT_INVALID');
 return r;
}
function entry(project,importId){const r=registry(project);return r?.imports.find(i=>i.id===(importId||r.activeId));}
function actual(data,ref){const list=data.geraetelisten.find(l=>l.id===ref?.listId&&l.aktiv!==false&&data.leistungsbereiche.aktiv.includes(l.leistungsbereich));return list?.positionen.find((p,i)=>Number(p.pos||i+1)===ref.position);}
function matches(candidate,row){return candidate?.hersteller&&candidate?.typ&&same(candidate.hersteller,row?.hersteller)&&same(candidate.typ,row?.typ)&&['abmessung','farbe'].every(k=>!candidate[k]||same(candidate[k],row[k]));}
function classify(data,row){
 const group=policy.excluded({...row.candidate,beschreibung:row.candidate?.beschreibung||row.text},data.projekt);
 if(group)return 'excluded';
 if(row.disposition==='linked'||row.disposition==='existing')return matches(row.candidate,actual(data,row.device))?row.disposition:'reference_changed';
 if(row.disposition==='clarify')return 'clarify';
 return 'pending';
}
function summary(data,importId){
 const r=registry(data.projekt),i=entry(data.projekt,importId);
 if(!i)return {policy:POLICY,source:r?'material_list_required':'legacy_inventory',recording:r?'missing':'not_recorded',total:0,open:0,inventoryPositions:(data.geraetelisten||[]).reduce((n,l)=>n+(l.positionen?.length||0),0),assignmentComplete:false};
 const counts={};for(const row of i.rows){const s=classify(data,row);counts[s]=(counts[s]||0)+1;}
 const open=(counts.pending||0)+(counts.clarify||0)+(counts.reference_changed||0);
 return {policy:POLICY,source:'material_list',importId:i.id,recording:i.finished?'complete':'receiving',expectedRows:i.expectedRows,total:i.rows.length,open,counts,assignmentComplete:i.finished&&i.rows.length===i.expectedRows&&!open};
}
function target(importId,rowId){return {kind:'material',importId,rowId,field:'assignment'};}
function tasks(data){
 const info=summary(data),i=entry(data.projekt),agent=[],user=[];
 if(info.source==='material_list_required')user.push({code:'REQUEST_MATERIAL_LIST',title:'Materialliste für den beauftragten Umfang bereitstellen.',target:{kind:'material_source',field:'source'},channel:'agent_chat'});
 if(!i)return {summary:info,agent,user};
 for(const row of i.rows){
  const state=classify(data,row);if(!['pending','clarify','reference_changed'].includes(state))continue;
  const t=target(i.id,row.id),base={target:t,materialRow:{importId:i.id,rowId:row.id},tool:'edoku_material_import',context:row.text};
  if(state==='clarify')user.push({...base,code:'CLARIFY_MATERIAL_ROW',title:row.reason||'Materialposition eindeutig zuordnen: '+row.text,channel:'agent_chat',targets:[t]});
  else agent.push({...base,code:state==='reference_changed'?'CHECK_MATERIAL_REFERENCE':row.candidate?.hersteller&&row.candidate?.typ?'MAP_MATERIAL_ROW':'IDENTIFY_MATERIAL_ROW',title:'Materialposition abgleichen und zuordnen: '+row.text,instructions:'Quellzeile einmal gezielt lesen und bestätigte Produktangaben strukturieren. Vorhandene passende Positionen zuerst abgleichen; edoku-Struktur verwenden. Keine Doppelanlage, keine Hersteller oder Varianten raten, keine Gerätewerte überschreiben. Unklare Identität/Zuordnung mit resolve clarify zurückstellen. Erst nach echter Geräteanlage oder geprüftem Bestand als linked/existing auf reale Position beziehen.'});
 }
 if(!i.finished)agent.push({code:'COMPLETE_MATERIAL_IMPORT',title:i.rows.length===i.expectedRows?'Vollständig erfasste Materialquelle abschließen.':'Noch fehlende Materialzeilen aus der bereitgestellten Quelle erfassen.',target:{kind:'material_source',importId:i.id,field:'source'},tool:'edoku_record_material_import',instructions:'Nur nach Abgleich mit der tatsächlichen Quelle abschließen. Erwartete Zeilenzahl nicht zur Statuskosmetik verkleinern. Quelle fehlt: im Chat klären; keine Zeilen erfinden.'});
 return {summary:info,agent,user};
}
function validateTarget(project,t){if(!entry(project,t.importId)?.rows.some(r=>r.id===t.rowId))throw fault('Materialzeile gehört nicht zum Projektimport.',409,'MATERIAL_TARGET_INVALID');}
function questionRelevant(data,q){return !q.targets?.length||!q.targets.every(t=>{
 if(t.kind==='material_source'){const i=entry(data.projekt,t.importId);return Boolean(i&&(t.importId?i.finished:true));}
 if(t.kind==='material'){const i=entry(data.projekt,t.importId),row=i?.rows.find(r=>r.id===t.rowId);return row&&['linked','existing','excluded'].includes(classify(data,row));}
 return false;
});}
function createMaterialImportService(root){
 const integration=createIntegrationService(root);
 async function inspect(auth,projectId,raw={}){
  integration.project(auth,projectId);const q=parse(schemas.query,raw),data=await loadProjectWorkspace(root,auth.user.id,projectId),i=entry(data.projekt,q.importId);
  if(q.importId&&!i)throw fault('Materialquelle wurde nicht gefunden.',404,'NOT_FOUND');
  if(q.section==='source'){const text=i?.source.sourceQuote||'',total=Math.ceil(text.length/1000);return {importId:i?.id||null,section:'source',sourceLabel:i?.source.sourceLabel||'',total,items:Array.from({length:Math.max(0,Math.min(q.limit,total-q.offset))},(_,n)=>({text:text.slice((q.offset+n)*1000,(q.offset+n+1)*1000)})),limit:q.limit,offset:q.offset};}
  let rows=(i?.rows||[]).map(r=>({...r,status:classify(data,r)})).filter(r=>(!q.rowId||r.id===q.rowId)&&(q.status==='all'||['pending','clarify','reference_changed'].includes(r.status)));
  const total=rows.length;rows=rows.slice(q.offset,q.offset+q.limit).map(r=>({rowId:r.id,text:r.text,candidate:r.candidate||{},status:r.status,...(r.device?{device:r.device}:{}),...(r.reason?{reason:r.reason}:{})}));
  for(const row of rows){const refs=data.geraetelisten.filter(l=>l.aktiv!==false&&data.leistungsbereiche.aktiv.includes(l.leistungsbereich)).flatMap(l=>l.positionen.flatMap((p,n)=>matches(row.candidate,p)?[{listId:l.id,position:Number(p.pos||n+1)}]:[]));row.existingCandidates=refs.slice(0,3);row.existingCandidatesTotal=refs.length;}
  const result={summary:summary(data,q.importId),importId:i?.id||null,...(i?{sourceLabel:i.source.sourceLabel,sourceQuote:i.source.sourceQuote.slice(0,500),sourceQuoteTruncated:i.source.sourceQuote.length>500}:{}),items:rows,total,limit:q.limit,offset:q.offset,hasMore:q.offset+rows.length<total};
  while(result.items.length>1&&Buffer.byteLength(JSON.stringify(result))>6500)result.items.pop();
  result.hasMore=q.offset+result.items.length<total;result.nextOffset=result.hasMore?q.offset+result.items.length:null;
  if(Buffer.byteLength(JSON.stringify(result))>7000)throw fault('Einzelzeile zu groß für kompakte Ausgabe.',413,'RESPONSE_LIMIT');
  return result;
 }
 async function record(auth,projectId,etag,raw){
  const value=parse(schemas.input,raw);
  return integration.mutate(auth,projectId,etag,async files=>{
   const p=await readJson(files.projekt,{}),data=await loadProjectWorkspace(root,auth.user.id,projectId),before=JSON.stringify(p.assistantMaterialImports||null);
   const r=registry(p)||{version:1,activeId:null,imports:[]};let i=r.imports.find(x=>x.id===value.importId);
   if(value.operation==='begin'){
    if(i){if(i.expectedRows!==value.expectedRows||i.source.sourceLabel!==value.evidence.sourceLabel||i.source.sourceQuote!==value.evidence.sourceQuote)throw fault('Importkennung bereits anders belegt.',409,'MATERIAL_IMPORT_CONFLICT');}
    else {if(r.imports.length>=20)throw fault('Importhistorie voll; vorhandene Quellen erhalten.',409,'MATERIAL_IMPORT_LIMIT');if(entry({...p,assistantMaterialImports:r})&&!entry({...p,assistantMaterialImports:r}).finished)throw fault('Aktuelle Quelle zuerst vollständig erfassen.',409,'MATERIAL_IMPORT_INCOMPLETE');i={id:value.importId,expectedRows:value.expectedRows,source:value.evidence,rows:[],history:[],finished:false};r.imports.push(i);r.activeId=i.id;}
   }else{
    if(!i)throw fault('Materialimport fehlt; Quelle zuerst registrieren.',409,'MATERIAL_IMPORT_MISSING');
    if(value.operation==='finish'){if(i.rows.length!==i.expectedRows)throw fault('Nicht alle Quellzeilen erfasst.',409,'MATERIAL_IMPORT_INCOMPLETE');i.finished=true;}
    if(value.operation==='stage'){
     if(i.finished)throw fault('Abgeschlossene Quelle nicht erweitern; neue Importkennung verwenden.',409,'MATERIAL_IMPORT_FINISHED');
     for(const v of value.rows){const old=i.rows.find(x=>x.id===v.rowId);if(old){if(old.text!==v.text||JSON.stringify(old.candidate||{})!==JSON.stringify(v.candidate||{}))throw fault('Quellzeile ist unveränderlich; Ergänzungen über resolve speichern.',409,'MATERIAL_ROW_CONFLICT');continue;}i.rows.push({id:v.rowId,text:v.text,candidate:v.candidate||{},disposition:'pending'});}
     if(i.rows.length>i.expectedRows)throw fault('Mehr Zeilen als für diese Quelle angegeben.',409,'MATERIAL_IMPORT_COUNT');
    }
    if(value.operation==='resolve')for(const v of value.rows){
     const row=i.rows.find(x=>x.id===v.rowId);if(!row)throw fault('Materialzeile fehlt.',409,'MATERIAL_TARGET_INVALID');
     if(v.candidate)row.candidate={...row.candidate,...v.candidate};
     if(['linked','existing'].includes(v.disposition)&&(!v.device||!matches(row.candidate,actual(data,v.device))))throw fault('Zuordnung muss auf ein reales aktives Gerät desselben Artikels verweisen.',409,'MATERIAL_REFERENCE_INVALID');
     if(v.disposition==='excluded'&&!policy.excluded({...row.candidate,beschreibung:row.candidate?.beschreibung||row.text},p))throw fault('Keine passende Ausschlussregel aktiv.',409,'MATERIAL_EXCLUSION_INVALID');
     if(v.disposition==='clarify'&&!v.reason)throw fault('Konkreten Klärungsgrund angeben.',400,'VALIDATION_ERROR');
     row.disposition=v.disposition==='resume'?'pending':v.disposition;if(v.device)row.device=v.device;if(v.reason)row.reason=v.reason;
    }
   }
   if(before===JSON.stringify(r)&&i.history.some(({at,by,...previous})=>JSON.stringify(previous)===JSON.stringify(value)))return {importId:i.id,operation:value.operation,changed:false,summary:summary({...data,projekt:p},i.id)};
   if(i.history.length>=1000)throw fault('Importhistorie voll.',409,'MATERIAL_IMPORT_LIMIT');
   i.history.push({at:new Date().toISOString(),by:auth.user.id,...value});p.assistantMaterialImports=r;await writeJson(files.projekt,p);
   return {importId:i.id,operation:value.operation,summary:summary({...data,projekt:p},i.id)};
  },{skipUnchanged:true});
 }
 return {inspect,record};
}
module.exports={POLICY,summary,tasks,entry,classify,validateTarget,questionRelevant,createMaterialImportService};
