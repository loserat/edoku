const fs = require("fs/promises");
const path = require("path");
const { writeZipFile } = require("./zipService");
const { assertSafePath } = require("./pathService");
const { PDFDocument, PDFName } = require("pdf-lib");
const { chapterFolderForKapitel, createProjectFolder, fileSafeName, getProjectPaths, readableProjectPaths, resolveProjectSource } = require("./projectService");
const { writeJson } = require("./jsonService");
const { buildDocumentationPlan, summarizeExportEntries } = require("./documentationPlanService");
const { generateInhaltsverzeichnis } = require("./pdfService");

// * INFO: Sucht rekursiv alle PDF-Dateien in einem Ordner. Fehlende Ordner liefern eine leere Liste.
async function listPdfFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
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
function topChapterFolderName(entry, entries = []) {
  const top = String(entry.kapitel || "0").split(".")[0];
  const chapter = entries.find((item) => item.kapitel === top);
  const title = top === "0" ? "Inhaltsverzeichnis" : chapter?.titel || "Dokumentation";
  return `${top.padStart(2, "0")}_${fileSafeName(title)}`;
}

/**
 * * INFO: Fuehrt vorhandene PDFs in Exportlisten-Reihenfolge zu einer Gesamt-PDF zusammen.
 * ! WICHTIG: Fehlerhafte oder nicht lesbare Quelldateien werden uebersprungen und protokolliert.
 */
async function mergePdfFiles(targetPath, orderedPdfFiles, tocLayout = []) {
  const mergedPdf = await PDFDocument.create();
  const skipped = [];
  const mergedEntries = [];
  let pages = 0;

  for (const file of orderedPdfFiles) {
    try {
      const sourceBytes = await fs.readFile(file.sourcePath);
      const sourcePdf = await PDFDocument.load(sourceBytes);
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

  addInhaltsverzeichnisLinks(mergedPdf, mergedEntries, tocLayout);

  await fs.writeFile(targetPath, await mergedPdf.save());
  return {
    targetPath,
    pages,
    skipped
  };
}

function isInhaltsverzeichnisEntry(entry = {}, file = {}) {
  return Boolean(entry.isToc) || entry.kapitel === "0" || String(entry.titel || "").toLowerCase() === "inhaltsverzeichnis";
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

// Gemessene Linkflächen bleiben auch bei mehrzeiligen Titeln an der richtigen Zeile.
function addInhaltsverzeichnisLinks(pdfDoc, mergedEntries, layoutRows) {
  const toc = mergedEntries.find((file) => isInhaltsverzeichnisEntry(file.entry));
  if (!toc) return;
  layoutRows.forEach((row) => {
    if (!row.startSeite) return;
    const target = mergedEntries.find((file) => file.entry.id === row.id)
      || mergedEntries.find((file) => String(file.entry.kapitel).startsWith(`${row.kapitel}.`));
    if (!target || row.pageIndex >= toc.pageCount) return;
    const page = pdfDoc.getPage(toc.startPageIndex + row.pageIndex);
    const rect = [row.x, page.getHeight() - row.y - row.height, row.x + row.width, page.getHeight() - row.y];
    addInternalPageLink(pdfDoc, page, pdfDoc.getPage(target.startPageIndex), rect);
  });
}

function metadataForEntry(entry, systems = []) {
  const selection = systems.find((item) => item.leistungsbereich === entry.leistungsbereich)
    || systems.find((item) => (item.kapitel || []).includes(entry.originalKapitel)) || {};
  return { leistungsbereich: entry.leistungsbereich || selection.leistungsbereich || "", hersteller: selection.hersteller || "", systemart: selection.systemart || "", dokumentarten: selection.dokumentarten || [] };
}
function chapterFileMatches(file, chapter) {
  const prefix = String(chapter).replaceAll(".", "_");
  return new RegExp(`^${prefix}(?:_[^0-9]|$)`, "i").test(path.basename(file));
}
function takeMatchingFile(candidates, entry, used) {
  const available = candidates.filter((file) => !used.has(file));
  const title = fileSafeName(entry.titel || "", "").toLowerCase();
  const exact = available.filter((file) => path.basename(file).toLowerCase().includes(title));
  return exact.length === 1 ? exact[0] : available.length === 1 ? available[0] : "";
}
async function inspectPdf(filePath) {
  try {
    const pdf = await PDFDocument.load(await fs.readFile(filePath));
    const seiten = pdf.getPageCount();
    let metadata = {};
    try { const parsed = JSON.parse(pdf.getSubject() || "{}"); if (parsed && typeof parsed === "object") metadata = parsed; } catch {}
    return seiten ? { status: "vorhanden", seiten, pdfDocumentId: metadata.edoku === 1 ? metadata.id : null, pdfChapter: metadata.edoku === 1 ? metadata.chapter : null } : { status: "fehlerhaft", seiten: 0, fehler: "PDF enthält keine Seiten." };
  } catch (error) {
    return { status: error.code === "ENOENT" ? "fehlt" : "fehlerhaft", seiten: 0, fehler: error.code === "ENOENT" ? "Datei nicht vorhanden." : "PDF ist nicht lesbar oder verschlüsselt." };
  }
}
function assignPageRanges(entries) {
  let next = 1;
  entries.forEach((entry) => {
    entry.startSeite = entry.status === "vorhanden" && entry.seiten > 0 ? next : null;
    entry.endeSeite = entry.startSeite ? next + entry.seiten - 1 : null;
    if (entry.startSeite) next += entry.seiten;
  });
  entries.filter((entry) => entry.requiresFile === false).forEach((entry) => {
    const child = entries.find((candidate) => String(candidate.kapitel).startsWith(`${entry.kapitel}.`) && candidate.startSeite);
    entry.startSeite = child?.startSeite || null;
  });
  return next - 1;
}

// Der Plan wird vor jeder Prüfung aus aktuellen Auswahlen neu aufgebaut.
async function buildExportliste(rootDir, projekt, matrix, exportlistePath, projektSysteme = [], anhaenge = [], geraetelisten = [], leistungsbereiche = {}, options = {}) {
  const paths = getProjectPaths(rootDir, projekt);
  const sources = readableProjectPaths(rootDir, projekt);
  for (const p of sources) for (const folder of [p.projectPath,p.generatedPath,p.configPath]) await assertSafePath(rootDir, folder, { allowMissing: true });
  const generated = (await Promise.all(sources.map(p => listPdfFiles(p.generatedPath)))).flat();
  const external = (await Promise.all(sources.map(p => listPdfFiles(p.configPath)))).flat();
  const used = new Set();
  const inspected = new Map();
  async function inspect(file) {
    try { await resolveProjectSource(rootDir, projekt, relative(rootDir, file)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!inspected.has(file)) inspected.set(file, await inspectPdf(file));
    return inspected.get(file);
  }
  const plan = buildDocumentationPlan(matrix, geraetelisten, anhaenge, leistungsbereiche, projekt);
  const entries = [];
  let tocPath = path.join(paths.generatedPath, "Inhaltsverzeichnis.pdf");
  for (const source of sources) {
    const candidate=path.join(source.generatedPath,"Inhaltsverzeichnis.pdf");
    try { await fs.access(candidate); tocPath=candidate; break; } catch (error) { if(error.code!=="ENOENT")throw error; }
  }
  const toc = { id: "inhaltsverzeichnis", isToc: true, requiresFile: true, kapitel: "0", originalKapitel: "0", ebene: 1, titel: "Inhaltsverzeichnis", dateipfad: relative(rootDir, tocPath), quelle: "intern", pflicht: true, ...await inspect(tocPath) };
  if (toc.status === "vorhanden" && (toc.pdfDocumentId !== "inhaltsverzeichnis" || toc.pdfChapter !== "0")) Object.assign(toc, { status: "veraltet", seiten: 0, fehler: "Inhaltsverzeichnis neu erzeugen." });
  entries.push(toc);
  for (const node of plan) {
    let source = node.dateipfad ? path.join(rootDir, node.dateipfad) : "";
    let quelle = node.attachmentId ? "import" : "manuell";
    let stale = false;
    if (node.requiresFile && !source) {
      const candidates = generated.filter((file) => {
        if (!chapterFileMatches(file, node.displayKapitel)) return false;
        if (node.deviceListId) return sources.some(p => path.dirname(file) === path.join(p.generatedPath, "Geraetelisten"));
        if (node.originalKapitel === "13.5" && !node.isCover) return sources.some(p => path.dirname(file) === path.join(p.generatedPath, "Brandschutz"));
        return sources.some(p => path.dirname(file) === p.generatedPath);
      });
      const identified = [];
      for (const file of candidates) {
        const metadata = await inspect(file);
        if (metadata.pdfDocumentId === node.id && metadata.pdfChapter === node.displayKapitel) identified.push(file);
        else stale = true;
      }
      source = takeMatchingFile(identified, node, used);
      if (source) quelle = "intern";
      if (!source) {
        const folder = chapterFolderForKapitel(node.originalKapitel);
        const chapterFiles = external.filter((file) => folder && file.includes(`${path.sep}${folder}${path.sep}`) && !used.has(file));
        source = takeMatchingFile(chapterFiles.filter((file) => chapterFileMatches(file, node.originalKapitel)), node, used)
          || takeMatchingFile(chapterFiles.filter((file) => path.basename(file).toLowerCase().includes(fileSafeName(node.titel, "").toLowerCase())), node, used);
        if (source) quelle = "extern";
      }
      if (source) used.add(source);
    }
    entries.push({
      ...node, ...metadataForEntry(node, projektSysteme), kapitel: node.displayKapitel,
      dateipfad: source ? relative(rootDir, source) : "",
      previewId: source && source.startsWith(paths.projectPath + path.sep) ? relative(paths.projectPath, source) : "",
      previewUrl: node.attachmentId ? `/anhaenge/preview?id=${encodeURIComponent(node.attachmentId)}` : "",
      quelle: node.requiresFile ? quelle : "Struktur",
      ...(node.requiresFile ? source ? await inspect(source) : { status: stale ? "veraltet" : "fehlt", seiten: 0, ...(stale ? { fehler: "PDF passt nicht zur aktuellen Kapitelzuordnung. Dokumentation neu erzeugen." } : {}) } : { status: "struktur", seiten: 0 })
    });
  }
  toc.unzugeordneteDateien = external.filter((file) => !used.has(file)).map((file) => relative(rootDir, file));
  let plannedFile = 0;
  let exportedFile = 0;
  entries.forEach((entry, index) => {
    entry.position = index + 1;
    entry.reihenfolge = entry.requiresFile ? ++plannedFile : null;
    entry.exportReihenfolge = entry.requiresFile && entry.status === "vorhanden" ? ++exportedFile : null;
  });
  assignPageRanges(entries);
  if (options.persist !== false) {
    const saved = await writeJson(exportlistePath, entries);
    if (!saved.ok) throw new Error(saved.error);
  }
  return entries;
}

async function buildFinalExport(rootDir, projekt, matrix, exportlistePath, options = {}) {
  const paths = { ...await createProjectFolder(rootDir, projekt), finalPath: options.finalPath };
  const entries = JSON.parse(await fs.readFile(exportlistePath, "utf8"));
  const ordered = entries.sort((a, b) => Number(a.position || a.reihenfolge) - Number(b.position || b.reihenfolge));
  const toc = ordered.find((entry) => entry.isToc || entry.kapitel === "0");
  if (!toc) throw new Error("Exportliste ohne Inhaltsverzeichnis. Bitte Dokumentation neu erzeugen.");
  // Vor dem Zusammenführen werden Seiten und Zeilen aus demselben Exportplan gesetzt.
  for (const entry of ordered.filter((item) => item.requiresFile !== false)) {
    if (entry.dateipfad) Object.assign(entry, await inspectPdf(await resolveProjectSource(rootDir, projekt, entry.dateipfad)));
  }
  for (let pass = 0; pass < 3; pass += 1) {
    const oldPages = toc.seiten;
    assignPageRanges(ordered);
    const [tocFile] = await generateInhaltsverzeichnis(rootDir, projekt, matrix, options.systemSettings || {}, [], [], {}, { entries: ordered });
    toc.dateipfad = relative(rootDir, tocFile);
    Object.assign(toc, await inspectPdf(tocFile));
    if (toc.seiten === oldPages) break;
    if (pass === 2) throw new Error("Seitenzahl des Inhaltsverzeichnisses konnte nicht stabil berechnet werden.");
  }
  assignPageRanges(ordered);
  const layout = JSON.parse(await fs.readFile(path.join(rootDir, toc.dateipfad) + ".layout.json", "utf8"));
  const zipFiles = [];
  const pdfFiles = [];
  let exportedFile = 0;
  ordered.forEach((entry) => { entry.exportReihenfolge = null; });
  for (const entry of ordered.filter((item) => item.status === "vorhanden" && item.requiresFile !== false)) {
    entry.exportReihenfolge = ++exportedFile;
    const finalName = finalExportFileName({ ...entry, reihenfolge: entry.exportReihenfolge });
    const target = path.join(paths.finalPath, finalName);
    await fs.copyFile(await resolveProjectSource(rootDir, projekt, entry.dateipfad), target);
    pdfFiles.push({ sourcePath: target, entry });
    zipFiles.push({ sourcePath: target, zipPath: `${topChapterFolderName(entry, ordered)}/${finalName}` });
  }
  const completePdfPath = path.join(paths.finalPath, completeDocumentationFileName(projekt));
  const merged = await mergePdfFiles(completePdfPath, pdfFiles, layout.rows);
  if (merged.skipped.length || merged.pages !== summarizeExportEntries(ordered).pages) throw new Error("PDF-Quellen haben sich während des Exports verändert. Bitte Export erneut erzeugen.");
  const missing = ordered.filter((entry) => entry.requiresFile !== false && entry.status !== "vorhanden");
  const lines = ordered.map((entry) => `${entry.exportReihenfolge ? String(entry.exportReihenfolge).padStart(3, "0") : "---"} | ${entry.kapitel} | ${entry.titel} | ${entry.status} | Seite ${entry.startSeite || "-"} | ${entry.seiten || 0} Seite(n) | ${entry.dateipfad || "-"}`);
  if (missing.length) lines.push("", "NICHT ENTHALTENE DATEIEN:", ...missing.map((entry) => `- ${entry.kapitel} ${entry.titel}: ${entry.fehler || entry.status}`));
  if (toc.unzugeordneteDateien?.length) lines.push("", "NICHT ZUGEORDNETE EXTERNE PDFS:", ...toc.unzugeordneteDateien.map((file) => `- ${file}`));
  const orderFile = path.join(paths.finalPath, "EXPORT_REIHENFOLGE.txt");
  await fs.writeFile(orderFile, lines.join("\n") + "\n");
  zipFiles.push({ sourcePath: orderFile, zipPath: "00_Inhaltsverzeichnis/EXPORT_REIHENFOLGE.txt" });
  if (merged.targetPath) zipFiles.unshift({ sourcePath: merged.targetPath, zipPath: `00_Inhaltsverzeichnis/${path.basename(merged.targetPath)}` });
  const zipPath = path.join(paths.finalPath, `${fileSafeName(projekt.projektnummer || "Projekt")}_${fileSafeName(projekt.projektname || "edoku")}_Export.zip`);
  await writeZipFile(zipPath, zipFiles);
  return { ordered, completePdfPath: merged.targetPath, completePdfPages: merged.pages, skippedMergeFiles: merged.skipped, unassignedFiles: toc.unzugeordneteDateien || [], orderFile, zipPath, missingRequired: missing.filter((entry) => entry.pflicht).map((entry) => `${entry.kapitel} ${entry.titel}`), missingFiles: missing, summary: summarizeExportEntries(ordered) };
}

// Ein gescheiterter Export darf die letzte fertige Ausgabe nicht zerstören.
const finalOperations = new Map();
async function prepareFinalExport(rootDir,projekt,matrix,exportlistePath,options={}) {
  const live=await createProjectFolder(rootDir,projekt);
  const previous=finalOperations.get(live.projectPath)||Promise.resolve();
  const operation=previous.catch(()=>{}).then(async()=>{
    const working=await fs.mkdtemp(path.join(live.projectPath,'.final-'));
    const history=path.join(live.projectPath,'07_Vorherige_Exporte');
    const archived=path.join(history,new Date().toISOString().replace(/[:.]/g,'-')+'_'+require('crypto').randomUUID());
    let moved=false,published=false;
    try {
      const result=await buildFinalExport(rootDir,projekt,matrix,exportlistePath,{...options,finalPath:working});
      await assertSafePath(rootDir,history,{allowMissing:true});await fs.mkdir(history,{recursive:true});
      await fs.rename(live.finalPath,archived);moved=true;
      await fs.rename(working,live.finalPath);published=true;
      await writeJson(exportlistePath,result.ordered);
      const relocate=file=>file?path.join(live.finalPath,path.basename(file)):file;
      const {ordered,...answer}=result;
      return {...answer,completePdfPath:relocate(result.completePdfPath),orderFile:relocate(result.orderFile),zipPath:relocate(result.zipPath)};
    } catch(error) {
      if(published)await fs.rename(live.finalPath,working);
      if(moved)await fs.rename(archived,live.finalPath);
      throw error;
    } finally { await fs.rm(working,{recursive:true,force:true}); }
  });
  finalOperations.set(live.projectPath,operation);
  try{return await operation;}finally{if(finalOperations.get(live.projectPath)===operation)finalOperations.delete(live.projectPath);}
}

module.exports = { buildExportliste, prepareFinalExport, assignPageRanges, inspectPdf };
