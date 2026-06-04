const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db;

function nowIso() {
  return new Date().toISOString();
}

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

  return db;
}

function connection() {
  if (!db) throw new Error("Datenbank wurde nicht initialisiert.");
  return db;
}

function getUserByEmail(email) {
  return connection().prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

function getUserById(userId) {
  return connection().prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function createUser(user) {
  connection().prepare(`
    INSERT INTO users (id, email, name, password_hash, password_salt, current_project_id, created_at, updated_at)
    VALUES (@id, @email, @name, @passwordHash, @passwordSalt, @currentProjectId, @createdAt, @updatedAt)
  `).run(user);
}

function createSession(token, userId, expiresAt) {
  connection().prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt, nowIso());
}

function getSession(token) {
  return connection().prepare(`
    SELECT sessions.token, sessions.user_id, sessions.expires_at, users.email, users.name, users.current_project_id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);
}

function deleteSession(token) {
  connection().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function deleteExpiredSessions() {
  connection().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

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
  getCurrentProjectId,
  getProject,
  getSession,
  getUserByEmail,
  getUserById,
  initDatabase,
  listProjectsForUser,
  migrateProjectsJson,
  setCurrentProjectId,
  updateProjectStatus,
  upsertProject
};
