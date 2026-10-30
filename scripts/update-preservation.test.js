const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const Database = require("better-sqlite3");
const { initDatabase } = require("../services/dbService");
const sourceRoot = path.resolve(__dirname, "..");
const runtimeAreas = ["data", "config", "storage", "output", "templates"];

async function copyProgram() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-update-preservation-"));
  for (const name of ["server.js", "package.json", "services", "src", "views", "public", "data", "config", "templates", "docs"]) {
    await fs.cp(path.join(sourceRoot, name), path.join(root, name), { recursive: true });
  }
  await fs.symlink(path.join(sourceRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  await fs.mkdir(path.join(root, "storage"), { recursive: true });
  return root;
}
async function hashRuntimeFiles(root) {
  const result = {};
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && !/^app\.db(?:-(?:wal|shm|journal))?$/.test(entry.name)) {
        result[path.relative(root, full)] = crypto.createHash("sha256").update(await fs.readFile(full)).digest("hex");
      }
    }
  }
  for (const area of runtimeAreas) {
    try { await walk(path.join(root, area)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return result;
}
function databaseRows(root) {
  const db = new Database(path.join(root, "storage/app.db"), { readonly: true });
  const result = {};
  for (const name of ["users", "projects", "sessions"]) {
    result[name] = db.prepare(`SELECT * FROM ${name}`).all().map((row) => JSON.stringify(row)).sort();
  }
  db.close();
  return result;
}
async function port() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const number = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return number;
}
async function boot(root) {
  const number = await port();
  const child = spawn(process.execPath, [path.join(root, "server.js")], { cwd: root, env: { ...process.env, PORT: String(number) }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (data) => { logs += data; });
  child.stderr.on("data", (data) => { logs += data; });
  const base = `http://127.0.0.1:${number}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(base + "/api/health")).status === 200) return { child, base }; } catch {}
    if (child.exitCode !== null) throw new Error(`Teststart fehlgeschlagen: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill("SIGTERM");
  throw new Error(`Teststart Timeout: ${logs}`);
}
async function stop(child) {
  if (child.exitCode === null) {
    const done = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await done;
  }
}
async function fixture(root) {
  const db = initDatabase(path.join(root, "storage"));
  const salt = "beibehalten-salt";
  const hash = crypto.scryptSync("eigenes-geaendertes-passwort", salt, 64).toString("hex");
  const stamp = "2025-01-02T03:04:05.000Z";
  const insert = db.prepare("INSERT INTO users (id,email,name,role,status,password_hash,password_salt,current_project_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  insert.run("user_demo", "admin", "Eigener Kontoname", "viewer", "active", hash, salt, "keep_project", stamp, stamp);
  insert.run("user_berg", "berg", "Gesperrtes Konto", "user", "disabled", hash, salt, null, stamp, stamp);
  insert.run("legacy", "nick", "Bestehende Kennung", "user", "active", hash, salt, null, stamp, stamp);
  db.prepare("INSERT INTO projects (id,user_id,status,created_at,updated_at) VALUES (?,?,?,?,?)").run("keep_project", "user_demo", "archiviert", stamp, stamp);
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,?)").run(token, "user_demo", "2099-01-01T00:00:00.000Z", stamp);
  db.close();
  const projectDir = path.join(root, "storage/users/user_demo/projects/keep_project/data");
  await fs.mkdir(projectDir, { recursive: true });
  for (const name of ["projekt.json", "leistungsbereiche.json", "projektSysteme.json", "dokumentenmatrix.json", "geraetelisten.json", "brandschutz.json", "anhaenge.json", "exportliste.json", "files.json"]) await fs.copyFile(path.join(root, "data", name), path.join(projectDir, name));
  await fs.writeFile(path.join(root, "storage/projects.json"), JSON.stringify([{ id: "keep_project", userId: "user_demo", status: "aktiv", erstelltAm: stamp, geaendertAm: "2030-01-01T00:00:00.000Z" }]));
  return token;
}

test("Bestehende Konten, Passwörter, Sperren, Sessions und Projekte bleiben beim Start erhalten", async () => {
  const root = await copyProgram();
  const token = await fixture(root);
  const beforeRows = databaseRows(root);
  const beforeFiles = await hashRuntimeFiles(root);
  const app = await boot(root);
  try {
    for (const route of ["/dashboard", "/projekte", "/projekt", "/leistungsbereiche", "/systemauswahl", "/dokumente", "/geraetelisten", "/brandschutz", "/anhaenge", "/export", "/einstellungen", "/projektarchiv"]) {
      const response = await fetch(app.base + route, { redirect: "manual", headers: { Cookie: `${process.env.SESSION_COOKIE_NAME || "dm_session"}=${token}` } });
      assert.equal(response.status, 200, route);
      await response.text();
    }
    assert.deepEqual(databaseRows(root), beforeRows);
    assert.deepEqual(await hashRuntimeFiles(root), beforeFiles);
  } finally { await stop(app.child); }
  const restarted = await boot(root);
  try { assert.deepEqual(databaseRows(root), beforeRows); } finally { await stop(restarted.child); }
});

test("Eine bereits vorhandene leere Datenbank wird nicht automatisch mit Testkonten befüllt", async () => {
  const root = await copyProgram();
  initDatabase(path.join(root, "storage")).close();
  const app = await boot(root);
  try { assert.equal(databaseRows(root).users.length, 0); } finally { await stop(app.child); }
});

test("Eine echte Erstinstallation legt weiterhin die vorgesehenen Startkonten an", async () => {
  const root = await copyProgram();
  const app = await boot(root);
  try {
    const rows = databaseRows(root).users.map((row) => JSON.parse(row));
    assert.equal(rows.length, 3);
    assert.ok(rows.some((row) => row.email === "admin" && row.role === "systemadmin"));
  } finally { await stop(app.child); }
});
