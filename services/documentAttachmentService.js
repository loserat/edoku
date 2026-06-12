const { applyLogicalChapterNumbers } = require("./chapterNumberingService");
const { normalizeAttachments } = require("./attachmentService");

// Kategorien, die als importierte Dokumentations-PDFs im Inhaltsverzeichnis
// erscheinen. Andere Anhänge bleiben reine Dateien oder Bildzuordnungen.
const DOCUMENT_ATTACHMENT_CATEGORIES = [
  {
    category: "Stromlaufpläne",
    kapitel: "12.1",
    title: "Stromlaufpläne",
    sortierung: 12011
  },
  {
    category: "Schaltpläne",
    kapitel: "12.3",
    title: "Schaltpläne",
    sortierung: 12031
  },
  {
    category: "Installationspläne",
    kapitel: "12.2",
    title: "Installationspläne",
    sortierung: 12021
  },
  {
    category: "Schemata",
    kapitel: "12.4",
    title: "Schemata",
    sortierung: 12041
  },
  {
    category: "Messprotokolle",
    kapitel: "10",
    title: "Messprotokolle",
    sortierung: 10010
  },
  {
    category: "Bedienungsanleitungen",
    kapitel: "3.2",
    title: "Bedienungsanleitungen",
    sortierung: 3020
  }
];

const DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME = new Map(
  DOCUMENT_ATTACHMENT_CATEGORIES.map((entry) => [entry.category, entry])
);

// Stockwerke werden für die Sortierung vereinheitlicht, damit "1. OG" und
// ähnliche Schreibweisen zuverlässig vergleichbar sind.
const DEFAULT_STOCKWERK_ORDER = ["UG", "EG", "1. OG", "2. OG", "3. OG", "4. OG", "DG"];

function normalizeStockwerk(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
}

// Nutzt projektbezogene Stockwerke, wenn sie gepflegt sind; sonst Default-Reihenfolge.
function stockwerkOrderMap(projekt = {}) {
  const configured = Array.isArray(projekt.stockwerke) ? projekt.stockwerke : [];
  const values = configured.length ? configured : DEFAULT_STOCKWERK_ORDER;
  return new Map(values.map((stockwerk, index) => [normalizeStockwerk(stockwerk), index]));
}

// Fallback-Sortierung für Stockwerke, die nicht in der Projektstruktur enthalten sind.
function fallbackStockwerkRank(value) {
  const normalized = normalizeStockwerk(value);
  if (!normalized) return 900;
  if (normalized === "kg") return 0;
  if (normalized === "ug") return 10;
  if (normalized === "eg") return 20;
  const ogMatch = normalized.match(/^(\d+)og$/);
  if (ogMatch) return 20 + Number.parseInt(ogMatch[1], 10);
  if (normalized === "dg") return 100;
  return 500;
}

// Gesamtrang für Stockwerks-Sortierung in Anhängen und später im Inhaltsverzeichnis.
function stockwerkRank(value, orderMap) {
  const normalized = normalizeStockwerk(value);
  if (orderMap.has(normalized)) return orderMap.get(normalized);
  return fallbackStockwerkRank(value);
}

function defaultDocumentMetaForCategory(category) {
  return DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME.get(category) || {
    category,
    kapitel: "",
    title: category || "Dokument",
    sortierung: 90000
  };
}

// Nur PDFs aus bekannten Dokumentationskategorien werden in den PDF-Export einsortiert.
function isDocumentationAttachment(entry) {
  return entry && entry.mimeType === "application/pdf" && DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME.has(entry.category);
}

function documentationAttachments(raw) {
  return normalizeAttachments(raw).filter(isDocumentationAttachment);
}

// Baut einen sprechenden Titel aus Kategorie-spezifischen Metadaten.
function attachmentDisplayTitle(entry, categoryMeta, manualContext = null) {
  const base = String(entry.title || entry.originalName || categoryMeta.title || "Dokument").trim();
  if (entry.category === "Bedienungsanleitungen" && manualContext) {
    const details = [
      manualContext.hersteller,
      manualContext.system,
      manualContext.typ,
      manualContext.liste ? `Geräteliste ${manualContext.liste}` : "",
      manualContext.pos ? `Pos. ${manualContext.pos}` : ""
    ].map((value) => String(value || "").trim()).filter(Boolean);
    return details.length ? `${base} - ${details.join(" / ")}` : base;
  }
  const detailsByCategory = {
    "Stromlaufpläne": [entry.stockwerk, entry.verteiler, entry.plannummer, entry.revision ? `Rev. ${entry.revision}` : ""],
    "Schaltpläne": [entry.anlage, entry.verteiler, entry.plannummer, entry.revision ? `Rev. ${entry.revision}` : ""],
    "Installationspläne": [entry.stockwerk, entry.bereich, entry.plannummer, entry.revision ? `Rev. ${entry.revision}` : ""],
    "Schemata": [entry.anlage, entry.plannummer, entry.revision ? `Rev. ${entry.revision}` : ""],
    "Messprotokolle": [entry.messart, entry.normgrundlage, entry.anlage || entry.bereich, entry.datum]
  };
  const details = (detailsByCategory[entry.category] || [entry.stockwerk])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return details.length ? `${base} - ${details.join(" / ")}` : base;
}

// Verknüpft Bedienungsanleitungs-Anhänge mit Gerätepositionen.
// Brandschutzabschottungen werden bewusst ausgeschlossen, weil sie eigene Bild-/Nachweislogik haben.
function manualContextByAttachmentId(geraetelisten = []) {
  const contexts = new Map();
  (geraetelisten || [])
    .filter((liste) => liste && liste.leistungsbereich !== "Brandschutzabschottungen")
    .forEach((liste) => {
      (liste.positionen || []).forEach((position) => {
        const attachmentId = String(position.bedienungsanleitungId || "").trim();
        if (!attachmentId || contexts.has(attachmentId)) return;
        contexts.set(attachmentId, {
          liste: liste.leistungsbereich || liste.titel || "",
          pos: position.pos,
          hersteller: position.hersteller,
          system: position.system,
          typ: position.typ
        });
      });
    });
  return contexts;
}

/**
 * Erzeugt virtuelle Matrixeinträge für importierte Dokumentations-PDFs.
 * Die Einträge bekommen logische Kapitelnummern und werden nach Kategorie,
 * Kapitel und Stockwerk sortiert.
 */
function buildDocumentationAttachmentEntries(matrix, rawAttachments, projekt = {}, geraetelisten = []) {
  const attachments = documentationAttachments(rawAttachments).filter((entry) => entry.export !== false);
  if (!attachments.length) return [];

  const matrixLogical = applyLogicalChapterNumbers(matrix || [], { exportOnly: true });
  const parentByOriginal = new Map(
    matrixLogical.map((entry) => [String(entry.originalKapitel || entry.kapitel || ""), entry])
  );
  const countersByKapitel = new Map();
  const orderMap = stockwerkOrderMap(projekt);
  const manualContexts = manualContextByAttachmentId(geraetelisten);
  const orderedAttachments = attachments.sort((a, b) => {
    const metaA = defaultDocumentMetaForCategory(a.category);
    const metaB = defaultDocumentMetaForCategory(b.category);
    const kapitelA = String(a.kapitel || metaA.kapitel || "");
    const kapitelB = String(b.kapitel || metaB.kapitel || "");
    if (kapitelA !== kapitelB) {
      return kapitelA.localeCompare(kapitelB, "de", { numeric: true });
    }

    const stockwerkA = stockwerkRank(a.stockwerk, orderMap);
    const stockwerkB = stockwerkRank(b.stockwerk, orderMap);
    if (stockwerkA !== stockwerkB) return stockwerkA - stockwerkB;

    return String(a.title || a.originalName || "").localeCompare(String(b.title || b.originalName || ""), "de", {
      numeric: true,
      sensitivity: "base"
    });
  });

  return orderedAttachments
    .map((entry, index) => {
      const categoryMeta = defaultDocumentMetaForCategory(entry.category);
      const originalKapitel = String(entry.kapitel || categoryMeta.kapitel || "");
      const parent = parentByOriginal.get(originalKapitel);
      const next = (countersByKapitel.get(originalKapitel) || 0) + 1;
      countersByKapitel.set(originalKapitel, next);
      const fallbackSort = Number.isFinite(categoryMeta.sortierung) ? categoryMeta.sortierung : 90000 + index;
      const displayKapitel = parent
        ? `${parent.displayKapitel || parent.kapitel}.${next}`
        : originalKapitel ? `${originalKapitel}.${next}` : "";

      return {
        id: `attachment-${entry.id}`,
        attachmentId: entry.id,
        kapitel: displayKapitel,
        originalKapitel,
        displayKapitel,
        titel: attachmentDisplayTitle(entry, categoryMeta, manualContexts.get(entry.id)),
        ebene: 3,
        aktiv: true,
        export: true,
        pflicht: false,
        leistungsbereich: "Dokumentation",
        dokumenttyp: entry.category,
        formularart: "PDF-Import",
        quelle: "Anhang",
        dateipfad: entry.relativePath,
        sortierung: (parent && Number.isFinite(parent.sortierung) ? parent.sortierung : fallbackSort) + next / 100
      };
    })
    .sort((a, b) => {
      if (a.sortierung !== b.sortierung) return a.sortierung - b.sortierung;
      return String(a.displayKapitel || a.kapitel || "").localeCompare(String(b.displayKapitel || b.kapitel || ""), "de", { numeric: true });
    });
}

// Aktualisiert die Dokumentations-Metadaten eines vorhandenen Anhangs.
function updateAttachmentDocumentMeta(rawAttachments, attachmentId, values) {
  let found = false;
  const attachments = normalizeAttachments(rawAttachments).map((entry) => {
    if (entry.id !== attachmentId) return entry;
    found = true;
    const categoryMeta = defaultDocumentMetaForCategory(values.category || entry.category);
    return {
      ...entry,
      title: String(values.title || entry.title || entry.originalName || "").trim(),
      category: String(values.category || entry.category || "Allgemein").trim() || "Allgemein",
      kapitel: String(values.kapitel || categoryMeta.kapitel || "").trim(),
      stockwerk: String(values.stockwerk || "").trim(),
      anlage: String(values.anlage || "").trim(),
      verteiler: String(values.verteiler || "").trim(),
      plannummer: String(values.plannummer || "").trim(),
      revision: String(values.revision || "").trim(),
      bereich: String(values.bereich || "").trim(),
      messart: String(values.messart || "").trim(),
      normgrundlage: String(values.normgrundlage || "").trim(),
      datum: String(values.datum || "").trim(),
      sortierung: Number.isFinite(Number.parseFloat(values.sortierung)) ? Number.parseFloat(values.sortierung) : null,
      export: values.export === undefined ? entry.export !== false : Boolean(values.export)
    };
  });

  if (!found) throw new Error("Anhang wurde nicht gefunden.");
  return attachments;
}

module.exports = {
  DOCUMENT_ATTACHMENT_CATEGORIES,
  buildDocumentationAttachmentEntries,
  defaultDocumentMetaForCategory,
  documentationAttachments,
  updateAttachmentDocumentMeta
};
