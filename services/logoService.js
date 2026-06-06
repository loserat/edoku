const fs = require("fs/promises");
const path = require("path");
const { ensureInsideBase, sanitizeFileName } = require("./pathService");

const ALLOWED_LOGO_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp"
};

// Multipart-Auswertung für Logo-Uploads ohne zusätzliche Upload-Middleware.
function parseMultipart(buffer, contentType) {
  const boundaryMatch = String(contentType || "").match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    throw new Error("Upload konnte nicht gelesen werden.");
  }

  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor !== -1) {
    const partStart = cursor + boundary.length;
    const next = buffer.indexOf(boundary, partStart);
    if (next === -1) break;

    const raw = buffer.subarray(partStart, next);
    const headerEnd = raw.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const headers = raw.subarray(0, headerEnd).toString("utf8");
      let body = raw.subarray(headerEnd + 4);
      if (body.subarray(0, 2).toString() === "\r\n") body = body.subarray(2);
      if (body.subarray(-2).toString() === "\r\n") body = body.subarray(0, -2);
      parts.push({ headers, body });
    }

    cursor = next;
  }

  return parts;
}

// Extrahiert den Formularteil "logo" und prüft den erlaubten Bildtyp.
function logoPartFromUpload(buffer, contentType) {
  const part = parseMultipart(buffer, contentType).find((entry) => entry.headers.includes('name="logo"'));
  if (!part || !part.body.length) {
    throw new Error("Bitte eine Logo-Datei auswählen.");
  }

  const nameMatch = part.headers.match(/filename="([^"]*)"/);
  const typeMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
  const originalName = nameMatch ? nameMatch[1] : "logo";
  const mimeType = typeMatch ? typeMatch[1].trim().toLowerCase() : "";
  const extension = ALLOWED_LOGO_TYPES[mimeType] || path.extname(originalName).toLowerCase();

  if (!Object.values(ALLOWED_LOGO_TYPES).includes(extension)) {
    throw new Error("Erlaubt sind PNG, JPG und WEBP.");
  }

  return {
    buffer: part.body,
    originalName,
    extension
  };
}

// Speichert ein projektbezogenes Logo im Projektordner.
async function saveProjectLogo(projectRoot, uploadBuffer, contentType) {
  const upload = logoPartFromUpload(uploadBuffer, contentType);
  const assetsDir = ensureInsideBase(projectRoot, path.join(projectRoot, "assets"));
  await fs.mkdir(assetsDir, { recursive: true });

  const baseName = sanitizeFileName(path.basename(upload.originalName, path.extname(upload.originalName)), "logo");
  const fileName = `${baseName}${upload.extension}`;
  const targetPath = ensureInsideBase(assetsDir, path.join(assetsDir, fileName));
  await fs.writeFile(targetPath, upload.buffer);

  return path.relative(projectRoot, targetPath).replaceAll(path.sep, "/");
}

// Speichert das zentrale Erstellerlogo im Storage-Bereich.
async function saveCreatorLogo(storageDir, uploadBuffer, contentType) {
  const upload = logoPartFromUpload(uploadBuffer, contentType);
  const assetsDir = ensureInsideBase(storageDir, path.join(storageDir, "creator"));
  await fs.mkdir(assetsDir, { recursive: true });

  const baseName = sanitizeFileName(path.basename(upload.originalName, path.extname(upload.originalName)), "ersteller-logo");
  const fileName = `${baseName}${upload.extension}`;
  const targetPath = ensureInsideBase(assetsDir, path.join(assetsDir, fileName));
  await fs.writeFile(targetPath, upload.buffer);

  return path.relative(storageDir, targetPath).replaceAll(path.sep, "/");
}

// Löst den gespeicherten Erstellerlogo-Pfad sicher auf einen echten Dateipfad auf.
function resolveCreatorLogo(storageDir, logoPath) {
  if (!logoPath || String(logoPath).includes("..")) {
    throw new Error("Kein gültiger Erstellerlogo-Pfad hinterlegt.");
  }

  const target = ensureInsideBase(storageDir, path.join(storageDir, logoPath));
  const extension = path.extname(target).toLowerCase();
  if (!Object.values(ALLOWED_LOGO_TYPES).includes(extension)) {
    throw new Error("Logo-Dateityp ist nicht freigegeben.");
  }

  return target;
}

// Löst einen projektbezogenen Logo-Pfad sicher auf einen echten Dateipfad auf.
function resolveProjectLogo(projectRoot, logoPath) {
  if (!logoPath || String(logoPath).includes("..")) {
    throw new Error("Kein gültiger Logo-Pfad hinterlegt.");
  }

  const target = ensureInsideBase(projectRoot, path.join(projectRoot, logoPath));
  const extension = path.extname(target).toLowerCase();
  if (!Object.values(ALLOWED_LOGO_TYPES).includes(extension)) {
    throw new Error("Logo-Dateityp ist nicht freigegeben.");
  }

  return target;
}

module.exports = {
  resolveCreatorLogo,
  resolveProjectLogo,
  saveCreatorLogo,
  saveProjectLogo
};
