const fs = require("fs/promises");
const path = require("path");
const { chapterFolderForKapitel, createProjectFolder, getProjectPaths } = require("./projectService");
const { writeJson } = require("./jsonService");
const { applyLogicalChapterNumbers, sortDocuments } = require("./chapterNumberingService");
const { buildDocumentationAttachmentEntries } = require("./documentAttachmentService");

async function listPdfFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listPdfFiles(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        files.push(fullPath);
      }
    }
    return files;
  } catch (error) {
    return [];
  }
}

function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function matchByKapitel(files, kapitel) {
  const normalized = String(kapitel).replaceAll(".", "_");
  const padded = String(kapitel)
    .split(".")
    .map((part) => part.padStart(2, "0"))
    .join("_");
  const chapterTokens = [normalized, padded].filter(Boolean);
  return files.find((file) => {
    const name = path.basename(file);
    return chapterTokens.some((token) => {
      const nextChar = name.charAt(token.length);
      return name.startsWith(token) && (!nextChar || /[^0-9]/.test(nextChar));
    });
  });
}

function metadataForEntry(entry, projektSysteme) {
  const exact = (projektSysteme || []).find((selection) => selection.leistungsbereich === entry.leistungsbereich);
  const byKapitel = (projektSysteme || []).find((selection) => (selection.kapitel || []).includes(entry.originalKapitel || entry.kapitel));
  const selection = exact || byKapitel || {};
  return {
    leistungsbereich: selection.leistungsbereich || entry.leistungsbereich || "",
    hersteller: selection.hersteller || "",
    systemart: selection.systemart || "",
    dokumentarten: selection.dokumentarten || []
  };
}

async function buildExportliste(rootDir, projekt, matrix, exportlistePath, projektSysteme = [], anhaenge = []) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generated = await listPdfFiles(paths.generatedPath);
  const external = await listPdfFiles(paths.configPath);
  const activeDocs = sortDocuments(applyLogicalChapterNumbers(matrix, { exportOnly: true }).filter((entry) => entry.aktiv && entry.export));
  const usedFiles = new Set();

  const entries = activeDocs.map((entry, index) => {
    const generatedMatch = matchByKapitel(generated, entry.kapitel);
    const chapterFolder = chapterFolderForKapitel(entry.kapitel);
    const externalMatch = external.find((file) => file.includes(`${path.sep}${chapterFolder}${path.sep}`));
    const found = generatedMatch || externalMatch;
    if (found) usedFiles.add(found);

    return {
      reihenfolge: index + 1,
      kapitel: entry.displayKapitel || entry.kapitel,
      originalKapitel: entry.originalKapitel || entry.kapitel,
      titel: entry.titel,
      dateipfad: found ? relative(rootDir, found) : "",
      quelle: generatedMatch ? "intern" : externalMatch ? "extern" : "manuell",
      status: found ? "vorhanden" : "fehlt",
      pflicht: Boolean(entry.pflicht),
      ...metadataForEntry(entry, projektSysteme)
    };
  });

  buildDocumentationAttachmentEntries(matrix, anhaenge).forEach((entry) => {
    entries.push({
      reihenfolge: entries.length + 1,
      kapitel: entry.displayKapitel || entry.kapitel,
      originalKapitel: entry.originalKapitel || "",
      titel: entry.titel,
      dateipfad: entry.dateipfad,
      quelle: "import",
      status: entry.dateipfad ? "vorhanden" : "fehlt",
      pflicht: false,
      leistungsbereich: entry.leistungsbereich || "Dokumentation",
      hersteller: "",
      systemart: "",
      dokumentarten: [entry.dokumenttyp].filter(Boolean)
    });
  });

  [...generated, ...external].forEach((file) => {
    if (usedFiles.has(file)) return;
    entries.push({
      reihenfolge: entries.length + 1,
      kapitel: "",
      originalKapitel: "",
      titel: path.basename(file, ".pdf"),
      dateipfad: relative(rootDir, file),
      quelle: file.startsWith(paths.generatedPath) ? "intern" : "extern",
      status: "vorhanden",
      pflicht: false,
      leistungsbereich: "",
      hersteller: "",
      systemart: "",
      dokumentarten: []
    });
  });

  await writeJson(exportlistePath, entries);
  return entries;
}

async function prepareFinalExport(rootDir, projekt, matrix, exportlistePath) {
  const paths = getProjectPaths(rootDir, projekt);
  await fs.mkdir(paths.finalPath, { recursive: true });
  const content = await fs.readFile(exportlistePath, "utf8").catch(() => "[]");
  const exportliste = JSON.parse(content);
  const missingRequired = [];
  const lines = [];

  for (const entry of exportliste) {
    const sourceKapitel = entry.originalKapitel || entry.kapitel;
    const matrixEntry = matrix.find((doc) => doc.kapitel === sourceKapitel);
    lines.push(`${String(entry.reihenfolge).padStart(3, "0")} | ${entry.kapitel} | ${entry.titel} | ${entry.status} | ${entry.dateipfad || "-"}`);

    if (entry.status === "fehlt" && matrixEntry && matrixEntry.pflicht) {
      missingRequired.push(`${entry.kapitel} ${entry.titel}`);
    }

    if (entry.status === "vorhanden" && entry.dateipfad) {
      const source = path.join(rootDir, entry.dateipfad);
      const target = path.join(paths.finalPath, `${String(entry.reihenfolge).padStart(3, "0")}_${path.basename(entry.dateipfad)}`);
      await fs.copyFile(source, target).catch((error) => {
        console.error(`Fehler beim Kopieren von ${source}:`, error.message);
      });
    }
  }

  if (missingRequired.length) {
    lines.push("");
    lines.push("FEHLENDE PFLICHTDOKUMENTE:");
    missingRequired.forEach((item) => lines.push(`- ${item}`));
  }

  const orderFile = path.join(paths.finalPath, "EXPORT_REIHENFOLGE.txt");
  await fs.writeFile(orderFile, `${lines.join("\n")}\n`, "utf8");

  return {
    orderFile,
    missingRequired
  };
}

module.exports = {
  buildExportliste,
  prepareFinalExport
};
