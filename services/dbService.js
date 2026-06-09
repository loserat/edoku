const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db;
const USER_ROLES = ["viewer", "user", "admin", "systemadmin"];

// Einheitliches ISO-Zeitformat für Datenbank-Metadaten.
function nowIso() {
  return new Date().toISOString();
}

/**
 * Initialisiert die lokale SQLite-Datenbank.
 * Enthält nur Benutzer, Sessions und Projektregister; fachliche Projektdaten
 * bleiben weiterhin dateibasiert in JSON-Dateien.
 */
function initDatabase(storageDir) {
  fs.mkdirSync(storageDir, { recursive: true });
  db = new Database(path.join(storageDir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      current_project_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aktiv',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_project_id TEXT,
      PRIMARY KEY (id, user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const userColumns = connection().prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  if (!userColumns.includes("role")) {
    connection().prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
  }
  if (!userColumns.includes("status")) {
    connection().prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run();
  }

  return db;
}

// Liefert die aktive DB-Verbindung und verhindert Zugriffe vor initDatabase().
function connection() {
  if (!db) throw new Error("Datenbank wurde nicht initialisiert.");
  return db;
}

// Benutzerabfragen werden case-insensitive über die E-Mail bzw. Loginkennung ausgeführt.
function getUserByEmail(email) {
  return connection().prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

function getUserById(userId) {
  return connection().prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function createUser(user) {
  connection().prepare(`
    INSERT INTO users (id, email, name, role, status, password_hash, password_salt, current_project_id, created_at, updated_at)
    VALUES (@id, @email, @name, @role, @status, @passwordHash, @passwordSalt, @currentProjectId, @createdAt, @updatedAt)
  `).run({ ...user, role: normalizeUserRole(user.role), status: normalizeUserStatus(user.status) });
}

function createSession(token, userId, expiresAt) {
  connection().prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt, nowIso());
}

function getSession(token) {
  return connection().prepare(`
    SELECT sessions.token, sessions.user_id, sessions.expires_at, users.email, users.name, users.role, users.status, users.current_project_id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);
}

function normalizeUserRole(role) {
  return USER_ROLES.includes(role) ? role : "user";
}

function normalizeUserStatus(status) {
  return status === "disabled" ? "disabled" : "active";
}

function listUsers() {
  return connection().prepare(`
    SELECT id, email, name, role, status, current_project_id AS currentProjectId, created_at AS createdAt, updated_at AS updatedAt
    FROM users
    ORDER BY
      CASE status
        WHEN 'active' THEN 1
        ELSE 2
      END,
      CASE role
        WHEN 'systemadmin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'user' THEN 3
        ELSE 4
      END,
      lower(name)
  `).all();
}

function updateUserRole(userId, role) {
  connection().prepare(`
    UPDATE users
    SET role = ?, updated_at = ?
    WHERE id = ?
  `).run(normalizeUserRole(role), nowIso(), userId);
}

function updateUserStatus(userId, status) {
  connection().prepare(`
    UPDATE users
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(normalizeUserStatus(status), nowIso(), userId);
}

function updateUserPassword(userId, passwordHash, passwordSalt) {
  connection().prepare(`
    UPDATE users
    SET password_hash = ?, password_salt = ?, updated_at = ?
    WHERE id = ?
  `).run(passwordHash, passwordSalt, nowIso(), userId);
}

function deleteSession(token) {
  connection().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function deleteSessionsForUser(userId) {
  connection().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

function deleteExpiredSessions() {
  connection().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

// Projektregister pro Benutzer. Die eigentlichen Projektinhalte liegen in storage/users/...
function listProjectsForUser(userId) {
  return connection().prepare(`
    SELECT id, user_id AS userId, status, created_at AS erstelltAm, updated_at AS geaendertAm, original_project_id AS originalProjectId
    FROM projects
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId);
}

function getProject(userId, projectId) {
  return connection().prepare(`
    SELECT id, user_id AS userId, status, created_at AS erstelltAm, updated_at AS geaendertAm, original_project_id AS originalProjectId
    FROM projects
    WHERE user_id = ? AND id = ?
  `).get(userId, projectId);
}

// Fügt ein Projektregister hinzu oder aktualisiert vorhandene Metadaten.
function upsertProject(project) {
  const existing = getProject(project.userId, project.id);
  if (existing) {
    connection().prepare(`
      UPDATE projects
      SET status = COALESCE(@status, status),
          updated_at = @updatedAt,
          original_project_id = COALESCE(@originalProjectId, original_project_id)
      WHERE user_id = @userId AND id = @id
    `).run({
      id: project.id,
      userId: project.userId,
      status: project.status || existing.status,
      updatedAt: project.updatedAt || nowIso(),
      originalProjectId: project.originalProjectId || existing.originalProjectId
    });
    return;
  }

  const timestamp = nowIso();
  connection().prepare(`
    INSERT INTO projects (id, user_id, status, created_at, updated_at, original_project_id)
    VALUES (@id, @userId, @status, @createdAt, @updatedAt, @originalProjectId)
  `).run({
    id: project.id,
    userId: project.userId,
    status: project.status || "aktiv",
    createdAt: project.createdAt || timestamp,
    updatedAt: project.updatedAt || timestamp,
    originalProjectId: project.originalProjectId || null
  });
}

function updateProjectStatus(userId, projectId, status) {
  connection().prepare(`
    UPDATE projects
    SET status = ?, updated_at = ?
    WHERE user_id = ? AND id = ?
  `).run(status, nowIso(), userId, projectId);
}

function getCurrentProjectId(userId) {
  const user = getUserById(userId);
  return user ? user.current_project_id : "";
}

function setCurrentProjectId(userId, projectId) {
  connection().prepare(`
    UPDATE users
    SET current_project_id = ?, updated_at = ?
    WHERE id = ?
  `).run(projectId, nowIso(), userId);
}

// Einmalige Migration aus einer älteren JSON-basierten Projektliste.
// Fehler werden nur protokolliert, damit die App weiter starten kann.
function migrateProjectsJson(rootDir) {
  const filePath = path.join(rootDir, "storage", "projects.json");
  if (!fs.existsSync(filePath)) return;

  try {
    const projects = JSON.parse(fs.readFileSync(filePath, "utf8"));
    projects.forEach((project) => {
      if (!project.id || !project.userId || !getUserById(project.userId)) return;
      upsertProject({
        id: project.id,
        userId: project.userId,
        status: project.status || "aktiv",
        createdAt: project.erstelltAm || nowIso(),
        updatedAt: project.geaendertAm || nowIso(),
        originalProjectId: project.originalProjectId || null
      });
    });
  } catch (error) {
    console.error("storage/projects.json konnte nicht migriert werden:", error.message);
  }
}

module.exports = {
  connection,
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsForUser,
  getCurrentProjectId,
  getProject,
  getSession,
  getUserByEmail,
  getUserById,
  initDatabase,
  listUsers,
  listProjectsForUser,
  migrateProjectsJson,
  normalizeUserRole,
  normalizeUserStatus,
  setCurrentProjectId,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  updateProjectStatus,
  upsertProject,
  USER_ROLES
};
