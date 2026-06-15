// * INFO: Kleine ID-Hilfe fuer Demo-Daten und spaetere API-Validierung.
function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  normalizeId
};
