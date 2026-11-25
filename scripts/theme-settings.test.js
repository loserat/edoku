const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ejs = require("ejs");
const { mergeThemeSettings, THEME_PRESETS } = require("../services/settingsService");

const previous = {
  preset: "github-light", name: "GitHub Light", mode: "light",
  colors: { bgLight: "#f6f8fa", bgDark: "#0d1117", surface: "#ffffff", surfaceMuted: "#f6f8fa", surfaceDark: "#161b22", surfaceMutedDark: "#21262d", text: "#1f2328", textMuted: "#656d76", textDark: "#e6edf3", textMutedDark: "#7d8590", accent: "#0969da", border: "#d0d7de", borderDark: "#30363d", buttonPrimary: "#1f883d", buttonSecondary: "#f6f8fa", warning: "#9a6700", danger: "#cf222e", success: "#1f883d" },
  shape: { globalRadius: 14, cardRadius: 22, buttonRadius: 999, inputRadius: 14, borderWidth: 1 },
  shadow: { strength: 10, softness: 26 },
  spacing: { global: 12, page: 16, card: 14, form: 10, tableRowHeight: 42 },
  typography: { base: 14, heading: 24, label: 12, button: 13, lineHeight: 1.42 }
};

test("Bisheriger Standard erhält die neue Darstellung ohne gespeicherte Werte zu verändern", () => {
  const input = structuredClone(previous), before = JSON.stringify(input);
  const result = mergeThemeSettings(input);
  assert.equal(result.colors.buttonPrimary, "#315fc5");
  assert.equal(result.shape.cardRadius, 12);
  assert.equal(result.name, "edoku Hell");
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(mergeThemeSettings(result), result);
  assert.equal(mergeThemeSettings({ preset: "github-dark" }).mode, "dark");
});

test("Eigene Farben, Radien und Namen bleiben erhalten", () => {
  const input = structuredClone(previous);
  input.name = "Firmenfarben";
  input.colors.accent = "#713ea8";
  input.colors.buttonPrimary = "#e0c350";
  input.shape.cardRadius = 3;
  const before = JSON.stringify(input), result = mergeThemeSettings(input);
  assert.deepEqual(result.colors, input.colors);
  assert.deepEqual(result.shape, input.shape);
  assert.equal(result.name, input.name);
  assert.equal(result.spacing.card, 20);
  assert.equal(JSON.stringify(input), before);
});

test("Kontrast- und Farbenblind-Vorlagen behalten ihre gewählten Paletten", () => {
  for (const key of ["github-light-high-contrast", "github-dark-high-contrast", "github-light-colorblind", "github-dark-colorblind"]) {
    const input = structuredClone(THEME_PRESETS[key]);
    assert.deepEqual(mergeThemeSettings(input).colors, input.colors);
  }
  assert.equal(mergeThemeSettings({ preset: "github-dark-high-contrast" }).colors.textMutedDark, "#c9d1d9");
});

function luminance(hex) {
  const rgb = hex.match(/[a-f0-9]{2}/ig).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test("Schaltflächen bleiben bei Standard- und eigenen Farben auch beim Überfahren lesbar", () => {
  const template = fs.readFileSync(path.join(__dirname, "../views/partials/themeVariables.ejs"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "../public/js/app.js"), "utf8").split("const savedTheme")[0];
  const context = vm.createContext({}); vm.runInContext(client, context);
  for (const color of ["#315fc5", "#e0c350", "#8a8a8a", "#ffffff", "#010409", "#0349b4", "#238636", "#58a6ff"]) {
    const theme = mergeThemeSettings({ colors: { buttonPrimary: color, danger: color } });
    const html = ejs.render(template, { cspNonce: "synthetic-theme-nonce", systemSettings: { theme } });
    const tokens = Object.fromEntries([...html.matchAll(/(--[a-z-]+):\s*(#[a-f0-9]{6})/ig)].map(m => [m[1], m[2]]));
    assert.ok(contrast(color, tokens["--on-primary"]) >= 4.5, color);
    assert.ok(contrast(tokens["--color-primary-hover"], tokens["--on-primary-hover"]) >= 4.5, color + " hover");
    assert.ok(contrast(color, tokens["--on-danger"]) >= 4.5, color + " danger");
    assert.equal(context.themeContrastInk(color), tokens["--on-primary"]);
    assert.equal(context.themeButtonHover(color), tokens["--color-primary-hover"]);
  }
  const colors = THEME_PRESETS["github-light"].colors;
  for (const [ink, background] of [["text", "surface"], ["textMuted", "bgLight"], ["textDark", "surfaceDark"], ["textMutedDark", "bgDark"]]) assert.ok(contrast(colors[ink], colors[background]) >= 4.5);
});
