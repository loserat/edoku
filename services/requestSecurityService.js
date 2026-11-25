const crypto = require("crypto");

function forbidden(message) { return Object.assign(new Error(message), { status: 403 }); }
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function installAsyncHandlers(app, { runHeavy } = {}) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const original = app[method].bind(app);
    app[method] = (route, ...handlers) => original(route, ...handlers.map(handler => {
      if (typeof handler !== "function" || handler.constructor.name !== "AsyncFunction") return handler;
      return (req, res, next) => Promise.resolve().then(() => runHeavy
        ? runHeavy(req, () => handler(req, res, next))
        : handler(req, res, next)).catch(next);
    }));
  }
}

// Signierter, an die Sitzung gebundener Token. Keine Änderung bestehender Konten/Sitzungen.
function createCsrfProtection(secret = crypto.randomBytes(32)) {
  return (req, res, next) => {
    try {
      const cookieName = "edoku_csrf_" + crypto.createHash("sha256").update(req.get("host") || "localhost").digest("hex").slice(0, 12);
      let seed = req.cookies?.[cookieName];
      if (!/^[a-f0-9]{64}$/.test(seed || "")) {
        seed = crypto.randomBytes(32).toString("hex");
        res.cookie(cookieName, seed, { httpOnly: true, sameSite: "strict", secure: req.secure, path: "/" });
      }
      const session = req.cookies?.[process.env.SESSION_COOKIE_NAME || "dm_session"] || "";
      const expected = crypto.createHmac("sha256", secret).update(seed.length + ":" + seed + ":" + session).digest("hex");
      res.locals.csrfToken = expected;
      if (safeMethods.has(req.method)) return next();
      const token = req.get("x-csrf-token") || req.multipartUpload?.fields?._csrf || req.body?._csrf;
      const origin = req.get("origin");
      const targetOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
      if (req.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(targetOrigin).origin)) throw forbidden("Anfrage von einer anderen Website abgewiesen.");
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw forbidden("Die Sicherheitsprüfung ist abgelaufen. Bitte die Seite neu laden und erneut speichern.");
      // Der Token gehört zur Anfrage und darf nicht durch allgemeine Formularspeicherung persistiert werden.
      if (req.body && !Buffer.isBuffer(req.body)) delete req.body._csrf;
      if (req.multipartUpload?.fields) delete req.multipartUpload.fields._csrf;
      next();
    } catch (error) { next(error); }
  };
}

function createAuthLimiter({ maxFailures = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const failures = new Map(), registrations = new Map();
  function entries(map, key, window) {
    for (const [k,v] of map) if (v.expires <= now()) map.delete(k);
    if (!map.has(key)) {
      if (map.size >= 10000) throw Object.assign(new Error("Zu viele Anfragen. Bitte später erneut versuchen."), { status: 429 });
      map.set(key, { count: 0, expires: now() + window });
    }
    return map.get(key);
  }
  const keys = req => ["ip:" + req.ip, "login:" + crypto.createHash("sha256").update(String(req.body?.email || "").trim().toLowerCase()).digest("hex")];
  function limited(res, expires) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((expires - now()) / 1000))));
    return Object.assign(new Error("Zu viele Anmeldeversuche. Bitte nach der Wartezeit erneut versuchen."), { status: 429 });
  }
  return {
    check(req,res,next) {
      try { const [ip,login] = keys(req).map(key => entries(failures,key,windowMs));
        if (ip.count >= maxFailures * 3 || login.count >= maxFailures) throw limited(res, Math.max(ip.expires,login.expires));
        next();
      } catch(error) { next(error); }
    },
    failed(req) { for (const key of keys(req)) entries(failures,key,windowMs).count++; },
    succeeded(req) { failures.delete(keys(req)[1]); },
    registration(req,res,next) {
      try { const record = entries(registrations,req.ip,60*60*1000); if (record.count++ >= 10) throw limited(res,record.expires); next(); }
      catch(error) { next(error); }
    }
  };
}

// Vor Body-Parsern, Passwortprüfung und Protokollschreiben begrenzen.
function createRequestLimiter({ windowMs = 60000, maxReads = 300, maxWrites = 60, maxClients = 10000, now = Date.now } = {}) {
  const clients = new Map();
  let nextCleanup = 0;
  return (req, res, next) => {
    if (req.path === "/ready" && safeMethods.has(req.method)) return next();
    const time = now();
    if (time >= nextCleanup) {
      for (const [key, value] of clients) if (value.expires <= time) clients.delete(key);
      nextCleanup = time + Math.min(windowMs, 1000);
    }
    let record = clients.get(req.ip);
    if (record?.expires <= time) { clients.delete(req.ip); record = null; }
    if (!record && clients.size < maxClients) {
      record = { reads: 0, writes: 0, expires: time + windowMs };
      clients.set(req.ip, record);
    }
    const key = safeMethods.has(req.method) ? "reads" : "writes";
    if (!record || ++record[key] > (key === "reads" ? maxReads : maxWrites)) {
      res.set("Retry-After", String(Math.max(1, Math.ceil(((record?.expires || time + windowMs) - time) / 1000))));
      return next(Object.assign(new Error("Zu viele Anfragen. Bitte kurz warten und erneut versuchen."), { status: 429 }));
    }
    next();
  };
}

// Keine unbeschränkte Warteschlange. Auch bei Verbindungsabbruch bis zum tatsächlichen
// Ende der Arbeit reservieren, damit abgebrochene Anfragen die Grenze nicht umgehen.
function createResourceGuard({ maxActive = 2, maxPerUser = 1, checkStorage = async () => {} } = {}) {
  let active = 0;
  const users = new Map();
  return async (req, task) => {
    const heavy = req.method === "POST" && (req.path.startsWith("/export/")
      || /^\/projektarchiv\/(exportieren|validieren|importieren)$/.test(req.path)
      || /^\/projekte\/[^/]+\/exportieren$/.test(req.path) || req.path === "/anhaenge/upload");
    if (!heavy) return task();
    const user = req.user?.id;
    if (!user) throw Object.assign(new Error("Bitte zuerst anmelden."), { status: 401 });
    const count = users.get(user) || 0;
    if (active >= maxActive || count >= maxPerUser) throw Object.assign(new Error("Eine aufwendige Verarbeitung läuft bereits. Bitte nach Abschluss erneut versuchen."), { status: 429 });
    active++; users.set(user, count + 1);
    try {
      const incoming = req.multipartUpload?.files?.reduce((sum, file) => sum + file.buffer.length, 0) || 0;
      await checkStorage(user, incoming);
      return await task();
    }
    finally { active--; const left = users.get(user) - 1; if (left) users.set(user, left); else users.delete(user); }
  };
}

function createBodyLimiter({ maxActive = 8, maxPerIp = 2 } = {}) {
  let active = 0;
  const clients = new Map();
  return (req, res, next) => {
    if (safeMethods.has(req.method)) return next();
    const count = clients.get(req.ip) || 0;
    if (active >= maxActive || count >= maxPerIp) {
      res.set("Retry-After", "1");
      return next(Object.assign(new Error("Zu viele gleichzeitige Schreibanfragen. Bitte kurz warten."), { status: 429 }));
    }
    active++; clients.set(req.ip, count + 1);
    let finished = false;
    const release = () => {
      if (finished) return;
      finished = true; active--;
      const left = clients.get(req.ip) - 1;
      if (left) clients.set(req.ip, left); else clients.delete(req.ip);
    };
    res.once("finish", release); res.once("close", release);
    next();
  };
}

module.exports = { installAsyncHandlers, createCsrfProtection, createAuthLimiter, createRequestLimiter, createResourceGuard, createBodyLimiter };
