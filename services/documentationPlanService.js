const { numberChapterTree, sortDocuments } = require("./chapterNumberingService");
const { normalizeGeraetelisten } = require("./geraetelistenService");
const { prepareDocumentationAttachmentEntries, defaultDocumentMetaForCategory } = require("./documentAttachmentService");

function isImportedDocumentPlaceholder(entry) {
  return entry.dokumenttyp === "Plan" && entry.formularart === "Dateiliste" && Number(entry.ebene || 1) >= 2;
}
function isDeviceContainer(entry) {
  return String(entry.quelle || "").includes("geraetelisten.json");
}
function filterExportGeraetelisten(lists = [], areas = {}) {
  const selected = Array.isArray(areas.aktiv) ? new Set(areas.aktiv) : null;
  return normalizeGeraetelisten(lists).filter((list) => list.aktiv && list.export && (!selected || selected.has(list.leistungsbereich)));
}
function chapterSortValue(chapter) {
  return String(chapter).split(".").reduce((sum, part, index) => sum + (Number(part) || 0) * (index ? 10 ** Math.max(0, 2 - index) : 1000), 0);
}

// Eine gemeinsame Struktur für Dateinamen, Inhaltsverzeichnis, Matrix und Export.
function buildDocumentationPlan(matrix = [], lists = [], attachments = [], areas = {}, project = {}) {
  const activeLists = filterExportGeraetelisten(lists, areas);
  const imports = prepareDocumentationAttachmentEntries(matrix, attachments, project, activeLists);
  const originals = new Map();
  sortDocuments(matrix).forEach((entry) => {
    const key = String(entry.originalKapitel || entry.kapitel || "");
    if (!originals.has(key)) originals.set(key, entry);
  });
  const nodes = new Map();
  const canonical = new Map();
  function add(source, overrides = {}) {
    const originalKapitel = String(source.originalKapitel || source.kapitel || "");
    const node = { ...source, originalKapitel, matrixId: source.id, aktiv: true, export: true, requiresFile: !isImportedDocumentPlaceholder(source) && source.dokumenttyp !== "Kapitel" && !isDeviceContainer(source), ...overrides };
    if (originalKapitel.split(".").length === 1 && !node.attachmentId && !node.deviceListId) {
      node.isCover = true;
      node.requiresFile = true;
    }
    nodes.set(node.id, node);
    if (!node.attachmentId && !node.deviceListId && !canonical.has(originalKapitel)) canonical.set(originalKapitel, node);
    return node;
  }
  sortDocuments(matrix).filter((entry) => entry.aktiv && entry.export && !isImportedDocumentPlaceholder(entry))
    .filter((entry) => !isDeviceContainer(entry) || activeLists.some((list) => String(list.kapitel) === String(entry.kapitel)))
    .forEach((entry, index) => add({ ...entry, id: entry.id || `matrix-${index}` }));
  function ensureParent(chapter, fallbackTitle = "Dokumentation") {
    if (!chapter) return null;
    if (canonical.has(chapter)) return canonical.get(chapter);
    const source = originals.get(chapter);
    const node = add(source || { id: `parent-${chapter}`, kapitel: chapter, titel: fallbackTitle, sortierung: chapterSortValue(chapter), dokumenttyp: "Kapitel" }, {
      // Automatisch ergänzte Unterkapitel sind Überschriften, keine fehlenden PDFs.
      requiresFile: !chapter.includes("."), isCover: !chapter.includes("."), pflicht: Boolean(source && source.pflicht && !chapter.includes("."))
    });
    const parent = ensureParent(chapter.split(".").slice(0, -1).join("."));
    if (parent) node.parentId = parent.id;
    return node;
  }
  for (const node of [...nodes.values()]) {
    const parent = ensureParent(node.originalKapitel.split(".").slice(0, -1).join("."));
    if (parent) node.parentId = parent.id;
  }
  activeLists.forEach((list, index) => {
    const original = String(list.kapitel || "6");
    const parent = ensureParent(original, list.titel.replace(/^Geräteliste\s*/i, ""));
    add({ id: `device-list-${list.id}`, kapitel: original, titel: `${list.titel} - ${list.leistungsbereich}`, sortierung: 100000 + index, leistungsbereich: list.leistungsbereich, dokumenttyp: "Geräteliste", quelle: "intern" }, {
      matrixId: null, deviceListId: list.id, parentId: parent.id, requiresFile: true, isCover: false
    });
  });
  imports.forEach((entry, index) => {
    const category = defaultDocumentMetaForCategory(entry.dokumenttyp);
    const parent = ensureParent(entry.parentKapitel, category.title);
    add(entry, { matrixId: null, parentId: parent && parent.id, sortierung: 200000 + index, requiresFile: true, isCover: false });
  });
  return numberChapterTree([...nodes.values()]);
}
function buildDocumentationAttachmentEntries(matrix, attachments, project = {}, lists = [], areas = {}) {
  return buildDocumentationPlan(matrix, lists, attachments, areas, project).filter((entry) => entry.attachmentId);
}
function numberMatrixForExport(matrix, lists = [], attachments = [], areas = {}, project = {}) {
  const byId = new Map(buildDocumentationPlan(matrix, lists, attachments, areas, project).filter((entry) => entry.matrixId).map((entry) => [entry.matrixId, entry.displayKapitel]));
  return matrix.map((entry) => ({ ...entry, originalKapitel: entry.originalKapitel || entry.kapitel, displayKapitel: byId.get(entry.id) || "" }));
}
function exportEntryMatches(document, entry) {
  if (entry.id) return entry.id === document.id && String(entry.kapitel) === String(document.displayKapitel || document.kapitel);
  return String(entry.originalKapitel || entry.kapitel) === String(document.originalKapitel || document.kapitel) && entry.titel === document.titel && String(entry.kapitel) === String(document.displayKapitel || document.kapitel);
}
function mergeExportStatus(plan, exports = []) {
  return plan.map((node) => {
    const entry = exports.find((candidate) => exportEntryMatches(node, candidate));
    return { ...node, ...(entry || {}), id: node.id, displayKapitel: node.displayKapitel, requiresFile: node.requiresFile, pflicht: Boolean(node.pflicht), status: node.requiresFile ? entry?.status || "nicht geprüft" : "struktur" };
  });
}
function summarizeExportEntries(entries = []) {
  const files = entries.filter((entry) => entry.requiresFile !== false && entry.status !== "struktur");
  const present = files.filter((entry) => entry.status === "vorhanden");
  const missing = files.filter((entry) => entry.status === "fehlt");
  const invalid = files.filter((entry) => ["fehlerhaft", "veraltet"].includes(entry.status));
  const required = files.filter((entry) => entry.pflicht);
  const unchecked = files.length - present.length - missing.length - invalid.length;
  return { entries: entries.length, files: files.length, present: present.length, missing: missing.length, invalid: invalid.length, unchecked, required: required.length, requiredMissing: required.filter((entry) => entry.status !== "vorhanden").length, pages: present.reduce((sum, entry) => sum + (Number(entry.seiten) || 0), 0), complete: files.length > 0 && present.length === files.length };
}
function estimateBinderCount(entries, capacity = 80) {
  return Math.max(1, Math.ceil(summarizeExportEntries(entries).pages / Math.max(1, Number(capacity) || 80)));
}
module.exports = { estimateBinderCount, buildDocumentationPlan, buildDocumentationAttachmentEntries, filterExportGeraetelisten, numberMatrixForExport, mergeExportStatus, summarizeExportEntries };
