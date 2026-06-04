const fs = require("fs");
const path = require("path");
const { DEFAULT_FORM_TEMPLATES } = require("./formTemplateService");
const { DEFAULT_SYSTEM_SETTINGS } = require("./settingsService");

const DEFAULT_LEISTUNGSBEREICHE = [
  "Elektroinstallation / DIN VDE 0100",
  "Sicherheitsbeleuchtung",
  "Beleuchtungsanlage",
  "Kabeltragsysteme / Verlegesysteme",
  "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt",
  "Niederspannungsschaltanlagen / Verteilungen",
  "Erdung / Potentialausgleich",
  "Blitzschutzanlage",
  "Datentechnik / Kommunikationsverkabelung",
  "Telekommunikation",
  "Breitbandkommunikationsanlage",
  "Rauchwarnmelderanlage",
  "Brandmeldeanlage",
  "Gefahrenmelde- / Alarmanlage",
  "Präsenzmelder",
  "Brandschutzabschottungen",
  "Bestandspläne",
  "Bilddokumentation"
];

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function validateJsonFile(filePath) {
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Die JSON-Datei ${filePath} ist fehlerhaft und wurde nicht überschrieben: ${error.message}`);
  }
}

function ensureJsonFile(filePath, defaultValue) {
  if (fs.existsSync(filePath)) {
    validateJsonFile(filePath);
    return;
  }

  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(defaultValue, null, 2)}\n`, "utf8");
  console.log(`Default-JSON angelegt: ${filePath}`);
}

function defaultProjekt() {
  return {
    projektname: "Beispielprojekt",
    projektnummer: "2026-001",
    auftraggeber: "",
    liegenschaft: "",
    baumassnahme: "",
    massnahmeNr: "",
    auftragsNr: "",
    auftragGewerk: "Elektrotechnik",
    ortDerAusfuehrung: "",
    ausfuehrendeFirma: "",
    firmenanschrift: "",
    bearbeiter: "",
    ortDatum: "",
    logoPfad: ""
  };
}

function defaultDokumentenmatrix() {
  return [
    {
      id: "doc-1",
      kapitel: "1",
      titel: "Betriebskarteien",
      ebene: 1,
      aktiv: true,
      export: true,
      pflicht: true,
      leistungsbereich: "Allgemein",
      dokumenttyp: "Kapitel",
      formularart: "Struktur",
      quelle: "System",
      bemerkung: "Default bei fehlender Matrix",
      sortierung: 1000
    },
    {
      id: "doc-2-1",
      kapitel: "2.1",
      titel: "Konformitätserklärung Elektroinstallation nach DIN VDE 0100",
      ebene: 2,
      aktiv: true,
      export: true,
      pflicht: false,
      leistungsbereich: "Elektroinstallation / DIN VDE 0100",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Elektroinstallation, Grundlage DIN VDE 0100",
      sortierung: 2010
    },
    {
      id: "doc-2-2",
      kapitel: "2.2",
      titel: "Konformitätserklärung Sicherheitsbeleuchtung nach DIN EN 1838",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Sicherheitsbeleuchtung",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Sicherheitsbeleuchtung, Grundlage DIN EN 1838",
      sortierung: 2020,
      autoAktiv: true
    },
    {
      id: "doc-konf-beleuchtung",
      kapitel: "2.3",
      titel: "Konformitätserklärung Beleuchtungsanlagen nach ASR A3.4 / DIN EN 12464",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Beleuchtungsanlage",
      leistungsbereiche: ["Präsenzmelder"],
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Beleuchtungsanlagen und Präsenzmeldern",
      sortierung: 2030,
      autoAktiv: true
    },
    {
      id: "doc-2-3",
      kapitel: "2.4",
      titel: "Konformitätserklärung Kabeltragsysteme / Verlegesysteme nach DIN EN 61537",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Kabeltragsysteme / Verlegesysteme",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer / Hersteller",
      bemerkung: "Automatisch bei Kabeltragsystemen",
      sortierung: 2040,
      autoAktiv: true
    },
    {
      id: "doc-konf-kts-funktionserhalt",
      kapitel: "2.5",
      titel: "Konformitätserklärung Kabeltragsysteme mit Funktionserhalt nach DIN 4102-12",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer / Hersteller",
      bemerkung: "Automatisch bei Kabeltragsystemen mit Funktionserhalt",
      sortierung: 2050,
      autoAktiv: true
    },
    {
      id: "doc-2-4",
      kapitel: "2.6",
      titel: "Konformitätserklärung Niederspannungsschaltanlagen / Verteilungen nach DIN EN 61439",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Niederspannungsschaltanlagen / Verteilungen",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer / Hersteller",
      bemerkung: "Automatisch bei Verteilungen",
      sortierung: 2060,
      autoAktiv: true
    },
    {
      id: "doc-2-5",
      kapitel: "2.7",
      titel: "Konformitätserklärung Erdung / Potentialausgleich nach DIN VDE 0100-410 / DIN VDE 0100-540 / DIN 18014",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Erdung / Potentialausgleich",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Erdung / Potentialausgleich",
      sortierung: 2070,
      autoAktiv: true
    },
    {
      id: "doc-konf-blitzschutz",
      kapitel: "2.8",
      titel: "Konformitätserklärung Blitzschutzanlage nach DIN EN 62305 / DIN VDE 0185-305",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Blitzschutzanlage",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Blitzschutzanlagen",
      sortierung: 2080,
      autoAktiv: true
    },
    {
      id: "doc-2-6",
      kapitel: "2.9",
      titel: "Konformitätserklärung Datentechnik / Kommunikationsverkabelung nach DIN EN 50173 / DIN EN 50174",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Datentechnik / Kommunikationsverkabelung",
      leistungsbereiche: ["Telekommunikation", "Breitbandkommunikationsanlage"],
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Kommunikations- und Datentechnik",
      sortierung: 2090,
      autoAktiv: true
    },
    {
      id: "doc-konf-brandmeldeanlage",
      kapitel: "2.10",
      titel: "Konformitätserklärung Brandmeldeanlage nach DIN 14675 / DIN VDE 0833-1/-2 / DIN EN 54",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Brandmeldeanlage",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Brandmeldeanlagen",
      sortierung: 2100,
      autoAktiv: true
    },
    {
      id: "doc-konf-gefahrenmeldeanlage",
      kapitel: "2.11",
      titel: "Konformitätserklärung Gefahrenmelde- / Alarmanlage nach DIN VDE 0833-1/-3",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Gefahrenmelde- / Alarmanlage",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Gefahrenmelde- und Alarmanlagen",
      sortierung: 2110,
      autoAktiv: true
    },
    {
      id: "doc-konf-rauchwarnmelder",
      kapitel: "2.12",
      titel: "Konformitätserklärung Rauchwarnmelderanlage nach DIN 14676",
      ebene: 2,
      aktiv: false,
      export: false,
      pflicht: false,
      leistungsbereich: "Rauchwarnmelderanlage",
      dokumenttyp: "Konformitätserklärung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Automatisch bei Rauchwarnmelderanlagen",
      sortierung: 2120,
      autoAktiv: true
    },
    {
      id: "doc-3-1",
      kapitel: "3.1",
      titel: "Anlagenbeschreibung",
      ebene: 2,
      aktiv: true,
      export: true,
      pflicht: true,
      leistungsbereich: "Allgemein",
      dokumenttyp: "Anlagenbeschreibung",
      formularart: "Text",
      quelle: "manuelle Eingabe",
      bemerkung: "Default bei fehlender Matrix",
      sortierung: 3010
    },
    {
      id: "doc-6-4",
      kapitel: "6.4",
      titel: "Niederspannungsinstallationsanlagen",
      ebene: 2,
      aktiv: true,
      export: true,
      pflicht: false,
      leistungsbereich: "Elektroinstallation / DIN VDE 0100",
      dokumenttyp: "Geräteliste",
      formularart: "Tabelle",
      quelle: "data/geraetelisten.json",
      bemerkung: "Default bei fehlender Matrix",
      sortierung: 6040
    },
    {
      id: "doc-11-1",
      kapitel: "11.1",
      titel: "Bestätigung nach DGUV Vorschrift 3, § 5 Absatz 4",
      ebene: 2,
      aktiv: true,
      export: true,
      pflicht: false,
      leistungsbereich: "Elektroinstallation / DIN VDE 0100",
      dokumenttyp: "Bescheinigung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Default bei fehlender Matrix",
      sortierung: 11010
    },
    {
      id: "doc-11-2",
      kapitel: "11.2",
      titel: "Errichterbestätigung",
      ebene: 2,
      aktiv: true,
      export: true,
      pflicht: false,
      leistungsbereich: "Elektroinstallation / DIN VDE 0100",
      dokumenttyp: "Bescheinigung",
      formularart: "PDF/Scan",
      quelle: "Auftragnehmer",
      bemerkung: "Default bei fehlender Matrix",
      sortierung: 11020
    }
  ];
}

function defaultSysteme() {
  return {
    leistungsbereiche: [
      {
        name: "Kabeltragsysteme / Verlegesysteme",
        code: "KTS",
        beschreibung: "Default-Systemkonfiguration",
        hersteller: [
          {
            name: "OBO Bettermann",
            systeme: [],
            systemarten: ["Kabelrinne"],
            dokumentarten: ["Produktdatenblatt", "Montageanleitung", "Konformitätserklärung"],
            normen: ["DIN EN 61537"],
            kapitel: ["2.3", "3.1", "6.4", "7.4", "12.2"],
            geraetelisteKapitel: "6.4",
            bemerkung: ""
          }
        ]
      },
      {
        name: "Sicherheitsbeleuchtung",
        code: "SIBE",
        beschreibung: "Sicherheitsbeleuchtungsanlagen.",
        hersteller: [
          {
            name: "Sikora",
            systeme: [],
            systemarten: ["Einzelbatterieleuchten", "Zentralbatterieanlage", "Rettungszeichenleuchten", "Sicherheitsleuchten"],
            dokumentarten: ["Produktdatenblatt", "Montageanleitung", "Bedienungsanleitung", "Konformitätserklärung", "CE-Bestätigung", "Prüfbuch / Prüfprotokoll"],
            normen: ["DIN EN 1838"],
            kapitel: ["2.2", "4.1", "6.5", "7.5", "9.1", "10.3", "11.1", "12.2"],
            geraetelisteKapitel: "6.5",
            bemerkung: ""
          }
        ]
      },
      {
        name: "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt",
        code: "KTS-FE",
        beschreibung: "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt.",
        hersteller: [
          {
            name: "Allgemein",
            systeme: [],
            systemarten: ["E30", "E60", "E90"],
            dokumentarten: ["Produktdatenblatt", "Montageanleitung", "Konformitätserklärung", "Systemzulassung"],
            normen: ["DIN 4102-12"],
            kapitel: ["2.5", "6.4", "7.4", "12.2"],
            geraetelisteKapitel: "6.4",
            bemerkung: ""
          }
        ]
      }
    ]
  };
}

function defaultGeraetelisten() {
  return [
    {
      id: "gl_elektroinstallation_din_vde_0100",
      leistungsbereich: "Elektroinstallation / DIN VDE 0100",
      kapitel: "6.4",
      titel: "Geräteliste Niederspannungsinstallationsanlagen",
      aktiv: true,
      export: true,
      positionen: [
        {
          pos: 1,
          hersteller: "",
          system: "",
          typ: "",
          beschreibung: "Beispielposition",
          abmessung: "",
          lvPosition: "",
          bemerkung: "Default bei fehlender Geräteliste"
        }
      ]
    }
  ];
}

function defaultBrandschutz() {
  return [
    {
      id: "bs_001",
      aktiv: true,
      geschoss: "",
      raum: "",
      bauteil: "",
      abschottungssystem: "",
      hersteller: "",
      system: "",
      zulassung: "",
      feuerwiderstand: "",
      medium: "",
      anzahl_kabel: "",
      durchmesser: "",
      ausfuehrungsdatum: "",
      monteur: "",
      foto_vorher: "",
      foto_nachher: "",
      bemerkung: ""
    }
  ];
}

function defaultOrdnerstruktur() {
  return {
    basisordner: "output/projekte/[projektnummer]_[projektname]",
    unterordner: [
      "00_Projektdatei",
      "01_Eingang",
      "02_Config_Projekt",
      "02_Config_Projekt/01_Betriebskarteien",
      "02_Config_Projekt/02_Konformitaet_CE",
      "02_Config_Projekt/03_Anlagenbeschreibung_Bedienung",
      "02_Config_Projekt/04_Bedienung_Betrieb_Instandhaltung",
      "02_Config_Projekt/05_Unfallverhuetungsvorschriften",
      "02_Config_Projekt/06_Geraeteliste",
      "02_Config_Projekt/07_Produkt_Datenblaetter",
      "02_Config_Projekt/08_Abnahme_Maengelbeseitigung",
      "02_Config_Projekt/09_Einweisungsprotokolle",
      "02_Config_Projekt/10_Messprotokolle",
      "02_Config_Projekt/11_Sonstige_Bescheinigungen",
      "02_Config_Projekt/12_Bestandsplaene",
      "02_Config_Projekt/13_Sonstiges",
      "03_Manuell_einfuegen",
      "04_Generiert",
      "05_PDF_Merge",
      "06_Final"
    ]
  };
}

function bootstrapStorage(paths) {
  [
    paths.DATA_DIR,
    paths.CONFIG_DIR,
    paths.OUTPUT_DIR,
    paths.TEMPLATES_DIR,
    paths.STORAGE_DIR,
    path.join(paths.OUTPUT_DIR, "generiert"),
    path.join(paths.OUTPUT_DIR, "final"),
    path.join(paths.OUTPUT_DIR, "projekte"),
    path.join(paths.STORAGE_DIR, "exports"),
    path.join(paths.STORAGE_DIR, "imports"),
    path.join(paths.STORAGE_DIR, "users")
  ].forEach(ensureDirectoryExists);

  ensureJsonFile(path.join(paths.DATA_DIR, "projekt.json"), defaultProjekt());
  ensureJsonFile(path.join(paths.DATA_DIR, "leistungsbereiche.json"), {
    optionen: DEFAULT_LEISTUNGSBEREICHE,
    aktiv: [],
    systemAuswahl: {}
  });
  ensureJsonFile(path.join(paths.DATA_DIR, "dokumentenmatrix.json"), defaultDokumentenmatrix());
  ensureJsonFile(path.join(paths.DATA_DIR, "systeme.json"), defaultSysteme());
  ensureJsonFile(path.join(paths.DATA_DIR, "projektSysteme.json"), []);
  ensureJsonFile(path.join(paths.DATA_DIR, "geraetelisten.json"), defaultGeraetelisten());
  ensureJsonFile(path.join(paths.DATA_DIR, "brandschutz.json"), defaultBrandschutz());
  ensureJsonFile(path.join(paths.DATA_DIR, "anhaenge.json"), []);
  ensureJsonFile(path.join(paths.DATA_DIR, "exportliste.json"), []);
  ensureJsonFile(path.join(paths.DATA_DIR, "files.json"), []);
  ensureJsonFile(path.join(paths.DATA_DIR, "currentProject.json"), { projectId: "projekt_demo" });
  ensureJsonFile(path.join(paths.STORAGE_DIR, "projects.json"), [
    {
      id: "projekt_demo",
      userId: "user_demo",
      status: "aktiv",
      erstelltAm: new Date().toISOString(),
      geaendertAm: new Date().toISOString()
    }
  ]);
  ensureJsonFile(path.join(paths.CONFIG_DIR, "ordnerstruktur.json"), defaultOrdnerstruktur());
  ensureJsonFile(path.join(paths.CONFIG_DIR, "formularTemplates.json"), DEFAULT_FORM_TEMPLATES);
  ensureJsonFile(path.join(paths.CONFIG_DIR, "systemEinstellungen.json"), DEFAULT_SYSTEM_SETTINGS);
}

module.exports = {
  DEFAULT_LEISTUNGSBEREICHE,
  bootstrapStorage,
  ensureDirectoryExists
};
