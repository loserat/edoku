const BRANDSCHUTZ_REQUIRED_FIELDS = ["geschoss", "raum", "bauteil"];

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

function hasMissingRequiredBrandschutzFields(entry) {
  return BRANDSCHUTZ_REQUIRED_FIELDS.some((field) => !String(entry[field] || "").trim());
}

function normalizeBrandschutz(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => ({
    ...emptyBrandschutzEintrag(index + 1),
    ...entry,
    id: entry.id || `bs_${String(index + 1).padStart(3, "0")}`,
    aktiv: entry.aktiv !== false
  }));
}

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
