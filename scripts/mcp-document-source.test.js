const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Readable}=require('node:stream');
const {downloadPdf,resolveDocumentSource,publicAddress,openResponse}=require('../services/mcpDocumentSourceService');
const pdf=Buffer.from('%PDF-1.4\nSynthetische Testdatei; keine Freigabe.');
const publicLookup=async()=>[{address:'93.184.216.34',family:4}];
const response=(bytes=pdf,status=200,headers={})=>Object.assign(Readable.from([bytes]),{statusCode:status,headers});
test('HTML-Projektion: große Skripte verwerfen, geprüfte Nutzdaten und Transfer weiterhin begrenzen',async()=>{
 const {downloadResource}=require('../services/mcpDocumentSourceService');
 const options={kind:'html',projectHtml:true,maxBytes:1024,lookup:publicLookup};
 const html=Buffer.from('<script>'+'.'.repeat(800000)+'</script><h1>ART-100</h1><a href="/original.pdf">Datenblatt</a>');
 const out=await downloadResource('https://manufacturer.example/product',{...options,request:async()=>response(html)});
 assert.ok(out.bytes.length<1024);assert.match(out.bytes.toString(),/original.pdf/);assert.ok(!out.bytes.toString().includes('...'));
 await assert.rejects(downloadResource('https://manufacturer.example/product',{...options,request:async()=>response(Buffer.from('x'.repeat(2000)))}),e=>e.code==='SOURCE_FILE_LIMIT');
 await assert.rejects(downloadResource('https://manufacturer.example/product',{...options,request:async()=>response(Buffer.from('<script>'+'.'.repeat(4*1024*1024)+'</script>'))}),e=>e.code==='SOURCE_FILE_LIMIT');
});
test('Öffentliche Adressen erlauben, lokale/spezielle IPv4 und IPv6 einschließlich Abbildungen sperren',()=>{
 for(const ip of ['93.184.216.34','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
 for(const ip of ['127.0.0.1','10.1.2.3','0.0.0.0','169.254.169.254','172.16.0.1','192.168.0.1','100.64.1.1','192.0.2.1','198.18.0.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::1','3fff::1'])assert.equal(publicAddress(ip),false,ip);
});
test('Herstellerdownload prüft jeden Redirect und bindet das aufgelöste öffentliche Ziel',async()=>{
 const seen=[];const bytes=await downloadPdf('https://manufacturer.example/start',{lookup:publicLookup,request:async target=>{seen.push(target);return seen.length===1?response(Buffer.alloc(0),302,{location:'/sheet.pdf'}):response();}});
 assert.deepEqual(bytes,pdf);assert.equal(seen[1].url.pathname,'/sheet.pdf');assert.equal(seen[1].address.address,'93.184.216.34');
 await assert.rejects(downloadPdf('https://manufacturer.example',{lookup:publicLookup,request:async()=>response(Buffer.alloc(0),302,{location:'https://127.0.0.1/secret'})}),{code:'SOURCE_ADDRESS_BLOCKED'});
 await assert.rejects(downloadPdf('https://manufacturer.example',{lookup:async()=>[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}],request:async()=>{throw Error('Darf nicht verbunden werden')}}),{code:'SOURCE_ADDRESS_BLOCKED'});
});
test('Download sperrt Zugangsdaten, Sonderports, HTTP, HTML, zu große Antworten und Weiterleitungsschleifen',async()=>{
 for(const url of ['http://manufacturer.example/pdf','file:///etc/passwd','https://name:secret@manufacturer.example/pdf','https://manufacturer.example:444/pdf'])await assert.rejects(downloadPdf(url),{code:'SOURCE_URL_INVALID'});
 await assert.rejects(downloadPdf('https://manufacturer.example',{lookup:publicLookup,request:async()=>response(Buffer.from('<html>Login</html>'))}),{code:'SOURCE_NOT_PDF'});
 await assert.rejects(downloadPdf('https://manufacturer.example',{maxBytes:8,lookup:publicLookup,request:async()=>response()}),{code:'SOURCE_FILE_LIMIT'});
 await assert.rejects(downloadPdf('https://manufacturer.example',{lookup:publicLookup,request:async()=>response(Buffer.alloc(0),302,{location:'/again'})}),{code:'SOURCE_REDIRECT_LIMIT'});
 await assert.rejects(downloadPdf('https://manufacturer.example',{lookup:publicLookup,request:async()=>response(Buffer.alloc(0),404)}),{code:'SOURCE_HTTP_ERROR'});
});
test('Zeitlimit umfasst auch eine hängende Namensauflösung',async()=>{
 await assert.rejects(downloadPdf('https://manufacturer.example',{timeoutMs:20,lookup:()=>new Promise(()=>{}),request:async()=>response()}),{code:'SOURCE_TIMEOUT'});
});
test('Browser-Container-Dateipfad wird mit Hersteller-URL übergeben; lokale Dateien bleiben nutzbar, Originale werden nicht überschrieben',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'edoku-source-'));try{
  let downloads=0;const download=async url=>{downloads++;assert.equal(url,'https://manufacturer.example/sheet.pdf');return pdf;};
  const input={documentRoot:root,projectId:'test',filePath:'/home/node/.playwright-mcp/datasheet.pdf',sourceUrl:'https://manufacturer.example/sheet.pdf'};
  const a=await resolveDocumentSource(input,{download});assert.equal(a.source,'manufacturer_url');assert.deepEqual(a.bytes,pdf);
  const files=await fs.readdir(path.join(root,'downloads/test'));assert.equal(files.length,1);
  const file=path.join(root,'downloads/test',files[0]);assert.deepEqual(await fs.readFile(file),pdf);
  await resolveDocumentSource(input,{download});assert.equal((await fs.readdir(path.dirname(file))).length,1);
  const local=await resolveDocumentSource({...input,filePath:file},{download});assert.equal(local.source,'local');assert.equal(downloads,2);
  await fs.writeFile(file,'Anderer Inhalt');await assert.rejects(resolveDocumentSource(input,{download}),{code:'SOURCE_CACHE_CONFLICT'});assert.equal(await fs.readFile(file,'utf8'),'Anderer Inhalt');
  await assert.rejects(resolveDocumentSource({...input,sourceUrl:undefined},{download}),{code:'SOURCE_FILE_MISSING'});
  await assert.rejects(resolveDocumentSource({...input,filePath:undefined,sourceUrl:undefined},{download}),{code:'SOURCE_REQUIRED'});
  await assert.rejects(resolveDocumentSource({...input,documentRoot:path.join(root,'missing')},{download}),{code:'DOCUMENT_ROOT_UNAVAILABLE'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('Eingangsablage folgt keinen untergeschobenen Verzeichnis-Symlinks',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'edoku-source-links-')),outside=await fs.mkdtemp(path.join(os.tmpdir(),'edoku-outside-'));try{
  await fs.symlink(outside,path.join(root,'downloads'),'dir');
  await assert.rejects(resolveDocumentSource({documentRoot:root,projectId:'test',sourceUrl:'https://manufacturer.example/sheet.pdf'},{download:async()=>pdf}));assert.deepEqual(await fs.readdir(outside),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});
test('HTTPS-Verbindung verwendet die geprüfte IP mit normaler TLS-Prüfung und ohne API-Zugangsdaten',async()=>{
 const https=require('node:https'),{EventEmitter}=require('node:events'),original=https.get;
 let options;https.get=(url,input,callback)=>{options=input;queueMicrotask(()=>callback(response()));return new EventEmitter();};
 try{
  const target={url:new URL('https://manufacturer.example/data.pdf'),hostname:'manufacturer.example',address:{address:'93.184.216.34',family:4}};
  const r=await openResponse(target,new AbortController().signal);r.destroy();
  assert.equal(options.agent,false);assert.equal(options.autoSelectFamily,false);assert.equal(options.rejectUnauthorized,undefined);assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);
  const address=await new Promise((resolve,reject)=>options.lookup('manufacturer.example',{},(error,ip)=>error?reject(error):resolve(ip)));assert.equal(address,'93.184.216.34');
  await assert.rejects(new Promise((resolve,reject)=>options.lookup('other.example',{},error=>error?reject(error):resolve())),{code:'SOURCE_ADDRESS_BLOCKED'});
 }finally{https.get=original;}
});
