const path = require("path");

// * INFO: Wandelt Umlaute und Akzente in dateisystemfreundliche Schreibweisen um.
function normalizeGerman(value) {
  return String(value || "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

// * INFO: Erzeugt sichere Dateinamen für Uploads, PDFs und Exportdateien.
function sanitizeFileName(value, fallback = "datei") {
  const cleaned = normalizeGerman(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);
  return cleaned || fallback;
}

// * INFO: Erzeugt kurze technische IDs für Projekte, Benutzer und ähnliche Schlüssel.
function sanitizeId(value, fallback = "projekt") {
  const cleaned = normalizeGerman(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

// ! WICHTIG: Sicherheitsprüfung gegen Path Traversal: Zielpfade müssen im Basisordner bleiben.
function ensureInsideBase(basePath, targetPath) {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedBase, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Pfad liegt ausserhalb des erlaubten Basisordners: ${targetPath}`);
  }

  return resolvedTarget;
}

// ! WICHTIG: Kombiniert Pfade nur dann, wenn keine unsicheren Bestandteile enthalten sind.
function safeJoin(basePath, ...segments) {
  const unsafeSegment = segments.find((segment) => String(segment || "").includes(".."));
  if (unsafeSegment) {
    throw new Error(`Unsicherer Pfadbestandteil: ${unsafeSegment}`);
  }

  return ensureInsideBase(basePath, path.join(basePath, ...segments));
}

module.exports = {
  ensureInsideBase,
  safeJoin,
  sanitizeFileName,
  sanitizeId
};
