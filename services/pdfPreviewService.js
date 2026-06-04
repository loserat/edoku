const fs = require("fs/promises");
const path = require("path");
const { ensureInsideBase } = require("./pathService");
const { getProjectPaths } = require("./projectService");

const PREVIEW_FOLDERS = [
  { key: "generated", label: "Generiert", pathKey: "generatedPath" },
  { key: "final", label: "Final", pathKey: "finalPath" },
  { key: "config", label: "Externe Ablage", pathKey: "configPath" }
];

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

module.exports = {
  listPdfPreviewFiles,
  resolvePdfPreviewFile
};
