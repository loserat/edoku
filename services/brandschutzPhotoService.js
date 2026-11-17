const fs = require("fs/promises");
const { constants } = require("fs");
const { normalizeBrandschutz } = require("./brandschutzService");
const { resolveProjectSource } = require("./projectService");

function brandschutzPhotosRelevant(matrix = [], leistungsbereiche = {}) {
  return (leistungsbereiche.aktiv || []).includes("Brandschutzabschottungen")
    || matrix.some(entry => String(entry.originalKapitel || entry.kapitel) === "13.5" && entry.aktiv && entry.export);
}

// Nur vorhandene Verweise prüfen. Leere optionale Fotofelder sind keine fehlenden Dateien.
async function inspectBrandschutzPhotos(rootDir, projekt, brandschutz = []) {
  const warnings = [];
  for (const entry of normalizeBrandschutz(brandschutz).filter(entry => entry.aktiv)) {
    for (const [field, label] of [["foto_vorher", "Foto 1"], ["foto_nachher", "Foto 2"]]) {
      const relativePath = String(entry[field] || "").trim();
      if (!relativePath) continue;
      try {
        const file = await resolveProjectSource(rootDir, projekt, relativePath);
        await fs.access(file, constants.R_OK);
      } catch (error) {
        const missing = ["ENOENT", "ENOTDIR"].includes(error.code);
        if (!missing && !["EACCES", "EPERM"].includes(error.code) && error.status !== 403) throw error;
        const location = [entry.geschoss, entry.raum].filter(Boolean).join(" / ");
        warnings.push({ id: entry.id, field, label, location, relativePath,
          code: missing ? "photo_missing" : "photo_unavailable",
          message: `${entry.id}${location ? ` (${location})` : ""}: ${label} ${missing ? "fehlt" : "ist nicht zugreifbar"}.`
        });
      }
    }
  }
  return warnings;
}

function photoWarningsFromEntries(entries = []) {
  const warnings = entries.find(entry => entry.isToc)?.photoWarnings;
  return Array.isArray(warnings) ? warnings : [];
}

module.exports = { brandschutzPhotosRelevant, inspectBrandschutzPhotos, photoWarningsFromEntries };
