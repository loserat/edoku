const fs = require("fs/promises");
const path = require("path");
const { chapterFolderForKapitel, createProjectFolder, fileSafeName, getProjectPaths } = require("./projectService");
const { writeJson } = require("./jsonService");
const { applyLogicalChapterNumbers, sortDocuments } = require("./chapterNumberingService");
const { buildDocumentationAttachmentEntries } = require("./documentAttachmentService");
const { normalizeGeraetelisten } = require("./geraetelistenService");

// Sucht rekursiv alle PDF-Dateien in einem Ordner. Fehlende Ordner liefern eine leere Liste.
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

// Speichert relative Pfade plattformunabhängig mit Slash, damit JSON portabel bleibt.
function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

// Einheitlicher Dateiname für die finale Exportablage.
function finalExportFileName(entry) {
  const order = String(entry.reihenfolge || 0).padStart(3, "0");
  const kapitel = String(entry.kapitel || entry.originalKapitel || "")
    .replaceAll(".", "_")
    .replace(/[^0-9_]/g, "");
  const title = fileSafeName(entry.titel || path.basename(entry.dateipfad || "", ".pdf"), "Dokument");
  const sourceExtension = path.extname(entry.dateipfad || "").toLowerCase() || ".pdf";
  return [order, kapitel, title].filter(Boolean).join("_") + sourceExtension;
}

// Grobe Kapitelordner für den ZIP-Export. Die Ordnerstruktur bleibt bewusst flach.
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

// CRC32 wird für das ZIP-Format benötigt. Die Implementierung vermeidet eine
// zusätzliche Abhängigkeit und schreibt unkomprimierte ZIP-Einträge.
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

// Wandelt JS-Datum in DOS-Zeit/Datum um, wie es ZIP-Header erwarten.
function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// Schreibt ein einfaches ZIP-Archiv aus vorhandenen Dateien.
// Seiteneffekt: legt/überschreibt die ZIP-Datei am angegebenen Pfad.
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

// Sucht eine generierte Datei anhand der Kapitelnummer im Dateinamen.
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

// Ergänzt Exporteinträge um System- und Herstellerinformationen aus der Projektauswahl.
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

// Platzhalter für später importierte Plandateien werden nicht als fehlende Dokumente gezählt.
function isImportedDocumentPlaceholder(entry) {
  return String(entry.dokumenttyp || "") === "Plan"
    && String(entry.formularart || "") === "Dateiliste"
    && Number(entry.ebene || 1) >= 2;
}

// Ermittelt aktive Leistungsbereiche als Set für schnelle Listenprüfungen.
function activeLeistungsbereicheSet(leistungsbereiche = {}) {
  return new Set(Array.isArray(leistungsbereiche.aktiv) ? leistungsbereiche.aktiv : []);
}

// Gerätelisten-Dokumente gelten nur als verfügbar, wenn die passende Liste aktiv/exportierbar ist.
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

// Prüft, ob ein in JSON referenzierter Exportpfad auf der Platte existiert.
async function sourceExists(rootDir, relativePath) {
  if (!relativePath) return false;
  return fs.access(path.join(rootDir, relativePath)).then(() => true).catch(() => false);
}

// Räumt erzeugte Exportdateien im finalen Ordner auf, ohne Unterordner anzufassen.
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
 * Baut die Exportliste aus aktiver Dokumentenmatrix, generierten PDFs,
 * importierten Anhängen und extern abgelegten PDFs.
 * Seiteneffekt: schreibt die Exportliste als JSON.
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

/**
 * Bereitet den finalen Export vor.
 * Kopiert vorhandene PDFs in den finalen Ordner, schreibt eine Reihenfolge-Datei
 * und erzeugt zusätzlich ein ZIP mit flacher Kapitelstruktur.
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

  for (const entry of exportliste) {
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
      await fs.copyFile(source, target).catch((error) => {
        console.error(`Fehler beim Kopieren von ${source}:`, error.message);
      });
      zipFiles.push({
        sourcePath: source,
        zipPath: `${topChapterFolderName(entry)}/${finalName}`
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
  zipFiles.push({
    sourcePath: orderFile,
    zipPath: `00_Inhaltsverzeichnis/${path.basename(orderFile)}`
  });

  const zipName = `${fileSafeName(projekt.projektnummer || "Projekt")}_${fileSafeName(projekt.projektname || "edoku")}_Export.zip`;
  const zipPath = path.join(paths.finalPath, zipName);
  await writeZipFile(zipPath, zipFiles);

  return {
    orderFile,
    zipPath,
    missingRequired
  };
}

module.exports = {
  buildExportliste,
  prepareFinalExport
};
