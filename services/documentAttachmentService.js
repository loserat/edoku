const { applyLogicalChapterNumbers } = require("./chapterNumberingService");
const { normalizeAttachments } = require("./attachmentService");

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
    kapitel: "12.1",
    title: "Schemata",
    sortierung: 12012
  },
  {
    category: "Messprotokolle",
    kapitel: "10",
    title: "Messprotokolle",
    sortierung: 10010
  }
];

const DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME = new Map(
  DOCUMENT_ATTACHMENT_CATEGORIES.map((entry) => [entry.category, entry])
);

function defaultDocumentMetaForCategory(category) {
  return DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME.get(category) || {
    category,
    kapitel: "",
    title: category || "Dokument",
    sortierung: 90000
  };
}

function isDocumentationAttachment(entry) {
  return entry && entry.mimeType === "application/pdf" && DOCUMENT_ATTACHMENT_CATEGORIES_BY_NAME.has(entry.category);
}

function documentationAttachments(raw) {
  return normalizeAttachments(raw).filter(isDocumentationAttachment);
}

function attachmentDisplayTitle(entry, categoryMeta) {
  const base = String(entry.title || entry.originalName || categoryMeta.title || "Dokument").trim();
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

function buildDocumentationAttachmentEntries(matrix, rawAttachments) {
  const attachments = documentationAttachments(rawAttachments).filter((entry) => entry.export !== false);
  if (!attachments.length) return [];

  const matrixLogical = applyLogicalChapterNumbers(matrix || [], { exportOnly: true });
  const parentByOriginal = new Map(
    matrixLogical.map((entry) => [String(entry.originalKapitel || entry.kapitel || ""), entry])
  );
  const countersByKapitel = new Map();

  return attachments
    .map((entry) => {
      const categoryMeta = defaultDocumentMetaForCategory(entry.category);
      const originalKapitel = String(entry.kapitel || categoryMeta.kapitel || "");
      const parent = parentByOriginal.get(originalKapitel);
      const next = (countersByKapitel.get(originalKapitel) || 0) + 1;
      countersByKapitel.set(originalKapitel, next);
      const displayKapitel = parent
        ? `${parent.displayKapitel || parent.kapitel}.${next}`
        : originalKapitel ? `${originalKapitel}.${next}` : "";

      return {
        id: `attachment-${entry.id}`,
        attachmentId: entry.id,
        kapitel: displayKapitel,
        originalKapitel,
        displayKapitel,
        titel: attachmentDisplayTitle(entry, categoryMeta),
        ebene: 3,
        aktiv: true,
        export: true,
        pflicht: false,
        leistungsbereich: "Dokumentation",
        dokumenttyp: entry.category,
        formularart: "PDF-Import",
        quelle: "Anhang",
        dateipfad: entry.relativePath,
        sortierung: Number.isFinite(entry.sortierung)
          ? entry.sortierung
          : (parent && Number.isFinite(parent.sortierung) ? parent.sortierung : categoryMeta.sortierung) + next / 100
      };
    })
    .sort((a, b) => {
      if (a.sortierung !== b.sortierung) return a.sortierung - b.sortierung;
      return String(a.displayKapitel || a.kapitel || "").localeCompare(String(b.displayKapitel || b.kapitel || ""), "de", { numeric: true });
    });
}

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
      export: Boolean(values.export)
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
