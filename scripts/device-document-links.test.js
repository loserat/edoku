const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const ejs = require("ejs");
const { PDFDocument } = require("pdf-lib");
const database = require("../services/dbService");
const store = require("../services/projectDataStoreService");
const { migrateDeviceData } = require("../services/deviceDataStoreService");
const { readJson, writeJson } = require("../services/jsonService");
const { createIntegrationService } = require("../services/integrationService");
const { createDocumentAssistantService } = require("../services/documentAssistantService");
const { createDocumentationReadinessService } = require("../services/documentationReadinessService");
const { createDocumentAssistantRouter } = require("../src/routes/documentAssistant.routes");
const { createIntegrationRouter } = require("../src/routes/integration.routes");
const { createApiTokenService } = require("../services/apiTokenService");
const { dataFilesForProject } = require("../services/projectArchiveService");
const { normalizeGeraetelisten, normalizePostedGeraetelisten, deviceListFieldsForLeistungsbereich } = require("../services/geraetelistenService");
const { normalizeAttachments } = require("../services/attachmentService");
const { generateGeraetelisten } = require("../services/pdfService");
const { buildDocumentationPlan } = require("../services/documentationPlanService");
const { jsonForHtml } = require("../services/htmlDataService");

const area = "Elektroinstallation / DIN VDE 0100";
async function fixture(deviceArea = area) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-device-documents-"));
  for (const name of ["config", "data", "templates"]) await fs.cp(path.join(__dirname, "..", name), path.join(root, name), { recursive: true });
  const db = database.initDatabase(path.join(root, "storage")), stamp = new Date().toISOString();
  database.createUser({ id: "tester", email: "tester", name: "Test", role: "systemadmin", status: "active", passwordHash: "synthetic", passwordSalt: "synthetic", currentProjectId: "example", createdAt: stamp, updatedAt: stamp });
  database.upsertProject({ id: "example", userId: "tester" });
  const directory = path.join(root, "storage/users/tester/projects/example/data");
  await fs.mkdir(directory, { recursive: true });
  for (const name of store.PROJECT_DOCUMENTS) {
    const value = name === "projekt.json" ? { projektname: "Künstliches Verknüpfungsprojekt", projektnummer: "LINK-TEST", auftraggeber: "Test", liegenschaft: "Test", baumassnahme: "Test" }
      : name === "geraetelisten.json" ? [{ id: "devices", leistungsbereich: deviceArea, titel: "Elektro", kapitel: "6.4", aktiv: true, export: true, positionen: [{ pos: 1, hersteller: "Testhersteller", typ: "Test 100", system: "Testsystem", custom: "behalten" }] }, { id: "inactive", leistungsbereich: "Datentechnik / Kommunikationsverkabelung", aktiv: false, positionen: [] }]
      : name === "leistungsbereiche.json" ? { aktiv: [deviceArea], optionen: [deviceArea] } : [];
    await fs.writeFile(path.join(directory, name), JSON.stringify(value));
  }
  store.migrateProjectData(root, db); migrateDeviceData(db);
  const files = dataFilesForProject(root, "tester", "example");
  const assistant = createDocumentAssistantService(root, { db, verificationService:require('./helpers/productVerificationFixture').legacyVerification });
  const job = assistant.create("tester", "example", { instruction: "Geräte und passende Unterlagen für künstliche Testdaten verknüpfen.", requirements: [{ id: "sheet", title: "Produktdaten", category: "Datenblätter", device: { listId: "devices", position: 1, manufacturer: "Testhersteller", model: "Test 100" } }] });
  const reference = { listId: "devices", position: 1, manufacturer: "Testhersteller", model: "Test 100", revision: "" };
  const revision = () => store.projectDataRevision(root, "tester", "example");
  const propose = async (extra = {}) => {
    const document = await PDFDocument.create(); document.addPage().drawText(crypto.randomUUID());
    const result=await assistant.propose("tester", job.id, { title: "Testunterlage", category: "Datenblätter", sourceLabel: "Künstliche Quelle", reason: "Passende Geräteposition", ...extra }, { buffer: Buffer.from(await document.save()), originalName: "Test.pdf" });
    // This older suite seeds pre-3.0 proposals; the real gate has its own suite.
    const metadata=JSON.parse(db.prepare('SELECT metadata FROM document_proposals WHERE id=?').get(result.id).metadata);delete metadata.productVerificationPolicy;
    db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify(metadata),result.id);
    return result;
  };
  const approve = async (document, metadata = {}) => {
    await assistant.content("tester", job.id, document.id); assistant.viewed("tester", job.id, document.id, document.sha256);
    return assistant.approve("tester", job.id, document.id, { reviewed: "on", sha256: document.sha256, revision: revision(), metadata: { title: document.title, category: document.category, ...metadata } });
  };
  return { root, db, files, assistant, job, reference, revision, propose, approve,
    cleanup: async () => { store.disconnectProjectDataStore(root); db.close(); await fs.rm(root, { recursive: true, force: true }); } };
}

// Router und echte EJS-Ausgabe im Prozess prüfen; dafür ist kein TCP-Port nötig.
function request(router, url, { method = "GET", body = {}, token = "", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const user = { id: "tester", name: "Test", role: "systemadmin" };
    const req = { method, url, originalUrl: url, query: {}, body, user, apiRequestId: crypto.randomUUID(),
      get: name => name.toLowerCase() === "authorization" ? `Bearer ${token}` : headers[name.toLowerCase()], is: value => value === "application/json" };
    const res = { statusCode: 200, locals: { user, csrfToken: "synthetic", cspNonce: "synthetic", jsonForHtml }, headers: {},
      set(name, value) { if (typeof name === "object") Object.assign(this.headers, name); else this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data, headers: this.headers }); },
      send(data) { resolve({ status: this.statusCode, data }); },
      redirect(url) { resolve({ status: 302, url }); },
      render(view, locals) { ejs.renderFile(path.join(__dirname, "../views", view + ".ejs"), { ...this.locals, ...locals }).then(html => resolve({ status: this.statusCode, html }), reject); } };
    router.handle(req, res, error => reject(error || Error("Route wurde nicht gefunden")));
  });
}

test("API nennt passende Felder und verhindert fremde Felder sowie inaktive Ziele", async () => {
  const f = await fixture();
  try {
    const tokens = createApiTokenService(f.db), key = tokens.create("tester", { name: "Test", scopes: ["devices:read", "devices:write"] });
    const router = createIntegrationRouter({ root: f.root, tokens, audit: { middleware: (_req, _res, next) => next() }, exportJobs: { list: () => [] } });
    const lists = await request(router, "/projects/example/device-lists", { token: key.token });
    assert.equal(lists.status, 200); assert.ok(lists.data.data.items[0].fields.some(field => field.name === "hersteller" && field.required));
    const detail = await request(router, "/projects/example/device-lists/devices", { token: key.token });
    assert.equal(detail.status, 200); assert.ok(detail.data.data.fields.some(field => field.name === "spannung"));
    const before = f.revision();
    let response = await request(router, "/projects/example/device-lists/devices/positions", { token: key.token, method: "POST", headers: { "if-match": `"${f.revision()}"` }, body: { kategorie: "Cat 6A" } });
    assert.equal(response.status, 400); assert.equal(response.data.error.code, "DEVICE_FIELD_MISMATCH"); assert.equal(f.revision(), before);
    response = await request(router, "/projects/example/device-lists/inactive/positions", { token: key.token, method: "POST", headers: { "if-match": `"${f.revision()}"` }, body: { hersteller: "Test" } });
    assert.equal(response.status, 409); assert.equal(response.data.error.code, "INACTIVE_DEVICE_LIST");
    response = await request(router, "/projects/example/device-lists/devices/positions", { token: key.token, method: "POST", headers: { "if-match": `"${f.revision()}"` }, body: { hersteller: "Testhersteller", typ: "Test 200", system: "Testsystem", spannung: "230 V" } });
    assert.equal(response.status, 201); assert.equal(response.data.data.pos, 2);
    assert.equal((await readJson(f.files.geraetelisten))[0].positionen[0].custom, "behalten");
    response = await request(router, "/projects/example/device-lists/devices/positions/2", { token: key.token, method: "PATCH", headers: { "if-match": `"${f.revision()}"` }, body: { datenblattId: "unreviewed" } });
    assert.equal(response.status, 400); // Dokumentverknüpfungen bleiben der Einzelfreigabe vorbehalten.
  } finally { await f.cleanup(); }
});

test("Dokumentverknüpfung: Vorgaben prüfen, GUI-Ziel vorauswählen und atomar mit dem Gerät speichern", async () => {
  const f = await fixture();
  try {
    const before = f.revision();
    await assert.rejects(f.propose({ deviceReferences: [{ ...f.reference, model: "Falsches Gerät" }] }), { apiCode: "DEVICE_REFERENCE_CHANGED" });
    await assert.rejects(f.propose({ deviceReferences: [f.reference, f.reference] }), { apiCode: "DUPLICATE_DEVICE_REFERENCE" });
    assert.equal(f.revision(), before);
    const document = await f.propose({ requirementIds: ["sheet"] });
    assert.equal(document.deviceReferences[0].listId, "devices"); assert.equal(f.revision(), before);
    assert.equal((await readJson(f.files.geraetelisten))[0].positionen[0].datenblattId, undefined);
    const router = createDocumentAssistantRouter({ root: f.root, audit: { middleware: (_req, _res, next) => next() }, exportJobs: { list: () => [] } });
    const page = await request(router, `/auftraege/${f.job.id}/dateien/${document.id}`);
    assert.equal(page.status, 200); assert.match(page.html, /name="deviceReferences"[^>]* checked/); assert.match(page.html, /Elektroinstallation \/ DIN VDE 0100 · Pos. 1/);
    await f.assistant.content("tester", f.job.id, document.id); f.assistant.viewed("tester", f.job.id, document.id, document.sha256);
    const response = await request(router, `/auftraege/${f.job.id}/dateien/${document.id}/uebernehmen`, { method: "POST", body: { title: document.title, category: "Datenblätter", reviewed: "on", sha256: document.sha256, revision: f.revision(), deviceReferencesPresent: "1", deviceReferences: JSON.stringify(f.reference) } });
    assert.equal(response.status, 302);
    const attachments = await readJson(f.files.anhaenge), lists = await readJson(f.files.geraetelisten);
    assert.equal(lists[0].positionen[0].datenblattId, attachments[0].id); assert.equal(lists[0].positionen[0].custom, "behalten");
    assert.equal(attachments[0].deviceReferences[0].model, "Test 100");
    assert.equal(normalizeAttachments(attachments)[0].deviceReferences[0].listId, "devices");
    assert.ok(normalizeAttachments(attachments)[0].assistantProvenance);
    assert.equal(normalizeGeraetelisten(lists)[0].positionen[0].datenblattId, attachments[0].id);
    const posted = normalizePostedGeraetelisten(lists.map(list => ({ ...list, aktiv: "on", export: "on" })));
    assert.equal(posted.find(list => list.id === "devices").positionen[0].datenblattId, attachments[0].id);
    const readiness = createDocumentationReadinessService(f.root, { db: f.db });
    assert.equal((await readiness.inspect("tester", "example", { assistantJobId: f.job.id })).requirements[0].fulfilled, true);
    const api = createIntegrationService(f.root), auth = { user: { id: "tester" }, token: { projectIds: null } };
    await api.changePosition(auth, "example", "devices", 1, `"${f.revision()}"`, { typ: "Geändertes Gerät" });
    const changed = await readiness.inspect("tester", "example", { assistantJobId: f.job.id });
    assert.equal(changed.requirements[0].fulfilled, false); assert.ok(changed.issues.some(issue => issue.code === "DEVICE_DOCUMENT_CHANGED"));
  } finally { await f.cleanup(); }
});

test("Veraltete Gerätebezüge und bestehende Unterlagen werden bei der Freigabe nicht überschrieben", async () => {
  const f = await fixture();
  try {
    const document = await f.propose({ deviceReferences: [f.reference] });
    const api = createIntegrationService(f.root), auth = { user: { id: "tester" }, token: { projectIds: null } };
    await api.changePosition(auth, "example", "devices", 1, `"${f.revision()}"`, { typ: "Anderer Typ" });
    await assert.rejects(f.approve(document), { apiCode: "DEVICE_REFERENCE_CHANGED" });
    assert.equal((await readJson(f.files.anhaenge)).length, 0);
    await api.changePosition(auth, "example", "devices", 1, `"${f.revision()}"`, { typ: "Test 100" });
    const firstId = await f.approve(document);
    const second = await f.propose({ deviceReferences: [f.reference] });
    const before = f.revision();
    await assert.rejects(f.approve(second), { apiCode: "DEVICE_DOCUMENT_CONFLICT" });
    assert.equal(f.revision(), before); assert.equal((await readJson(f.files.anhaenge)).length, 1);
    assert.equal((await readJson(f.files.geraetelisten))[0].positionen[0].datenblattId, firstId);
    assert.equal(f.assistant.get("tester", f.job.id).documents.find(item => item.id === second.id).state, "pending");
  } finally { await f.cleanup(); }
});

for (const documentArea of [area, "Brandschutzabschottungen"]) test("Anleitung, Datenblatt, GUI und PDF: " + documentArea, async () => {
  const area = documentArea;
  const f = await fixture(area);
  try {
    const sheet = await f.propose({ deviceReferences: [f.reference] }); await f.approve(sheet);
    const manual = await f.propose({ category: "Bedienungsanleitungen", deviceReferences: [f.reference] });
    const router = createDocumentAssistantRouter({ root: f.root, audit: { middleware: (_req, _res, next) => next() }, exportJobs: { list: () => [] } });
    const review = await request(router, `/auftraege/${f.job.id}/dateien/${manual.id}`);
    assert.equal(review.status, 200); assert.match(review.html, /name="deviceReferences"[^>]* checked/);
    await f.approve(manual);
    const lists = await readJson(f.files.geraetelisten), attachments = await readJson(f.files.anhaenge), project = await readJson(f.files.projekt);
    const position = lists[0].positionen[0]; assert.notEqual(position.datenblattId, position.bedienungsanleitungId);
    position.bemerkung = "INTERNE_QUELLE_TEST https://quelle.example.invalid/nur-intern";
    position.spannung = "230 V";
    position.leistung = "125 W";
    const output = await generateGeraetelisten(f.root, project, lists, { lizenz: { brandingAktiv: false } }, [], { aktiv: [area] }, attachments);
    assert.equal(output.length, 1);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({ data: new Uint8Array(await fs.readFile(output[0])), useSystemFonts: true });
    const pdf = await loading.promise;
    try {
      const text = (await (await pdf.getPage(1)).getTextContent()).items.map(item => item.str).join(" ");
      assert.match(text, /Anleitung/); assert.match(text, /Datenblatt/);
      assert.doesNotMatch(text, /INTERNE_QUELLE_TEST|quelle\.example|Bemerkung|Spannung|Leistung|230 V|125 W/);
      const plan = buildDocumentationPlan([], lists, attachments, { aktiv: [area] }, project);
      for (const document of attachments) assert.ok(text.includes(`Kap. ${plan.find(entry => entry.attachmentId === document.id).displayKapitel}`));
    } finally { await loading.destroy(); }
    const html = await ejs.renderFile(path.join(__dirname, "../views/geraetelisten.ejs"), { active: "geraetelisten", user: { name: "Test", role: "systemadmin" }, cspNonce: "synthetic", flash: {}, csrfToken: "synthetic", jsonForHtml,
      geraetelisten: normalizeGeraetelisten(lists), aktiveLeistungsbereiche: [area], nurAktive: false, suggestions: {}, fieldProfiles: { [area]: deviceListFieldsForLeistungsbereich(area) }, bedienungsanleitungen: attachments.filter(item => item.category === "Bedienungsanleitungen"), datenblaetter: attachments.filter(item => item.category === "Datenblätter"), geraetelistenVorlagen: [], previewByListId: {} });
    assert.match(html, /name="geraetelisten\[0\]\[positionen\]\[0\]\[datenblattId\]"/);
    assert.ok(html.includes(`value="${position.datenblattId}" selected`));
    assert.match(html, /Bemerkung \(intern\)/);
    assert.ok(html.includes(position.bemerkung));
    assert.doesNotMatch(html, /<th[^>]*data-col="(?:spannung|leistung)"/);
    // Only the electrical profile contains these retained fields. Brandschutz
    // has its own field profile; document links must work in both profiles.
    if (area === "Elektroinstallation / DIN VDE 0100") {
      assert.match(html, /type="hidden" name="geraetelisten\[0\]\[positionen\]\[0\]\[spannung\]" value="230 V"/);
      assert.match(html, /type="hidden" name="geraetelisten\[0\]\[positionen\]\[0\]\[leistung\]" value="125 W"/);
    }
  } finally { await f.cleanup(); }
});
