const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const crypto = require("node:crypto");
const { PDFDocument } = require("pdf-lib");
const dbService = require("../services/dbService");
const store = require("../services/projectDataStoreService");
const devices = require("../services/deviceDataStoreService");
const { createApiTokenService } = require("../services/apiTokenService");
const { createAuditService } = require("../services/auditService");
const { createMcpServer } = require("../services/mcpServerService");
const source = path.resolve(__dirname, "..");

const { fixture, mcpClient } = require("./helpers/integrationFixture");

test("Echte API und MCP: Benutzergrenzen, Schlüssel, Schreibschutz und Protokoll", async t => {
  const f = await fixture();
  try {
    await t.test("OpenAPI ist öffentlich; echte Daten benötigen einen API-Schlüssel", async () => {
      assert.equal((await f.request("/openapi.json", { token: null })).data.openapi, "3.1.0");
      assert.equal((await f.request("/projects", { token: null })).status, 401);
      assert.equal((await f.request("/projects", { token: "falsch" })).status, 401);
      const me = await f.request("/me"); assert.equal(me.data.data.userId, "alice");
      assert.ok(!JSON.stringify(me).includes("password"));
    });
    await t.test("Echte Projekte sind paginiert und nach Eigentümer getrennt", async () => {
      const result = await f.request("/projects?limit=1&offset=0");
      assert.equal(result.data.data.total, 2); assert.equal(result.data.data.items.length, 1);
      assert.match(result.data.data.items[0].projektname, /^alice/);
      assert.equal((await f.request("/projects?limit=101")).status, 400);
      assert.equal((await f.request("/projects?limit=1&limit=2")).status, 400);
      assert.equal((await f.request("/projects/unknown")).status, 404);
      assert.equal((await f.request("/projects/SAME")).status, 400);
    });
    await t.test("Projektbeschränkungen und Leserechte werden auch bei direkten IDs geprüft", async () => {
      const limited = f.makeToken("alice", { scopes: ["projects:read"], projectIds: ["same"] });
      assert.equal((await f.request("/projects", { token: limited.token })).data.data.total, 1);
      assert.equal((await f.request("/projects/second", { token: limited.token })).status, 404);
      assert.equal((await f.request("/projects/same/device-lists", { token: limited.token })).status, 403);
      assert.equal((await f.request("/projects/same", { token: limited.token, method: "PATCH", body: { projektname: "Verboten" } })).status, 403);
      assert.throws(() => f.makeToken("alice", { projectIds: ["unknown"] }), { status: 404 });
    });
    await t.test("API-Schlüssel werden gehasht gespeichert und bleiben benutzergebunden", async () => {
      const saved = f.db.prepare("SELECT * FROM api_tokens WHERE id=?").get(f.key.id);
      assert.ok(!JSON.stringify(saved).includes(f.key.token));
      assert.ok(!JSON.stringify(f.tokens.list("alice")).includes(saved.token_hash));
      assert.throws(() => f.tokens.revoke("bob", f.key.id), { status: 404 });
      const bob = f.makeToken("bob");
      assert.equal((await f.request("/projects/same", { token: bob.token })).data.data.projekt.projektname, "bob same");
    });
    await t.test("Sperre, Rollenänderung und Passwortwechsel wirken auf bestehende Schlüssel", async () => {
      const key = f.makeToken("bob");
      f.db.prepare("UPDATE users SET status='disabled' WHERE id='bob'").run();
      assert.equal((await f.request("/me", { token: key.token })).status, 401);
      f.db.prepare("UPDATE users SET status='active',role='viewer' WHERE id='bob'").run();
      assert.equal((await f.request("/projects/same", { token: key.token, method: "PATCH", body: { projektname: "Verboten" } })).status, 403);
      f.db.prepare("UPDATE users SET role='user',password_hash='neuer-hash' WHERE id='bob'").run();
      assert.equal((await f.request("/me", { token: key.token })).status, 401);
      assert.throws(() => f.makeToken("viewer"), { status: 403 });
    });
    await t.test("Abgelaufene und widerrufene Schlüssel werden abgewiesen", async () => {
      const key = f.makeToken(); f.tokens.revoke("alice", key.id);
      assert.equal((await f.request("/me", { token: key.token })).status, 401);
      const expired = f.makeToken(); f.db.prepare("UPDATE api_tokens SET expires_at='2000-01-01' WHERE id=?").run(expired.id);
      assert.equal((await f.request("/me", { token: expired.token })).status, 401);
    });
    await t.test("Projekt-PATCH benötigt If-Match und erhält unbekannte Bestandsfelder", async () => {
      const before = await f.request("/projects/same");
      assert.equal((await f.request("/projects/same", { method: "PATCH", body: { projektname: "Neu" } })).status, 428);
      const result = await f.request("/projects/same", { method: "PATCH", headers: { "If-Match": before.etag }, body: { projektname: "Über API geändert", stockwerke: ["EG"] } });
      assert.equal(result.status, 200); assert.notEqual(result.etag, before.etag);
      assert.deepEqual(result.data.data.custom, { keep: true });
      assert.equal((await f.request("/projects/same", { method: "PATCH", headers: { "If-Match": before.etag }, body: { projektname: "Veraltet" } })).status, 412);
      assert.equal((await f.request("/projects/second")).data.data.projekt.projektname, "alice second");
      assert.equal(f.db.prepare("SELECT current_project_id FROM users WHERE id='alice'").get().current_project_id, "same");
      assert.deepEqual(await fs.readFile(path.join(f.root, "storage/users/alice/projects/same/data/projekt.json")), f.original);
    });
    await t.test("Ungültiges JSON, unbekannte Felder und andere Inhaltstypen liefern JSON-Fehler", async () => {
      const { etag } = await f.request("/projects/same");
      for (const body of [{ userId: "bob" }, {}, { logoPfad: "../../file" }, { projektname: 123 }, { projektname: "" }]) assert.equal((await f.request("/projects/same", { method: "PATCH", headers: { "If-Match": etag }, body })).status, 400);
      const malformed = await f.request("/projects/same", { method: "PATCH", body: '{"password":"never-log-me"' });
      assert.equal(malformed.status, 400); assert.equal(malformed.data.error.message, "Ungültiges JSON.");
      assert.equal((await f.request("/projects/same", { method: "PATCH", headers: { "Content-Type": "text/plain" }, body: "bad" })).status, 415);
    });
    await t.test("Gerätepositionen werden verlustfrei gespeichert und in SQLite projiziert", async () => {
      const before = await f.request("/projects/same/device-lists/devices");
      assert.equal(before.data.data.positionen.items[0].typ, "Original");
      const changed = await f.request("/projects/same/device-lists/devices/positions/1", { method: "PATCH", headers: { "If-Match": before.etag }, body: { typ: "API-Gerät" } });
      assert.equal(changed.status, 200); assert.equal(changed.data.data.custom, "behalten");
      const added = await f.request("/projects/same/device-lists/devices/positions", { method: "POST", headers: { "If-Match": changed.etag }, body: { typ: "Neues Gerät", hersteller: "Prüfung" } });
      assert.equal(added.status, 201); assert.equal(added.data.data.pos, 2);
      assert.deepEqual(f.db.prepare("SELECT typ FROM project_device_positions WHERE user_id='alice' AND project_id='same' ORDER BY position_order").all().map(row => row.typ), ["API-Gerät", "Neues Gerät"]);
      const page = await f.request("/projects/same/device-lists/devices?limit=1&offset=1");
      assert.equal(page.data.data.positionen.items[0].pos, 2);
      assert.equal((await f.request("/projects/same/device-lists")).data.data.items[0].positionCount, 2);
    });
    await t.test("Gleichzeitige Änderungen mit derselben Version verlieren keine Daten", async () => {
      const { etag } = await f.request("/projects/same");
      const results = await Promise.all(["Parallel A", "Parallel B"].map(projektname => f.request("/projects/same", { method: "PATCH", headers: { "If-Match": etag }, body: { projektname } })));
      assert.equal(results.filter(result => result.status === 200).length, 1);
      assert.ok(results.some(result => [409, 412].includes(result.status)));
    });
    await t.test("Projektbereiche verwenden echte Daten und eine gemeinsame Projektversion", async () => {
      for (const section of ["service-areas", "systems", "documents", "firestops", "attachments", "exports"]) {
        const result = await f.request(`/projects/same/${section}`); assert.equal(result.status, 200); assert.ok(result.etag);
      }
      assert.equal((await f.request("/not-found")).status, 404);
    });
    await t.test("MCP handelt das Protokoll aus, listet Lesewerkzeuge und ruft die echte API auf", async () => {
      const client = mcpClient(f.base, f.key.token);
      try {
        await client.initialize();
        const listed = await client.rpc("tools/list", {});
        assert.equal(listed.result.tools.length, 22);
        assert.ok(listed.result.tools.some(tool => tool.name === 'edoku_knowledge' && tool.annotations.readOnlyHint));
        assert.ok(listed.result.tools.every(tool => tool.annotations.readOnlyHint));
        assert.ok(listed.result.tools.some(tool => tool.name === "edoku_document_work_status"));
        const result = await client.rpc("tools/call", { name: "edoku_get_project", arguments: { projectId: "same" } });
        assert.equal(result.result.structuredContent.data.id, "same");
        assert.ok(result.result.structuredContent.etag);
        const denied = await client.rpc("tools/call", { name: "edoku_patch_project", arguments: {} });
        assert.ok(denied.error || denied.result.isError);
      } finally { await client.close(); }
    });
    await t.test("MCP-Schreibwerkzeuge benötigen Freischaltung, Rechte und die gelesene Version", async () => {
      const client = mcpClient(f.base, f.key.token, true);
      try {
        await client.initialize();
        const tools = (await client.rpc("tools/list", {})).result.tools;
        assert.equal(tools.length, 55);
        assert.ok(tools.some(tool => tool.name === "edoku_record_document_work"));
        assert.ok(!tools.some(tool => /approve|freigeben/i.test(tool.name)));
        const read = await client.rpc("tools/call", { name: "edoku_get_project", arguments: { projectId: "same" } });
        const args = { projectId: "same", etag: read.result.structuredContent.etag, changes: { bearbeiter: "MCP-Prüfung" } };
        const written = await client.rpc("tools/call", { name: "edoku_patch_project", arguments: args });
        assert.equal(written.result.structuredContent.data.bearbeiter, "MCP-Prüfung");
        const conflict = await client.rpc("tools/call", { name: "edoku_patch_project", arguments: args });
        assert.equal(conflict.result.isError, true);
        assert.equal(JSON.parse(conflict.result.content[0].text).status, 412);
      } finally { await client.close(); }
    });
    await t.test("MCP verweigert entfernte HTTP-Adressen und folgt keinen Weiterleitungen", async () => {
      assert.throws(() => createMcpServer({ baseUrl: "http://remote.example", token: f.key.token }), /HTTPS/);
      assert.throws(() => createMcpServer({ baseUrl: "https://user:pass@example.com", token: f.key.token }), /ohne Zugangsdaten/);
      // Das produktive stdio-Verhalten wird über einen echten Umleitungsserver geprüft.
      const redirect = require("node:http").createServer((_req, res) => { res.writeHead(302, { Location: f.base + "/api/v1/me" }); res.end(); });
      await new Promise(resolve => redirect.listen(0, "127.0.0.1", resolve));
      const client = mcpClient(`http://127.0.0.1:${redirect.address().port}`, f.key.token);
      try { await client.initialize(); const result = await client.rpc("tools/call", { name: "edoku_identity", arguments: {} }); assert.equal(result.result.isError, true); }
      finally { await client.close(); await new Promise(resolve => redirect.close(resolve)); }
    });
    await t.test("Browser-Keyverwaltung nutzt Sitzung und CSRF; Bearer umgeht keine Webformulare", async () => {
      const cookies = new Map();
      async function browser(route, options = {}) {
        const response = await fetch(f.base + route, { redirect: "manual", ...options, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...options.headers } });
        for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0], sep = pair.indexOf("="); cookies.set(pair.slice(0, sep), pair.slice(sep + 1)); }
        return response;
      }
      const login = await (await browser("/login")).text();
      const csrf = login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
      assert.equal((await browser("/login", { method: "POST", body: new URLSearchParams({ email: "alice", password: f.password, _csrf: csrf }) })).status, 302);
      const legacy = await browser("/integrationen"); assert.equal(legacy.status, 302); assert.equal(legacy.headers.get("location"), "/einstellungen#api");
      const page = await browser("/einstellungen"); assert.equal(page.status, 200);
      const html = await page.text(), token = html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
      assert.match(html, /API &amp; MCP/);
      assert.match(html, /data-settings-tab="api"/);
      assert.match(html, /data-settings-panel="api"/);
      assert.match(html, /data-mcp-setup/);
      assert.equal((await f.request("/projects", { token: null, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") } })).status, 401);
      assert.equal((await browser("/integrationen/schluessel", { method: "POST", body: new URLSearchParams({ name: "Ohne CSRF" }) })).status, 403);
      const fields = new URLSearchParams({ name: "Browser-Test", days: "7", scopes: "projects:read", projectMode: "selected", projectIds: "same", _csrf: token });
      const created = await browser("/integrationen/schluessel", { method: "POST", body: fields }); assert.equal(created.status, 200);
      const displayed = await created.text(), secret = displayed.match(/edoku_[a-f0-9]{24}\.[a-f0-9]{64}/)?.[0]; assert.ok(secret);
      assert.ok(!(await (await browser("/einstellungen")).text()).includes(secret));
      const key = f.tokens.list("alice").find(key => key.name === "Browser-Test");
      assert.equal((await browser(`/integrationen/schluessel/${key.id}/widerrufen`, { method: "POST", body: new URLSearchParams({ _csrf: token }) })).status, 302);
      assert.equal((await f.request("/me", { token: secret })).status, 401);
      const configFile = path.join(f.root, "config/integrationen.json");
      const settingsPost = fields => browser("/einstellungen/integrationen", { method: "POST", body: new URLSearchParams({ _csrf: token, ...fields }) });
      const current = await f.request("/projects/same");
      const valid = { apiEnabled: "on", allowWrites: "on", defaultTokenDays: "7", maxTokenDays: "30" };
      assert.equal((await settingsPost(valid)).status, 302);
      assert.equal(JSON.parse(await fs.readFile(configFile, "utf8")).defaultTokenDays, 7);
      const updated = await (await browser("/einstellungen")).text();
      assert.match(updated, /name="days"[^>]*max="30"[^>]*value="7"/);
      assert.equal((await browser("/integrationen/schluessel", { method: "POST", body: new URLSearchParams({ ...Object.fromEntries(fields), days: "31" }) })).status, 400);
      assert.equal((await settingsPost({ ...valid, defaultTokenDays: "31" })).status, 400);
      assert.equal(JSON.parse(await fs.readFile(configFile, "utf8")).defaultTokenDays, 7);
      assert.equal((await settingsPost({ ...valid, allowWrites: "" })).status, 302);
      assert.equal((await f.request("/projects/same")).status, 200);
      const blockedWrite = await f.request("/projects/same", { method: "PATCH", headers: { "If-Match": current.etag }, body: { bearbeiter: "Nicht speichern" } });
      assert.equal(blockedWrite.status, 403); assert.equal(blockedWrite.data.error.code, "API_READ_ONLY");
      assert.equal((await settingsPost({ ...valid, apiEnabled: "" })).status, 302);
      const disabled = await f.request("/me"); assert.equal(disabled.status, 503); assert.equal(disabled.data.error.code, "API_DISABLED");
      assert.equal((await browser("/einstellungen")).status, 200);
      assert.equal((await f.request("/openapi.json", { token: null })).status, 200);
      assert.equal((await settingsPost(valid)).status, 302);
      assert.equal((await f.request("/me")).status, 200);
      f.db.prepare("UPDATE users SET role='user' WHERE id='alice'").run();
      const userPage = await (await browser("/einstellungen")).text();
      assert.ok(!userPage.includes('action="/einstellungen/integrationen#api"'));
      assert.match(userPage, /data-api-key-form/);
      assert.equal((await settingsPost({ ...valid, apiEnabled: "" })).status, 403);
      assert.equal(JSON.parse(await fs.readFile(configFile, "utf8")).apiEnabled, true);
      const own = await browser("/integrationen/schluessel", { method: "POST", body: new URLSearchParams({ ...Object.fromEntries(fields), name: "Benutzerschlüssel" }) });
      assert.equal(own.status, 200);
      f.db.prepare("UPDATE users SET role='systemadmin' WHERE id='alice'").run();
      assert.equal((await fetch(f.base + "/projekt", { method: "POST", headers: { Authorization: `Bearer ${f.key.token}`, "Content-Type": "application/json" }, body: "{}" })).status, 403);
    });
    await t.test("Protokoll erfasst Änderungen ohne Zugangsdaten und bleibt prüfbar", async () => {
      await f.stop();
      const events = await createAuditService(f.root).read();
      assert.ok(events.some(event => event.event === "api.project.change" && event.phase === "result" && event.outcome === "success"));
      assert.ok(events.some(event => event.event === "api.token.create"));
      assert.ok(events.some(event => event.event === "api.token.revoke"));
      assert.ok(!JSON.stringify(events).includes(f.key.token));
      assert.ok(!JSON.stringify(events).includes("Über API geändert"));
      assert.equal(f.db.pragma("integrity_check", { simple: true }), "ok");
      assert.deepEqual(f.db.pragma("foreign_key_check"), []);
    });
  } finally { await f.cleanup(); }
});

test("Doku-Assistent: vorbereitete Dateien brauchen eine gesonderte menschliche Freigabe", async assistantTests => {
  const f = await fixture();
  try {
      const agent = f.makeToken("alice", { scopes: ["projects:read", "assistant:read", "assistant:write"], projectIds: ["same"] });
      const start = await f.request("/projects/same/assistant/jobs", { token: agent.token, method: "POST", body: { instruction: "Erstelle eine Dokumentation und frage nach fehlenden Herstellerdaten." } });
      assert.equal(start.status, 201);
      const jobId = start.data.data.id, apiPath = `/projects/same/assistant/jobs/${jobId}`, uiPath = `/assistent/auftraege/${jobId}`;
      const cookies = new Map();
      async function browser(route, options = {}) {
        const response = await fetch(f.base + route, { redirect: "manual", ...options, headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...options.headers } });
        for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0], sep = pair.indexOf("="); cookies.set(pair.slice(0, sep), pair.slice(sep + 1)); }
        return response;
      }
      const login = await (await browser("/login")).text();
      let csrf = login.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
      assert.equal((await browser("/login", { method: "POST", body: new URLSearchParams({ email: "alice", password: f.password, _csrf: csrf }) })).status, 302);
      const page = await (await browser(uiPath)).text(); csrf = page.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
      const metadata = { title: "Herstellerunterlage zum Prüfgerät", category: "Bedienungsanleitungen", sourceLabel: "Künstliche Herstellerquelle", sourceUrl: "https://example.com/manual.pdf", reason: "Passende Baureihe; technische Zuordnung muss der Benutzer prüfen.", stockwerk: "EG", anlage: "Prüfanlage" };
      const pdf = await PDFDocument.create(); pdf.addPage().drawText("Synthetische Herstellerunterlage zur manuellen Sichtung"); const pdfBytes = Buffer.from(await pdf.save());
      const upload = async (bytes = pdfBytes, meta = metadata) => {
        const body = new FormData(); body.set("metadata", JSON.stringify(meta)); body.set("file", new Blob([bytes]), "Pruefunterlage.pdf");
        const response = await fetch(f.base + "/api/v1" + apiPath + "/documents", { method: "POST", headers: { Authorization: `Bearer ${agent.token}` }, body });
        return { status: response.status, data: await response.json() };
      };
      let document;
      const attachments = () => JSON.parse(f.db.prepare("SELECT payload FROM project_documents WHERE user_id='alice' AND project_id='same' AND name='anhaenge.json'").get().payload);
      const originalAttachments = attachments();
      const approval = async (document, extras = {}) => {
        const current = await f.request("/projects/same");
        return browser(`${uiPath}/dateien/${document.id}/uebernehmen`, { method: "POST", body: new URLSearchParams({ _csrf: csrf, reviewed: "on", sha256: document.sha256, revision: current.etag.slice(1, -1), title: metadata.title, category: metadata.category, stockwerk: metadata.stockwerk, anlage: metadata.anlage, ...extras }) });
      };
      await assistantTests.test("Agent darf konkrete Rückfragen stellen, aber keine Benutzerantworten oder Abschlüsse erfinden", async () => {
        const question = { id: "manufacturer", prompt: "Welcher Hersteller und welche genaue Gerätebaureihe wurden installiert?", required: true };
        const asked = await f.request(apiPath, { token: agent.token, method: "PATCH", body: { status: "working", questions: [question] } });
        assert.equal(asked.status, 200); assert.equal(asked.data.data.status, "needs_info");
        assert.equal((await f.request(apiPath, { token: agent.token, method: "PATCH", body: { status: "closed" } })).status, 400);
        assert.equal((await f.request(apiPath, { token: agent.token, method: "PATCH", body: { questions: [{ ...question, answer: "Vom Agenten erfunden" }] } })).status, 400);
        assert.equal((await browser(uiPath + "/antworten", { method: "POST", body: new URLSearchParams({ _csrf: csrf, "answers[manufacturer]": "Hersteller Beispiel, Baureihe Test 100" }) })).status, 302);
        const answer = await f.request(apiPath, { token: agent.token }); assert.equal(answer.data.data.questions[0].answer, "Hersteller Beispiel, Baureihe Test 100");
        assert.equal(answer.data.data.status, "queued");
        assert.equal((await f.request("/projects/same", { token: agent.token, method: "PATCH", body: { bearbeiter: "Verboten" } })).status, 403);
      });
      await assistantTests.test("Vorbereitung lässt Projektanhänge und Version unverändert; gleiche Dateien werden dedupliziert", async () => {
        const before = await f.request("/projects/same");
        const result = await upload(); assert.equal(result.status, 201); document = result.data.data;
        assert.equal(document.state, "pending");
        assert.deepEqual(attachments(), originalAttachments);
        assert.equal((await f.request("/projects/same")).etag, before.etag);
        assert.equal((await upload()).data.data.id, document.id);
        assert.equal((await f.request(apiPath, { token: agent.token })).data.data.documents.length, 1);
        assert.equal((await upload(Buffer.from("%PDF-keine-echte-pdf"))).status, 415);
        assert.equal((await f.request("/projects/second/assistant/jobs/" + jobId, { token: agent.token })).status, 404);
      });
      await assistantTests.test("API und MCP können weder übernehmen noch eine Vorschau als GUI-Benutzer öffnen", async () => {
        assert.equal((await f.request(apiPath + `/documents/${document.id}/approve`, { token: agent.token, method: "POST", body: {} })).status, 404);
        const response = await fetch(f.base + `${uiPath}/dateien/${document.id}/uebernehmen`, { method: "POST", redirect: "manual", headers: { Authorization: `Bearer ${agent.token}`, "Content-Type": "application/json" }, body: "{}" });
        assert.ok([302, 403].includes(response.status));
        assert.equal((await fetch(f.base + `${uiPath}/dateien/${document.id}/inhalt`, { redirect: "manual", headers: { Authorization: `Bearer ${agent.token}` } })).status, 302);
        assert.deepEqual(attachments(), originalAttachments);
      });
      await assistantTests.test("Übernehmen erfordert Vorschau, passende Prüfsumme, CSRF und ausdrückliche Sichtungsbestätigung", async () => {
        assert.equal((await approval(document)).status, 409);
        const preview = await browser(`${uiPath}/dateien/${document.id}/inhalt`); assert.equal(preview.status, 200);
        assert.deepEqual(Buffer.from(await preview.arrayBuffer()), pdfBytes);
        assert.match(preview.headers.get("content-security-policy"), /sandbox/);
        assert.equal((await approval(document, { reviewed: "" })).status, 409);
        assert.equal((await approval(document, { sha256: "0".repeat(64) })).status, 409);
        assert.equal((await approval(document, { _csrf: "" })).status, 403);
        f.db.prepare("UPDATE users SET role='viewer' WHERE id='alice'").run();
        assert.equal((await approval(document)).status, 403);
        f.db.prepare("UPDATE users SET role='systemadmin' WHERE id='alice'").run();
        assert.deepEqual(attachments(), originalAttachments);
      });
      await assistantTests.test("Dateiaustausch nach Sichtung und veraltete Projektversionen werden abgewiesen", async () => {
        const staged = path.join(f.root, "storage/users/alice/assistant", jobId, document.id + ".pdf");
        await fs.writeFile(staged, Buffer.from("manipuliert"));
        assert.equal((await approval(document)).status, 409);
        await fs.writeFile(staged, pdfBytes);
        const before = await f.request("/projects/same");
        assert.equal((await f.request("/projects/same", { method: "PATCH", headers: { "If-Match": before.etag }, body: { bearbeiter: "Parallel geänderter Projektstand" } })).status, 200);
        assert.equal((await approval(document, { revision: before.etag.slice(1, -1) })).status, 409);
        assert.deepEqual(attachments(), originalAttachments);
      });
      await assistantTests.test("Erst die GUI-Entscheidung übernimmt genau eine Datei in das festgelegte Zielprojekt", async () => {
        f.db.prepare("UPDATE users SET current_project_id='second' WHERE id='alice'").run();
        assert.equal((await approval(document)).status, 404);
        assert.deepEqual(attachments(), originalAttachments);
        f.db.prepare("UPDATE users SET current_project_id='same' WHERE id='alice'").run();
        assert.equal((await approval(document)).status, 302);
        assert.equal(attachments().length, originalAttachments.length + 1);
        const added = attachments().at(-1); assert.equal(added.title, metadata.title); assert.equal(added.assistantProvenance.sha256, document.sha256);
        assert.deepEqual(await fs.readFile(path.join(f.root, added.relativePath)), pdfBytes);
        assert.equal((await f.request(apiPath, { token: agent.token })).data.data.documents[0].state, "approved");
        assert.equal(JSON.parse(f.db.prepare("SELECT payload FROM project_documents WHERE user_id='alice' AND project_id='second' AND name='anhaenge.json'").get().payload).length, 0);
        assert.equal(f.db.prepare("SELECT current_project_id FROM users WHERE id='alice'").get().current_project_id, "same");
        assert.equal((await approval(document)).status, 409);
        assert.equal(attachments().length, originalAttachments.length + 1);
        f.db.prepare("UPDATE users SET current_project_id='same' WHERE id='alice'").run();
      });
      await assistantTests.test("MCP lädt nur aus dem ausdrücklich freigegebenen Ordner und bietet keine Freigabewerkzeuge", async () => {
        const directory = path.join(f.root, "candidate-documents"); await fs.mkdir(directory);
        const next = await PDFDocument.create(); next.addPage().drawText("Zweiter Vorschlag"); const bytes = Buffer.from(await next.save());
        const filename = path.join(directory, "second.pdf"); await fs.writeFile(filename, bytes);
        const outside = path.join(f.root, "outside.pdf"); await fs.writeFile(outside, bytes);
        const client = mcpClient(f.base, agent.token, true, directory);
        try {
          await client.initialize(); const tools = (await client.rpc("tools/list", {})).result.tools;
          assert.ok(!tools.some(tool => /approve|accept|freigabe|uebernehmen/.test(tool.name)));
          const denied = await client.rpc("tools/call", { name: "edoku_propose_document", arguments: { projectId: "same", jobId, filePath: outside, metadata } }); assert.equal(denied.result.isError, true);
          const submitted = await client.rpc("tools/call", { name: "edoku_propose_document", arguments: { projectId: "same", jobId, filePath: filename, metadata: { ...metadata, title: "Zweiter Vorschlag" } } });
          assert.equal(submitted.result.structuredContent.data.state, "pending");
          assert.equal(attachments().length, originalAttachments.length + 1);
          const proposed = submitted.result.structuredContent.data;
          assert.equal((await browser(uiPath + "/abschliessen", { method: "POST", body: new URLSearchParams({ _csrf: csrf }) })).status, 409);
          assert.equal((await browser(`${uiPath}/dateien/${proposed.id}/ablehnen`, { method: "POST", body: new URLSearchParams({ _csrf: csrf }) })).status, 302);
          assert.equal(attachments().length, originalAttachments.length + 1);
        } finally { await client.close(); }
      });
      await assistantTests.test("Freigabestatus und Projektanhang werden bei einem Datenbankfehler gemeinsam zurückgenommen", async () => {
        const next = await PDFDocument.create(); next.addPage().drawText("Atomare Freigabe"); const staged = await upload(Buffer.from(await next.save()), { ...metadata, title: "Atomarer Test" });
        const proposal = staged.data.data; await (await browser(`${uiPath}/dateien/${proposal.id}/inhalt`)).arrayBuffer();
        const before = attachments();
        f.db.exec("CREATE TRIGGER reject_assistant_approval BEFORE UPDATE OF state ON document_proposals WHEN NEW.state='approved' BEGIN SELECT RAISE(ABORT,'synthetic approval failure'); END");
        try { assert.equal((await approval(proposal)).status, 500); assert.deepEqual(attachments(), before); assert.equal(f.db.prepare("SELECT state FROM document_proposals WHERE id=?").get(proposal.id).state, "pending"); }
        finally { f.db.exec("DROP TRIGGER reject_assistant_approval"); }
        assert.equal((await approval(proposal)).status, 302);
        assert.equal(attachments().length, before.length + 1);
      });
      await assistantTests.test("Nur der Benutzer schließt den geprüften Auftrag ab; danach keine neuen Vorschläge", async () => {
        assert.equal((await browser(uiPath + "/abschliessen", { method: "POST", body: new URLSearchParams({ _csrf: csrf }) })).status, 302);
        assert.equal((await f.request(apiPath, { token: agent.token })).data.data.status, "closed");
        assert.equal((await upload()).status, 409);
        dbService.createSession("foreign-review-session", "bob", new Date(Date.now() + 60000).toISOString());
        assert.equal((await fetch(f.base + uiPath, { redirect: "manual", headers: { Cookie: "dm_session=foreign-review-session" } })).status, 404);
        assert.equal((await fetch(f.base + uiPath + "/status", { redirect: "manual", headers: { Cookie: "dm_session=foreign-review-session" } })).status, 404);
        assert.equal((await fetch(f.base + uiPath, { redirect: "manual" })).status, 302);
      });
  } finally { await f.cleanup(); }
});
