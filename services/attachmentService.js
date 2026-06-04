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

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && entry.id && entry.relativePath)
    .map((entry) => ({
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
      export: entry.export === undefined ? true : Boolean(entry.export),
      sortierung: Number.isFinite(entry.sortierung) ? entry.sortierung : null,
      uploadedAt: String(entry.uploadedAt || "")
    }));
}

function imageAttachments(raw) {
  return normalizeAttachments(raw).filter((entry) => entry.mimeType.startsWith("image/"));
}

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
      file = {
        fieldName: name,
        originalName,
        mimeType: headers["content-type"] || "application/octet-stream",
        buffer: content
      };
    } else {
      fields[name] = content.toString("utf8");
    }
  }

  return { fields, file };
}

function projectRootFromFiles(files) {
  return path.dirname(files.dataDir);
}

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
  const fileName = `${baseName}_${id}${extension || ".dat"}`;
  const targetPath = path.join(attachmentDir, fileName);
  await fs.writeFile(targetPath, upload.file.buffer);

  const relativePath = path.relative(rootDir, targetPath).split(path.sep).join("/");
  const category = String(upload.fields.category || "Allgemein").trim() || "Allgemein";
  const title = String(upload.fields.title || path.basename(originalName, extension) || originalName).trim() || originalName;
  const kapitel = String(upload.fields.kapitel || "").trim();
  const stockwerk = String(upload.fields.stockwerk || "").trim();

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
      export: upload.fields.export === undefined ? true : upload.fields.export === "on",
      uploadedAt: new Date().toISOString()
    }
  ];
}

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

function clearAttachmentReferencesFromBrandschutz(brandschutz, relativePath) {
  return (Array.isArray(brandschutz) ? brandschutz : []).map((entry) => ({
    ...entry,
    foto_vorher: entry.foto_vorher === relativePath ? "" : entry.foto_vorher,
    foto_nachher: entry.foto_nachher === relativePath ? "" : entry.foto_nachher
  }));
}

function assignAttachmentToBrandschutz(brandschutz, relativePath, brandschutzId, slot) {
  if (!["foto_vorher", "foto_nachher"].includes(slot)) {
    throw new Error("Ungueltige Foto-Zuordnung.");
  }

  let found = false;
  const nextBrandschutz = (Array.isArray(brandschutz) ? brandschutz : []).map((entry) => {
    if (entry.id !== brandschutzId) return entry;
    found = true;
    return {
      ...entry,
      [slot]: relativePath
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
  saveAttachment
};
