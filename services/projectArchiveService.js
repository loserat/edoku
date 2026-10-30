const fs = require("fs/promises");
const path = require("path");
const { safeJoin, sanitizeFileName, sanitizeId, assertSafePath, accessError } = require("./pathService");
const {
  getCurrentProjectId: dbGetCurrentProjectId,
  getProject,
  getUserById,
  listProjectsForUser,
  setCurrentProjectId,
  updateProjectStatus: dbUpdateProjectStatus,
  upsertProject
} = require("./dbService");

// * INFO: Fachliche JSON-Dateien, die pro Projekt in storage/users/... gespiegelt werden.
const DATA_FILE_NAMES = [
  "projekt.json",
  "leistungsbereiche.json",
  "projektSysteme.json",
  "dokumentenmatrix.json",
  "geraetelisten.json",
  "brandschutz.json",
  "anhaenge.json",
  "exportliste.json",
  "files.json"
];

// * INFO: Kleine Existenzprüfung für Dateien und Ordner.
async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

const { readJson, writeJson } = require("./jsonService");

// * INFO: Kopiert optionale Ordner oder Dateien nur dann, wenn sie im Projekt vorhanden sind.
async function copyIfExists(source, target) {
  if (!(await exists(source))) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
  return true;
}

// * INFO: Datenordner eines Projekts innerhalb des benutzerbezogenen Storage-Bereichs.
function projectDataDir(rootDir, userId, projectId) {
  return path.join(rootDir, "storage", "users", sanitizeId(userId, "user_demo"), "projects", sanitizeId(projectId, "projekt_demo"), "data");
}

// * INFO: Projektwurzelordner inklusive data, uploads und output.
function projectRootDir(rootDir, userId, projectId) {
  return path.join(rootDir, "storage", "users", sanitizeId(userId, "user_demo"), "projects", sanitizeId(projectId, "projekt_demo"));
}

// * INFO: Zentrale Storage-Unterordner für Benutzerprojekte, Importpakete und Exportpakete.
function storagePaths(rootDir) {
  const storageDir = path.join(rootDir, "storage");
  return {
    storageDir,
    exportsDir: path.join(storageDir, "exports"),
    importsDir: path.join(storageDir, "imports"),
    usersDir: path.join(storageDir, "users")
  };
}

// * INFO: Stellt sicher, dass die Storage-Registry-Struktur vorhanden ist.
async function ensureProjectRegistry(rootDir) {
  const paths = storagePaths(rootDir);
  await fs.mkdir(paths.exportsDir, { recursive: true });
  await fs.mkdir(paths.importsDir, { recursive: true });
  await fs.mkdir(paths.usersDir, { recursive: true });
}

// * INFO: Ermittelt oder erzeugt das aktuelle Projekt eines Benutzers.
// * INFO: Fehlende projektbezogene JSON-Dateien werden aus data/ oder Defaults gefüllt.
async function ensureCurrentProject(rootDir, dataDir, userId) {
  if (!userId) throw new Error("Kein Benutzer angemeldet.");
  await ensureProjectRegistry(rootDir);

  let projectId = sanitizeId(dbGetCurrentProjectId(userId), "");
  const projects = listProjectsForUser(userId).filter((project) => project.status !== "geloescht");
  if (!projectId || !projects.some((project) => project.id === projectId)) {
    projectId = projects[0] ? projects[0].id : "projekt_demo";
    setCurrentProjectId(userId, projectId);
  }

  const targetDataDir = projectDataDir(rootDir, userId, projectId);
  await assertSafePath(rootDir, targetDataDir, { allowMissing: true });
  await fs.mkdir(targetDataDir, { recursive: true });

  for (const fileName of DATA_FILE_NAMES) {
    const target = path.join(targetDataDir, fileName);
    if (await exists(target)) { await assertSafePath(rootDir, target, { type: "file" }); continue; }

    const globalSource = path.join(dataDir, fileName);
    if (await exists(globalSource)) {
      await copyIfExists(globalSource, target);
    } else {
      await writeJson(target, fileName.endsWith("liste.json") || fileName === "anhaenge.json" || fileName === "files.json" ? [] : {});
    }
  }

  // Reine Seitenaufrufe dürfen bestehende Projektmetadaten nicht verändern.
  if (!getProject(userId, projectId)) await upsertProjectFromData(rootDir, userId, projectId);
  return { projectId, dataDir: targetDataDir };
}

// * INFO: Liefert alle relevanten JSON-Pfade für ein bestimmtes Projekt.
function dataFilesForProject(rootDir, userId, projectId) {
  const dataDir = projectDataDir(rootDir, userId, projectId);
  return {
    dataDir,
    userId, projectId,
    projekt: path.join(dataDir, "projekt.json"),
    leistungsbereiche: path.join(dataDir, "leistungsbereiche.json"),
    dokumentenmatrix: path.join(dataDir, "dokumentenmatrix.json"),
    projektSysteme: path.join(dataDir, "projektSysteme.json"),
    geraetelisten: path.join(dataDir, "geraetelisten.json"),
    brandschutz: path.join(dataDir, "brandschutz.json"),
    anhaenge: path.join(dataDir, "anhaenge.json"),
    exportliste: path.join(dataDir, "exportliste.json"),
    files: path.join(dataDir, "files.json")
  };
}

// * INFO: Ältere currentProject.json-Unterstützung für Kompatibilität mit frühen Versionen.
async function getCurrentProjectId(rootDir, dataDir) {
  const current = await readJson(path.join(dataDir, "currentProject.json"), { projectId: "" });
  return sanitizeId(current.projectId, "");
}

// * INFO: Einstieg für Routen: aktuelles Projekt sicherstellen und dessen Dateipfade liefern.
async function getCurrentDataFiles(rootDir, dataDir, userId) {
  const current = await ensureCurrentProject(rootDir, dataDir, userId);
  return dataFilesForProject(rootDir, userId, current.projectId);
}

// * INFO: Liest Projektregister aus SQLite und ergänzt sichtbare Stammdaten aus projekt.json.
async function listProjects(rootDir, userId) {
  const registry = listProjectsForUser(userId);
  const projects = [];

  for (const project of registry) {
    const files = dataFilesForProject(rootDir, userId, project.id);
    const projekt = await readJson(files.projekt, {});
    projects.push({
      ...project,
      projektname: projekt.projektname || "",
      projektnummer: projekt.projektnummer || "",
      auftraggeber: projekt.auftraggeber || "",
      liegenschaft: projekt.liegenschaft || ""
    });
  }

  return projects;
}

// * INFO: Statusänderungen bleiben im SQLite-Projektregister, nicht in projekt.json.
async function updateProjectStatus(rootDir, userId, projectId, status) {
  const sanitizedProjectId = sanitizeId(projectId, "projekt_demo");
  if (!getProject(userId, sanitizedProjectId) || !["aktiv", "archiviert", "geloescht"].includes(status)) throw accessError("Kein Zugriff auf dieses Projekt.");
  dbUpdateProjectStatus(userId, sanitizedProjectId, status);
}

// * INFO: Wechselt das aktive Projekt des Benutzers und verhindert Zugriff auf gelöschte/fremde Projekte.
async function setCurrentProject(rootDir, dataDir, userId, projectId) {
  const sanitizedProjectId = sanitizeId(projectId, "projekt_demo");
  const project = getProject(userId, sanitizedProjectId);
  if (!project || project.status === "geloescht") {
    throw new Error("Projekt wurde nicht gefunden oder ist geloescht.");
  }
  setCurrentProjectId(userId, sanitizedProjectId);
}

async function uniqueProjectId(rootDir, userId, requestedId) {
  const base=sanitizeId(requestedId,"projekt");
  for(let count=0;;count++){
    const id=count?`${base.slice(0,70)}_${count+1}`:base;
    if(!getProject(userId,id) && !(await exists(projectRootDir(rootDir,userId,id))))return id;
  }
}

// * INFO: Legt ein neues Projekt mit eigenen JSON-Dateien im Benutzer-Storage an.
async function createProject(rootDir, dataDir, userId, input = {}) {
  const projektname = String(input.projektname || "").trim() || "Neues Projekt";
  const projektnummer = String(input.projektnummer || "").trim();
  const baseId = sanitizeId(`${projektnummer || "projekt"}_${projektname}`, "projekt");
  let projectId;
  for (;;) {
    projectId = await uniqueProjectId(rootDir, userId, baseId);
    const target = await assertSafePath(rootDir, projectRootDir(rootDir,userId,projectId), { allowMissing: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { await fs.mkdir(target); break; } catch(error) { if(error.code !== "EEXIST") throw error; }
  }
  const files = dataFilesForProject(rootDir, userId, projectId);

  await fs.mkdir(files.dataDir, { recursive: true });

  for (const fileName of DATA_FILE_NAMES) {
    const target = path.join(files.dataDir, fileName);
    const globalSource = path.join(dataDir, fileName);

    if (fileName === "exportliste.json" || fileName === "anhaenge.json" || fileName === "files.json" || fileName === "projektSysteme.json") {
      await writeJson(target, []);
    } else if (fileName === "projekt.json") {
      const defaultProjekt = await readJson(globalSource, {});
      await writeJson(target, {
        ...defaultProjekt,
        projektname,
        projektnummer,
        auftraggeber: input.auftraggeber || "",
        liegenschaft: input.liegenschaft || "",
        baumassnahme: input.baumassnahme || "",
        massnahmeNr: "",
        auftragsNr: "",
        auftragGewerk: input.auftragGewerk || defaultProjekt.auftragGewerk || "Elektrotechnik",
        ortDerAusfuehrung: "",
        ausfuehrendeFirma: "",
        firmenanschrift: "",
        bearbeiter: "",
        ortDatum: "",
        logoPfad: ""
      });
    } else if (await exists(globalSource)) {
      await copyIfExists(globalSource, target);
    } else {
      await writeJson(target, fileName.endsWith("liste.json") ? [] : {});
    }
  }

  const now = new Date().toISOString();
  upsertProject({ id: projectId, userId, status: "aktiv", createdAt: now, updatedAt: now });
  setCurrentProjectId(userId, projectId);

  return { projectId, dataDir: files.dataDir };
}

async function upsertProjectFromData(rootDir, userId, projectId) {
  const now = new Date().toISOString();
  upsertProject({ id: projectId, userId, updatedAt: now });
}

const { exportProject, importProject, listExports, validateProjectArchive, resolveArchiveDownload, resolveImportDirectory } = require("./projectPackageService");

module.exports = {
  DATA_FILE_NAMES, dataFilesForProject, createProject, ensureCurrentProject,
  exportProject, getCurrentDataFiles, getCurrentProjectId, importProject,
  listExports, listProjects, projectDataDir, setCurrentProject, storagePaths,
  updateProjectStatus, upsertProjectFromData, validateProjectArchive,
  resolveArchiveDownload, resolveImportDirectory
};
