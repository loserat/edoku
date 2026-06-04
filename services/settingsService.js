const DEFAULT_SYSTEM_SETTINGS = {
  appTitel: "edoku",
  standardGewerk: "Elektrotechnik",
  standardEinheit: "Stk",
  autosaveHinweis: true,
  pdfFooterText: "Bearbeiter | Ort / Datum",
  exportOrdnerPrefix: "ProjektExport",
  datumFormat: "de-DE",
  ersteller: {
    name: "",
    firma: "",
    anschrift: "",
    telefon: "",
    email: "",
    webseite: "",
    bearbeiter: "",
    logoPfad: ""
  }
};

function checkbox(value) {
  return value === "on" || value === true || value === "true";
}

function mergeSystemSettings(settings = {}) {
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(settings || {}),
    ersteller: {
      ...DEFAULT_SYSTEM_SETTINGS.ersteller,
      ...((settings || {}).ersteller || {})
    }
  };
}

function normalizePostedSystemSettings(body = {}) {
  return {
    appTitel: String(body.appTitel || DEFAULT_SYSTEM_SETTINGS.appTitel).trim(),
    standardGewerk: String(body.standardGewerk || DEFAULT_SYSTEM_SETTINGS.standardGewerk).trim(),
    standardEinheit: String(body.standardEinheit || DEFAULT_SYSTEM_SETTINGS.standardEinheit).trim(),
    autosaveHinweis: checkbox(body.autosaveHinweis),
    pdfFooterText: String(body.pdfFooterText || DEFAULT_SYSTEM_SETTINGS.pdfFooterText).trim(),
    exportOrdnerPrefix: String(body.exportOrdnerPrefix || DEFAULT_SYSTEM_SETTINGS.exportOrdnerPrefix).trim(),
    datumFormat: String(body.datumFormat || DEFAULT_SYSTEM_SETTINGS.datumFormat).trim()
  };
}

function normalizePostedErstellerStammdaten(body = {}, current = {}) {
  const merged = mergeSystemSettings(current);
  return {
    ...merged,
    ersteller: {
      ...merged.ersteller,
      name: String(body.name || "").trim(),
      firma: String(body.firma || "").trim(),
      anschrift: String(body.anschrift || "").trim(),
      telefon: String(body.telefon || "").trim(),
      email: String(body.email || "").trim(),
      webseite: String(body.webseite || "").trim(),
      bearbeiter: String(body.bearbeiter || "").trim()
    }
  };
}

function uniqueTrimmed(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizePostedLeistungsbereiche(body = {}, current = {}) {
  const rows = Array.isArray(body.leistungsbereiche)
    ? body.leistungsbereiche
    : Object.values(body.leistungsbereiche || {});
  const optionen = uniqueTrimmed(rows.filter((row) => row && row._delete !== "1").map((row) => row.name));
  const activeFromRows = rows
    .filter((row) => row && row._delete !== "1" && checkbox(row.aktiv))
    .map((row) => String(row.name || "").trim());
  const aktiv = uniqueTrimmed(activeFromRows).filter((name) => optionen.includes(name));
  const systemAuswahl = {};

  Object.entries(current.systemAuswahl || {}).forEach(([key, value]) => {
    if (optionen.includes(key)) systemAuswahl[key] = value;
  });

  return {
    optionen,
    aktiv,
    systemAuswahl
  };
}

function normalizePostedOrdnerstruktur(body = {}, current = {}) {
  const unterordner = uniqueTrimmed(String(body.unterordner || "").split(/\r?\n/));
  return {
    basisordner: String(body.basisordner || current.basisordner || "output/projekte/[projektnummer]_[projektname]").trim(),
    unterordner
  };
}

module.exports = {
  DEFAULT_SYSTEM_SETTINGS,
  mergeSystemSettings,
  normalizePostedErstellerStammdaten,
  normalizePostedLeistungsbereiche,
  normalizePostedOrdnerstruktur,
  normalizePostedSystemSettings
};
