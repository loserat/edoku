const fs = require("fs/promises");
const path = require("path");
const syncFs = require("fs");
const { assertSafePath, ensureInsideBase, accessError, sanitizeId } = require("./pathService");
const scopes = new WeakMap();

function bindProjectScope(projekt, userId, projectId) {
  scopes.set(projekt, { userId, projectId });
  return projekt;
}
function projectScope(projekt) { return scopes.get(projekt); }
function scopedProjectRoot(rootDir, userId, projectId) {
  if (!userId || !projectId) throw accessError();
  return path.join(rootDir, "storage", "users", sanitizeId(userId), "projects", sanitizeId(projectId));
}

// Alte gemeinsame Ausgaben dürfen nur bei eindeutigem Eigentümer gelesen werden.
function legacyOutputStatus(rootDir, projekt) {
  if (!projectScope(projekt)) return "standalone";
  const legacy = path.join(rootDir, "output", "projekte", projectFolderName(projekt));
  if (!syncFs.existsSync(legacy)) return "none";
  const { connection } = require("./dbService");
  const owners = [];
  try {
    for (const row of connection().prepare("SELECT id,user_id FROM projects").all()) {
      const file = path.join(scopedProjectRoot(rootDir, row.user_id, row.id), "data", "projekt.json");
      const value = JSON.parse(syncFs.readFileSync(file, "utf8"));
      if (projectFolderName(value) === projectFolderName(projekt)) owners.push(row);
    }
  } catch { return "ambiguous"; }
  const scope = projectScope(projekt);
  return owners.length === 1 && owners[0].id === scope.projectId && owners[0].user_id === scope.userId ? "available" : "ambiguous";
}

function readableProjectPaths(rootDir, projekt) {
  const current = getProjectPaths(rootDir, projekt);
  if (legacyOutputStatus(rootDir, projekt) !== "available") return [current];
  return [current, pathsForRoot(path.join(rootDir, "output", "projekte", projectFolderName(projekt)))];
}

async function resolveProjectSource(rootDir, projekt, relativePath, { allowPublicImage = false } = {}) {
  if (!relativePath || path.isAbsolute(relativePath)) throw accessError();
  const scope = projectScope(projekt);
  const base = scope && /^(anhaenge|uploads|assets)\//.test(relativePath) ? scopedProjectRoot(rootDir,scope.userId,scope.projectId) : rootDir;
  const target = ensureInsideBase(rootDir, path.join(base, relativePath));
  if (scope) {
    const allowed = [scopedProjectRoot(rootDir, scope.userId, scope.projectId), ...readableProjectPaths(rootDir, projekt).map(p => p.projectPath)];
    if (allowPublicImage) allowed.push(path.join(rootDir, "public", "img"));
    if (!allowed.some(base => { try { ensureInsideBase(base, target); return true; } catch { return false; } })) throw accessError();
  }
  return assertSafePath(rootDir, target, { type: "file" });
}

const PROJECT_ROOTS = [
  "00_Projektdatei",
  "01_Eingang",
  "02_Config_Projekt",
  "03_Manuell_einfuegen",
  "04_Generiert",
  "05_PDF_Merge",
  "06_Final"
];

// * INFO: Kapitelordner für manuell einsortierte externe PDFs im Projektordner.
const CONFIG_CHAPTER_FOLDERS = [
  "01_Betriebskarteien",
  "02_Konformitaet_CE",
  "03_Anlagenbeschreibung_Bedienung",
  "04_Bedienung_Betrieb_Instandhaltung",
  "05_Unfallverhuetungsvorschriften",
  "06_Geraeteliste",
  "07_Produkt_Datenblaetter",
  "08_Abnahme_Maengelbeseitigung",
  "09_Einweisungsprotokolle",
  "10_Messprotokolle",
  "11_Sonstige_Bescheinigungen",
  "12_Bestandsplaene",
  "13_Sonstiges"
];

// * INFO: Pfadbestandteile für Projektordner und Dateinamen bereinigen.
function sanitizePart(value, fallback) {
  const cleaned = String(value || "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

// * INFO: Ordnername aus Projektnummer und Projektname.
function projectFolderName(projekt) {
  const nummer = sanitizePart(projekt.projektnummer, "ohne_nummer");
  const name = sanitizePart(projekt.projektname, "Projekt");
  return `${nummer}_${name}`;
}

// * INFO: Liefert alle wichtigen Output-Pfade für ein Projekt.
function getProjectPaths(rootDir, projekt) {
  const scope = projectScope(projekt);
  const projectPath = scope ? path.join(scopedProjectRoot(rootDir, scope.userId, scope.projectId), "output") : path.join(rootDir, "output", "projekte", projectFolderName(projekt));
  return pathsForRoot(projectPath);
}

function pathsForRoot(projectPath) {
  return {
    projectPath,
    configPath: path.join(projectPath, "02_Config_Projekt"),
    generatedPath: path.join(projectPath, "04_Generiert"),
    mergePath: path.join(projectPath, "05_PDF_Merge"),
    finalPath: path.join(projectPath, "06_Final")
  };
}

// * INFO: Legt die Projektordnerstruktur im output-Ordner an.
async function createProjectFolder(rootDir, projekt) {
  const paths = getProjectPaths(rootDir, projekt);
  if (projectScope(projekt) && projekt.logoPfad) {
    try { await resolveProjectSource(rootDir, projekt, projekt.logoPfad, { allowPublicImage: true }); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const folder of PROJECT_ROOTS) {
    const target = await assertSafePath(rootDir, path.join(paths.projectPath, folder), { allowMissing: true });
    await fs.mkdir(target, { recursive: true });
  }

  for (const folder of CONFIG_CHAPTER_FOLDERS) {
    await fs.mkdir(await assertSafePath(rootDir, path.join(paths.configPath, folder), { allowMissing: true }), { recursive: true });
  }

  return paths;
}

// * INFO: Ermittelt den passenden Kapitelordner für eine Dokumentnummer.
function chapterFolderForKapitel(kapitel) {
  const hauptkapitel = String(kapitel || "").split(".")[0].padStart(2, "0");
  return CONFIG_CHAPTER_FOLDERS.find((folder) => folder.startsWith(`${hauptkapitel}_`)) || "";
}

// * INFO: Kürzere öffentliche Variante für PDF- und Exportdateinamen.
function fileSafeName(value, fallback = "Dokument") {
  return sanitizePart(value, fallback).slice(0, 120);
}

module.exports = {
  bindProjectScope,
  projectScope,
  scopedProjectRoot,
  legacyOutputStatus,
  readableProjectPaths,
  resolveProjectSource,
  CONFIG_CHAPTER_FOLDERS,
  chapterFolderForKapitel,
  createProjectFolder,
  fileSafeName,
  getProjectPaths,
  projectFolderName
};
