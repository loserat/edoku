// Sortiert Dokumente zuerst nach fachlicher Sortierung, danach nach Kapitelnummer.
function sortDocuments(documents) {
  return [...(documents || [])].sort((a, b) => {
    const sortA = Number.isFinite(a.sortierung) ? a.sortierung : 0;
    const sortB = Number.isFinite(b.sortierung) ? b.sortierung : 0;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.kapitel || "").localeCompare(String(b.kapitel || ""), "de", { numeric: true });
  });
}

// Entscheidet, ob ein Dokument bei der logischen Nummerierung berücksichtigt wird.
function shouldNumber(document, options) {
  if (!document.aktiv) return false;
  if (options.exportOnly && !document.export) return false;
  return true;
}

// Berechnet fortlaufende Kapitelnummern aus der vorhandenen Matrix.
// Originalkapitel bleiben erhalten, die Anzeige nutzt später displayKapitel.
function logicalChapterNumber(documents, options = {}) {
  const sorted = sortDocuments(documents).filter((document) => shouldNumber(document, options));
  const countersByParent = new Map();
  const logicalByOriginal = new Map();

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
    logicalByOriginal.set(original, logical);
  });

  return logicalByOriginal;
}

// Ergänzt jedes Dokument um originalKapitel und displayKapitel.
function applyLogicalChapterNumbers(documents, options = {}) {
  const logicalByOriginal = logicalChapterNumber(documents, options);

  return (documents || []).map((document) => {
    const originalKapitel = document.originalKapitel || document.kapitel || "";
    const displayKapitel = logicalByOriginal.get(String(document.kapitel || "")) || "";
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
