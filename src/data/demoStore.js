// * INFO: Neutraler Demo-Datenspeicher fuer das API-Grundgeruest.
// ? WARUM: Die bestehende App nutzt dateibasierte Projektdaten. Die API startet
// ? WARUM: bewusst separat, damit keine bestehende Fachlogik veraendert wird.
const projects = [
  {
    id: "musterprojekt",
    name: "Musterprojekt",
    projectNumber: "MP-2026-001",
    customer: "Demo GmbH",
    site: "Baustelle Musterstrasse",
    building: "Verwaltungsgebaeude",
    status: "active"
  },
  {
    id: "standort-nord",
    name: "Standort Nord",
    projectNumber: "SN-2026-002",
    customer: "Kunde A",
    site: "Technikzentrale",
    building: "Betriebsgebaeude",
    status: "draft"
  }
];

const serviceAreas = [
  {
    id: "elektroinstallation",
    name: "Elektroinstallation / DIN VDE 0100",
    active: true,
    norms: ["DIN VDE 0100"],
    description: "Grundinstallation fuer Niederspannungsanlagen im Gebaeude."
  },
  {
    id: "sicherheitsbeleuchtung",
    name: "Sicherheitsbeleuchtung",
    active: true,
    norms: ["DIN EN 1838"],
    description: "Sicherheitsbeleuchtungsanlage fuer Flucht- und Rettungswege."
  },
  {
    id: "brandschutzabschottungen",
    name: "Brandschutzabschottungen",
    active: true,
    norms: ["MLAR", "ETA / abZ"],
    description: "Dokumentation von Abschottungen in raumabschliessenden Bauteilen."
  }
];

const deviceLists = [
  {
    id: "hv-technik",
    title: "HV Technik",
    serviceAreaId: "elektroinstallation",
    chapter: "6.1.1",
    items: [
      { position: 1, lvPosition: "01.01.0010", manufacturer: "Demo Hersteller", system: "HV", type: "Hauptverteilung", location: "Technikzentrale" }
    ]
  },
  {
    id: "uv-buero-eg",
    title: "UV Buero EG",
    serviceAreaId: "elektroinstallation",
    chapter: "6.1.2",
    items: [
      { position: 1, lvPosition: "01.01.0020", manufacturer: "Muster Hersteller", system: "UV", type: "Unterverteilung", location: "EG" }
    ]
  }
];

const documents = [
  {
    id: "konformitaet-elektro",
    title: "Konformitaetserklaerung Elektroinstallation",
    type: "Konformitaetserklaerung",
    chapter: "2.1",
    serviceAreaId: "elektroinstallation",
    generated: true,
    exportRelevant: true,
    notes: "Demo-Dokument fuer technische Nachweise."
  },
  {
    id: "anlagenbeschreibung",
    title: "Anlagenbeschreibung",
    type: "Beschreibung",
    chapter: "3.1",
    serviceAreaId: "allgemein",
    generated: true,
    exportRelevant: true,
    notes: "Zusammenfassende Beschreibung der dokumentierten Anlage."
  },
  {
    id: "stromlaufplaene",
    title: "Stromlaufplaene",
    type: "Anhang",
    chapter: "12.1",
    serviceAreaId: "plaene",
    generated: false,
    exportRelevant: true,
    notes: "Importierte PDF-Anhaenge werden spaeter hier einsortiert."
  }
];

const explanationTexts = [
  {
    id: "api-demo",
    title: "API-Demo",
    text: "Diese API liefert derzeit neutrale Demo-Daten und ersetzt keine bestehende Projektlogik."
  }
];

const normHints = [
  {
    id: "din-vde-0100",
    norm: "DIN VDE 0100",
    hint: "Normenhinweis fuer die Errichtung von Niederspannungsanlagen."
  },
  {
    id: "din-en-1838",
    norm: "DIN EN 1838",
    hint: "Normenhinweis fuer Sicherheitsbeleuchtung."
  }
];

const exportStatus = {
  mode: "demo",
  generatedDocuments: 2,
  pendingDocuments: 1,
  lastExport: null,
  target: "PDF-Dokumentation und ZIP-Export"
};

module.exports = {
  deviceLists,
  documents,
  explanationTexts,
  exportStatus,
  normHints,
  projects,
  serviceAreas
};
