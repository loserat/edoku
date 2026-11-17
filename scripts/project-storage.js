const fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const {initDatabase}=require("../services/dbService");
const store=require("../services/projectDataStoreService");
const devices=require("../services/deviceDataStoreService");
const args=process.argv.slice(2),command=args.shift();
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
let db;
try {
  if(command==="migrate"||command==="status"||command==="devices-migrate") {
    const root=path.resolve(option("--root")||path.join(__dirname,".."));
    if(!fs.existsSync(path.join(root,"storage/app.db")))throw new Error("Vorhandene Installationsdatenbank erforderlich.");
    db=initDatabase(path.join(root,"storage"));
    if(command==="migrate")console.log(JSON.stringify(store.migrateProjectData(root,db)));
    else if(command==="devices-migrate")console.log(JSON.stringify(devices.migrateDeviceData(db)));
    else {const active=store.configureProjectDataStore(root,db);console.log(JSON.stringify({active,projects:active?db.prepare("SELECT count(*) AS n FROM project_data_revisions").get().n:0,documents:active?db.prepare("SELECT count(*) AS n FROM project_documents").get().n:0,devices:active?devices.status(db):{active:false}}));}
  } else if(command==="rollback-copy") {
    const backup=option("--backup"),destination=option("--destination");if(!backup||!destination)throw new Error("--backup und ein neues --destination sind erforderlich.");
    const target=path.resolve(destination);if(fs.existsSync(target))throw new Error("Das Wiederherstellungsziel muss neu sein.");
    execFileSync("python3",[path.join(__dirname,"installation_backup.py"),"restore","--backup",path.resolve(backup),"--target",target],{stdio:"pipe"});
    db=initDatabase(path.join(target,"storage"));
    if(!store.configureProjectDataStore(target,db))throw new Error("Die Sicherung enthält keinen aktivierten SQLite-Projektbestand.");
    let count=0;
    for(const row of db.prepare("SELECT project_id,user_id,name,payload FROM project_documents ORDER BY user_id,project_id,name").all()) {
      if(row.name==="geraetelisten.json")devices.assertProjection(db,row.user_id,row.project_id,row.payload);
      const directory=path.join(target,"storage/users",row.user_id,"projects",row.project_id,"data");
      const file=path.join(directory,row.name),temporary=file+".rollback-tmp";
      fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(temporary,JSON.stringify(JSON.parse(row.payload),null,2)+"\n",{flag:"wx",mode:0o600});fs.renameSync(temporary,file);
      if(JSON.stringify(JSON.parse(fs.readFileSync(file,"utf8")))!==row.payload)throw new Error("Rückwegprüfung fehlgeschlagen.");count++;
    }
    db.prepare("UPDATE project_storage SET active=0 WHERE id=1").run();
    const compose=path.join(target,"compose.restore.json");
    if(option("--legacy-image")&&fs.existsSync(compose)){const data=JSON.parse(fs.readFileSync(compose));data.services.edoku.image=option("--legacy-image");fs.writeFileSync(compose,JSON.stringify(data,null,2)+"\n");}
    fs.writeFileSync(path.join(target,"project-storage-rollback.json"),JSON.stringify({verified:true,sourceBackup:path.resolve(backup),documents:count,sqliteProjectStoreActive:false},null,2)+"\n");
    console.log(JSON.stringify({verified:true,target,documents:count,originalUnchanged:true}));
  } else throw new Error("Aufruf: project-storage.js migrate|devices-migrate|status [--root PFAD] oder rollback-copy --backup SICHERUNG --destination NEUER_ORDNER [--legacy-image ABBILD]");
} catch(error) {console.error("Projektspeicher: "+error.message);process.exitCode=1;} finally {if(db)db.close();}
