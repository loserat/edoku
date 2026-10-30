const path = require("path");
const fs = require("fs/promises");

function accessError(message = "Kein Zugriff auf diese Datei.") {
  return Object.assign(new Error(message), { status: 403 });
}

// Prüft auch die echten Dateisystemkomponenten: ein Symlink darf die Grenze nicht umgehen.
async function assertSafePath(basePath, targetPath, { allowMissing = false, type } = {}) {
  const target = ensureInsideBase(basePath, targetPath);
  const relative = path.relative(path.resolve(basePath), target);
  let cursor = path.resolve(basePath);
  const components = relative ? relative.split(path.sep) : [];
  for (const component of ["", ...components]) {
    if (component) cursor = path.join(cursor, component);
    let info;
    try { info = await fs.lstat(cursor); }
    catch (error) {
      if (allowMissing && error.code === "ENOENT") return target;
      throw error;
    }
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw accessError();
    if (cursor === target && ((type === "file" && !info.isFile()) || (type === "directory" && !info.isDirectory()))) throw accessError();
  }
  return target;
}

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
    throw accessError();
  }

  return resolvedTarget;
}

// ! WICHTIG: Kombiniert Pfade nur dann, wenn keine unsicheren Bestandteile enthalten sind.
function safeJoin(basePath, ...segments) {
  const unsafeSegment = segments.find((segment) => String(segment || "").includes(".."));
  if (unsafeSegment) {
    throw accessError();
  }

  return ensureInsideBase(basePath, path.join(basePath, ...segments));
}

module.exports = {
  accessError,
  assertSafePath,
  ensureInsideBase,
  safeJoin,
  sanitizeFileName,
  sanitizeId
};
