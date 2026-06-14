const fs = require("fs/promises");
const path = require("path");
const { ensureInsideBase } = require("./pathService");
const { getProjectPaths } = require("./projectService");

const PREVIEW_FOLDERS = [
  { key: "generated", label: "Generiert", pathKey: "generatedPath" },
  { key: "final", label: "Final", pathKey: "finalPath" },
  { key: "config", label: "Externe Ablage", pathKey: "configPath" }
];

const DOWNLOAD_EXTENSIONS = new Set([".pdf", ".zip", ".txt"]);

function formatFileKind(fileName, extension) {
  if (/gesamtdokumentation\.pdf$/i.test(fileName)) return "gesamt-pdf";
  if (extension === ".zip") return "zip";
  if (/export_reihenfolge\.txt$/i.test(fileName)) return "reihenfolge";
  return extension.replace(".", "") || "datei";
}

function sortFinalExportFiles(files) {
  const priority = {
    "gesamt-pdf": 1,
    zip: 2,
    reihenfolge: 3,
    pdf: 4,
    txt: 5
  };

  return files.sort((a, b) => {
    const first = priority[a.kind] || 99;
    const second = priority[b.kind] || 99;
    if (first !== second) return first - second;
    return a.relativePath.localeCompare(b.relativePath, "de", { numeric: true });
  });
}

// * INFO: Sucht PDF-Dateien rekursiv und liefert relative Pfade für die Browser-Vorschau.
async function listPdfFiles(baseDir, rootDir, sourceLabel) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listPdfFiles(fullPath, rootDir, sourceLabel));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const relativePath = path.relative(rootDir, fullPath).replaceAll(path.sep, "/");
        files.push({
          id: relativePath,
          name: entry.name,
          source: sourceLabel,
          relativePath,
          updatedAt: (await fs.stat(fullPath)).mtime.toISOString()
        });
      }
    }

    return files;
  } catch (error) {
    return [];
  }
}

// * INFO: Listet alle PDFs, die im Projekt für eine Vorschau freigegeben sind.
async function listPdfPreviewFiles(rootDir, projekt) {
  const paths = getProjectPaths(rootDir, projekt);
  const files = [];

  for (const folder of PREVIEW_FOLDERS) {
    files.push(...await listPdfFiles(paths[folder.pathKey], paths.projectPath, folder.label));
  }

  return files.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source, "de");
    return a.relativePath.localeCompare(b.relativePath, "de", { numeric: true });
  });
}

// * INFO: Listet finale Export-Artefakte, die bewusst zum Download freigegeben sind.
async function listFinalExportFiles(rootDir, projekt) {
  const paths = getProjectPaths(rootDir, projekt);

  try {
    const entries = await fs.readdir(paths.finalPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(paths.finalPath, entry.name);
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !DOWNLOAD_EXTENSIONS.has(extension)) continue;

      const stat = await fs.stat(fullPath);
      const relativePath = path.relative(paths.projectPath, fullPath).replaceAll(path.sep, "/");
      files.push({
        id: relativePath,
        name: entry.name,
        extension,
        kind: formatFileKind(entry.name, extension),
        relativePath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }

    return sortFinalExportFiles(files);
  } catch (error) {
    return [];
  }
}

// * INFO: Löst eine Vorschau-Datei sicher auf und begrenzt den Zugriff auf Projektordner.
async function resolvePdfPreviewFile(rootDir, projekt, relativePath) {
  if (!relativePath || String(relativePath).includes("..")) {
    throw new Error("Keine gueltige PDF-Datei angegeben.");
  }

  const paths = getProjectPaths(rootDir, projekt);
  const targetPath = ensureInsideBase(paths.projectPath, path.join(paths.projectPath, relativePath));
  const allowedFolders = [paths.generatedPath, paths.finalPath, paths.configPath];
  const isAllowed = allowedFolders.some((folder) => {
    const relative = path.relative(path.resolve(folder), targetPath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  });

  if (!isAllowed || path.extname(targetPath).toLowerCase() !== ".pdf") {
    throw new Error("Diese Datei ist nicht fuer die PDF-Vorschau freigegeben.");
  }

  await fs.access(targetPath);
  return targetPath;
}

// ! WICHTIG: Downloads bleiben auf den finalen Projektordner und erlaubte Dateitypen begrenzt.
async function resolveExportDownloadFile(rootDir, projekt, relativePath) {
  if (!relativePath || String(relativePath).includes("..")) {
    throw new Error("Keine gueltige Export-Datei angegeben.");
  }

  const paths = getProjectPaths(rootDir, projekt);
  const targetPath = ensureInsideBase(paths.projectPath, path.join(paths.projectPath, relativePath));
  const relativeToFinal = path.relative(path.resolve(paths.finalPath), targetPath);
  const isInsideFinal = !relativeToFinal.startsWith("..") && !path.isAbsolute(relativeToFinal);
  const extension = path.extname(targetPath).toLowerCase();

  if (!isInsideFinal || !DOWNLOAD_EXTENSIONS.has(extension)) {
    throw new Error("Diese Datei ist nicht fuer den Export-Download freigegeben.");
  }

  await fs.access(targetPath);
  return targetPath;
}

module.exports = {
  listPdfPreviewFiles,
  listFinalExportFiles,
  resolvePdfPreviewFile,
  resolveExportDownloadFile
};
