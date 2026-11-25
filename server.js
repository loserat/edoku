const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const express = require("express");
const packageInfo = require("./package.json");
const { jsonForHtml } = require("./services/htmlDataService");
const { createStorageBudget } = require("./services/storageBudgetService");

const { bootstrapStorage, DEFAULT_LEISTUNGSBEREICHE } = require("./services/bootstrapService");
const { readJson, writeJson } = require("./services/jsonService");
const {
  initDatabase,
  connection,
  getUserByEmail,
  getUserById,
  getProject,
  createUser,
  deleteSessionsForUser,
  listUsers,
  migrateProjectsJson,
  normalizeUserRole,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  USER_ROLES,
  USER_ROLE_LABELS
} = require("./services/dbService");
const { attachUser, blockViewerWrites, endSession, loginUser, parseCookies, registerUser, requireAuth, requireSystemAdmin, startSession } = require("./services/authService");
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, validateNewPassword } = require("./services/passwordPolicyService");
const projectStore = require("./services/projectDataStoreService");
const { initialAdminFromEnvironment, readiness } = require("./services/deploymentService");
const {
  createProject,
  ensureCurrentProject,
  exportProject,
  dataFilesForProject,
  importProject,
  listExports,
  listProjects,
  setCurrentProject,
  updateProjectStatus,
  resolveArchiveDownload,
  resolveImportDirectory,
  upsertProjectFromData
} = require("./services/projectArchiveService");
const { createProjectFolder, fileSafeName, bindProjectScope, legacyOutputStatus, resolveProjectSource } = require("./services/projectService");
const { installAsyncHandlers, createCsrfProtection, createAuthLimiter, createRequestLimiter, createResourceGuard, createBodyLimiter } = require("./services/requestSecurityService");
const { createAuditService } = require("./services/auditService");
const { buildDashboardStats } = require("./services/dashboardService");
const { brandschutzPhotosRelevant, inspectBrandschutzPhotos } = require("./services/brandschutzPhotoService");
const { buildExportPreview } = require("./services/exportPreviewService");
const { listPdfPreviewFiles, listFinalExportFiles, resolvePdfPreviewFile, resolveExportDownloadFile } = require("./services/pdfPreviewService");
const { buildExportliste, prepareFinalExport } = require("./services/exportService");
const { generateBrandschutzPdf, generateDeckblaetter, generateFormularPdfs, generateGeraetelisten, generateInhaltsverzeichnis, generateOrdnerruecken, generateTrennstreifen } = require("./services/pdfService");
const { sortDocuments } = require("./services/chapterNumberingService");
const { BRANDSCHUTZ_REQUIRED_FIELDS, addBrandschutzEintrag, normalizeBrandschutz, normalizePostedBrandschutz } = require("./services/brandschutzService");
const {
  addGeraetelistenVorlage,
  applyGeraetelistenVorlage,
  deviceListFieldsForLeistungsbereich,
  normalizeGeraetelisten,
  normalizeGeraetelistenVorlagen,
  normalizePostedGeraetelisten,
  normalizePostedGeraetelistenVorlagen,
  syncGeraetelistenFromLeistungsbereiche
} = require("./services/geraetelistenService");
const { formEnabledForLeistungsbereiche, mergeFormTemplates, normalizePostedFormTemplates } = require("./services/formTemplateService");
const {
  flattenSystemConfigForLegacy,
  buildGeraetelistenSuggestions,
  normalizePostedProjektSysteme,
  normalizePostedSystemConfig,
  normalizeSystemConfig,
  selectionByLeistungsbereich,
  syncProjektSysteme
} = require("./services/systemService");
const {
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  THEME_PRESETS,
  mergeSystemSettings,
  normalizePostedErstellerStammdaten,
  normalizePostedLeistungsbereiche,
  normalizePostedOrdnerstruktur,
  normalizePostedSystemSettings,
  normalizePostedThemeSettings
} = require("./services/settingsService");
const { resolveCreatorLogo, saveCreatorLogo } = require("./services/logoService");
const { safeJoin } = require("./services/pathService");
const {
  assignAttachmentToBrandschutz,
  clearAttachmentReferencesFromBrandschutz,
  deleteAttachment,
  normalizeAttachments,
  parseMultipartUpload,
  saveAttachment,
  resolveAttachmentFile,
  attachmentPreviewMime,
  syncAttachmentFileName
} = require("./services/attachmentService");
const {
  DOCUMENT_ATTACHMENT_CATEGORIES,
  defaultDocumentMetaForCategory,
  updateAttachmentDocumentMeta
} = require("./services/documentAttachmentService");
const { buildDocumentationAttachmentEntries, numberMatrixForExport, estimateBinderCount: countBinders } = require("./services/documentationPlanService");
const apiRoutes = require("./src/routes/api.routes");
const { createIntegrationRouter } = require("./src/routes/integration.routes");
const { createApiTokenService } = require("./services/apiTokenService");
const { prepareResponse: prepareApiResponse, apiError } = require("./src/api/http");
const { scopes: apiScopes } = require("./src/api/schemas");
const { createIntegrationSettingsService } = require("./services/integrationSettingsService");
const { createDocumentAssistantRouter } = require("./src/routes/documentAssistant.routes");
const workspace = require("./services/projectWorkspaceService");
const { generateCompleteDocumentation } = workspace;
const { createExportJobService } = require("./services/exportJobService");

// ! WICHTIG: Zentrale Pfade der Anwendung. Alle Dateioperationen werden relativ zu
// ! WICHTIG: diesen Ordnern aufgebaut, damit lokaler Start und Docker-Start gleich laufen.
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
const STORAGE_DIR = path.join(ROOT_DIR, "storage");
const GERAETELISTEN_VORLAGEN_FILE = path.join(CONFIG_DIR, "geraetelistenVorlagen.json");
const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = packageInfo.version || "0.0.0";
const APP_NAME = packageInfo.name || "edoku";
const GITHUB_RELEASE_API = "https://api.github.com/repos/loserat/edoku/releases/latest";
const DEFAULT_STOCKWERKE = ["UG", "EG", "1. OG", "2. OG", "3. OG", "4. OG", "5. OG", "DG", "Dach"];

// ! WICHTIG: Bestehende Datenbanken werden beim Update weder neu befüllt noch migriert.
// * INFO: Startkonten und das alte JSON-Projektregister gelten nur für die Erstinstallation.
const existingDatabase = fs.existsSync(path.join(STORAGE_DIR, "app.db"));
// Ungültige Startzugänge vor dem Anlegen einer Datenbank ablehnen.
const initialAdmin = existingDatabase ? null : initialAdminFromEnvironment();
bootstrapStorage({ ROOT_DIR, DATA_DIR, CONFIG_DIR, OUTPUT_DIR, TEMPLATES_DIR, STORAGE_DIR });
initDatabase(STORAGE_DIR);
if (!existingDatabase) {
  ensureDefaultUser();
  migrateProjectsJson(ROOT_DIR);
  projectStore.migrateProjectData(ROOT_DIR, connection(), { newInstallation: true });
  require("./services/deviceDataStoreService").migrateDeviceData(connection());
}
projectStore.configureProjectDataStore(ROOT_DIR, connection());

const app = express();
// Routen und ihre Sicherheitsregeln müssen denselben Pfad vergleichen.
// Varianten mit anderer Schreibweise oder zusätzlichem Slash sind keine zweite Route.
app.enable("case sensitive routing");
app.enable("strict routing");
installAsyncHandlers(app, { runHeavy: createResourceGuard({ checkStorage: createStorageBudget(ROOT_DIR) }) });
app.disable("x-powered-by");
app.get("/ready", (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const state = readiness(ROOT_DIR, connection(), { requireSQLite: process.env.EDOKU_REQUIRE_SQLITE === "true" });
    return res.json({ ...state, version: packageInfo.version });
  } catch (error) {
    console.error("Bereitschaftsprüfung fehlgeschlagen:", error.message);
    return res.status(503).json({ status: "unavailable" });
  }
});
const authLimiter = createAuthLimiter();
const apiTokens = createApiTokenService(connection());
const integrationSettings = createIntegrationSettingsService(ROOT_DIR);
const audit = createAuditService(ROOT_DIR, { resolveTarget: req => {
  if (req.params?.userId && getUserById(req.params.userId)) return req.params.userId;
  if (req.params?.projectId && req.user && getProject(req.user.id,req.params.projectId)) return req.params.projectId;
  return null;
} });
const exportJobs = createExportJobService(ROOT_DIR, { audit, checkStorage: createStorageBudget(ROOT_DIR) });
if (["1", "true", "yes", "on"].includes(String(process.env.TRUST_PROXY || "").trim().toLowerCase())) {
  app.set("trust proxy", 1);
}
app.set("view engine", "ejs");
app.set("views", path.join(ROOT_DIR, "views"));
app.set("query parser", "extended");
Object.assign(app.locals, {
  jsonForHtml,
  passwordMinLength: PASSWORD_MIN_LENGTH, passwordMaxLength: PASSWORD_MAX_LENGTH,
  projectDataRevision: "",
  csrfToken: "", user: null, currentProjectId: "", currentProjectName: "", currentProjectNumber: "",
  projectSidebarProjects: [], showBrandschutzNavigation: false, storageWarning: "", deleteConfirmDialogs: true,
  systemSettings: mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS)
});

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(18).toString("base64");
  res.locals.cspNonce = nonce;
  res.set("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "same-origin");
  next();
});
app.use("/api/v1", prepareApiResponse);
app.use(createRequestLimiter());
app.use(createBodyLimiter());
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use(express.urlencoded({ extended: true, limit: "2mb", parameterLimit: 10000, depth: 16 }));
app.use(express.json({ limit: "2mb" }));
app.use(parseCookies);
app.use(attachUser);
// Nur dieser getrennte Bearer-Zugang wird vor der Formular-CSRF-Prüfung bedient.
// Browser-Cookies werden hier nicht als API-Anmeldung akzeptiert.
app.use("/api/v1", createIntegrationRouter({ root: ROOT_DIR, tokens: apiTokens, audit, exportJobs, checkStorage: createStorageBudget(ROOT_DIR) }));
app.use((req,res,next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "same-origin");
  if (req.user) res.set("Cache-Control", "no-store");
  next();
});
// Uploads werden einmal begrenzt gelesen; derselbe Parser liefert den CSRF-Token und die Datei.
app.use((req,res,next) => {
  if (!req.is("multipart/form-data")) return next();
  if (!["/anhaenge/upload", "/einstellungen/ersteller-logo"].includes(req.path)) return next(Object.assign(new Error("Dieser Bereich erwartet kein Upload-Formular."), { status: 415 }));
  if (!req.user) return res.status(401).send("Bitte zuerst anmelden.");
  if (req.path.startsWith("/einstellungen/") && req.user.role !== "systemadmin") return res.status(403).send("Zugriff nur für Systemadmins.");
  express.raw({ type: "multipart/form-data", limit: req.path === "/einstellungen/ersteller-logo" ? "10mb" : "15mb" })(req,res,async(error) => {
    if (error) return next(error);
    try { req.multipartUpload = await parseMultipartUpload(req); next(); } catch(e) { next(e); }
  });
});
app.use(createCsrfProtection());
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/login") return authLimiter.check(req, res, next);
  if (req.method === "POST" && req.path === "/register") return authLimiter.registration(req, res, next);
  next();
});
app.use(audit.middleware);
// Der Prüfbereich bindet Aufträge und Freigaben an das aktuell geöffnete Projekt.
// Die Einzelprüfung läuft weiterhin in einer eigenen geschützten Speichertransaktion.
app.use("/assistent", createDocumentAssistantRouter({ root: ROOT_DIR, audit, exportJobs, checkStorage: createStorageBudget(ROOT_DIR) }));
app.use("/api", apiRoutes);
app.use(projectStore.projectDataRequest(ROOT_DIR));

// * INFO: Gemeinsamer Template-Kontext für eingeloggte Benutzer. Die Views nutzen diese
// * INFO: Werte für Flash-Meldungen, Projektanzeige und die Projektliste in der Sidebar.
app.use(async (req, res, next) => {
  res.locals.flash = flashFromQuery(req);
  res.locals.currentProjectId = "";
  res.locals.currentProjectName = "";
  res.locals.currentProjectNumber = "";
  res.locals.projectSidebarProjects = [];
  res.locals.showBrandschutzNavigation = false;
  res.locals.storageWarning = "";
  res.locals.deleteConfirmDialogs = true;
  res.locals.systemSettings = mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS);

  try {
    const systemSettings = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), DEFAULT_SYSTEM_SETTINGS));
    res.locals.systemSettings = systemSettings;
    res.locals.deleteConfirmDialogs = systemSettings.deleteConfirmDialogs !== false;
  } catch (error) {
    console.error("Systemeinstellungen konnten nicht vorbereitet werden:", error.message);
  }

  if (!req.user) return next();

  try {
    const current = await ensureCurrentProject(ROOT_DIR, DATA_DIR, req.user.id);
    res.locals.currentProjectId = current.projectId;
    res.locals.projectDataRevision = projectStore.projectDataRevision(ROOT_DIR,req.user.id,current.projectId);
    res.locals.projectSidebarProjects = await listProjects(ROOT_DIR, req.user.id);
    const currentProject = res.locals.projectSidebarProjects.find((project) => project.id === current.projectId);
    if (currentProject && legacyOutputStatus(ROOT_DIR, bindProjectScope(currentProject, req.user.id, current.projectId)) === "ambiguous") {
      res.locals.storageWarning = "Gemeinsam genutzte Alt-Ausgaben bleiben als historischer Bestand erhalten. Neue Ausgaben werden getrennt gespeichert. Projektarchive enthalten nur eindeutig zugehörige Dateien; der alte Exportindex bleibt als Begleitmetadaten erhalten.";
    }
    res.locals.currentProjectName = currentProject ? currentProject.projektname || currentProject.id : current.projectId;
    res.locals.currentProjectNumber = currentProject ? currentProject.projektnummer || "" : "";
    const files = await getCurrentDataFiles(ROOT_DIR, DATA_DIR, req.user.id);
    const leistungsbereiche = await readJson(files.leistungsbereiche, { aktiv: [] });
    res.locals.showBrandschutzNavigation = Array.isArray(leistungsbereiche.aktiv) && leistungsbereiche.aktiv.includes("Brandschutzabschottungen");
  } catch (error) {
    console.error("Projektkontext konnte nicht vorbereitet werden:", error.message);
  }

  next();
});

// Veraltete Formulare dürfen neuere Daten und ein inzwischen gewechseltes Projekt nicht überschreiben.
app.use((req,res,next) => {
  const token=req.get("X-Project-Revision") || req.multipartUpload?.fields?._projectRevision || req.body?._projectRevision;
  if(req.body && !Buffer.isBuffer(req.body))delete req.body._projectRevision;
  if(req.multipartUpload?.fields)delete req.multipartUpload.fields._projectRevision;
  if(req.method!=="POST" || !req.user || !/^\/(projekt(?:$|\/)|leistungsbereiche(?:$|\/)|systemauswahl(?:$|\/)|dokumente(?:$|\/)|geraetelisten(?:$|\/)|brandschutz(?:$|\/)|anhaenge(?:$|\/)|export(?:$|\/))/.test(req.path))return next();
  try {
    if(res.locals.projectDataRevision)projectStore.assertProjectRevision(ROOT_DIR,req.user.id,res.locals.currentProjectId,token);
    next();
  } catch(error) { next(error); }
});

// * INFO: Startkonten werden ausschließlich für eine neue Installation angelegt.
// ! WICHTIG: Vorhandene Passwörter, Rollen, Namen und Kontosperren bleiben erhalten.
function hashSeedPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, salt };
}

function ensureSeedUser({ id, email, name, password, role = "user", status = "active", currentProjectId = "projekt_demo" }) {
  if (getUserByEmail(email)) return;
  const { passwordHash, salt } = hashSeedPassword(password);
  const now = new Date().toISOString();

  createUser({
    id,
    email,
    name,
    role: normalizeUserRole(role),
    status,
    passwordHash,
    passwordSalt: salt,
    currentProjectId,
    createdAt: now,
    updatedAt: now
  });
}

function ensureDefaultUser() {
  if (listUsers().length) return;
  if (initialAdmin) { ensureSeedUser(initialAdmin); return; }
  [
    { id: "user_demo", email: "admin", name: "admin", password: "admin", role: "systemadmin" },
    { id: "user_marx", email: "marx", name: "Marx", password: "marx" },
    { id: "user_berg", email: "berg", name: "Berg", password: "berg", role: "systemadmin" }
  ].forEach(ensureSeedUser);
}

function flashFromQuery(req) {
  return {
    success: req.query.success || "",
    warning: req.query.warning || "",
    error: req.query.error || ""
  };
}

// * INFO: Liest die lokal gepflegten Release Notes fuer die Anzeige im Systembereich.
async function readReleaseNotes() {
  try {
    return await fsp.readFile(path.join(ROOT_DIR, "docs", "RELEASE_NOTES.md"), "utf8");
  } catch (error) {
    console.error("Release Notes konnten nicht gelesen werden:", error.message);
    return "Release Notes konnten nicht geladen werden.";
  }
}

function normalizeVersionTag(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function versionNumberParts(value) {
  const numericPart = normalizeVersionTag(value).split("-")[0];
  return numericPart.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function prereleaseRank(value) {
  const normalized = normalizeVersionTag(value);
  const betaMatch = normalized.match(/beta\.(\d+)/i);
  if (betaMatch) return Number.parseInt(betaMatch[1], 10) || 0;
  return Number.POSITIVE_INFINITY;
}

// * INFO: Vergleicht einfache semantische Versionsnummern inkl. beta.N.
function compareVersions(a, b) {
  const left = versionNumberParts(a);
  const right = versionNumberParts(b);
  const length = Math.max(left.length, right.length, 3);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }

  return prereleaseRank(a) - prereleaseRank(b);
}

// * INFO: Fügt nach einem Redirect eine Erfolg- oder Fehlermeldung als Query-Parameter an.
function redirectWithFlash(res, target, type, message) {
  const [baseTarget, hash = ""] = target.split("#");
  const joiner = baseTarget.includes("?") ? "&" : "?";
  const hashSuffix = hash ? `#${hash}` : "";
  res.redirect(`${baseTarget}${joiner}${type}=${encodeURIComponent(message)}${hashSuffix}`);
}

// * INFO: Einheitlicher Erfolgsweg für normale Formular-POSTs und Auto-Save-Requests.
function okOrRedirect(req, res, target, message = "Gespeichert.") {
  if ((req.headers.accept || "").includes("application/json")) {
    res.json({ ok: true, message });
    return;
  }
  redirectWithFlash(res, target, "success", message);
}

// * INFO: Einheitliche Fehlerantwort für HTML-Formulare und JSON-basierte Auto-Saves.
function fail(req, res, target, error) {
  const message = error?.code && /^E[A-Z]+$/.test(error.code) ? "Die Datei konnte nicht gespeichert oder gelesen werden. Bitte Zugriffsrechte und Speicherplatz prüfen." : error && error.message ? error.message : String(error || "Fehler");
  if ((req.headers.accept || "").includes("application/json")) {
    res.status(error.status || 500).json({ ok: false, error: message });
    return;
  }
  redirectWithFlash(res, target, "error", message);
}

// * INFO: Normalisiert frei eingegebene Stockwerke zu einer eindeutigen Liste.
function normalizeStockwerke(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,;]/);
  return [...new Set(raw
    .map((entry) => String(entry || "").trim())
    .filter(Boolean))];
}

// * INFO: Kombiniert Preset-Auswahl und freie Stockwerksangaben aus dem Projektformular.
function normalizePostedStockwerke(body) {
  return normalizeStockwerke([
    ...(Array.isArray(body.stockwerkePreset) ? body.stockwerkePreset : body.stockwerkePreset ? [body.stockwerkePreset] : []),
    ...(String(body.stockwerkeCustom || "").split(/[\n,;]/))
  ]);
}

// * INFO: Bereitet Stockwerke für Textarea-Ausgaben als mehrzeiligen Text vor.
function stockwerkeText(projekt) {
  return normalizeStockwerke(projekt.stockwerke || []).join("\n");
}

// * INFO: Erweitert Dropdown-Optionen um bereits gespeicherte Werte aus vorhandenen Daten.
function mergeStockwerkOptions(stockwerke, values = []) {
  return [...new Set([
    ...normalizeStockwerke(stockwerke),
    ...values.map((value) => String(value || "").trim()).filter(Boolean)
  ])];
}

// ! WICHTIG: Prüft projektbezogene Anhangspfade innerhalb des erlaubten Root-Verzeichnisses.
async function fileExistsForAttachment(relativePath, files) {
  if (!relativePath) return false;
  try {
    await resolveAttachmentFile(ROOT_DIR, files, relativePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * * INFO: Baut die View-Daten für die Anhangsverwaltung.
 * * INFO: Ergänzt Rohdaten um Dateistatus, Typ-Erkennung, Inhaltsverzeichnis-Zuordnung
 * * INFO: und Brandschutz-Fotoverweise.
 */
async function buildAttachmentViewModel(attachments, brandschutz, matrix, projekt = {}, geraetelisten = [], leistungsbereiche = {}, files) {
  const tocEntries = buildDocumentationAttachmentEntries(matrix, attachments, projekt, geraetelisten, leistungsbereiche);
  const tocByAttachmentId = new Map(tocEntries.map((entry) => [entry.attachmentId, entry]));
  const rows = await Promise.all(normalizeAttachments(attachments).map(async (entry) => {
    const assignedFoto1 = (brandschutz || []).filter((schottung) => schottung.foto_vorher === entry.relativePath);
    const assignedFoto2 = (brandschutz || []).filter((schottung) => schottung.foto_nachher === entry.relativePath);
    const tocEntry = tocByAttachmentId.get(entry.id);
    const exists = await fileExistsForAttachment(entry.relativePath, files);
    const isPdf = entry.mimeType === "application/pdf";
    const isImage = entry.mimeType.startsWith("image/");

    return {
      ...entry,
      exists,
      isPdf,
      isImage,
      sizeKb: Math.max(1, Math.round(entry.size / 1024)),
      uploadedLabel: entry.uploadedAt ? new Date(entry.uploadedAt).toLocaleString("de-DE") : "-",
      tocEntry,
      documentStatus: entry.assistantProvenance?.projectDocument && entry.export === false
        ? "Interner Projekttext · nicht im Kundenexport"
        : isPdf && tocEntry
          ? `Kapitel ${tocEntry.displayKapitel || tocEntry.kapitel}`
        : isPdf
          ? "Nicht als Dokumentations-PDF einsortiert"
          : "Bildanhang",
      assignedFoto1,
      assignedFoto2,
      assignedCount: assignedFoto1.length + assignedFoto2.length
    };
  }));

  const stats = {
    total: rows.length,
    pdfs: rows.filter((entry) => entry.isPdf).length,
    images: rows.filter((entry) => entry.isImage).length,
    export: rows.filter((entry) => entry.export !== false).length,
    missing: rows.filter((entry) => !entry.exists).length,
    assignedImages: rows.filter((entry) => entry.isImage && entry.assignedCount > 0).length
  };
  const countsByCategory = rows.reduce((counts, entry) => {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
    return counts;
  }, {});

  return { rows, stats, countsByCategory };
}

// * INFO: Baut eine Browser-URL für vorhandene PDF-Vorschauen innerhalb des Projektordners.
function pdfPreviewUrl(file) {
  return file ? `/export/pdf-preview?file=${encodeURIComponent(file.id)}#toolbar=1` : "";
}

// * INFO: Sucht in den generierten PDFs nach einem Dateinamen-Muster, ohne Kapitelnummern
// * INFO: doppelt berechnen zu müssen. Die Kapitelnummer steht im Dateipräfix und darf
// * INFO: sich durch aktive Leistungsbereiche logisch ändern.
function findGeneratedPdf(pdfPreviewFiles, folderName, suffix) {
  const normalizedSuffix = String(suffix || "").toLowerCase();
  return (pdfPreviewFiles || []).find((file) => {
    const relativePath = String(file.relativePath || file.id || "").replaceAll("\\", "/");
    return relativePath.startsWith(`04_Generiert/${folderName}/`) && String(file.name || "").toLowerCase().endsWith(normalizedSuffix);
  });
}

// * INFO: Ordnet jeder Geräteliste die vorhandene generierte PDF zu, falls diese bereits
// * INFO: erzeugt wurde. Fehlt die Datei, bleibt die Liste ohne Vorschau-Button.
function buildGeraetelistenPreviewMap(geraetelisten, pdfPreviewFiles) {
  return (geraetelisten || []).reduce((previewMap, liste) => {
    const suffix = `_${fileSafeName(liste.leistungsbereich)}_${fileSafeName(liste.titel)}.pdf`;
    const previewFile = findGeneratedPdf(pdfPreviewFiles, "Geraetelisten", suffix);
    if (previewFile) previewMap[liste.id] = pdfPreviewUrl(previewFile);
    return previewMap;
  }, {});
}

// * INFO: Brandschutz wird aktuell als ein zusammenhängendes Dokument generiert; die
// * INFO: Tabellenzeilen verweisen deshalb alle auf dieselbe vorhandene PDF-Vorschau.
function buildBrandschutzPreviewUrl(pdfPreviewFiles) {
  const previewFile = findGeneratedPdf(pdfPreviewFiles, "Brandschutz", "_Bilddokumentation_Brandschottungen.pdf");
  return pdfPreviewUrl(previewFile);
}

async function currentFiles(req) {
  // Der zu Beginn geprüfte Projektkontext bleibt für die gesamte Anfrage stabil.
  if(!req.res.locals.currentProjectId)throw Object.assign(new Error("Der Projektkontext konnte nicht sicher geladen werden. Bitte die gespeicherten Dateien prüfen."),{status:500});
  return dataFilesForProject(ROOT_DIR,req.user.id,req.res.locals.currentProjectId);
}

// * INFO: Lädt den vollständigen Projektzustand aus JSON/Config-Dateien und normalisiert
// * INFO: die Daten für Views, Services und PDF-Ausgabe.
async function loadCurrent(req) {
  const files = await currentFiles(req);
  return workspace.loadProjectWorkspace(ROOT_DIR, req.user.id, files.projectId);
}

// Dateistatus und Seitenzahlen werden gelesen, ohne Projektdaten zu verändern.
async function currentExportEntries(data) {
  return buildExportliste(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche, { persist: false, brandschutz: data.brandschutz });
}

// * INFO: Leitet aus aktiven Leistungsbereichen und Systemzuordnungen ab,
// * INFO: welche Matrixeinträge aktiv und exportierbar sind.
// * INFO: Übernimmt manuelle Checkbox-Änderungen aus der Dokumentenmatrix.
function updatePostedMatrix(matrix, body) {
  const activeIds = new Set(Array.isArray(body.aktiv) ? body.aktiv : body.aktiv ? [body.aktiv] : []);
  const exportIds = new Set(Array.isArray(body.export) ? body.export : body.export ? [body.export] : []);
  return (matrix || []).map((entry) => ({
    ...entry,
    aktiv: Boolean(entry.pflicht || activeIds.has(entry.id)),
    export: exportIds.has(entry.id)
  }));
}

// * INFO: Die Export-Matrix steuert nur die Ausgabe. Systemeinträge bleiben erhalten.
function updateMatrixOutputSelection(matrix, body) {
  const exportIds = new Set(Array.isArray(body.export) ? body.export : body.export ? [body.export] : []);
  return (matrix || []).map((entry) => ({
    ...entry,
    aktiv: Boolean(entry.aktiv || exportIds.has(entry.id)),
    export: exportIds.has(entry.id)
  }));
}

// * INFO: Synchronisiert Folge-Daten nach Änderungen an Leistungsbereichen.
// * INFO: Dadurch bleiben Systemauswahl, Matrix und Gerätelisten im gleichen Stand.
async function syncProjectDerivedData(files) {
  return workspace.syncProjectDerivedData(ROOT_DIR, files);
}

// * INFO: Startseite: angemeldete Benutzer landen immer im Dashboard.
app.get("/", requireAuth, (req, res) => res.redirect("/dashboard"));

// * INFO: Login, Registrierung und Logout.
app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("login", { flash: flashFromQuery(req) });
});

app.post("/login", (req, res) => {
  try {
    const user = loginUser(req.body.email, req.body.password);
    res.locals.auditIdentity = { actorId: user.id, actorRole: user.role };
    authLimiter.succeeded(req);
    startSession(res, user.id);
    res.redirect("/dashboard");
  } catch (error) {
    authLimiter.failed(req);
    redirectWithFlash(res, "/login", "error", error.message);
  }
});

app.get("/register", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("register", { flash: flashFromQuery(req) });
});

app.post("/register", (req, res) => {
  if (!res.locals.systemSettings.selfRegistrationEnabled) {
    return res.status(403).render("register", { flash: { error: "Die Selbstregistrierung ist geschlossen. Bitte wende dich an einen Systemadmin." } });
  }
  try {
    const user = registerUser(req.body);
    res.locals.auditIdentity = { actorId: user.id, actorRole: user.role };
    startSession(res, user.id);
    res.redirect("/dashboard");
  } catch (error) {
    redirectWithFlash(res, "/register", "error", error.message);
  }
});

app.post("/logout", (req, res) => {
  endSession(req, res);
  res.redirect("/login");
});

app.use(blockViewerWrites);
app.use((req,res,next) => {
  if (!["GET","HEAD","OPTIONS"].includes(req.method) && (req.path.startsWith("/einstellungen") || /^\/geraetelisten\/[^/]+\/vorlagen$/.test(req.path))) return requireSystemAdmin(req,res,next);
  next();
});

// * INFO: Dashboard: fasst Projektfortschritt, fehlende Angaben und nächste Schritte zusammen.
app.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    data.exportliste = await currentExportEntries(data);
    const stats = buildDashboardStats({
      projekt: data.projekt,
      leistungsbereiche: data.leistungsbereiche,
      matrix: data.matrix,
      geraetelisten: data.geraetelisten,
      brandschutz: data.brandschutz,
      exportliste: data.exportliste,
      projektSysteme: data.projektSysteme,
      anhaenge: data.anhaenge
    });
    res.render("dashboard", { active: "dashboard", stats });
  } catch (error) {
    next(error);
  }
});

// * INFO: Projektverwaltung: Projekte anzeigen, öffnen, archivieren, löschen und exportieren.
app.get("/projekte", requireAuth, async (req, res, next) => {
  try {
    res.render("projekte", {
      active: "projekte",
      projects: await listProjects(ROOT_DIR, req.user.id),
      currentProjectId: res.locals.currentProjectId
    });
  } catch (error) {
    next(error);
  }
});

app.post("/projekte", requireAuth, async (req, res) => {
  try {
    const created = await createProject(ROOT_DIR, DATA_DIR, req.user.id, req.body);
    res.locals.auditIdentity = { targetId: created.projectId };
    redirectWithFlash(res, "/projekt", "success", "Projekt wurde angelegt. Bitte Basisdaten erfassen.");
  } catch (error) {
    fail(req, res, "/projekte", error);
  }
});

app.post("/projekte/:projectId/oeffnen", requireAuth, async (req, res) => {
  try {
    await setCurrentProject(ROOT_DIR, DATA_DIR, req.user.id, req.params.projectId);
    redirectWithFlash(res, "/projekte", "success", "Projekt wurde geöffnet.");
  } catch (error) {
    fail(req, res, "/projekte", error);
  }
});

app.post("/projekte/:projectId/archivieren", requireAuth, async (req, res) => {
  await updateProjectStatus(ROOT_DIR, req.user.id, req.params.projectId, "archiviert");
  redirectWithFlash(res, "/projekte", "success", "Projekt wurde archiviert.");
});

app.post("/projekte/:projectId/loeschen", requireAuth, async (req, res) => {
  await updateProjectStatus(ROOT_DIR, req.user.id, req.params.projectId, "geloescht");
  redirectWithFlash(res, "/projekte", "success", "Projekt wurde als gelöscht markiert.");
});

app.post("/projekte/:projectId/exportieren", requireAuth, async (req, res) => {
  try {
    const result = await exportProject(ROOT_DIR, req.params.projectId, req.user.id, {});
    redirectWithFlash(res, "/projekte", result.complete ? "success" : "warning", result.complete ? "Projektpaket wurde geprüft und erstellt." : "Projektpaket mit Hinweisen erstellt. Fehlende Quelldateien und separat erhaltene Alt-Ausgaben stehen im Manifest.");
  } catch (error) {
    fail(req, res, "/projekte", error);
  }
});

// * INFO: Projektstammdaten inklusive Objektstruktur und Stockwerksauswahl.
app.get("/projekt", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("projekt", {
      active: "projekt",
      projekt: data.projekt,
      stockwerkeText: stockwerkeText(data.projekt),
      defaultStockwerke: DEFAULT_STOCKWERKE
    });
  } catch (error) {
    next(error);
  }
});

app.post("/projekt", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const currentProjekt = await readJson(files.projekt, {});
    await writeJson(files.projekt, {
      ...currentProjekt,
      ...req.body,
      stockwerke: normalizePostedStockwerke(req.body)
    });
    await upsertProjectFromData(ROOT_DIR, req.user.id, res.locals.currentProjectId);
    okOrRedirect(req, res, "/projekt");
  } catch (error) {
    fail(req, res, "/projekt", error);
  }
});

// * INFO: Leistungsbereiche steuern, welche Dokumente und Gerätelisten projektbezogen aktiv werden.
app.get("/leistungsbereiche", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("leistungsbereiche", {
      active: "leistungsbereiche",
      optionen: data.leistungsbereiche.optionen,
      aktiv: data.leistungsbereiche.aktiv
    });
  } catch (error) {
    next(error);
  }
});

app.post("/leistungsbereiche", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const current = await readJson(files.leistungsbereiche, {});
    const leistungsbereiche = {
      optionen: current.optionen || DEFAULT_LEISTUNGSBEREICHE,
      aktiv: Array.isArray(req.body.leistungsbereiche)
        ? req.body.leistungsbereiche
        : req.body.leistungsbereiche ? [req.body.leistungsbereiche] : [],
      systemAuswahl: req.body.systemAuswahl || current.systemAuswahl || {}
    };
    await writeJson(files.leistungsbereiche, leistungsbereiche);
    await syncProjectDerivedData(files);
    okOrRedirect(req, res, "/leistungsbereiche");
  } catch (error) {
    fail(req, res, "/leistungsbereiche", error);
  }
});

// * INFO: Projektspezifische Systemauswahl je Leistungsbereich.
app.get("/systemauswahl", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const synced = require("./services/systemService").systemSelectionsWithIds(data.projektSysteme);
    res.render("systemauswahl", {
      active: "systemauswahl",
      systemConfig: data.systemConfig,
      activeAreas: data.leistungsbereiche.aktiv,
      selections: selectionByLeistungsbereich(synced)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/systemauswahl", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const fields=['leistungsbereich','selectionId','hersteller','systemart','herstellerSystem'];
    const item=Object.fromEntries(fields.filter(key=>req.body[key]!==undefined).map(key=>[key,req.body[key]]));
    item.enabled=req.body.enabled==='1';
    if(req.body.add==='1')item.add=true;
    item.dokumentarten=Array.isArray(req.body.dokumentarten)?req.body.dokumentarten:req.body.dokumentarten?[req.body.dokumentarten]:[];
    await require('./services/systemSelectionService').saveSystemSelections(data,{items:[item]});
    okOrRedirect(req, res, "/systemauswahl");
  } catch (error) {
    fail(req, res, "/systemauswahl", error);
  }
});

// * INFO: Dokumentenmatrix: fachliche Dokumente prüfen und Exportstatus verwalten.
app.get("/dokumente", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("dokumente", {
      active: "dokumente",
      dokumente: sortDocuments(numberMatrixForExport(data.matrix, data.geraetelisten, data.anhaenge, data.leistungsbereiche, data.projekt))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/dokumente", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.dokumentenmatrix, updatePostedMatrix(await readJson(files.dokumentenmatrix, []), req.body));
    okOrRedirect(req, res, "/dokumente");
  } catch (error) {
    fail(req, res, "/dokumente", error);
  }
});

app.post("/dokumente/aktualisieren", requireAuth, async (req, res) => {
  const files = await currentFiles(req);
  await syncProjectDerivedData(files);
  redirectWithFlash(res, "/dokumente", "success", "Dokumentenmatrix wurde aktualisiert.");
});

// * INFO: Gerätelisten: Positionen pro aktivem Leistungsbereich tabellarisch bearbeiten.
app.get("/geraetelisten", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const nurAktive = req.query.aktiv === "1";
    const listen = nurAktive ? data.geraetelisten.filter((liste) => liste.aktiv) : data.geraetelisten;
    const bedienungsanleitungen = normalizeAttachments(data.anhaenge)
      .filter((entry) => entry.category === "Bedienungsanleitungen" && entry.mimeType === "application/pdf")
      .sort((a, b) => String(a.title || a.originalName || "").localeCompare(String(b.title || b.originalName || ""), "de", {
        numeric: true,
        sensitivity: "base"
      }));
    const fieldProfiles = Object.fromEntries(listen.map((liste) => [
      liste.leistungsbereich,
      deviceListFieldsForLeistungsbereich(liste.leistungsbereich)
    ]));
    const datenblaetter = normalizeAttachments(data.anhaenge).filter(entry => entry.category === "Datenblätter" && entry.mimeType === "application/pdf")
      .sort((a, b) => a.title.localeCompare(b.title, "de", { numeric: true, sensitivity: "base" }));
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    const geraetelistenVorlagen = normalizeGeraetelistenVorlagen(await readJson(GERAETELISTEN_VORLAGEN_FILE, []));
    res.render("geraetelisten", {
      active: "geraetelisten",
      geraetelisten: listen,
      aktiveLeistungsbereiche: data.leistungsbereiche.aktiv,
      nurAktive,
      suggestions: buildGeraetelistenSuggestions(data.systemConfig),
      fieldProfiles,
      bedienungsanleitungen,
      datenblaetter,
      geraetelistenVorlagen,
      previewByListId: buildGeraetelistenPreviewMap(listen, pdfPreviewFiles)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/geraetelisten", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.geraetelisten, normalizePostedGeraetelisten(req.body.geraetelisten));
    okOrRedirect(req, res, "/geraetelisten");
  } catch (error) {
    fail(req, res, "/geraetelisten", error);
  }
});

app.post("/geraetelisten/aktualisieren", requireAuth, async (req, res) => {
  const files = await currentFiles(req);
  await syncProjectDerivedData(files);
  redirectWithFlash(res, "/geraetelisten", "success", "Gerätelisten wurden aktualisiert.");
});

app.post("/geraetelisten/:listId/vorlagen", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const listen = normalizeGeraetelisten(await readJson(files.geraetelisten, []));
    const liste = listen.find((entry) => entry.id === req.params.listId);
    if (!liste) throw new Error("Geräteliste wurde nicht gefunden.");
    const currentTemplates = await readJson(GERAETELISTEN_VORLAGEN_FILE, []);
    await writeJson(GERAETELISTEN_VORLAGEN_FILE, addGeraetelistenVorlage(currentTemplates, liste, req.body.name));
    redirectWithFlash(res, "/geraetelisten", "success", "Geräteliste wurde als Systemvorlage gespeichert.");
  } catch (error) {
    fail(req, res, "/geraetelisten", error);
  }
});

app.post("/geraetelisten/:listId/vorlagen/:templateId/laden", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const listen = normalizeGeraetelisten(await readJson(files.geraetelisten, []));
    const templates = normalizeGeraetelistenVorlagen(await readJson(GERAETELISTEN_VORLAGEN_FILE, []));
    const template = templates.find((entry) => entry.id === req.params.templateId);
    if (!template) throw new Error("Gerätelisten-Vorlage wurde nicht gefunden.");

    let foundList = false;
    const updated = listen.map((liste) => {
      if (liste.id !== req.params.listId) return liste;
      foundList = true;
      if (liste.leistungsbereich !== template.leistungsbereich) {
        throw new Error("Diese Vorlage passt nicht zum ausgewählten Leistungsbereich.");
      }
      return applyGeraetelistenVorlage(liste, template);
    });

    if (!foundList) throw new Error("Geräteliste wurde nicht gefunden.");
    await writeJson(files.geraetelisten, normalizeGeraetelisten(updated));
    redirectWithFlash(res, "/geraetelisten", "success", "Gerätelisten-Vorlage wurde geladen.");
  } catch (error) {
    fail(req, res, "/geraetelisten", error);
  }
});

// * INFO: Brandschutz: Brandschottungen erfassen und Pflichtangaben prüfen.
app.get("/brandschutz", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    res.render("brandschutz", {
      active: "brandschutz",
      brandschutz: data.brandschutz,
      photoWarnings: await inspectBrandschutzPhotos(ROOT_DIR, data.projekt, data.brandschutz),
      brandschutzPreviewUrl: buildBrandschutzPreviewUrl(pdfPreviewFiles),
      stockwerke: mergeStockwerkOptions(
        data.projekt.stockwerke,
        data.brandschutz.map((entry) => entry.geschoss)
      ),
      requiredBrandschutzFields: BRANDSCHUTZ_REQUIRED_FIELDS
    });
  } catch (error) {
    next(error);
  }
});

app.post("/brandschutz", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.brandschutz, normalizePostedBrandschutz(req.body.brandschutz));
    okOrRedirect(req, res, "/brandschutz");
  } catch (error) {
    fail(req, res, "/brandschutz", error);
  }
});

app.post("/brandschutz/hinzufuegen", requireAuth, async (req, res) => {
  const files = await currentFiles(req);
  await writeJson(files.brandschutz, addBrandschutzEintrag(await readJson(files.brandschutz, [])));
  redirectWithFlash(res, "/brandschutz", "success", "Brandschutz-Eintrag wurde hinzugefügt.");
});

// * INFO: Export: Vorschau, PDF-Erzeugung, Exportliste und finaler Projekt-Export.
app.get("/export", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    data.exportliste = await currentExportEntries(data);
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    const finalExportFiles = await listFinalExportFiles(ROOT_DIR, data.projekt);
    const ordnerrueckenSettings = (((data.systemSettings || {}).export || {}).ordnerruecken || {});

    res.render("export", {
      active: "export",
      exportliste: data.exportliste,
      ordnerstruktur: data.ordnerstruktur,
      dokumente: sortDocuments(numberMatrixForExport(data.matrix, data.geraetelisten, data.anhaenge, data.leistungsbereiche, data.projekt)),
      preview: buildExportPreview({
        projekt: data.projekt,
        matrix: data.matrix,
        exportliste: data.exportliste,
        projektSysteme: data.projektSysteme,
        geraetelisten: data.geraetelisten, anhaenge: data.anhaenge, leistungsbereiche: data.leistungsbereiche
      }),
      pdfPreviewFiles,
      finalExportFiles,
      ordnerrueckenSettings,
      estimatedBinderCount: estimateBinderCount(data)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/export/matrix", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.dokumentenmatrix, updateMatrixOutputSelection(await readJson(files.dokumentenmatrix, []), req.body));
    okOrRedirect(req, res, "/export");
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

app.post("/export/matrix/aktualisieren", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await syncProjectDerivedData(files);
    redirectWithFlash(res, "/export", "success", "Dokumentenmatrix wurde aktualisiert.");
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

app.get("/export/pdf-preview", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.sendFile(await resolvePdfPreviewFile(ROOT_DIR, data.projekt, req.query.file));
  } catch (error) {
    next(error);
  }
});

app.get("/export/download", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.download(await resolveExportDownloadFile(ROOT_DIR, data.projekt, req.query.file));
  } catch (error) {
    next(error);
  }
});

async function deletePdfFilesRecursive(folderPath) {
  let deleted = 0;
  let entries = [];

  try {
    entries = await fsp.readdir(folderPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      deleted += await deletePdfFilesRecursive(entryPath);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
      await fsp.unlink(entryPath);
      deleted += 1;
    }
  }

  return deleted;
}

async function projectPhotoWarnings(data) {
  return brandschutzPhotosRelevant(data.matrix, data.leistungsbereiche)
    ? inspectBrandschutzPhotos(ROOT_DIR, data.projekt, data.brandschutz) : [];
}


function estimateBinderCount(data, capacity) {
  const pagesPerBinder = capacity || data.systemSettings?.export?.ordnerruecken?.seitenProOrdner || 80;
  return countBinders(data.exportliste, pagesPerBinder);
}

app.post("/export/projektordner", requireAuth, async (req, res) => {
  await createProjectFolder(ROOT_DIR, (await loadCurrent(req)).projekt);
  redirectWithFlash(res, "/export", "success", "Projektordner wurde erstellt.");
});

app.post("/export/dokumentation", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const generated = await generateCompleteDocumentation(ROOT_DIR, data);
    const photoWarnings = await projectPhotoWarnings(data);
    redirectWithFlash(res, "/export", photoWarnings.length ? "warning" : "success", `Dokumentation wurde generiert (${generated.length} PDFs).${photoWarnings.length ? ` ${photoWarnings.length} Brandschutz-Fotoverweis(e) führen zu fehlenden oder nicht zugreifbaren Dateien.` : ""}`);
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

app.post("/export/pdfs-loeschen", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const paths = await createProjectFolder(ROOT_DIR, data.projekt);
    const deleted = await deletePdfFilesRecursive(paths.generatedPath) + await deletePdfFilesRecursive(paths.finalPath);
    await buildExportliste(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche, { brandschutz: data.brandschutz });
    redirectWithFlash(res, "/export", "success", `${deleted} PDF-Datei(en) wurden gelöscht.`);
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

app.post("/export/inhaltsverzeichnis", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateInhaltsverzeichnis(ROOT_DIR, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche);
  redirectWithFlash(res, "/export", "success", "Inhaltsverzeichnis wurde generiert.");
});

app.post("/export/formulare", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateFormularPdfs(ROOT_DIR, data.projekt, data.matrix, data.leistungsbereiche, data.systemConfig, data.projektSysteme, data.templates, data.systemSettings, data.geraetelisten, data.anhaenge);
  redirectWithFlash(res, "/export", "success", "Formular-PDFs wurden generiert.");
});

app.post("/export/geraetelisten", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateGeraetelisten(ROOT_DIR, data.projekt, data.geraetelisten, data.systemSettings, data.matrix, data.leistungsbereiche, data.anhaenge);
  redirectWithFlash(res, "/export", "success", "Gerätelisten wurden generiert.");
});

app.post("/export/brandschutz", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateBrandschutzPdf(ROOT_DIR, data.projekt, data.brandschutz, data.systemSettings, data.matrix, data.geraetelisten, data.leistungsbereiche, data.anhaenge);
  const photoWarnings = await inspectBrandschutzPhotos(ROOT_DIR, data.projekt, data.brandschutz);
  redirectWithFlash(res, "/export", photoWarnings.length ? "warning" : "success", `Brandschutzdokumentation wurde generiert.${photoWarnings.length ? ` ${photoWarnings.length} Fotoverweis(e) führen zu fehlenden oder nicht zugreifbaren Dateien.` : ""}`);
});

app.post("/export/trennstreifen", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  const settingsPath = path.join(CONFIG_DIR, "systemEinstellungen.json");
  // * INFO: Die Trennstreifen-Optionen werden gespeichert, damit die UI nach dem Generieren stabil bleibt.
  const separatorOptions = {
    showInnenText: req.body.showInnenText === "1",
    showRegisterTitel: req.body.showRegisterTitel === "1"
  };
  const currentSettings = mergeSystemSettings(await readJson(settingsPath, DEFAULT_SYSTEM_SETTINGS));
  const updatedSettings = {
    ...currentSettings,
    export: {
      ...currentSettings.export,
      trennstreifen: separatorOptions
    }
  };
  await writeJson(settingsPath, updatedSettings);
  const generated = await generateTrennstreifen(ROOT_DIR, data.projekt, data.matrix, updatedSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche, separatorOptions);
  redirectWithFlash(res, "/export", "success", `Trennstreifen wurden separat generiert (${generated.length} PDF).`);
});

app.post("/export/ordnerruecken", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  data.exportliste = await currentExportEntries(data);
  const settingsPath = path.join(CONFIG_DIR, "systemEinstellungen.json");
  const currentSettings = mergeSystemSettings(await readJson(settingsPath, DEFAULT_SYSTEM_SETTINGS));
  const pagesPerBinder = Math.max(1, Math.min(5000, Number(req.body.seitenProOrdner) || currentSettings.export.ordnerruecken.seitenProOrdner || 80));
  const mode = req.body.anzahlModus === "auto" ? "auto" : "manuell";
  const format = req.body.format === "schmal"
    ? "38x192-r"
    : req.body.format === "breit"
      ? "61x192-r"
      : ["38x192-r", "61x192-r"].includes(req.body.format)
        ? req.body.format
        : "61x192-r";
  const binderOptions = {
    format,
    anzahlModus: mode,
    ordnerAnzahl: mode === "auto" ? estimateBinderCount(data, pagesPerBinder) : Math.max(1, Math.min(999, Number(req.body.ordnerAnzahl) || 1)),
    seitenProOrdner: pagesPerBinder,
    showProjektname: req.body.showProjektname === "1",
    showProjektnummer: req.body.showProjektnummer === "1",
    showAuftraggeber: req.body.showAuftraggeber === "1",
    showLiegenschaft: req.body.showLiegenschaft === "1",
    showBaumassnahme: req.body.showBaumassnahme === "1",
    showOrdnernummer: req.body.showOrdnernummer === "1",
    showFormatHint: req.body.showFormatHint === "1"
  };
  const updatedSettings = {
    ...currentSettings,
    export: {
      ...currentSettings.export,
      ordnerruecken: binderOptions
    }
  };
  await writeJson(settingsPath, updatedSettings);
  const generated = await generateOrdnerruecken(ROOT_DIR, data.projekt, updatedSettings, binderOptions);
  redirectWithFlash(res, "/export", "success", `Ordnerrücken wurden generiert (${generated.length} PDF, ${binderOptions.ordnerAnzahl} Ordner).`);
});

app.post("/export/exportliste", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await buildExportliste(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche, { brandschutz: data.brandschutz });
  redirectWithFlash(res, "/export", "success", "Exportliste wurde aktualisiert.");
});

app.post("/export/final", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    await generateCompleteDocumentation(ROOT_DIR, data);
    const result = await prepareFinalExport(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, { systemSettings: data.systemSettings, brandschutz: data.brandschutz, leistungsbereiche: data.leistungsbereiche });
    const missingPdfs = result.missingFiles.length + result.skippedMergeFiles.length + result.unassignedFiles.length;
    const warnings = missingPdfs + result.photoWarnings.length;
    const notes = [missingPdfs ? `${missingPdfs} PDF-Datei(en) fehlen oder konnten nicht übernommen werden.` : "",
      result.photoWarnings.length ? `${result.photoWarnings.length} Brandschutz-Fotoverweis(e) führen zu fehlenden oder nicht zugreifbaren Dateien.` : ""].filter(Boolean);
    const message = `${warnings ? "Unvollständiger Export" : "Export erstellt"}: Gesamt-PDF mit ${result.completePdfPages} Seiten, ${result.summary.present} Einzel-PDFs.${notes.length ? ` ${notes.join(" ")} Details in der Reihenfolge-Datei.` : ""}`;
    // Die vollständige Indexberechnung bleibt auch bei fachlich unvollständiger Ausgabe gültig.
    res.locals.projectDataCommitOnWarning = true;
    redirectWithFlash(res, "/export", warnings ? "error" : "success", message.trim());
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

// * INFO: Einstellungen: Systemvorgaben, Erstellerstammdaten, Ordnerstruktur und Formulare.
async function renderSettings(req, res, { createdToken = null, integrationError = "", initialSettingsTab = "" } = {}) {
    const data = await loadCurrent(req);
    const isSystemAdmin = req.user && req.user.role === "systemadmin";
    res.render("einstellungen", {
      active: "einstellungen",
      systemSettings: data.systemSettings,
      themePresets: THEME_PRESETS,
      ordnerstruktur: data.ordnerstruktur,
      leistungsbereiche: data.leistungsbereiche,
      systemConfig: data.systemConfig,
      templates: data.templates,
      geraetelistenVorlagen: normalizeGeraetelistenVorlagen(await readJson(GERAETELISTEN_VORLAGEN_FILE, [])),
      isSystemAdmin,
      integrationSettings: await integrationSettings.read(),
      apiKeys: apiTokens.list(req.user.id), apiScopes, createdToken, integrationError, initialSettingsTab,
      availableProjects: (await listProjects(ROOT_DIR, req.user.id)).filter(project => project.status !== "geloescht"),
      integrationOrigin: process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`,
      users: isSystemAdmin ? listUsers() : [],
      userRoles: USER_ROLES,
      userRoleLabels: USER_ROLE_LABELS,
      appVersion: APP_VERSION,
      appName: APP_NAME,
      releaseNotes: await readReleaseNotes()
    });
}
app.get("/einstellungen", requireAuth, async (req, res) => renderSettings(req, res));
app.get("/einstellungen/api", requireAuth, (_req, res) => res.redirect("/einstellungen#api"));

app.get("/einstellungen/protokoll", requireSystemAdmin, async (req,res) => {
  const labels = { login: "Anmeldung", registration: "Registrierung", logout: "Abmeldung", "account.create": "Konto angelegt", "account.role": "Kontorolle", "account.status": "Kontostatus", "account.password": "Passwortänderung", "settings.change": "Einstellungen", "archive.export": "Projektpaket exportiert", "archive.import": "Projektpaket importiert", "archive.validate": "Projektpaket geprüft", "documentation.export": "Dokumentation exportiert", "project.create": "Projekt angelegt", "project.open": "Projekt geöffnet", "project.archive": "Projekt archiviert", "project.delete": "Projekt entfernt", "attachment.delete": "Anhang entfernt" };
  const results = { attempt: "Versuch", success: "Erfolgreich", warning: "Mit Hinweisen", failure: "Abgewiesen / fehlgeschlagen", interrupted: "Unterbrochen" };
  const users = new Map(listUsers().map(user => [user.id,user.name]));
  let events=[],auditError="";
  try { events=(await audit.read({ limit: 200 })).reverse().map(event => ({ ...event, label: labels[event.event] || "Verwaltungsaktion", actorName: users.get(event.actorId) || event.actorId || "Nicht angemeldet", resultLabel: results[event.outcome] })); }
  catch { auditError="Das Protokoll ist beschädigt oder nicht lesbar. Bitte eine Kopie sichern und die Protokollablage prüfen."; }
  res.render("audit",{events,auditError});
});

app.get("/integrationen", requireAuth, (_req, res) => res.redirect("/einstellungen#api"));
app.post("/einstellungen/integrationen", requireSystemAdmin, async (req, res) => {
  try {
    await integrationSettings.save({
      apiEnabled: req.body.apiEnabled === "on", allowWrites: req.body.allowWrites === "on",
      defaultTokenDays: Number(req.body.defaultTokenDays), maxTokenDays: Number(req.body.maxTokenDays)
    });
    redirectWithFlash(res, "/einstellungen#api", "success", "API-Einstellungen gespeichert. Die Änderungen gelten sofort.");
  } catch (error) {
    res.status(error.status || 500);
    await renderSettings(req, res, { integrationError: error.message, initialSettingsTab: "api" });
  }
});
app.post("/integrationen/schluessel", requireAuth, async (req, res) => {
  try {
    const settings = await integrationSettings.read();
    const days = Number(req.body.days);
    if (!Number.isInteger(days) || days < 1 || days > settings.maxTokenDays) throw Object.assign(new Error(`Die Gültigkeit muss zwischen 1 und ${settings.maxTokenDays} Tagen liegen.`), { status: 400 });
    if (!["selected", "all"].includes(req.body.projectMode)) throw Object.assign(new Error("Bitte den Projektzugriff ausdrücklich auswählen."), { status: 400 });
    const scopes = Array.isArray(req.body.scopes) ? req.body.scopes : req.body.scopes ? [req.body.scopes] : [];
    const projectIds = req.body.projectMode === "selected"
      ? (Array.isArray(req.body.projectIds) ? req.body.projectIds : req.body.projectIds ? [req.body.projectIds] : []) : null;
    const created = apiTokens.create(req.user.id, { name: req.body.name, scopes, projectIds, days });
    await renderSettings(req, res, { createdToken: created, initialSettingsTab: "api" });
  } catch (error) {
    res.status(error.status || 400);
    await renderSettings(req, res, { integrationError: error.message, initialSettingsTab: "api" });
  }
});
app.post("/integrationen/schluessel/:tokenId/widerrufen", requireAuth, async (req, res) => {
  apiTokens.revoke(req.user.id, req.params.tokenId);
  redirectWithFlash(res, "/einstellungen#api", "success", "API-Schlüssel wurde widerrufen.");
});

app.get("/einstellungen/update-check", requireAuth, async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // * INFO: Es wird nur die neueste GitHub-Release gelesen. Es findet kein automatisches Update statt.
    const response = await fetch(GITHUB_RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `${APP_NAME}/${APP_VERSION}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.status === 404) {
      res.json({
        ok: true,
        currentVersion: APP_VERSION,
        latestVersion: "",
        hasUpdate: false,
        releaseName: "Keine GitHub Releases gefunden",
        releaseUrl: "https://github.com/loserat/edoku/releases",
        message: "Noch kein GitHub Release veroeffentlicht. Die lokalen Release Notes sind der aktuelle Stand."
      });
      return;
    }

    if (!response.ok) {
      throw new Error(`GitHub antwortet mit Status ${response.status}`);
    }

    const release = await response.json();
    const latestVersion = normalizeVersionTag(release.tag_name || release.name || "");

    res.json({
      ok: true,
      currentVersion: APP_VERSION,
      latestVersion,
      hasUpdate: compareVersions(latestVersion, APP_VERSION) > 0,
      releaseName: release.name || release.tag_name || latestVersion,
      releaseUrl: release.html_url || "https://github.com/loserat/edoku/releases",
      publishedAt: release.published_at || ""
    });
  } catch (error) {
    clearTimeout(timeout);
    res.json({
      ok: false,
      currentVersion: APP_VERSION,
      message: `Update-Pruefung nicht moeglich: ${error.message}`
    });
  }
});

app.post("/einstellungen/system", requireAuth, async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    const next = { ...current, ...normalizePostedSystemSettings(req.body), ersteller: current.ersteller };
    // ! WICHTIG: Branding-/Lizenzwerte duerfen nur Systemadmins veraendern.
    if (req.user && req.user.role === "systemadmin") {
      next.lizenz = {
        ...current.lizenz,
        brandingAktiv: req.body.brandingAktiv === "on"
      };
    }
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), next);
    okOrRedirect(req, res, "/einstellungen#system");
  } catch (error) {
    fail(req, res, "/einstellungen#system", error);
  }
});

app.post("/einstellungen/registrierung", requireSystemAdmin, async (req, res) => {
  try {
    const file = path.join(CONFIG_DIR, "systemEinstellungen.json");
    const current = await readJson(file, {});
    await writeJson(file, { ...current, selfRegistrationEnabled: req.body.selfRegistrationEnabled === "on" });
    okOrRedirect(req, res, "/einstellungen#benutzer", "Registrierungseinstellung wurde gespeichert.");
  } catch (error) { fail(req, res, "/einstellungen#benutzer", error); }
});

app.post("/einstellungen/benutzer", requireSystemAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim() || email;
    const password = validateNewPassword(req.body.password);
    if (!email) throw Object.assign(new Error("Bitte eine Loginkennung angeben."), { status: 400 });
    if (getUserByEmail(email)) throw Object.assign(new Error("Dieser Benutzer existiert bereits."), { status: 409 });
    if (!USER_ROLES.includes(req.body.role)) throw Object.assign(new Error("Ungültige Benutzerrolle."), { status: 400 });
    const { passwordHash, salt } = hashSeedPassword(password);
    const now = new Date().toISOString();
    createUser({
      id: `user_${email.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase()}_${crypto.randomBytes(3).toString("hex")}`,
      email,
      name,
      role: normalizeUserRole(req.body.role),
      status: "active",
      passwordHash,
      passwordSalt: salt,
      currentProjectId: "projekt_demo",
      createdAt: now,
      updatedAt: now
    });
    okOrRedirect(req, res, "/einstellungen#benutzer", "Benutzer wurde angelegt.");
  } catch (error) {
    fail(req, res, "/einstellungen#benutzer", error);
  }
});

app.post("/einstellungen/benutzer/:userId/rolle", requireSystemAdmin, async (req, res) => {
  try {
    const nextRole = req.body.role;
    if (req.params.userId === req.user.id && nextRole !== "systemadmin") {
      throw new Error("Du kannst deinem eigenen Konto nicht die Systemadmin-Rolle entziehen.");
    }
    updateUserRole(req.params.userId, nextRole);
    okOrRedirect(req, res, "/einstellungen#benutzer", "Benutzerrolle wurde aktualisiert.");
  } catch (error) {
    fail(req, res, "/einstellungen#benutzer", error);
  }
});

app.post("/einstellungen/benutzer/:userId/passwort", requireSystemAdmin, async (req, res) => {
  try {
    if (!getUserById(req.params.userId)) throw Object.assign(new Error("Das Benutzerkonto wurde nicht gefunden. Bitte die Benutzerliste neu laden."), { status: 404 });
    const password = validateNewPassword(req.body.password);
    const { passwordHash, salt } = hashSeedPassword(password);
    updateUserPassword(req.params.userId, passwordHash, salt);
    deleteSessionsForUser(req.params.userId);
    okOrRedirect(req, res, "/einstellungen#benutzer", "Benutzerpasswort wurde zurückgesetzt.");
  } catch (error) {
    fail(req, res, "/einstellungen#benutzer", error);
  }
});

app.post("/einstellungen/benutzer/:userId/status", requireSystemAdmin, async (req, res) => {
  try {
    const nextStatus = req.body.status;
    if (req.params.userId === req.user.id && nextStatus === "disabled") {
      throw new Error("Du kannst dein eigenes Konto nicht sperren.");
    }
    updateUserStatus(req.params.userId, nextStatus);
    if (nextStatus === "disabled") deleteSessionsForUser(req.params.userId);
    okOrRedirect(req, res, "/einstellungen#benutzer", nextStatus === "disabled" ? "Benutzer wurde gesperrt." : "Benutzer wurde aktiviert.");
  } catch (error) {
    fail(req, res, "/einstellungen#benutzer", error);
  }
});

app.post("/einstellungen/theme", requireAuth, async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {
      ...current,
      theme: normalizePostedThemeSettings(req.body, current.theme)
    });
    okOrRedirect(req, res, "/einstellungen#theme-editor", "Theme wurde gespeichert.");
  } catch (error) {
    fail(req, res, "/einstellungen#theme-editor", error);
  }
});

app.post("/einstellungen/theme/defaults", requireAuth, async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {
      ...current,
      theme: DEFAULT_THEME_SETTINGS
    });
    okOrRedirect(req, res, "/einstellungen#theme-editor", "Theme wurde auf Apple Light zurückgesetzt.");
  } catch (error) {
    fail(req, res, "/einstellungen#theme-editor", error);
  }
});

app.post("/einstellungen/ersteller", requireAuth, async (req, res) => {
  try {
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), normalizePostedErstellerStammdaten(req.body, await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {})));
    okOrRedirect(req, res, "/einstellungen#ersteller");
  } catch (error) {
    fail(req, res, "/einstellungen#ersteller", error);
  }
});

app.get("/einstellungen/ersteller-logo", requireAuth, async (req, res, next) => {
  try {
    const settings = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    const logoPath = resolveCreatorLogo(STORAGE_DIR, settings.ersteller.logoPfad);
    res.sendFile(logoPath);
  } catch (error) {
    next(error);
  }
});

app.post("/einstellungen/ersteller-logo", requireAuth, express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    const previousLogoPath = current.ersteller.logoPfad;
    const logoPfad = await saveCreatorLogo(STORAGE_DIR, req.body, req.headers["content-type"] || "");
    if (previousLogoPath && previousLogoPath !== logoPfad) {
      try {
        await fsp.unlink(resolveCreatorLogo(STORAGE_DIR, previousLogoPath));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {
      ...current,
      ersteller: { ...current.ersteller, logoPfad }
    });
    redirectWithFlash(res, "/einstellungen#ersteller", "success", "Logo wurde importiert.");
  } catch (error) {
    redirectWithFlash(res, "/einstellungen#ersteller", "error", error.message);
  }
});

app.post("/einstellungen/ersteller-logo/loeschen", requireAuth, async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    if (current.ersteller.logoPfad) {
      try {
        await fsp.unlink(resolveCreatorLogo(STORAGE_DIR, current.ersteller.logoPfad));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {
      ...current,
      ersteller: { ...current.ersteller, logoPfad: "" }
    });
    redirectWithFlash(res, "/einstellungen#ersteller", "success", "Logo wurde gelöscht.");
  } catch (error) {
    redirectWithFlash(res, "/einstellungen#ersteller", "error", error.message);
  }
});

app.post("/einstellungen/ordnerstruktur", requireAuth, async (req, res) => {
  try {
    await writeJson(path.join(CONFIG_DIR, "ordnerstruktur.json"), normalizePostedOrdnerstruktur(req.body, await readJson(path.join(CONFIG_DIR, "ordnerstruktur.json"), {})));
    okOrRedirect(req, res, "/einstellungen#ordnerstruktur");
  } catch (error) {
    fail(req, res, "/einstellungen#ordnerstruktur", error);
  }
});

app.post("/einstellungen/geraetelisten-vorlagen", requireAuth, async (req, res) => {
  try {
    const currentTemplates = await readJson(GERAETELISTEN_VORLAGEN_FILE, []);
    await writeJson(GERAETELISTEN_VORLAGEN_FILE, normalizePostedGeraetelistenVorlagen(req.body.vorlagen, currentTemplates));
    okOrRedirect(req, res, "/einstellungen#geraetelisten-vorlagen");
  } catch (error) {
    fail(req, res, "/einstellungen#geraetelisten-vorlagen", error);
  }
});

app.post("/einstellungen/leistungsbereiche", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.leistungsbereiche, normalizePostedLeistungsbereiche(req.body, await readJson(files.leistungsbereiche, {})));
    await syncProjectDerivedData(files);
    okOrRedirect(req, res, "/einstellungen#leistungsbereiche-admin");
  } catch (error) {
    fail(req, res, "/einstellungen#leistungsbereiche-admin", error);
  }
});

app.post("/einstellungen/leistungsbereiche-formulare", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    await writeJson(files.leistungsbereiche, normalizePostedLeistungsbereiche(req.body, await readJson(files.leistungsbereiche, {})));
    await writeJson(path.join(CONFIG_DIR, "formularTemplates.json"), normalizePostedFormTemplates(req.body));
    await syncProjectDerivedData(files);
    okOrRedirect(req, res, "/einstellungen#leistungsbereiche-admin", "Leistungsbereiche und Formulare wurden gespeichert.");
  } catch (error) {
    fail(req, res, "/einstellungen#leistungsbereiche-admin", error);
  }
});

app.post("/einstellungen/leistungsbereiche/defaults", requireAuth, async (req, res) => {
  const files = await currentFiles(req);
  await writeJson(files.leistungsbereiche, { optionen: DEFAULT_LEISTUNGSBEREICHE, aktiv: [], systemAuswahl: {} });
  await syncProjectDerivedData(files);
  redirectWithFlash(res, "/einstellungen#leistungsbereiche-admin", "success", "Leistungsbereiche-Defaults wurden wiederhergestellt.");
});

app.post("/einstellungen/systemdefaults", requireAuth, async (req, res) => {
  try {
    await writeJson(path.join(DATA_DIR, "systeme.json"), normalizePostedSystemConfig(req.body.systemDefaults));
    const files = await currentFiles(req);
    await syncProjectDerivedData(files);
    okOrRedirect(req, res, "/einstellungen#systemdefaults");
  } catch (error) {
    fail(req, res, "/einstellungen#systemdefaults", error);
  }
});

app.post("/einstellungen/formulare", requireAuth, async (req, res) => {
  try {
    await writeJson(path.join(CONFIG_DIR, "formularTemplates.json"), normalizePostedFormTemplates(req.body));
    okOrRedirect(req, res, "/einstellungen#formulare");
  } catch (error) {
    fail(req, res, "/einstellungen#formulare", error);
  }
});

// * INFO: Projektarchiv: Projektpakete exportieren, prüfen und wieder importieren.
app.get("/projektarchiv", requireAuth, async (req, res, next) => {
  try {
    res.render("projektarchiv", {
      active: "projektarchiv",
      currentProjectId: res.locals.currentProjectId,
      exports: await listExports(ROOT_DIR, req.user.id, res.locals.currentProjectId),
      importOrdner: req.query.importOrdner || "projekt_export",
      validation: null
    });
  } catch (error) {
    next(error);
  }
});

app.post("/projektarchiv/exportieren", requireAuth, async (req, res) => {
  try {
    const result = await exportProject(ROOT_DIR, req.body.projectId || res.locals.currentProjectId, req.user.id, Object.fromEntries(["includeUploads","includeGenerated","includeFinal","createZip"].map(key => [key, req.body[key] === "on"])));
    redirectWithFlash(res, "/projektarchiv", result.complete ? "success" : "warning", result.complete ? "Projektpaket wurde geprüft und exportiert." : "Projektpaket mit Hinweisen erstellt. Nicht enthaltene Bereiche, bereits fehlende Quelldateien und separat erhaltene Alt-Ausgaben stehen im Manifest.");
  } catch (error) {
    fail(req, res, "/projektarchiv", error);
  }
});

app.post("/projektarchiv/validieren", requireAuth, async (req, res) => {
  const { validateProjectArchive, storagePaths } = require("./services/projectArchiveService");
  const importOrdner = req.body.importOrdner || "projekt_export";
  try {
    const validation = await validateProjectArchive(await resolveImportDirectory(ROOT_DIR, req.user.id, importOrdner));
    res.render("projektarchiv", {
      active: "projektarchiv",
      currentProjectId: res.locals.currentProjectId,
      exports: await listExports(ROOT_DIR, req.user.id, res.locals.currentProjectId),
      importOrdner,
      validation
    });
  } catch (error) {
    fail(req, res, "/projektarchiv", error);
  }
});

app.post("/projektarchiv/importieren", requireAuth, async (req, res) => {
  try {
    const imported = await importProject(ROOT_DIR, req.body.importOrdner || "projekt_export", req.user.id);
    res.locals.auditIdentity = { targetId: imported.projectId };
    redirectWithFlash(res, "/projekte", "success", "Projekt wurde importiert.");
  } catch (error) {
    fail(req, res, "/projektarchiv", error);
  }
});

app.get("/projektarchiv/download", requireAuth, async (req, res, next) => {
  try {
    const filePath = await resolveArchiveDownload(ROOT_DIR, req.user.id, req.query.pfad || "");
    res.download(filePath);
  } catch (error) {
    next(error);
  }
});

// * INFO: Anhänge: importierte PDFs und Bilder verwalten, kategorisieren und zuordnen.
app.get("/anhaenge", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const attachmentCategories = [
      "Brandschutz",
      ...DOCUMENT_ATTACHMENT_CATEGORIES.map((entry) => entry.category),
      "Fotos",
      "Pläne",
      "Nachweise",
      "Allgemein"
    ];
    const selectedKategorie = attachmentCategories.includes(req.query.kategorie) ? req.query.kategorie : attachmentCategories[0];
    const categoryDefaults = defaultDocumentMetaForCategory(selectedKategorie);
    const attachmentView = await buildAttachmentViewModel(data.anhaenge, data.brandschutz, data.matrix, data.projekt, data.geraetelisten, data.leistungsbereiche, data.files);
    const attachmentRows = attachmentView.rows
      .filter((entry) => entry.category === selectedKategorie)
      .sort((a, b) => {
        const sortA = a.tocEntry && Number.isFinite(a.tocEntry.sortierung) ? a.tocEntry.sortierung : 999999;
        const sortB = b.tocEntry && Number.isFinite(b.tocEntry.sortierung) ? b.tocEntry.sortierung : 999999;
        if (sortA !== sortB) return sortA - sortB;
        return String(a.title || a.originalName || "").localeCompare(String(b.title || b.originalName || ""), "de", {
          numeric: true,
          sensitivity: "base"
        });
      });
    res.render("anhaenge", {
      active: "anhaenge",
      anhaenge: attachmentRows,
      attachmentStats: attachmentView.stats,
      attachmentCounts: attachmentView.countsByCategory,
      attachmentCategories,
      documentAttachmentCategories: DOCUMENT_ATTACHMENT_CATEGORIES,
      categoryDefaults,
      selectedKategorie,
      stockwerke: mergeStockwerkOptions(
        data.projekt.stockwerke,
        data.anhaenge.map((entry) => entry.stockwerk)
      ),
      brandschutz: data.brandschutz
    });
  } catch (error) {
    next(error);
  }
});

app.post("/anhaenge/upload", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const upload = await parseMultipartUpload(req);
    const allowedCategories = [
      "Brandschutz",
      ...DOCUMENT_ATTACHMENT_CATEGORIES.map((entry) => entry.category),
      "Fotos",
      "Pläne",
      "Nachweise",
      "Allgemein"
    ];
    upload.fields.category = allowedCategories.includes(req.query.kategorie) ? req.query.kategorie : "Brandschutz";
    const categoryDefaults = defaultDocumentMetaForCategory(upload.fields.category);
    if (!upload.fields.kapitel) upload.fields.kapitel = categoryDefaults.kapitel || "";
    let nextAttachments = await readJson(files.anhaenge, []);
    const uploadFiles = upload.files && upload.files.length ? upload.files : [upload.file].filter(Boolean);
    for (const file of uploadFiles) {
      nextAttachments = await saveAttachment(ROOT_DIR, files, nextAttachments, { ...upload, file });
    }
    await writeJson(files.anhaenge, nextAttachments);
    const target = `/anhaenge?kategorie=${encodeURIComponent(upload.fields.category)}`;
    redirectWithFlash(res, target, "success", `${uploadFiles.length} Datei(en) wurden hochgeladen.`);
  } catch (error) {
    fail(req, res, "/anhaenge", error);
  }
});

app.post("/anhaenge/:id/aktualisieren", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    // * INFO: Metadatenänderungen können den logischen Dateinamen verändern.
    // * INFO: Brandschutz-Verweise müssen deshalb nach dem Umbenennen mitgezogen werden.
    const nextAttachments = updateAttachmentDocumentMeta(await readJson(files.anhaenge, []), req.params.id, {
      title: req.body.title,
      category: req.body.category,
      kapitel: req.body.kapitel,
      stockwerk: req.body.stockwerk,
      anlage: req.body.anlage,
      verteiler: req.body.verteiler,
      plannummer: req.body.plannummer,
      revision: req.body.revision,
      bereich: req.body.bereich,
      messart: req.body.messart,
      normgrundlage: req.body.normgrundlage,
      datum: req.body.datum,
      sortierung: req.body.sortierung,
      export: Object.prototype.hasOwnProperty.call(req.body, "export") ? req.body.export === "on" : undefined
    });
    const synced = await syncAttachmentFileName(ROOT_DIR, files, nextAttachments, req.params.id);
    await writeJson(files.anhaenge, synced.attachments);
    const updatedTarget = normalizeAttachments(synced.attachments).find((entry) => entry.id === req.params.id);
    const [selectedBrandschutzId, selectedBrandschutzSlot] = String(req.body.brandschutzSlot || "").split("|");
    const shouldAssignBrandschutzImage =
      updatedTarget &&
      updatedTarget.mimeType.startsWith("image/") &&
      selectedBrandschutzId &&
      selectedBrandschutzSlot;

    // * INFO: Bildzuordnungen werden bewusst hier gespeichert, damit das Popup
    // * INFO: nur einen Speichern-Button braucht und keine separate Zuordnen-Aktion.
    if (synced.renamed || shouldAssignBrandschutzImage) {
      let brandschutz = normalizeBrandschutz(await readJson(files.brandschutz, []));
      if (synced.renamed) {
        brandschutz = brandschutz.map((entry) => ({
          ...entry,
          foto_vorher: entry.foto_vorher === synced.renamed.oldRelativePath ? synced.renamed.newRelativePath : entry.foto_vorher,
          foto_nachher: entry.foto_nachher === synced.renamed.oldRelativePath ? synced.renamed.newRelativePath : entry.foto_nachher
        }));
      }
      if (shouldAssignBrandschutzImage) {
        brandschutz = clearAttachmentReferencesFromBrandschutz(brandschutz, updatedTarget.relativePath);
        brandschutz = assignAttachmentToBrandschutz(
          brandschutz,
          updatedTarget.relativePath,
          selectedBrandschutzId || "",
          selectedBrandschutzSlot || ""
        );
      }
      await writeJson(files.brandschutz, brandschutz);
    }
    const target = req.body.returnKategorie ? `/anhaenge?kategorie=${encodeURIComponent(req.body.returnKategorie)}` : "/anhaenge";
    okOrRedirect(req, res, target, "Anhang wurde aktualisiert.");
  } catch (error) {
    fail(req, res, "/anhaenge", error);
  }
});

app.post("/anhaenge/:id/loeschen", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const attachments = normalizeAttachments(await readJson(files.anhaenge, []));
    const target = attachments.find((entry) => entry.id === req.params.id);
    const brandschutz = target ? normalizeBrandschutz(await readJson(files.brandschutz, [])) : null;
    const nextAttachments = attachments.filter((entry) => entry.id !== req.params.id);
    let attachmentIndexWritten = false;
    let firestopIndexWritten = false;
    try {
      // Erst die Indizes aktualisieren; bei einem Dateifehler werden sie wiederhergestellt.
      await writeJson(files.anhaenge, nextAttachments);
      attachmentIndexWritten = true;
      if (target) {
        await writeJson(files.brandschutz, clearAttachmentReferencesFromBrandschutz(brandschutz, target.relativePath));
        firestopIndexWritten = true;
        await deleteAttachment(ROOT_DIR, [target], target.id, files);
      }
    } catch (error) {
      if (firestopIndexWritten) await writeJson(files.brandschutz, brandschutz).catch(() => {});
      if (attachmentIndexWritten) await writeJson(files.anhaenge, attachments).catch(() => {});
      throw error;
    }

    const targetCategory = target?.category || "Brandschutz";
    redirectWithFlash(res, `/anhaenge?kategorie=${encodeURIComponent(targetCategory)}`, "success", "Anhang wurde geloescht.");
  } catch (error) {
    fail(req, res, "/anhaenge", error);
  }
});

app.post("/anhaenge/:id/zuordnen", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
    const attachments = normalizeAttachments(await readJson(files.anhaenge, []));
    const target = attachments.find((entry) => entry.id === req.params.id);
    if (!target || !target.mimeType.startsWith("image/")) {
      throw new Error("Bildanhang wurde nicht gefunden.");
    }

    const brandschutz = normalizeBrandschutz(await readJson(files.brandschutz, []));
    const nextBrandschutz = assignAttachmentToBrandschutz(
      brandschutz,
      target.relativePath,
      req.body.brandschutzId || "",
      req.body.slot || ""
    );
    await writeJson(files.brandschutz, nextBrandschutz);
    redirectWithFlash(res, "/anhaenge", "success", "Bild wurde der Brandschottung zugeordnet.");
  } catch (error) {
    fail(req, res, "/anhaenge", error);
  }
});

app.get("/anhaenge/download", requireAuth, async (req, res, next) => {
  try {
    const files = await currentFiles(req);
    const attachments = normalizeAttachments(await readJson(files.anhaenge, []));
    const target = attachments.find((entry) => entry.id === req.query.id);
    if (!target) {
      res.status(404).render("placeholder", {
        active: "anhaenge",
        title: "Anhang nicht gefunden",
        heading: "Anhang nicht gefunden",
        text: "Der angeforderte Anhang gehoert nicht zum aktuellen Projekt."
      });
      return;
    }

    const filePath = await resolveAttachmentFile(ROOT_DIR, files, target.relativePath);
    res.download(filePath, target.fileName || target.originalName);
  } catch (error) {
    next(error);
  }
});

app.get("/anhaenge/preview", requireAuth, async (req, res, next) => {
  try {
    const files = await currentFiles(req);
    const attachments = normalizeAttachments(await readJson(files.anhaenge, []));
    const target = attachments.find((entry) => entry.id === req.query.id);
    if (!target) {
      res.status(404).send("Anhang nicht gefunden.");
      return;
    }

    // ! WICHTIG: Die Vorschau liefert nur Dateien aus der aktuellen Projektablage.
    // * INFO: safeJoin verhindert freie Serverpfade aus Benutzerinput.
    const filePath = await resolveAttachmentFile(ROOT_DIR, files, target.relativePath);
    const previewName = target.fileName || target.originalName || "anhang";
    res.type(await attachmentPreviewMime(filePath));
    res.setHeader("Content-Disposition", `inline; filename="${previewName.replace(/"/g, "")}"`);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).render("placeholder", {
    active: "",
    title: "Nicht gefunden",
    heading: "Seite nicht gefunden",
    text: "Diese Route ist im edoku nicht vorhanden."
  });
});

app.use((error, req, res, _next) => {
  if (req.apiRequestId) return apiError(error, req, res, _next);
  // Parserfehler können einen vollständigen Anfragekörper einschließlich Passwörtern
  // enthalten. Nur begrenzte technische Metadaten protokollieren.
  console.error("Anfrage fehlgeschlagen:", { status: error.status || 500, code: String(error.code || error.type || "REQUEST_FAILED").slice(0, 64) });
  if (res.headersSent) return _next(error);
  const status = error.status || 500;
  const message = error.type?.startsWith("entity.") ? "Die Anfrage ist ungültig oder überschreitet die zulässige Größe."
    : error.code && !["WRITE_FAILED","READ_FAILED"].includes(error.code) ? "Die Datei konnte nicht verarbeitet werden. Bitte die Eingabe und Zugriffsrechte prüfen." : error.message || "Ein unerwarteter Fehler ist aufgetreten.";
  if ((req.headers.accept || "").includes("application/json")) return res.status(status).json({ ok: false, error: message });
  res.status(status).render("placeholder", {
    active: "",
    title: "Fehler",
    heading: "Fehler",
    text: message
  });
});

const server = app.listen(PORT, () => {
  console.log(`edoku läuft auf http://localhost:${PORT}`);
});
exportJobs.start();

process.once("SIGTERM", () => server.close(async () => { await exportJobs.stop(); await audit.flush(); process.exit(0); }));
process.once("SIGINT", () => server.close(async () => { await exportJobs.stop(); await audit.flush(); process.exit(0); }));
