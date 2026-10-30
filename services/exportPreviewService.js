const { buildDocumentationPlan, summarizeExportEntries } = require("./documentationPlanService");
function valueOrDash(value) { return value && String(value).trim() ? value : "-"; }
function buildExportPreview({ projekt = {}, matrix = [], exportliste = [], projektSysteme = [], geraetelisten = [], anhaenge = [], leistungsbereiche = {} }) {
  const documents = exportliste.length ? exportliste : buildDocumentationPlan(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt).map((entry) => ({ ...entry, kapitel: entry.displayKapitel, status: entry.requiresFile ? "nicht geprüft" : "struktur" }));
  const groups = [];
  const byTop = new Map();
  for (const document of documents) {
    const chapter = String(document.displayKapitel || document.kapitel || "");
    const top = chapter.split(".")[0];
    if (!byTop.has(top)) {
      const heading = documents.find((entry) => String(entry.displayKapitel || entry.kapitel) === top);
      const group = { kapitel: top, titel: heading?.titel || `Kapitel ${top}`, dokumente: [] };
      byTop.set(top, group); groups.push(group);
    }
    const system = projektSysteme.find((entry) => entry.leistungsbereich === document.leistungsbereich) || {};
    byTop.get(top).dokumente.push({ ...document, kapitel: chapter, ebene: document.ebene || chapter.split(".").length, status: document.status || "nicht geprüft", statusClass: document.status === "vorhanden" ? "on" : ["fehlt", "fehlerhaft", "veraltet"].includes(document.status) ? "off" : "", hersteller: document.hersteller || system.hersteller || "", systemart: document.systemart || system.systemart || "" });
  }
  const count = summarizeExportEntries(documents);
  return {
    projekt: Object.fromEntries(["projektname", "projektnummer", "auftraggeber", "liegenschaft", "baumassnahme"].map((key) => [key, valueOrDash(projekt[key])])),
    stats: { dokumente: count.files, kapitel: groups.filter((group) => group.kapitel !== "0").length, struktur: documents.filter((entry) => entry.requiresFile === false).length, vorhandeneDateien: count.present, fehlendeDateien: count.missing, fehlerhafteDateien: count.invalid, nichtZugeordnet: exportliste.find((entry) => entry.isToc)?.unzugeordneteDateien || [], ungeprueft: count.unchecked, pflichtdokumente: count.required, fehlendePflicht: count.requiredMissing, seiten: count.pages },
    groups
  };
}
module.exports = { buildExportPreview };
