const { hasMissingRequiredBrandschutzFields, normalizeBrandschutz } = require("./brandschutzService");
const { isGeraetelisteComplete, normalizeGeraetelisten } = require("./geraetelistenService");

// Begrenzt Fortschrittswerte auf gültige Prozentbereiche.
function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Verdichtet alle Projektbereiche zu Dashboard-Kennzahlen, Fortschritt und Workflow.
function buildDashboardStats({ projekt, leistungsbereiche, matrix, geraetelisten, brandschutz, exportliste, projektSysteme }) {
  const aktiveLeistungsbereiche = leistungsbereiche.aktiv || [];
  const dokumente = Array.isArray(matrix) ? matrix : [];
  const listen = normalizeGeraetelisten(geraetelisten);
  const brandschutzEintraege = normalizeBrandschutz(brandschutz);
  const exportEintraege = Array.isArray(exportliste) ? exportliste : [];

  const aktiveDokumente = dokumente.filter((dokument) => dokument.aktiv);
  const exportDokumente = dokumente.filter((dokument) => dokument.export);
  const pflichtDokumente = dokumente.filter((dokument) => dokument.pflicht);
  const fehlendePflicht = exportEintraege.filter((entry) => entry.pflicht && entry.status === "fehlt");

  const projectFields = ["projektname", "projektnummer", "auftraggeber", "liegenschaft", "baumassnahme"];
  const projectComplete = projectFields.filter((field) => String(projekt[field] || "").trim()).length;
  const systemSelectionCount = Array.isArray(projektSysteme)
    ? projektSysteme.filter((entry) => String(entry.hersteller || entry.systemart || entry.herstellerSystem || "").trim()).length
    : 0;
  const activeLists = listen.filter((liste) => liste.aktiv);
  const filledLists = activeLists.filter(isGeraetelisteComplete);
  const exportReady = exportEintraege.length > 0;
  const missingBrandschutz = brandschutzEintraege.filter((entry) => entry.aktiv && hasMissingRequiredBrandschutzFields(entry)).length;
  const missingRequiredExport = exportEintraege.filter((entry) => entry.pflicht && entry.status === "fehlt").length;
  const missingExportFiles = exportEintraege.filter((entry) => entry.status === "fehlt").length;
  const emptyActiveLists = activeLists.filter((liste) => !liste.positionen || liste.positionen.length === 0).length;
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
      label: "Systemauswahl",
      total: aktiveLeistungsbereiche.length || 1,
      missing: aktiveLeistungsbereiche.length ? Math.max(0, aktiveLeistungsbereiche.length - systemSelectionCount) : 1,
      hint: `${systemSelectionCount}/${aktiveLeistungsbereiche.length || 1} zugeordnet`
    },
    {
      label: "Pflichtdokumente",
      total: requiredDocumentsCount || 1,
      missing: missingRequiredExport,
      hint: `${missingRequiredExport} fehlen`
    },
    {
      label: "Gerätelisten",
      total: activeLists.length || 1,
      missing: activeLists.length ? missingListContent : 1,
      hint: `${filledLists.length}/${activeLists.length || 1} gefüllt`
    },
    {
      label: "Brandschutz",
      total: brandschutzEintraege.filter((entry) => entry.aktiv).length || 1,
      missing: missingBrandschutz,
      hint: `${missingBrandschutz} unvollständig`
    },
    {
      label: "Exportdateien",
      total: exportEintraege.length || 1,
      missing: exportEintraege.length ? missingExportFiles : 1,
      hint: `${missingExportFiles} fehlen`
    }
  ].map((check) => {
    const missing = Math.max(0, Math.min(check.total, check.missing));
    const done = Math.max(0, check.total - missing);
    return {
      ...check,
      missing,
      done,
      percent: clampPercent((done / check.total) * 100)
    };
  });

  const completionTotal = completionChecks.reduce((sum, check) => sum + check.total, 0);
  const completionDone = completionChecks.reduce((sum, check) => sum + check.done, 0);
  const completionMissing = completionChecks.reduce((sum, check) => sum + check.missing, 0);

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
      titel: "Systeme zuordnen",
      beschreibung: "Hersteller, Systemarten und Dokumentarten auswählen.",
      href: "/systemauswahl",
      status: systemSelectionCount ? "fertig" : aktiveLeistungsbereiche.length ? "in-arbeit" : "offen",
      kennzahl: systemSelectionCount ? `${systemSelectionCount} Systeme` : "optional"
    },
    {
      nr: 5,
      titel: "Dokumentenmatrix prüfen",
      beschreibung: "Aktive Kapitel und Exportreihenfolge kontrollieren.",
      href: "/dokumente",
      status: aktiveDokumente.length ? "fertig" : "offen",
      kennzahl: `${aktiveDokumente.length} aktiv`
    },
    {
      nr: 6,
      titel: "Gerätelisten füllen",
      beschreibung: "Gerätepositionen pro Leistungsbereich ergänzen.",
      href: "/geraetelisten",
      status: activeLists.length && filledLists.length === activeLists.length ? "fertig" : filledLists.length ? "in-arbeit" : "offen",
      kennzahl: `${filledLists.length}/${activeLists.length} Listen`
    },
    {
      nr: 7,
      titel: "Brandschutz prüfen",
      beschreibung: "Brandschottungen erfassen, falls erforderlich.",
      href: "/brandschutz",
      status: brandschutzEintraege.length && !brandschutzEintraege.filter((entry) => entry.aktiv && hasMissingRequiredBrandschutzFields(entry)).length ? "fertig" : brandschutzEintraege.length ? "in-arbeit" : "offen",
      kennzahl: `${brandschutzEintraege.length} Einträge`
    },
    {
      nr: 8,
      titel: "Export vorbereiten",
      beschreibung: "PDFs erzeugen, Exportliste prüfen und final vorbereiten.",
      href: "/export",
      status: exportReady && !exportEintraege.filter((entry) => entry.pflicht && entry.status === "fehlt").length ? "fertig" : exportReady ? "in-arbeit" : "offen",
      kennzahl: `${exportEintraege.length} Exporteinträge`
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
      export: exportDokumente.length,
      pflicht: pflichtDokumente.length,
      fehlendePflicht: fehlendePflicht.length
    },
    geraetelisten: {
      gesamt: listen.length,
      aktiv: listen.filter((liste) => liste.aktiv).length,
      leer: listen.filter((liste) => !liste.positionen || liste.positionen.length === 0).length
    },
    brandschutz: {
      gesamt: brandschutzEintraege.length,
      fehlendePflichtangaben: missingBrandschutz
    },
    export: {
      gesamt: exportEintraege.length,
      vorhanden: exportEintraege.filter((entry) => entry.status === "vorhanden").length,
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
