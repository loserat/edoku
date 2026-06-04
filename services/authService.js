const crypto = require("crypto");
const {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  getSession,
  getUserByEmail,
  getUserById
} = require("./dbService");
const { sanitizeId } = require("./pathService");

const SESSION_COOKIE = "dm_session";
const SESSION_DAYS = 14;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(expectedHash, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  };
}

function createUserId(email) {
  return `user_${sanitizeId(email.split("@")[0], "konto")}_${randomToken(4)}`;
}

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
    passwordHash: hash,
    passwordSalt: salt,
    currentProjectId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  createUser(user);
  return getUserById(user.id);
}

function loginUser(email, password) {
  const user = getUserByEmail(normalizeEmail(email));
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error("E-Mail-Adresse oder Passwort ist falsch.");
  }
  return user;
}

function startSession(res, userId) {
  deleteExpiredSessions();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  createSession(token, userId, expiresAt);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

function endSession(req, res) {
  if (req.cookies && req.cookies[SESSION_COOKIE]) {
    deleteSession(req.cookies[SESSION_COOKIE]);
  }
  res.clearCookie(SESSION_COOKIE);
}

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

function attachUser(req, res, next) {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : "";
  const session = token ? getSession(token) : null;
  if (session && new Date(session.expires_at) > new Date()) {
    req.user = {
      id: session.user_id,
      email: session.email,
      name: session.name,
      currentProjectId: session.current_project_id
    };
    res.locals.user = req.user;
  } else if (token) {
    deleteSession(token);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    res.redirect(`/login?error=${encodeURIComponent("Bitte zuerst anmelden.")}`);
    return;
  }
  next();
}

module.exports = {
  attachUser,
  endSession,
  loginUser,
  parseCookies,
  registerUser,
  requireAuth,
  startSession
};
