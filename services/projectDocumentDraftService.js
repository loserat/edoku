const PDFDocument = require("pdfkit");
const { loadProjectWorkspace } = require("./projectWorkspaceService");
const { prepareDocumentInput } = require("../src/api/assistantSchemas");
const { parse, fault } = require("../src/api/validation");
const store = require("./projectDataStoreService");

async function prepareProjectDocument(root, assistant, userId, projectId, jobId, etag, input) {
  const data = parse(prepareDocumentInput, input);
  const revision = store.projectDataRevision(root, userId, projectId);
  if (!etag) throw fault("If-Match ist erforderlich.", 428, "PRECONDITION_REQUIRED");
  if (etag !== `"${revision}"`) throw fault("Projekt wurde geändert. Neu lesen.", 412, "PRECONDITION_FAILED");
  if (assistant.job(userId, jobId).project_id !== projectId) throw fault("Auftrag wurde nicht gefunden.", 404, "NOT_FOUND");
  const workspace = await loadProjectWorkspace(root, userId, projectId);
  const target = data.content.documentId ? workspace.matrix.find(entry => entry.id === data.content.documentId && entry.aktiv && (data.content.scope !== "documentation" || entry.export) && entry.formularart === "Text") : null;
  if ((data.content.documentId && !target) || (data.content.scope === "documentation" && !target)) throw fault("Aktives Textkapitel wurde nicht gefunden.", 409, "DOCUMENT_TARGET_CHANGED");
  const category = data.category || (target && (target.dokumenttyp === "Anlagenbeschreibung" || /Anlagenbeschreibung/.test(target.titel)) ? "Anlagenbeschreibungen" : "Betriebsanweisungen");
  const { content, ...metadata } = data;
  const pdf = new PDFDocument({ size: "A4", margins: { top: 90, left: 48, right: 48, bottom: 48 }, bufferPages: true, info: { Title: data.title, Author: "edoku" } });
  const chunks = [];
  const bytes = new Promise((resolve, reject) => { pdf.on("data", chunk => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
  pdf.fillColor("#142438").font("Helvetica-Bold").fontSize(20).text(data.title).moveDown(0.5);
  pdf.font("Helvetica").fontSize(9).text(`${target ? `Kapitel: ${target.titel}` : "Interne Projektunterlage"} | Revision: ${data.documentRevision || "Entwurf"}`);
  pdf.text("Vorbereitet zur manuellen Sichtung. Keine Bestätigung einer Prüfung oder Abnahme.").moveDown();
  for (const section of content.sections) {
    if (pdf.y > pdf.page.height - 120) pdf.addPage();
    pdf.font("Helvetica-Bold").fontSize(12).fillColor("#142438").text(section.heading).moveDown(0.3);
    pdf.font("Helvetica").fontSize(10).text(section.text, { lineGap: 3 }).moveDown();
  }
  pdf.font("Helvetica").fontSize(8).fillColor("#52657b").text(`Quelle: ${data.sourceLabel}`);
  const pages = pdf.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    pdf.switchToPage(i); const bottom = pdf.page.margins.bottom; pdf.page.margins.bottom = 0;
    pdf.fillColor("#2459b7").font("Helvetica-Bold").fontSize(11).text("edoku | Dokumententwurf", 48, 30, { lineBreak: false });
    pdf.fillColor("#52657b").font("Helvetica").fontSize(9).text([workspace.projekt.projektnummer, workspace.projekt.projektname, workspace.projekt.liegenschaft].filter(Boolean).join(" | "), 48, 48, { width: 499, height: 30, ellipsis: true });
    pdf.font("Helvetica").fontSize(8).fillColor("#52657b").text(`ENTWURF | ${data.documentRevision || ""} | Seite ${i + 1} / ${pages.count}`, 48, pdf.page.height - 30, { lineBreak: false });
    pdf.page.margins.bottom = bottom;
  }
  pdf.end(); const buffer = await bytes;
  store.assertProjectRevision(root, userId, projectId, revision);
  return assistant.propose(userId, jobId, { ...metadata, category, projectDocument: content }, { originalName: `${target?.id || "intern"}_${data.documentRevision || "Entwurf"}.pdf`, buffer });
}
module.exports = { prepareProjectDocument };
