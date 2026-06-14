const crypto = require("crypto");
const {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsForUser,
  getSession,
  getUserByEmail,
  getUserById,
  normalizeUserRole
} = require("./dbService");
const { sanitizeId } = require("./pathService");

const SESSION_COOKIE = "dm_session";
const SESSION_DAYS = 14;

// * INFO: Erzeugt kryptografisch zufällige Tokens für Sessions und User-IDs.
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// ! WICHTIG: Passwort-Hashing mit scrypt. Salt und Hash werden getrennt in SQLite gespeichert.
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

// ! WICHTIG: Timing-sicherer Passwortvergleich gegen den gespeicherten Hash.
function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(expectedHash, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// ! WICHTIG: Cookie-Einstellungen für die lokale Session. httpOnly verhindert Zugriff per Frontend-JS.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  };
}

// * INFO: Stabile, aber nicht erratbare User-ID aus Loginname und Zufallsanteil.
function createUserId(email) {
  return `user_${sanitizeId(email.split("@")[0], "konto")}_${randomToken(4)}`;
}

// * INFO: Registriert einen Benutzer und legt ihn in der lokalen SQLite-Datenbank an.
function registerUser({ email, name, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");
  }
  if (!String(password || "").trim() || String(password).length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  }
  if (getUserByEmail(normalizedEmail)) {
    throw new Error("Diese E-Mail-Adresse ist bereits registriert.");
  }

  const { salt, hash } = hashPassword(password);
  const timestamp = new Date().toISOString();
  const user = {
    id: createUserId(normalizedEmail),
    email: normalizedEmail,
    name: String(name || "").trim() || normalizedEmail,
    role: "user",
    status: "active",
    passwordHash: hash,
    passwordSalt: salt,
    currentProjectId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  createUser(user);
  return getUserById(user.id);
}

// * INFO: Prüft Login-Daten und liefert den Benutzer für die Session-Erstellung zurück.
function loginUser(email, password) {
  const user = getUserByEmail(normalizeEmail(email));
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error("E-Mail-Adresse oder Passwort ist falsch.");
  }
  if (user.status === "disabled") {
    throw new Error("Dieses Benutzerkonto ist gesperrt.");
  }
  return user;
}

// * INFO: Startet eine neue Server-Session und setzt das Session-Cookie im Browser.
function startSession(res, userId) {
  deleteExpiredSessions();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  createSession(token, userId, expiresAt);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

// * INFO: Beendet die Session serverseitig und entfernt das Cookie.
function endSession(req, res) {
  if (req.cookies && req.cookies[SESSION_COOKIE]) {
    deleteSession(req.cookies[SESSION_COOKIE]);
  }
  res.clearCookie(SESSION_COOKIE);
}

// * INFO: Minimaler Cookie-Parser ohne zusätzliche Middleware-Abhängigkeit.
function parseCookies(req, res, next) {
  const header = req.headers.cookie || "";
  req.cookies = Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
  next();
}

// * INFO: Hängt den angemeldeten Benutzer an req/res.locals, falls die Session gültig ist.
function attachUser(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : "";
  const session = token ? getSession(token) : null;
  if (session && new Date(session.expires_at) > new Date() && session.status !== "disabled") {
    req.user = {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: normalizeUserRole(session.role),
      status: session.status || "active",
      currentProjectId: session.current_project_id
    };
    res.locals.user = req.user;
  } else if (token) {
    deleteSession(token);
  }
  next();
}

// ! WICHTIG: Route-Guard für alle geschützten Seiten und Dateioperationen.
function requireAuth(req, res, next) {
  if (!req.user) {
    res.redirect(`/login?error=${encodeURIComponent("Bitte zuerst anmelden.")}`);
    return;
  }
  next();
}

function requireSystemAdmin(req, res, next) {
  if (!req.user) {
    res.redirect(`/login?error=${encodeURIComponent("Bitte zuerst anmelden.")}`);
    return;
  }
  if (req.user.role !== "systemadmin") {
    res.status(403).send("Zugriff nur für Systemadmins.");
    return;
  }
  next();
}

// ! WICHTIG: Viewer dürfen nur lesen; alle schreibenden Methoden werden serverseitig blockiert.
function blockViewerWrites(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.user && req.user.role === "viewer") {
    res.status(403).send("Viewer dürfen keine Änderungen speichern.");
    return;
  }
  next();
}

module.exports = {
  attachUser,
  blockViewerWrites,
  deleteSessionsForUser,
  endSession,
  loginUser,
  parseCookies,
  registerUser,
  requireAuth,
  requireSystemAdmin,
  startSession
};
