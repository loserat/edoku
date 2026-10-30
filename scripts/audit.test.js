const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const express = require("express");
const { createAuditService } = require("../services/auditService");

test("Protokoll speichert ausschließlich erlaubte Metadaten und verkettet parallele Einträge", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),"edoku-audit-"));
  const audit = createAuditService(root);
  await Promise.all(Array.from({length:15},(_,i)=>audit.append({event:"login",phase:"result",outcome:"success",actorId:"alice",requestId:"request_"+i,password:"PRIVATE_PASSWORD",token:"PRIVATE_SESSION",body:{secret:"PRIVATE_BODY"},cookies:"PRIVATE_COOKIE"})));
  const events=await audit.read();assert.equal(events.length,15);assert.equal(new Set(events.map(e=>e.hash)).size,15);
  const raw=await fs.readFile(path.join(root,"storage/audit/events.jsonl"),"utf8");assert.doesNotMatch(raw,/PRIVATE_|password|cookies|token|body/);
  assert.equal((await fs.stat(path.join(root,"storage/audit/events.jsonl"))).mode&0o777,0o600);
});

test("Beschädigte und abgebrochene Protokolle werden vor weiterem Schreiben erkannt",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-audit-"));const audit=createAuditService(root);
  await audit.append({event:"login",phase:"attempt",outcome:"attempt"});const file=path.join(root,"storage/audit/events.jsonl");
  const original=await fs.readFile(file,"utf8");await fs.writeFile(file,original.replace('"attempt"','"result"'));
  await assert.rejects(audit.read());await assert.rejects(audit.append({event:"login"}));
  await fs.writeFile(file,original.trimEnd());await assert.rejects(audit.read(),/unvollständig/);
});

test("Reine Lesezugriffe erzeugen keine Protokolldateien",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-audit-"));const audit=createAuditService(root);
  assert.deepEqual(await audit.read(),[]);assert.deepEqual(await fs.readdir(root),[]);
});

test("Echte HTTP-Aktionen protokollieren HTML-Fehler, Ziele und Erfolg ohne Zugangsdaten",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-audit-")),audit=createAuditService(root,{resolveTarget:req=>req.params.userId||null});
  const app=express();app.use(express.urlencoded({extended:false}));app.use(audit.middleware);
  app.post("/login",(req,res)=>res.redirect("/login?error=PRIVATE_PASSWORD"));
  app.post("/einstellungen/benutzer/:userId/rolle",(req,res)=>{res.locals.auditIdentity={actorId:"systemadmin",actorRole:"systemadmin"};res.json({ok:true});});
  const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  try{
    const base="http://127.0.0.1:"+server.address().port;
    await fetch(base+"/login",{method:"POST",redirect:"manual",body:new URLSearchParams({password:"PRIVATE_PASSWORD"})});
    await fetch(base+"/einstellungen/benutzer/alice/rolle",{method:"POST"});
    await audit.flush();const events=await audit.read();assert.equal(events.length,4);
    assert.equal(events[1].outcome,"failure");assert.equal(events[3].outcome,"success");assert.equal(events[3].targetId,"alice");assert.equal(events[3].actorId,"systemadmin");
    assert.doesNotMatch(JSON.stringify(events),/PRIVATE_PASSWORD/);
  }finally{await new Promise(r=>server.close(r));}
});

test("Nicht beschreibbares Protokoll verhindert die Aktion statt sie unprotokolliert auszuführen",async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"edoku-audit-"));await fs.mkdir(path.join(root,"storage"));await fs.writeFile(path.join(root,"storage/audit"),"blockiert");
  const audit=createAuditService(root);let executed=false;
  const req={method:"POST",path:"/login"};const res={locals:{},json(){},redirect(){}};
  const error=await new Promise(resolve=>audit.middleware(req,res,e=>{if(!e)executed=true;resolve(e);}));
  assert.equal(error.status,503);assert.equal(executed,false);
});
