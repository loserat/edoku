const assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), net = require("node:net"), crypto = require("node:crypto");
const { spawn } = require("node:child_process"), readline = require("node:readline");
const dbService = require("../../services/dbService");
const store = require("../../services/projectDataStoreService");
const devices = require("../../services/deviceDataStoreService");
const { createApiTokenService } = require("../../services/apiTokenService");
const { z } = require("../../src/api/schemas");
const contract = require("../../src/api/openapi");
const responseContracts = Object.entries(contract.paths).flatMap(([route, methods]) => Object.entries(methods).flatMap(([method, operation]) => Object.entries(operation.responses).filter(([code]) => Number(code) < 300).map(([code, response]) => ({
  matches: new RegExp("^" + route.replace(/\{[^}]+\}/g, "[^/]+") + "$"), method: method.toUpperCase(), status: Number(code),
  schema: response.content?.["application/json"]?.schema?.type === "object" ? z.fromJSONSchema(response.content["application/json"].schema) : null
}))));
const source = path.resolve(__dirname, "../..");

async function fixture({ setup, port: requestedPort, productChecks = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-integration-"));
  for (const name of ["server.js", "package.json", "services", "src", "views", "public", "data", "config", "templates", "docs"]) await fs.cp(path.join(source, name), path.join(root, name), { recursive: true });
  await fs.symlink(path.join(source, "node_modules"), path.join(root, "node_modules"), "dir");
  // Old suites isolate product matching; the dedicated suite enables the real gate.
  await require('./productVerificationFixture').install(root,productChecks);
  const db = dbService.initDatabase(path.join(root, "storage"));
  const stamp = new Date().toISOString(), salt = "synthetic-salt", password = "synthetic-test-password";
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  for (const user of ["alice", "bob", "viewer"]) {
    dbService.createUser({ id: user, email: user, name: user, role: user === "viewer" ? "viewer" : "systemadmin", status: "active", passwordHash: hash, passwordSalt: salt, currentProjectId: "same", createdAt: stamp, updatedAt: stamp });
    for (const project of ["same", "second"]) {
      dbService.upsertProject({ id: project, userId: user });
      const directory = path.join(root, "storage/users", user, "projects", project, "data");
      await fs.mkdir(directory, { recursive: true });
      for (const name of store.PROJECT_DOCUMENTS) {
        const value = name === "projekt.json" ? { projektname: user + " " + project, custom: { keep: true } }
          : name === "geraetelisten.json" ? [{ id: "devices", leistungsbereich: "Elektroinstallation / DIN VDE 0100", positionen: [{ pos: 1, typ: "Original", custom: "behalten" }], custom: { keep: true } }]
          : name === "leistungsbereiche.json" ? { aktiv: [], optionen: [] } : [];
        await fs.writeFile(path.join(directory, name), JSON.stringify(value));
      }
    }
  }
  const original = await fs.readFile(path.join(root, "storage/users/alice/projects/same/data/projekt.json"));
  store.migrateProjectData(root, db);
  devices.migrateDeviceData(db);
  const tokens = createApiTokenService(db);
  const makeToken = (user = "alice", input = {}) => tokens.create(user, { name: "Prüfung", scopes: ["projects:read", "projects:write", "devices:read", "devices:write", "documents:read"], ...input });
  const key = makeToken();
  if (setup) await setup({ root, db });
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
  const port = requestedPort || socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  let child = spawn(process.execPath, [path.join(root, "server.js")], { cwd: root, env: { ...process.env, NODE_ENV: "test", PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", data => logs += data);
  child.stderr.on("data", data => logs += data);
  const base = `http://127.0.0.1:${port}`;
  for (let n = 0; n < 150; n++) {
    try { if (logs.includes(`edoku läuft auf http://localhost:${port}`) && (await fetch(base + "/ready")).status === 200) break; } catch {}
    if (child.exitCode !== null || n === 149) throw new Error(logs || "Server nicht bereit");
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  async function request(route, { token = key.token, method = "GET", body, headers = {} } = {}) {
    // Fachtests verlangen ihren früheren Vollumfang ausdrücklich; neue Defaults separat direkt per HTTP prüfen.
    const url = new URL(route,'http://fixture');
    if(method==='GET' && !url.searchParams.has('view') && (/\/projects\/[^/]+$/.test(url.pathname)||/\/next-action$/.test(url.pathname)||/\/assistant\/jobs\/[^/]+$/.test(url.pathname))) url.searchParams.set('view','full');
    if(method==='GET'&&!url.searchParams.has('limit')&&/\/(device-lists|attachments|assistant\/jobs|exports|datasheet-coverage)$/.test(url.pathname)) url.searchParams.set('limit','10');
    const response = await fetch(base + "/api/v1" + url.pathname + url.search, { method, redirect: "manual", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (response.ok && route !== "/openapi.json") {
      const entry = responseContracts.find(item => item.method === method && item.status === response.status && item.matches.test(route.split("?")[0]));
      assert.ok(entry?.schema, "Konkretes Antwortschema fehlt: " + method + " " + route);
      assert.ok(entry.schema.safeParse(data).success, "OpenAPI-Antwortvertrag verletzt: " + method + " " + route + " " + JSON.stringify(entry.schema.safeParse(data).error));
    }
    assert.ok(response.headers.get("x-request-id"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, data, etag: response.headers.get("etag"), replayed: response.headers.get("idempotency-replayed") };
  }
  async function stop() {
    if (child.exitCode === null) { const done = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGTERM"); await done; }
  }
  async function restart() {
    await stop();
    child = spawn(process.execPath, [path.join(root, "server.js")], { cwd: root, env: { ...process.env, NODE_ENV: "test", PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
    logs = "";
    child.stdout.on("data", data => logs += data); child.stderr.on("data", data => logs += data);
    for (let n = 0; n < 150; n++) {
      try { if (logs.includes(`edoku läuft auf http://localhost:${port}`) && (await fetch(base + "/ready")).status === 200) return; } catch {}
      if (child.exitCode !== null || n === 149) throw new Error(logs || "Server nach Neustart nicht bereit");
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  return { root, db, tokens, makeToken, key, base, request, original, stop, restart, password, productVerification:productChecks?require('./productVerificationFixture').realVerification(root):require('./productVerificationFixture').legacyVerification,
    cleanup: async () => { await stop(); store.disconnectProjectDataStore(root); db.close(); await fs.rm(root, { recursive: true, force: true }); }
  };
}

function mcpClient(base, token, writes = false, documentRoot = "", responseMode = "structured") {
  const child = spawn(process.execPath, [path.join(source, "scripts/edoku-mcp.js")], { env: { ...process.env, EDOKU_API_URL: base, EDOKU_MCP_RESPONSE_MODE: responseMode, EDOKU_API_TOKEN: token, EDOKU_MCP_ALLOW_WRITES: String(writes), EDOKU_MCP_DOCUMENT_ROOT: documentRoot }, stdio: ["pipe", "pipe", "pipe"] });
  let sequence = 0, logs = "";
  const pending = new Map();
  child.stderr.on("data", data => logs += data);
  readline.createInterface({ input: child.stdout }).on("line", line => {
    const response = JSON.parse(line), target = pending.get(response.id);
    if (target) { pending.delete(response.id); clearTimeout(target.timeout); target.resolve(response); }
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error("MCP Timeout: " + logs)); }, 10000);
    pending.set(id, { resolve, timeout });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  const listAwareRpc=async(method,params)=>{
    const result=await rpc(method,params);
    if(method==='tools/list'&&!params?.cursor&&result.result) {let cursor=result.result.nextCursor;while(cursor){const page=await rpc(method,{cursor});if(page.error)throw Error(JSON.stringify(page.error));result.result.tools.push(...page.result.tools);cursor=page.result.nextCursor;}delete result.result.nextCursor;}
    return result;
  };
  return { rpc:listAwareRpc, rawRpc:rpc, initialize: async () => {
    const result = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "edoku-test", version: "1.0.0" } });
    assert.ok(result.result?.capabilities?.tools, JSON.stringify(result));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  }, close: async () => {
    for (const entry of pending.values()) clearTimeout(entry.timeout);
    if (child.exitCode === null) { const done = new Promise(resolve => child.once("exit", resolve)); child.kill(); await done; }
    assert.ok(!logs.includes(token));
  } };
}

module.exports = { fixture, mcpClient };
