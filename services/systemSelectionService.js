const crypto = require('node:crypto');
const { systemSelection } = require('../src/api/schemas');
const { parse, fault } = require('../src/api/validation');
const { systemSelectionsWithIds, normalizePostedProjektSysteme, projectSystemCatalog } = require('./systemService');
const { readJson, writeJson } = require('./jsonService');
const { syncDeviceListsPreservingFields } = require('./projectWorkspaceService');

// Shared by session-bound GUI and token-bound API; callers retain their own transaction/role guards.
async function saveSystemSelections(data, raw) {
  const originalLists=await readJson(data.files.geraetelisten,[]);
  if(!Array.isArray(originalLists)||originalLists.some(list=>!list||!Array.isArray(list.positionen)))throw fault('Das ältere Geräteformat muss vor einer Änderung geprüft werden.',409,'LEGACY_DEVICE_FORMAT');
  const input=parse(systemSelection,raw), entries=systemSelectionsWithIds(data.projektSysteme);
  if(new Set(entries.map(row=>row.selectionId)).size!==entries.length)throw fault('Doppelte Systemkennungen im Bestand. Auswahl zuerst prüfen.',409,'AMBIGUOUS_SYSTEM_SELECTION');
  const touched=new Set(), additions=[];
  let catalog=data.systemConfig;
  for(const item of input.items){
    if(!data.leistungsbereiche.aktiv.includes(item.leistungsbereich))throw fault('Systemauswahl gehört nicht zu einem aktiven Leistungsbereich.',400,'UNKNOWN_SERVICE_AREA');
    if(item.add && item.selectionId)throw fault('Neue Auswahl ohne vorhandene Kennung hinzufügen.',400,'VALIDATION_ERROR');
    const areaRows=entries.filter(row=>row.leistungsbereich===item.leistungsbereich);
    let current;
    if(item.selectionId){
      current=entries.find(row=>row.selectionId===item.selectionId);
      if(!current||current.leistungsbereich!==item.leistungsbereich)throw fault('Systemauswahl wurde nicht gefunden.',404,'SYSTEM_SELECTION_NOT_FOUND');
    }else if(item.add){
      // Retrying an addition with the same tuple cannot create a duplicate.
      current=areaRows.find(row=>['hersteller','systemart','herstellerSystem'].every(key=>(row[key]||'')===(item[key]||'')));
    }else{
      if(areaRows.length>1)throw fault('Mehrere Auswahlen vorhanden. selectionId angeben oder add=true verwenden.',409,'AMBIGUOUS_SYSTEM_SELECTION');
      current=areaRows[0];
    }
    const next={...current,...item,selectionId:current?.selectionId||'sys_'+crypto.randomBytes(12).toString('hex')};
    delete next.add;
    if(touched.has(next.selectionId))throw fault('Systemauswahl wurde mehrfach angegeben.',400,'VALIDATION_ERROR');
    touched.add(next.selectionId);
    if(item.evidence){additions.push({...item});catalog=projectSystemCatalog(catalog,{systemErgaenzungen:[item]});}
    const area=catalog.leistungsbereiche.find(row=>row.name===next.leistungsbereich);
    const manufacturer=area?.hersteller.find(row=>row.name===next.hersteller);
    if(!manufacturer)throw fault('Hersteller ist für diesen Leistungsbereich nicht hinterlegt.',400,'UNKNOWN_MANUFACTURER');
    if(current?.hersteller!==next.hersteller){
      next.systemart=item.systemart??manufacturer.systemarten?.[0]??'';
      next.herstellerSystem=item.herstellerSystem??manufacturer.systeme?.[0]??'';
      next.dokumentarten=item.dokumentarten??manufacturer.dokumentarten??[];
    }
    for(const [key,values] of [['systemart','systemarten'],['herstellerSystem','systeme']])if(next[key]&&!(manufacturer[values]||[]).includes(next[key]))throw fault('Systemauswahl passt nicht zum Herstellerkatalog.',400,'UNKNOWN_SYSTEM');
    if((next.dokumentarten||[]).some(type=>!(manufacturer.dokumentarten||[]).includes(type)))throw fault('Dokumentart passt nicht zum Herstellerkatalog.',400,'UNKNOWN_DOCUMENT_TYPE');
    const duplicate=entries.find(row=>row.selectionId!==next.selectionId && row.leistungsbereich===next.leistungsbereich && ['hersteller','systemart','herstellerSystem'].every(key=>(row[key]||'')===(next[key]||'')));
    if(duplicate){
      if(!item.add)throw fault('Diese Hersteller-/Systemkombination ist bereits vorhanden.',409,'DUPLICATE_SYSTEM_SELECTION');
      touched.delete(next.selectionId);
      if(touched.has(duplicate.selectionId))throw fault('Systemauswahl wurde mehrfach angegeben.',400,'VALIDATION_ERROR');
      Object.assign(next,{...duplicate,...next,selectionId:duplicate.selectionId});current=duplicate;touched.add(next.selectionId);
    }
    const normalized=normalizePostedProjektSysteme([next],catalog,data.leistungsbereiche.aktiv)[0];
    if(current)entries[entries.indexOf(current)]=normalized;else entries.push(normalized);
  }
  if(entries.length>500)throw fault('Höchstens 500 Systemauswahlen je Projekt.',409,'SYSTEM_SELECTION_LIMIT');
  if(additions.length){
    const originalProject=await readJson(data.files.projekt,{});
    const project={...originalProject,systemErgaenzungen:[...(originalProject.systemErgaenzungen||[])]};
    for(const item of additions)if(!project.systemErgaenzungen.some(old=>JSON.stringify(old)===JSON.stringify(item)))project.systemErgaenzungen.push(item);
    if(project.systemErgaenzungen.length>200)throw fault('Projektkatalog hat die maximale Größe erreicht.',409,'CATALOG_LIMIT');
    await writeJson(data.files.projekt,project);
  }
  await writeJson(data.files.projektSysteme,entries);
  await writeJson(data.files.geraetelisten,syncDeviceListsPreservingFields(originalLists,data.leistungsbereiche.aktiv,entries));
  return {selectionIds:[...touched],changedCount:touched.size,total:entries.length};
}
module.exports={saveSystemSelections};
