const fs = require("fs/promises");
const { createReadStream } = require("fs");
const path = require("path");
const crypto = require("crypto");
const { safeJoin, assertSafePath, accessError, sanitizeId, sanitizeFileName } = require("./pathService");
const { readJson, writeJson } = require("./jsonService");
const { getProject, getUserById, upsertProject } = require("./dbService");
const { bindProjectScope, scopedProjectRoot, getProjectPaths, readableProjectPaths, legacyOutputStatus } = require("./projectService");
const { writeZipFile } = require("./zipService");
const api = () => require("./projectArchiveService");
const slash = value => value.split(path.sep).join("/");
const pathKeys = new Set(["relativePath", "dateipfad", "foto_vorher", "foto_nachher", "logoPfad"]);
const arrayFiles = new Set(["projektSysteme.json", "dokumentenmatrix.json", "geraetelisten.json", "brandschutz.json", "anhaenge.json", "exportliste.json"]);
function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }
async function exists(file) { try { await fs.lstat(file); return true; } catch (e) { if (e.code === "ENOENT") return false; throw e; } }
async function digest(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function regularFiles(base, directory = base) {
  if (!(await exists(directory))) return [];
  await assertSafePath(base, directory, { type: "directory" });
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = await assertSafePath(base, path.join(directory, entry.name));
    if (entry.isDirectory()) result.push(...await regularFiles(base, file));
    else if (entry.isFile()) result.push(file);
    else throw accessError("Verknüpfungen und Spezialdateien sind in Projektpaketen nicht erlaubt.");
  }
  return result;
}
function mapValues(value, rewrite, key = "") {
  if (Array.isArray(value)) return value.map(item => mapValues(item, rewrite, key));
  if (value && typeof value === "object") {
    if (Object.keys(value).some(k => ["__proto__", "prototype", "constructor"].includes(k))) throw invalid("Ungültiger Schlüssel im Projektpaket.");
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, mapValues(v, rewrite, k)]));
  }
  return typeof value === "string" ? rewrite(value, key) : value;
}
function portablePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.split("/").some(p => !p || p === "." || p === "..")) throw invalid("Das Paket enthält einen nicht erlaubten Dateipfad.");
  return value;
}
function projectAccess(userId, projectId) {
  const record = getProject(userId, projectId);
  if (!getUserById(userId) || !record || record.status === "geloescht") throw accessError("Kein Zugriff auf dieses Projekt.");
}

async function resolveImportDirectory(rootDir, userId, name) {
  if (!userId) throw accessError();
  const base = path.join(rootDir, "storage", "imports", sanitizeId(userId));
  const target = safeJoin(base, portablePath(name));
  return assertSafePath(rootDir, target, { type: "directory" });
}

async function resolveArchiveDownload(rootDir, userId, relativePath) {
  const base = path.join(rootDir, "storage", "exports", sanitizeId(userId));
  const target = safeJoin(rootDir, portablePath(relativePath));
  const inside = slash(path.relative(base, target));
  portablePath(inside);
  const parts = inside.split("/");
  if (parts.length < 3 || parts.some(part => part.startsWith("."))) throw accessError();
  projectAccess(userId, parts[0]);
  const extension = path.extname(target).toLowerCase();
  if (!(extension === ".zip" && parts.length === 3) && !(parts.length === 4 && parts[2] === "projekt_export" && parts[3] === "manifest.json")) throw accessError();
  return assertSafePath(rootDir, target, { type: "file" });
}

async function exportProject(rootDir, projectId, userId, options = {}) {
  projectAccess(userId, projectId);
  const flags = Object.fromEntries(["includeUploads", "includeGenerated", "includeFinal"].map(k => [k, options[k] !== false]));
  const data = {};
  const originals = new Map();
  const files = api().dataFilesForProject(rootDir, userId, projectId);
  for (const name of api().DATA_FILE_NAMES) {
    const file = await assertSafePath(rootDir, path.join(files.dataDir, name), { type: "file" });
    originals.set(file, await digest(file));
    data[name] = await readJson(file);
  }
  const projekt = bindProjectScope(data["projekt.json"], userId, projectId);
  const ownerRoot = scopedProjectRoot(rootDir, userId, projectId);
  const separateLegacy = legacyOutputStatus(rootDir, projekt) === "ambiguous";
  const base = path.join(rootDir, "storage", "exports", sanitizeId(userId), sanitizeId(projectId));
  await assertSafePath(rootDir, base, { allowMissing: true });
  await fs.mkdir(base, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g,"-") + "_" + crypto.randomBytes(4).toString("hex");
  const working = await fs.mkdtemp(path.join(base, ".paket-"));
  const packageRoot = path.join(working, "projekt_export");
  const mapping = new Map();
  const destinations = new Map();
  const copySources = new Map();
  const missingFiles = new Set();
  async function include(source, destination, enabled = true, allowMissing = false) {
    portablePath(destination);
    mapping.set(slash(path.relative(rootDir, source)), destination);
    if (!enabled || destinations.has(destination)) return;
    try { await assertSafePath(rootDir, source, { type: "file" }); }
    catch(error) { if (allowMissing && error.code === "ENOENT") { missingFiles.add(destination); return; } throw error; }
    const before = await digest(source);
    const target = safeJoin(packageRoot, destination);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    if (await digest(target) !== before) throw invalid("Eine Datei hat sich während der Sicherung verändert. Bitte erneut exportieren.");
    originals.set(source, before); destinations.set(destination, target); copySources.set(source, destination);
  }
  try {
    await fs.mkdir(path.join(packageRoot,"data"), { recursive: true });
    // Der abgeleitete Exportindex wird nach einem Import aus den Zielpfaden neu aufgebaut.
    // Sein Original bleibt vollständig als passive Begleitmetadaten erhalten.
    await writeJson(path.join(packageRoot,"metadata/exportliste-original.json"),data["exportliste.json"]);
    data["exportliste.json"]=[];
    // Der Benutzer hat den gemeinsamen Altbestand ausdrücklich als separaten historischen Bestand gewählt.
    // Der alte Exportindex bleibt vollständig erhalten, wird aber nicht als neue Dateifreigabe importiert.
    if (separateLegacy) {
      await fs.writeFile(path.join(packageRoot,"HINWEIS_ALT_AUSGABEN.txt"),"Gemeinsam genutzte historische Ausgaben sind nicht Teil dieses Projektpakets. Die Originaldateien bleiben auf dem Quellsystem und in dessen Vollsicherung erhalten. Der alte Exportindex liegt unter metadata/exportliste-original.json und wird beim Import nicht als Dateifreigabe aktiviert.\n");
    }
    for (const file of await regularFiles(rootDir,path.join(ownerRoot,"archive-metadata"))) await include(file,"metadata/imported/"+slash(path.relative(path.join(ownerRoot,"archive-metadata"),file)));
    for (const folder of ["anhaenge", "uploads", "assets"]) {
      for (const file of await regularFiles(rootDir, path.join(ownerRoot, folder))) await include(file, "uploads/"+slash(path.relative(ownerRoot,file)), flags.includeUploads);
    }
    const roots = readableProjectPaths(rootDir, projekt);
    for (const source of roots) {
      for (const [field,prefix,enabled] of [["configPath","documents",flags.includeUploads],["generatedPath","generated",flags.includeGenerated],["finalPath","final",flags.includeFinal]]) {
        for (const file of await regularFiles(rootDir, source[field])) await include(file,prefix+"/"+slash(path.relative(source[field],file)),enabled);
      }
    }
    // Auch ausgelassene Anhänge erhalten portable, niemals fremde Serverpfade.
    for (const value of Object.values(data)) mapValues(value,(text,key)=>{
      if (!pathKeys.has(key) || !text || mapping.has(text)) return text;
      const source = /^(anhaenge|uploads|assets)\//.test(text) ? safeJoin(ownerRoot,text) : safeJoin(rootDir, text);
      const relative = slash(path.relative(ownerRoot, source));
      try { portablePath(relative); mapping.set(text,"uploads/"+relative); }
      catch {
        if (key === "logoPfad" && text.startsWith("public/img/")) mapping.set(text,"uploads/assets/"+path.basename(text));
        else throw invalid("Ein Dateiverweis liegt außerhalb der Projektablage. Die Quelldaten bleiben unverändert.");
      }
      return text;
    });
    if (flags.includeUploads) for (const [source,destination] of mapping) {
      if (destination.startsWith("uploads/") && !destinations.has(destination)) await include(/^(anhaenge|uploads|assets)\//.test(source)?safeJoin(ownerRoot,source):safeJoin(rootDir,source),destination,true,true);
    }
    for (const [name,value] of Object.entries(data)) await writeJson(path.join(packageRoot,"data",name),mapValues(value,(text,key)=>pathKeys.has(key)&&text?mapping.get(text)||text:text));
    const manifest = { exportVersion:"2.0",appName:"edoku",appVersion:require("../package.json").version,exportedAt:new Date().toISOString(),project:{id:projectId,projektname:projekt.projektname||"",projektnummer:projekt.projektnummer||""},user:{id:userId},contents:{dataFiles:api().DATA_FILE_NAMES,uploadsIncluded:flags.includeUploads,generatedIncluded:flags.includeGenerated,finalIncluded:flags.includeFinal,separateHistoricalOutputs:separateLegacy,exportIndexRebuilt:true},complete:Object.values(flags).every(Boolean)&&!missingFiles.size&&!separateLegacy,missingFiles:[...missingFiles],files:{} };
    if(missingFiles.size)await fs.writeFile(path.join(packageRoot,"FEHLENDE_QUELLDATEIEN.txt"),"Diese Dateiverweise waren schon im Quellprojekt nicht vorhanden. Projektangaben und vorhandene Dateien wurden gesichert. Das Paket ist hinsichtlich dieser Quelldateien unvollständig:\n"+[...missingFiles].join("\n")+"\n");
    for (const file of await regularFiles(rootDir,packageRoot)) manifest.files[slash(path.relative(packageRoot,file))]={size:(await fs.stat(file)).size,sha256:await digest(file)};
    await writeJson(path.join(packageRoot,"manifest.json"),manifest);
    const validation = await validateProjectArchive(packageRoot);
    if (!validation.ok) throw invalid(validation.error||"Das Paket ist nicht vollständig.");
    for (const [file,hash] of originals) if (await digest(file)!==hash) throw invalid("Das Projekt wurde während des Exports geändert. Bitte erneut versuchen.");
    let zipName="";
    if (options.createZip !== false) {
      zipName=`ProjektExport_${sanitizeFileName(projekt.projektnummer,"Projekt")}_${stamp}.zip`;
      const entries=(await regularFiles(rootDir,packageRoot)).map(file=>({sourcePath:file,zipPath:"projekt_export/"+slash(path.relative(packageRoot,file))}));
      await writeZipFile(path.join(working,zipName),entries);
    }
    const exportRoot=path.join(base,stamp);
    await fs.rename(working,exportRoot);
    return {exportRoot,packageRoot:path.join(exportRoot,"projekt_export"),manifestPath:path.join(exportRoot,"projekt_export/manifest.json"),zipPath:zipName?path.join(exportRoot,zipName):"",zipCreated:Boolean(zipName),separateHistoricalOutputs:separateLegacy,missingFiles:[...missingFiles],complete:manifest.complete};
  } catch(error) { await fs.rm(working,{recursive:true,force:true}); throw error; }
}

async function validateProjectArchive(archivePath) {
  const result={ok:false,manifestFound:false,versionCompatible:false,requiredFilesPresent:false,missingDataFiles:[],uploadsPresent:false,generatedPresent:false,finalPresent:false,manifest:null};
  try {
    const all=await regularFiles(archivePath);
    result.manifestFound=all.includes(path.join(archivePath,"manifest.json"));
    if (!result.manifestFound) throw invalid("manifest.json fehlt.");
    const manifest=await readJson(path.join(archivePath,"manifest.json")); result.manifest=manifest;
    result.versionCompatible=["1.0","2.0"].includes(manifest?.exportVersion);
    if (!result.versionCompatible || !manifest.project || typeof manifest.project.id!=="string") throw invalid("Paketversion oder Projektkennung ist ungültig.");
    const values={};
    for(const name of api().DATA_FILE_NAMES){
      if(!all.includes(path.join(archivePath,"data",name))){result.missingDataFiles.push(name);continue;}
      values[name]=await readJson(path.join(archivePath,"data",name));
      if(values[name]===null || typeof values[name]!=="object" || (arrayFiles.has(name)&&!Array.isArray(values[name])) || (name==="projekt.json"&&Array.isArray(values[name]))) throw invalid("Ungültige Projektdatei: "+name);
    }
    result.requiredFilesPresent=!result.missingDataFiles.length;
    if(!result.requiredFilesPresent) throw invalid("Benötigte Projektdateien fehlen.");
    if(manifest.exportVersion==="2.0"){
      if(!manifest.files || Array.isArray(manifest.files)) throw invalid("Dateiprüfsummen fehlen.");
      const expected=Object.keys(manifest.files).map(portablePath).sort();
      const found=all.map(file=>slash(path.relative(archivePath,file))).filter(file=>file!=="manifest.json").sort();
      if(JSON.stringify(expected)!==JSON.stringify(found)) throw invalid("Dateibestand und Manifest stimmen nicht überein.");
      for(const relative of expected){const file=safeJoin(archivePath,relative),info=manifest.files[relative];if((await fs.stat(file)).size!==info.size || await digest(file)!==info.sha256) throw invalid("Prüfsumme stimmt nicht: "+relative);}
    }
    for(const value of Object.values(values))mapValues(value,(text,key)=>{
      if(!pathKeys.has(key)||!text)return text;
      portablePath(text);
      const prefix=text.split("/")[0];
      if(!["uploads","documents","generated","final"].includes(prefix)) throw invalid("Dateiverweis ist nicht portabel. Ältere unvollständige Pakete bitte aus der Originalsicherung neu erstellen.");
      const required=prefix==="uploads"||prefix==="documents"?manifest.contents?.uploadsIncluded!==false:prefix==="generated"?manifest.contents?.generatedIncluded!==false:manifest.contents?.finalIncluded!==false;
      const declaredMissing=manifest.exportVersion==="2.0"&&Array.isArray(manifest.missingFiles)&&manifest.missingFiles.includes(text);
      if(required&&!declaredMissing&&!all.includes(safeJoin(archivePath,text)))throw invalid("Referenzierte Datei fehlt: "+text);
      return text;
    });
    for(const [field,folder] of [["uploadsPresent","uploads"],["generatedPresent","generated"],["finalPresent","final"]])result[field]=await exists(path.join(archivePath,folder));
    result.fileSnapshot={};
    for(const file of all)result.fileSnapshot[slash(path.relative(archivePath,file))]=await digest(file);
    result.missingSourceFiles=Array.isArray(manifest.missingFiles)?manifest.missingFiles.filter(value=>typeof value==="string").map(portablePath):[];
    result.complete=manifest.exportVersion==="2.0"&&!result.missingSourceFiles.length&&!manifest.contents?.separateHistoricalOutputs&&["uploadsIncluded","generatedIncluded","finalIncluded"].every(key=>manifest.contents?.[key]===true);
    result.ok=true;
  }catch(error){result.error=error.status===400?error.message:"Projektpaket ist nicht lesbar oder enthält unzulässige Dateien.";}
  return result;
}

async function importProject(rootDir, name, userId) {
  const archivePath=await resolveImportDirectory(rootDir,userId,name);
  const validation=await validateProjectArchive(archivePath);
  if(!validation.ok)throw invalid(validation.error);
  const manifest=validation.manifest;
  let id, target;
  const baseId=sanitizeId(manifest.project.id,"projekt_import");
  for(let index=0;;index++){
    id=index?`${baseId.slice(0,60)}_import_${index}`:baseId;
    target=scopedProjectRoot(rootDir,userId,id);
    if(getProject(userId,id))continue;
    await assertSafePath(rootDir,target,{allowMissing:true});
    await fs.mkdir(path.dirname(target),{recursive:true});
    try{await fs.mkdir(target);break;}catch(error){if(error.code!=="EEXIST")throw error;}
  }
  const output=getProjectPaths(rootDir,bindProjectScope({},userId,id));
  const prefixes={uploads:target,documents:output.configPath,generated:output.generatedPath,final:output.finalPath};
  function relocated(text){const parts=portablePath(text).split("/");const base=prefixes[parts.shift()];if(!base)throw invalid("Unzulässiger Dateiverweis.");return slash(path.relative(rootDir,safeJoin(base,...parts)));}
  async function copyVerified(file,destination){
    await assertSafePath(archivePath,file,{type:"file"});
    await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(file,destination);
    if(await digest(destination)!==validation.fileSnapshot[slash(path.relative(archivePath,file))])throw invalid("Eine Importdatei wurde während des Kopierens verändert.");
  }
  try{
    for (const file of await regularFiles(archivePath,path.join(archivePath,"metadata"))) {
      const dest=safeJoin(target,"archive-metadata",path.relative(path.join(archivePath,"metadata"),file));
      await copyVerified(file,dest);
    }
    for(const [prefix,destination]of Object.entries(prefixes)){
      const directory=path.join(archivePath,prefix);
      for(const file of await regularFiles(archivePath,directory)){
        const dest=safeJoin(destination,path.relative(directory,file));await copyVerified(file,dest);
      }
    }
    for(const name of api().DATA_FILE_NAMES){
      const source=await assertSafePath(archivePath,path.join(archivePath,"data",name),{type:"file"});
      const bytes=await fs.readFile(source);
      if(crypto.createHash("sha256").update(bytes).digest("hex")!==validation.fileSnapshot["data/"+name])throw invalid("Eine Projektdatei wurde während des Imports verändert.");
      let value=JSON.parse(bytes.toString("utf8"));
      value=mapValues(value,(text,key)=>pathKeys.has(key)&&text?relocated(text):text);
      if(name==="projekt.json")Object.assign(value,{importiertAm:new Date().toISOString(),importiertVon:userId,originalProjectId:manifest.project.id});
      await writeJson(path.join(target,"data",name),value);
    }
    // Registrierung erst nach vollständiger, erneut geprüfter Kopie.
    const second=await validateProjectArchive(archivePath);if(!second.ok || JSON.stringify(second.manifest)!==JSON.stringify(manifest))throw invalid("Das Importpaket wurde zwischenzeitlich verändert.");
    const now=new Date().toISOString();upsertProject({id,userId,status:"aktiv",createdAt:now,updatedAt:now,originalProjectId:manifest.project.id});
    return {projectId:id,validation};
  }catch(error){await fs.rm(target,{recursive:true,force:true});throw error;}
}

async function listExports(rootDir,userId,projectId){
  projectAccess(userId,projectId);
  const base=path.join(rootDir,"storage/exports",sanitizeId(userId),sanitizeId(projectId));
  if(!(await exists(base)))return[];
  await assertSafePath(rootDir,base,{type:"directory"});
  const result=[];
  for(const item of await fs.readdir(base,{withFileTypes:true})){
    if(!item.isDirectory()||item.name.startsWith("."))continue;
    const folder=await assertSafePath(rootDir,path.join(base,item.name),{type:"directory"});
    const manifestFile=path.join(folder,"projekt_export/manifest.json");
    if(!(await exists(manifestFile)))continue;
    await assertSafePath(rootDir,manifestFile,{type:"file"});
    const manifest=await readJson(manifestFile);
    const zip=(await fs.readdir(folder,{withFileTypes:true})).find(e=>e.isFile()&&e.name.endsWith(".zip"));
    result.push({timestamp:item.name,projekt:manifest.project?.projektname||"",dateiname:zip?.name||"projekt_export",pfad:slash(path.relative(rootDir,folder)),manifestPfad:slash(path.relative(rootDir,manifestFile)),zipPfad:zip?slash(path.relative(rootDir,path.join(folder,zip.name))):""});
  }
  return result.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
}

module.exports={exportProject,importProject,listExports,validateProjectArchive,resolveArchiveDownload,resolveImportDirectory};
