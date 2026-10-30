const { hasMissingRequiredBrandschutzFields, normalizeBrandschutz } = require("./brandschutzService");
const { isGeraetelisteComplete, normalizeGeraetelisten } = require("./geraetelistenService");
const { buildDocumentationPlan, filterExportGeraetelisten, mergeExportStatus, summarizeExportEntries } = require("./documentationPlanService");

// * INFO: Begrenzt Fortschrittswerte auf gültige Prozentbereiche.
function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// * INFO: Verdichtet alle Projektbereiche zu Dashboard-Kennzahlen, Fortschritt und Workflow.
function buildDashboardStats({ projekt, leistungsbereiche, matrix, geraetelisten, brandschutz, exportliste, projektSysteme, anhaenge = [] }) {
  const aktiveLeistungsbereiche = leistungsbereiche.aktiv || [];
  const dokumente = Array.isArray(matrix) ? matrix : [];
  const listen = normalizeGeraetelisten(geraetelisten);
  const brandschutzEintraege = normalizeBrandschutz(brandschutz);
  const storedExports = Array.isArray(exportliste) ? exportliste : [];
  const plan = buildDocumentationPlan(dokumente, listen, anhaenge, leistungsbereiche, projekt);
  const exportEintraege = mergeExportStatus(plan, storedExports);
  exportEintraege.unshift(storedExports.find((entry) => entry.isToc) || { id: "inhaltsverzeichnis", isToc: true, requiresFile: true, pflicht: true, status: "nicht geprüft" });
  const exportCount = summarizeExportEntries(exportEintraege);

  const aktiveDokumente = dokumente.filter((dokument) => dokument.aktiv);
  const pflichtDokumente = exportEintraege.filter((entry) => entry.requiresFile && entry.pflicht);
  const fehlendePflicht = pflichtDokumente.filter((entry) => entry.status !== "vorhanden");

  const projectFields = ["projektname", "projektnummer", "auftraggeber", "liegenschaft", "baumassnahme"];
  const projectComplete = projectFields.filter((field) => String(projekt[field] || "").trim()).length;
  const activeLists = filterExportGeraetelisten(listen, leistungsbereiche);
  const filledLists = activeLists.filter(isGeraetelisteComplete);
  const exportReady = exportCount.present > 0;
  const activeBrandschutz = aktiveLeistungsbereiche.includes("Brandschutzabschottungen") ? brandschutzEintraege.filter((entry) => entry.aktiv) : [];
  const missingBrandschutz = activeBrandschutz.filter(hasMissingRequiredBrandschutzFields).length;
  const missingRequiredExport = exportCount.requiredMissing;
  const missingExportFiles = exportCount.missing + exportCount.invalid + exportCount.unchecked;
  const missingListContent = Math.max(0, activeLists.length - filledLists.length);
  const missingProjectFields = projectFields.length - projectComplete;
  const requiredDocumentsCount = pflichtDokumente.length || 0;

  const completionChecks = [
    {
      label: "Projektstammdaten",
      total: projectFields.length,
      missing: missingProjectFields,
      hint: `${missingProjectFields} Pflichtfelder offen`
    },
    {
      label: "Leistungsbereiche",
      total: 1,
      missing: aktiveLeistungsbereiche.length ? 0 : 1,
      hint: aktiveLeistungsbereiche.length ? `${aktiveLeistungsbereiche.length} aktiv` : "keine Auswahl"
    },
    {
      label: "Pflichtdokumente",
      total: requiredDocumentsCount,
      informational: true,
      missing: missingRequiredExport,
      hint: `${missingRequiredExport} fehlen`
    },
    {
      label: "Gerätelisten",
      total: activeLists.length,
      missing: missingListContent,
      hint: activeLists.length ? `${filledLists.length}/${activeLists.length} gefüllt` : "Nicht für Export gewählt"
    },
    {
      label: "Brandschutz",
      total: aktiveLeistungsbereiche.includes("Brandschutzabschottungen") ? Math.max(1, activeBrandschutz.length) : 0,
      missing: aktiveLeistungsbereiche.includes("Brandschutzabschottungen") && !activeBrandschutz.length ? 1 : missingBrandschutz,
      hint: !aktiveLeistungsbereiche.includes("Brandschutzabschottungen") ? "Nicht ausgewählt" : `${missingBrandschutz || (!activeBrandschutz.length ? 1 : 0)} unvollständig`
    },
    {
      label: "Exportdateien",
      total: exportCount.files,
      missing: missingExportFiles,
      hint: `${missingExportFiles} fehlen`
    }
  ].map((check) => {
    const missing = Math.max(0, Math.min(check.total, check.missing));
    const done = Math.max(0, check.total - missing);
    return {
      ...check,
      missing,
      done,
      applicable: check.total > 0,
      percent: check.total ? clampPercent((done / check.total) * 100) : 0
    };
  });

  const countedChecks = completionChecks.filter((check) => !check.informational);
  const completionTotal = countedChecks.reduce((sum, check) => sum + check.total, 0);
  const completionDone = countedChecks.reduce((sum, check) => sum + check.done, 0);
  const completionMissing = countedChecks.reduce((sum, check) => sum + check.missing, 0);

  const workflow = [
    {
      nr: 1,
      titel: "Projekt auswählen",
      beschreibung: "Projekt öffnen oder neu anlegen.",
      href: "/projekte",
      status: projekt.projektname ? "fertig" : "offen",
      kennzahl: projekt.projektname || "kein Projektname"
    },
    {
      nr: 2,
      titel: "Stammdaten erfassen",
      beschreibung: "Projekt-, Auftraggeber- und Ausführungsdaten prüfen.",
      href: "/projekt",
      status: projectComplete >= projectFields.length ? "fertig" : projectComplete > 0 ? "in-arbeit" : "offen",
      kennzahl: `${projectComplete}/${projectFields.length} Pflichtfelder`
    },
    {
      nr: 3,
      titel: "Leistungsbereiche festlegen",
      beschreibung: "Gewerke aktivieren, damit Matrix und Listen vorbereitet werden.",
      href: "/leistungsbereiche",
      status: aktiveLeistungsbereiche.length ? "fertig" : "offen",
      kennzahl: `${aktiveLeistungsbereiche.length} aktiv`
    },
    {
      nr: 4,
      titel: "Dokumentenmatrix prüfen",
      beschreibung: "Aktive Kapitel und Exportreihenfolge kontrollieren.",
      href: "/export#matrix",
      status: aktiveDokumente.length ? "fertig" : "offen",
      kennzahl: `${aktiveDokumente.length} aktiv`
    },
    {
      nr: 5,
      titel: "Gerätelisten füllen",
      beschreibung: "Gerätepositionen pro Leistungsbereich ergänzen.",
      href: "/geraetelisten",
      status: !activeLists.length || filledLists.length === activeLists.length ? "fertig" : filledLists.length ? "in-arbeit" : "offen",
      kennzahl: `${filledLists.length}/${activeLists.length} Listen`
    },
    {
      nr: 6,
      titel: "Brandschutz prüfen",
      beschreibung: "Brandschottungen erfassen, falls erforderlich.",
      href: "/brandschutz",
      status: !aktiveLeistungsbereiche.includes("Brandschutzabschottungen") || (activeBrandschutz.length && !missingBrandschutz) ? "fertig" : activeBrandschutz.length ? "in-arbeit" : "offen",
      kennzahl: aktiveLeistungsbereiche.includes("Brandschutzabschottungen") ? `${activeBrandschutz.length} Einträge` : "Nicht ausgewählt"
    },
    {
      nr: 7,
      titel: "Export vorbereiten",
      beschreibung: "PDFs erzeugen, Exportliste prüfen und final vorbereiten.",
      href: "/export",
      status: exportCount.complete ? "fertig" : exportReady ? "in-arbeit" : "offen",
      kennzahl: `${exportCount.present}/${exportCount.files} Einzel-PDFs`
    }
  ];

  const nextStep = workflow.find((step) => step.status !== "fertig") || workflow[workflow.length - 1];

  return {
    projekt: {
      projektname: projekt.projektname || "-",
      projektnummer: projekt.projektnummer || "-",
      auftraggeber: projekt.auftraggeber || "-",
      liegenschaft: projekt.liegenschaft || "-",
      baumassnahme: projekt.baumassnahme || "-"
    },
    leistungsbereiche: {
      aktiv: aktiveLeistungsbereiche.length,
      liste: aktiveLeistungsbereiche
    },
    dokumente: {
      aktiv: aktiveDokumente.length,
      export: exportCount.files,
      pflicht: pflichtDokumente.length,
      fehlendePflicht: fehlendePflicht.length
    },
    geraetelisten: {
      gesamt: listen.length,
      aktiv: activeLists.length,
      leer: activeLists.filter((liste) => !liste.positionen || liste.positionen.length === 0).length
    },
    brandschutz: {
      gesamt: brandschutzEintraege.length,
      fehlendePflichtangaben: missingBrandschutz
    },
    export: {
      gesamt: exportCount.files,
      seiten: exportCount.pages,
      vorhanden: exportCount.present,
      fehlt: missingExportFiles
    },
    completion: {
      percent: clampPercent((completionDone / completionTotal) * 100),
      done: completionDone,
      missing: completionMissing,
      total: completionTotal,
      checks: completionChecks
    },
    workflow,
    nextStep
  };
}

module.exports = {
  buildDashboardStats
};
