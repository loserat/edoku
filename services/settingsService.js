const DEFAULT_THEME_SHAPE = { globalRadius: 14, cardRadius: 22, buttonRadius: 999, inputRadius: 14, borderWidth: 1 };
const DEFAULT_THEME_SPACING = { global: 12, page: 16, card: 14, form: 10, tableRowHeight: 42 };
const DEFAULT_THEME_TYPOGRAPHY = { base: 14, heading: 24, label: 12, button: 13, lineHeight: 1.42 };

const THEME_PRESETS = {
  "apple-light": {
    name: "Apple Light",
    mode: "light",
    colors: {
      bgLight: "#f6f8fb",
      bgDark: "#111827",
      surface: "#ffffff",
      surfaceMuted: "#edf3f9",
      surfaceDark: "#1f2937",
      surfaceMutedDark: "#273244",
      text: "#172033",
      textMuted: "#66738a",
      textDark: "#f9fafb",
      textMutedDark: "#a7b1c2",
      accent: "#1473e6",
      border: "#b8c6d8",
      borderDark: "#56677f",
      buttonPrimary: "#1473e6",
      buttonSecondary: "#eef4fb",
      warning: "#a65a00",
      danger: "#dc2626",
      success: "#0f7a35"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 14, softness: 34 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "apple-dark": {
    name: "Apple Dark",
    mode: "dark",
    colors: {
      bgLight: "#f5f7fb",
      bgDark: "#0f1725",
      surface: "#ffffff",
      surfaceMuted: "#edf3f9",
      surfaceDark: "#1f2937",
      surfaceMutedDark: "#273244",
      text: "#172033",
      textMuted: "#66738a",
      textDark: "#f9fafb",
      textMutedDark: "#a7b1c2",
      accent: "#64a8ff",
      border: "#b8c6d8",
      borderDark: "#56677f",
      buttonPrimary: "#64a8ff",
      buttonSecondary: "#243246",
      warning: "#fbbf24",
      danger: "#f87171",
      success: "#4ade80"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 22, softness: 42 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  graphite: {
    name: "Graphite",
    mode: "dark",
    colors: {
      bgLight: "#edf0f3",
      bgDark: "#15191f",
      surface: "#f7f8fa",
      surfaceMuted: "#e8edf2",
      surfaceDark: "#242a32",
      surfaceMutedDark: "#313944",
      text: "#18202a",
      textMuted: "#687485",
      textDark: "#f4f7fb",
      textMutedDark: "#aeb7c3",
      accent: "#8ea2b8",
      border: "#aeb8c4",
      borderDark: "#66717f",
      buttonPrimary: "#8ea2b8",
      buttonSecondary: "#303844",
      warning: "#eab308",
      danger: "#ff6b6b",
      success: "#22c55e"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 18, softness: 34 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "blue-steel": {
    name: "Blue Steel",
    mode: "dark",
    colors: {
      bgLight: "#eef5fb",
      bgDark: "#0d1b2a",
      surface: "#f8fbff",
      surfaceMuted: "#e6f0fa",
      surfaceDark: "#182638",
      surfaceMutedDark: "#1f3248",
      text: "#142033",
      textMuted: "#61738a",
      textDark: "#eef6ff",
      textMutedDark: "#9fb3c8",
      accent: "#4ea5ff",
      border: "#a9bfd7",
      borderDark: "#53708f",
      buttonPrimary: "#4ea5ff",
      buttonSecondary: "#20364f",
      warning: "#f59e0b",
      danger: "#fb7185",
      success: "#34d399"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 20, softness: 40 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "github-light": {
    name: "GitHub Light",
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
      buttonPrimary: "#238636",
      buttonSecondary: "#21262d",
      warning: "#d29922",
      danger: "#f85149",
      success: "#3fb950"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 16, softness: 34 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "github-dimmed": {
    name: "GitHub Dimmed",
    mode: "dark",
    colors: {
      bgLight: "#f6f8fa",
      bgDark: "#22272e",
      surface: "#ffffff",
      surfaceMuted: "#f6f8fa",
      surfaceDark: "#2d333b",
      surfaceMutedDark: "#373e47",
      text: "#1f2328",
      textMuted: "#656d76",
      textDark: "#adbac7",
      textMutedDark: "#768390",
      accent: "#539bf5",
      border: "#d0d7de",
      borderDark: "#444c56",
      buttonPrimary: "#347d39",
      buttonSecondary: "#373e47",
      warning: "#c69026",
      danger: "#e5534b",
      success: "#57ab5a"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 16, softness: 34 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "high-contrast": {
    name: "High Contrast",
    mode: "dark",
    colors: {
      bgLight: "#ffffff",
      bgDark: "#050505",
      surface: "#ffffff",
      surfaceMuted: "#eeeeee",
      surfaceDark: "#111111",
      surfaceMutedDark: "#1f1f1f",
      text: "#050505",
      textMuted: "#3f3f46",
      textDark: "#ffffff",
      textMutedDark: "#d4d4d4",
      accent: "#00a3ff",
      border: "#111111",
      borderDark: "#ffffff",
      buttonPrimary: "#00a3ff",
      buttonSecondary: "#2a2a2a",
      warning: "#ffd400",
      danger: "#ff4d4d",
      success: "#00d084"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 0, softness: 0 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "sage-copper": {
    name: "Sage Copper",
    mode: "light",
    colors: {
      bgLight: "#f4f7f2",
      bgDark: "#101a17",
      surface: "#ffffff",
      surfaceMuted: "#e9f0e6",
      surfaceDark: "#1a2722",
      surfaceMutedDark: "#23332d",
      text: "#17231f",
      textMuted: "#66746c",
      textDark: "#f4fbf7",
      textMutedDark: "#aab8af",
      accent: "#237a59",
      border: "#b9c9bf",
      borderDark: "#4f665b",
      buttonPrimary: "#2f8f6b",
      buttonSecondary: "#edf4ee",
      warning: "#9b5618",
      danger: "#b91c1c",
      success: "#157347"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 12, softness: 32 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "warm-graphite": {
    name: "Warm Graphite",
    mode: "dark",
    colors: {
      bgLight: "#f5f2ed",
      bgDark: "#171614",
      surface: "#fffaf2",
      surfaceMuted: "#eee8de",
      surfaceDark: "#272521",
      surfaceMutedDark: "#332f29",
      text: "#211d18",
      textMuted: "#756d62",
      textDark: "#fbf7ef",
      textMutedDark: "#beb5a8",
      accent: "#d28b35",
      border: "#cbbfad",
      borderDark: "#6c6255",
      buttonPrimary: "#d28b35",
      buttonSecondary: "#352f28",
      warning: "#f5b041",
      danger: "#ef6f6c",
      success: "#62c184"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 18, softness: 36 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "nordic-light": {
    name: "Nordic Light",
    mode: "light",
    colors: {
      bgLight: "#f3f7fb",
      bgDark: "#0f1b24",
      surface: "#ffffff",
      surfaceMuted: "#e7eff6",
      surfaceDark: "#192733",
      surfaceMutedDark: "#223542",
      text: "#13202c",
      textMuted: "#637487",
      textDark: "#f3f8fc",
      textMutedDark: "#a6b6c7",
      accent: "#2b7bbb",
      border: "#b4c8da",
      borderDark: "#506b80",
      buttonPrimary: "#2b7bbb",
      buttonSecondary: "#eaf2f8",
      warning: "#985c12",
      danger: "#b42335",
      success: "#1e7657"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 10, softness: 28 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  },
  "violet-amber": {
    name: "Violet Amber",
    mode: "dark",
    colors: {
      bgLight: "#f6f3fb",
      bgDark: "#161322",
      surface: "#fffaff",
      surfaceMuted: "#eee8f7",
      surfaceDark: "#242033",
      surfaceMutedDark: "#302a43",
      text: "#20172f",
      textMuted: "#736783",
      textDark: "#faf7ff",
      textMutedDark: "#b8acc9",
      accent: "#a78bfa",
      border: "#c5b8df",
      borderDark: "#6e5d8c",
      buttonPrimary: "#8b5cf6",
      buttonSecondary: "#332b48",
      warning: "#f0a629",
      danger: "#ef5b7a",
      success: "#3fc38b"
    },
    shape: DEFAULT_THEME_SHAPE,
    shadow: { strength: 20, softness: 46 },
    spacing: DEFAULT_THEME_SPACING,
    typography: DEFAULT_THEME_TYPOGRAPHY
  }
};

const DEFAULT_THEME_SETTINGS = THEME_PRESETS["apple-light"];

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
  const preset = THEME_PRESETS[theme.preset] || DEFAULT_THEME_SETTINGS;
  return {
    ...DEFAULT_THEME_SETTINGS,
    ...preset,
    ...(theme || {}),
    colors: {
      ...DEFAULT_THEME_SETTINGS.colors,
      ...(preset.colors || {}),
      ...((theme || {}).colors || {})
    },
    shape: {
      ...DEFAULT_THEME_SETTINGS.shape,
      ...(preset.shape || {}),
      ...((theme || {}).shape || {})
    },
    shadow: {
      ...DEFAULT_THEME_SETTINGS.shadow,
      ...(preset.shadow || {}),
      ...((theme || {}).shadow || {})
    },
    spacing: {
      ...DEFAULT_THEME_SETTINGS.spacing,
      ...(preset.spacing || {}),
      ...((theme || {}).spacing || {})
    },
    typography: {
      ...DEFAULT_THEME_SETTINGS.typography,
      ...(preset.typography || {}),
      ...((theme || {}).typography || {})
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
    preset: textValue(body.preset, merged.preset || "apple-light"),
    name: textValue(body.name, merged.name || "Eigenes Theme"),
    mode: ["light", "dark", "system"].includes(body.mode) ? body.mode : merged.mode,
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
