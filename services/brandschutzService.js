const BRANDSCHUTZ_REQUIRED_FIELDS = ["geschoss", "raum", "bauteil"];

// Vorlage für eine neue Brandschottung. Optionale Felder bleiben leer, werden
// aber bewusst mitgeführt, damit GUI, JSON und PDF dieselbe Struktur nutzen.
function emptyBrandschutzEintrag(index = 1) {
  return {
    id: `bs_${String(index).padStart(3, "0")}`,
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
  };
}

// Pflichtfeldprüfung für Dashboard und Vollständigkeitsstatus.
function hasMissingRequiredBrandschutzFields(entry) {
  return BRANDSCHUTZ_REQUIRED_FIELDS.some((field) => !String(entry[field] || "").trim());
}

// Normalisiert gespeicherte JSON-Daten und ergänzt fehlende Felder aus der Vorlage.
function normalizeBrandschutz(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => ({
    ...emptyBrandschutzEintrag(index + 1),
    ...entry,
    id: entry.id || `bs_${String(index + 1).padStart(3, "0")}`,
    aktiv: entry.aktiv !== false
  }));
}

// Wandelt Formularwerte aus der Tabelle zurück in die JSON-Struktur.
function normalizePostedBrandschutz(posted) {
  const rows = Array.isArray(posted) ? posted : Object.values(posted || {});
  return rows
    .filter((entry) => entry && entry._delete !== "1")
    .map((entry, index) => ({
      id: entry.id || `bs_${String(index + 1).padStart(3, "0")}`,
      aktiv: entry.aktiv === "on" || entry.aktiv === "true",
      geschoss: entry.geschoss || "",
      raum: entry.raum || "",
      bauteil: entry.bauteil || "",
      abschottungssystem: entry.abschottungssystem || "",
      hersteller: entry.hersteller || "",
      system: entry.system || "",
      zulassung: entry.zulassung || "",
      feuerwiderstand: entry.feuerwiderstand || "",
      medium: entry.medium || "",
      anzahl_kabel: entry.anzahl_kabel || "",
      durchmesser: entry.durchmesser || "",
      ausfuehrungsdatum: entry.ausfuehrungsdatum || "",
      monteur: entry.monteur || "",
      foto_vorher: entry.foto_vorher || "",
      foto_nachher: entry.foto_nachher || "",
      bemerkung: entry.bemerkung || ""
    }));
}

// Fügt eine neue leere Schottung am Ende der vorhandenen Liste hinzu.
function addBrandschutzEintrag(raw) {
  const entries = normalizeBrandschutz(raw);
  return [...entries, emptyBrandschutzEintrag(entries.length + 1)];
}

module.exports = {
  BRANDSCHUTZ_REQUIRED_FIELDS,
  addBrandschutzEintrag,
  emptyBrandschutzEintrag,
  hasMissingRequiredBrandschutzFields,
  normalizeBrandschutz,
  normalizePostedBrandschutz
};
