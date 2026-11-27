const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {fixture,mcpClient}=require('./helpers/integrationFixture');
const {createRemoteMcpHandler,MAX_BODY_BYTES}=require('../services/remoteMcpService');
const {PROTOCOL_VERSION_META_KEY,CLIENT_CAPABILITIES_META_KEY}=require('@modelcontextprotocol/server');
const {createIntegrationSettingsService}=require('../services/integrationSettingsService');
const tls={Host:'edoku.test','X-Forwarded-Proto':'https'};
const init={protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'remote-test',version:'1'}};
const message=(method,params={},id=1)=>({jsonrpc:'2.0',id,method,params});
async function remote(f,rpc,{token=f.key.token,route='/mcp',method='POST',headers={},body}={}){
 const response=await new Promise((resolve,reject)=>{const req=http.request(f.base+route,{method,headers:{...tls,...(token?{Authorization:'Bearer '+token}:{}),Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25',...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(res.headers),text:async()=>Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(method==='POST'?(body??JSON.stringify(rpc)):undefined);});
 const text=await response.text();let data;
 try{data=JSON.parse(text);}catch{const lines=text.split('\n').filter(line=>line.startsWith('data:'));if(lines.length)data=JSON.parse(lines.at(-1).slice(5));}
 assert.ok(!response.headers.has('set-cookie'),'MCP darf keine GUI-Sitzung anlegen');
 return {status:response.status,data,text,headers:response.headers};
}
const call=(f,name,args={},options={})=>remote(f,message('tools/call',{name,arguments:args}),options);
async function list(f,options={}){const tools=[];let cursor;do{const r=await remote(f,message('tools/list',cursor?{cursor}:{}),options);assert.equal(r.status,200,r.text);assert.ok(r.data.result,r.text);tools.push(...r.data.result.tools);cursor=r.data.result.nextCursor;}while(cursor);return tools;}
function value(r){assert.equal(r.status,200,r.text);assert.ok(r.data?.result,!r.data?.error&&r.text);return r.data.result.structuredContent;}

test('Remote-MCP: auslieferungssicher, HTTPS/Bearer, Protokoll, Benutzergrenzen und unveränderte Freigaben',async t=>{
 const f=await fixture({env:{APP_ORIGIN:'https://edoku.test',TRUST_PROXY:'true'}});
 const settings=createIntegrationSettingsService(f.root);
 try{
  await t.test('Default ist aus; Einschalten ändert keine Schlüssel',async()=>{
   assert.equal((await settings.read()).remoteMcpEnabled,false);
   assert.equal((await remote(f,message('initialize',init))).status,404);
   const keys=JSON.stringify(f.tokens.list('alice'));await settings.save({...(await settings.read()),remoteMcpEnabled:true});
   assert.equal(JSON.stringify(f.tokens.list('alice')),keys);
  });
  await t.test('HTTPS, Host, Herkunft, Cookie-Fallback und Header werden geprüft',async()=>{
   const invalid=[{headers:{'X-Forwarded-Proto':'http'},status:403},{headers:{Host:'fremd.test'},status:403},{headers:{Origin:'https://fremd.test'},status:403},{headers:{Origin:'null'},status:403},{headers:{'Sec-Fetch-Site':'cross-site'},status:403},{token:null,headers:{Cookie:'dm_session=falsch'},status:401},{token:'falsch',status:401}];
   for(const {status,...options} of invalid)assert.equal((await remote(f,message('initialize',init),options)).status,status);
   for(const method of ['GET','DELETE','OPTIONS'])assert.equal((await remote(f,null,{method})).status,405);
   for(const route of ['/mcp?token=secret','/mcp?access=bad','/mcp?access=write&access=read'])assert.equal((await remote(f,message('initialize',init),{route})).status,400);
   for(const headers of [{'Content-Type':'text/plain'},{'Content-Encoding':'gzip'}])assert.equal((await remote(f,message('initialize',init),{headers})).status,415);
   const duplicate=await new Promise((resolve,reject)=>{const req=http.request(f.base+'/mcp',{method:'POST',headers:{...tls,Authorization:['Bearer '+f.key.token,'Bearer '+f.key.token],'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(JSON.stringify(message('initialize',init)));});assert.equal(duplicate,400);
   const r=await remote(f,message('initialize',init),{headers:{Origin:'https://edoku.test'}});assert.equal(r.status,200,r.text);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.has('mcp-session-id'),false);
  });
  await t.test('Legacy und modernes MCP initialisieren ohne gemeinsame Sitzung',async()=>{
   const r=await remote(f,message('initialize',init));assert.equal(r.data.result.serverInfo.version,'3.16.0');assert.ok(r.data.result.capabilities.tools);
   const notification=await remote(f,{jsonrpc:'2.0',method:'notifications/initialized'});assert.equal(notification.status,202);
   const modern=await remote(f,message('server/discover',{_meta:{[PROTOCOL_VERSION_META_KEY]:'2026-07-28',[CLIENT_CAPABILITIES_META_KEY]:{}}}),{headers:{'MCP-Protocol-Version':'2026-07-28','Mcp-Method':'server/discover'}});assert.equal(modern.status,200,modern.text);assert.ok(modern.data.result,modern.text);
   for(const body of ['{','[]',JSON.stringify([message('tools/list')])]){const bad=await remote(f,null,{body});assert.ok(bad.status>=400||bad.data?.error,bad.text);}
   const tooLarge=await remote(f,null,{body:JSON.stringify(message('unknown',{large:'x'.repeat(MAX_BODY_BYTES)}))});assert.equal(tooLarge.status,413,tooLarge.text);
  });
  await t.test('Alle 58 Werkzeuge nur mit ausdrücklichem Schreibmodus, keine Freigabewerkzeuge',async()=>{
   assert.equal((await list(f)).length,22);
   const full=await list(f,{route:'/mcp?access=write'});assert.equal(full.length,58);assert.ok(!full.some(tool=>/approve|release_document/.test(tool.name)));
   assert.ok((await call(f,'edoku_patch_project',{projectId:'same',etag:'"project:1"',changes:{projektname:'verboten'}})).data.error||(await call(f,'edoku_patch_project',{})).data.result?.isError);
   const limited=f.makeToken('alice',{scopes:['projects:read'],projectIds:['same']});assert.equal((await list(f,{route:'/mcp?access=write',token:limited.token})).length,22);
   await settings.save({...(await settings.read()),allowWrites:false});assert.equal((await list(f,{route:'/mcp?access=write'})).length,22);
   await settings.save({...(await settings.read()),allowWrites:true});
  });
  await t.test('Benutzer, Projektgrenzen und Schlüsselstatus werden je Anfrage neu geprüft',async()=>{
   const bob=f.makeToken('bob');const identities=await Promise.all([call(f,'edoku_identity'),call(f,'edoku_identity',{}, {token:bob.token})]);assert.deepEqual(identities.map(r=>value(r).data.userId),['alice','bob']);
   const limited=f.makeToken('alice',{scopes:['projects:read'],projectIds:['same']});const denied=await call(f,'edoku_get_project',{projectId:'second'},{token:limited.token});assert.ok(denied.data.result.isError);
   const revoked=f.makeToken();f.tokens.revoke('alice',revoked.id);assert.equal((await remote(f,message('tools/list'),{token:revoked.token})).status,401);
   const expired=f.makeToken();f.db.prepare("UPDATE api_tokens SET expires_at='2000-01-01' WHERE id=?").run(expired.id);assert.equal((await remote(f,message('tools/list'),{token:expired.token})).status,401);
   f.db.prepare("UPDATE users SET role='viewer' WHERE id='bob'").run();assert.equal((await list(f,{token:bob.token,route:'/mcp?access=write'})).length,22);
   f.db.prepare("UPDATE users SET status='disabled' WHERE id='bob'").run();assert.equal((await remote(f,message('tools/list'),{token:bob.token})).status,401);
   f.db.prepare("UPDATE users SET status='active',password_hash='changed' WHERE id='bob'").run();assert.equal((await remote(f,message('tools/list'),{token:bob.token})).status,401);
  });
  await t.test('Erlaubte Einzeländerung nutzt ETag und erhält fremde Daten und Freigaben',async()=>{
   const before=await f.request('/projects/same');const other=await f.request('/projects/second');
   const changed=await call(f,'edoku_patch_project',{projectId:'same',etag:before.etag,changes:{projektname:'Remote-Test'}},{route:'/mcp?access=write'});assert.equal(changed.data.result.isError,undefined,changed.text);
   const after=await f.request('/projects/same');assert.equal(after.data.data.projekt.projektname,'Remote-Test');assert.deepEqual(after.data.data.projekt.custom,{keep:true});assert.deepEqual((await f.request('/projects/second')).data.data,other.data.data);
   const stale=await call(f,'edoku_patch_project',{projectId:'same',etag:before.etag,changes:{projektname:'Alt'}},{route:'/mcp?access=write'});assert.ok(stale.data.result.isError);
   const proposal=await call(f,'edoku_propose_document',{projectId:'same',jobId:'no-job',filePath:'/app/config/systemEinstellungen.json',metadata:{title:'Test',category:'Allgemein',sourceLabel:'Test',reason:'Test'}},{route:'/mcp?access=write'});assert.ok(proposal.data.result.isError);assert.match(proposal.text,/REMOTE_FILE_PATH_UNSUPPORTED/);
   for(const table of ['document_review_views','document_proposals']){const exists=f.db.prepare("SELECT 1 FROM sqlite_master WHERE name=? AND type='table'").get(table);if(exists)assert.equal(f.db.prepare('SELECT count(*) n FROM '+table).get().n,0);}
   const stdio=mcpClient(f.base,f.key.token,true);try{await stdio.initialize();assert.equal((await stdio.rpc('tools/list',{})).result.tools.length,58);}finally{await stdio.close();}
  });
  await t.test('Ausschalten wirkt sofort; Konfigurationsfehler scheitern geschlossen',async()=>{
   await settings.save({...(await settings.read()),remoteMcpEnabled:false});assert.equal((await remote(f,message('tools/list'))).status,404);
   await fs.writeFile(path.join(f.root,'config/integrationen.json'),'{bad');const r=await remote(f,message('tools/list'));assert.equal(r.status,503);assert.ok(!r.text.includes(f.key.token));
  });
 }finally{await f.cleanup();}
});

test('Remote-Ziel und öffentliche HTTPS-Konfiguration werden streng begrenzt',async()=>{
 assert.throws(()=>createRemoteMcpHandler({apiBaseUrl:'https://evil.test'}),/Loopback/);
 const tokens={authenticate:()=>({user:{id:'a'},token:{scopes:[]}})},settings={read:async()=>({apiEnabled:true,remoteMcpEnabled:true})};
 for(const publicOrigin of [undefined,'http://edoku.test','https://edoku.test/path','https://a:b@edoku.test','https://edoku.test?q=1']){
  const handler=createRemoteMcpHandler({tokens,settings,apiBaseUrl:'http://127.0.0.1:3000',publicOrigin});let code;const res={set(){return this;},status(n){code=n;return this;},json(){}};await handler({},res);assert.equal(code,503);
 }
});

test('Lang laufende und abgebrochene Werkzeugaufrufe bleiben bis Arbeitsende begrenzt',async()=>{
 const express=require('express'),tokensByKey=new Map(),pending=[];
 const key=n=>'edoku_'+String(n).repeat(24)+'.'+'a'.repeat(64);
 for(let n=1;n<=3;n++)tokensByKey.set(key(n),{user:{id:String(n),role:'user'},token:{scopes:['projects:read']}});
 const api=http.createServer((req,res)=>pending.push(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,data:{userId:'synthetic'}}));}));await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 const app=express();app.set('trust proxy','loopback');app.all('/mcp',createRemoteMcpHandler({apiBaseUrl:'http://127.0.0.1:'+api.address().port,publicOrigin:'https://edoku.test',tokens:{authenticate:value=>tokensByKey.get(value)},settings:{read:async()=>({apiEnabled:true,remoteMcpEnabled:true})},maxActive:2,maxPerUser:1}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const f={base:'http://127.0.0.1:'+server.address().port,key:{token:key(1)}};
 const waitFor=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Testarbeit wurde nicht gestartet');};
 let first;try{
  first=http.request(f.base+'/mcp',{method:'POST',headers:{...tls,Authorization:'Bearer '+key(1),Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'}},res=>res.resume());first.on('error',()=>{});first.end(JSON.stringify(message('tools/call',{name:'edoku_identity',arguments:{}})));await waitFor(()=>pending.length===1);
  assert.equal((await call(f,'edoku_identity')).status,429);first.destroy();await new Promise(resolve=>setTimeout(resolve,30));assert.equal((await call(f,'edoku_identity')).status,429);
  const second=call(f,'edoku_identity',{}, {token:key(2)});await waitFor(()=>pending.length===2);assert.equal((await call(f,'edoku_identity',{}, {token:key(3)})).status,429);
  pending.splice(0).forEach(done=>done());assert.equal((await second).status,200);await new Promise(resolve=>setTimeout(resolve,30));
  const again=call(f,'edoku_identity');await waitFor(()=>pending.length===1);pending.splice(0).forEach(done=>done());assert.equal((await again).status,200);
 }finally{first?.destroy();pending.splice(0).forEach(done=>done());server.closeAllConnections();api.closeAllConnections();await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>api.close(resolve))]);}
});
