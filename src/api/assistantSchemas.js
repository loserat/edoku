const { z, id } = require("./schemas");
const { DOCUMENT_ATTACHMENT_CATEGORIES } = require("../../services/documentAttachmentService");
const categories = [...new Set([...DOCUMENT_ATTACHMENT_CATEGORIES.map(entry => entry.category), "Nachweise", "Allgemein", "Fotos", "Brandschutz"])];
const deviceReference = z.object({ listId: z.string().min(1).max(100), position: z.number().int().positive(), manufacturer: z.string().trim().min(1).max(200), model: z.string().trim().min(1).max(200), revision: z.string().max(100).default(""), variant: z.string().max(2000).optional() }).strict();
const firestop = z.object({ role: z.enum(['declaration', 'manual', 'system_evidence']), systemKey: z.string().trim().min(1).max(100) }).strict();
const requirement = z.object({ id, title: z.string().trim().min(1).max(200), category: z.enum(categories), device: deviceReference.optional(), devices: z.array(deviceReference).min(1).max(100).optional(), dependsOn: z.array(require('./knowledgeSchemas').ref).max(20).optional().describe('Zusätzliche Voraussetzungen als konkrete Faktenziele. Keine Dateifreigabe oder Erfüllung.'), firestop: firestop.optional().describe('Brandschutzpflichten berechnet edoku automatisch; vorhandene Rollen und Systemkennungen erhalten.') }).strict().refine(value => !value.device || !value.devices, 'Einzelbezug und mehrere Gerätebezüge nicht gleichzeitig angeben.');
const jobInput = z.object({ instruction: z.string().trim().min(10).max(10000), requirements: z.array(requirement).max(100).default([]) }).strict();
const question = z.object({ id, prompt: z.string().trim().min(1).max(1000), required: z.boolean().default(true) }).strict();
const contextualQuestion = require('./workflowSchemas').contextQuestion;
const evidence = z.object({ sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(3000) }).strict();
const requirementCorrection = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), devices: z.array(deviceReference).min(1).max(100), category: z.enum(['Datenblätter','Bedienungsanleitungen']), evidence }).strict();
const answerInput = z.object({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  answers: z.array(z.object({ questionId: id, answer: z.string().trim().min(1).max(2000), evidence }).strict()).max(20).default([]),
  obsolete: z.array(z.object({ questionId: id, reason: z.string().trim().min(1).max(1000), evidence }).strict()).max(20).default([])
}).strict().refine(value => value.answers.length + value.obsolete.length > 0);
const projectDocument = z.object({ documentId: z.string().min(1).max(100).optional(), sections: z.array(z.object({ heading: z.string().trim().min(1).max(200), text: z.string().trim().min(1).max(6000) }).strict()).min(1).max(20), scope: z.enum(["internal", "documentation"]).default("internal").describe("internal (Standard) speichert nur intern und exportiert nicht. documentation übernimmt ausdrücklich in die Kundendokumentation.") }).strict().refine(value => value.scope !== "documentation" || Boolean(value.documentId), { message: "Für Kundendokumentation ist documentId erforderlich." });
const jobUpdate = z.object({
  status: z.enum(["queued", "working", "needs_info", "review"]).optional(),
  message: z.string().max(2000).optional(),
  questions: z.array(z.union([question, contextualQuestion])).max(20).optional(),
  requirements: z.array(requirement).max(100).optional()
}).strict().refine(value => Object.keys(value).length > 0);
const documentInput = z.object({
  fireProtectionDocument: require('./fireProtectionSchemas').document.optional().describe('Erklärungsstand im Brandschutz. Vorlage/Entwurf erfüllt keine Pflicht; Herkunft der ausgefüllten Originalvorlage dokumentieren.'),
  manufacturerPageUrl: z.url().max(2000).optional().describe('Offizielle Produkt- oder Brandschutzsystemseite des Herstellers, die exakt das angegebene PDF verlinkt. Für neue Datenblätter/Anleitungen verpflichtend.'),
  title: z.string().trim().min(1).max(200), category: z.enum(categories).describe("Passende Kategorie nach dem Dokumentinhalt wählen: technische Produktdaten als Datenblätter, Bedienungs-/Montageanleitungen als Bedienungsanleitungen. Wird in der Einzelprüfung vorausgewählt und zur Vorsortierung verwendet; der Benutzer kann sie korrigieren."),
  sourceUrl: z.string().max(2000).refine(value => { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }).optional(),
  sourceLabel: z.string().trim().min(1).max(300), reason: z.string().trim().min(1).max(2000),
  documentRevision: z.string().max(100).default(""),
  stockwerk: z.string().max(100).default(""), anlage: z.string().max(200).default(""),
  requirementIds: z.array(id).max(100).default([]),
  supersedes: z.array(id).max(20).default([]).describe("Nur veraltete, noch nicht freigegebene Vorschläge desselben Auftrags. Originale und Entscheidungen bleiben erhalten; die neue Datei benötigt eigene GUI-Freigabe."),
  expectedJobVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  projectDocument: projectDocument.optional(),
  deviceReferences: z.array(deviceReference).max(100).default([]).describe("Konkrete Gerätepositionen aus den gelesenen Projektlisten, einschließlich Brandschutzmaterial (keine erfundenen einzelnen Schotts). listId, Position, Hersteller und Modell müssen zum Bestand passen. Nicht eindeutig zuordenbare Geräte zuerst als Rückfrage klären. Gerätebezüge aus requirementIds werden ergänzt.")
}).strict();
const approvalInput = z.object({ title: z.string().trim().min(1).max(200), category: z.enum(categories), stockwerk: z.string().max(100).default(""), anlage: z.string().max(200).default(""), deviceReferences: z.array(deviceReference).max(100).optional() }).strict();
const prepareDocumentInput = documentInput.omit({ projectDocument: true, category: true, deviceReferences: true, fireProtectionDocument: true }).extend({ category: z.enum(["Anlagenbeschreibungen", "Betriebsanweisungen", "Nachweise", "Allgemein"]).optional(), content: projectDocument }).strict();
const replacementsInput = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), replacements: z.array(z.object({ previousId: id, replacementId: id }).strict()).min(1).max(20) }).strict();
const withdrawalInput = z.object({
  version: z.string().regex(/^[a-f0-9]{64}$/),
  proposalIds: z.array(id).min(1).max(10),
  reason: z.string().trim().min(3).max(1000),
  evidence
}).strict().describe('Offene Vorschläge mit tatsächlichem Beleg zurückziehen. Keine Freigabe, Ablehnung oder Erfüllung; Originale und Historie bleiben erhalten.');
module.exports = { categories, jobInput, jobUpdate, documentInput, approvalInput, requirement, deviceReference, requirementCorrection, answerInput, prepareDocumentInput, replacementsInput, withdrawalInput };
