const DEFAULT_THEME_SHAPE = { globalRadius: 14, cardRadius: 22, buttonRadius: 999, inputRadius: 14, borderWidth: 1 };
const DEFAULT_THEME_SPACING = { global: 12, page: 16, card: 14, form: 10, tableRowHeight: 42 };
const DEFAULT_THEME_TYPOGRAPHY = { base: 14, heading: 24, label: 12, button: 13, lineHeight: 1.42 };

const THEME_PRESETS = {
  "github-light": {
    name: "GitHub Light",
    preset: "github-light",
    mode: "light",
    colors: {
      bgLight: "#f6f8fa",
      bgDark: "#0d1117",
      surface: "#ffffff",
      surfaceMuted: "#f6f8fa",
      surfaceDark: "#161b22",
      surfaceMutedDark: "#21262d",
      text: "#1f2328",
      textMuted: "#656d76",
      textDark: "#e6edf3",
      textMutedDark: "#7d8590",
      accent: "#0969da",
      border: "#d0d7de",
      borderDark: "#30363d",
      buttonPrimary: "#1f883d",
      buttonSecondary: "#f6f8fa",
      warning: "#9a6700",
      danger: "#cf222e",
      success: "#1f883d"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 10, softness: 26 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "github-dark": {
    name: "GitHub Dark",
    preset: "github-dark",
    mode: "dark",
    colors: {
      bgLight: "#f6f8fa",
      bgDark: "#0d1117",
      surface: "#ffffff",
      surfaceMuted: "#f6f8fa",
      surfaceDark: "#161b22",
      surfaceMutedDark: "#21262d",
      text: "#1f2328",
      textMuted: "#656d76",
      textDark: "#e6edf3",
      textMutedDark: "#7d8590",
      accent: "#2f81f7",
      border: "#d0d7de",
      borderDark: "#30363d",
      buttonPrimary: "#3fb950",
      buttonSecondary: "#21262d",
      warning: "#d29922",
      danger: "#f85149",
      success: "#3fb950"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 16, softness: 34 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  }
};

const LEGACY_THEME_PRESET_MAP = {
  "apple-light": "github-light",
  "sage-copper": "github-light",
  "nordic-light": "github-light",
  "apple-dark": "github-dark",
  graphite: "github-dark",
  "blue-steel": "github-dark",
  "github-dimmed": "github-dark",
  "high-contrast": "github-dark",
  "warm-graphite": "github-dark",
  "violet-amber": "github-dark"
};

const DEFAULT_THEME_SETTINGS = THEME_PRESETS["github-light"];

// Globale Systemeinstellungen. Projektbezogene Daten bleiben in den Projekt-JSON-Dateien.
const DEFAULT_SYSTEM_SETTINGS = {
  appTitel: "edoku",
  standardGewerk: "Elektrotechnik",
  standardEinheit: "Stk",
  autosaveHinweis: true,
  deleteConfirmDialogs: true,
  pdfFooterText: "Bearbeiter | Ort / Datum",
  exportOrdnerPrefix: "ProjektExport",
  datumFormat: "de-DE",
  // * INFO: Exportbezogene Anzeigeoptionen, die nicht projektfachlich sind.
  export: {
    trennstreifen: {
      showInnenText: false,
      showRegisterTitel: false
    }
  },
  ersteller: {
    name: "",
    firma: "",
    anschrift: "",
    telefon: "",
    email: "",
    webseite: "",
    bearbeiter: "",
    logoPfad: ""
  },
  theme: DEFAULT_THEME_SETTINGS
};

// HTML-Checkboxen liefern verschiedene Werte je nach Quelle; diese Funktion vereinheitlicht sie.
function checkbox(value) {
  return value === "on" || value === true || value === "true";
}

function numberValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function textValue(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

// Theme-Konfiguration robust mit Defaults mergen, damit gespeicherte Altstände gültig bleiben.
function mergeThemeSettings(theme = {}) {
  const requestedPreset = theme.preset || DEFAULT_THEME_SETTINGS.preset;
  const presetKey = THEME_PRESETS[requestedPreset] ? requestedPreset : LEGACY_THEME_PRESET_MAP[requestedPreset] || DEFAULT_THEME_SETTINGS.preset;
  const preset = THEME_PRESETS[presetKey] || DEFAULT_THEME_SETTINGS;
  const isLegacyPreset = requestedPreset && !THEME_PRESETS[requestedPreset] && LEGACY_THEME_PRESET_MAP[requestedPreset];
  const themeOverrides = isLegacyPreset
    ? { ...(theme || {}), preset: presetKey, name: preset.name, colors: {}, shape: {}, shadow: {}, spacing: {}, typography: {} }
    : (theme || {});
  return {
    ...DEFAULT_THEME_SETTINGS,
    ...preset,
    ...themeOverrides,
    mode: ["light", "dark"].includes(themeOverrides.mode) ? themeOverrides.mode : preset.mode,
    colors: {
      ...DEFAULT_THEME_SETTINGS.colors,
      ...(preset.colors || {}),
      ...(themeOverrides.colors || {})
    },
    shape: {
      ...DEFAULT_THEME_SETTINGS.shape,
      ...(preset.shape || {}),
      ...(themeOverrides.shape || {})
    },
    shadow: {
      ...DEFAULT_THEME_SETTINGS.shadow,
      ...(preset.shadow || {}),
      ...(themeOverrides.shadow || {})
    },
    spacing: {
      ...DEFAULT_THEME_SETTINGS.spacing,
      ...(preset.spacing || {}),
      ...(themeOverrides.spacing || {})
    },
    typography: {
      ...DEFAULT_THEME_SETTINGS.typography,
      ...(preset.typography || {}),
      ...(themeOverrides.typography || {})
    }
  };
}

// Mischt gespeicherte Einstellungen mit Defaults, damit neue Felder alte Configs nicht brechen.
function mergeSystemSettings(settings = {}) {
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(settings || {}),
    ersteller: {
      ...DEFAULT_SYSTEM_SETTINGS.ersteller,
      ...((settings || {}).ersteller || {})
    },
    export: {
      ...DEFAULT_SYSTEM_SETTINGS.export,
      ...((settings || {}).export || {}),
      trennstreifen: {
        ...DEFAULT_SYSTEM_SETTINGS.export.trennstreifen,
        ...(((settings || {}).export || {}).trennstreifen || {})
      }
    },
    theme: mergeThemeSettings((settings || {}).theme || DEFAULT_THEME_SETTINGS)
  };
}

// Normalisiert das Formular "System" aus den Einstellungen.
function normalizePostedSystemSettings(body = {}) {
  return {
    appTitel: String(body.appTitel || DEFAULT_SYSTEM_SETTINGS.appTitel).trim(),
    standardGewerk: String(body.standardGewerk || DEFAULT_SYSTEM_SETTINGS.standardGewerk).trim(),
    standardEinheit: String(body.standardEinheit || DEFAULT_SYSTEM_SETTINGS.standardEinheit).trim(),
    autosaveHinweis: checkbox(body.autosaveHinweis),
    deleteConfirmDialogs: checkbox(body.deleteConfirmDialogs),
    pdfFooterText: String(body.pdfFooterText || DEFAULT_SYSTEM_SETTINGS.pdfFooterText).trim(),
    exportOrdnerPrefix: String(body.exportOrdnerPrefix || DEFAULT_SYSTEM_SETTINGS.exportOrdnerPrefix).trim(),
    datumFormat: String(body.datumFormat || DEFAULT_SYSTEM_SETTINGS.datumFormat).trim()
  };
}

// Normalisiert die Theme-Editor-Werte aus den Einstellungen.
function normalizePostedThemeSettings(body = {}, current = {}) {
  const merged = mergeThemeSettings(current);
  return {
    preset: textValue(body.preset, merged.preset || DEFAULT_THEME_SETTINGS.preset),
    name: textValue(body.name, merged.name || "Eigenes Theme"),
    mode: ["light", "dark"].includes(body.mode) ? body.mode : merged.mode,
    colors: {
      bgLight: textValue(body.bgLight, merged.colors.bgLight),
      bgDark: textValue(body.bgDark, merged.colors.bgDark),
      surface: textValue(body.surface, merged.colors.surface),
      surfaceMuted: textValue(body.surfaceMuted, merged.colors.surfaceMuted),
      surfaceDark: textValue(body.surfaceDark, merged.colors.surfaceDark),
      surfaceMutedDark: textValue(body.surfaceMutedDark, merged.colors.surfaceMutedDark),
      text: textValue(body.text, merged.colors.text),
      textMuted: textValue(body.textMuted, merged.colors.textMuted),
      textDark: textValue(body.textDark, merged.colors.textDark),
      textMutedDark: textValue(body.textMutedDark, merged.colors.textMutedDark),
      accent: textValue(body.accent, merged.colors.accent),
      border: textValue(body.border, merged.colors.border),
      borderDark: textValue(body.borderDark, merged.colors.borderDark),
      buttonPrimary: textValue(body.buttonPrimary, merged.colors.buttonPrimary),
      buttonSecondary: textValue(body.buttonSecondary, merged.colors.buttonSecondary),
      warning: textValue(body.warning, merged.colors.warning),
      danger: textValue(body.danger, merged.colors.danger),
      success: textValue(body.success, merged.colors.success)
    },
    shape: {
      globalRadius: numberValue(body.globalRadius, merged.shape.globalRadius, 0, 40),
      cardRadius: numberValue(body.cardRadius, merged.shape.cardRadius, 0, 48),
      buttonRadius: numberValue(body.buttonRadius, merged.shape.buttonRadius, 0, 999),
      inputRadius: numberValue(body.inputRadius, merged.shape.inputRadius, 0, 40),
      borderWidth: numberValue(body.borderWidth, merged.shape.borderWidth, 0, 4)
    },
    shadow: {
      strength: numberValue(body.shadowStrength, merged.shadow.strength, 0, 60),
      softness: numberValue(body.shadowSoftness, merged.shadow.softness, 0, 80)
    },
    spacing: {
      global: numberValue(body.globalSpacing, merged.spacing.global, 4, 32),
      page: numberValue(body.pageSpacing, merged.spacing.page, 0, 48),
      card: numberValue(body.cardSpacing, merged.spacing.card, 4, 36),
      form: numberValue(body.formSpacing, merged.spacing.form, 4, 32),
      tableRowHeight: numberValue(body.tableRowHeight, merged.spacing.tableRowHeight, 28, 72)
    },
    typography: {
      base: numberValue(body.fontSizeBase, merged.typography.base, 11, 20),
      heading: numberValue(body.fontSizeHeading, merged.typography.heading, 18, 42),
      label: numberValue(body.fontSizeLabel, merged.typography.label, 10, 18),
      button: numberValue(body.fontSizeButton, merged.typography.button, 11, 20),
      lineHeight: numberValue(body.lineHeightBase, merged.typography.lineHeight, 1.1, 1.9)
    }
  };
}

// Normalisiert zentrale Erstellerdaten inklusive Logo-Pfad-Erhaltung.
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

// Entfernt leere und doppelte Textwerte aus Formularlisten.
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

// Bearbeitbare Leistungsbereiche aus den Einstellungen. Bestehende Systemauswahl
// bleibt nur für weiterhin vorhandene Bereiche erhalten.
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

// Normalisiert die konfigurierbare Export-Ordnerstruktur.
function normalizePostedOrdnerstruktur(body = {}, current = {}) {
  const unterordner = uniqueTrimmed(String(body.unterordner || "").split(/\r?\n/));
  return {
    basisordner: String(body.basisordner || current.basisordner || "output/projekte/[projektnummer]_[projektname]").trim(),
    unterordner
  };
}

module.exports = {
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  THEME_PRESETS,
  mergeSystemSettings,
  mergeThemeSettings,
  normalizePostedErstellerStammdaten,
  normalizePostedLeistungsbereiche,
  normalizePostedOrdnerstruktur,
  normalizePostedSystemSettings,
  normalizePostedThemeSettings
};
