const {fault}=require('../src/api/validation');
function catalogPage(catalog,{serviceArea,manufacturer,limit,offset}){
  const page=items=>({items:items.slice(offset,offset+limit),total:items.length,limit,offset});
  const areas=catalog.leistungsbereiche||[];
  if(!serviceArea){
    if(manufacturer)throw fault('serviceArea für die Herstellerabfrage angeben.',400,'SERVICE_AREA_REQUIRED');
    return {level:'areas',...page(areas.map(area=>({name:area.name,code:area.code||'',manufacturerCount:(area.hersteller||[]).length})))};
  }
  const area=areas.find(row=>row.name===serviceArea);
  if(!area)throw fault('Leistungsbereich fehlt im Katalog.',404,'UNKNOWN_SERVICE_AREA');
  if(!manufacturer)return {level:'manufacturers',serviceArea,...page((area.hersteller||[]).map(row=>({name:row.name,systemCount:(row.systeme||[]).length,systemTypeCount:(row.systemarten||[]).length})))};
  const entry=(area.hersteller||[]).find(row=>row.name===manufacturer);
  if(!entry)throw fault('Hersteller fehlt in diesem Leistungsbereich.',404,'UNKNOWN_MANUFACTURER');
  const items=[];
  for(const [field,kind] of [['systemarten','systemType'],['systeme','system'],['dokumentarten','documentType'],['normen','standard'],['kapitel','chapter']])for(const value of entry[field]||[])items.push({kind,value});
  return {level:'options',serviceArea,manufacturer,deviceListChapter:entry.geraetelisteKapitel||'',...page(items)};
}
module.exports={catalogPage};
