const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { initDatabase, createUser, upsertProject, getProject, createSession } = require("../services/dbService");
const { writeJson, readJson } = require("../services/jsonService");
const { assertSafePath } = require("../services/pathService");
const { bindProjectScope, createProjectFolder, getProjectPaths, readableProjectPaths, scopedProjectRoot, legacyOutputStatus, resolveProjectSource } = require("../services/projectService");
const { exportProject, importProject, validateProjectArchive, resolveArchiveDownload, resolveImportDirectory, createProject } = require("../services/projectArchiveService");
const { resolvePdfPreviewFile } = require("../services/pdfPreviewService");
const { resolveAttachmentFile, deleteAttachment } = require("../services/attachmentService");
const { createAuthLimiter } = require("../services/requestSecurityService");
const { buildExportliste, prepareFinalExport } = require("../services/exportService");
const { generateInhaltsverzeichnis } = require("../services/pdfService");
const source = path.resolve(__dirname,"..");
const hash = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

async function fixture({program=false}={}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),"edoku-security-test-"));
  if(program) {
    for(const name of ["server.js","package.json","services","src","views","public","data","config","templates","docs"])await fs.cp(path.join(source,name),path.join(root,name),{recursive:true});
    await fs.symlink(path.join(source,"node_modules"),path.join(root,"node_modules"),"dir");
  }
  const db=initDatabase(path.join(root,"storage"));
  const stamp="2026-01-01T00:00:00.000Z";
  const salt="synthetic-test-salt", passwordHash=crypto.scryptSync("synthetic-password",salt,64).toString("hex");
  for(const [id,role]of[["alice","user"],["bob","systemadmin"],["reader","viewer"]]){
    createUser({id,email:id,name:id,role,status:"active",passwordHash,passwordSalt:salt,currentProjectId:"same",createdAt:stamp,updatedAt:stamp});
    upsertProject({id:"same",userId:id,status:"aktiv",createdAt:stamp,updatedAt:stamp});
    const project={projektname:"Beispielprojekt",projektnummer:"DEMO",logoPfad:""};
    const dir=path.join(scopedProjectRoot(root,id,"same"),"data");
    const contents={"projekt.json":project,"leistungsbereiche.json":{optionen:[],aktiv:[]},"projektSysteme.json":[],"dokumentenmatrix.json":[],"geraetelisten.json":[],"brandschutz.json":[],"anhaenge.json":[],"exportliste.json":[],"files.json":[]};
    for(const [name,value]of Object.entries(contents))await writeJson(path.join(dir,name),value);
  }
  return {root,db,project:user=>bindProjectScope({projektname:"Beispielprojekt",projektnummer:"DEMO"},user,"same")};
}
async function attachment(f,user="alice") {
  const relative=`storage/users/${user}/projects/same/anhaenge/Pruefplan.pdf`;
  const file=path.join(f.root,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,"synthetische Testdatei");
  const record={id:"plan",relativePath:relative,title:"Prüfplan",mimeType:"application/pdf",fileName:"Pruefplan.pdf",category:"Bestandspläne"};
  await writeJson(path.join(scopedProjectRoot(f.root,user,"same"),"data/anhaenge.json"),[record]);
  return record;
}

test("Atomisches JSON-Speichern erhält den vorherigen Stand bei Fehlern",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-json-test-")),file=path.join(root,"test.json");
  await writeJson(file,{behalten:"Original"});const original=await fs.readFile(file);
  const circular={};circular.self=circular;
  await assert.rejects(writeJson(file,circular),{code:"WRITE_FAILED"});assert.deepEqual(await fs.readFile(file),original);
  await fs.mkdir(path.join(root,"directory.json"));await assert.rejects(writeJson(path.join(root,"directory.json"),{}),{code:"WRITE_FAILED"});
  assert.deepEqual((await fs.readdir(root)).sort(),["directory.json","test.json"]);
  await fs.writeFile(file,"{kaputt");await assert.rejects(readJson(file,{}),{code:"READ_FAILED"});assert.equal(await fs.readFile(file,"utf8"),"{kaputt");
});

test("Parallele Projektanlage reserviert getrennte Ordner und überschreibt keine Bestandsprojekte",async()=>{
  const f=await fixture({program:true});try{
    const existing=await fs.readFile(path.join(scopedProjectRoot(f.root,"alice","same"),"data/projekt.json"));
    const projects=await Promise.all([1,2].map(()=>createProject(f.root,path.join(f.root,"data"),"alice",{projektname:"Neues Projekt",projektnummer:"2026"})));
    assert.notEqual(projects[0].projectId,projects[1].projectId);
    assert.deepEqual(await fs.readFile(path.join(scopedProjectRoot(f.root,"alice","same"),"data/projekt.json")),existing);
  }finally{f.db.close();}
});

test("Gleiche Projektnamen erhalten getrennte Ausgaben und keine mehrdeutige Altfreigabe",async()=>{
  const f=await fixture();try{
    const a=await createProjectFolder(f.root,f.project("alice")),b=await createProjectFolder(f.root,f.project("bob"));
    assert.notEqual(a.projectPath,b.projectPath);
    const legacy=getProjectPaths(f.root,{projektname:"Beispielprojekt",projektnummer:"DEMO"});await fs.mkdir(legacy.finalPath,{recursive:true});await fs.writeFile(path.join(legacy.finalPath,"alt.pdf"),"Altbestand");
    assert.equal(legacyOutputStatus(f.root,f.project("alice")),"ambiguous");assert.equal(readableProjectPaths(f.root,f.project("alice")).length,1);
    await assert.rejects(resolvePdfPreviewFile(f.root,f.project("alice"),"06_Final/alt.pdf"));
    const archive=await exportProject(f.root,"same","alice");assert.equal(archive.separateHistoricalOutputs,true);
    const manifest=await readJson(archive.manifestPath);assert.equal(manifest.contents.separateHistoricalOutputs,true);
    assert.equal(Object.keys(manifest.files).some(file=>file.endsWith("alt.pdf")),false);
    assert.equal(await fs.readFile(path.join(legacy.finalPath,"alt.pdf"),"utf8"),"Altbestand");
  }finally{f.db.close();}
});

test("Eindeutige alte Ausgaben bleiben lesbar, neue Dateien entstehen nur im Benutzerprojekt",async()=>{
  const f=await fixture();try{
    await writeJson(path.join(scopedProjectRoot(f.root,"bob","same"),"data/projekt.json"),{projektname:"Anderes Projekt"});
    await writeJson(path.join(scopedProjectRoot(f.root,"reader","same"),"data/projekt.json"),{projektname:"Noch ein Projekt"});
    const old=getProjectPaths(f.root,{projektname:"Beispielprojekt",projektnummer:"DEMO"});await fs.mkdir(old.finalPath,{recursive:true});await fs.writeFile(path.join(old.finalPath,"alt.pdf"),"Original");
    assert.equal(legacyOutputStatus(f.root,f.project("alice")),"available");
    assert.equal(await resolvePdfPreviewFile(f.root,f.project("alice"),"06_Final/alt.pdf"),path.join(old.finalPath,"alt.pdf"));
    const fresh=await createProjectFolder(f.root,f.project("alice"));assert.notEqual(old.projectPath,fresh.projectPath);assert.equal(await fs.readFile(path.join(old.finalPath,"alt.pdf"),"utf8"),"Original");
  }finally{f.db.close();}
});

test("Symlinks umgehen weder Ausgabegrenzen noch Anhangsgrenzen",async()=>{
  const f=await fixture();try{
    const a=await createProjectFolder(f.root,f.project("alice")),b=await createProjectFolder(f.root,f.project("bob"));
    await fs.writeFile(path.join(b.finalPath,"privat.pdf"),"nur Bob");await fs.symlink(path.join(b.finalPath,"privat.pdf"),path.join(a.finalPath,"link.pdf"));
    await assert.rejects(resolvePdfPreviewFile(f.root,f.project("alice"),"06_Final/link.pdf"),{status:403});
    const record=await attachment(f,"bob");const files={dataDir:path.join(scopedProjectRoot(f.root,"alice","same"),"data")};
    await assert.rejects(resolveAttachmentFile(f.root,files,record.relativePath),{status:403});
    await assert.rejects(deleteAttachment(f.root,[record],record.id,files),{status:403});
    assert.equal(await fs.readFile(path.join(f.root,record.relativePath),"utf8"),"synthetische Testdatei");
  }finally{f.db.close();}
});

test("Gelöschte eigene Anhänge bleiben im privaten Rückfalleordner erhalten",async()=>{
  const f=await fixture();try{
    const record=await attachment(f),owner=scopedProjectRoot(f.root,"alice","same");
    assert.deepEqual(await deleteAttachment(f.root,[record],record.id,{dataDir:path.join(owner,"data")}),[]);
    const trash=await fs.readdir(path.join(owner,".trash"));assert.equal(trash.length,1);assert.equal(await fs.readFile(path.join(owner,".trash",trash[0]),"utf8"),"synthetische Testdatei");
  }finally{f.db.close();}
});

test("Vollständiges Projektpaket: Anhänge, manuelle PDFs, generierte/finale Dateien und echtes ZIP",async()=>{
  const f=await fixture();try{
    const record=await attachment(f),p=await createProjectFolder(f.root,f.project("alice"));
    await fs.writeFile(path.join(p.generatedPath,"intern.pdf"),"intern");await fs.writeFile(path.join(p.finalPath,"Gesamt.pdf"),"final");await fs.writeFile(path.join(p.configPath,"messung.pdf"),"manuell");
    const before=await fs.readFile(path.join(scopedProjectRoot(f.root,"alice","same"),"data/anhaenge.json"));
    const output=await exportProject(f.root,"same","alice");assert.equal(output.zipCreated,true);
    assert.equal((await validateProjectArchive(output.packageRoot)).ok,true);
    assert.equal(await fs.readFile(path.join(output.packageRoot,"uploads/anhaenge/Pruefplan.pdf"),"utf8"),"synthetische Testdatei");
    assert.equal(await fs.readFile(path.join(output.packageRoot,"generated/intern.pdf"),"utf8"),"intern");
    assert.equal(await fs.readFile(path.join(output.packageRoot,"final/Gesamt.pdf"),"utf8"),"final");
    assert.equal(await fs.readFile(path.join(output.packageRoot,"documents/messung.pdf"),"utf8"),"manuell");
    const archive=await fs.readFile(output.zipPath);assert.equal(archive.readUInt32LE(),0x04034b50);assert.equal(archive.readUInt32LE(archive.length-22),0x06054b50);
    const count=archive.readUInt16LE(archive.length-12);assert.ok(count>=13);
    let offset=archive.readUInt32LE(archive.length-6);const names=[];
    for(let i=0;i<count;i++){assert.equal(archive.readUInt32LE(offset),0x02014b50);const length=archive.readUInt16LE(offset+28);names.push(archive.subarray(offset+46,offset+46+length).toString());offset+=46+length+archive.readUInt16LE(offset+30)+archive.readUInt16LE(offset+32);}
    assert.ok(names.includes("projekt_export/uploads/anhaenge/Pruefplan.pdf"));
    const metadata=await readJson(path.join(output.packageRoot,"data/anhaenge.json"));assert.equal(metadata[0].relativePath,"uploads/anhaenge/Pruefplan.pdf");
    assert.deepEqual(await fs.readFile(path.join(scopedProjectRoot(f.root,"alice","same"),"data/anhaenge.json")),before);
    assert.equal(await resolveArchiveDownload(f.root,"alice",path.relative(f.root,output.zipPath)),output.zipPath);
    await assert.rejects(resolveArchiveDownload(f.root,"bob",path.relative(f.root,output.zipPath)));
    await assert.rejects(resolveArchiveDownload(f.root,"alice",record.relativePath));
    await assert.rejects(resolveArchiveDownload(f.root,"alice",path.relative(f.root,path.join(output.packageRoot,"data/projekt.json"))));
    const partial=await exportProject(f.root,"same","alice",{includeUploads:false,includeGenerated:false,includeFinal:false,createZip:false});
    const partialManifest=await readJson(partial.manifestPath);assert.equal(partial.zipCreated,false);assert.equal(partial.complete,false);
    assert.equal(Object.keys(partialManifest.files).some(file=>/^(uploads|documents|generated|final)\//.test(file)),false);
    assert.equal((await validateProjectArchive(partial.packageRoot)).ok,true);
  }finally{f.db.close();}
});

test("Archivimport erstellt eine neue Projektkennung und schreibt alle Dateiverweise zum Zielkonto um",async()=>{
  const f=await fixture();try{
    await attachment(f);const output=await exportProject(f.root,"same","alice");
    const incoming=path.join(f.root,"storage/imports/bob/paket");await fs.cp(output.packageRoot,incoming,{recursive:true});
    const existing=await fs.readFile(path.join(scopedProjectRoot(f.root,"bob","same"),"data/projekt.json"));
    const imported=await importProject(f.root,"paket","bob");assert.notEqual(imported.projectId,"same");assert.ok(getProject("bob",imported.projectId));
    const meta=await readJson(path.join(scopedProjectRoot(f.root,"bob",imported.projectId),"data/anhaenge.json"));
    assert.ok(meta[0].relativePath.startsWith(`storage/users/bob/projects/${imported.projectId}/`));assert.ok(!meta[0].relativePath.includes("alice"));
    assert.equal(await fs.readFile(path.join(f.root,meta[0].relativePath),"utf8"),"synthetische Testdatei");
    assert.deepEqual(await fs.readFile(path.join(scopedProjectRoot(f.root,"bob","same"),"data/projekt.json")),existing);
    await assert.rejects(resolveImportDirectory(f.root,"alice","../bob/paket"));
  }finally{f.db.close();}
});

test("Beschädigte Pakete und manipulierte Prüfsummen werden vor dem Import zurückgewiesen",async()=>{
  const f=await fixture();try{
    await attachment(f);const out=await exportProject(f.root,"same","alice");
    const incoming=path.join(f.root,"storage/imports/bob/kaputt");await fs.cp(out.packageRoot,incoming,{recursive:true});
    await fs.appendFile(path.join(incoming,"uploads/anhaenge/Pruefplan.pdf"),"Manipulation");
    assert.equal((await validateProjectArchive(incoming)).ok,false);
    await assert.rejects(importProject(f.root,"kaputt","bob"));assert.equal(getProject("bob","same_import_1"),undefined);
  }finally{f.db.close();}
});

test("Schon im Quellprojekt fehlende Dateien bleiben als ausdrücklicher Hinweis erhalten",async()=>{
  const f=await fixture();try{
    const file=path.join(scopedProjectRoot(f.root,"alice","same"),"data/projekt.json");
    await writeJson(file,{projektname:"Beispielprojekt",projektnummer:"DEMO",logoPfad:"public/img/fehlendes-logo.png"});
    const before=await fs.readFile(file);const result=await exportProject(f.root,"same","alice");
    assert.equal(result.complete,false);assert.deepEqual(result.missingFiles,["uploads/assets/fehlendes-logo.png"]);
    const validated=await validateProjectArchive(result.packageRoot);assert.equal(validated.ok,true);assert.equal(validated.complete,false);
    assert.equal((await readJson(result.manifestPath)).complete,false);assert.deepEqual(await fs.readFile(file),before);
  }finally{f.db.close();}
});

test("Alte projekt-relative Bildverweise lesen niemals gleichnamige globale Dateien",async()=>{
  const f=await fixture();try{
    await fs.mkdir(path.join(f.root,"anhaenge/brandschutz"),{recursive:true});await fs.writeFile(path.join(f.root,"anhaenge/brandschutz/foto.png"),"Globale fremde Datei");
    const file=path.join(scopedProjectRoot(f.root,"alice","same"),"data/brandschutz.json");await writeJson(file,[{id:"alt",foto_vorher:"anhaenge/brandschutz/foto.png"}]);
    await assert.rejects(resolveProjectSource(f.root,f.project("alice"),"anhaenge/brandschutz/foto.png"),{code:"ENOENT"});
    const result=await exportProject(f.root,"same","alice");assert.equal(result.complete,false);assert.ok(result.missingFiles.includes("uploads/anhaenge/brandschutz/foto.png"));
    const manifest=await readJson(result.manifestPath);assert.equal(Object.keys(manifest.files).includes("uploads/anhaenge/brandschutz/foto.png"),false);
    assert.equal((await readJson(file))[0].foto_vorher,"anhaenge/brandschutz/foto.png");
  }finally{f.db.close();}
});

test("Auch mit neu berechneten Prüfsummen sind fremde, absolute und Traversal-Dateiverweise unzulässig",async()=>{
  const f=await fixture();try{
    await attachment(f);const out=await exportProject(f.root,"same","alice");
    for(const attack of ["../../storage/app.db","/etc/passwd","storage/users/alice/projects/same/anhaenge/Pruefplan.pdf"]){
      const file=path.join(out.packageRoot,"data/anhaenge.json");const rows=await readJson(file);rows[0].relativePath=attack;await writeJson(file,rows);
      const manifest=await readJson(out.manifestPath);const bytes=await fs.readFile(file);manifest.files["data/anhaenge.json"]={size:bytes.length,sha256:hash(bytes)};await writeJson(out.manifestPath,manifest);
      const validation=await validateProjectArchive(out.packageRoot);assert.equal(validation.ok,false,attack);
    }
  }finally{f.db.close();}
});

test("Verknüpfungen im Importpaket werden unabhängig vom Manifest abgewiesen",async()=>{
  const f=await fixture();try{
    await attachment(f);const out=await exportProject(f.root,"same","alice");await fs.symlink(path.join(f.root,"storage/app.db"),path.join(out.packageRoot,"link"));
    assert.equal((await validateProjectArchive(out.packageRoot)).ok,false);
    await assert.rejects(assertSafePath(f.root,path.join(out.packageRoot,"link")),{status:403});
  }finally{f.db.close();}
});

test("Login-Begrenzung zählt Fehlversuche und endet nach der Wartezeit",()=>{
  let time=1000;const limiter=createAuthLimiter({maxFailures:2,windowMs:1000,now:()=>time});
  const req={ip:"127.0.0.1",body:{email:"Test"}},res={set(){}};
  let error;const check=()=>{error=null;limiter.check(req,res,e=>{error=e;});};
  check();assert.equal(error,undefined);limiter.failed(req);limiter.failed(req);check();assert.equal(error.status,429);
  time=2001;check();assert.equal(error,undefined);
});

test("Fehlgeschlagene Veröffentlichung eines finalen Exports erhält die letzte fertige Ausgabe",async()=>{
  const f=await fixture();try{
    const project=f.project("alice"),paths=await createProjectFolder(f.root,project);
    await fs.writeFile(path.join(paths.finalPath,"behalten.pdf"),"Originalausgabe");
    await generateInhaltsverzeichnis(f.root,project,[],{lizenz:{brandingAktiv:false}});
    const listing=path.join(scopedProjectRoot(f.root,"alice","same"),"data/exportliste.json");
    await buildExportliste(f.root,project,[],listing);
    await fs.writeFile(path.join(paths.projectPath,"07_Vorherige_Exporte"),"Speicherziel blockiert");
    await assert.rejects(prepareFinalExport(f.root,project,[],listing));
    assert.equal(await fs.readFile(path.join(paths.finalPath,"behalten.pdf"),"utf8"),"Originalausgabe");
    assert.equal((await fs.readdir(paths.projectPath)).some(name=>name.startsWith(".final-")),false);
  }finally{f.db.close();}
});

test("Erfolgreiche finale Exporte bewahren vorherige Ausgaben in der Projekthistorie auf",async()=>{
  const f=await fixture();try{
    const project=f.project("alice"),paths=await createProjectFolder(f.root,project);
    await fs.writeFile(path.join(paths.finalPath,"behalten.pdf"),"Originalausgabe");
    await generateInhaltsverzeichnis(f.root,project,[],{lizenz:{brandingAktiv:false}});
    const listing=path.join(scopedProjectRoot(f.root,"alice","same"),"data/exportliste.json");await buildExportliste(f.root,project,[],listing);
    const result=await prepareFinalExport(f.root,project,[],listing);assert.ok(result.zipPath.startsWith(paths.finalPath));assert.ok((await fs.stat(result.completePdfPath)).size>0);
    const history=path.join(paths.projectPath,"07_Vorherige_Exporte");const [version]=await fs.readdir(history);
    assert.equal(await fs.readFile(path.join(history,version,"behalten.pdf"),"utf8"),"Originalausgabe");
  }finally{f.db.close();}
});

async function boot(root) {
  const socket=net.createServer();await new Promise(r=>socket.listen(0,"127.0.0.1",r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const child=spawn(process.execPath,[path.join(root,"server.js")],{cwd:root,env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});let logs="";
  child.stdout.on("data",d=>logs+=d);child.stderr.on("data",d=>logs+=d);
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++){
    try{if((await fetch(base+"/api/health")).status===200)return{child,base};}catch{}
    if(child.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,50));
  }
  child.kill();throw new Error("Teststart fehlgeschlagen: "+logs);
}
async function stop(child){if(child.exitCode===null){const done=new Promise(r=>child.once("exit",r));child.kill();await done;}}
async function page(app,user) {
  const session="session_"+user;
  const response=await fetch(app.base+"/dashboard",{headers:{Cookie:"dm_session="+session}});assert.equal(response.status,200);
  const html=await response.text();const csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
  const cookies=response.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
  return{csrf,cookie:`dm_session=${session}; ${cookies}`,html};
}

test("HTTP: CSRF, Rollen, Cookies und Speicherfehler greifen im echten Server",async()=>{
  const f=await fixture({program:true});let app;
  try{
    for(const user of ["alice","bob","reader"])createSession("session_"+user,user,"2099-01-01T00:00:00.000Z");
    app=await boot(f.root);const a=await page(app,"alice"),v=await page(app,"reader"),b=await page(app,"bob");
    const post=(url,ctx,fields={},extra={})=>fetch(app.base+url,{method:"POST",redirect:"manual",headers:{Cookie:ctx.cookie,Accept:"application/json","Content-Type":"application/x-www-form-urlencoded",...extra},body:new URLSearchParams(fields)});
    assert.equal((await post("/projekt",a,{projektname:"CSRF-Angriff"})).status,403);
    const htmlFailure=await fetch(app.base+"/projekt",{method:"POST",headers:{Cookie:a.cookie,"Content-Type":"application/x-www-form-urlencoded"},body:"projektname=Fehlversuch"});assert.equal(htmlFailure.status,403);assert.doesNotMatch(await htmlFailure.text(),/ReferenceError|is not defined/);
    assert.equal((await post("/projekt",a,{_csrf:a.csrf},{Origin:"https://fremde-seite.invalid"})).status,403);
    assert.equal((await post("/projekt",v,{_csrf:v.csrf})).status,403);
    assert.equal((await post("/einstellungen/ersteller",a,{_csrf:a.csrf})).status,403);
    const permitted=await post("/projekt",a,{_csrf:a.csrf,projektname:"Beabsichtigtes Speichern"});assert.equal(permitted.status,200);assert.equal((await permitted.json()).ok,true);
    const dir=path.join(scopedProjectRoot(f.root,"alice","same"),"data/geraetelisten.json");await fs.rename(dir,dir+".original");await fs.mkdir(dir);
    const failed=await post("/geraetelisten",a,{_csrf:a.csrf});assert.ok([403,500].includes(failed.status));assert.equal((await failed.json()).ok,false);
    assert.equal(await fs.readFile(dir+".original","utf8"),"[]\n");
    const admin=await post("/einstellungen/ersteller",b,{_csrf:b.csrf,firma:"Neutrale Testfirma"});assert.equal(admin.status,200);
    const malformed=await fetch(app.base+"/login",{headers:{Cookie:"kaputt=%XX"}});assert.equal(malformed.status,200);
    const archive=await fetch(app.base+"/projektarchiv/download?pfad=storage/app.db",{headers:{Cookie:a.cookie,Accept:"application/json"}});assert.ok([400,403].includes(archive.status));
    // Alle serverseitig gerenderten POST-Formulare tragen den Token, einschließlich Multipart.
    const formPage=await fetch(app.base+"/anhaenge",{headers:{Cookie:b.cookie}});const formHtml=await formPage.text();const forms=formHtml.match(/<form\b[\s\S]*?<\/form>/g)||[];for(const form of forms.filter(x=>/method="post"/.test(x)))assert.match(form,/name="_csrf"/);
    const multipart=new FormData();multipart.set("_csrf",b.csrf);multipart.set("file",new Blob(["%PDF-1.4 neutral"] ,{type:"application/pdf"}),"Pruefung.pdf");
    const upload=await fetch(app.base+"/anhaenge/upload",{method:"POST",redirect:"manual",headers:{Cookie:b.cookie},body:multipart});assert.equal(upload.status,302);
    assert.ok((await readJson(path.join(scopedProjectRoot(f.root,"bob","same"),"data/anhaenge.json"))).length===1);
    const htmlRelative="storage/users/bob/projects/same/anhaenge/nicht-ausfuehren.html";
    await fs.writeFile(path.join(f.root,htmlRelative),"<script>window.unerlaubt=true</script>");
    const bFiles=path.join(scopedProjectRoot(f.root,"bob","same"),"data/anhaenge.json");const bRows=await readJson(bFiles);bRows.push({id:"html",relativePath:htmlRelative,mimeType:"text/html",fileName:"fremd.html"});await writeJson(bFiles,bRows);
    assert.equal((await fetch(app.base+"/anhaenge/preview?id=html",{headers:{Cookie:b.cookie,Accept:"application/json"}})).status,415);
    const denied=await post("/projekte/nicht-im-besitz/archivieren",b,{_csrf:b.csrf});assert.equal(denied.status,403);assert.equal((await denied.json()).ok,false);
    const disabled=await post("/einstellungen/benutzer/alice/status",b,{_csrf:b.csrf,status:"disabled"});assert.equal(disabled.status,200);
    assert.equal((await fetch(app.base+"/dashboard",{redirect:"manual",headers:{Cookie:a.cookie}})).status,302);
    await post("/einstellungen/benutzer/alice/status",b,{_csrf:b.csrf,status:"active"});createSession("session_alice","alice","2099-01-01T00:00:00.000Z");
    const reset=await post("/einstellungen/benutzer/alice/passwort",b,{_csrf:b.csrf,password:"neues-synthetisches-passwort"});assert.equal(reset.status,200);
    assert.equal((await fetch(app.base+"/dashboard",{redirect:"manual",headers:{Cookie:a.cookie}})).status,302);
    const spoofed=await fetch(app.base+"/login",{headers:{"X-Forwarded-Proto":"https"}});assert.ok(spoofed.headers.getSetCookie().every(cookie=>!cookie.includes("; Secure")));
  }finally{if(app)await stop(app.child);f.db.close();}
});
