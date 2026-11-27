const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./helpers/integrationFixture');
const presentation=require('../services/integrationPresentationService');
async function browser(f,user='alice'){
 const cookies=new Map();
 const request=async(route,options={})=>{const response=await fetch(f.base+route,{redirect:'manual',...options,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;};
 const html=await(await request('/login')).text(),csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
 assert.equal((await request('/login',{method:'POST',body:new URLSearchParams({email:user,password:f.password,_csrf:csrf})})).status,302);
 return request;
}
test('Katalog bleibt aus dem Vertrag abgeleitet, vollständig, paginiert und ohne Eingabeschemas',()=>{
 const overview=presentation.summary(),names=[];assert.equal(overview.total,58);assert.equal(overview.read,22);assert.equal(overview.write,36);assert.equal(overview.clientStatus,'unknown');
 for(let offset=0;offset<overview.total;offset+=12){const page=presentation.toolPage({offset});assert.ok(page.items.length<=12);page.items.forEach(tool=>{assert.ok(!tool.inputSchema);assert.ok(tool.description.length<=220);names.push(tool.name);});}
 assert.equal(new Set(names).size,overview.total);assert.equal(overview.groups.reduce((n,g)=>n+g.count,0),overview.total);
 assert.ok(presentation.toolPage({mode:'read'}).items.every(t=>t.readOnly));assert.ok(presentation.toolPage({mode:'write'}).items.every(t=>!t.readOnly));
 assert.ok(presentation.toolPage({mode:'sensitive'}).items.every(t=>t.sensitive&&!t.readOnly));assert.equal(presentation.toolPage({search:'kein_treffer_xyz'}).total,0);
 assert.equal(presentation.toolPage({search:'edoku_reset_project'}).items[0].group,'recovery');
});
test('Sitzungsdiagnose schützt eigene Zugänge, Projektgrenzen und Bestand',async()=>{
 const f=await fixture();try{
  const foreign=f.makeToken('bob'),own=f.makeToken('alice',{name:'Begrenzt',scopes:['projects:read'],projectIds:['same']});
  const ui=await browser(f),snapshot=JSON.stringify(f.tokens.list('alice'));
  const settingsPage=await ui('/einstellungen');assert.equal(settingsPage.headers.get('cache-control'),'no-store');const html=await settingsPage.text();assert.match(html,/data-mcp-step="0"/);assert.match(html,/data-tool-list/);assert.match(html,/data-integration-diagnosis/);assert.doesNotMatch(html,new RegExp(own.token));
  const response=await ui('/integrationen/diagnose?'+new URLSearchParams({keyId:own.id,projectId:'second',profile:'full'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.checks.find(c=>c.id==='project').state,'error');assert.equal(result.checks.find(c=>c.id==='rights').state,'warning');assert.equal(result.checks.find(c=>c.id==='client').state,'unknown');
  assert.equal((await ui('/integrationen/diagnose?keyId='+foreign.id)).status,404);
  assert.equal((await ui('/integrationen/diagnose?projectId=unbekannt')).status,404);
  for(const query of ['limit=58','offset=-1','search='+('x'.repeat(81)),'group=bad','mode=bad','url=https://example.com'])assert.equal((await ui('/integrationen/werkzeuge?'+query)).status,400);
  const catalog=await(await ui('/integrationen/werkzeuge?mode=read')).json();assert.equal(catalog.total,22);assert.equal(catalog.items.length,12);assert.ok(JSON.stringify(catalog).length<6000);
  assert.equal((await fetch(f.base+'/integrationen/werkzeuge',{redirect:'manual',headers:{Authorization:'Bearer '+own.token}})).status,302);
  await fs.writeFile(path.join(f.root,'config/integrationen.json'),JSON.stringify({apiEnabled:false,allowWrites:false,defaultTokenDays:30,maxTokenDays:90}));
  const disabled=await(await ui('/integrationen/diagnose?profile=full')).json();assert.equal(disabled.checks.find(c=>c.id==='api').state,'error');assert.equal(disabled.checks.find(c=>c.id==='writes').state,'error');
  await fs.writeFile(path.join(f.root,'config/integrationen.json'),JSON.stringify({apiEnabled:'invalid'}));assert.equal((await ui('/integrationen/diagnose')).status,503);
  assert.equal(JSON.stringify(f.tokens.list('alice')),snapshot);const count=name=>f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)?f.db.prepare('SELECT count(*) n FROM '+name).get().n:0;assert.equal(count('document_review_views'),0);
  assert.equal(count('document_proposals'),0);
 }finally{await f.cleanup();}
});
test('GUI-Abrufe und Diagnose legen keine neue Schlüsseltabelle an; Viewer erhält keine Schreibverwaltung',async()=>{
 const f=await fixture();try{
  f.db.exec('DROP TABLE api_tokens');const ui=await browser(f,'viewer');
  const html=await(await ui('/einstellungen')).text();assert.doesNotMatch(html,/data-api-key-form|action="\/einstellungen\/integrationen/);assert.match(html,/data-integration-diagnosis/);
  assert.equal((await ui('/integrationen/werkzeuge')).status,200);assert.equal((await ui('/integrationen/diagnose?profile=full')).status,200);
  assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='api_tokens'").get().n,0);
 }finally{await f.cleanup();}
});
