const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), net = require("node:net"), crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const Database = require("better-sqlite3");
const dbService = require("../services/dbService");
const { validateNewPassword } = require("../services/passwordPolicyService");
const { mergeSystemSettings } = require("../services/settingsService");
const source = path.resolve(__dirname, "..");
function seed(id, role, password = "alt") {
  const salt = crypto.randomBytes(16).toString("hex"), stamp = "2026-01-01T00:00:00.000Z";
  dbService.createUser({ id, email: id, name: id, role, status: "active", passwordHash: crypto.scryptSync(password, salt, 64).toString("hex"), passwordSalt: salt, currentProjectId: null, createdAt: stamp, updatedAt: stamp });
}

test("Neue Passwörter werden einheitlich geprüft und unverändert übernommen", () => {
  for (const value of ["", "x", "12345678", "            ", "x".repeat(257)]) assert.throws(() => validateNewPassword(value), { status: 400 });
  for (const value of ["Zwölf Zeichen!", " Eine lange Passphrase ", "x".repeat(256)]) assert.equal(validateNewPassword(value), value);
});

test("Kontenänderungen melden fehlende Ziele und erhalten mindestens einen aktiven Systemadmin", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-users-db-"));
  const db = dbService.initDatabase(root);
  try {
    seed("lead", "systemadmin"); seed("second", "systemadmin");
    for (const action of [() => dbService.updateUserRole("missing", "user"), () => dbService.updateUserStatus("missing", "disabled"), () => dbService.updateUserPassword("missing", "hash", "salt")]) assert.throws(action, { status: 404 });
    assert.throws(() => dbService.updateUserRole("lead", "typo"), { status: 400 });
    assert.throws(() => dbService.updateUserStatus("lead", "typo"), { status: 400 });
    dbService.updateUserStatus("second", "disabled");
    assert.throws(() => dbService.updateUserRole("lead", "user"), { status: 409 });
    assert.throws(() => dbService.updateUserStatus("lead", "disabled"), { status: 409 });
    assert.equal(dbService.getUserById("lead").status, "active");
  } finally { db.close(); await fs.rm(root, { recursive: true, force: true }); }
});

test("Selbstregistrierung bleibt bei alten oder uneindeutigen Einstellungen geschlossen", () => {
  for (const value of [{}, { selfRegistrationEnabled: false }, { selfRegistrationEnabled: "true" }, { selfRegistrationEnabled: "false" }]) {
    const before = JSON.stringify(value); assert.equal(mergeSystemSettings(value).selfRegistrationEnabled, false); assert.equal(JSON.stringify(value), before);
  }
  assert.equal(mergeSystemSettings({ selfRegistrationEnabled: true }).selfRegistrationEnabled, true);
});

class Client {
  constructor(base) { this.base = base; this.cookies = new Map(); this.csrf = ""; }
  async request(route, fields) {
    const response = await fetch(this.base + route, { method: fields ? "POST" : "GET", redirect: "manual", headers: { Cookie: [...this.cookies].map(([k,v]) => `${k}=${v}`).join("; "), ...(fields ? { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: fields ? new URLSearchParams({ _csrf: this.csrf, ...fields }) : undefined });
    for (const raw of response.headers.getSetCookie()) { const pair = raw.split(";")[0], i = pair.indexOf("="); this.cookies.set(pair.slice(0,i), pair.slice(i+1)); }
    const html = await response.text(), token = html.match(/name="csrf-token" content="([a-f0-9]+)"/); if (token) this.csrf = token[1];
    let json; try { json = JSON.parse(html); } catch {}
    return { status: response.status, location: response.headers.get("location"), html, json };
  }
  async login(email, password) { await this.request("/login"); assert.equal((await this.request("/login", { email, password })).location, "/dashboard"); assert.equal((await this.request("/dashboard")).status, 200); }
}

test("Benutzerverwaltung im echten Server mit isolierten Testkonten", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-users-http-"));
  for (const name of ["server.js", "package.json", "services", "src", "views", "public", "data", "config", "templates", "docs"]) await fs.cp(path.join(source,name), path.join(root,name), { recursive: true });
  await fs.symlink(path.join(source,"node_modules"), path.join(root,"node_modules"), "dir");
  const seedDb = dbService.initDatabase(path.join(root,"storage"));
  seed("lead", "systemadmin"); seed("member", "user"); seed("reader", "viewer"); seed("legacy", "admin");
  const initial = seedDb.prepare("SELECT * FROM users ORDER BY id").all(); seedDb.close();
  const settingsFile = path.join(root,"config/systemEinstellungen.json");
  const originalSettings = JSON.parse(await fs.readFile(settingsFile,"utf8")); delete originalSettings.selfRegistrationEnabled;
  await fs.writeFile(settingsFile, JSON.stringify(originalSettings));
  const socket = net.createServer(); await new Promise(r => socket.listen(0,"127.0.0.1",r)); const port = socket.address().port; await new Promise(r => socket.close(r));
  const child = spawn(process.execPath, [path.join(root,"server.js")], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ["ignore","pipe","pipe"] });
  let logs = ""; child.stdout.on("data", d => logs += d); child.stderr.on("data", d => logs += d);
  const base = `http://127.0.0.1:${port}`, admin = new Client(base), member = new Client(base), reader = new Client(base), legacy = new Client(base), guest = new Client(base);
  let db, id, account;
  try {
    let ready = false; for (let i=0; i<120; i++) { try { if ((await fetch(base+"/api/health")).ok) { ready=true; break; } } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r,50)); } assert.ok(ready,logs);
    db = new Database(path.join(root,"storage/app.db"), { readonly: true });
    await admin.login("lead","alt"); await member.login("member","alt"); await reader.login("reader","alt"); await legacy.login("legacy","alt"); await guest.request("/login");
    await t.test("Alte Passwörter, Rollen und Konfiguration werden beim Start nicht geändert", async () => {
      const rows = db.prepare("SELECT * FROM users ORDER BY id").all();
      for (const before of initial) { const after = rows.find(row => row.id===before.id); for (const key of ["password_hash","password_salt","role","status","created_at"]) assert.equal(after[key],before[key]); }
      assert.deepEqual(JSON.parse(await fs.readFile(settingsFile,"utf8")),originalSettings);
    });
    await t.test("Geschlossene Registrierung gilt auch für direkte POST-Anfragen", async () => {
      const page = await guest.request("/register"); assert.match(page.html,/Registrierung geschlossen/); assert.doesNotMatch(page.html,/<form action="\/register"/);
      const attempt = await guest.request("/register", { email:"closed@example.invalid", password:"Synthetisches Passwort" }); assert.equal(attempt.status,403);
      assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n,4);
      assert.doesNotMatch((await guest.request("/login")).html,/href="\/register"/);
    });
    await t.test("Nur Systemadmins verwalten Konten und Registrierung; Viewer darf nicht schreiben", async () => {
      for (const client of [member,reader,legacy]) {
        assert.equal((await client.request("/einstellungen/benutzer", { email:"attack", password:"Synthetisches Passwort", role:"systemadmin" })).status,403);
        assert.equal((await client.request("/einstellungen/registrierung", { selfRegistrationEnabled:"on" })).status,403);
      }
      assert.equal((await reader.request("/projekt", { projektname:"Unzulässig" })).status,403);
    });
    await t.test("Kontenanlage weist schwache Passwörter, doppelte Kennungen und ungültige Rollen ab", async () => {
      for (const password of ["x","12345678","            ","x".repeat(257)]) assert.equal((await admin.request("/einstellungen/benutzer", { email:"weak",password,role:"user" })).status,400);
      assert.equal((await admin.request("/einstellungen/benutzer", { email:"invalid",password:"Synthetisches Passwort",role:"typo" })).status,400);
      assert.equal((await admin.request("/einstellungen/benutzer", { email:"review",name:"Prüfkonto",password:"Synthetisches Passwort",role:"user" })).json.ok,true);
      id = db.prepare("SELECT id FROM users WHERE email='review'").get().id;
      assert.equal((await admin.request("/einstellungen/benutzer", { email:"REVIEW",password:"Synthetisches Passwort",role:"user" })).json.ok,false);
      account = new Client(base); await account.login("review","Synthetisches Passwort");
    });
    await t.test("Unbekannte Konten und ungültige Statuswerte melden echte Fehler", async () => {
      for (const [action,fields] of [["rolle",{role:"user"}],["status",{status:"disabled"}],["passwort",{password:"Neues synthetisches Passwort"}]]) assert.equal((await admin.request("/einstellungen/benutzer/missing/"+action,fields)).status,404);
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/status`,{status:"typo"})).status,400);
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/rolle`,{role:"typo"})).status,400);
      assert.equal((await admin.request("/einstellungen/benutzer/lead/status",{status:"disabled"})).json.ok,false);
      assert.equal((await admin.request("/einstellungen/benutzer/lead/rolle",{role:"user"})).json.ok,false);
    });
    await t.test("Abgelehnter Reset erhält Passwort und Sitzung; gültiger Reset entzieht die Sitzung", async () => {
      const before = db.prepare("SELECT * FROM users WHERE id=?").get(id);
      for (const password of ["    ","            ","kurz","x".repeat(257)]) assert.equal((await admin.request(`/einstellungen/benutzer/${id}/passwort`,{password})).status,400);
      assert.deepEqual(db.prepare("SELECT * FROM users WHERE id=?").get(id),before);
      assert.equal((await account.request("/dashboard")).status,200);
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/passwort`,{password:"Neues synthetisches Passwort"})).json.ok,true);
      assert.equal((await account.request("/dashboard")).status,302); await account.login("review","Neues synthetisches Passwort");
      const old = new Client(base); await old.request("/login"); assert.match((await old.request("/login",{email:"review",password:"Synthetisches Passwort"})).location,/error=/);
    });
    await t.test("Sperren, Reaktivieren und Rollenwechsel wirken auf bestehende Anmeldungen", async () => {
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/rolle`,{role:"viewer"})).json.ok,true);
      assert.equal((await account.request("/projekt",{projektname:"Unzulässig"})).status,403);
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/status`,{status:"disabled"})).json.ok,true);
      assert.equal((await account.request("/dashboard")).status,302);
      const blocked = new Client(base); await blocked.request("/login"); assert.match((await blocked.request("/login",{email:"review",password:"Neues synthetisches Passwort"})).location,/error=/);
      assert.equal((await admin.request(`/einstellungen/benutzer/${id}/status`,{status:"active"})).json.ok,true); await account.login("review","Neues synthetisches Passwort");
    });
    await t.test("Freigabe und Schließen der Registrierung funktionieren ohne andere Einstellungen zu ändern", async () => {
      assert.equal((await admin.request("/einstellungen/registrierung",{selfRegistrationEnabled:"on"})).json.ok,true);
      const saved = JSON.parse(await fs.readFile(settingsFile,"utf8")); assert.deepEqual(saved,{...originalSettings,selfRegistrationEnabled:true});
      const fresh = new Client(base); const form = await fresh.request("/register"); assert.match(form.html,/minlength="12"/);
      assert.match((await fresh.request("/register",{email:"weak-reg@example.invalid",password:"12345678"})).location,/error=/);
      assert.equal((await fresh.request("/register",{email:"approved@example.invalid",password:"Synthetisches Passwort",role:"systemadmin"})).location,"/dashboard");
      assert.equal(db.prepare("SELECT role FROM users WHERE email='approved@example.invalid'").get().role,"user");
      assert.equal((await admin.request("/einstellungen/registrierung",{})).json.ok,true);
      assert.equal((await new Client(base).request("/register")).html.includes('action="/register"'),false);
    });
    await t.test("Rollen werden verständlich angezeigt; alte Admin-Konten behalten ihre Rechte", async () => {
      const page = await admin.request("/einstellungen"); assert.match(page.html,/Benutzer \(bisher Admin\)/); assert.match(page.html,/Nur lesen/);
      const form = page.html.match(/<form action="\/einstellungen\/benutzer"[\s\S]*?<\/form>/)[0]; assert.doesNotMatch(form,/<option value="admin"/);
      assert.equal(db.prepare("SELECT role FROM users WHERE id='legacy'").get().role,"admin");
      const events = await fs.readFile(path.join(root,"storage/audit/events.jsonl"),"utf8"); assert.doesNotMatch(events,/Synthetisches Passwort|Neues synthetisches Passwort/);
      const failures = events.trim().split("\n").map(JSON.parse).filter(e=>e.event==="account.status"&&e.outcome==="failure"); assert.ok(failures.length>0);
    });
  } finally {
    if (db) db.close();
    if (child.exitCode===null) { const done = new Promise(r=>child.once("exit",r)); child.kill(); await done; }
    await fs.rm(root,{recursive:true,force:true});
  }
});
