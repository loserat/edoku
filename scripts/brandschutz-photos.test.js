const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const net = require("node:net"), { spawn } = require("node:child_process");
const Database = require("better-sqlite3"), ejs = require("ejs");
const { inspectBrandschutzPhotos } = require("../services/brandschutzPhotoService");
const { bindProjectScope } = require("../services/projectService");
const { buildExportliste, prepareFinalExport } = require("../services/exportService");
const { generateInhaltsverzeichnis, generateDeckblaetter, generateBrandschutzPdf } = require("../services/pdfService");
const { buildDashboardStats } = require("../services/dashboardService");
const { buildExportPreview } = require("../services/exportPreviewService");
const { summarizeExportEntries } = require("../services/documentationPlanService");
const source = path.resolve(__dirname, "..");
const areas = { aktiv: ["Brandschutzabschottungen"] };
const matrix = [
  { id: "fire", kapitel: "13", titel: "Brandschutz", dokumenttyp: "Kapitel", aktiv: true, export: true },
  { id: "photos", kapitel: "13.5", titel: "Bilddokumentation", dokumenttyp: "Bilddokumentation", aktiv: true, export: true }
];
const fire = [{ id: "bs_1", aktiv: true, geschoss: "EG", raum: "Technik", bauteil: "Wand", foto_vorher: "anhaenge/missing.png", foto_nachher: "" }];
const settings = { lizenz: { brandingAktiv: false } };
async function png(target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Vorhandene neutrale Grafik nur als gültige PNG-Datei im Dateiverfügbarkeitstest.
  await fs.copyFile(path.join(source, "public/img/icons/edoku-icon-192.png"), target);
}

test("Fotoprüfung ignoriert leere Felder und inaktive Schottungen, erhält Quelldaten", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-photo-"));
  await png(path.join(root, "available.png"));
  const rows = [...fire, { id: "off", aktiv: false, foto_vorher: "off.png" }, { id: "ok", foto_vorher: "available.png" }];
  const before = JSON.stringify(rows), warnings = await inspectBrandschutzPhotos(root, {}, rows);
  assert.equal(warnings.length, 1); assert.equal(warnings[0].id, "bs_1"); assert.equal(warnings[0].field, "foto_vorher");
  assert.equal(warnings[0].code, "photo_missing"); assert.equal(JSON.stringify(rows), before);
  const duplicated = await inspectBrandschutzPhotos(root, {}, [{ ...fire[0], foto_nachher: fire[0].foto_vorher }]);
  assert.equal(duplicated.length, 2); // Zwei betroffene Fotofelder, kein zweiter PDF-Dateizähler.
});

test("Fremde Pfade und externe Symlinks werden als unzugreifbar gemeldet, niemals gelesen", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-photo-"));
  const owner = path.join(root, "storage/users/alice/projects/project"); await fs.mkdir(owner, { recursive: true });
  await png(path.join(root, "private.png")); await fs.symlink(path.join(root, "private.png"), path.join(owner, "outside.png"));
  const project = bindProjectScope({}, "alice", "project");
  const warnings = await inspectBrandschutzPhotos(root, project, [{ id: "x", foto_vorher: "private.png", foto_nachher: "storage/users/alice/projects/project/outside.png" }]);
  assert.equal(warnings.length, 2); assert.ok(warnings.every(w => w.code === "photo_unavailable"));
});

test("Vollständige PDF-Liste bleibt bei fehlendem Foto unvollständig, ZIP enthält Warnung, Reparatur wird frisch geprüft", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-photo-"));
  const project = { projektname: "Foto-Prüfung", projektnummer: "TEST" }, exportFile = path.join(root, "exportliste.json");
  const before = JSON.stringify(fire);
  async function generate() {
    await generateInhaltsverzeichnis(root, project, matrix, settings, [], [], areas);
    await generateDeckblaetter(root, project, matrix, settings, [], [], areas);
    await generateBrandschutzPdf(root, project, fire, settings, matrix, [], areas);
    return buildExportliste(root, project, matrix, exportFile, [], [], [], areas, { brandschutz: fire });
  }
  const entries = await generate(), summary = summarizeExportEntries(entries);
  assert.equal(summary.missing, 0); assert.equal(summary.photoWarnings, 1); assert.equal(summary.complete, false);
  const stats = buildDashboardStats({ projekt: project, leistungsbereiche: areas, matrix, geraetelisten: [], brandschutz: fire, exportliste: entries, projektSysteme: [] });
  assert.ok(stats.completion.percent < 100); assert.notEqual(stats.workflow.at(-1).status, "fertig");
  assert.equal(stats.brandschutz.unvollstaendig, 1); assert.notEqual(stats.workflow.find(step => step.nr === 6).status, "fertig");
  assert.equal(buildExportPreview({ exportliste: entries }).photoWarnings.length, 1);
  const result = await prepareFinalExport(root, project, matrix, exportFile, { systemSettings: settings, brandschutz: fire, leistungsbereiche: areas });
  assert.equal(result.missingFiles.length, 0); assert.equal(result.photoWarnings.length, 1); assert.equal(result.summary.complete, false);
  assert.match(await fs.readFile(result.orderFile, "utf8"), /BRANDSCHUTZFOTOS:[\s\S]*bs_1.*Foto 1 fehlt/);
  assert.ok((await fs.readFile(result.zipPath)).includes(Buffer.from("Foto 1 fehlt")));
  const saved = await fs.readFile(exportFile);
  await png(path.join(root, "anhaenge/missing.png"));
  const fresh = await buildExportliste(root, project, matrix, exportFile, [], [], [], areas, { persist: false, brandschutz: fire });
  assert.equal(summarizeExportEntries(fresh).photoWarnings, 0); assert.deepEqual(await fs.readFile(exportFile), saved);
  const repaired = await generate(); assert.equal(summarizeExportEntries(repaired).complete, true);
  await fs.unlink(path.join(root, "anhaenge/missing.png"));
  const disappeared = await prepareFinalExport(root, project, matrix, exportFile, { systemSettings: settings, brandschutz: fire, leistungsbereiche: areas });
  assert.equal(disappeared.photoWarnings.length, 1); assert.equal(disappeared.summary.complete, false);
  await png(path.join(root, "anhaenge/missing.png"));
  const restored = await prepareFinalExport(root, project, matrix, exportFile, { systemSettings: settings, brandschutz: fire, leistungsbereiche: areas });
  assert.equal(restored.photoWarnings.length, 0); assert.equal(restored.summary.complete, true);
  assert.equal(JSON.stringify(fire), before);
});

test("Fotoverweise außerhalb gewählter Brandschutzbereiche zählen nicht als Exportfehler", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-photo-"));
  const entries = await buildExportliste(root, {}, [], path.join(root, "unused.json"), [], [], [], { aktiv: [] }, { persist: false, brandschutz: fire });
  assert.equal(summarizeExportEntries(entries).photoWarnings, 0);
});

test("Warnansicht maskiert freie Texte", async () => {
  const html = await ejs.renderFile(path.join(source, "views/partials/photoWarnings.ejs"), { photoWarnings: [{ message: '<img src=x onerror="alert(1)">' }] });
  assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/);
});

test("HTTP: Warnung auf drei Seiten und beim finalen Export; nach Dateizuordnung verschwindet sie", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-photo-http-"));
  for (const name of ["server.js", "package.json", "services", "src", "views", "public", "data", "config", "templates", "docs"]) await fs.cp(path.join(source, name), path.join(root, name), { recursive: true });
  await fs.symlink(path.join(source, "node_modules"), path.join(root, "node_modules"), "dir");
  await fs.writeFile(path.join(root, "data/projekt.json"), JSON.stringify({ projektname: "Foto-Prüfung", projektnummer: "TEST", logoPfad: "" }));
  for (const [name, value] of Object.entries({ projekt: { projektname: "Foto-Prüfung", projektnummer: "TEST", logoPfad: "" }, leistungsbereiche: areas, dokumentenmatrix: matrix, brandschutz: fire, geraetelisten: [], anhaenge: [], projektSysteme: [], exportliste: [] })) await fs.writeFile(path.join(root, "data", name + ".json"), JSON.stringify(value));
  const socket = net.createServer(); await new Promise(r => socket.listen(0, "127.0.0.1", r)); const port = socket.address().port; await new Promise(r => socket.close(r));
  const child = spawn(process.execPath, [path.join(root, "server.js")], { cwd: root, env: { ...process.env, NODE_ENV: "test", PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "", token = "", revision = "", db; child.stdout.on("data", d => logs += d); child.stderr.on("data", d => logs += d);
  const cookies = new Map(), base = "http://127.0.0.1:" + port;
  async function request(url, options = {}) {
    const response = await fetch(base + url, { redirect: "manual", ...options, headers: { Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "), ...options.headers } });
    for (const line of response.headers.getSetCookie()) { const s = line.split(";")[0], i = s.indexOf("="); cookies.set(s.slice(0, i), s.slice(i + 1)); }
    return response;
  }
  async function page(url) { const response = await request(url); assert.equal(response.status, 200, url); const html = await response.text(); token = html.match(/name="csrf-token" content="([a-f0-9]+)"/)?.[1] || token; revision = html.match(/name="edoku-project-revision" content="([^"]*)"/)?.[1] || ""; return html; }
  async function post(url, fields = {}) { if (revision) await page("/dashboard"); const response = await request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ _csrf: token, _projectRevision: revision, ...fields }) }); await response.arrayBuffer(); assert.equal(response.status, 302); return response.headers.get("location"); }
  try {
    let ready = false; for (let i = 0; i < 120; i++) { try { if ((await request("/api/health")).status === 200) { ready = true; break; } } catch {} if (child.exitCode !== null) throw Error(logs); await new Promise(r => setTimeout(r, 50)); } assert.ok(ready, logs);
    await page("/login"); await post("/login", { email: "admin", password: "admin" }); await page("/dashboard");
    db = new Database(path.join(root, "storage/app.db"), { readonly: true }); const projectId = db.prepare("SELECT current_project_id FROM users WHERE id='user_demo'").get().current_project_id;
    const owner = path.join(root, "storage/users/user_demo/projects", projectId), data = path.join(owner, "data");
    for (const url of ["/dashboard", "/brandschutz", "/export"]) assert.match(await page(url), /1 Brandschutz-Fotoverweis/);
    const location = new URL(await post("/export/final"), base); assert.match(location.searchParams.get("error"), /1 Brandschutz-Fotoverweis/); assert.equal(location.searchParams.has("success"), false);
    const stored = JSON.parse(db.prepare("SELECT payload FROM project_documents WHERE user_id=? AND project_id=? AND name=?").get("user_demo",projectId,"exportliste.json").payload); assert.equal(summarizeExportEntries(stored).missing, 0);
    await png(path.join(owner, "anhaenge/missing.png"));
    for (const url of ["/dashboard", "/brandschutz", "/export"]) assert.doesNotMatch(await page(url), /1 Brandschutz-Fotoverweis/);
    const repaired = new URL(await post("/export/final"), base); assert.equal(repaired.searchParams.has("error"), false); assert.match(repaired.searchParams.get("success"), /Export erstellt/);
    assert.deepEqual(JSON.parse(db.prepare("SELECT payload FROM project_documents WHERE user_id=? AND project_id=? AND name=?").get("user_demo",projectId,"brandschutz.json").payload), fire);
  } finally { if (db) db.close(); if (child.exitCode === null) { const done = new Promise(r => child.once("exit", r)); child.kill("SIGTERM"); await done; } }
});
