const { applyLogicalChapterNumbers, sortDocuments } = require("./chapterNumberingService");

function valueOrDash(value) {
  return value && String(value).trim() ? value : "-";
}

function indexExportliste(exportliste) {
  return new Map((exportliste || []).map((entry) => [entry.originalKapitel || entry.kapitel || entry.titel, entry]));
}

function statusClass(status) {
  if (status === "vorhanden") return "on";
  if (status === "fehlt") return "off";
  return "";
}

function buildExportPreview({ projekt = {}, matrix = [], exportliste = [], projektSysteme = [] }) {
  const exportByKapitel = indexExportliste(exportliste);
  const matrixDocuments = sortDocuments(
    applyLogicalChapterNumbers(matrix, { exportOnly: true }).filter((entry) => entry.aktiv && entry.export)
  );
  const documents = (exportliste || []).length
    ? (exportliste || []).map((entry) => {
        const matrixEntry = matrixDocuments.find((document) => {
          return String(document.originalKapitel || document.kapitel || "") === String(entry.originalKapitel || entry.kapitel || "");
        }) || {};
        return {
          ...matrixEntry,
          ...entry,
          ebene: matrixEntry.ebene || String(entry.kapitel || "").split(".").filter(Boolean).length || 2,
          displayKapitel: entry.kapitel || matrixEntry.displayKapitel || matrixEntry.kapitel || "",
          originalKapitel: entry.originalKapitel || matrixEntry.originalKapitel || matrixEntry.kapitel || "",
          titel: entry.titel || matrixEntry.titel || "Dokument",
          pflicht: Boolean(entry.pflicht || matrixEntry.pflicht)
        };
      })
    : matrixDocuments;
  const groups = [];
  const groupsByTop = new Map();

  documents.forEach((document) => {
    const originalKapitel = document.originalKapitel || document.kapitel || "";
    const displayKapitel = document.displayKapitel || document.kapitel || "";
    const topKapitel = String(displayKapitel).split(".")[0] || "0";
    const exportEntry = exportByKapitel.get(originalKapitel) || exportByKapitel.get(displayKapitel) || document || {};
    const systemEntry = (projektSysteme || []).find((entry) => {
      return entry.leistungsbereich === document.leistungsbereich || (entry.kapitel || []).includes(originalKapitel);
    }) || {};

    if (!groupsByTop.has(topKapitel)) {
      const titleSource = documents.find((entry) => {
        return (entry.displayKapitel || entry.kapitel) === topKapitel && entry.ebene === 1;
      });
      const group = {
        kapitel: topKapitel,
        titel: titleSource ? titleSource.titel : `Kapitel ${topKapitel}`,
        dokumente: []
      };
      groupsByTop.set(topKapitel, group);
      groups.push(group);
    }

    groupsByTop.get(topKapitel).dokumente.push({
      kapitel: displayKapitel,
      originalKapitel,
      titel: document.titel,
      ebene: document.ebene || 2,
      pflicht: Boolean(document.pflicht),
      leistungsbereich: exportEntry.leistungsbereich || document.leistungsbereich || systemEntry.leistungsbereich || "",
      dokumenttyp: document.dokumenttyp || "",
      formularart: document.formularart || "",
      quelle: exportEntry.quelle || document.quelle || "noch nicht geprüft",
      status: exportEntry.status || "nicht geprüft",
      statusClass: statusClass(exportEntry.status),
      dateipfad: exportEntry.dateipfad || "",
      hersteller: exportEntry.hersteller || systemEntry.hersteller || "",
      systemart: exportEntry.systemart || systemEntry.systemart || ""
    });
  });

  const statusEntries = documents.map((document) => exportByKapitel.get(document.originalKapitel || document.kapitel || document.titel || "") || document);
  const vorhandeneDateien = statusEntries.filter((entry) => entry && entry.status === "vorhanden").length;
  const fehlendeDateien = statusEntries.filter((entry) => entry && entry.status === "fehlt").length;
  const ungeprueft = documents.length - vorhandeneDateien - fehlendeDateien;
  const pflichtdokumente = documents.filter((entry) => entry.pflicht).length;
  const fehlendePflicht = documents.filter((document) => {
    const entry = exportByKapitel.get(document.originalKapitel || document.kapitel || "");
    return document.pflicht && (!entry || entry.status === "fehlt");
  }).length;

  return {
    projekt: {
      projektname: valueOrDash(projekt.projektname),
      projektnummer: valueOrDash(projekt.projektnummer),
      auftraggeber: valueOrDash(projekt.auftraggeber),
      liegenschaft: valueOrDash(projekt.liegenschaft),
      baumassnahme: valueOrDash(projekt.baumassnahme)
    },
    stats: {
      dokumente: documents.length,
      kapitel: groups.length,
      vorhandeneDateien,
      fehlendeDateien,
      ungeprueft,
      pflichtdokumente,
      fehlendePflicht
    },
    groups
  };
}

module.exports = {
  buildExportPreview
};
