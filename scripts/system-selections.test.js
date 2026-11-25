const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {writeJson}=require('../services/jsonService'),{dataFilesForProject}=require('../services/projectArchiveService');
const {syncProjektSysteme,selectionByLeistungsbereich}=require('../services/systemService');
const {buildExportPreview}=require('../services/exportPreviewService');
const area='Elektroinstallation / DIN VDE 0100';
const manufacturer=(name,systems,standards,chapters)=>({name,systemarten:['Testart'],systeme:systems,dokumentarten:['Datenblatt'],normen:standards,kapitel:chapters,geraetelisteKapitel:'6.4'});
const catalog={leistungsbereiche:[{name:area,code:'E',hersteller:[manufacturer('Alpha',['A1','A2'],['Testnorm A'],['4.1']),manufacturer('Beta',['B1'],['Testnorm B'],['4.2'])]}]};
async function setup({root}){
 const files=dataFilesForProject(root,'alice','same');
 await writeJson(path.join(root,'data/systeme.json'),catalog);
 await writeJson(files.leistungsbereiche,{optionen:[area],aktiv:[area],systemAuswahl:{}});
 await writeJson(files.projektSysteme,[{leistungsbereich:area,hersteller:'Alpha',systemart:'Testart',herstellerSystem:'A1',aktiv:true,dokumentarten:['Datenblatt'],custom:{keep:true}}]);
}
module.exports={setup,catalog,area};
test('Mehrere Hersteller und Systeme: echtes MCP, alte Auswahl, gezielte Änderungen und Bestandserhalt',async t=>{
 const f=await fixture({setup}),client=mcpClient(f.base,f.key.token,true);
 const request=(url,options)=>f.request(url,options),etag=async()=>(await request('/projects/same')).etag;
 const get=async()=> (await request('/projects/same/systems?limit=10')).data.data.items;
 const patch=async items=>request('/projects/same/systems',{method:'PATCH',headers:{'If-Match':await etag()},body:{items}});
 const positionsBefore=JSON.parse(f.db.prepare("SELECT payload FROM project_documents WHERE user_id='alice' AND project_id='same' AND name='geraetelisten.json'").get().payload)[0].positionen;
 try{
  await client.initialize();
  const call=async(name,args)=>{const r=await client.rpc('tools/call',{name,arguments:args});assert.ok(!r.error&&!r.result.isError,JSON.stringify(r));return r.result.structuredContent;};
  let legacyId;
  await t.test('Alteintrag ohne Migration lesen und großen Katalog klein durchlaufen',async()=>{
   const before=await etag(),rows=await get();legacyId=rows[0].selectionId;
   assert.ok(legacyId);assert.equal(rows[0].custom.keep,true);assert.equal(await etag(),before);
   const areas=await call('edoku_get_section',{projectId:'same',section:'system-catalog',limit:1});assert.equal(areas.data.items[0].name,area);
   const makers=await call('edoku_get_section',{projectId:'same',section:'system-catalog',serviceArea:area,limit:1});assert.equal(makers.data.total,2);assert.equal(makers.data.items[0].name,'Alpha');
   const opts=await call('edoku_get_section',{projectId:'same',section:'system-catalog',serviceArea:area,manufacturer:'Alpha',limit:1});assert.equal(opts.data.items.length,1);assert.ok(opts.data.total>1);
  });
  await t.test('Zweiter Hersteller und zweites System desselben Herstellers bleiben nebeneinander erhalten',async()=>{
   const r=await call('edoku_select_systems',{projectId:'same',etag:await etag(),selection:{items:[{leistungsbereich:area,add:true,hersteller:'Beta',systemart:'Testart',herstellerSystem:'B1'},{leistungsbereich:area,add:true,hersteller:'Alpha',systemart:'Testart',herstellerSystem:'A2'}]}});
   assert.equal(r.data.selectionIds.length,2);assert.ok(Buffer.byteLength(JSON.stringify(r))<2048);
   const rows=await get();assert.equal(rows.length,3);assert.equal(rows[0].selectionId,legacyId);assert.equal(rows[0].custom.keep,true);
   const replay=await patch([{leistungsbereich:area,add:true,hersteller:'Beta',systemart:'Testart',herstellerSystem:'B1'}]);assert.equal(replay.status,200);assert.equal((await get()).length,3);
   assert.equal((await patch([{leistungsbereich:area,add:true,hersteller:'Beta'}])).status,200);assert.equal((await get()).length,3);
  });
  await t.test('Mehrdeutige Altänderung, unbekannte Kennung, Fremdbereich und Teilfehler überschreiben nichts',async()=>{
   const before=await etag(),rows=await get();
   assert.equal((await patch([{leistungsbereich:area,hersteller:'Alpha'}])).status,409);
   assert.equal((await patch([{leistungsbereich:area,selectionId:'missing',enabled:false}])).status,404);
   assert.equal((await patch([{leistungsbereich:'Fremdbereich',selectionId:legacyId,enabled:false}])).status,400);
   assert.equal((await patch([{leistungsbereich:area,selectionId:legacyId,enabled:false},{leistungsbereich:area,add:true,hersteller:'Unbekannt'}])).status,400);
   assert.equal(await etag(),before);assert.deepEqual(await get(),rows);
   assert.equal((await request('/projects/same/systems',{method:'PATCH',headers:{'If-Match':'"same:0"'},body:{items:[{leistungsbereich:area,selectionId:legacyId,enabled:false}]}})).status,412);
   const readOnly=f.makeToken('alice',{scopes:['projects:read']});assert.equal((await request('/projects/same/systems',{token:readOnly.token,method:'PATCH',headers:{'If-Match':before},body:{items:[{leistungsbereich:area,selectionId:legacyId,enabled:false}]}})).status,403);
  });
  await t.test('Deaktivierung ist gezielt, wiederherstellbar und Zusammenfassung berücksichtigt alle aktiven Systeme',async()=>{
   const beta=(await get()).find(row=>row.hersteller==='Beta');
   assert.equal((await patch([{leistungsbereich:area,selectionId:beta.selectionId,enabled:false}])).status,200);
   let rows=await get();assert.equal(rows.length,3);assert.equal(rows.find(row=>row.selectionId===beta.selectionId).enabled,false);
   let summary=selectionByLeistungsbereich(rows).get(area);assert.equal(summary.hersteller,'Alpha');assert.deepEqual(summary.normen,['Testnorm A']);
   assert.equal((await patch([{leistungsbereich:area,selectionId:beta.selectionId,enabled:true}])).status,200);
   rows=await get();summary=selectionByLeistungsbereich(rows).get(area);assert.deepEqual([...summary.normen].sort(),['Testnorm A','Testnorm B']);
   const sync=syncProjektSysteme(catalog,rows,[area]);assert.equal(sync.length,3);assert.deepEqual(sync.map(row=>row.selectionId),rows.map(row=>row.selectionId));
   const disabled=syncProjektSysteme(catalog,rows,[]),reactivated=syncProjektSysteme(catalog,disabled,[area]);assert.equal(reactivated.length,3);assert.ok(reactivated.every(row=>row.aktiv));
   const preview=buildExportPreview({projektSysteme:rows,exportliste:[{kapitel:'4.1',titel:'Test',leistungsbereich:area}]});assert.match(preview.groups[0].dokumente[0].hersteller,/Alpha.*Beta/);
   const lists=(await request('/projects/same/device-lists?limit=10')).data.data.items;
   const list=lists.find(row=>row.id==='devices');assert.equal(list.herstellerVorauswahl,'');assert.equal(list.positionCount,1);
   const current=(await request('/projects/same/device-lists/devices?limit=1')).data.data.positionen.items[0];
   for(const [key,value]of Object.entries(positionsBefore[0]))assert.deepEqual(current[key],value);
   await f.restart();assert.deepEqual(await get(),rows);
  });
 }finally{await client.close();await f.cleanup();}
});

test('Großer Systemkatalog bleibt über gezielte MCP-Seiten unter der Antwortgrenze',async()=>{
 const f=await fixture({setup:async context=>{await setup(context);const big=structuredClone(catalog);big.leistungsbereiche[0].hersteller.push(...Array.from({length:180},(_,i)=>manufacturer('Testhersteller '+i,Array.from({length:30},(_,j)=>'System '+i+' '+j),['Nur synthetische Norm'],['4.1'])));await writeJson(path.join(context.root,'data/systeme.json'),big);}}),client=mcpClient(f.base,f.key.token);
 try{
  await client.initialize();
  const call=async args=>{const r=await client.rpc('tools/call',{name:'edoku_get_section',arguments:{projectId:'same',section:'system-catalog',...args}});assert.ok(!r.result.isError,JSON.stringify(r));assert.ok(Buffer.byteLength(JSON.stringify(r.result))<8192);return r.result.structuredContent.data;};
  assert.equal((await call({limit:1})).items.length,1);
  const manufacturers=await call({serviceArea:area,limit:3,offset:1});assert.equal(manufacturers.total,182);assert.equal(manufacturers.items[0].name,'Beta');
  const options=await call({serviceArea:area,manufacturer:'Testhersteller 0',limit:3,offset:2});assert.equal(options.items.length,3);assert.ok(options.total>30);
  assert.equal((await f.request('/projects/same/system-catalog?manufacturer=Alpha')).status,400);
 }finally{await client.close();await f.cleanup();}
});

test('GUI ergänzt nur eine Zuordnung und schützt CSRF, Projektversion und deaktivierte Auswahl',async()=>{
 const f=await fixture({setup}),cookies=new Map();
 const request=async(route,options={})=>{const r=await fetch(f.base+route,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of r.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return r;};
 try{
  const login=await(await request('/login')).text(),csrf=login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  assert.equal((await request('/login',{method:'POST',body:new URLSearchParams({email:'alice',password:f.password,_csrf:csrf})})).status,302);
  const page=await(await request('/systemauswahl')).text(),token=page.match(/name="_csrf" value="([a-f0-9]+)"/)[1],revision=page.match(/name="_projectRevision" value="([^"]+)"/)[1];
  assert.match(page,/data-add-system/);assert.match(page,/Alpha · A1/);assert.match(page,/href="\/systemauswahl"/);
  const areasPage=await(await request('/leistungsbereiche')).text();assert.match(areasPage,/href="\/systemauswahl"/);
  const post=fields=>request('/systemauswahl',{method:'POST',body:new URLSearchParams({_csrf:token,_projectRevision:revision,...fields})});
  const fields={leistungsbereich:area,add:'1',hersteller:'Beta',systemart:'Testart',herstellerSystem:'B1',enabled:'1',dokumentarten:'Datenblatt'};
  assert.equal((await request('/systemauswahl',{method:'POST',body:new URLSearchParams(fields)})).status,403);
  assert.equal((await post(fields)).status,302);
  const rows=(await f.request('/projects/same/systems?limit=10')).data.data.items;assert.equal(rows.length,2);assert.equal(rows[0].hersteller,'Alpha');assert.equal(rows[1].hersteller,'Beta');
  assert.equal((await post({...fields,hersteller:'Alpha'})).status,409);
  const refreshed=await(await request('/systemauswahl')).text();assert.match(refreshed,/Beta · B1/);assert.match(refreshed,/name="selectionId"/);
 }finally{await f.cleanup();}
});
