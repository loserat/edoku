const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");
const { sanitizeId } = require("./pathService");
const deviceStore = require("./deviceDataStoreService");
const PROJECT_DOCUMENTS = ["projekt.json", "leistungsbereiche.json", "projektSysteme.json", "dokumentenmatrix.json", "geraetelisten.json", "brandschutz.json", "anhaenge.json", "exportliste.json", "files.json"];
const stores = new Map(), requests = new AsyncLocalStorage();
const failure = (message, status = 500) => Object.assign(new Error(message), { status });
const conflict = () => failure("Dieses Projekt wurde inzwischen geändert oder in einem anderen Fenster gewechselt. Bitte die Seite neu laden und deine Änderungen erneut prüfen.", 409);
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function hasSchema(db) { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_storage'").get(); }
function enabled(db) {
  if(!hasSchema(db))return false;
  const state=db.prepare("SELECT version,active FROM project_storage WHERE id=1").get();
  if(state?.version!==1)throw failure("Diese Version der Projektdatenbank wird von dieser Anwendung nicht unterstützt.");
  return state.active===1;
}
function schema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS project_storage (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version=1), active INTEGER NOT NULL CHECK(active IN(0,1)));
    CREATE TABLE IF NOT EXISTS project_data_revisions (project_id TEXT NOT NULL, user_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0), PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id));
    CREATE TABLE IF NOT EXISTS project_documents (project_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL CHECK(name IN(${PROJECT_DOCUMENTS.map(n=>`'${n}'`).join(",")})), payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL CHECK(revision>0), source_json TEXT NOT NULL CHECK(json_valid(source_json)), source_sha256 TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(project_id,user_id,name), FOREIGN KEY(project_id,user_id) REFERENCES project_data_revisions(project_id,user_id));`);
}
function safeProjectDirectory(root, user, project) {
  if (sanitizeId(user, "") !== user || sanitizeId(project, "") !== project || !user || !project) throw failure("Ungültige Projektzuordnung.",403);
  return path.join(root,"storage/users",user,"projects",project,"data");
}
function safeFile(root, file) {
  const relative = path.relative(root,file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw failure("Unzulässiger Projektpfad.",403);
  let current=root;
  for (const part of relative.split(path.sep)) {
    current=path.join(current,part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw failure("Verknüpfungen sind in Projektdaten nicht erlaubt.",403); }
    catch(error) { if(error.code!=="ENOENT")throw error; }
  }
}
function capture(root, row) {
  const directory=safeProjectDirectory(root,row.user_id,row.id);
  return PROJECT_DOCUMENTS.map(name=>{
    const file=path.join(directory,name); safeFile(root,file);
    const source=fs.readFileSync(file,"utf8"), payload=JSON.stringify(JSON.parse(source));
    return {project:row.id,user:row.user_id,name,payload,source,sha:digest(source),file};
  });
}
function insertProject(db, documents) {
  const first=documents[0];
  db.prepare("INSERT INTO project_data_revisions(project_id,user_id,version) VALUES(?,?,1)").run(first.project,first.user);
  const insert=db.prepare("INSERT INTO project_documents(project_id,user_id,name,payload,revision,source_json,source_sha256,updated_at) VALUES(?,?,?,?,1,?,?,?)");
  for(const d of documents) {
    insert.run(d.project,d.user,d.name,d.payload,d.source,d.sha,new Date().toISOString());
    if(db.prepare("SELECT payload FROM project_documents WHERE project_id=? AND user_id=? AND name=?").get(d.project,d.user,d.name).payload!==d.payload)throw failure("Die Übernahmeprüfung ist fehlgeschlagen.");
  }
}
function migrateProjectData(rootDir, db, { newInstallation = false } = {}) {
  const root=path.resolve(rootDir), rows=db.prepare("SELECT id,user_id,status FROM projects ORDER BY user_id,id").all();
  const already=hasSchema(db), captured=[], skipped=[];
  if(already && !enabled(db))throw failure("Diese Wiederherstellungskopie arbeitet wieder mit JSON-Dateien. Eine erneute SQLite-Umstellung benötigt einen ausdrücklichen Abgleich mit ihren aktuellen Daten.",409);
  for(const row of rows) {
    if(already && db.prepare("SELECT 1 FROM project_data_revisions WHERE project_id=? AND user_id=?").get(row.id,row.user_id))continue;
    if(row.status==="geloescht" && !fs.existsSync(safeProjectDirectory(root,row.user_id,row.id))) { skipped.push({projectId:row.id,userId:row.user_id,reason:"Gelöschtes Projekt ohne Datenordner"});continue; }
    if(newInstallation && !fs.existsSync(safeProjectDirectory(root,row.user_id,row.id)))continue;
    captured.push(capture(root,row));
  }
  db.transaction(()=>{
    schema(db);
    if(JSON.stringify(rows)!==JSON.stringify(db.prepare("SELECT id,user_id,status FROM projects ORDER BY user_id,id").all()))throw conflict();
    for(const documents of captured) {
      for(const d of documents)if(digest(fs.readFileSync(d.file))!==d.sha)throw conflict();
      insertProject(db,documents);
    }
    const incomplete=db.prepare("SELECT r.project_id FROM project_data_revisions r LEFT JOIN project_documents d USING(project_id,user_id) GROUP BY r.project_id,r.user_id HAVING count(d.name)<>?").all(PROJECT_DOCUMENTS.length);
    if(incomplete.length)throw failure("Unvollständiger SQLite-Projektbestand; Aktivierung abgebrochen.");
    db.prepare("INSERT INTO project_storage(id,version,active) VALUES(1,1,1) ON CONFLICT(id) DO UPDATE SET active=1").run();
  })();
  configureProjectDataStore(root,db);
  return {version:1,active:true,projects:db.prepare("SELECT count(*) AS n FROM project_data_revisions").get().n,documents:db.prepare("SELECT count(*) AS n FROM project_documents").get().n,imported:captured.length,skipped};
}
function configureProjectDataStore(rootDir,db) {
  const root=path.resolve(rootDir); stores.delete(root);
  if(enabled(db)){deviceStore.enabled(db);stores.set(root,{root,db});}
  return stores.has(root);
}
function disconnectProjectDataStore(rootDir) { stores.delete(path.resolve(rootDir)); }
function enrollProject(rootDir,user,project) {
  const store=stores.get(path.resolve(rootDir));if(!store)return;
  if(store.db.prepare("SELECT 1 FROM project_data_revisions WHERE project_id=? AND user_id=?").get(project,user))return;
  store.db.transaction(()=>insertProject(store.db,capture(store.root,{id:project,user_id:user})))();
}
function resolve(filePath) {
  const file=path.resolve(filePath);
  for(const store of stores.values()) {
    const parts=path.relative(store.root,file).split(path.sep);
    if(parts.length!==7 || parts[0]!=="storage" || parts[1]!=="users" || parts[3]!=="projects" || parts[5]!=="data" || !PROJECT_DOCUMENTS.includes(parts[6]))continue;
    safeProjectDirectory(store.root,parts[2],parts[4]);safeFile(store.root,file);
    if(!store.db.prepare("SELECT 1 FROM project_data_revisions WHERE project_id=? AND user_id=?").get(parts[4],parts[2]))return null;
    return {store,user:parts[2],project:parts[4],name:parts[6]};
  }
  return null;
}
function projectSnapshot(store,user,project) {
  const context=requests.getStore(),key=JSON.stringify([store.root,user,project]);
  if(context?.snapshots.has(key))return context.snapshots.get(key);
  const snapshot=store.db.transaction(()=>{
    const row=store.db.prepare("SELECT version FROM project_data_revisions WHERE project_id=? AND user_id=?").get(project,user);
    if(!row)return null;
    const documents=store.db.prepare("SELECT name,payload FROM project_documents WHERE project_id=? AND user_id=?").all(project,user);
    if(documents.length!==PROJECT_DOCUMENTS.length)throw failure("SQLite-Projektdaten sind unvollständig. Bitte die Sicherung prüfen.");
    deviceStore.assertProjection(store.db,user,project,documents.find(d=>d.name==="geraetelisten.json").payload);
    return {store,user,project,version:row.version,documents:new Map(documents.map(d=>[d.name,d.payload])),pending:new Map()};
  })();
  if(snapshot)context?.snapshots.set(key,snapshot);return snapshot;
}
function readProjectDocument(filePath) {
  const scope=resolve(filePath);if(!scope)return {handled:false};
  const state=projectSnapshot(scope.store,scope.user,scope.project);
  return {handled:true,value:JSON.parse(state.pending.get(scope.name)??state.documents.get(scope.name))};
}
function initialProjectDocument(rootDir,user,project,name) {
  const store=stores.get(path.resolve(rootDir));if(!store)return null;
  const row=store.db.prepare("SELECT source_json FROM project_documents WHERE project_id=? AND user_id=? AND name=?").get(project,user,name);
  return row?JSON.parse(row.source_json):null;
}
function tokenFor(snapshot) { return snapshot?`${snapshot.project}:${snapshot.version}`:""; }
function projectDataRevision(rootDir,user,project) {
  const store=stores.get(path.resolve(rootDir));return store?tokenFor(projectSnapshot(store,user,project)):"";
}
function assertProjectRevision(rootDir,user,project,token) {
  const store=stores.get(path.resolve(rootDir));if(!store)return;
  const actual=store.db.prepare("SELECT version FROM project_data_revisions WHERE project_id=? AND user_id=?").get(project,user);
  if(token!==`${project}:${actual?.version}`)throw conflict();
}
function commit(context) {
  if(context.finished)return;
  const changed=[...context.snapshots.values()].filter(s=>s.pending.size || s.metadata);
  const databases=new Set(changed.map(s=>s.store.db));if(databases.size>1)throw failure("Eine Änderung darf nur eine Projektdatenbank betreffen.");
  if(context.commitActions?.length && !changed.length)throw failure("Eine Zusatzaktion benötigt eine Projektdatenänderung.");
  if(changed.length)changed[0].store.db.transaction(()=>{
    for(const state of changed)assertProjectRevision(state.store.root,state.user,state.project,tokenFor(state));
    for(const state of changed) {
      for(const [name,payload]of state.pending)state.store.db.prepare("UPDATE project_documents SET payload=?,revision=revision+1,updated_at=? WHERE project_id=? AND user_id=? AND name=?").run(payload,new Date().toISOString(),state.project,state.user,name);
      state.store.db.prepare("UPDATE project_data_revisions SET version=version+1 WHERE project_id=? AND user_id=?").run(state.project,state.user);
      if(state.metadata?.updatedAt)state.store.db.prepare("UPDATE projects SET updated_at=? WHERE id=? AND user_id=?").run(state.metadata.updatedAt,state.project,state.user);
      if(state.metadata?.status)state.store.db.prepare("UPDATE projects SET status=?,updated_at=? WHERE id=? AND user_id=?").run(state.metadata.status,state.metadata.updatedAt,state.project,state.user);
    }
    for(const action of context.commitActions || [])action();
  })();
  for(const state of changed) { for(const [name,payload]of state.pending)state.documents.set(name,payload);state.pending.clear();state.metadata=null;state.version++; }
  context.finished=true;
}
function writeProjectMetadata(rootDir,user,project,metadata) {
  const store=stores.get(path.resolve(rootDir));if(!store)return false;
  if(!store.db.prepare("SELECT 1 FROM project_data_revisions WHERE project_id=? AND user_id=?").get(project,user))return false;
  if(!requests.getStore())return requests.run({snapshots:new Map(),finished:false},()=>{writeProjectMetadata(rootDir,user,project,metadata);commit(requests.getStore());return true;});
  if(requests.getStore().finished)throw failure("Die Speichertransaktion ist bereits abgeschlossen.");
  const state=projectSnapshot(store,user,project);state.metadata={...state.metadata,...metadata};return true;
}
function writeProjectDocument(filePath,value) {
  const scope=resolve(filePath);if(!scope)return {handled:false};
  const existing=requests.getStore();
  if(!existing)return requests.run({snapshots:new Map(),finished:false},()=>{const result=writeProjectDocument(filePath,value);commit(requests.getStore());return result;});
  if(existing.finished)throw failure("Die Speichertransaktion ist bereits abgeschlossen.");
  const payload=JSON.stringify(value);if(typeof payload!=="string")throw failure("Ungültige Projektdaten.",400);
  const state=projectSnapshot(scope.store,scope.user,scope.project);
  if(payload!==(state.pending.get(scope.name)??state.documents.get(scope.name)))state.pending.set(scope.name,payload);
  return {handled:true,ok:true};
}
async function withProjectDataTransaction(work) {
  if(requests.getStore())return work();
  return requests.run({snapshots:new Map(),finished:false},async()=>{const result=await work();commit(requests.getStore());return result;});
}
function onProjectDataCommit(action) {
  const context=requests.getStore();
  if(!context || context.finished || typeof action!=="function")throw failure("Keine aktive Projektspeichertransaktion.");
  (context.commitActions ||= []).push(action);
}
function projectDataRequest(rootDir) {
  return (req,res,next)=>requests.run({snapshots:new Map(),finished:false},()=>{
    const context=requests.getStore();
    const finish=(success)=>{if(!success){context.snapshots.clear();context.finished=true;}else commit(context);};
    const failed=error=>{context.snapshots.clear();context.finished=true;next(error);return res;};
    const json=res.json,send=res.send,redirect=res.redirect;
    res.json=function(body){try {finish(res.statusCode<400 && body?.ok!==false);if(body && typeof body==="object" && req.user && res.locals.currentProjectId)body={...body,projectDataRevision:projectDataRevision(rootDir,req.user.id,res.locals.currentProjectId)};}catch(error){return failed(error);}return json.call(this,body);};
    res.send=function(body){try{finish(res.statusCode<400);}catch(error){return failed(error);}return send.call(this,body);};
    res.redirect=function(...args){try{const url=new URL(String(args.at(-1)),"http://local.invalid");finish(res.statusCode<400 && (!url.searchParams.has("error") || res.locals.projectDataCommitOnWarning===true));}catch(error){return failed(error);}return redirect.apply(this,args);};
    next();
  });
}
module.exports={PROJECT_DOCUMENTS,migrateProjectData,configureProjectDataStore,disconnectProjectDataStore,enrollProject,readProjectDocument,writeProjectDocument,writeProjectMetadata,initialProjectDocument,projectDataRevision,assertProjectRevision,withProjectDataTransaction,onProjectDataCommit,projectDataRequest};
