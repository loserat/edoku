const crypto = require("node:crypto");
const { tokenInput } = require("../src/api/schemas");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const passwordStamp = user => digest(`${user.password_salt}:${user.password_hash}`);
const invalid = (message, status = 400) => Object.assign(new Error(message), { status });

// Schema erst bei ausdrücklichem Anlegen eines Schlüssels ergänzen. Keine Schlüssel beim Start.
function createApiTokenService(db, { now = Date.now } = {}) {
  const exists = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='api_tokens'").get());
  function schema() {
    db.exec(`CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, password_stamp TEXT NOT NULL,
      scopes TEXT NOT NULL CHECK(json_valid(scopes)), project_ids TEXT CHECK(project_ids IS NULL OR json_valid(project_ids)),
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
    )`);
  }
  function publicToken(row) {
    return { id: row.id, name: row.name, scopes: JSON.parse(row.scopes),
      projectIds: row.project_ids === null ? null : JSON.parse(row.project_ids),
      createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at };
  }
  function create(userId, input) {
    const parsed = tokenInput.safeParse(input);
    if (!parsed.success) throw invalid("Name, Rechte, Projektzuordnung oder Gültigkeit sind ungültig.");
    const value = parsed.data, user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    if (!user || user.status !== "active") throw invalid("Kein aktives Benutzerkonto.", 403);
    if (user.role === "viewer" && value.scopes.some(scope => scope.endsWith(":write"))) throw invalid("Viewer dürfen keine Schreibrechte vergeben.", 403);
    if (value.projectIds?.some(project => !db.prepare("SELECT 1 FROM projects WHERE user_id=? AND id=? AND status<>'geloescht'").get(userId, project))) throw invalid("Projekt wurde nicht gefunden.", 404);
    const id = crypto.randomBytes(12).toString("hex");
    const token = `edoku_${id}.${crypto.randomBytes(32).toString("hex")}`;
    schema();
    if (db.prepare("SELECT count(*) AS n FROM api_tokens WHERE user_id=? AND revoked_at IS NULL AND expires_at>?").get(userId, new Date(now()).toISOString()).n >= 50) throw invalid("Höchstens 50 aktive API-Schlüssel pro Konto.", 409);
    db.prepare("INSERT INTO api_tokens(id,user_id,name,token_hash,password_stamp,scopes,project_ids,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)").run(
      id, userId, value.name, digest(token), passwordStamp(user), JSON.stringify([...new Set(value.scopes)]),
      value.projectIds === null ? null : JSON.stringify([...new Set(value.projectIds)]),
      new Date(now()).toISOString(), new Date(now() + value.days * 86400000).toISOString());
    return { ...publicToken(db.prepare("SELECT * FROM api_tokens WHERE id=?").get(id)), token };
  }
  function list(userId) {
    if (!exists()) return [];
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    return db.prepare("SELECT * FROM api_tokens WHERE user_id=? ORDER BY created_at DESC,id").all(userId).map(row => ({
      ...publicToken(row),
      state: row.revoked_at ? "revoked" : Date.parse(row.expires_at) <= now() ? "expired"
        : !user || user.status !== "active" ? "disabled"
          : row.password_stamp !== passwordStamp(user) ? "password_changed" : "active"
    }));
  }
  function revoke(userId, id) {
    if (!exists() || !db.prepare("UPDATE api_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND user_id=?").run(new Date(now()).toISOString(), id, userId).changes) throw invalid("Schlüssel wurde nicht gefunden.", 404);
  }
  function authenticate(token) {
    if (!/^edoku_[a-f0-9]{24}\.[a-f0-9]{64}$/.test(token || "") || !exists()) return null;
    const row = db.prepare("SELECT * FROM api_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?").get(digest(token), new Date(now()).toISOString());
    if (!row) return null;
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(row.user_id);
    if (!user || user.status !== "active" || row.password_stamp !== passwordStamp(user)) return null;
    return { user: { id: user.id, role: user.role, status: user.status }, token: publicToken(row) };
  }
  function authorizeId(tokenId, userId, requiredScope, projectId) {
    if (!exists()) return false;
    const row = db.prepare("SELECT * FROM api_tokens WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?").get(tokenId, userId, new Date(now()).toISOString());
    const user = row && db.prepare("SELECT * FROM users WHERE id=?").get(userId);
    if (!row || !user || user.status !== "active" || user.role === "viewer" || row.password_stamp !== passwordStamp(user)) return false;
    const token = publicToken(row);
    return token.scopes.includes(requiredScope) && (token.projectIds === null || token.projectIds.includes(projectId));
  }
  return { create, list, revoke, authenticate, authorizeId };
}

module.exports = { createApiTokenService };
