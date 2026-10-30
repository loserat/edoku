// Originalkapitel bleiben stabile Fachschlüssel; Ausgaben werden als Baum nummeriert.
function sortDocuments(documents) {
  return [...(documents || [])].sort((a, b) => {
    const left = Number.isFinite(a.sortierung) ? a.sortierung : 0;
    const right = Number.isFinite(b.sortierung) ? b.sortierung : 0;
    return left - right || String(a.originalKapitel || a.kapitel || "").localeCompare(String(b.originalKapitel || b.kapitel || ""), "de", { numeric: true });
  });
}

function numberChapterTree(documents) {
  const nodes = documents.map((node) => ({ ...node }));
  const canonical = new Map();
  nodes.forEach((node) => {
    const key = String(node.originalKapitel || node.kapitel || "").trim();
    if (key && !canonical.has(key)) canonical.set(key, node);
  });
  // Fehlende Vorfahren erhalten eigene Zähler. Ein verwaistes 4.1 darf nicht zu 1 werden.
  function parentFor(chapter, child) {
    if (!chapter) return null;
    if (canonical.has(chapter)) return canonical.get(chapter);
    const parent = { id: `numbering-parent-${chapter}`, kapitel: chapter, originalKapitel: chapter, sortierung: child.sortierung, virtual: true };
    canonical.set(chapter, parent);
    nodes.push(parent);
    return parent;
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const chapter = String(node.originalKapitel || node.kapitel || "");
    node._numberingParent = node.parentId
      ? nodes.find((candidate) => candidate.id === node.parentId)
      : parentFor(chapter.split(".").slice(0, -1).join("."), node);
  }
  const children = new Map();
  nodes.forEach((node) => {
    const parent = node._numberingParent || null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  });
  const numbered = [];
  function visit(parent, prefix) {
    sortDocuments(children.get(parent) || []).forEach((node, index) => {
      const displayKapitel = prefix ? `${prefix}.${index + 1}` : String(index + 1);
      const { _numberingParent, ...clean } = node;
      numbered.push({ ...clean, displayKapitel, ebene: displayKapitel.split(".").length });
      visit(node, displayKapitel);
    });
  }
  visit(null, "");
  nodes.forEach((node) => delete node._numberingParent);
  return numbered;
}

function applyLogicalChapterNumbers(documents, options = {}) {
  const source = documents || [];
  const selected = source.map((document, index) => ({ ...document, _sourceIndex: index }))
    .filter((document) => document.aktiv && (!options.exportOnly || document.export));
  const numbered = numberChapterTree(selected);
  const byIndex = new Map(numbered.filter((entry) => !entry.virtual).map((entry) => [entry._sourceIndex, entry.displayKapitel]));
  return source.map((document, index) => ({ ...document, originalKapitel: document.originalKapitel || document.kapitel || "", displayKapitel: byIndex.get(index) || "" }));
}

function logicalChapterNumber(documents, options = {}) {
  const result = new Map();
  applyLogicalChapterNumbers(documents, options).forEach((entry) => {
    if (entry.displayKapitel && !result.has(entry.originalKapitel)) result.set(entry.originalKapitel, entry.displayKapitel);
  });
  return result;
}

module.exports = { applyLogicalChapterNumbers, logicalChapterNumber, numberChapterTree, sortDocuments };
