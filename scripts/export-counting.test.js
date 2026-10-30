const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { PDFDocument, PDFName, PDFDict, PDFArray } = require("pdf-lib");
const { applyLogicalChapterNumbers } = require("../services/chapterNumberingService");
const { buildDocumentationPlan, numberMatrixForExport, summarizeExportEntries, estimateBinderCount } = require("../services/documentationPlanService");
const { buildExportPreview } = require("../services/exportPreviewService");
const { buildDashboardStats } = require("../services/dashboardService");
const { buildExportliste, prepareFinalExport } = require("../services/exportService");
const { generateDeckblaetter, generateGeraetelisten, generateInhaltsverzeichnis } = require("../services/pdfService");
const { createProjectFolder } = require("../services/projectService");
const settings = { lizenz: { brandingAktiv: false } };
const doc = (id, kapitel, extra = {}) => ({ id, kapitel, titel: id, aktiv: true, export: true, sortierung: kapitel.split(".").reduce((n, p, i) => n + Number(p) * (i ? 10 : 1000), 0), ...extra });
const attachment = (id, extra = {}) => ({ id, title: id, relativePath: `${id}.pdf`, mimeType: "application/pdf", category: "Stromlaufpläne", kapitel: "12.1", ...extra });
const device = (id, extra = {}) => ({ id, kapitel: "6.4", titel: `Geräteliste ${id}`, leistungsbereich: "Elektroinstallation / DIN VDE 0100", aktiv: true, export: true, positionen: [{ pos: 1, beschreibung: "Testgerät" }], ...extra });
async function pdf(file, pages = 1, title = "Künstliche Prüfdaten") {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) document.addPage().drawText(`${title} - ${i + 1}/${pages}`, { x: 48, y: 740, size: 12 });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await document.save());
}
function unique(plan) {
  const chapters = plan.map((entry) => entry.displayKapitel);
  assert.equal(new Set(chapters).size, chapters.length);
  for (const entry of plan) if (entry.parentId) {
    const parent = plan.find((candidate) => candidate.id === entry.parentId);
    assert.ok(parent && entry.displayKapitel.startsWith(parent.displayKapitel + "."));
  }
}

test("Fehlende Eltern und doppelte Originalkapitel bleiben eindeutig", () => {
  const input = [doc("orphan", "4.1"), doc("root", "5"), doc("a", "5.1"), doc("b", "5.1")];
  const before = JSON.stringify(input);
  const result = applyLogicalChapterNumbers(input, { exportOnly: true });
  assert.deepEqual(result.map((entry) => entry.displayKapitel), ["1.1", "2", "2.1", "2.2"]);
  assert.equal(JSON.stringify(input), before);
});

test("Importe teilen sich den Zähler mit vorhandenen Unterkapiteln", () => {
  const matrix = [doc("root", "12", { dokumenttyp: "Kapitel" }), doc("group", "12.1", { ebene: 2, dokumenttyp: "Plan", formularart: "Dateiliste" }), doc("existing", "12.1.1")];
  const plan = buildDocumentationPlan(matrix, [], [attachment("import")]);
  unique(plan);
  assert.equal(plan.find((entry) => entry.attachmentId).displayKapitel, "1.1.2");
  assert.equal(plan.find((entry) => entry.id === "group").requiresFile, false);
});

test("Abgewählte Dokumente verbrauchen keine Nummer; notwendige Vorfahren bleiben", () => {
  const matrix = [doc("root", "2", { dokumenttyp: "Kapitel" }), doc("off", "2.1", { export: false }), doc("on", "2.7"), doc("second", "2.7")];
  const plan = buildDocumentationPlan(matrix);
  assert.deepEqual(plan.map((entry) => entry.displayKapitel), ["1", "1.1", "1.2"]);
  const numbered = numberMatrixForExport(matrix);
  assert.equal(numbered.find((entry) => entry.id === "off").displayKapitel, "");
  assert.equal(numbered.find((entry) => entry.id === "second").displayKapitel, "1.2");
});

test("Mehrere Gerätelisten erhalten eigene Kapitel und eine Strukturüberschrift", () => {
  const plan = buildDocumentationPlan([doc("root", "6", { dokumenttyp: "Kapitel" }), doc("group", "6.4", { quelle: "data/geraetelisten.json" })], [device("a"), device("b")]);
  unique(plan);
  assert.equal(plan.filter((entry) => entry.deviceListId).length, 2);
  assert.equal(plan.find((entry) => entry.id === "group").requiresFile, false);
  assert.deepEqual(plan.filter((entry) => entry.deviceListId).map((entry) => entry.displayKapitel), ["1.1.1", "1.1.2"]);
});

test("Leere Leistungsbereichsauswahl exportiert keine Gerätelisten", () => {
  assert.equal(buildDocumentationPlan([], [device("a")], [], { aktiv: [] }).filter((entry) => entry.deviceListId).length, 0);
});

test("Stockwerke werden natürlich und bei Vorgaben in Projektreihenfolge sortiert", () => {
  const imports = ["DG", "5. OG", "EG", "UG", "1. OG"].map((stockwerk) => attachment(stockwerk, { stockwerk }));
  const natural = buildDocumentationPlan([], [], imports).filter((entry) => entry.attachmentId);
  assert.deepEqual(natural.map((entry) => entry.attachmentId), ["UG", "EG", "1. OG", "5. OG", "DG"]);
  const configured = buildDocumentationPlan([], [], imports, {}, { stockwerke: ["DG", "EG"] }).filter((entry) => entry.attachmentId);
  assert.deepEqual(configured.slice(0, 2).map((entry) => entry.attachmentId), ["DG", "EG"]);
});

test("Status gleicher Originalkapitel überschreibt keine andere Datei", () => {
  const preview = buildExportPreview({ exportliste: [{ kapitel: "1.1", originalKapitel: "2.7", titel: "A", status: "vorhanden", seiten: 3 }, { kapitel: "1.2", originalKapitel: "2.7", titel: "B", status: "fehlt" }] });
  assert.equal(preview.stats.vorhandeneDateien, 1);
  assert.equal(preview.stats.fehlendeDateien, 1);
  assert.equal(preview.stats.seiten, 3);
});

test("Überschriften werden nicht als fehlende Dateien gezählt; Ordner folgen Seiten", () => {
  const entries = [{ requiresFile: false, status: "struktur" }, { status: "vorhanden", seiten: 160 }, { status: "vorhanden", seiten: 1 }, { status: "fehlerhaft", pflicht: true }];
  const count = summarizeExportEntries(entries);
  assert.equal(count.files, 3);
  assert.equal(count.invalid, 1);
  assert.equal(count.requiredMissing, 1);
  assert.equal(estimateBinderCount(entries, 80), 3);
  assert.equal(estimateBinderCount([{ status: "vorhanden", seiten: 1700 }]), 22);
});

test("Dashboard zeigt unbekannte Pflichtdateien offen und zählt sie nicht doppelt", () => {
  const stats = buildDashboardStats({ projekt: { projektname: "Test" }, leistungsbereiche: { aktiv: [] }, matrix: [doc("root", "2", { dokumenttyp: "Kapitel", pflicht: true })], geraetelisten: [], brandschutz: [{ aktiv: true }], exportliste: [] });
  assert.ok(stats.dokumente.fehlendePflicht > 0);
  assert.ok(stats.completion.percent < 100);
  assert.equal(stats.completion.checks.find((check) => check.label === "Brandschutz").applicable, false);
  assert.equal(stats.completion.total, stats.completion.checks.filter((check) => !check.informational).reduce((sum, check) => sum + check.total, 0));
});

async function mixedFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-export-test-"));
  const project = { projektname: "Kapitel-Prüfprojekt - Beispieldaten", projektnummer: "TEST-001", stockwerke: ["UG", "EG", "1. OG"] };
  const matrix = [doc("devices", "6", { titel: "Gerätelisten", dokumenttyp: "Kapitel" }), doc("devicegroup", "6.4", { titel: "Elektroinstallation", quelle: "data/geraetelisten.json" }), doc("measure", "10", { titel: "Messprotokolle", dokumenttyp: "Kapitel" }), doc("report", "10.1", { titel: "Prüfbericht" }), doc("plans", "12", { titel: "Bestandspläne", dokumenttyp: "Kapitel" }), doc("plangroup", "12.1", { titel: "Stromlaufpläne", ebene: 2, dokumenttyp: "Plan", formularart: "Dateiliste" }), doc("existing", "12.1.1", { titel: "Vorhandener Plan" })];
  const lists = [device("a"), device("b")];
  const attachments = [attachment("plan-ug", { stockwerk: "UG", relativePath: "imports/ug.pdf" }), attachment("plan-eg", { stockwerk: "EG", relativePath: "imports/eg.pdf" }), attachment("manual", { title: "Bedienungsanleitung", category: "Bedienungsanleitungen", kapitel: "3.2", relativePath: "imports/manual.pdf" })];
  lists[0].positionen[0].bedienungsanleitungId = "manual";
  await pdf(path.join(root, "imports/ug.pdf"), 2);
  await pdf(path.join(root, "imports/eg.pdf"), 3);
  await pdf(path.join(root, "imports/manual.pdf"), 4);
  const paths = await createProjectFolder(root, project);
  await pdf(path.join(paths.configPath, "10_Messprotokolle/10_1_Pruefbericht.pdf"), 3);
  await pdf(path.join(paths.configPath, "12_Bestandsplaene/12_1_1_Vorhandener_Plan.pdf"), 1);
  await generateInhaltsverzeichnis(root, project, matrix, settings, lists, attachments);
  await generateDeckblaetter(root, project, matrix, settings, lists, attachments);
  await generateGeraetelisten(root, project, lists, settings, matrix, {}, attachments);
  const exportPath = path.join(root, "exportliste.json");
  const entries = await buildExportliste(root, project, matrix, exportPath, [], attachments, lists);
  return { root, project, matrix, lists, attachments, paths, exportPath, entries };
}

test("PDFs, mehrseitige Anhänge und Gerätelisten haben denselben Plan", async () => {
  const f = await mixedFixture();
  const count = summarizeExportEntries(f.entries);
  assert.equal(count.missing, 0, JSON.stringify(f.entries.filter((entry) => entry.status === "fehlt")));
  assert.equal(f.entries.filter((entry) => entry.deviceListId && entry.status === "vorhanden").length, 2);
  assert.equal(f.entries.find((entry) => entry.attachmentId === "manual").seiten, 4);
  assert.equal(new Set(f.entries.map((entry) => entry.kapitel)).size, f.entries.length);
  const result = await prepareFinalExport(f.root, f.project, f.matrix, f.exportPath, { systemSettings: settings });
  assert.equal(result.missingRequired.length, 0);
  const merged = await PDFDocument.load(await fs.readFile(result.completePdfPath));
  const finalEntries = JSON.parse(await fs.readFile(f.exportPath));
  assert.equal(merged.getPageCount(), summarizeExportEntries(finalEntries).pages);
  for (const entry of finalEntries.filter((entry) => entry.requiresFile && entry.status === "vorhanden")) assert.equal(entry.endeSeite - entry.startSeite + 1, entry.seiten);
  const preview = buildExportPreview({ exportliste: finalEntries });
  assert.equal(preview.stats.vorhandeneDateien, result.summary.present);
  assert.equal(preview.stats.seiten, result.completePdfPages);
  const stats = buildDashboardStats({ projekt: f.project, leistungsbereiche: {}, matrix: f.matrix, geraetelisten: f.lists, anhaenge: f.attachments, brandschutz: [], exportliste: finalEntries });
  assert.equal(stats.export.gesamt, result.summary.files);
  assert.equal(stats.export.seiten, result.completePdfPages);
  await fs.mkdir(path.join(__dirname, "../output/pdf"), { recursive: true });
  await fs.copyFile(result.completePdfPath, path.join(__dirname, "../output/pdf/Kapitelpruefung_Beispieldaten.pdf"));
  await fs.mkdir(path.join(__dirname, "../output/counting-review"), { recursive: true });
  await fs.writeFile(path.join(__dirname, "../output/counting-review/mixed-result.json"), JSON.stringify({ root: f.root, inputs: { project: f.project, matrix: f.matrix, lists: f.lists, attachments: f.attachments }, ...result, entries: finalEntries }, null, 2));
});

test("Alte PDFs abgewählter Dokumente zählen nicht mit; Dateiquellen nur einmal", async () => {
  const f = await mixedFixture();
  const updated = await buildExportliste(f.root, f.project, f.matrix.map((entry) => entry.id === "report" ? { ...entry, export: false } : entry), f.exportPath, [], f.attachments, f.lists);
  assert.ok(!updated.some((entry) => entry.id === "report"));
  const paths = updated.filter((entry) => entry.status === "vorhanden").map((entry) => entry.dateipfad);
  assert.equal(paths.length, new Set(paths).size);
});

test("Nicht lesbare Anhänge werden gemeldet und verbrauchen keine PDF-Seiten", async () => {
  const f = await mixedFixture();
  await fs.writeFile(path.join(f.root, "imports/eg.pdf"), "Kein PDF");
  const entries = await buildExportliste(f.root, f.project, f.matrix, f.exportPath, [], f.attachments, f.lists);
  assert.equal(entries.find((entry) => entry.attachmentId === "plan-eg").status, "fehlerhaft");
  const result = await prepareFinalExport(f.root, f.project, f.matrix, f.exportPath, { systemSettings: settings });
  assert.equal(result.missingFiles.length, 1);
  assert.equal(result.completePdfPages, result.summary.pages);
  assert.match(await fs.readFile(result.orderFile, "utf8"), /NICHT ENTHALTENE DATEIEN/);
});

test("Mehrseitiges Inhaltsverzeichnis: Seitenzahlen und gemessene Sprungflächen stimmen", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-toc-test-"));
  const project = { projektname: "Lange Titel - Beispieldaten", projektnummer: "TEST-002" };
  const matrix = [doc("root", "1", { titel: "Prüfunterlagen", dokumenttyp: "Kapitel" }), ...Array.from({ length: 55 }, (_, i) => doc(`leaf-${i}`, `1.${i + 1}`, { titel: `Prüfdokument ${i + 1} mit einer ausführlichen Beschreibung zur Prüfung mehrzeiliger Kapitelüberschriften und korrekter Seitenwechsel im Inhaltsverzeichnis`, sortierung: 1000 + i + 1 }))];
  const paths = await createProjectFolder(root, project);
  for (let i = 0; i < 55; i += 1) await pdf(path.join(paths.configPath, `01_Betriebskarteien/1_${i + 1}_Pruefdokument.pdf`), i === 54 ? 3 : 1, `Dokument ${i + 1}`);
  await generateInhaltsverzeichnis(root, project, matrix, settings);
  await generateDeckblaetter(root, project, matrix, settings);
  const exportPath = path.join(root, "exports.json");
  await buildExportliste(root, project, matrix, exportPath);
  const result = await prepareFinalExport(root, project, matrix, exportPath, { systemSettings: settings });
  const entries = JSON.parse(await fs.readFile(exportPath));
  const toc = entries[0];
  assert.ok(toc.seiten > 1);
  assert.equal(result.missingFiles.length, 0);
  const layout = JSON.parse(await fs.readFile(path.join(root, toc.dateipfad) + ".layout.json"));
  const merged = await PDFDocument.load(await fs.readFile(result.completePdfPath));
  assert.equal(merged.getPageCount(), result.summary.pages);
  let checked = 0;
  for (const row of layout.rows) {
    const entry = entries.find((item) => item.id === row.id);
    assert.equal(row.startSeite, entry.startSeite);
    const page = merged.getPage(row.pageIndex);
    const annotations = page.node.Annots();
    let matched = false;
    for (let i = 0; i < (annotations?.size() || 0); i += 1) {
      const annotation = merged.context.lookup(annotations.get(i), PDFDict);
      const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
      if (!action || String(action.get(PDFName.of("S"))) !== "/GoTo") continue;
      const rect = annotation.lookup(PDFName.of("Rect"), PDFArray).asArray().map((n) => n.asNumber());
      if (Math.abs(rect[3] - (page.getHeight() - row.y)) > .01) continue;
      const destination = action.lookup(PDFName.of("D"), PDFArray).get(0);
      assert.equal(String(destination), String(merged.getPage(entry.startSeite - 1).ref));
      matched = true; checked += 1; break;
    }
    assert.ok(matched, row.kapitel);
  }
  assert.equal(checked, layout.rows.length);
  await fs.writeFile(path.join(__dirname, "../output/counting-review/long-toc-result.json"), JSON.stringify({ root, tocPages: toc.seiten, totalPages: result.completePdfPages, checkedLinks: checked, pdf: result.completePdfPath }, null, 2));
});


test("Nicht zuordenbare externe PDFs werden ausdrücklich ausgewiesen", async () => {
  const f = await mixedFixture();
  await pdf(path.join(f.paths.configPath, "10_Messprotokolle/Unbekannter_Nachweis.pdf"), 2);
  const entries = await buildExportliste(f.root, f.project, f.matrix, f.exportPath, [], f.attachments, f.lists);
  assert.equal(entries[0].unzugeordneteDateien.length, 1);
  const result = await prepareFinalExport(f.root, f.project, f.matrix, f.exportPath, { systemSettings: settings });
  assert.equal(result.unassignedFiles.length, 1);
  assert.match(await fs.readFile(result.orderFile, "utf8"), /NICHT ZUGEORDNETE EXTERNE PDFS/);
});

test("Vollständige vorhandene Demostruktur: jede erzeugte PDF ist genau einmal zugeordnet", async () => {
  const read = async (name) => JSON.parse(await fs.readFile(path.join(__dirname, "..", name), "utf8"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-default-test-"));
  const project = { ...await read("data/projekt.json"), projektname: "Generatortest - Beispieldaten", projektnummer: "TEST-003" };
  const matrix = await read("data/dokumentenmatrix.json");
  const lists = await read("data/geraetelisten.json");
  const areas = await read("data/leistungsbereiche.json");
  const systems = await read("data/systeme.json");
  const selectedSystems = await read("data/projektSysteme.json");
  const templates = await read("config/formularTemplates.json");
  const { generateFormularPdfs, generateBrandschutzPdf } = require("../services/pdfService");
  const generated = [
    ...await generateInhaltsverzeichnis(root, project, matrix, settings, lists, [], areas),
    ...await generateFormularPdfs(root, project, matrix, areas, systems, selectedSystems, templates, settings, lists, []),
    ...await generateDeckblaetter(root, project, matrix, settings, lists, [], areas),
    ...await generateGeraetelisten(root, project, lists, settings, matrix, areas),
    ...await generateBrandschutzPdf(root, project, [], settings, matrix, lists, areas)
  ];
  const entries = await buildExportliste(root, project, matrix, path.join(root, "exports.json"), selectedSystems, [], lists, areas);
  const present = entries.filter((entry) => entry.status === "vorhanden");
  assert.equal(new Set(present.map((entry) => entry.dateipfad)).size, present.length);
  for (const file of generated) assert.ok(present.some((entry) => path.join(root, entry.dateipfad) === file), path.basename(file));
  assert.equal(present.length, generated.length);
});


test("Alte generierte PDFs werden nach Kapitelverschiebungen nicht falsch zugeordnet", async () => {
  const f = await mixedFixture();
  const changed = f.matrix.map((entry) => entry.id === "devices" ? { ...entry, id: "other-devices", titel: "Andere Unterlagen" } : entry);
  const entries = await buildExportliste(f.root, f.project, changed, f.exportPath, [], f.attachments, f.lists);
  assert.equal(entries.find((entry) => entry.id === "other-devices").status, "veraltet");
  assert.ok(summarizeExportEntries(entries).invalid >= 1);
});


test("Fremde PDF-Metadaten verändern die Lesbarkeit und Seitenzahl nicht", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edoku-metadata-test-"));
  const file = path.join(root, "external.pdf");
  const document = await PDFDocument.create(); document.addPage(); document.setSubject("null");
  await fs.writeFile(file, await document.save());
  const { inspectPdf } = require("../services/exportService");
  const result = await inspectPdf(file);
  assert.equal(result.status, "vorhanden"); assert.equal(result.seiten, 1);
});


test("Strukturüberschriften verbrauchen keine Dateinummer; finale Dateien sind lückenlos", async () => {
  const f = await mixedFixture();
  const files = f.entries.filter((entry) => entry.requiresFile);
  assert.deepEqual(files.map((entry) => entry.reihenfolge), Array.from({ length: files.length }, (_, i) => i + 1));
  assert.ok(f.entries.filter((entry) => !entry.requiresFile).every((entry) => entry.reihenfolge === null));
  const result = await prepareFinalExport(f.root, f.project, f.matrix, f.exportPath, { systemSettings: settings });
  const copied = (await fs.readdir(f.paths.finalPath)).filter((name) => /^\d{3}_.*\.pdf$/.test(name)).sort();
  assert.equal(copied.length, result.summary.present);
  assert.deepEqual(copied.map((name) => Number(name.slice(0, 3))), Array.from({ length: copied.length }, (_, i) => i + 1));
});
