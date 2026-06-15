const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { sanitizeFileName } = require("./pathService");

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

// * INFO: Vereinheitlicht gespeicherte Anhangsdaten aus JSON. Fehlende Felder bekommen
// * INFO: stabile Defaults, damit alte Projektstände weiter angezeigt werden können.
function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && entry.id && entry.relativePath)
    .map((entry) => {
      const sortierung = Number.parseFloat(entry.sortierung);
      return {
        id: String(entry.id),
        originalName: String(entry.originalName || entry.fileName || "Anhang"),
        fileName: String(entry.fileName || entry.originalName || "anhang"),
        relativePath: String(entry.relativePath),
        mimeType: String(entry.mimeType || "application/octet-stream"),
        size: Number(entry.size || 0),
        category: String(entry.category || "Allgemein"),
        title: String(entry.title || entry.originalName || entry.fileName || "Anhang"),
        kapitel: String(entry.kapitel || ""),
        stockwerk: String(entry.stockwerk || ""),
        anlage: String(entry.anlage || ""),
        verteiler: String(entry.verteiler || ""),
        plannummer: String(entry.plannummer || ""),
        revision: String(entry.revision || ""),
        bereich: String(entry.bereich || ""),
        messart: String(entry.messart || ""),
        normgrundlage: String(entry.normgrundlage || ""),
        datum: String(entry.datum || ""),
        export: entry.export === undefined ? true : Boolean(entry.export),
        sortierung: Number.isFinite(sortierung) ? sortierung : null,
        uploadedAt: String(entry.uploadedAt || "")
      };
    });
}

// * INFO: Filter für Anhänge, die als Bilder einer Brandschottung zugeordnet werden können.
function imageAttachments(raw) {
  return normalizeAttachments(raw).filter((entry) => entry.mimeType.startsWith("image/"));
}

// * INFO: Trennt einen Buffer anhand eines Multipart-Boundary.
function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

// * INFO: Wandelt den Headerblock eines Multipart-Teils in ein kleines Header-Objekt um.
function parseHeaderBlock(value) {
  return String(value || "")
    .split(/\r?\n/)
    .reduce((headers, line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return headers;
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
      return headers;
    }, {});
}

// * INFO: Minimaler Multipart-Parser für Uploads ohne zusätzliche Upload-Bibliothek.
// * INFO: Gibt Formularfelder und genau eine Datei zurück.
async function parseMultipartUpload(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) throw new Error("Upload-Formular ist ungueltig.");

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) throw new Error("Datei ist zu gross. Maximal erlaubt sind 15 MB.");
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks);
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const parts = splitBuffer(body, boundary);
  const fields = {};
  let file = null;
  const files = [];

  for (const part of parts) {
    let payload = part;
    if (payload.subarray(0, 2).toString() === "\r\n") payload = payload.subarray(2);
    if (payload.subarray(0, 2).toString() === "--") continue;
    const headerEnd = payload.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headers = parseHeaderBlock(payload.subarray(0, headerEnd).toString("utf8"));
    let content = payload.subarray(headerEnd + 4);
    if (content.subarray(content.length - 2).toString() === "\r\n") {
      content = content.subarray(0, content.length - 2);
    }

    const disposition = headers["content-disposition"] || "";
    const name = (disposition.match(/name="([^"]+)"/) || [])[1];
    const originalName = (disposition.match(/filename="([^"]*)"/) || [])[1];
    if (!name) continue;

    if (originalName !== undefined) {
      if (!originalName) continue;
      file = {
        fieldName: name,
        originalName,
        mimeType: headers["content-type"] || "application/octet-stream",
        buffer: content
      };
      files.push(file);
    } else {
      fields[name] = content.toString("utf8");
    }
  }

  return { fields, file, files };
}

// * INFO: Ermittelt den Projektwurzelordner aus dem data-Verzeichnis des aktuellen Projekts.
function projectRootFromFiles(files) {
  return path.dirname(files.dataDir);
}

// * INFO: Lesbarer Kategoriename als Bestandteil logisch erzeugter Dateinamen.
function logicalCategoryName(category) {
  const names = {
    "Stromlaufpläne": "Stromlaufplan",
    "Schaltpläne": "Schaltplan",
    "Installationspläne": "Installationsplan",
    "Schemata": "Schema",
    "Messprotokolle": "Messprotokoll",
    "Bedienungsanleitungen": "Bedienungsanleitung",
    "Brandschutz": "Brandschutz",
    "Fotos": "Foto",
    "Pläne": "Plan",
    "Nachweise": "Nachweis",
    "Allgemein": "Anhang"
  };
  return names[category] || category || "Anhang";
}

// * INFO: Erzeugt nachvollziehbare Dateinamen aus Kategorie, Stockwerk und Metadaten.
// * INFO: Die ID bleibt enthalten, damit gleich benannte Uploads sich nicht überschreiben.
function logicalAttachmentFileName(fields, originalBaseName, extension, id) {
  const category = String(fields.category || "Allgemein").trim() || "Allgemein";
  const title = String(fields.title || originalBaseName || "Anhang").trim();
  const partsByCategory = {
    "Stromlaufpläne": [logicalCategoryName(category), fields.stockwerk, fields.verteiler, fields.plannummer, fields.revision ? `Rev_${fields.revision}` : "", title],
    "Schaltpläne": [logicalCategoryName(category), fields.stockwerk, fields.anlage, fields.verteiler, fields.plannummer, fields.revision ? `Rev_${fields.revision}` : "", title],
    "Installationspläne": [logicalCategoryName(category), fields.stockwerk, fields.bereich, fields.plannummer, fields.revision ? `Rev_${fields.revision}` : "", title],
    "Schemata": [logicalCategoryName(category), fields.stockwerk, fields.anlage, fields.plannummer, fields.revision ? `Rev_${fields.revision}` : "", title],
    "Messprotokolle": [logicalCategoryName(category), fields.stockwerk, fields.messart, fields.normgrundlage, fields.anlage || fields.bereich, fields.datum, title],
    "Bedienungsanleitungen": [logicalCategoryName(category), fields.anlage || fields.bereich, title],
    "Brandschutz": [logicalCategoryName(category), fields.stockwerk, title],
    "Fotos": [logicalCategoryName(category), fields.stockwerk, title]
  };
  const parts = partsByCategory[category] || [logicalCategoryName(category), fields.stockwerk, title];
  const base = sanitizeFileName(parts.filter(Boolean).join("_"), "anhang").slice(0, 112);
  const safeId = sanitizeFileName(id, "anhang_id");
  return `${base}_${safeId}${extension || ".dat"}`;
}

// * INFO: Speichert einen neuen Upload im Projektordner und ergänzt den JSON-Eintrag.
async function saveAttachment(rootDir, files, existingRaw, upload) {
  if (!upload.file || !upload.file.originalName || !upload.file.buffer.length) {
    throw new Error("Bitte eine Datei auswaehlen.");
  }
  if (!ALLOWED_MIME_TYPES.has(upload.file.mimeType)) {
    throw new Error("Dateityp ist nicht erlaubt. Erlaubt sind Bilder und PDF-Dateien.");
  }

  const attachments = normalizeAttachments(existingRaw);
  const projectRoot = projectRootFromFiles(files);
  const attachmentDir = path.join(projectRoot, "anhaenge");
  await fs.mkdir(attachmentDir, { recursive: true });

  const originalName = sanitizeFileName(upload.file.originalName, "anhang");
  const extension = path.extname(originalName).toLowerCase();
  const baseName = sanitizeFileName(path.basename(originalName, extension), "anhang");
  const id = `anh_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const category = String(upload.fields.category || "Allgemein").trim() || "Allgemein";
  const title = String(upload.fields.title || path.basename(originalName, extension) || originalName).trim() || originalName;
  const kapitel = String(upload.fields.kapitel || "").trim();
  const stockwerk = String(upload.fields.stockwerk || "").trim();
  const sortierung = Number.parseFloat(upload.fields.sortierung);
  const fields = {
    ...upload.fields,
    category,
    title,
    kapitel,
    stockwerk
  };
  const fileName = logicalAttachmentFileName(fields, baseName, extension, id);
  const targetPath = path.join(attachmentDir, fileName);
  await fs.writeFile(targetPath, upload.file.buffer);

  const relativePath = path.relative(rootDir, targetPath).split(path.sep).join("/");

  return [
    ...attachments,
    {
      id,
      originalName,
      fileName,
      relativePath,
      mimeType: upload.file.mimeType,
      size: upload.file.buffer.length,
      category,
      title,
      kapitel,
      stockwerk,
      anlage: String(upload.fields.anlage || "").trim(),
      verteiler: String(upload.fields.verteiler || "").trim(),
      plannummer: String(upload.fields.plannummer || "").trim(),
      revision: String(upload.fields.revision || "").trim(),
      bereich: String(upload.fields.bereich || "").trim(),
      messart: String(upload.fields.messart || "").trim(),
      normgrundlage: String(upload.fields.normgrundlage || "").trim(),
      datum: String(upload.fields.datum || "").trim(),
      export: upload.fields.export === undefined ? true : upload.fields.export === "on",
      sortierung: Number.isFinite(sortierung) ? sortierung : null,
      uploadedAt: new Date().toISOString()
    }
  ];
}

// ! WICHTIG: Benennt eine vorhandene Datei nach geänderten Metadaten um.
// ? WARUM: Alte/neue Pfade werden zurückgegeben, damit Brandschutz-Verweise mitgezogen werden können.
async function syncAttachmentFileName(rootDir, files, attachmentsRaw, attachmentId) {
  const attachments = normalizeAttachments(attachmentsRaw);
  const projectRoot = projectRootFromFiles(files);
  const attachmentDir = path.join(projectRoot, "anhaenge");
  const target = attachments.find((entry) => entry.id === attachmentId);
  if (!target) return { attachments, renamed: null };

  const extension = path.extname(target.fileName || target.originalName || target.relativePath).toLowerCase() || ".dat";
  const originalBaseName = sanitizeFileName(path.basename(target.originalName || target.fileName || "anhang", extension), "anhang");
  const nextFileName = logicalAttachmentFileName(target, originalBaseName, extension, target.id);
  if (nextFileName === target.fileName) return { attachments, renamed: null };

  const oldPath = path.join(rootDir, target.relativePath);
  const nextPath = path.join(attachmentDir, nextFileName);
  const nextRelativePath = path.relative(rootDir, nextPath).split(path.sep).join("/");

  try {
    await fs.mkdir(attachmentDir, { recursive: true });
    await fs.rename(oldPath, nextPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return {
    attachments: attachments.map((entry) => entry.id === attachmentId
      ? {
        ...entry,
        originalName: nextFileName,
        fileName: nextFileName,
        relativePath: nextRelativePath
      }
      : entry),
    renamed: {
      oldRelativePath: target.relativePath,
      newRelativePath: nextRelativePath
    }
  };
}

// ! WICHTIG: Entfernt Datei und JSON-Eintrag eines Anhangs. Fehlende Dateien werden toleriert.
async function deleteAttachment(rootDir, attachmentsRaw, attachmentId) {
  const attachments = normalizeAttachments(attachmentsRaw);
  const target = attachments.find((entry) => entry.id === attachmentId);
  if (!target) return attachments;

  const filePath = path.join(rootDir, target.relativePath);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return attachments.filter((entry) => entry.id !== attachmentId);
}

// * INFO: Löscht Bildverweise aus Brandschottungen, wenn der zugehörige Anhang entfernt wurde.
function clearAttachmentReferencesFromBrandschutz(brandschutz, relativePath) {
  return (Array.isArray(brandschutz) ? brandschutz : []).map((entry) => ({
    ...entry,
    foto_vorher: entry.foto_vorher === relativePath ? "" : entry.foto_vorher,
    foto_nachher: entry.foto_nachher === relativePath ? "" : entry.foto_nachher
  }));
}

// ! WICHTIG: Ordnet ein Bild einer Brandschottung als Foto 1 oder Foto 2 zu.
// ? WARUM: Vorhandene Belegung im selben Slot wird ersetzt, damit je Schottung nur ein Foto 1 und ein Foto 2 existieren.
function assignAttachmentToBrandschutz(brandschutz, relativePath, brandschutzId, slot) {
  if (!["foto_vorher", "foto_nachher"].includes(slot)) {
    throw new Error("Ungueltige Foto-Zuordnung.");
  }

  let found = false;
  const nextBrandschutz = (Array.isArray(brandschutz) ? brandschutz : []).map((entry) => {
    if (entry.id !== brandschutzId) {
      return {
        ...entry,
        foto_vorher: entry.foto_vorher === relativePath ? "" : entry.foto_vorher,
        foto_nachher: entry.foto_nachher === relativePath ? "" : entry.foto_nachher
      };
    }
    found = true;
    if (entry[slot] && entry[slot] !== relativePath) {
      throw new Error("Der gewaehlte Foto-Slot ist bereits belegt.");
    }
    return {
      ...entry,
      foto_vorher: slot === "foto_vorher" ? relativePath : entry.foto_vorher === relativePath ? "" : entry.foto_vorher,
      foto_nachher: slot === "foto_nachher" ? relativePath : entry.foto_nachher === relativePath ? "" : entry.foto_nachher
    };
  });

  if (!found) throw new Error("Brandschottung wurde nicht gefunden.");
  return nextBrandschutz;
}

module.exports = {
  assignAttachmentToBrandschutz,
  clearAttachmentReferencesFromBrandschutz,
  deleteAttachment,
  imageAttachments,
  normalizeAttachments,
  parseMultipartUpload,
  saveAttachment,
  syncAttachmentFileName
};
