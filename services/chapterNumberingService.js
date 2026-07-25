// * INFO: Sortiert Dokumente zuerst nach fachlicher Sortierung, danach nach Kapitelnummer.
function sortDocuments(documents) {
  return [...(documents || [])].sort((a, b) => {
    const sortA = Number.isFinite(a.sortierung) ? a.sortierung : 0;
    const sortB = Number.isFinite(b.sortierung) ? b.sortierung : 0;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.kapitel || "").localeCompare(String(b.kapitel || ""), "de", { numeric: true });
  });
}

// * INFO: Entscheidet, ob ein Dokument bei der logischen Nummerierung berücksichtigt wird.
function shouldNumber(document, options) {
  if (!document.aktiv) return false;
  if (options.exportOnly && !document.export) return false;
  return true;
}

// * INFO: Stabiler interner Schluessel fuer Dokumente ohne eindeutige Objektidentitaet.
// ? WARUM: In der Matrix duerfen mehrere Eintraege dieselbe Original-Kapitelnummer haben.
function documentKey(document, index) {
  return document && document.id ? `id:${document.id}` : `index:${index}`;
}

// * INFO: Berechnet fortlaufende Kapitelnummern aus der vorhandenen Matrix.
// * INFO: Originalkapitel bleiben erhalten, die Anzeige nutzt später displayKapitel.
function logicalChapterNumberRecords(documents, options = {}) {
  const sorted = sortDocuments(documents).filter((document) => shouldNumber(document, options));
  const countersByParent = new Map();
  const logicalByOriginal = new Map();
  const logicalByDocument = new Map();
  const logicalByKey = new Map();
  const sourceIndexes = new Map((documents || []).map((document, index) => [document, index]));

  sorted.forEach((document) => {
    const original = String(document.kapitel || "").trim();
    if (!original) return;

    const parts = original.split(".");
    const parentOriginal = parts.slice(0, -1).join(".");
    const parentLogical = parentOriginal ? logicalByOriginal.get(parentOriginal) : "";
    const parentKey = parentOriginal || "__root__";
    const next = (countersByParent.get(parentKey) || 0) + 1;
    countersByParent.set(parentKey, next);

    const logical = parentLogical ? `${parentLogical}.${next}` : String(next);
    logicalByDocument.set(document, logical);
    logicalByKey.set(documentKey(document, sourceIndexes.get(document)), logical);

    // ! WICHTIG: Bei doppelten Originalkapiteln darf der erste Wert nicht ueberschrieben werden.
    // ? WARUM: Sonst erhalten mehrere Dokumente dieselbe displayKapitel-Nummer und Luecken entstehen.
    if (!logicalByOriginal.has(original)) {
      logicalByOriginal.set(original, logical);
    }
  });

  return {
    byOriginal: logicalByOriginal,
    byDocument: logicalByDocument,
    byKey: logicalByKey
  };
}

function logicalChapterNumber(documents, options = {}) {
  return logicalChapterNumberRecords(documents, options).byOriginal;
}

// * INFO: Ergänzt jedes Dokument um originalKapitel und displayKapitel.
function applyLogicalChapterNumbers(documents, options = {}) {
  const logical = logicalChapterNumberRecords(documents, options);

  return (documents || []).map((document, index) => {
    const originalKapitel = document.originalKapitel || document.kapitel || "";
    const displayKapitel = logical.byDocument.get(document)
      || logical.byKey.get(documentKey(document, index))
      || "";
    return {
      ...document,
      originalKapitel,
      displayKapitel
    };
  });
}

module.exports = {
  applyLogicalChapterNumbers,
  logicalChapterNumber,
  sortDocuments
};
