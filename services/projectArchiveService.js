const fs = require("fs/promises");
const path = require("path");
const { safeJoin, sanitizeFileName, sanitizeId } = require("./pathService");
const {
  getCurrentProjectId: dbGetCurrentProjectId,
  getProject,
  getUserById,
  listProjectsForUser,
  setCurrentProjectId,
  updateProjectStatus: dbUpdateProjectStatus,
  upsertProject
} = require("./dbService");

const APP_NAME = "edoku";
const APP_VERSION = "0.1.0";
const EXPORT_VERSION = "1.0";

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

// * INFO: Lokaler JSON-Reader für Import/Export-Prozesse. Fehler fallen bewusst auf den Fallback zurück.
async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

// * INFO: Schreibt Projektpaket-Dateien und legt Zielordner automatisch an.
async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

// * INFO: Kopiert optionale Ordner oder Dateien nur dann, wenn sie im Projekt vorhanden sind.
async function copyIfExists(source, target) {
  if (!(await exists(source))) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
  return true;
}

// * INFO: Entfernt absolute Pfade aus Exportdaten, damit Projektpakete auf anderen Rechnern nutzbar bleiben.
function stripAbsolutePaths(value) {
  if (Array.isArray(value)) {
    return value.map(stripAbsolutePaths);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stripAbsolutePaths(item)])
    );
  }

  if (typeof value === "string" && path.isAbsolute(value)) {
    return path.basename(value);
  }

  return value;
}

// * INFO: Kopiert JSON-Dateien in Projektpakete und ersetzt absolute Pfade durch portable Werte.
async function copyJsonWithoutAbsolutePaths(source, target) {
  if (!(await exists(source))) return false;
  const data = await readJson(source, null);
  if (data === null) {
    await copyIfExists(source, target);
    return true;
  }
  await writeJson(target, stripAbsolutePaths(data));
  return true;
}

// * INFO: Zeitstempel für eindeutige Export- und Importordner.
function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
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
  await fs.mkdir(targetDataDir, { recursive: true });

  for (const fileName of DATA_FILE_NAMES) {
    const target = path.join(targetDataDir, fileName);
    if (await exists(target)) continue;

    const globalSource = path.join(dataDir, fileName);
    if (await exists(globalSource)) {
      await copyIfExists(globalSource, target);
    } else {
      await writeJson(target, fileName.endsWith("liste.json") || fileName === "anhaenge.json" || fileName === "files.json" ? [] : {});
    }
  }

  await upsertProjectFromData(rootDir, userId, projectId);
  return { projectId, dataDir: targetDataDir };
}

// * INFO: Liefert alle relevanten JSON-Pfade für ein bestimmtes Projekt.
function dataFilesForProject(rootDir, userId, projectId) {
  const dataDir = projectDataDir(rootDir, userId, projectId);
  return {
    dataDir,
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

// * INFO: Legt ein neues Projekt mit eigenen JSON-Dateien im Benutzer-Storage an.
async function createProject(rootDir, dataDir, userId, input = {}) {
  const projektname = String(input.projektname || "").trim() || "Neues Projekt";
  const projektnummer = String(input.projektnummer || "").trim();
  const baseId = sanitizeId(`${projektnummer || "projekt"}_${projektname}`, "projekt");
  const projectId = await uniqueProjectId(rootDir, userId, baseId);
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

// * INFO: Manifest beschreibt ein Projektpaket für spätere Validierung und Import.
async function createManifest(rootDir, userId, projectId, options) {
  const files = dataFilesForProject(rootDir, userId, projectId);
  const projekt = await readJson(files.projekt, {});

  return {
    exportVersion: EXPORT_VERSION,
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      id: projectId,
      projektnummer: projekt.projektnummer || "",
      projektname: projekt.projektname || "",
      auftraggeber: projekt.auftraggeber || "",
      liegenschaft: projekt.liegenschaft || "",
      baumassnahme: projekt.baumassnahme || ""
    },
    user: (() => {
      const user = getUserById(userId) || {};
      return { id: userId, name: user.name || "", email: user.email || "" };
    })(),
    contents: {
      dataFiles: DATA_FILE_NAMES,
      uploadsIncluded: Boolean(options.includeUploads),
      generatedIncluded: Boolean(options.includeGenerated),
      finalIncluded: Boolean(options.includeFinal)
    }
  };
}

// * INFO: Exportiert ein Projekt als Ordnerpaket mit Manifest und optionalen Upload-/Output-Ordnern.
async function exportProject(rootDir, projectId, userId, options = {}) {
  const exportOptions = {
    includeUploads: options.includeUploads !== false,
    includeGenerated: options.includeGenerated !== false,
    includeFinal: options.includeFinal !== false,
    includeLogs: Boolean(options.includeLogs),
    createZip: Boolean(options.createZip)
  };
  const sanitizedProjectId = sanitizeId(projectId, "projekt_demo");
  const project = getProject(userId, sanitizedProjectId);
  if (!project || project.status === "geloescht") {
    throw new Error("Kein Zugriff auf dieses Projekt.");
  }

  const timestamp = timestampForPath();
  const exportRoot = safeJoin(storagePaths(rootDir).exportsDir, sanitizeId(userId, "user"), sanitizedProjectId, timestamp);
  const packageRoot = path.join(exportRoot, "projekt_export");
  await fs.mkdir(path.join(packageRoot, "data"), { recursive: true });

  const projectRoot = projectRootDir(rootDir, userId, sanitizedProjectId);
  const files = dataFilesForProject(rootDir, userId, sanitizedProjectId);
  for (const fileName of DATA_FILE_NAMES) {
    await copyJsonWithoutAbsolutePaths(path.join(files.dataDir, fileName), path.join(packageRoot, "data", fileName));
  }

  if (exportOptions.includeUploads) {
    await copyIfExists(path.join(projectRoot, "uploads"), path.join(packageRoot, "uploads"));
  }
  if (exportOptions.includeGenerated) {
    await copyIfExists(path.join(projectRoot, "output", "generiert"), path.join(packageRoot, "generated"));
    await copyIfExists(path.join(projectRoot, "output", "projekte"), path.join(packageRoot, "generated", "projekte"));
  }
  if (exportOptions.includeFinal) {
    await copyIfExists(path.join(projectRoot, "output", "final"), path.join(packageRoot, "final"));
    await copyIfExists(path.join(projectRoot, "output", "projekte"), path.join(packageRoot, "final", "projekte"));
  }

  const manifest = await createManifest(rootDir, userId, sanitizedProjectId, exportOptions);
  await writeJson(path.join(packageRoot, "manifest.json"), manifest);
  await fs.writeFile(
    path.join(packageRoot, "README_EXPORT.txt"),
    [
      "edoku Projektpaket",
      "",
      "Dieses Paket enthaelt nur relative Pfade innerhalb des Exportordners.",
      "manifest.json beschreibt Exportversion, Projekt, Benutzer und enthaltene Bereiche.",
      "ZIP-Erzeugung ist in Version 1 vorbereitet, aber noch nicht produktiv aktiviert."
    ].join("\n"),
    "utf8"
  );

  let zipPath = "";
  if (exportOptions.createZip) {
    const zipName = `ProjektExport_${sanitizeFileName(manifest.project.projektnummer, "ohne_nummer")}_${sanitizeFileName(manifest.project.projektname, "Projekt")}_${timestamp}.zip`;
    zipPath = path.join(exportRoot, zipName);
    await fs.writeFile(
      path.join(exportRoot, "ZIP_NOT_CREATED.txt"),
      `ZIP-Datei vorbereitet: ${zipName}\nIn Version 1 wird zuerst der Exportordner erzeugt.\n`,
      "utf8"
    );
  }

  return {
    exportRoot,
    packageRoot,
    manifestPath: path.join(packageRoot, "manifest.json"),
    zipPath,
    zipCreated: false
  };
}

// * INFO: Prüft, ob ein Projektpaket die erwartete Manifest-Version und Pflichtdateien enthält.
async function validateProjectArchive(archivePath) {
  const manifestPath = path.join(archivePath, "manifest.json");
  const manifestFound = await exists(manifestPath);
  const manifest = manifestFound ? await readJson(manifestPath, null) : null;
  const dataDir = path.join(archivePath, "data");
  const missingDataFiles = [];

  for (const fileName of DATA_FILE_NAMES) {
    if (!(await exists(path.join(dataDir, fileName)))) missingDataFiles.push(fileName);
  }

  return {
    ok: Boolean(manifestFound && manifest && manifest.exportVersion === EXPORT_VERSION && missingDataFiles.length === 0),
    manifestFound,
    versionCompatible: Boolean(manifest && manifest.exportVersion === EXPORT_VERSION),
    requiredFilesPresent: missingDataFiles.length === 0,
    missingDataFiles,
    uploadsPresent: await exists(path.join(archivePath, "uploads")),
    generatedPresent: await exists(path.join(archivePath, "generated")),
    finalPresent: await exists(path.join(archivePath, "final")),
    manifest
  };
}

// * INFO: Verhindert ID-Kollisionen beim Import vorhandener Projektpakete.
async function uniqueProjectId(rootDir, userId, requestedId) {
  const projects = await listProjects(rootDir, userId);
  const used = new Set(projects.map((project) => project.id));
  let next = sanitizeId(requestedId, "projekt_import");
  if (!used.has(next)) return next;

  const suffix = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  let candidate = `${next}_import_${suffix}`;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${next}_import_${suffix}_${counter}`;
    counter += 1;
  }
  return candidate;
}

// * INFO: Importiert ein validiertes Projektpaket in den Storage des angemeldeten Benutzers.
async function importProject(rootDir, archivePathOrName, userId) {
  const importsDir = storagePaths(rootDir).importsDir;
  const archivePath = safeJoin(importsDir, archivePathOrName);
  const validation = await validateProjectArchive(archivePath);
  if (!validation.ok) {
    throw new Error("Projektpaket ist nicht importierbar. Bitte Validierung prüfen.");
  }

  const originalProjectId = validation.manifest.project.id || "projekt_import";
  const newProjectId = await uniqueProjectId(rootDir, userId, originalProjectId);
  const targetRoot = projectRootDir(rootDir, userId, newProjectId);
  const targetDataDir = path.join(targetRoot, "data");
  await fs.mkdir(targetDataDir, { recursive: true });

  for (const fileName of DATA_FILE_NAMES) {
    await copyIfExists(path.join(archivePath, "data", fileName), path.join(targetDataDir, fileName));
  }
  await copyIfExists(path.join(archivePath, "uploads"), path.join(targetRoot, "uploads"));
  await copyIfExists(path.join(archivePath, "generated"), path.join(targetRoot, "generated"));
  await copyIfExists(path.join(archivePath, "final"), path.join(targetRoot, "final"));

  const projektPath = path.join(targetDataDir, "projekt.json");
  const projekt = await readJson(projektPath, {});
  await writeJson(projektPath, {
    ...projekt,
    importiertAm: new Date().toISOString(),
    importiertVon: userId,
    originalProjectId
  });

  const now = new Date().toISOString();
  upsertProject({ id: newProjectId, userId, status: "aktiv", createdAt: now, updatedAt: now, originalProjectId });

  return { projectId: newProjectId, validation };
}

// * INFO: Listet vorbereitete Projektpakete für die Archivansicht.
async function listExports(rootDir, userId, projectId) {
  const base = safeJoin(storagePaths(rootDir).exportsDir, sanitizeId(userId, "user"), sanitizeId(projectId, "projekt_demo"));
  if (!(await exists(base))) return [];
  const timestamps = await fs.readdir(base, { withFileTypes: true });
  const exports = [];
  for (const entry of timestamps.filter((item) => item.isDirectory())) {
    const exportRoot = path.join(base, entry.name);
    const manifest = await readJson(path.join(exportRoot, "projekt_export", "manifest.json"), null);
    exports.push({
      timestamp: entry.name,
      projekt: manifest && manifest.project ? manifest.project.projektname : "",
      dateiname: "projekt_export",
      pfad: path.relative(rootDir, exportRoot).replaceAll(path.sep, "/"),
      manifestPfad: path.relative(rootDir, path.join(exportRoot, "projekt_export", "manifest.json")).replaceAll(path.sep, "/")
    });
  }
  return exports.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

module.exports = {
  DATA_FILE_NAMES,
  dataFilesForProject,
  createProject,
  ensureCurrentProject,
  exportProject,
  getCurrentDataFiles,
  getCurrentProjectId,
  importProject,
  listExports,
  listProjects,
  projectDataDir,
  setCurrentProject,
  storagePaths,
  updateProjectStatus,
  upsertProjectFromData,
  validateProjectArchive
};
