const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),net=require("node:net"),crypto=require("node:crypto");
const {spawn}=require("node:child_process"),Database=require("better-sqlite3"),{PDFDocument}=require("pdf-lib");
const {createAuditService}=require("../services/auditService");
const source=path.resolve(__dirname,"..");
async function fingerprint(directory,result={}){for(const item of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())await fingerprint(file,result);else if(item.isFile())result[file]=crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");}return result;}
function unzip(buffer){
  const end=buffer.length-22;assert.equal(buffer.readUInt32LE(end),0x06054b50);let offset=buffer.readUInt32LE(end+16);const result=[];
  for(let i=0;i<buffer.readUInt16LE(end+10);i++){
    assert.equal(buffer.readUInt32LE(offset),0x02014b50);const size=buffer.readUInt32LE(offset+20),nameLength=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42),name=buffer.subarray(offset+46,offset+46+nameLength).toString();
    assert.equal(buffer.readUInt16LE(offset+10),0);const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);result.push({name,bytes:buffer.subarray(start,start+size)});offset+=46+nameLength+extra+comment;
  }return result;
}

test("Lokale Beta Ende-zu-Ende: Anmeldung, Projekt, Gerät, Anhänge, Gesamt-PDF, ZIP und Archiv-Rückimport",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-beta-e2e-"));
  for(const name of ["server.js","package.json","services","src","views","public","data","config","templates","docs"])await fs.cp(path.join(source,name),path.join(root,name),{recursive:true});
  await fs.symlink(path.join(source,"node_modules"),path.join(root,"node_modules"),"dir");
  const json=(file,value)=>fs.writeFile(path.join(root,file),JSON.stringify(value,null,2));
  await json("data/projekt.json",{projektname:"Neutrales Startprojekt",projektnummer:"DEMO",logoPfad:""});
  for(const name of ["geraetelisten","brandschutz","anhaenge","exportliste","files","projektSysteme"])await json("data/"+name+".json",[]);
  const doc=(id,kapitel,titel,extra={})=>({id,kapitel,titel,ebene:kapitel.split(".").length,aktiv:true,export:true,pflicht:false,sortierung:Number(kapitel.replace(".",""))*100,...extra});
  await json("data/dokumentenmatrix.json",[doc("devices","6","Gerätelisten",{dokumenttyp:"Kapitel"}),doc("group","6.4","Elektroinstallation",{quelle:"data/geraetelisten.json"}),doc("plans","12","Bestandspläne",{dokumenttyp:"Kapitel"}),doc("plan-group","12.1","Stromlaufpläne",{dokumenttyp:"Plan",formularart:"Dateiliste"})]);
  const socket=net.createServer();await new Promise(r=>socket.listen(0,"127.0.0.1",r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const child=spawn(process.execPath,[path.join(root,"server.js")],{cwd:root,env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});let logs="";child.stdout.on("data",d=>logs+=d);child.stderr.on("data",d=>logs+=d);
  const base="http://127.0.0.1:"+port,cookies=new Map();let token="",db;
  async function request(route,options={}){
    const response=await fetch(base+route,{redirect:"manual",...options,headers:{Cookie:[...cookies].map(([k,v])=>k+"="+v).join("; "),...options.headers}});
    for(const line of response.headers.getSetCookie()){const pair=line.split(";")[0],sep=pair.indexOf("=");cookies.set(pair.slice(0,sep),pair.slice(sep+1));}
    return response;
  }
  async function page(route){const response=await request(route);assert.equal(response.status,200,route);const html=await response.text();const match=html.match(/name="csrf-token" content="([a-f0-9]+)"/);if(match)token=match[1];return html;}
  async function post(route,fields={}){const body=new URLSearchParams({_csrf:token,...fields});const response=await request(route,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});await response.arrayBuffer();assert.equal(response.status,302,route);assert.ok(!response.headers.get("location")?.includes("error="),route+": "+response.headers.get("location"));return response;}
  try{
    let ready=false;for(let i=0;i<120;i++){try{if((await request("/api/health")).status===200){ready=true;break;}}catch{}if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,50));}assert.equal(ready,true,logs);
    await page("/login");await post("/login",{email:"admin",password:"admin"});await page("/dashboard");
    await post("/projekte",{projektname:"Prüfprojekt lokale Beta",projektnummer:"DEMO-E2E"});await page("/projekt");
    await post("/projekt",{projektname:"Prüfprojekt lokale Beta",projektnummer:"DEMO-E2E",auftraggeber:"Beispiel GmbH",liegenschaft:"Mustergebäude",baumassnahme:"Neutrale Prüfung",ausfuehrendeFirma:"Elektro Beispiel",bearbeiter:"Testteam",auftragGewerk:"Elektrotechnik"});
    await post("/leistungsbereiche",{leistungsbereiche:"Elektroinstallation / DIN VDE 0100"});
    db=new Database(path.join(root,"storage/app.db"),{readonly:true});const project=db.prepare("SELECT current_project_id FROM users WHERE id='user_demo'").get().current_project_id;
    const owner=path.join(root,"storage/users/user_demo/projects",project),data=path.join(owner,"data");
    assert.equal(Object.hasOwn(JSON.parse(await fs.readFile(path.join(data,"projekt.json"),"utf8")),"_csrf"),false);
    const lists=JSON.parse(await fs.readFile(path.join(data,"geraetelisten.json"),"utf8"));const active=lists.filter(row=>row.aktiv);assert.equal(active.length,1);
    const list=active[0];await post("/geraetelisten",{ "geraetelisten[0][id]":list.id,"geraetelisten[0][kapitel]":list.kapitel,"geraetelisten[0][titel]":list.titel,"geraetelisten[0][leistungsbereich]":list.leistungsbereich,"geraetelisten[0][aktiv]":"on","geraetelisten[0][export]":"on","geraetelisten[0][positionen][0][hersteller]":"Beispiel","geraetelisten[0][positionen][0][system]":"Installation","geraetelisten[0][positionen][0][typ]":"LS B16","geraetelisten[0][positionen][0][beschreibung]":"Neutrales Prüfgerät","geraetelisten[0][positionen][0][menge]":"2","geraetelisten[0][positionen][0][einheit]":"Stk" });
    const pdf=await PDFDocument.create();pdf.addPage().drawText("Synthetischer Stromlaufplan EG");pdf.addPage().drawText("Synthetischer Stromlaufplan EG - Seite 2");const sourcePdf=Buffer.from(await pdf.save());
    const upload=new FormData();upload.set("_csrf",token);upload.set("title","Stromlaufplan Erdgeschoss");upload.set("stockwerk","EG");upload.set("file",new Blob([sourcePdf],{type:"application/pdf"}),"Beispielplan.pdf");
    const uploaded=await request("/anhaenge/upload?kategorie=Stromlaufpläne",{method:"POST",body:upload});await uploaded.arrayBuffer();assert.equal(uploaded.status,302);assert.ok(!uploaded.headers.get("location").includes("error="));
    await page("/export");await post("/export/final");
    const entries=JSON.parse(await fs.readFile(path.join(data,"exportliste.json"),"utf8"));assert.equal(entries.filter(e=>e.requiresFile!==false&&e.status!=="vorhanden").length,0,JSON.stringify(entries.filter(e=>e.requiresFile!==false&&e.status!=="vorhanden").map(e=>({id:e.id,status:e.status,kapitel:e.kapitel}))));
    const plannedPages=entries.reduce((sum,e)=>sum+(e.requiresFile!==false&&e.status==="vorhanden"?e.seiten:0),0);assert.equal(entries.find(e=>e.attachmentId).seiten,2);
    const final=path.join(owner,"output/06_Final"),names=await fs.readdir(final),complete=names.find(n=>n.endsWith("Gesamtdokumentation.pdf")),zipName=names.find(n=>n.endsWith(".zip"));
    const full=await PDFDocument.load(await fs.readFile(path.join(final,complete)));assert.equal(full.getPageCount(),plannedPages);
    const documentationZip=unzip(await fs.readFile(path.join(final,zipName)));assert.ok(documentationZip.some(e=>e.name.endsWith(complete)));assert.ok(documentationZip.some(e=>e.bytes.equals(sourcePdf)));
    await post("/projektarchiv/exportieren",{includeUploads:"on",includeGenerated:"on",includeFinal:"on",createZip:"on"});
    const exportBase=path.join(root,"storage/exports/user_demo",project),[stamp]=await fs.readdir(exportBase);const exportDir=path.join(exportBase,stamp),archiveFile=(await fs.readdir(exportDir)).find(n=>n.endsWith(".zip"));
    const download=await request("/projektarchiv/download?pfad="+encodeURIComponent(path.relative(root,path.join(exportDir,archiveFile))));assert.equal(download.status,200);const packageBytes=Buffer.from(await download.arrayBuffer()),packageEntries=unzip(packageBytes);
    const incoming=path.join(root,"storage/imports/user_demo/e2e");await fs.mkdir(incoming,{recursive:true});
    for(const entry of packageEntries){assert.ok(entry.name.startsWith("projekt_export/")&&!entry.name.split("/").includes(".."));const file=path.join(incoming,entry.name.slice("projekt_export/".length));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,entry.bytes);}
    const before=await fingerprint(owner);await post("/projektarchiv/importieren",{importOrdner:"e2e"});assert.deepEqual(await fingerprint(owner),before);
    assert.ok(db.prepare("SELECT count(*) count FROM projects WHERE user_id='user_demo'").get().count>=3);
    const auditPage=await page("/einstellungen/protokoll");assert.match(auditPage,/Sicherheitsprotokoll/);const auditEvents=await createAuditService(root).read();
    for(const event of ["login","project.create","documentation.export","archive.export","archive.import"])assert.ok(auditEvents.some(e=>e.event===event&&e.outcome==="success"),event);
    const auditText=JSON.stringify(auditEvents);assert.ok(!auditText.includes(cookies.get("dm_session")));assert.ok(!auditText.includes(token));
    await fs.mkdir(path.join(source,"test-results"),{recursive:true});await fs.writeFile(path.join(source,"test-results/local-beta-e2e.json"),JSON.stringify({passed:true,syntheticData:true,pdfPages:plannedPages,pdfFiles:entries.filter(e=>e.requiresFile!==false).length,zipEntries:documentationZip.length,archiveEntries:packageEntries.length,auditEvents:auditEvents.length,sourceProjectPreserved:true},null,2));
  }finally{if(db)db.close();if(child.exitCode===null){const done=new Promise(r=>child.once("exit",r));child.kill("SIGTERM");await done;}}
});
