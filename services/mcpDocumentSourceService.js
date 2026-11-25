const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const https=require('node:https'),dns=require('node:dns/promises'),net=require('node:net');
const {assertSafePath}=require('./pathService');
const MAX_BYTES=14*1024*1024;
const failure=(code,message)=>Object.assign(new Error(message),{code});
const denied=new net.BlockList();
for(const [ip,bits]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['168.63.129.16',32],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])denied.addSubnet(ip,bits,'ipv4');
const globalV6=new net.BlockList();globalV6.addSubnet('2000::',3,'ipv6');
for(const [ip,bits]of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])denied.addSubnet(ip,bits,'ipv6');
function publicAddress(ip){const family=net.isIP(ip);return family===4?!denied.check(ip,'ipv4'):family===6&&globalV6.check(ip,'ipv6')&&!denied.check(ip,'ipv6');}
async function destination(raw,lookup,signal){
  if(signal.aborted)throw failure('SOURCE_TIMEOUT','Herstellerdownload hat zu lange gedauert.');
  let url;try{url=new URL(raw)}catch{throw failure('SOURCE_URL_INVALID','Eine direkte HTTPS-Adresse des Hersteller-PDFs angeben.');}
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw failure('SOURCE_URL_INVALID','Nur öffentliche HTTPS-Adressen ohne Zugangsdaten und Sonderport sind zulässig.');
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const records=net.isIP(hostname)?[{address:hostname,family:net.isIP(hostname)}]:await Promise.race([lookup(hostname,{all:true,verbatim:true}),new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(failure('SOURCE_TIMEOUT','Herstellerdownload hat zu lange gedauert.')),{once:true}))]);
  if(!records.length||records.some(x=>!publicAddress(x.address)))throw failure('SOURCE_ADDRESS_BLOCKED','Lokale, private oder reservierte Netzwerkadressen sind als Downloadziel gesperrt.');
  if(signal.aborted)throw failure('SOURCE_TIMEOUT','Herstellerdownload hat zu lange gedauert.');
  url.hash='';return {url,hostname,address:records[0]};
}
function openResponse(target,signal){
  return new Promise((resolve,reject)=>{
    const pinned=(hostname,options,callback)=>{
      if(hostname!==target.hostname)return callback(failure('SOURCE_ADDRESS_BLOCKED','Downloadziel wurde geändert.'));
      const a=target.address;return options?.all?callback(null,[a]):callback(null,a.address,a.family);
    };
    const req=https.get(target.url,{agent:false,lookup:pinned,autoSelectFamily:false,signal,maxHeaderSize:16384,headers:{Accept:'application/pdf, application/octet-stream;q=0.8','Accept-Encoding':'identity','User-Agent':'edoku-MCP/2.3.0'}},response=>resolve(response));
    req.on('error',reject);
  });
}
async function downloadResource(sourceUrl,{lookup=dns.lookup,request=openResponse,timeoutMs=20000,maxBytes=MAX_BYTES,kind='pdf',projectHtml=false}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  let current=sourceUrl;
  const transferLimit=kind==='html'&&projectHtml?4*1024*1024:maxBytes;
  const limitError=()=>failure('SOURCE_FILE_LIMIT',kind==='html'?'Herstellerseite überschreitet die begrenzte HTML-Prüfung.':'Das PDF darf höchstens 14 MiB groß sein.');
  try{
    for(let hop=0;hop<=5;hop++){
      const target=await destination(current,lookup,controller.signal),response=await request(target,controller.signal);
      try{
        const status=response.statusCode;
        if([301,302,303,307,308].includes(status)){
          if(hop===5||!response.headers.location)throw failure('SOURCE_REDIRECT_LIMIT','Zu viele oder ungültige Weiterleitungen.');
          current=new URL(response.headers.location,target.url).href;continue;
        }
        if(status!==200)throw failure('SOURCE_HTTP_ERROR','Der Herstellerdownload ist nicht erfolgreich (HTTP '+status+').');
        if(response.headers['content-encoding']&&response.headers['content-encoding']!=='identity')throw failure('SOURCE_ENCODING_UNSUPPORTED','Komprimierte Downloadantwort nicht unterstützt; direkte PDF-Adresse verwenden.');
        if(Number(response.headers['content-length'])>transferLimit)throw limitError();
        const chunks=[];let size=0;
        for await(const value of response){size+=value.length;if(size>transferLimit)throw limitError();chunks.push(Buffer.from(value));}
        let bytes=Buffer.concat(chunks);
        if(kind==='html'&&projectHtml)bytes=Buffer.from(require('./manufacturerPageService').projectPageHtml(bytes.toString('utf8')));
        if(bytes.length>maxBytes)throw limitError();
        if(kind==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw failure('SOURCE_NOT_PDF','Die Adresse liefert kein PDF. Direkte PDF-Adresse statt Produktseite verwenden.');
        return {bytes,finalUrl:target.url.href};
      }finally{response.destroy?.();}
    }
  }catch(error){
    if(controller.signal.aborted)throw failure('SOURCE_TIMEOUT','Herstellerdownload hat zu lange gedauert.');
    if(error.code?.startsWith('SOURCE_'))throw error;
    throw failure('SOURCE_DOWNLOAD_FAILED','Hersteller-PDF konnte nicht heruntergeladen werden. Adresse und Erreichbarkeit prüfen.');
  }finally{clearTimeout(timer);}
}
async function downloadPdf(sourceUrl,options){return (await downloadResource(sourceUrl,options)).bytes;}
async function rootDirectory(documentRoot){
  if(!documentRoot||!path.isAbsolute(documentRoot))throw failure('DOCUMENT_ROOT_UNAVAILABLE','Der lokale edoku-Eingangsordner ist nicht eingerichtet.');
  try{const root=await fs.realpath(documentRoot);if(!(await fs.stat(root)).isDirectory())throw Error();return root;}
  catch{throw failure('DOCUMENT_ROOT_UNAVAILABLE','Der lokale edoku-Eingangsordner ist nicht erreichbar.');}
}
async function localSource(root,filePath){
  if(!path.isAbsolute(filePath))throw failure('SOURCE_PATH_INVALID','Der Dateipfad muss absolut sein oder metadata.sourceUrl muss das Hersteller-PDF angeben.');
  let file;try{file=await fs.realpath(filePath)}catch{throw failure('SOURCE_FILE_MISSING','Die Datei ist auf dem MCP-Host nicht vorhanden. Browser-Container-Pfade sind dort nicht erreichbar.');}
  const relative=path.relative(root,file);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw failure('SOURCE_OUTSIDE_ROOT','Die Datei liegt außerhalb des edoku-Eingangsordners.');
  const handle=await fs.open(file,'r');
  try{
    const stat=await handle.stat();if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)throw failure('SOURCE_FILE_LIMIT','Eine PDF-/Bilddatei mit höchstens 14 MiB ist erforderlich.');
    const bytes=Buffer.alloc(stat.size+1);let size=0;
    while(size<bytes.length){const part=await handle.read(bytes,size,bytes.length-size,null);if(!part.bytesRead)break;size+=part.bytesRead;}
    if(size!==stat.size)throw failure('SOURCE_FILE_CHANGED','Die Datei wurde während des Lesens geändert.');
    return {bytes:bytes.subarray(0,size),filename:path.basename(file),source:'local'};
  }finally{await handle.close();}
}
async function resolveDocumentSource({documentRoot,filePath,sourceUrl,projectId},{download=downloadPdf}={}){
  const root=await rootDirectory(documentRoot);
  if(filePath){
    try{return await localSource(root,filePath)}catch(e){if(!sourceUrl||!filePath.startsWith('/home/node/.playwright-mcp/')||!['SOURCE_FILE_MISSING','SOURCE_OUTSIDE_ROOT'].includes(e.code))throw e;}
  }
  if(!sourceUrl)throw failure('SOURCE_REQUIRED','Lokale Datei im Eingangsordner oder metadata.sourceUrl mit direkter Hersteller-PDF-Adresse angeben.');
  if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(projectId))throw failure('SOURCE_PATH_INVALID','Ungültige Projektkennung.');
  const bytes=await download(sourceUrl),digest=crypto.createHash('sha256').update(bytes).digest('hex'),folder=path.join(root,'downloads',projectId),file=path.join(folder,digest+'.pdf');
  await assertSafePath(root,folder,{allowMissing:true});await fs.mkdir(folder,{recursive:true,mode:0o700});await assertSafePath(root,file,{allowMissing:true});
  let handle;
  try{handle=await fs.open(file,'wx',0o600);await handle.writeFile(bytes);await handle.sync();}
  catch(e){if(e.code!=='EEXIST'){if(handle){await handle.close();handle=null;await fs.unlink(file);}throw e;}if(crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')!==digest)throw failure('SOURCE_CACHE_CONFLICT','Vorhandene Eingangsdatei stimmt nicht überein; sie wurde nicht überschrieben.');}
  finally{await handle?.close();}
  return {bytes,filename:digest+'.pdf',source:'manufacturer_url'};
}
module.exports={resolveDocumentSource,downloadPdf,downloadResource,publicAddress,MAX_BYTES,openResponse};
