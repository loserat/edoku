const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), nodeFs = require('node:fs'), path = require('node:path'), os = require('node:os'), ejs = require('ejs');
const { jsonForHtml } = require('../services/htmlDataService');
const { createRequestLimiter, createResourceGuard } = require('../services/requestSecurityService');
const { createAuditService } = require('../services/auditService');
const { initialAdminFromEnvironment } = require('../services/deploymentService');
const source = path.resolve(__dirname, '..');
const attack = '</ScRiPt><script>globalThis.edokuSecurityMarker=true</script><img src=x onerror=alert(1)>&\u2028\u2029';

test('Gespeicherte und importierte Daten bleiben in allen HTML-JSON-Blöcken reine Daten', async () => {
  const fixtures = {
    'geraetelisten.ejs': { suggestions: { title: attack }, fieldProfiles: { name: attack }, bedienungsanleitungen: [{ title: attack }], datenblaetter: [{ title: attack }] },
    'systemauswahl.ejs': { systemConfig: { name: attack } },
    'einstellungen.ejs': { templates: { item: { name: attack } }, themePresets: { value: attack } },
    'anhaenge.ejs': { documentAttachmentCategories: [{ category: 'test', name: attack }] }
  };
  let blocks = 0;
  for (const [name, data] of Object.entries(fixtures)) {
    const text = await fs.readFile(path.join(source, 'views', name), 'utf8');
    const fragments = text.match(/<script[^>]*type="application\/json"[^>]*>.*?<\/script>/g) || [];
    assert.ok(fragments.length);
    for (const fragment of fragments) {
      const html = ejs.render(fragment, { ...data, jsonForHtml });
      assert.equal((html.match(/<script/gi) || []).length, 1);
      assert.equal((html.match(/<\/script/gi) || []).length, 1);
      const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
      assert.doesNotMatch(body, /[<>&\u2028\u2029]/);
      assert.ok(JSON.stringify(JSON.parse(body)).includes(JSON.stringify(attack).slice(1,-1)));
      blocks++;
    }
    assert.doesNotMatch(text, /<%-\s*JSON\.stringify/);
  }
  assert.equal(blocks, 8);
  assert.deepEqual(JSON.parse(jsonForHtml({ title: 'ÄÖß <&>', nested: [null, 0, true, attack] })), { title: 'ÄÖß <&>', nested: [null, 0, true, attack] });
});

test('Produktions-Erstanlage verlangt eigene Zugänge, lokale Entwicklung bleibt kompatibel', () => {
  assert.throws(() => initialAdminFromEnvironment({ NODE_ENV: 'production' }), /Erstzugangsvariablen/);
  assert.equal(initialAdminFromEnvironment({ NODE_ENV: 'development' }), null);
  assert.equal(initialAdminFromEnvironment({ NODE_ENV: 'production', EDOKU_INITIAL_ADMIN_LOGIN: 'owner', EDOKU_INITIAL_ADMIN_PASSWORD: 'synthetic-private-account' }).email, 'owner');
});

test('Frühe Anfragengrenzen sind nach IP, Methode und Zeit begrenzt; Bereitschaft bleibt lesbar', () => {
  let time = 0; const limiter = createRequestLimiter({ maxReads: 2, maxWrites: 1, maxClients: 2, windowMs: 1000, now: () => time });
  const run = (ip, method = 'POST', route = '/login') => { let result; limiter({ ip, method, path: route }, { set() {} }, error => { result = error || true; }); return result; };
  assert.equal(run('a'), true); assert.equal(run('a').status, 429); assert.equal(run('b'), true); assert.equal(run('c').status, 429);
  assert.equal(run('a', 'GET'), true); assert.equal(run('a', 'GET'), true); assert.equal(run('a', 'GET').status, 429);
  assert.equal(run('c', 'GET', '/ready'), true);
  time = 1001; assert.equal(run('c'), true); assert.equal(run('a'), true);
});

test('Globale Arbeitsgrenzen halten bis zum tatsächlichen Ende und geben Fehlerplätze frei', async () => {
  const guard = createResourceGuard({ maxActive: 2, maxPerUser: 1 });
  let release; const pending = new Promise(resolve => { release = resolve; });
  const request = user => ({ method: 'POST', path: '/export/final', user: { id: user } });
  const first = guard(request('alice'), () => pending);
  await assert.rejects(guard(request('alice'), async () => {}), { status: 429 });
  let releaseSecond; const second = guard(request('bob'), () => new Promise(resolve => { releaseSecond = resolve; }));
  await assert.rejects(guard(request('charlie'), async () => {}), { status: 429 });
  release(); await first;
  await assert.rejects(guard(request('alice'), async () => { throw new Error('synthetic failure'); }), /synthetic failure/);
  assert.equal(await guard(request('alice'), async () => 'available'), 'available');
  releaseSecond(); await second;
  await assert.rejects(guard({ method: 'POST', path: '/export/final' }, async () => {}), { status: 401 });
});

test('Audit schreibt inkrementell, rotiert verlustfrei und erkennt Änderungen historischer Segmente', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'edoku-audit-hardening-'));
  const originalStream = nodeFs.createReadStream; let reads = 0;
  nodeFs.createReadStream = (...args) => { reads++; return originalStream(...args); };
  try {
    const audit = createAuditService(root, { maxFileBytes: 1400 });
    for (let i = 0; i < 20; i++) await audit.append({ event: 'login', requestId: 'r' + i });
    assert.equal(reads, 0, 'Schreiben liest nicht wiederholt historische Einträge');
    const all = await audit.read(); assert.equal(all.length, 20);
    assert.deepEqual((await audit.read({ limit: 3 })).map(x => x.hash), all.slice(-3).map(x => x.hash));
    assert.deepEqual((await createAuditService(root).read()).map(x => x.hash), all.map(x => x.hash));
    const archive = path.join(root, 'storage/audit/archive'), names = (await fs.readdir(archive)).sort(); assert.ok(names.length > 0);
    const file = path.join(archive, names[0]), original = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, original.replace('"event":"login"', '"event":"xxxxx"'));
    await assert.rejects(audit.append({ event: 'login' }), /beschädigt/);
    await fs.writeFile(file, original); assert.equal((await audit.read()).length, 20);
    await audit.append({ event: 'login' }); assert.equal((await audit.read()).length, 21);
    const raw = await fs.readFile(file, 'utf8'); assert.equal(raw, original, 'Historischer Inhalt bleibt unverändert');
    await fs.unlink(path.join(archive, names[0])); await assert.rejects(audit.append({ event: 'login' }), /fehlt|beschädigt/);
  } finally { nodeFs.createReadStream = originalStream; await fs.rm(root, { recursive: true, force: true }); }
});

const { spawn } = require('node:child_process');
async function programFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'edoku-hardening-http-'));
  for (const name of ['server.js','package.json','services','src','views','public','data','config','templates','docs']) await fs.cp(path.join(source,name),path.join(root,name),{recursive:true});
  await fs.symlink(path.join(source,'node_modules'),path.join(root,'node_modules'),'dir');
  t.after(() => fs.rm(root,{recursive:true,force:true})); return root;
}
async function launch(root, extra = {}) {
  const net = require('node:net'), socket = net.createServer(); await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
  const env={...process.env};for(const key of ['EDOKU_INITIAL_ADMIN_LOGIN','EDOKU_INITIAL_ADMIN_PASSWORD','APP_ORIGIN','TRUST_PROXY','COOKIE_SECURE'])delete env[key];
  const child=spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,env:{...env,NODE_ENV:'production',PORT:String(port),...extra},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
  const base='http://127.0.0.1:'+port;
  for(let n=0;n<100;n++){
    if(child.exitCode!==null)return {child,base,logs,failed:true};
    try{if((await fetch(base+'/ready')).status===200)return{child,base,logs};}catch{}
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  child.kill('SIGTERM');throw new Error('Testanwendung nicht bereit: '+logs);
}
async function stopProgram(child){if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;}}

test('Produktionsserver ohne eigene Erstzugänge stoppt vor Anlage einer Datenbank', async t => {
  const root=await programFixture(t),app=await launch(root);
  try{assert.equal(app.failed,true);await assert.rejects(fs.stat(path.join(root,'storage/app.db')),{code:'ENOENT'});assert.match(app.logs,/Erstzugangsvariablen/);}
  finally{await stopProgram(app.child);}
});

test('Echte HTTP-Kette schützt gespeicherte Anhangstitel, begrenzt Bodies und protokolliert keine CSRF-Flut', async t => {
  const root=await programFixture(t),password='Synthetic-hardening-owner-2026';
  const app=await launch(root,{EDOKU_INITIAL_ADMIN_LOGIN:'security-test',EDOKU_INITIAL_ADMIN_PASSWORD:password});
  assert.equal(app.failed,undefined,app.logs);
  const audit=createAuditService(root),cookieJar=new Map();
  const cookies=response=>{for(const raw of response.headers.getSetCookie()){const part=raw.split(';')[0],index=part.indexOf('=');cookieJar.set(part.slice(0,index),part.slice(index+1));}return [...cookieJar].map(([k,v])=>k+'='+v).join('; ');};
  const get=async route=>{const response=await fetch(app.base+route,{headers:{Cookie:[...cookieJar].map(([k,v])=>k+'='+v).join('; ')}});cookies(response);return{response,html:await response.text()};};
  try{
    for(let i=0;i<12;i++){const response=await fetch(app.base+'/login',{method:'POST',body:new URLSearchParams({email:'nobody'})});assert.equal(response.status,403);await response.text();}
    assert.deepEqual(await audit.read(),[]);
    const huge=await fetch(app.base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:'a'.repeat(2*1024*1024)})});assert.equal(huge.status,413);await huge.text();assert.deepEqual(await audit.read(),[]);
    const login=await get('/login'),nonce=login.response.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
    assert.match(login.html,new RegExp('<script nonce="'+nonce.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'">'));
    assert.doesNotMatch(login.response.headers.get('content-security-policy').split(';').find(x=>x.includes('script-src')),/unsafe-inline/);
    const token=login.html.match(/name="csrf-token" content="([^"]+)"/)[1];
    const signed=await fetch(app.base+'/login',{method:'POST',redirect:'manual',headers:{Cookie:cookies(login.response)},body:new URLSearchParams({_csrf:token,email:'security-test',password})});assert.equal(signed.status,302);cookies(signed);await signed.text();
    const page=await get('/geraetelisten'),revision=page.html.match(/name="edoku-project-revision" content="([^"]*)"/)[1],csrf=page.html.match(/name="csrf-token" content="([^"]+)"/)[1];
    const pdf=await require('pdf-lib').PDFDocument.create();pdf.addPage();const form=new FormData();form.set('_csrf',csrf);form.set('_projectRevision',revision);form.set('title',attack);form.set('file',new Blob([await pdf.save()],{type:'application/pdf'}),'synthetic.pdf');
    const upload=await fetch(app.base+'/anhaenge/upload?kategorie=Bedienungsanleitungen',{method:'POST',redirect:'manual',headers:{Cookie:[...cookieJar].map(([k,v])=>k+'='+v).join('; ')},body:form});assert.equal(upload.status,302);assert.doesNotMatch(upload.headers.get('location'),/[?&]error=/);await upload.text();
    const result=await get('/geraetelisten');assert.equal(result.response.status,200);assert.doesNotMatch(result.html,/<script>globalThis\.edokuSecurityMarker/);
    const data=JSON.parse(result.html.match(/id="device-manuals-json">([\s\S]*?)<\/script>/)[1]);assert.equal(data[0].title,attack.trim());
    const db=new (require('better-sqlite3'))(path.join(root,'storage/app.db'));
    db.prepare("UPDATE users SET role='user' WHERE email='security-test'").run(); db.close();
    const settingsBefore=await fs.readFile(path.join(root,'config/systemEinstellungen.json'));
    for(const route of ['/einstellungen/system','/Einstellungen/system','/einstellungen/system/']){
      const blocked=await fetch(app.base+route,{method:'POST',redirect:'manual',headers:{Cookie:[...cookieJar].map(([k,v])=>k+'='+v).join('; ')},body:new URLSearchParams({_csrf:csrf,appTitle:'MUST-NOT-CHANGE'})});
      assert.ok([403,404].includes(blocked.status),route+' umgeht die Rollenprüfung'); await blocked.text();
    }
    const bypass=await fetch(app.base+'/LOGIN/',{method:'POST',redirect:'manual',headers:{Cookie:[...cookieJar].map(([k,v])=>k+'='+v).join('; ')},body:new URLSearchParams({_csrf:csrf,email:'security-test',password:'wrong'})});assert.equal(bypass.status,404);await bypass.text();
    assert.deepEqual(await fs.readFile(path.join(root,'config/systemEinstellungen.json')),settingsBefore);
    const before=await audit.read();assert.ok(before.some(x=>x.event==='login'&&x.outcome==='success'));
    let limited=false;for(let i=0;i<65;i++){const response=await fetch(app.base+'/login',{method:'POST',body:new URLSearchParams({email:'nobody'})});await response.text();if(response.status===429){assert.ok(response.headers.get('retry-after'));limited=true;break;}assert.equal(response.status,403);}
    assert.ok(limited);assert.deepEqual(await audit.read(),before);
  }finally{await stopProgram(app.child);}
});

test('Speicherbudget erfasst Papierkorb und Projektpakete, erhält aber vorhandene Dateien', async () => {
  const { createStorageBudget } = require('../services/storageBudgetService');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'edoku-storage-budget-'));
  try{
    const project=path.join(root,'storage/users/alice/projects/a/.trash'),exports=path.join(root,'storage/exports/alice');
    await fs.mkdir(project,{recursive:true});await fs.mkdir(exports,{recursive:true});
    const old=path.join(project,'old.bin'),packet=path.join(exports,'packet.zip');await fs.writeFile(old,'retained');await fs.writeFile(packet,'package');
    const check=createStorageBudget(root,{maxBytes:20,minFreeBytes:1});
    assert.equal((await check('alice')).bytes,15);
    await assert.rejects(check('alice',6),{status:507});
    assert.equal(await fs.readFile(old,'utf8'),'retained');assert.equal(await fs.readFile(packet,'utf8'),'package');
    assert.equal((await check('bob',5)).bytes,5);
    await assert.rejects(createStorageBudget(root,{minFreeBytes:Number.MAX_SAFE_INTEGER})('alice'),{status:507});
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('Gleichzeitige Bodies sind vor dem Einlesen begrenzt und Finish/Close geben nur einmal frei', () => {
  const { createBodyLimiter }=require('../services/requestSecurityService'),EventEmitter=require('node:events');
  const limiter=createBodyLimiter({maxActive:2,maxPerIp:1});
  const run=ip=>{const response=new EventEmitter();response.set=()=>{};let error;limiter({method:'POST',ip},response,e=>{error=e;});return{response,error};};
  const a=run('a');assert.equal(a.error,undefined);assert.equal(run('a').error.status,429);const b=run('b');assert.equal(run('c').error.status,429);
  a.response.emit('finish');a.response.emit('close');const c=run('c');assert.equal(c.error,undefined);assert.equal(run('d').error.status,429);
  b.response.emit('close');assert.equal(run('d').error,undefined);
});
