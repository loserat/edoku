const fs = require("node:fs");
const path = require("node:path");
const { validateNewPassword } = require("./passwordPolicyService");
const devices = require("./deviceDataStoreService");

// Nur vor einer echten Erstinstallation aufrufen. Vorhandene Konten bleiben führend.
function initialAdminFromEnvironment(env = process.env) {
  const login = env.EDOKU_INITIAL_ADMIN_LOGIN;
  const password = env.EDOKU_INITIAL_ADMIN_PASSWORD;
  if (login === undefined && password === undefined) {
    if (env.NODE_ENV === "production") throw new Error("Für eine neue Produktionsinstallation müssen beide eigenen Erstzugangsvariablen gesetzt sein.");
    return null;
  }
  const email = String(login || "").trim().toLowerCase();
  if (!email || email.length > 254 || /[\s\x00-\x1f\x7f]/.test(email)) {
    throw new Error("EDOKU_INITIAL_ADMIN_LOGIN muss eine gültige Kennung ohne Leer-/Steuerzeichen enthalten.");
  }
  return { id: "user_demo", email, name: "Systemadmin", role: "systemadmin", password: validateNewPassword(password) };
}

function readiness(root, db, { requireSQLite = false } = {}) {
  // Tatsächliche Tabellen lesen: Ein SELECT 1 allein prüft keine Datenbankdatei.
  for (const table of ["users", "sessions", "projects"]) db.prepare(`SELECT count(*) FROM ${table}`).get();
  for (const area of ["data", "config", "storage", "output", "templates"]) {
    const directory = path.join(root, area);
    if (!fs.statSync(directory).isDirectory()) throw new Error("Ein Laufzeitordner fehlt.");
    fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
  }
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_storage'").get();
  const state = exists ? db.prepare("SELECT version,active FROM project_storage WHERE id=1").get() : null;
  if (exists && state?.version !== 1) throw new Error("Unbekannte Projektspeicherversion.");
  const sqlite = state?.active === 1;
  const deviceProjection = sqlite ? devices.enabled(db) : false;
  if (sqlite) {
    const incomplete = db.prepare("SELECT r.project_id FROM project_data_revisions r LEFT JOIN project_documents d USING(project_id,user_id) GROUP BY r.project_id,r.user_id HAVING count(d.name)<>9 LIMIT 1").get();
    if (incomplete) throw new Error("Unvollständiger SQLite-Projektbestand.");
  }
  if (requireSQLite && (!sqlite || !deviceProjection)) throw new Error("Beide SQLite-Stufen werden benötigt.");
  return { status: "ready", storage: sqlite ? "sqlite" : "json", deviceProjection };
}

module.exports = { initialAdminFromEnvironment, readiness };
