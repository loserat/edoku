const { z } = require("zod");

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const text = z.string().max(2000);
const projectFields = Object.fromEntries([
  "projektname", "projektnummer", "auftraggeber", "liegenschaft", "baumassnahme",
  "massnahmeNr", "auftragsNr", "auftragGewerk", "ortDerAusfuehrung",
  "ausfuehrendeFirma", "firmenanschrift", "bearbeiter", "ortDatum"
].map(name => [name, name === "projektname" ? text.trim().min(1) : text]));
const positionFields = Object.fromEntries([
  "hersteller", "system", "typ", "beschreibung", "abmessung", "farbe", "spannung",
  "leistung", "kategorie", "funktionserhalt", "lvPosition", "bemerkung"
].map(name => [name, text]));
const nonempty = schema => schema.refine(value => Object.keys(value).length > 0, "Mindestens ein Feld ist erforderlich.");
const projectPatch = nonempty(z.object({ ...projectFields, stockwerke: z.array(z.string().trim().min(1).max(100)).max(100) }).partial().strict());
const projectCreate = z.object({ ...projectFields, stockwerke: z.array(z.string().trim().min(1).max(100)).max(100) }).partial().extend({ projektname: projectFields.projektname }).strict();
const serviceAreaSelection = z.object({ active: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }).strict();
const documentSelection = z.object({ items: z.array(z.object({ id: z.string().min(1).max(100), active: z.boolean().optional(), export: z.boolean().optional() }).strict().refine(value => value.active !== undefined || value.export !== undefined)).min(1).max(500) }).strict();
const systemSelection = z.object({ items: z.array(z.object({ leistungsbereich: z.string().trim().min(1).max(200), selectionId: id.optional(), add: z.boolean().optional(), enabled: z.boolean().optional(), hersteller: z.string().trim().min(1).max(200).optional(), systemart: z.string().max(200).optional(), herstellerSystem: z.string().max(200).optional(), dokumentarten: z.array(z.string().max(200)).max(100).optional(), evidence: z.object({ sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(3000) }).strict().optional() }).strict()).min(1).max(10) }).strict();
const positionPatch = nonempty(z.object(positionFields).partial().strict());
const approvedDocumentLink = z.object({ attachmentId: id, devices: z.array(z.object({ listId: z.string().min(1).max(100), position: z.number().int().positive(), manufacturer: z.string().trim().min(1).max(200), model: z.string().trim().min(1).max(200), variant: z.string().max(2000).optional() }).strict()).min(1).max(100) }).strict();
const attachmentPatch = z.object({ title: z.string().trim().min(1).max(200).optional(), category: z.enum(["Anlagenbeschreibungen", "Betriebsanweisungen", "Nachweise", "Allgemein", "Brandschutz", "Stromlaufpläne", "Schaltpläne", "Installationspläne", "Schemata", "Messprotokolle", "Bedienungsanleitungen", "Datenblätter", "Fotos", "Pläne"]).optional(), stockwerk: z.string().max(100).optional(), anlage: z.string().max(200).optional() }).strict().refine(value => Object.keys(value).length > 0);
const scopes = ["projects:read", "projects:write", "devices:read", "devices:write", "documents:read", "assistant:read", "assistant:write", "exports:read", "exports:write"];
const exportJobInput = z.object({ assistantJobId: id.optional() }).strict();
const tokenInput = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(scopes)).min(1).max(scopes.length),
  projectIds: z.array(id).min(1).max(100).nullable().default(null),
  days: z.number().int().min(1).max(365).default(90)
}).strict();
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();
const systemCatalogQuery = pageQuery.extend({ serviceArea: z.string().trim().min(1).max(200).optional(), manufacturer: z.string().trim().min(1).max(200).optional() });
const sections = {
  "service-areas": "leistungsbereiche", systems: "projektSysteme", documents: "dokumentenmatrix",
  "firestops": "brandschutz", attachments: "anhaenge", exports: "exportliste"
};

module.exports = { z, id, projectCreate, projectPatch, positionPatch, approvedDocumentLink, attachmentPatch, serviceAreaSelection, documentSelection, systemSelection, systemCatalogQuery, exportJobInput, tokenInput, pageQuery, scopes, sections };
