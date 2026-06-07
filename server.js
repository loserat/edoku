const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const express = require("express");

const { bootstrapStorage, DEFAULT_LEISTUNGSBEREICHE } = require("./services/bootstrapService");
const { readJson, writeJson } = require("./services/jsonService");
const { initDatabase, connection, getUserByEmail, createUser, migrateProjectsJson } = require("./services/dbService");
const { attachUser, endSession, loginUser, parseCookies, registerUser, requireAuth, startSession } = require("./services/authService");
const {
  createProject,
  ensureCurrentProject,
  exportProject,
  getCurrentDataFiles,
  importProject,
  listExports,
  listProjects,
  setCurrentProject,
  updateProjectStatus,
  upsertProjectFromData
} = require("./services/projectArchiveService");
const { createProjectFolder, fileSafeName } = require("./services/projectService");
const { buildDashboardStats } = require("./services/dashboardService");
const { buildExportPreview } = require("./services/exportPreviewService");
const { listPdfPreviewFiles, listFinalExportFiles, resolvePdfPreviewFile, resolveExportDownloadFile } = require("./services/pdfPreviewService");
const { buildExportliste, prepareFinalExport } = require("./services/exportService");
const { generateBrandschutzPdf, generateDeckblaetter, generateFormularPdfs, generateGeraetelisten, generateInhaltsverzeichnis, generateTrennstreifen } = require("./services/pdfService");
const { applyLogicalChapterNumbers, sortDocuments } = require("./services/chapterNumberingService");
const { BRANDSCHUTZ_REQUIRED_FIELDS, addBrandschutzEintrag, normalizeBrandschutz, normalizePostedBrandschutz } = require("./services/brandschutzService");
const { deviceListFieldsForLeistungsbereich, normalizeGeraetelisten, normalizePostedGeraetelisten, syncGeraetelistenFromLeistungsbereiche } = require("./services/geraetelistenService");
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
  syncAttachmentFileName
} = require("./services/attachmentService");
const {
  DOCUMENT_ATTACHMENT_CATEGORIES,
  buildDocumentationAttachmentEntries,
  defaultDocumentMetaForCategory,
  updateAttachmentDocumentMeta
} = require("./services/documentAttachmentService");

// Zentrale Pfade der Anwendung. Alle Dateioperationen werden relativ zu
// diesen Ordnern aufgebaut, damit lokaler Start und Docker-Start gleich laufen.
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
const STORAGE_DIR = path.join(ROOT_DIR, "storage");
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_STOCKWERKE = ["UG", "EG", "1. OG", "2. OG", "3. OG", "4. OG", "5. OG", "DG", "Dach"];

// Startinitialisierung: Ordner und Default-Dateien vorbereiten, Datenbank
// öffnen, Demo-Benutzer bereitstellen und ältere Projektregister migrieren.
bootstrapStorage({ ROOT_DIR, DATA_DIR, CONFIG_DIR, OUTPUT_DIR, TEMPLATES_DIR, STORAGE_DIR });
initDatabase(STORAGE_DIR);
ensureDefaultUser();
migrateProjectsJson(ROOT_DIR);

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(ROOT_DIR, "views"));
app.set("query parser", "extended");

app.use(express.static(path.join(ROOT_DIR, "public")));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(express.json({ limit: "25mb" }));
app.use(parseCookies);
app.use(attachUser);

// Gemeinsamer Template-Kontext für eingeloggte Benutzer. Die Views nutzen diese
// Werte für Flash-Meldungen, Projektanzeige und die Projektliste in der Sidebar.
app.use(async (req, res, next) => {
  res.locals.flash = flashFromQuery(req);
  res.locals.currentProjectId = "";
  res.locals.currentProjectName = "";
  res.locals.projectSidebarProjects = [];
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
    res.locals.projectSidebarProjects = await listProjects(ROOT_DIR, req.user.id);
    const currentProject = res.locals.projectSidebarProjects.find((project) => project.id === current.projectId);
    res.locals.currentProjectName = currentProject ? currentProject.projektname || currentProject.id : current.projectId;
  } catch (error) {
    console.error("Projektkontext konnte nicht vorbereitet werden:", error.message);
  }

  next();
});

// Lokaler Demo-Benutzer für Version 1. Das Passwort wird nicht im Klartext
// gespeichert, sondern bei jedem Start als Hash/Salt-Kombination gesetzt.
function ensureDefaultUser() {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync("admin", salt, 64).toString("hex");
  const now = new Date().toISOString();
  const existingAdmin = getUserByEmail("admin");
  if (existingAdmin) {
    connection().prepare(`
      UPDATE users
      SET name = 'admin',
          password_hash = ?,
          password_salt = ?,
          updated_at = ?
      WHERE lower(email) = lower('admin')
    `).run(passwordHash, salt, now);
    return;
  }
  const existingLegacyUser = getUserByEmail("nick");
  if (existingLegacyUser) {
    connection().prepare(`
      UPDATE users
      SET email = 'admin',
          name = 'admin',
          password_hash = ?,
          password_salt = ?,
          updated_at = ?
      WHERE lower(email) = lower('nick')
    `).run(passwordHash, salt, now);
    return;
  }
  createUser({
    id: "user_demo",
    email: "admin",
    name: "admin",
    passwordHash,
    passwordSalt: salt,
    currentProjectId: "projekt_demo",
    createdAt: now,
    updatedAt: now
  });
}

function flashFromQuery(req) {
  return {
    success: req.query.success || "",
    error: req.query.error || ""
  };
}

// Fügt nach einem Redirect eine Erfolg- oder Fehlermeldung als Query-Parameter an.
function redirectWithFlash(res, target, type, message) {
  const [baseTarget, hash = ""] = target.split("#");
  const joiner = baseTarget.includes("?") ? "&" : "?";
  const hashSuffix = hash ? `#${hash}` : "";
  res.redirect(`${baseTarget}${joiner}${type}=${encodeURIComponent(message)}${hashSuffix}`);
}

// Einheitlicher Erfolgsweg für normale Formular-POSTs und Auto-Save-Requests.
function okOrRedirect(req, res, target, message = "Gespeichert.") {
  if ((req.headers.accept || "").includes("application/json")) {
    res.json({ ok: true, message });
    return;
  }
  redirectWithFlash(res, target, "success", message);
}

// Einheitliche Fehlerantwort für HTML-Formulare und JSON-basierte Auto-Saves.
function fail(req, res, target, error) {
  const message = error && error.message ? error.message : String(error || "Fehler");
  if ((req.headers.accept || "").includes("application/json")) {
    res.status(500).json({ ok: false, error: message });
    return;
  }
  redirectWithFlash(res, target, "error", message);
}

// Normalisiert frei eingegebene Stockwerke zu einer eindeutigen Liste.
function normalizeStockwerke(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,;]/);
  return [...new Set(raw
    .map((entry) => String(entry || "").trim())
    .filter(Boolean))];
}

// Kombiniert Preset-Auswahl und freie Stockwerksangaben aus dem Projektformular.
function normalizePostedStockwerke(body) {
  return normalizeStockwerke([
    ...(Array.isArray(body.stockwerkePreset) ? body.stockwerkePreset : body.stockwerkePreset ? [body.stockwerkePreset] : []),
    ...(String(body.stockwerkeCustom || "").split(/[\n,;]/))
  ]);
}

// Bereitet Stockwerke für Textarea-Ausgaben als mehrzeiligen Text vor.
function stockwerkeText(projekt) {
  return normalizeStockwerke(projekt.stockwerke || []).join("\n");
}

// Erweitert Dropdown-Optionen um bereits gespeicherte Werte aus vorhandenen Daten.
function mergeStockwerkOptions(stockwerke, values = []) {
  return [...new Set([
    ...normalizeStockwerke(stockwerke),
    ...values.map((value) => String(value || "").trim()).filter(Boolean)
  ])];
}

// Prüft projektbezogene Anhangspfade innerhalb des erlaubten Root-Verzeichnisses.
async function fileExistsForAttachment(relativePath) {
  if (!relativePath) return false;
  try {
    await fsp.access(safeJoin(ROOT_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Baut die View-Daten für die Anhangsverwaltung.
 * Ergänzt Rohdaten um Dateistatus, Typ-Erkennung, Inhaltsverzeichnis-Zuordnung
 * und Brandschutz-Fotoverweise.
 */
async function buildAttachmentViewModel(attachments, brandschutz, matrix, projekt = {}) {
  const tocEntries = buildDocumentationAttachmentEntries(matrix, attachments, projekt);
  const tocByAttachmentId = new Map(tocEntries.map((entry) => [entry.attachmentId, entry]));
  const rows = await Promise.all(normalizeAttachments(attachments).map(async (entry) => {
    const assignedFoto1 = (brandschutz || []).filter((schottung) => schottung.foto_vorher === entry.relativePath);
    const assignedFoto2 = (brandschutz || []).filter((schottung) => schottung.foto_nachher === entry.relativePath);
    const tocEntry = tocByAttachmentId.get(entry.id);
    const exists = await fileExistsForAttachment(entry.relativePath);
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
      documentStatus: isPdf && tocEntry
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

// Baut eine Browser-URL für vorhandene PDF-Vorschauen innerhalb des Projektordners.
function pdfPreviewUrl(file) {
  return file ? `/export/pdf-preview?file=${encodeURIComponent(file.id)}#toolbar=1` : "";
}

// Sucht in den generierten PDFs nach einem Dateinamen-Muster, ohne Kapitelnummern
// doppelt berechnen zu müssen. Die Kapitelnummer steht im Dateipräfix und darf
// sich durch aktive Leistungsbereiche logisch ändern.
function findGeneratedPdf(pdfPreviewFiles, folderName, suffix) {
  const normalizedSuffix = String(suffix || "").toLowerCase();
  return (pdfPreviewFiles || []).find((file) => {
    const relativePath = String(file.relativePath || file.id || "").replaceAll("\\", "/");
    return relativePath.startsWith(`04_Generiert/${folderName}/`) && String(file.name || "").toLowerCase().endsWith(normalizedSuffix);
  });
}

// Ordnet jeder Geräteliste die vorhandene generierte PDF zu, falls diese bereits
// erzeugt wurde. Fehlt die Datei, bleibt die Liste ohne Vorschau-Button.
function buildGeraetelistenPreviewMap(geraetelisten, pdfPreviewFiles) {
  return (geraetelisten || []).reduce((previewMap, liste) => {
    const suffix = `_${fileSafeName(liste.leistungsbereich)}_${fileSafeName(liste.titel)}.pdf`;
    const previewFile = findGeneratedPdf(pdfPreviewFiles, "Geraetelisten", suffix);
    if (previewFile) previewMap[liste.id] = pdfPreviewUrl(previewFile);
    return previewMap;
  }, {});
}

// Brandschutz wird aktuell als ein zusammenhängendes Dokument generiert; die
// Tabellenzeilen verweisen deshalb alle auf dieselbe vorhandene PDF-Vorschau.
function buildBrandschutzPreviewUrl(pdfPreviewFiles) {
  const previewFile = findGeneratedPdf(pdfPreviewFiles, "Brandschutz", "_Bilddokumentation_Brandschottungen.pdf");
  return pdfPreviewUrl(previewFile);
}

async function currentFiles(req) {
  return getCurrentDataFiles(ROOT_DIR, DATA_DIR, req.user.id);
}

// Lädt den vollständigen Projektzustand aus JSON/Config-Dateien und normalisiert
// die Daten für Views, Services und PDF-Ausgabe.
async function loadCurrent(req) {
  const files = await currentFiles(req);
  const [
    projekt,
    leistungsbereiche,
    matrix,
    systemConfigRaw,
    projektSysteme,
    geraetelisten,
    brandschutz,
    exportliste,
    anhaenge,
    ordnerstruktur,
    formTemplatesRaw,
    systemSettingsRaw
  ] = await Promise.all([
    readJson(files.projekt, {}),
    readJson(files.leistungsbereiche, { optionen: DEFAULT_LEISTUNGSBEREICHE, aktiv: [], systemAuswahl: {} }),
    readJson(files.dokumentenmatrix, []),
    readJson(path.join(DATA_DIR, "systeme.json"), { leistungsbereiche: [] }),
    readJson(files.projektSysteme, []),
    readJson(files.geraetelisten, []),
    readJson(files.brandschutz, []),
    readJson(files.exportliste, []),
    readJson(files.anhaenge, []),
    readJson(path.join(CONFIG_DIR, "ordnerstruktur.json"), {}),
    readJson(path.join(CONFIG_DIR, "formularTemplates.json"), {}),
    readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), DEFAULT_SYSTEM_SETTINGS)
  ]);

  return {
    files,
    projekt,
    leistungsbereiche: {
      optionen: leistungsbereiche.optionen || DEFAULT_LEISTUNGSBEREICHE,
      aktiv: leistungsbereiche.aktiv || [],
      systemAuswahl: leistungsbereiche.systemAuswahl || {}
    },
    matrix: Array.isArray(matrix) ? matrix : [],
    systemConfig: normalizeSystemConfig(systemConfigRaw),
    projektSysteme: Array.isArray(projektSysteme) ? projektSysteme : [],
    geraetelisten: normalizeGeraetelisten(geraetelisten),
    brandschutz: normalizeBrandschutz(brandschutz),
    anhaenge: normalizeAttachments(anhaenge),
    exportliste: Array.isArray(exportliste) ? exportliste : [],
    ordnerstruktur,
    templates: mergeFormTemplates(formTemplatesRaw),
    systemSettings: mergeSystemSettings(systemSettingsRaw)
  };
}

// Leitet aus aktiven Leistungsbereichen und Systemzuordnungen ab,
// welche Matrixeinträge aktiv und exportierbar sind.
function templateKeyForMatrixEntry(entry) {
  if (entry.dokumenttyp === "Konformitätserklärung") return "konformitaet";
  if (entry.dokumenttyp === "CE-Bestätigung") return "ceBestaetigung";
  if (/DGUV/i.test(entry.titel || "")) return "dguv";
  if (/Errichter/i.test(entry.titel || "")) return "errichter";
  return "";
}

function formGenerationEnabled(entry, entryLeistungsbereiche, templates) {
  const templateKey = templateKeyForMatrixEntry(entry);
  if (!templateKey || !entryLeistungsbereiche.length) return true;
  return formEnabledForLeistungsbereiche(templates[templateKey] || {}, entryLeistungsbereiche);
}

function updateMatrixFromLeistungsbereiche(matrix, leistungsbereiche, projektSysteme, templates = {}) {
  const activeSet = new Set(leistungsbereiche.aktiv || []);
  const activeKapitel = new Set(
    (projektSysteme || [])
      .filter((entry) => entry.aktiv)
      .flatMap((entry) => entry.kapitel || [])
  );

  return (matrix || []).map((entry) => {
    const entryLeistungsbereiche = [
      entry.leistungsbereich,
      ...(Array.isArray(entry.leistungsbereiche) ? entry.leistungsbereiche : [])
    ].filter(Boolean);
    const isGeneral = entryLeistungsbereiche.length === 0 || entryLeistungsbereiche.includes("Allgemein");
    const activeByLeistungsbereich = entryLeistungsbereiche.some((leistungsbereich) => activeSet.has(leistungsbereich));
    const activeByKapitel = activeKapitel.has(entry.kapitel);
    const generationEnabled = formGenerationEnabled(entry, entryLeistungsbereiche, templates);
    const aktiv = generationEnabled && Boolean(entry.pflicht || isGeneral || activeByLeistungsbereich || activeByKapitel);
    const autoExport = Boolean(entry.autoAktiv && (activeByLeistungsbereich || activeByKapitel));
    return {
      ...entry,
      aktiv,
      export: aktiv ? autoExport || entry.export !== false : false
    };
  });
}

// Übernimmt manuelle Checkbox-Änderungen aus der Dokumentenmatrix.
function updatePostedMatrix(matrix, body) {
  const activeIds = new Set(Array.isArray(body.aktiv) ? body.aktiv : body.aktiv ? [body.aktiv] : []);
  const exportIds = new Set(Array.isArray(body.export) ? body.export : body.export ? [body.export] : []);
  return (matrix || []).map((entry) => ({
    ...entry,
    aktiv: Boolean(entry.pflicht || activeIds.has(entry.id)),
    export: exportIds.has(entry.id)
  }));
}

// Synchronisiert Folge-Daten nach Änderungen an Leistungsbereichen.
// Dadurch bleiben Systemauswahl, Matrix und Gerätelisten im gleichen Stand.
async function syncProjectDerivedData(files) {
  const leistungsbereiche = await readJson(files.leistungsbereiche, { aktiv: [] });
  const systemConfig = normalizeSystemConfig(await readJson(path.join(DATA_DIR, "systeme.json"), { leistungsbereiche: [] }));
  const templates = mergeFormTemplates(await readJson(path.join(CONFIG_DIR, "formularTemplates.json"), {}));
  const existingProjektSysteme = await readJson(files.projektSysteme, []);
  const projektSysteme = syncProjektSysteme(systemConfig, existingProjektSysteme, leistungsbereiche.aktiv || []);
  const matrix = updateMatrixFromLeistungsbereiche(await readJson(files.dokumentenmatrix, []), leistungsbereiche, projektSysteme, templates);
  const geraetelisten = syncGeraetelistenFromLeistungsbereiche(await readJson(files.geraetelisten, []), leistungsbereiche.aktiv || [], projektSysteme);

  await Promise.all([
    writeJson(files.projektSysteme, projektSysteme),
    writeJson(files.dokumentenmatrix, matrix),
    writeJson(files.geraetelisten, geraetelisten)
  ]);
}

// Startseite: angemeldete Benutzer landen immer im Dashboard.
app.get("/", requireAuth, (req, res) => res.redirect("/dashboard"));

// Login, Registrierung und Logout.
app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("login", { flash: flashFromQuery(req) });
});

app.post("/login", (req, res) => {
  try {
    const user = loginUser(req.body.email, req.body.password);
    startSession(res, user.id);
    res.redirect("/dashboard");
  } catch (error) {
    redirectWithFlash(res, "/login", "error", error.message);
  }
});

app.get("/register", (req, res) => {
  if (req.user) return res.redirect("/dashboard");
  res.render("register", { flash: flashFromQuery(req) });
});

app.post("/register", (req, res) => {
  try {
    const user = registerUser(req.body);
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

// Dashboard: fasst Projektfortschritt, fehlende Angaben und nächste Schritte zusammen.
app.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const stats = buildDashboardStats({
      projekt: data.projekt,
      leistungsbereiche: data.leistungsbereiche,
      matrix: data.matrix,
      geraetelisten: data.geraetelisten,
      brandschutz: data.brandschutz,
      exportliste: data.exportliste,
      projektSysteme: data.projektSysteme
    });
    res.render("dashboard", { active: "dashboard", stats });
  } catch (error) {
    next(error);
  }
});

// Projektverwaltung: Projekte anzeigen, öffnen, archivieren, löschen und exportieren.
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
    await createProject(ROOT_DIR, DATA_DIR, req.user.id, req.body);
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
    await exportProject(ROOT_DIR, req.params.projectId, req.user.id, {});
    redirectWithFlash(res, "/projekte", "success", "Projektpaket wurde vorbereitet.");
  } catch (error) {
    fail(req, res, "/projekte", error);
  }
});

// Projektstammdaten inklusive Objektstruktur und Stockwerksauswahl.
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

// Leistungsbereiche steuern, welche Systeme, Dokumente und Gerätelisten aktiv werden.
app.get("/leistungsbereiche", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("leistungsbereiche", {
      active: "leistungsbereiche",
      optionen: data.leistungsbereiche.optionen,
      aktiv: data.leistungsbereiche.aktiv,
      systemAuswahl: data.leistungsbereiche.systemAuswahl,
      systemeNachLeistungsbereich: Object.groupBy
        ? Object.groupBy(flattenSystemConfigForLegacy(data.systemConfig), (system) => system.leistungsbereich)
        : flattenSystemConfigForLegacy(data.systemConfig).reduce((acc, system) => {
          acc[system.leistungsbereich] = acc[system.leistungsbereich] || [];
          acc[system.leistungsbereich].push(system);
          return acc;
        }, {})
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

// Projektspezifische Systemauswahl je Leistungsbereich.
app.get("/systemauswahl", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const synced = syncProjektSysteme(data.systemConfig, data.projektSysteme, data.leistungsbereiche.aktiv);
    await writeJson(data.files.projektSysteme, synced);
    res.render("systemauswahl", {
      active: "systemauswahl",
      systemConfig: data.systemConfig,
      selections: selectionByLeistungsbereich(synced)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/systemauswahl", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const selections = normalizePostedProjektSysteme(req.body.projektSysteme, data.systemConfig, data.leistungsbereiche.aktiv);
    await writeJson(data.files.projektSysteme, selections);
    await writeJson(data.files.geraetelisten, syncGeraetelistenFromLeistungsbereiche(data.geraetelisten, data.leistungsbereiche.aktiv, selections));
    okOrRedirect(req, res, "/systemauswahl");
  } catch (error) {
    fail(req, res, "/systemauswahl", error);
  }
});

// Dokumentenmatrix: fachliche Dokumente prüfen und Exportstatus verwalten.
app.get("/dokumente", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("dokumente", {
      active: "dokumente",
      dokumente: sortDocuments(applyLogicalChapterNumbers(data.matrix, { exportOnly: false }))
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

// Gerätelisten: Positionen pro aktivem Leistungsbereich tabellarisch bearbeiten.
app.get("/geraetelisten", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const nurAktive = req.query.aktiv === "1";
    const listen = nurAktive ? data.geraetelisten.filter((liste) => liste.aktiv) : data.geraetelisten;
    const fieldProfiles = Object.fromEntries(listen.map((liste) => [
      liste.leistungsbereich,
      deviceListFieldsForLeistungsbereich(liste.leistungsbereich)
    ]));
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    res.render("geraetelisten", {
      active: "geraetelisten",
      geraetelisten: listen,
      aktiveLeistungsbereiche: data.leistungsbereiche.aktiv,
      nurAktive,
      suggestions: buildGeraetelistenSuggestions(data.systemConfig),
      fieldProfiles,
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

// Brandschutz: Brandschottungen erfassen und Pflichtangaben prüfen.
app.get("/brandschutz", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    res.render("brandschutz", {
      active: "brandschutz",
      brandschutz: data.brandschutz,
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

// Export: Vorschau, PDF-Erzeugung, Exportliste und finaler Projekt-Export.
app.get("/export", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    const pdfPreviewFiles = await listPdfPreviewFiles(ROOT_DIR, data.projekt);
    const finalExportFiles = await listFinalExportFiles(ROOT_DIR, data.projekt);

    res.render("export", {
      active: "export",
      exportliste: data.exportliste,
      ordnerstruktur: data.ordnerstruktur,
      preview: buildExportPreview({
        projekt: data.projekt,
        matrix: data.matrix,
        exportliste: data.exportliste,
        projektSysteme: data.projektSysteme
      }),
      pdfPreviewFiles,
      finalExportFiles
    });
  } catch (error) {
    next(error);
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

async function generateCompleteDocumentation(rootDir, data) {
  const generated = [];
  await createProjectFolder(rootDir, data.projekt);
  generated.push(...await generateInhaltsverzeichnis(rootDir, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche));
  generated.push(...await generateFormularPdfs(rootDir, data.projekt, data.matrix, data.leistungsbereiche, data.systemConfig, data.projektSysteme, data.templates, data.systemSettings));
  generated.push(...await generateDeckblaetter(rootDir, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche));
  generated.push(...await generateGeraetelisten(rootDir, data.projekt, data.geraetelisten, data.systemSettings, data.matrix, data.leistungsbereiche));
  generated.push(...await generateBrandschutzPdf(rootDir, data.projekt, data.brandschutz, data.systemSettings, data.matrix, data.geraetelisten, data.leistungsbereiche));
  await buildExportliste(rootDir, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche);
  return generated;
}

app.post("/export/projektordner", requireAuth, async (req, res) => {
  await createProjectFolder(ROOT_DIR, (await loadCurrent(req)).projekt);
  redirectWithFlash(res, "/export", "success", "Projektordner wurde erstellt.");
});

app.post("/export/dokumentation", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const generated = await generateCompleteDocumentation(ROOT_DIR, data);
    redirectWithFlash(res, "/export", "success", `Dokumentation wurde generiert (${generated.length} PDFs).`);
  } catch (error) {
    fail(req, res, "/export", error);
  }
});

app.post("/export/pdfs-loeschen", requireAuth, async (req, res) => {
  try {
    const data = await loadCurrent(req);
    const paths = await createProjectFolder(ROOT_DIR, data.projekt);
    const deleted = await deletePdfFilesRecursive(paths.generatedPath) + await deletePdfFilesRecursive(paths.finalPath);
    await buildExportliste(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche);
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
  await generateFormularPdfs(ROOT_DIR, data.projekt, data.matrix, data.leistungsbereiche, data.systemConfig, data.projektSysteme, data.templates, data.systemSettings);
  redirectWithFlash(res, "/export", "success", "Formular-PDFs wurden generiert.");
});

app.post("/export/geraetelisten", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateGeraetelisten(ROOT_DIR, data.projekt, data.geraetelisten, data.systemSettings, data.matrix, data.leistungsbereiche);
  redirectWithFlash(res, "/export", "success", "Gerätelisten wurden generiert.");
});

app.post("/export/brandschutz", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await generateBrandschutzPdf(ROOT_DIR, data.projekt, data.brandschutz, data.systemSettings, data.matrix, data.geraetelisten, data.leistungsbereiche);
  redirectWithFlash(res, "/export", "success", "Brandschutzdokumentation wurde generiert.");
});

app.post("/export/trennstreifen", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  const generated = await generateTrennstreifen(ROOT_DIR, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche);
  redirectWithFlash(res, "/export", "success", `Trennstreifen wurden separat generiert (${generated.length} PDF).`);
});

app.post("/export/exportliste", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  await buildExportliste(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche);
  redirectWithFlash(res, "/export", "success", "Exportliste wurde aktualisiert.");
});

app.post("/export/final", requireAuth, async (req, res) => {
  const data = await loadCurrent(req);
  const result = await prepareFinalExport(ROOT_DIR, data.projekt, data.matrix, data.files.exportliste);
  const zipName = result.zipPath ? path.basename(result.zipPath) : "Export.zip";
  const pdfInfo = result.completePdfPath ? `, Gesamt-PDF mit ${result.completePdfPages} Seite(n)` : "";
  redirectWithFlash(res, "/export", "success", `Finaler Export wurde vorbereitet (${zipName}${pdfInfo}).`);
});

// Einstellungen: Systemvorgaben, Erstellerstammdaten, Ordnerstruktur und Formulare.
app.get("/einstellungen", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCurrent(req);
    res.render("einstellungen", {
      active: "einstellungen",
      systemSettings: data.systemSettings,
      themePresets: THEME_PRESETS,
      ordnerstruktur: data.ordnerstruktur,
      leistungsbereiche: data.leistungsbereiche,
      systemConfig: data.systemConfig,
      templates: data.templates
    });
  } catch (error) {
    next(error);
  }
});

app.post("/einstellungen/system", requireAuth, async (req, res) => {
  try {
    const current = mergeSystemSettings(await readJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), {}));
    await writeJson(path.join(CONFIG_DIR, "systemEinstellungen.json"), { ...current, ...normalizePostedSystemSettings(req.body), ersteller: current.ersteller });
    okOrRedirect(req, res, "/einstellungen#system");
  } catch (error) {
    fail(req, res, "/einstellungen#system", error);
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

// Projektarchiv: Projektpakete exportieren, prüfen und wieder importieren.
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
    await exportProject(ROOT_DIR, req.body.projectId || res.locals.currentProjectId, req.user.id, req.body);
    redirectWithFlash(res, "/projektarchiv", "success", "Projektpaket wurde exportiert.");
  } catch (error) {
    fail(req, res, "/projektarchiv", error);
  }
});

app.post("/projektarchiv/validieren", requireAuth, async (req, res) => {
  const { validateProjectArchive, storagePaths } = require("./services/projectArchiveService");
  const importOrdner = req.body.importOrdner || "projekt_export";
  try {
    const validation = await validateProjectArchive(safeJoin(storagePaths(ROOT_DIR).importsDir, importOrdner));
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
    await importProject(ROOT_DIR, req.body.importOrdner || "projekt_export", req.user.id);
    redirectWithFlash(res, "/projekte", "success", "Projekt wurde importiert.");
  } catch (error) {
    fail(req, res, "/projektarchiv", error);
  }
});

app.get("/projektarchiv/download", requireAuth, async (req, res, next) => {
  try {
    const filePath = safeJoin(ROOT_DIR, req.query.pfad || "");
    await fsp.access(filePath);
    res.download(filePath);
  } catch (error) {
    next(error);
  }
});

// Anhänge: importierte PDFs und Bilder verwalten, kategorisieren und zuordnen.
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
    const attachmentView = await buildAttachmentViewModel(data.anhaenge, data.brandschutz, data.matrix, data.projekt);
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
    const nextAttachments = await saveAttachment(ROOT_DIR, files, await readJson(files.anhaenge, []), upload);
    await writeJson(files.anhaenge, nextAttachments);
    const target = `/anhaenge?kategorie=${encodeURIComponent(upload.fields.category)}`;
    redirectWithFlash(res, target, "success", "Anhang wurde hochgeladen.");
  } catch (error) {
    fail(req, res, "/anhaenge", error);
  }
});

app.post("/anhaenge/:id/aktualisieren", requireAuth, async (req, res) => {
  try {
    const files = await currentFiles(req);
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
      export: req.body.export === "on"
    });
    const synced = await syncAttachmentFileName(ROOT_DIR, files, nextAttachments, req.params.id);
    await writeJson(files.anhaenge, synced.attachments);
    if (synced.renamed) {
      const brandschutz = normalizeBrandschutz(await readJson(files.brandschutz, []));
      await writeJson(files.brandschutz, brandschutz.map((entry) => ({
        ...entry,
        foto_vorher: entry.foto_vorher === synced.renamed.oldRelativePath ? synced.renamed.newRelativePath : entry.foto_vorher,
        foto_nachher: entry.foto_nachher === synced.renamed.oldRelativePath ? synced.renamed.newRelativePath : entry.foto_nachher
      })));
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
    const nextAttachments = await deleteAttachment(ROOT_DIR, attachments, req.params.id);
    await writeJson(files.anhaenge, nextAttachments);

    if (target) {
      const brandschutz = normalizeBrandschutz(await readJson(files.brandschutz, []));
      await writeJson(files.brandschutz, clearAttachmentReferencesFromBrandschutz(brandschutz, target.relativePath));
    }

    redirectWithFlash(res, "/anhaenge", "success", "Anhang wurde geloescht.");
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

    const filePath = safeJoin(ROOT_DIR, target.relativePath);
    res.download(filePath, target.originalName);
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
  console.error(error);
  res.status(500).render("placeholder", {
    active: "",
    title: "Fehler",
    heading: "Fehler",
    text: error.message || "Ein unerwarteter Fehler ist aufgetreten."
  });
});

app.listen(PORT, () => {
  console.log(`edoku läuft auf http://localhost:${PORT}`);
});
