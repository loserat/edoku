const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, PDFName } = require("pdf-lib");
const { chapterFolderForKapitel, createProjectFolder, fileSafeName, getProjectPaths } = require("./projectService");
const { writeJson } = require("./jsonService");
const { applyLogicalChapterNumbers, sortDocuments } = require("./chapterNumberingService");
const { buildDocumentationAttachmentEntries } = require("./documentAttachmentService");
const { normalizeGeraetelisten } = require("./geraetelistenService");

// * INFO: Sucht rekursiv alle PDF-Dateien in einem Ordner. Fehlende Ordner liefern eine leere Liste.
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

// * INFO: Speichert relative Pfade plattformunabhängig mit Slash, damit JSON portabel bleibt.
function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

// * INFO: Einheitlicher Dateiname für die finale Exportablage.
function finalExportFileName(entry) {
  const order = String(entry.reihenfolge || 0).padStart(3, "0");
  const kapitel = String(entry.kapitel || entry.originalKapitel || "")
    .replaceAll(".", "_")
    .replace(/[^0-9_]/g, "");
  const title = fileSafeName(entry.titel || path.basename(entry.dateipfad || "", ".pdf"), "Dokument");
  const sourceExtension = path.extname(entry.dateipfad || "").toLowerCase() || ".pdf";
  return [order, kapitel, title].filter(Boolean).join("_") + sourceExtension;
}

// * INFO: Gesamt-PDF-Dateiname fuer den finalen Export.
function completeDocumentationFileName(projekt) {
  return `${fileSafeName(projekt.projektnummer || "Projekt")}_${fileSafeName(projekt.projektname || "edoku")}_Gesamtdokumentation.pdf`;
}

// * INFO: Grobe Kapitelordner für den ZIP-Export. Die Ordnerstruktur bleibt bewusst flach.
function topChapterFolderName(entry) {
  const top = String(entry.kapitel || entry.originalKapitel || "99").split(".")[0] || "99";
  const folderNames = {
    "0": "00_Inhaltsverzeichnis",
    "1": "01_Betriebskarteien",
    "2": "02_Konformitaet_CE",
    "3": "03_Anlagenbeschreibung_Bedienung",
    "4": "04_Bedienung_Betrieb_Instandhaltung",
    "5": "05_Unfallverhuetungsvorschriften",
    "6": "06_Geraeteliste",
    "7": "07_Produkt_Datenblaetter",
    "8": "08_Abnahme_Maengelbeseitigung",
    "9": "09_Einweisungsprotokolle",
    "10": "10_Messprotokolle",
    "11": "11_Sonstige_Bescheinigungen",
    "12": "12_Bestandsplaene",
    "13": "13_Sonstiges"
  };
  return folderNames[top] || `${String(top).padStart(2, "0")}_Sonstiges`;
}

// * INFO: CRC32 wird für das ZIP-Format benötigt. Die Implementierung vermeidet eine
// * INFO: zusätzliche Abhängigkeit und schreibt unkomprimierte ZIP-Einträge.
function crc32(buffer) {
  if (!crc32.table) {
    crc32.table = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      return value >>> 0;
    });
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crc32.table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// * INFO: Wandelt JS-Datum in DOS-Zeit/Datum um, wie es ZIP-Header erwarten.
function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// * INFO: Schreibt ein einfaches ZIP-Archiv aus vorhandenen Dateien.
// * INFO: Seiteneffekt: legt/überschreibt die ZIP-Datei am angegebenen Pfad.
async function writeZipFile(zipPath, files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const file of files) {
    const data = await fs.readFile(file.sourcePath);
    const name = Buffer.from(file.zipPath.replaceAll("\\", "/"), "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(day, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(day, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  await fs.writeFile(zipPath, Buffer.concat([...chunks, ...central, end]));
}

/**
 * * INFO: Fuehrt vorhandene PDFs in Exportlisten-Reihenfolge zu einer Gesamt-PDF zusammen.
 * ! WICHTIG: Fehlerhafte oder nicht lesbare Quelldateien werden uebersprungen und protokolliert.
 */
async function mergePdfFiles(targetPath, orderedPdfFiles, tocEntries = []) {
  const mergedPdf = await PDFDocument.create();
  const skipped = [];
  const mergedEntries = [];
  let pages = 0;

  for (const file of orderedPdfFiles) {
    try {
      const sourceBytes = await fs.readFile(file.sourcePath);
      const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      const startPageIndex = pages;
      copiedPages.forEach((page) => mergedPdf.addPage(page));
      pages += copiedPages.length;
      mergedEntries.push({
        ...file,
        startPageIndex,
        pageCount: copiedPages.length
      });
    } catch (error) {
      skipped.push({
        file: file.sourcePath,
        reason: error.message
      });
      console.error(`PDF konnte nicht in Gesamt-PDF uebernommen werden (${file.sourcePath}):`, error.message);
    }
  }

  if (!pages) {
    return {
      targetPath: "",
      pages: 0,
      skipped
    };
  }

  addInhaltsverzeichnisLinks(mergedPdf, mergedEntries, tocEntries);

  await fs.writeFile(targetPath, await mergedPdf.save());
  return {
    targetPath,
    pages,
    skipped
  };
}

// ! WICHTIG: Vergleichsschluessel verbindet Exportliste, kopierte PDF und Inhaltsverzeichnis-Link.
function exportEntryKey(entry = {}) {
  return [
    String(entry.kapitel || ""),
    String(entry.titel || ""),
    String(entry.dateipfad || "")
  ].join("|");
}

// ? WARUM: Das Inhaltsverzeichnis selbst wird nicht als Sprungziel verlinkt.
function isInhaltsverzeichnisEntry(entry = {}, file = {}) {
  const title = String(entry.titel || "").toLowerCase();
  const sourceName = path.basename(file.sourcePath || entry.dateipfad || "").toLowerCase();
  return title === "inhaltsverzeichnis" || sourceName === "inhaltsverzeichnis.pdf";
}

// ! WICHTIG: Ohne Annots-Array können keine klickbaren PDF-Linkflächen gespeichert werden.
function ensurePageAnnotations(pdfDoc, page) {
  const existing = page.node.Annots();
  if (existing) return existing;
  const annots = pdfDoc.context.obj([]);
  page.node.set(PDFName.of("Annots"), annots);
  return annots;
}

// ! WICHTIG: Fügt eine interne GoTo-Linkfläche ein; Ziel ist eine echte Seite im Gesamt-PDF.
function addInternalPageLink(pdfDoc, sourcePage, targetPage, rect) {
  const destination = pdfDoc.context.obj([targetPage.ref, PDFName.of("Fit")]);
  const action = pdfDoc.context.obj({
    S: PDFName.of("GoTo"),
    D: destination
  });
  const annotation = pdfDoc.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect: rect,
    Border: [0, 0, 0],
    H: PDFName.of("I"),
    A: action
  });
  ensurePageAnnotations(pdfDoc, sourcePage).push(pdfDoc.context.register(annotation));
}

/**
 * ! WICHTIG:
 * ! WICHTIG: Verlinkt die Zeilen im kopierten Inhaltsverzeichnis mit den Seiten im Gesamt-PDF.
 * ? WARUM:
 * ? WARUM: Fehlende Dokumente behalten ihren Platz im Layout, bekommen aber keinen Link.
 * ? WARUM: Dadurch bleiben spaetere Seitenzaehlungen fuer Anhaenge und Bedienungsanleitungen stabil.
 */
function addInhaltsverzeichnisLinks(pdfDoc, mergedEntries, tocEntries) {
  const tocFile = mergedEntries.find((file) => isInhaltsverzeichnisEntry(file.entry, file));
  if (!tocFile || !tocEntries.length) return;

  const targetByKey = new Map();
  mergedEntries
    .filter((file) => !isInhaltsverzeichnisEntry(file.entry, file))
    .forEach((file) => targetByKey.set(exportEntryKey(file.entry), file.startPageIndex));

  const printableRows = tocEntries.filter((entry) => !isInhaltsverzeichnisEntry(entry));
  const linkedPageCount = Math.max(1, tocFile.pageCount || 1);
  const firstTocPageIndex = tocFile.startPageIndex;
  const rowStartY = 142;
  const rowBottomLimitY = 745;
  const rowBaseHeight = 15;
  let tocPageOffset = 0;
  let yFromTop = rowStartY;

  printableRows.forEach((entry) => {
    const level = Math.max(1, Math.min(3, Number(entry.ebene) || String(entry.kapitel || "").split(".").length || 1));
    const rowHeight = level === 1 ? 18 : 15;

    if (yFromTop > rowBottomLimitY) {
      tocPageOffset += 1;
      yFromTop = rowStartY;
    }

    const targetPageIndex = targetByKey.get(exportEntryKey(entry));
    const sourcePageIndex = firstTocPageIndex + tocPageOffset;
    if (targetPageIndex !== undefined && tocPageOffset < linkedPageCount) {
      const sourcePage = pdfDoc.getPage(sourcePageIndex);
      const targetPage = pdfDoc.getPage(targetPageIndex);
      const pageWidth = sourcePage.getWidth();
      const pageHeight = sourcePage.getHeight();
      const indent = (level - 1) * 14;
      const x1 = 48 + indent;
      const y1 = pageHeight - yFromTop - rowBaseHeight;
      const x2 = pageWidth - 48;
      const y2 = pageHeight - yFromTop + 5;
      addInternalPageLink(pdfDoc, sourcePage, targetPage, [x1, y1, x2, y2]);
    }

    yFromTop += rowHeight;
  });
}

// * INFO: Sucht eine generierte Datei anhand der Kapitelnummer im Dateinamen.
function matchByKapitel(files, kapitel) {
  const normalized = String(kapitel).replaceAll(".", "_");
  const padded = String(kapitel)
    .split(".")
    .map((part) => part.padStart(2, "0"))
    .join("_");
  const chapterTokens = [normalized, padded].filter(Boolean);
  return files.filter((file) => {
    const name = path.basename(file);
    return chapterTokens.some((token) => new RegExp(`^${token}(?:_[^0-9]|$)`).test(name));
  });
}

// * INFO: Bei gleicher Kapitelnummer entscheidet zusaetzlich der Dateititel, damit
// * INFO: mehrere Dokumente in einem Kapitel nicht dieselbe PDF referenzieren.
function matchGeneratedFile(files, entry, usedFiles) {
  const candidates = matchByKapitel(files, entry.displayKapitel || entry.kapitel).filter((file) => !usedFiles.has(file));
  if (!candidates.length) return "";
  const safeTitle = fileSafeName(entry.titel || "", "").toLowerCase();
  return candidates.find((file) => path.basename(file, ".pdf").toLowerCase().includes(safeTitle)) || candidates[0];
}

// * INFO: Ergänzt Exporteinträge um System- und Herstellerinformationen aus der Projektauswahl.
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

// * INFO: Platzhalter für später importierte Plandateien werden nicht als fehlende Dokumente gezählt.
function isImportedDocumentPlaceholder(entry) {
  return String(entry.dokumenttyp || "") === "Plan"
    && String(entry.formularart || "") === "Dateiliste"
    && Number(entry.ebene || 1) >= 2;
}

// * INFO: Ermittelt aktive Leistungsbereiche als Set für schnelle Listenprüfungen.
function activeLeistungsbereicheSet(leistungsbereiche = {}) {
  return new Set(Array.isArray(leistungsbereiche.aktiv) ? leistungsbereiche.aktiv : []);
}

// * INFO: Gerätelisten-Dokumente gelten nur als verfügbar, wenn die passende Liste aktiv/exportierbar ist.
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

// * INFO: Prüft, ob ein in JSON referenzierter Exportpfad auf der Platte existiert.
async function sourceExists(rootDir, relativePath) {
  if (!relativePath) return false;
  return fs.access(path.join(rootDir, relativePath)).then(() => true).catch(() => false);
}

// * INFO: Räumt erzeugte Exportdateien im finalen Ordner auf, ohne Unterordner anzufassen.
async function clearFinalExportFolder(finalPath) {
  try {
    const entries = await fs.readdir(finalPath, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile() && [".pdf", ".txt", ".zip"].includes(path.extname(entry.name).toLowerCase()))
      .map((entry) => fs.unlink(path.join(finalPath, entry.name))));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/**
 * * INFO: Baut die Exportliste aus aktiver Dokumentenmatrix, generierten PDFs,
 * * INFO: importierten Anhängen und extern abgelegten PDFs.
 * ! WICHTIG: Seiteneffekt: schreibt die Exportliste als JSON.
 */
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
    const generatedMatch = matchGeneratedFile(generated, entry, usedFiles);
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

  const attachmentEntries = await Promise.all(buildDocumentationAttachmentEntries(matrix, anhaenge, projekt, geraetelisten).map(async (entry) => ({
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
    if (!isToc) return;
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

/**
 * * INFO: Bereitet den finalen Export vor.
 * * INFO: Kopiert vorhandene PDFs in den finalen Ordner, schreibt eine Reihenfolge-Datei
 * * INFO: und erzeugt zusätzlich ein ZIP mit flacher Kapitelstruktur.
 */
async function prepareFinalExport(rootDir, projekt, matrix, exportlistePath) {
  const paths = getProjectPaths(rootDir, projekt);
  await fs.mkdir(paths.finalPath, { recursive: true });
  await clearFinalExportFolder(paths.finalPath);
  const content = await fs.readFile(exportlistePath, "utf8").catch(() => "[]");
  const exportliste = JSON.parse(content);
  const missingRequired = [];
  const lines = [];
  const zipFiles = [];
  const orderedPdfFiles = [];

  const orderedExportliste = [...exportliste].sort((a, b) => Number(a.reihenfolge || 0) - Number(b.reihenfolge || 0));

  for (const entry of orderedExportliste) {
    const sourceKapitel = entry.originalKapitel || entry.kapitel;
    const matrixEntry = matrix.find((doc) => doc.kapitel === sourceKapitel);
    lines.push(`${String(entry.reihenfolge).padStart(3, "0")} | ${entry.kapitel} | ${entry.titel} | ${entry.status} | ${entry.dateipfad || "-"}`);

    if (entry.status === "fehlt" && matrixEntry && matrixEntry.pflicht) {
      missingRequired.push(`${entry.kapitel} ${entry.titel}`);
    }

    if (entry.status === "vorhanden" && entry.dateipfad) {
      const source = path.join(rootDir, entry.dateipfad);
      const finalName = finalExportFileName(entry);
      const target = path.join(paths.finalPath, finalName);
      const zipPath = `${topChapterFolderName(entry)}/${finalName}`;
      const copied = await fs.copyFile(source, target).then(() => true).catch((error) => {
        console.error(`Fehler beim Kopieren von ${source}:`, error.message);
        return false;
      });
      if (copied) {
        if (path.extname(finalName).toLowerCase() === ".pdf") {
          orderedPdfFiles.push({
            sourcePath: target,
            finalName,
            zipPath,
            entry
          });
        }
        zipFiles.push({
          sourcePath: target,
          zipPath
        });
      }
    }
  }

  if (missingRequired.length) {
    lines.push("");
    lines.push("FEHLENDE PFLICHTDOKUMENTE:");
    missingRequired.forEach((item) => lines.push(`- ${item}`));
  }

  const orderFile = path.join(paths.finalPath, "EXPORT_REIHENFOLGE.txt");
  await fs.writeFile(orderFile, `${lines.join("\n")}\n`, "utf8");
  zipFiles.push({
    sourcePath: orderFile,
    zipPath: `00_Inhaltsverzeichnis/${path.basename(orderFile)}`
  });

  const completePdfPath = path.join(paths.finalPath, completeDocumentationFileName(projekt));
  const mergeResult = await mergePdfFiles(completePdfPath, orderedPdfFiles, orderedExportliste);
  if (mergeResult.targetPath) {
    zipFiles.unshift({
      sourcePath: mergeResult.targetPath,
      zipPath: `00_Inhaltsverzeichnis/${path.basename(mergeResult.targetPath)}`
    });
  }

  const zipName = `${fileSafeName(projekt.projektnummer || "Projekt")}_${fileSafeName(projekt.projektname || "edoku")}_Export.zip`;
  const zipPath = path.join(paths.finalPath, zipName);
  await writeZipFile(zipPath, zipFiles);

  return {
    completePdfPath: mergeResult.targetPath,
    completePdfPages: mergeResult.pages,
    skippedMergeFiles: mergeResult.skipped,
    orderFile,
    zipPath,
    missingRequired
  };
}

module.exports = {
  buildExportliste,
  prepareFinalExport
};
