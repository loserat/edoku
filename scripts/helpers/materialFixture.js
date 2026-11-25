const assert=require('node:assert/strict');

async function registerFixtureMaterial(request,projectId,listId){
 const rows=(await request(`/projects/${projectId}/device-lists/${listId}?limit=10`)).data.data.positionen.items;
 const evidence={sourceLabel:'Synthetische vollständige Materialliste',sourceQuote:rows.map(r=>`${r.hersteller} ${r.typ}`).join('; ')};
 const save=async value=>{const result=await request(`/projects/${projectId}/material-import`,{method:'POST',headers:{'If-Match':(await request(`/projects/${projectId}`)).etag},body:{importId:'fixture_material',evidence,...value}});assert.equal(result.status,200,JSON.stringify(result.data));};
 await save({operation:'begin',expectedRows:rows.length});
 await save({operation:'stage',rows:rows.map(r=>({rowId:'device_'+r.pos,text:`${r.hersteller} ${r.typ}`,candidate:{hersteller:r.hersteller,typ:r.typ}}))});
 await save({operation:'resolve',rows:rows.map(r=>({rowId:'device_'+r.pos,disposition:'existing',device:{listId,position:r.pos}}))});
 await save({operation:'finish'});
}

module.exports={registerFixtureMaterial};
