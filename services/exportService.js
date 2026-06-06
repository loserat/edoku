const fs = require("fs/promises");
const path = require("path");
const { chapterFolderForKapitel, createProjectFolder, fileSafeName, getProjectPaths } = require("./projectService");
const { writeJson } = require("./jsonService");
const { applyLogicalChapterNumbers, sortDocuments } = require("./chapterNumberingService");
const { buildDocumentationAttachmentEntries } = require("./documentAttachmentService");
const { normalizeGeraetelisten } = require("./geraetelistenService");

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

function finalExportFileName(entry) {
  const order = String(entry.reihenfolge || 0).padStart(3, "0");
  const kapitel = String(entry.kapitel || entry.originalKapitel || "")
    .replaceAll(".", "_")
    .replace(/[^0-9_]/g, "");
  const title = fileSafeName(entry.titel || path.basename(entry.dateipfad || "", ".pdf"), "Dokument");
  const sourceExtension = path.extname(entry.dateipfad || "").toLowerCase() || ".pdf";
  return [order, kapitel, title].filter(Boolean).join("_") + sourceExtension;
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

function isImportedDocumentPlaceholder(entry) {
  return String(entry.dokumenttyp || "") === "Plan"
    && String(entry.formularart || "") === "Dateiliste"
    && Number(entry.ebene || 1) >= 2;
}

function activeLeistungsbereicheSet(leistungsbereiche = {}) {
  return new Set(Array.isArray(leistungsbereiche.aktiv) ? leistungsbereiche.aktiv : []);
}

function isGeraetelistenDocumentAvailable(entry, geraetelisten = [], leistungsbereiche = {}) {
  if (!String(entry.quelle || "").includes("geraetelisten.json")) return true;
  const activeSet = activeLeistungsbereicheSet(leistungsbereiche);
  return normalizeGeraetelisten(geraetelisten).some((liste) => {
    if (!liste.aktiv || !liste.export) return false;
    if (activeSet.size && !activeSet.has(liste.leistungsbereich)) return false;
    return liste.leistungsbereich === entry.leistungsbereich
      || String(liste.kapitel || "") === String(entry.originalKapitel || entry.kapitel || "");
  });
}

async function sourceExists(rootDir, relativePath) {
  if (!relativePath) return false;
  return fs.access(path.join(rootDir, relativePath)).then(() => true).catch(() => false);
}

async function clearFinalExportFolder(finalPath) {
  try {
    const entries = await fs.readdir(finalPath, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile() && [".pdf", ".txt"].includes(path.extname(entry.name).toLowerCase()))
      .map((entry) => fs.unlink(path.join(finalPath, entry.name))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function buildExportliste(rootDir, projekt, matrix, exportlistePath, projektSysteme = [], anhaenge = [], geraetelisten = [], leistungsbereiche = {}) {
  const paths = await createProjectFolder(rootDir, projekt);
  const generated = await listPdfFiles(paths.generatedPath);
  const external = await listPdfFiles(paths.configPath);
  const activeDocs = sortDocuments(applyLogicalChapterNumbers(matrix, { exportOnly: true }).filter((entry) => {
    if (!entry.aktiv || !entry.export) return false;
    if (isImportedDocumentPlaceholder(entry)) return false;
    return isGeraetelistenDocumentAvailable(entry, geraetelisten, leistungsbereiche);
  }));
  const usedFiles = new Set();

  const entries = activeDocs.map((entry) => {
    const generatedMatch = matchByKapitel(generated, entry.kapitel);
    const chapterFolder = chapterFolderForKapitel(entry.kapitel);
    const externalMatch = external.find((file) => file.includes(`${path.sep}${chapterFolder}${path.sep}`));
    const found = generatedMatch || externalMatch;
    if (found) usedFiles.add(found);

    return {
      reihenfolge: 0,
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

  const attachmentEntries = await Promise.all(buildDocumentationAttachmentEntries(matrix, anhaenge, projekt).map(async (entry) => ({
    reihenfolge: 0,
    kapitel: entry.displayKapitel || entry.kapitel,
    originalKapitel: entry.originalKapitel || "",
    titel: entry.titel,
    dateipfad: entry.dateipfad,
    quelle: "import",
    status: await sourceExists(rootDir, entry.dateipfad) ? "vorhanden" : "fehlt",
    pflicht: false,
    leistungsbereich: entry.leistungsbereich || "Dokumentation",
    hersteller: "",
    systemart: "",
    dokumentarten: [entry.dokumenttyp].filter(Boolean)
  })));

  attachmentEntries.forEach((entry) => {
    entries.push({
      ...entry
    });
  });

  [...generated, ...external].forEach((file) => {
    if (usedFiles.has(file)) return;
    const baseTitle = path.basename(file, ".pdf");
    const isToc = baseTitle.toLowerCase() === "inhaltsverzeichnis";
    entries.push({
      reihenfolge: 0,
      kapitel: isToc ? "0" : "",
      originalKapitel: isToc ? "0" : "",
      titel: baseTitle,
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

  entries.sort((a, b) => {
    const aHasKapitel = Boolean(String(a.kapitel || "").trim());
    const bHasKapitel = Boolean(String(b.kapitel || "").trim());
    if (aHasKapitel !== bHasKapitel) return aHasKapitel ? -1 : 1;
    return String(a.kapitel || "").localeCompare(String(b.kapitel || ""), "de", { numeric: true })
      || String(a.titel || "").localeCompare(String(b.titel || ""), "de", { sensitivity: "base" });
  });
  entries.forEach((entry, index) => {
    entry.reihenfolge = index + 1;
  });

  await writeJson(exportlistePath, entries);
  return entries;
}

async function prepareFinalExport(rootDir, projekt, matrix, exportlistePath) {
  const paths = getProjectPaths(rootDir, projekt);
  await fs.mkdir(paths.finalPath, { recursive: true });
  await clearFinalExportFolder(paths.finalPath);
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
      const target = path.join(paths.finalPath, finalExportFileName(entry));
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
