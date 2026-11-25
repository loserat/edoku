const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
const { AsyncResource } = require("node:async_hooks");
const { connection, getProject, getUserById } = require("./dbService");
const { createDocumentationReadinessService, sha256File } = require("./documentationReadinessService");
const { createDocumentAssistantService } = require("./documentAssistantService");
const { createApiTokenService } = require("./apiTokenService");
const { createIntegrationSettingsService } = require("./integrationSettingsService");
const { loadProjectWorkspace, generateCompleteDocumentation } = require("./projectWorkspaceService");
const { bindProjectScope, getProjectPaths, scopedProjectRoot } = require("./projectService");
const { resolveAttachmentFile } = require("./attachmentService");
const { prepareFinalExport } = require("./exportService");
const { assertSafePath } = require("./pathService");
const store = require("./projectDataStoreService");
const { parse, fault } = require("../src/api/validation");
const { id, exportJobInput } = require("../src/api/schemas");

const activeStates = ["queued", "waiting_input", "waiting_review", "running"];
function createExportJobService(root, { db = connection(), audit, checkStorage = async () => {}, now = Date.now,
  intervalMs = 1500, leaseMs = 30000, maxSourceBytes = 512 * 1024 ** 2, maxArtifactBytes = 2 * 1024 ** 3,
  generate = generateCompleteDocumentation } = {}) {
  const readiness = createDocumentationReadinessService(root, { db });
  const assistant = createDocumentAssistantService(root, { db });
  const tokens = createApiTokenService(db), settings = createIntegrationSettingsService(root);
  const owner = crypto.randomUUID();
  const background = new AsyncResource("edoku-export-worker");
  let timer = null, processing = null, stopped = true;
  const pausedProjects=new Map(),pauseKey=(user,project)=>JSON.stringify([user,project]);
  const exists = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documentation_exports'").get());
  function schema() {
    db.exec(`CREATE TABLE IF NOT EXISTS documentation_exports (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, assistant_job_id TEXT,
      origin_token_id TEXT, state TEXT NOT NULL CHECK(state IN('queued','waiting_input','waiting_review','running','succeeded','incomplete','failed','cancelled','stale')),
      attempt INTEGER NOT NULL DEFAULT 0, input_revision TEXT, checkpoint TEXT, result TEXT CHECK(result IS NULL OR json_valid(result)),
      error_code TEXT, lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, next_check_at INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id));`);
  }
  function authorize(userId, projectId) {
    const user = getUserById(userId), project = getProject(userId, projectId);
    if (!user || user.status !== "active" || !project || project.status === "geloescht") throw fault("Projekt wurde nicht gefunden.", 404, "NOT_FOUND");
    return user;
  }
  function rowFor(userId, projectId, exportId) {
    authorize(userId, projectId); parse(id, exportId);
    const row = exists() && db.prepare("SELECT * FROM documentation_exports WHERE id=? AND user_id=? AND project_id=?").get(exportId, userId, projectId);
    if (!row) throw fault("Exportauftrag wurde nicht gefunden.", 404, "NOT_FOUND");
    return row;
  }
  function publicRow(row) {
    const result = row.result ? JSON.parse(row.result) : null;
    return { id: row.id, projectId: row.project_id, assistantJobId: row.assistant_job_id, state: row.state, attempt: row.attempt,
      inputRevision: row.input_revision, createdAt: row.created_at, updatedAt: row.updated_at, errorCode: row.error_code,
      result, files: row.state === "succeeded" ? result?.files || [] : [],
      current: Boolean(row.input_revision && store.projectDataRevision(root, row.user_id, row.project_id) === row.input_revision),
      professionalApproval: "not_assessed" };
  }
  function get(userId, projectId, exportId) { return publicRow(rowFor(userId, projectId, exportId)); }
  function list(userId, projectId) {
    authorize(userId, projectId);
    return exists() ? db.prepare("SELECT * FROM documentation_exports WHERE user_id=? AND project_id=? ORDER BY created_at DESC,id LIMIT 100").all(userId, projectId).map(publicRow) : [];
  }
  function create(userId, projectId, input, { exportId, tokenId = null } = {}) {
    const user = authorize(userId, projectId), parsed = parse(exportJobInput, input);
    if (user.role === "viewer") throw fault("Lesekonten dürfen keine Exporte starten.", 403, "FORBIDDEN");
    if (!store.projectDataRevision(root, userId, projectId)) throw fault("Hintergrundexporte benötigen den aktivierten SQLite-Projektspeicher.", 409, "STORAGE_REQUIRED");
    if (parsed.assistantJobId && assistant.get(userId, parsed.assistantJobId).projectId !== projectId) throw fault("Auftrag wurde nicht gefunden.", 404, "NOT_FOUND");
    schema();
    const identifier = exportId || "exp_" + crypto.randomBytes(12).toString("hex"); parse(id, identifier);
    const result = db.transaction(() => {
      const previous = db.prepare("SELECT * FROM documentation_exports WHERE id=? AND user_id=? AND project_id=?").get(identifier, userId, projectId);
      if (previous) return previous;
      const active = db.prepare("SELECT * FROM documentation_exports WHERE user_id=? AND project_id=? AND assistant_job_id IS ? AND state IN('queued','waiting_input','waiting_review','running') ORDER BY created_at LIMIT 1").get(userId, projectId, parsed.assistantJobId || null);
      if (active) return active;
      if (db.prepare("SELECT count(*) n FROM documentation_exports WHERE user_id=? AND state IN('queued','waiting_input','waiting_review','running')").get(userId).n >= 20) throw fault("Höchstens 20 offene Exportaufträge pro Konto.", 409, "EXPORT_JOB_LIMIT");
      const stamp = new Date(now()).toISOString();
      db.prepare("INSERT INTO documentation_exports(id,user_id,project_id,assistant_job_id,origin_token_id,state,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)").run(identifier, userId, projectId, parsed.assistantJobId || null, tokenId, stamp, stamp);
      return db.prepare("SELECT * FROM documentation_exports WHERE id=?").get(identifier);
    })();
    wake();
    return publicRow(result);
  }
  function cancel(userId, projectId, exportId) {
    const row = rowFor(userId, projectId, exportId);
    if (getUserById(userId).role === "viewer") throw fault("Lesekonten dürfen keine Exporte ändern.", 403, "FORBIDDEN");
    if (!activeStates.includes(row.state)) throw fault("Dieser Exportauftrag läuft nicht mehr.", 409, "EXPORT_TERMINAL");
    db.prepare("UPDATE documentation_exports SET state='cancelled',lease_owner=NULL,lease_until=0,updated_at=? WHERE id=?").run(new Date(now()).toISOString(), row.id);
    return get(userId, projectId, exportId);
  }
  function retry(userId, projectId, exportId, { tokenId = null } = {}) {
    const row = rowFor(userId, projectId, exportId);
    if (getUserById(userId).role === "viewer") throw fault("Lesekonten dürfen keine Exporte ändern.", 403, "FORBIDDEN");
    if (!["failed", "incomplete", "stale", "cancelled"].includes(row.state)) return publicRow(row);
    db.prepare("UPDATE documentation_exports SET state='queued',origin_token_id=?,error_code=NULL,result=NULL,checkpoint=NULL,next_check_at=0,lease_owner=NULL,lease_until=0,updated_at=? WHERE id=? AND state IN('failed','incomplete','stale','cancelled')").run(tokenId, new Date(now()).toISOString(), row.id);
    wake(); return get(userId, projectId, exportId);
  }
  function fingerprint(row) {
    const revision = store.projectDataRevision(root, row.user_id, row.project_id);
    const jobs = row.assistant_job_id ? [assistant.get(row.user_id, row.assistant_job_id)] : assistant.list(row.user_id, row.project_id).filter(job => job.status !== "closed").map(job => assistant.get(row.user_id, job.id));
    return crypto.createHash("sha256").update(JSON.stringify([revision, jobs.map(job => [job.id, job.questions, job.requirements, job.documents.map(document => [document.id, document.state, document.attachmentId, document.sha256])])])).digest("hex");
  }
  async function checkAccess(row) {
    const user = authorize(row.user_id, row.project_id);
    if (user.role === "viewer") throw fault("Berechtigung wurde entzogen.", 403, "ACCESS_REVOKED");
    if (row.origin_token_id) {
      const policy = await settings.read();
      if (!policy.apiEnabled || !policy.allowWrites || !tokens.authorizeId(row.origin_token_id, row.user_id, "exports:write", row.project_id)) throw fault("API-Zugang wurde gesperrt oder ist abgelaufen.", 403, "ACCESS_REVOKED");
    }
  }
  function ownedUpdate(row, state, { result = null, errorCode = null, checkpoint = null, revision = null, nextCheck = 0 } = {}) {
    return db.prepare("UPDATE documentation_exports SET state=?,result=?,error_code=?,checkpoint=?,input_revision=COALESCE(?,input_revision),next_check_at=?,lease_owner=NULL,lease_until=0,updated_at=? WHERE id=? AND lease_owner=? AND state='running'").run(state, result === null ? null : JSON.stringify(result), errorCode, checkpoint, revision, nextCheck, new Date(now()).toISOString(), row.id, owner).changes;
  }
  function assertOwned(row) {
    const current = db.prepare("SELECT state,lease_owner FROM documentation_exports WHERE id=?").get(row.id);
    if (current?.state !== "running" || current.lease_owner !== owner) throw fault("Export wurde abgebrochen oder von einem anderen Prozess übernommen.", 409, "EXPORT_CANCELLED");
  }
  async function sources(data) {
    let size = 0;
    const result = [];
    for (const attachment of data.anhaenge) {
      const file = await resolveAttachmentFile(root, data.files, attachment.relativePath);
      const stat = await fs.stat(file); size += stat.size;
      if (size > maxSourceBytes || result.length >= 1000) throw fault("Die Exportquellen überschreiten das Verarbeitungslimit.", 413, "EXPORT_SOURCE_LIMIT");
      result.push({ attachmentId: attachment.id, bytes: stat.size, sha256: await sha256File(file, stat.size, { maxBytes: maxSourceBytes }) });
    }
    return result;
  }
  async function process(row) {
    const heartbeat = setInterval(() => {
      try { db.prepare("UPDATE documentation_exports SET lease_until=? WHERE id=? AND lease_owner=? AND state='running'").run(now() + leaseMs, row.id, owner); } catch { /* Abschluss benötigt unveränderten Besitz. */ }
    }, Math.max(100, Math.floor(leaseMs / 3)));
    heartbeat.unref();
    try {
      await checkAccess(row);
      const checkpoint = fingerprint(row);
      const status = await readiness.inspect(row.user_id, row.project_id, { assistantJobId: row.assistant_job_id });
      if (!status.canGenerate) {
        ownedUpdate(row, status.reviewComplete ? "waiting_input" : "waiting_review", { result: { readiness: status }, checkpoint, nextCheck: now() + intervalMs });
        return;
      }
      assertOwned(row);
      db.prepare("UPDATE documentation_exports SET attempt=attempt+1 WHERE id=? AND state='running' AND lease_owner=?").run(row.id, owner);
      row.attempt++;
      await checkStorage(row.user_id);
      if (audit) await audit.append({ event: "documentation.background.export", phase: "attempt", requestId: row.id, actorId: row.user_id, actorRole: getUserById(row.user_id).role, projectId: row.project_id, outcome: "attempt" });
      const revision = status.revision;
      const output = await store.withProjectDataTransaction(async () => {
        const data = await loadProjectWorkspace(root, row.user_id, row.project_id);
        store.assertProjectRevision(root, row.user_id, row.project_id, revision);
        bindProjectScope(data.projekt, row.user_id, row.project_id, { outputRunId: `${row.id}_a${row.attempt}` });
        const paths = getProjectPaths(root, data.projekt);
        data.files = { ...data.files, exportliste: path.join(paths.projectPath, "exportliste.json") };
        const sourceManifest = await sources(data);
        assertOwned(row);
        await generate(root, data);
        assertOwned(row);
        const generated = await prepareFinalExport(root, data.projekt, data.matrix, data.files.exportliste, {
          systemSettings: data.systemSettings, brandschutz: data.brandschutz, leistungsbereiche: data.leistungsbereiche,
          report: { formatVersion: 1, exportJobId: row.id, assistantJobId: row.assistant_job_id, projectId: row.project_id, inputRevision: revision,
            generatedAt: new Date(now()).toISOString(), professionalApproval: "not_assessed", requirements: status.requirements, sources: sourceManifest }
        });
        if (JSON.stringify(await sources(data)) !== JSON.stringify(sourceManifest)) throw fault("Eine Quelldatei wurde während der Erzeugung verändert.", 409, "SOURCE_CHANGED");
        store.assertProjectRevision(root, row.user_id, row.project_id, revision);
        return { generated, paths };
      });
      await checkAccess(row);
      if (fingerprint(row) !== checkpoint) throw fault("Der Projekt- oder Freigabestand wurde während des Exports verändert.", 409, "SOURCE_CHANGED");
      if (!output.generated.summary.complete || output.generated.missingFiles.length || output.generated.unassignedFiles.length) {
        if (audit) await audit.append({ event: "documentation.background.export", phase: "result", requestId: row.id, actorId: row.user_id, projectId: row.project_id, outcome: "warning", status: 409 });
        ownedUpdate(row, "incomplete", { revision, result: { summary: output.generated.summary, missingOutputs: output.generated.missingFiles.map(item => ({ id: item.id, title: item.titel, status: item.status })), unassignedFiles: output.generated.unassignedFiles.length, files: [] }, errorCode: "EXPORT_INCOMPLETE" });
        return;
      }
      const files = [];
      for (const [kind, filename] of [["pdf", output.generated.completePdfPath], ["zip", output.generated.zipPath], ["report", output.generated.reportFile]]) {
        const file = await assertSafePath(root, filename, { type: "file" });
        const stat = await fs.stat(file);
        if (stat.size > maxArtifactBytes) throw fault("Die Exportdatei überschreitet das Ausgabelimit.", 413, "EXPORT_ARTIFACT_LIMIT");
        files.push({ kind, name: path.basename(file), bytes: stat.size, sha256: await sha256File(file, stat.size, { maxBytes: maxArtifactBytes }) });
      }
      if (audit) await audit.append({ event: "documentation.background.export", phase: "result", requestId: row.id, actorId: row.user_id, actorRole: getUserById(row.user_id).role, projectId: row.project_id, outcome: "success", status: 200 });
      await checkAccess(row);
      db.transaction(() => {
        store.assertProjectRevision(root, row.user_id, row.project_id, revision);
        assertOwned(row);
        if (fingerprint(row) !== checkpoint) throw fault("Der Freigabestand wurde während des Exports verändert.", 409, "SOURCE_CHANGED");
        ownedUpdate(row, "succeeded", { revision, result: { summary: output.generated.summary, pages: output.generated.completePdfPages, files } });
      })();
    } catch (error) {
      const code = error.apiCode || (error.status === 409 ? "SOURCE_CHANGED" : "EXPORT_FAILED");
      ownedUpdate(row, ["SOURCE_CHANGED", "FILE_CHANGED"].includes(code) ? "stale" : "failed", { errorCode: code });
      if (audit) await audit.append({ event: "documentation.background.export", phase: "result", requestId: row.id, actorId: row.user_id, projectId: row.project_id, outcome: "failure", status: error.status || 500 }).catch(() => {});
    } finally { clearInterval(heartbeat); }
  }
  async function tick() {
    if (stopped || processing || !exists()) return processing;
    processing = (async () => {
      const candidates = db.prepare("SELECT * FROM documentation_exports WHERE (state IN('queued','waiting_input','waiting_review') OR (state='running' AND lease_until<=?)) AND next_check_at<=? ORDER BY created_at,id LIMIT 20").all(now(), now());
      for (const candidate of candidates) {
        if(pausedProjects.has(pauseKey(candidate.user_id,candidate.project_id)))continue;
        if (stopped) return;
        try {
          await checkAccess(candidate);
          if (["waiting_input", "waiting_review"].includes(candidate.state) && candidate.checkpoint === fingerprint(candidate) && now() - Date.parse(candidate.updated_at) < 30000) {
            db.prepare("UPDATE documentation_exports SET next_check_at=? WHERE id=? AND state IN('waiting_input','waiting_review')").run(now() + intervalMs, candidate.id);
            continue;
          }
        } catch { /* Gelöschte Projekte oder entzogene Rechte werden beim Verarbeiten abgewiesen. */ }
        const claimed = db.transaction(() => {
          if (db.prepare("SELECT count(*) n FROM documentation_exports WHERE state='running' AND lease_until>?").get(now()).n >= 2) return null;
          if (db.prepare("SELECT 1 FROM documentation_exports WHERE user_id=? AND state='running' AND lease_until>?").get(candidate.user_id, now())) return null;
          const row = db.prepare("SELECT * FROM documentation_exports WHERE id=?").get(candidate.id);
          if (!activeStates.includes(row.state) || (row.state === "running" && row.lease_until > now())) return null;
          db.prepare("UPDATE documentation_exports SET state='running',lease_owner=?,lease_until=?,updated_at=? WHERE id=?").run(owner, now() + leaseMs, new Date(now()).toISOString(), row.id);
          return db.prepare("SELECT * FROM documentation_exports WHERE id=?").get(row.id);
        })();
        if (claimed) { await process(claimed); return; }
      }
    })();
    try { await processing; } finally { processing = null; }
  }
  const detachedTick = () => background.runInAsyncScope(() => tick().catch(() => {}));
  function wake() { if (!stopped) setImmediate(detachedTick); }
  function start() { if (!stopped) return; stopped = false; timer = setInterval(detachedTick, intervalMs); timer.unref(); wake(); }
  async function stop() { stopped = true; clearInterval(timer); await processing; }
  async function file(userId, projectId, exportId, kind) {
    const row = rowFor(userId, projectId, exportId);
    if (row.state !== "succeeded") throw fault("Dieser Export ist noch nicht vollständig verfügbar.", 409, "EXPORT_NOT_READY");
    const artifact = JSON.parse(row.result).files.find(item => item.kind === kind);
    if (!artifact || path.basename(artifact.name) !== artifact.name) throw fault("Exportdatei wurde nicht gefunden.", 404, "NOT_FOUND");
    const target = path.join(scopedProjectRoot(root, userId, projectId), "output", "runs", `${row.id}_a${row.attempt}`, "06_Final", artifact.name);
    await assertSafePath(root, target, { type: "file" });
    if (await sha256File(target, artifact.bytes, { maxBytes: maxArtifactBytes }) !== artifact.sha256) throw fault("Die Exportdatei hat sich verändert. Bitte erneut erzeugen.", 409, "FILE_CHANGED");
    return { path: target, name: artifact.name };
  }
  async function withProjectPaused(userId,projectId,work){const key=pauseKey(userId,projectId);pausedProjects.set(key,(pausedProjects.get(key)||0)+1);try{await processing;return await work();}finally{const count=pausedProjects.get(key)-1;if(count)pausedProjects.set(key,count);else pausedProjects.delete(key);wake();}}
  return { withProjectPaused, create, get, list, cancel, retry, file, start, stop, tick };
}
module.exports = { createExportJobService };
