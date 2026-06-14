// Kapitel- und Titelzuordnung der Gerätelisten pro Leistungsbereich.
// Diese Zuordnung beeinflusst Inhaltsverzeichnis, PDF-Dateinamen und Exportreihenfolge.
const GERAETELISTEN_KAPITEL = {
  "Elektroinstallation / DIN VDE 0100": {
    kapitel: "6.4",
    titel: "Geräteliste Niederspannungsinstallationsanlagen",
    einheit: "Stk"
  },
  "Sicherheitsbeleuchtung": {
    kapitel: "6.5",
    titel: "Geräteliste Beleuchtungsanlagen",
    einheit: "Stk"
  },
  "Beleuchtungsanlage": {
    kapitel: "6.5",
    titel: "Geräteliste Beleuchtungsanlagen",
    einheit: "Stk"
  },
  "Kabeltragsysteme / Verlegesysteme": {
    kapitel: "6.4",
    titel: "Geräteliste Kabeltragsysteme / Verlegesysteme",
    einheit: "m"
  },
  "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt": {
    kapitel: "6.4",
    titel: "Geräteliste Kabeltragsysteme / Verlegesysteme mit Funktionserhalt",
    einheit: "m"
  },
  "Niederspannungsschaltanlagen / Verteilungen": {
    kapitel: "6.3",
    titel: "Geräteliste Niederspannungsschaltanlagen",
    einheit: "Stk"
  },
  "Erdung / Potentialausgleich": {
    kapitel: "6.6",
    titel: "Geräteliste Blitzschutz- und Erdungsanlagen",
    einheit: "m"
  },
  "Blitzschutzanlage": {
    kapitel: "6.6",
    titel: "Geräteliste Blitzschutz- und Erdungsanlagen",
    einheit: "Stk"
  },
  "Datentechnik / Kommunikationsverkabelung": {
    kapitel: "6.13",
    titel: "Geräteliste Übertragungsnetze",
    einheit: "Stk"
  },
  "Telekommunikation": {
    kapitel: "6.7",
    titel: "Geräteliste Telekommunikationsanlagen",
    einheit: "Stk"
  },
  "Breitbandkommunikationsanlage": {
    kapitel: "6.11",
    titel: "Geräteliste Fernseh- und Antennenanlagen",
    einheit: "Stk"
  },
  "Rauchwarnmelderanlage": {
    kapitel: "6.12",
    titel: "Geräteliste Gefahrenmelde- und Alarmanlagen",
    einheit: "Stk"
  },
  "Brandmeldeanlage": {
    kapitel: "6.12",
    titel: "Geräteliste Gefahrenmelde- und Alarmanlagen",
    einheit: "Stk"
  },
  "Gefahrenmelde- / Alarmanlage": {
    kapitel: "6.12",
    titel: "Geräteliste Gefahrenmelde- und Alarmanlagen",
    einheit: "Stk"
  },
  "Präsenzmelder": {
    kapitel: "6.4",
    titel: "Geräteliste Präsenzmelder",
    einheit: "Stk"
  },
  "Brandschutzabschottungen": {
    kapitel: "13.5",
    titel: "Brandschutzliste Abschottungen",
    einheit: "Stk"
  }
};

// Gemeinsame Basisfelder jeder Geräteliste. Optionale Felder werden je
// Leistungsbereich durch DEVICE_FIELD_PROFILES ergänzt.
const BASE_DEVICE_FIELDS = [
  { name: "lvPosition", label: "LV-Position (optional)", pdfLabel: "LV-Pos.", required: false, pdfWidth: 50 },
  { name: "hersteller", label: "Hersteller", required: true, suggest: "hersteller", pdfWidth: 56 },
  { name: "system", label: "System", required: true, suggest: "system", pdfWidth: 58 },
  { name: "typ", label: "Typ", required: true, suggest: "typ", pdfWidth: 54 },
  { name: "beschreibung", label: "Beschreibung", required: false, pdfWidth: 92 }
];

const OPTIONAL_END_FIELDS = [
  { name: "bemerkung", label: "Bemerkung", required: false, pdfWidth: 78 }
];

// Leistungsbereichsspezifische Zusatzfelder. Nur Felder mit required=true zählen
// später für Vollständigkeits- und Fortschrittsberechnungen.
const DEVICE_FIELD_PROFILES = {
  "Elektroinstallation / DIN VDE 0100": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 },
    { name: "leistung", label: "Leistung (optional)", required: false, pdfWidth: 50 }
  ],
  "Sicherheitsbeleuchtung": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 },
    { name: "leistung", label: "Leistung (optional)", required: false, pdfWidth: 50 },
    { name: "farbe", label: "Farbe (optional)", required: false, pdfWidth: 46 }
  ],
  "Beleuchtungsanlage": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 },
    { name: "leistung", label: "Leistung (optional)", required: false, pdfWidth: 50 },
    { name: "farbe", label: "Farbe (optional)", required: false, pdfWidth: 46 }
  ],
  "Kabeltragsysteme / Verlegesysteme": [
    { name: "abmessung", label: "Abmessung", required: true, pdfWidth: 58 }
  ],
  "Kabeltragsysteme / Verlegesysteme mit Funktionserhalt": [
    { name: "abmessung", label: "Abmessung", required: true, pdfWidth: 58 },
    { name: "funktionserhalt", label: "Funktionserhalt", required: true, pdfWidth: 58 }
  ],
  "Niederspannungsschaltanlagen / Verteilungen": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 },
    { name: "leistung", label: "Leistung / Strom (optional)", pdfLabel: "Leistung", required: false, pdfWidth: 54 }
  ],
  "Erdung / Potentialausgleich": [
    { name: "abmessung", label: "Abmessung (optional)", required: false, pdfWidth: 56 }
  ],
  "Blitzschutzanlage": [
    { name: "abmessung", label: "Abmessung (optional)", required: false, pdfWidth: 56 }
  ],
  "Datentechnik / Kommunikationsverkabelung": [
    { name: "kategorie", label: "Kategorie (optional)", required: false, pdfWidth: 54 }
  ],
  "Telekommunikation": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 }
  ],
  "Breitbandkommunikationsanlage": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 }
  ],
  "Rauchwarnmelderanlage": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 },
    { name: "farbe", label: "Farbe (optional)", required: false, pdfWidth: 46 }
  ],
  "Brandmeldeanlage": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 }
  ],
  "Gefahrenmelde- / Alarmanlage": [
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 }
  ],
  "Präsenzmelder": [
    { name: "farbe", label: "Farbe (optional)", required: false, pdfWidth: 46 },
    { name: "spannung", label: "Spannung (optional)", required: false, pdfWidth: 50 }
  ],
  "Brandschutzabschottungen": [
    { name: "abmessung", label: "Abmessung (optional)", required: false, pdfWidth: 56 }
  ]
};

// Liefert die komplette Feldliste für GUI und PDF-Ausgabe eines Leistungsbereichs.
function deviceListFieldsForLeistungsbereich(leistungsbereich) {
  return [
    ...BASE_DEVICE_FIELDS,
    ...(DEVICE_FIELD_PROFILES[leistungsbereich] || [{ name: "abmessung", label: "Abmessung (optional)", required: false, pdfWidth: 56 }]),
    ...OPTIONAL_END_FIELDS
  ];
}

// Pflichtfelder einer Geräteposition; optionale Angaben werden nicht als Fehler gewertet.
function requiredDeviceFieldsForLeistungsbereich(leistungsbereich) {
  return deviceListFieldsForLeistungsbereich(leistungsbereich)
    .filter((field) => field.required)
    .map((field) => field.name);
}

// Prüft, ob eine einzelne Geräteposition fachlich ausreichend ausgefüllt ist.
function isDevicePositionComplete(position, leistungsbereich) {
  return requiredDeviceFieldsForLeistungsbereich(leistungsbereich)
    .every((fieldName) => String(position[fieldName] || "").trim());
}

// Eine Geräteliste gilt als vollständig, sobald mindestens eine vollständige Position vorhanden ist.
function isGeraetelisteComplete(liste) {
  return (liste.positionen || []).some((position) => isDevicePositionComplete(position, liste.leistungsbereich));
}

function compareKapitel(a, b) {
  return String(a.kapitel || "").localeCompare(String(b.kapitel || ""), "de", { numeric: true })
    || String(a.titel || "").localeCompare(String(b.titel || ""), "de", { sensitivity: "base" })
    || String(a.leistungsbereich || "").localeCompare(String(b.leistungsbereich || ""), "de", { sensitivity: "base" });
}

function sortGeraetelistenByKapitel(listen) {
  return [...(listen || [])].sort(compareKapitel);
}

function slugForTemplate(value) {
  return String(value || "geraeteliste")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "geraeteliste";
}

// Technische ID aus Leistungsbereichsnamen für stabile Formular- und JSON-Zuordnung.
function idForLeistungsbereich(leistungsbereich) {
  return `gl_${leistungsbereich
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

// Standardposition für neu angelegte Gerätelisten oder zusätzliche Zeilen.
function emptyPosition(pos = 1, _einheit = "Stk", defaults = {}) {
  return {
    pos,
    hersteller: defaults.hersteller || "",
    system: defaults.herstellerSystem || defaults.systemart || "",
    typ: "",
    beschreibung: "",
    abmessung: "",
    farbe: "",
    spannung: "",
    leistung: "",
    kategorie: "",
    funktionserhalt: "",
    lvPosition: "",
    bedienungsanleitungId: "",
    bemerkung: ""
  };
}

// Holt die projektspezifische Systemvorauswahl für einen Leistungsbereich.
function selectionFor(leistungsbereich, projektSysteme = []) {
  return (projektSysteme || []).find((entry) => entry.leistungsbereich === leistungsbereich) || {};
}

// Erstellt eine Geräteliste aus Leistungsbereich, Kapitelmapping und Systemvorauswahl.
function createGeraeteliste(leistungsbereich, aktiv = false, projektSysteme = []) {
  const mapping = GERAETELISTEN_KAPITEL[leistungsbereich];
  const selection = selectionFor(leistungsbereich, projektSysteme);
  return {
    id: idForLeistungsbereich(leistungsbereich),
    leistungsbereich,
    kapitel: selection.geraetelisteKapitel || mapping.kapitel,
    titel: mapping.titel,
    herstellerVorauswahl: selection.hersteller || "",
    systemartVorauswahl: selection.herstellerSystem || selection.systemart || "",
    aktiv,
    export: true,
    positionen: [emptyPosition(1, mapping.einheit, selection)]
  };
}

// Überführt ältere flache Positionsdaten in die aktuelle Positionsstruktur.
function normalizeFlatPosition(item) {
  return {
    pos: Number(item.pos || item.position || 1),
    hersteller: item.hersteller || "",
    system: item.system || "",
    typ: item.typ || item.artikelTyp || "",
    beschreibung: item.beschreibung || "",
    abmessung: item.abmessung || "",
    farbe: item.farbe || "",
    spannung: item.spannung || "",
    leistung: item.leistung || "",
    kategorie: item.kategorie || "",
    lvPosition: item.lvPosition || item.lvPositionNr || item.lvPositionnummer || "",
    bedienungsanleitungId: item.bedienungsanleitungId || item.anleitungId || "",
    bemerkung: item.bemerkung || ""
  };
}

// Normalisiert alte und neue JSON-Formate und sortiert die Listen nach Kapitel.
function normalizeGeraetelisten(raw) {
  if (!Array.isArray(raw)) return [];
  const looksLikeNewShape = raw.some((entry) => Array.isArray(entry.positionen));
  if (looksLikeNewShape) {
    return sortGeraetelistenByKapitel(raw
      .filter((entry) => entry && entry.leistungsbereich)
      .map((entry) => {
        const mapping = GERAETELISTEN_KAPITEL[entry.leistungsbereich];
        return {
          id: entry.id || idForLeistungsbereich(entry.leistungsbereich),
          leistungsbereich: entry.leistungsbereich,
          kapitel: entry.kapitel || (mapping ? mapping.kapitel : ""),
          titel: entry.titel || (mapping ? mapping.titel : `Geräteliste ${entry.leistungsbereich}`),
          herstellerVorauswahl: entry.herstellerVorauswahl || "",
          systemartVorauswahl: entry.systemartVorauswahl || "",
          aktiv: Boolean(entry.aktiv),
          export: entry.export !== false,
          positionen: (entry.positionen || []).map((position, index) => ({
            ...emptyPosition(index + 1, mapping ? mapping.einheit : "Stk"),
            ...normalizeFlatPosition(position),
            pos: Number(position.pos || index + 1)
          }))
        };
      }));
  }

  const grouped = new Map();
  raw.forEach((item) => {
    if (!item.leistungsbereich || !GERAETELISTEN_KAPITEL[item.leistungsbereich]) return;
    if (!grouped.has(item.leistungsbereich)) {
      grouped.set(item.leistungsbereich, createGeraeteliste(item.leistungsbereich, true));
      grouped.get(item.leistungsbereich).positionen = [];
    }
    grouped.get(item.leistungsbereich).positionen.push(normalizeFlatPosition(item));
  });

  return sortGeraetelistenByKapitel([...grouped.values()].map((liste) => ({
    ...liste,
    positionen: liste.positionen.map((position, index) => ({ ...position, pos: index + 1 }))
  })));
}

// Synchronisiert Gerätelisten mit den aktiven Leistungsbereichen, ohne vorhandene
// Positionen beim Deaktivieren eines Bereichs zu löschen.
function syncGeraetelistenFromLeistungsbereiche(rawGeraetelisten, aktiveLeistungsbereiche, projektSysteme = []) {
  const activeSet = new Set(aktiveLeistungsbereiche || []);
  const listen = normalizeGeraetelisten(rawGeraetelisten);
  const byLeistungsbereich = new Map(listen.map((liste) => [liste.leistungsbereich, liste]));

  Object.keys(GERAETELISTEN_KAPITEL).forEach((leistungsbereich) => {
    const aktiv = activeSet.has(leistungsbereich);
    const selection = selectionFor(leistungsbereich, projektSysteme);
    if (!byLeistungsbereich.has(leistungsbereich)) {
      byLeistungsbereich.set(leistungsbereich, createGeraeteliste(leistungsbereich, aktiv, projektSysteme));
      return;
    }

    const liste = byLeistungsbereich.get(leistungsbereich);
    const mapping = GERAETELISTEN_KAPITEL[leistungsbereich];
    byLeistungsbereich.set(leistungsbereich, {
      ...liste,
      kapitel: selection.geraetelisteKapitel || liste.kapitel || mapping.kapitel,
      titel: liste.titel || mapping.titel,
      herstellerVorauswahl: selection.hersteller || liste.herstellerVorauswahl || "",
      systemartVorauswahl: selection.herstellerSystem || selection.systemart || liste.systemartVorauswahl || "",
      aktiv,
      export: liste.export !== false,
      positionen: liste.positionen.length ? liste.positionen : [emptyPosition(1, mapping.einheit, selection)]
    });
  });

  return sortGeraetelistenByKapitel([...byLeistungsbereich.values()]);
}

// Wandelt Formularwerte aus der Geräte-Tabelle zurück in die gespeicherte JSON-Struktur.
function normalizePostedGeraetelisten(posted) {
  const listen = Array.isArray(posted) ? posted : Object.values(posted || {});
  return sortGeraetelistenByKapitel(listen
    .filter((liste) => liste && liste.leistungsbereich)
    .map((liste) => {
      const mapping = GERAETELISTEN_KAPITEL[liste.leistungsbereich] || { einheit: "Stk" };
      const positionen = Object.values(liste.positionen || {})
        .filter((position) => position && position._delete !== "1")
        .map((position, index) => ({
          pos: index + 1,
          hersteller: position.hersteller || "",
          system: position.system || "",
          typ: position.typ || "",
          beschreibung: position.beschreibung || "",
          abmessung: position.abmessung || "",
          farbe: position.farbe || "",
          spannung: position.spannung || "",
          leistung: position.leistung || "",
          kategorie: position.kategorie || "",
          lvPosition: position.lvPosition || "",
          bedienungsanleitungId: liste.leistungsbereich === "Brandschutzabschottungen" ? "" : position.bedienungsanleitungId || "",
          bemerkung: position.bemerkung || ""
        }));

      return {
        id: liste.id || idForLeistungsbereich(liste.leistungsbereich),
        leistungsbereich: liste.leistungsbereich,
        kapitel: liste.kapitel || mapping.kapitel || "",
        titel: liste.titel || mapping.titel || `Geräteliste ${liste.leistungsbereich}`,
        herstellerVorauswahl: liste.herstellerVorauswahl || "",
        systemartVorauswahl: liste.systemartVorauswahl || "",
        aktiv: liste.aktiv === "on" || liste.aktiv === "true",
        export: liste.export === "on" || liste.export === "true",
        positionen
      };
    }));
}

// Ergänzt in einer bestimmten Geräteliste eine zusätzliche leere Position.
function addPosition(rawGeraetelisten, listId) {
  return normalizeGeraetelisten(rawGeraetelisten).map((liste) => {
    if (liste.id !== listId) return liste;
    const mapping = GERAETELISTEN_KAPITEL[liste.leistungsbereich] || { einheit: "Stk" };
    const defaults = {
      hersteller: liste.herstellerVorauswahl || "",
      systemart: liste.systemartVorauswahl || ""
    };
    return {
      ...liste,
      positionen: [
        ...liste.positionen,
        emptyPosition(liste.positionen.length + 1, mapping.einheit, defaults)
      ]
    };
  });
}

// Normalisiert systemweite Gerätelisten-Vorlagen aus der Konfiguration.
// Vorlagen sind absichtlich unabhängig vom Projekt und können wieder geladen werden.
function normalizeGeraetelistenVorlagen(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((template) => template && template.id && template.leistungsbereich)
    .map((template) => {
      const normalizedList = normalizeGeraetelisten([{
        id: template.listId || idForLeistungsbereich(template.leistungsbereich),
        leistungsbereich: template.leistungsbereich,
        kapitel: template.kapitel,
        titel: template.titel,
        herstellerVorauswahl: template.herstellerVorauswahl,
        systemartVorauswahl: template.systemartVorauswahl,
        aktiv: true,
        export: true,
        positionen: template.positionen || []
      }])[0] || {};

      return {
        id: String(template.id),
        name: String(template.name || template.titel || template.leistungsbereich),
        leistungsbereich: String(template.leistungsbereich),
        kapitel: String(template.kapitel || normalizedList.kapitel || ""),
        titel: String(template.titel || normalizedList.titel || `Geräteliste ${template.leistungsbereich}`),
        herstellerVorauswahl: String(template.herstellerVorauswahl || ""),
        systemartVorauswahl: String(template.systemartVorauswahl || ""),
        positionen: normalizedList.positionen || [],
        erstelltAm: template.erstelltAm || new Date().toISOString(),
        aktualisiertAm: template.aktualisiertAm || template.erstelltAm || new Date().toISOString()
      };
    })
    .sort((a, b) => String(a.leistungsbereich).localeCompare(String(b.leistungsbereich), "de", { sensitivity: "base" })
      || String(a.name).localeCompare(String(b.name), "de", { numeric: true, sensitivity: "base" }));
}

// Erstellt aus einer aktuellen Projekt-Geräteliste eine systemweite Vorlage.
function createGeraetelistenVorlage(liste, name = "") {
  const normalized = normalizeGeraetelisten([liste])[0];
  if (!normalized) return null;
  const now = new Date().toISOString();
  const templateName = String(name || `${normalized.titel} - ${normalized.leistungsbereich}`).trim();
  return {
    id: `glv_${Date.now()}_${slugForTemplate(templateName)}`,
    name: templateName,
    leistungsbereich: normalized.leistungsbereich,
    kapitel: normalized.kapitel,
    titel: normalized.titel,
    herstellerVorauswahl: normalized.herstellerVorauswahl || "",
    systemartVorauswahl: normalized.systemartVorauswahl || "",
    positionen: normalized.positionen.map((position, index) => ({ ...position, pos: index + 1 })),
    erstelltAm: now,
    aktualisiertAm: now
  };
}

function addGeraetelistenVorlage(rawTemplates, liste, name = "") {
  const template = createGeraetelistenVorlage(liste, name);
  if (!template) return normalizeGeraetelistenVorlagen(rawTemplates);
  return normalizeGeraetelistenVorlagen([...normalizeGeraetelistenVorlagen(rawTemplates), template]);
}

// Wendet eine Vorlage auf eine bestehende Geräteliste an. Stammdaten der Liste
// bleiben erhalten; ersetzt werden die Positionszeilen und Vorauswahlwerte.
function applyGeraetelistenVorlage(liste, template) {
  const current = normalizeGeraetelisten([liste])[0];
  const normalizedTemplate = normalizeGeraetelistenVorlagen([template])[0];
  if (!current || !normalizedTemplate) return current || liste;
  return normalizeGeraetelisten([{
    ...current,
    herstellerVorauswahl: normalizedTemplate.herstellerVorauswahl || current.herstellerVorauswahl || "",
    systemartVorauswahl: normalizedTemplate.systemartVorauswahl || current.systemartVorauswahl || "",
    positionen: normalizedTemplate.positionen.map((position, index) => ({ ...position, pos: index + 1 }))
  }])[0];
}

// Übernimmt bearbeitete Vorlagen aus dem Einstellungsformular.
function normalizePostedGeraetelistenVorlagen(posted, currentTemplates = []) {
  const currentById = new Map(normalizeGeraetelistenVorlagen(currentTemplates).map((template) => [template.id, template]));
  const rows = Array.isArray(posted) ? posted : Object.values(posted || {});
  return normalizeGeraetelistenVorlagen(rows
    .map((row) => {
      const existing = currentById.get(String(row.id || ""));
      if (!existing) return null;
      return {
        ...existing,
        name: String(row.name || existing.name).trim() || existing.name,
        aktualisiertAm: new Date().toISOString()
      };
    })
    .filter(Boolean));
}

module.exports = {
  DEVICE_FIELD_PROFILES,
  GERAETELISTEN_KAPITEL,
  addPosition,
  addGeraetelistenVorlage,
  applyGeraetelistenVorlage,
  createGeraeteliste,
  deviceListFieldsForLeistungsbereich,
  isDevicePositionComplete,
  isGeraetelisteComplete,
  normalizeGeraetelisten,
  normalizePostedGeraetelisten,
  normalizeGeraetelistenVorlagen,
  normalizePostedGeraetelistenVorlagen,
  sortGeraetelistenByKapitel,
  syncGeraetelistenFromLeistungsbereiche
};
