const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { assertSafePath } = require("./pathService");

const ACTIONS = new Map([
  ["/login", "login"], ["/register", "registration"], ["/logout", "logout"],
  ["/projekte", "project.create"], ["/projektarchiv/exportieren", "archive.export"],
  ["/projektarchiv/importieren", "archive.import"], ["/projektarchiv/validieren", "archive.validate"],
  ["/einstellungen/benutzer", "account.create"], ["/export/final", "documentation.export"]
]);
function actionFor(req) {
  if (req.assistantAuditEvent) return req.assistantAuditEvent;
  if (req.method === "POST" && /^\/api\/v1\/projects\/[^/]+\/export-jobs(?:\/|$)/.test(req.originalUrl || "")) return "documentation.background.request";
  if (req.method === "POST" && /^\/api\/v1\/projects(?:\?|$)/.test(req.originalUrl || "")) return "api.project.create";
  if (["PATCH", "POST"].includes(req.method) && /^\/api\/v1\/projects\/[^/]+\/assistant\//.test(req.originalUrl || "")) return "assistant.agent.prepare";
  if (["PATCH", "POST"].includes(req.method) && /^\/api\/v1\/projects\//.test(req.originalUrl || "")) return "api.project.change";
  if (req.method === "POST" && req.path === "/integrationen/schluessel") return "api.token.create";
  if (req.method === "POST" && /^\/integrationen\/schluessel\/[^/]+\/widerrufen$/.test(req.path)) return "api.token.revoke";
  if (req.method !== "POST") return "";
  if (ACTIONS.has(req.path)) return ACTIONS.get(req.path);
  const account = req.path.match(/^\/einstellungen\/benutzer\/[^/]+\/(rolle|status|passwort)$/);
  if (account) return { rolle: "account.role", status: "account.status", passwort: "account.password" }[account[1]];
  const project = req.path.match(/^\/projekte\/[^/]+\/(oeffnen|archivieren|loeschen|exportieren)$/);
  if (project) return { oeffnen: "project.open", archivieren: "project.archive", loeschen: "project.delete", exportieren: "archive.export" }[project[1]];
  if (req.path.startsWith("/einstellungen/")) return "settings.change";
  if (/^\/anhaenge\/[^/]+\/loeschen$/.test(req.path)) return "attachment.delete";
  return "";
}
const id = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null;
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function createAuditService(rootDir, { resolveTarget = () => null, maxFileBytes = 4 * 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 256 || maxFileBytes > 64 * 1024 * 1024) throw new Error("Ungültige Protokollsegmentgröße.");
  const directory = path.join(rootDir, "storage", "audit");
  const file = path.join(directory, "events.jsonl");
  const archive = path.join(directory, "archive");
  let queue = Promise.resolve(), state = null;
  const signature = stat => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
  async function fileState(name) {
    await assertSafePath(rootDir, name, { allowMissing: true, type: "file" });
    try { const stat = await fs.stat(name, { bigint: true }); return { file: name, signature: signature(stat), bytes: Number(stat.size) }; }
    catch (error) { if (error.code === "ENOENT") return { file: name, signature: null, bytes: 0 }; throw error; }
  }
  async function sources() {
    await assertSafePath(rootDir, archive, { allowMissing: true, type: "directory" });
    let names;
    try { names = (await fs.readdir(archive)).filter(name => /^events-\d{12}\.jsonl$/.test(name)).sort(); }
    catch (error) { if (error.code !== "ENOENT") throw error; names = []; }
    for (let i = 0; i < names.length; i++) if (names[i] !== `events-${String(i + 1).padStart(12, "0")}.jsonl`) throw new Error("Ein archiviertes Protokollsegment fehlt.");
    return Promise.all([...names.map(name => path.join(archive, name)), file].map(fileState));
  }
  const sameSources = (left, right) => left.length === right.length && left.every((item, i) => item.file === right[i].file && item.signature === right[i].signature);
  async function verify({ limit = Infinity } = {}) {
    if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 0)) throw new Error("Ungültige Protokollauswahl.");
    const before = await sources(), records = [];
    let previous = "0".repeat(64), count = 0;
    // Historische Segmente vollständig prüfen, für die Anzeige aber nur den gewünschten
    // Ausschnitt im Speicher halten. Alte Protokolle bleiben bytegetreu erhalten.
    for (const source of before) {
      if (!source.signature) continue;
      let pending = "";
      for await (const chunk of require("node:fs").createReadStream(source.file, { encoding: "utf8" })) {
        pending += chunk;
        let end;
        while ((end = pending.indexOf("\n")) !== -1) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (!line || Buffer.byteLength(line) > 16384) throw new Error("Ungültiger Protokolleintrag.");
          const record = JSON.parse(line), { hash: digest, ...entry } = record;
          if (entry.previous !== previous || digest !== hash(entry)) throw new Error("Die Verkettung des Sicherheitsprotokolls ist beschädigt.");
          previous = digest; count++;
          if (limit) { records.push(record); if (records.length > limit) records.shift(); }
        }
        if (Buffer.byteLength(pending) > 16384) throw new Error("Ungültiger Protokolleintrag.");
      }
      if (pending) throw new Error("Das Sicherheitsprotokoll ist unvollständig. Änderungen wurden vorsorglich angehalten.");
    }
    if (!sameSources(before, await sources())) throw new Error("Das Sicherheitsprotokoll wurde während der Prüfung verändert.");
    state = { sources: before, previous, count };
    return records;
  }
  async function ensureVerified() {
    if (!state || !sameSources(state.sources, await sources())) await verify({ limit: 0 });
  }
  function append(input) {
    const task = queue.catch(() => {}).then(async () => {
      try {
        await ensureVerified();
        // Strikte Positivliste: keine Zugangsdaten, Formularinhalte oder URLs speichern.
        const entry = {
          version: 1, time: new Date().toISOString(), event: String(input.event).slice(0,60),
          phase: input.phase === "attempt" ? "attempt" : "result", requestId: id(input.requestId),
          actorId: id(input.actorId), actorRole: ["viewer","user","admin","systemadmin"].includes(input.actorRole) ? input.actorRole : null,
          projectId: id(input.projectId), targetId: id(input.targetId),
          outcome: ["attempt","success","warning","failure","interrupted"].includes(input.outcome) ? input.outcome : "failure",
          status: Number.isInteger(input.status) ? input.status : null, previous: state.previous
        };
        const digest = hash(entry), line = JSON.stringify({ ...entry, hash: digest }) + "\n";
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        let active = state.sources.at(-1);
        if (active.bytes && active.bytes + Buffer.byteLength(line) > maxFileBytes) {
          await fs.mkdir(archive, { recursive: true, mode: 0o700 });
          const target = path.join(archive, `events-${String(state.sources.length).padStart(12, "0")}.jsonl`);
          await assertSafePath(rootDir, target, { allowMissing: true });
          try { await fs.lstat(target); throw new Error("Archiviertes Protokoll wird nicht überschrieben."); }
          catch (error) { if (error.code !== "ENOENT") throw error; }
          await fs.rename(file, target);
          state.sources = [...state.sources.slice(0, -1), await fileState(target), await fileState(file)];
          active = state.sources.at(-1);
        }
        await assertSafePath(rootDir, file, { allowMissing: true });
        const handle = await fs.open(file, require("node:fs").constants.O_WRONLY | require("node:fs").constants.O_APPEND | require("node:fs").constants.O_CREAT | require("node:fs").constants.O_NOFOLLOW, 0o600);
        let nextActive;
        try {
          const opened = await handle.stat({ bigint: true });
          if (active.signature ? signature(opened) !== active.signature : opened.size !== 0n) throw new Error("Das Sicherheitsprotokoll wurde außerhalb des Schreibers verändert.");
          await handle.writeFile(line, "utf8"); await handle.sync();
          const stat = await handle.stat({ bigint: true });
          nextActive = { file, signature: signature(stat), bytes: Number(stat.size) };
        } finally { await handle.close(); }
        const expected = [...state.sources.slice(0, -1), nextActive];
        if (!sameSources(expected, await sources())) throw new Error("Das Sicherheitsprotokoll wurde während des Schreibens verändert.");
        state = { sources: expected, previous: digest, count: state.count + 1 };
      } catch (error) { state = null; throw error; }
    });
    queue = task;
    return task;
  }
  function middleware(req, res, next) {
    const event = actionFor(req);
    if (!event) return next();
    const context = { event, requestId: req.apiRequestId || crypto.randomUUID(), actorId: req.user?.id, actorRole: req.user?.role, projectId: req.user?.currentProjectId };
    let outcome = "success", completed = false;
    const originalJson = res.json.bind(res), originalRedirect = res.redirect.bind(res);
    function captureTarget() { const target = resolveTarget(req); if (target) context.targetId = target; }
    res.json = body => { captureTarget(); if (body?.ok === false) outcome = "failure"; return originalJson(body); };
    res.redirect = (...args) => {
      captureTarget();
      const destination = args.at(-1);
      if (typeof destination === "string") {
        const query = new URL(destination,"http://local.invalid").searchParams;
        if (query.has("error")) outcome = "failure";
        else if (query.has("warning")) outcome = "warning";
      }
      return originalRedirect(...args);
    };
    function finish(interrupted) {
      if (completed) return;
      completed = true;
      append({ ...context, ...res.locals.auditIdentity, phase: "result", status: res.statusCode,
        outcome: interrupted ? "interrupted" : res.statusCode >= 400 ? "failure" : outcome
      }).catch(() => console.error("Abschluss des Sicherheitsprotokolls konnte nicht geschrieben werden; der Versuchsdatensatz bleibt erhalten."));
    }
    append({ ...context, phase: "attempt", outcome: "attempt" }).then(() => {
      res.once("finish", () => finish(false));
      res.once("close", () => finish(!res.writableFinished));
      next();
    }).catch(() => next(Object.assign(new Error("Sicherheitsprotokoll nicht verfügbar. Bitte die Protokollablage prüfen; die Aktion wurde nicht ausgeführt."), { status: 503 })));
  }
  function read(options) {
    const task = queue.catch(() => {}).then(() => verify(options));
    queue = task;
    return task;
  }
  return { append, middleware, read, flush: () => queue.catch(() => {}) };
}

module.exports = { createAuditService, actionFor };
