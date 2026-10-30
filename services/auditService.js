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

function createAuditService(rootDir, { resolveTarget = () => null } = {}) {
  const file = path.join(rootDir, "storage", "audit", "events.jsonl");
  let queue = Promise.resolve();
  async function read() {
    await assertSafePath(rootDir, file, { allowMissing: true });
    let content;
    try { content = await fs.readFile(file, "utf8"); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    if (content && !content.endsWith("\n")) throw new Error("Das Sicherheitsprotokoll ist unvollständig. Änderungen wurden vorsorglich angehalten.");
    const records = content ? content.trimEnd().split("\n").map(line => JSON.parse(line)) : [];
    let previous = "0".repeat(64);
    for (const record of records) {
      const { hash: digest, ...entry } = record;
      if (entry.previous !== previous || digest !== hash(entry)) throw new Error("Die Verkettung des Sicherheitsprotokolls ist beschädigt.");
      previous = digest;
    }
    return records;
  }
  function append(input) {
    const task = queue.catch(() => {}).then(async () => {
      const records = await read();
      // Strikte Positivliste: niemals Request-Body, URL, Cookies oder frei übergebene Metadaten speichern.
      const entry = {
        version: 1, time: new Date().toISOString(), event: String(input.event).slice(0,60),
        phase: input.phase === "attempt" ? "attempt" : "result", requestId: id(input.requestId),
        actorId: id(input.actorId), actorRole: ["viewer","user","admin","systemadmin"].includes(input.actorRole) ? input.actorRole : null,
        projectId: id(input.projectId), targetId: id(input.targetId),
        outcome: ["attempt","success","warning","failure","interrupted"].includes(input.outcome) ? input.outcome : "failure",
        status: Number.isInteger(input.status) ? input.status : null,
        previous: records.at(-1)?.hash || "0".repeat(64)
      };
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await assertSafePath(rootDir, file, { allowMissing: true });
      const handle = await fs.open(file, "a", 0o600);
      try { await handle.writeFile(JSON.stringify({ ...entry, hash: hash(entry) }) + "\n"); await handle.sync(); }
      finally { await handle.close(); }
    });
    queue = task;
    return task;
  }
  function middleware(req, res, next) {
    const event = actionFor(req);
    if (!event) return next();
    const context = { event, requestId: crypto.randomUUID(), actorId: req.user?.id, actorRole: req.user?.role, projectId: req.user?.currentProjectId };
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
  return { append, middleware, read: async () => { await queue.catch(() => {}); return read(); }, flush: () => queue.catch(() => {}) };
}

module.exports = { createAuditService, actionFor };
