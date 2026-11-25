const path = require("node:path");
const { readJson, writeJson } = require("./jsonService");
const { getProject } = require("./dbService");
const { DEFAULT_LEISTUNGSBEREICHE } = require("./bootstrapService");
const { dataFilesForProject } = require("./projectArchiveService");
const { bindProjectScope, createProjectFolder } = require("./projectService");
const { syncProjektSysteme, projectSystemCatalog } = require("./systemService");
const { normalizeGeraetelisten, syncGeraetelistenFromLeistungsbereiche } = require("./geraetelistenService");
const { normalizeBrandschutz } = require("./brandschutzService");
const { normalizeAttachments } = require("./attachmentService");
const { mergeFormTemplates, formEnabledForLeistungsbereiche } = require("./formTemplateService");
const { mergeSystemSettings, DEFAULT_SYSTEM_SETTINGS } = require("./settingsService");
const { buildExportliste } = require("./exportService");
const { generateInhaltsverzeichnis, generateFormularPdfs, generateDeckblaetter, generateGeraetelisten, generateBrandschutzPdf } = require("./pdfService");
const store = require("./projectDataStoreService");
const { assertSafePath } = require("./pathService");

async function loadProjectWorkspace(rootDir, userId, projectId) {
  const row = getProject(userId, projectId);
  if (!row || row.status === "geloescht") throw Object.assign(new Error("Projekt wurde nicht gefunden."), { status: 404 });
  const files = dataFilesForProject(rootDir, userId, projectId);
  const read = async (file, fallback) => {
    const stored = store.readProjectDocument(file);
    if (stored.handled) return stored.value;
    await assertSafePath(rootDir, file, { allowMissing: true, type: "file" });
    return readJson(file, fallback);
  };
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
    read(files.projekt, {}),
    read(files.leistungsbereiche, { optionen: DEFAULT_LEISTUNGSBEREICHE, aktiv: [], systemAuswahl: {} }),
    read(files.dokumentenmatrix, []),
    read(path.join(rootDir, "data", "systeme.json"), { leistungsbereiche: [] }),
    read(files.projektSysteme, []),
    read(files.geraetelisten, []),
    read(files.brandschutz, []),
    read(files.exportliste, []),
    read(files.anhaenge, []),
    read(path.join(rootDir, "config", "ordnerstruktur.json"), {}),
    read(path.join(rootDir, "config", "formularTemplates.json"), {}),
    read(path.join(rootDir, "config", "systemEinstellungen.json"), DEFAULT_SYSTEM_SETTINGS)
  ]);

  return {
    files,
    projekt: bindProjectScope(projekt, userId, projectId),
    leistungsbereiche: {
      optionen: leistungsbereiche.optionen || DEFAULT_LEISTUNGSBEREICHE,
      aktiv: leistungsbereiche.aktiv || [],
      systemAuswahl: leistungsbereiche.systemAuswahl || {}
    },
    matrix: Array.isArray(matrix) ? matrix : [],
    systemConfig: projectSystemCatalog(systemConfigRaw, projekt),
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

async function syncProjectDerivedData(rootDir, files) {
  const leistungsbereiche = await readJson(files.leistungsbereiche, { aktiv: [] });
  const systemConfig = projectSystemCatalog(await readJson(path.join(rootDir, "data", "systeme.json"), { leistungsbereiche: [] }), await readJson(files.projekt, {}));
  const templates = mergeFormTemplates(await readJson(path.join(rootDir, "config", "formularTemplates.json"), {}));
  const existingProjektSysteme = await readJson(files.projektSysteme, []);
  const projektSysteme = syncProjektSysteme(systemConfig, existingProjektSysteme, leistungsbereiche.aktiv || []);
  const matrix = updateMatrixFromLeistungsbereiche(await readJson(files.dokumentenmatrix, []), leistungsbereiche, projektSysteme, templates);
  const geraetelisten = syncDeviceListsPreservingFields(await readJson(files.geraetelisten, []), leistungsbereiche.aktiv || [], projektSysteme);

  await Promise.all([
    writeJson(files.projektSysteme, projektSysteme),
    writeJson(files.dokumentenmatrix, matrix),
    writeJson(files.geraetelisten, geraetelisten)
  ]);
}

function syncDeviceListsPreservingFields(raw, active, systems) {
  const synced = syncGeraetelistenFromLeistungsbereiche(raw, active, systems);
  return synced.map(next => {
    const originals = (Array.isArray(raw) ? raw : []).filter(entry => entry && (entry.id ? entry.id === next.id : entry.leistungsbereich === next.leistungsbereich));
    if (originals.length !== 1 || !Array.isArray(originals[0].positionen)) return next;
    const original = originals[0];
    return { ...original, ...next, positionen: next.positionen.map((position, index) => ({ ...original.positionen[index], ...position })) };
  });
}


async function generateCompleteDocumentation(rootDir, data) {
  const generated = [];
  await createProjectFolder(rootDir, data.projekt);
  generated.push(...await generateInhaltsverzeichnis(rootDir, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche));
  generated.push(...await generateFormularPdfs(rootDir, data.projekt, data.matrix, data.leistungsbereiche, data.systemConfig, data.projektSysteme, data.templates, data.systemSettings, data.geraetelisten, data.anhaenge));
  generated.push(...await generateDeckblaetter(rootDir, data.projekt, data.matrix, data.systemSettings, data.geraetelisten, data.anhaenge, data.leistungsbereiche));
  generated.push(...await generateGeraetelisten(rootDir, data.projekt, data.geraetelisten, data.systemSettings, data.matrix, data.leistungsbereiche, data.anhaenge));
  generated.push(...await generateBrandschutzPdf(rootDir, data.projekt, data.brandschutz, data.systemSettings, data.matrix, data.geraetelisten, data.leistungsbereiche, data.anhaenge));
  await buildExportliste(rootDir, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche, { brandschutz: data.brandschutz });
  return generated;
}


module.exports = { loadProjectWorkspace, syncProjectDerivedData, syncDeviceListsPreservingFields, updateMatrixFromLeistungsbereiche, generateCompleteDocumentation };
