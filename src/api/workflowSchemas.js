const { z, id, projectPatch, positionPatch, pageQuery } = require('./schemas');
const nextActionQuery = pageQuery.extend({ limit: z.coerce.number().int().min(1).max(10).default(3), jobId: id.optional(), view: z.enum(['full', 'compact']).default('compact'), sinceCheckpoint: z.string().regex(/^[a-f0-9]{64}$/).optional() });
const stages = ['project', 'materials', 'research', 'chapters', 'evidence', 'review', 'export'];
const questionTarget = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('material'),importId:id,rowId:id,field:z.literal('assignment')}).strict(),
  z.object({kind:z.literal('material_source'),importId:id.optional(),field:z.literal('source')}).strict(),
  z.object({ kind: z.literal('project'), field: z.enum(Object.keys(projectPatch.shape)) }).strict(),
  z.object({ kind: z.literal('device'), listId: z.string().min(1).max(100), position: z.number().int().positive(), field: z.enum(Object.keys(positionPatch.shape)) }).strict(),
  z.object({ kind: z.literal('requirement'), requirementId: id }).strict(),
  require('./knowledgeSchemas').ref.extend({ kind: z.literal('fact'), revision: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('structure'), resource: z.enum(['device_list', 'device_field', 'document_chapter', 'service_area']), requested: z.string().trim().min(1).max(200), listId: z.string().min(1).max(100).optional() }).strict()
]);
const contextQuestion = z.object({ id, prompt: z.string().trim().min(1).max(1000), required: z.boolean().default(true), stage: z.enum(stages), context: z.string().trim().min(1).max(500), targets: z.array(questionTarget).min(1).max(20) }).strict();
const askInput = z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), question: contextQuestion.optional(), questions: z.array(contextQuestion).min(1).max(3).optional().describe('Bis zu drei zusammengehörige Rückfragen atomar speichern; zusammen höchstens 4000 UTF-8-Bytes. Alternativ zu question.') }).strict()
 .refine(v => Boolean(v.question) !== Boolean(v.questions), 'Genau question oder questions übergeben.')
 .refine(v => !v.questions || Buffer.byteLength(JSON.stringify(v.questions)) <= 4000, 'Fragepaket ist zu groß; höchstens 4000 UTF-8-Bytes.');
const evidence = z.object({ sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(3000) }).strict();
const startInput = z.object({
  materialExclusions: require('./materialPolicySchemas').exclusions.optional().describe('Projektregeln: true nimmt die Gruppe aus Materialübernahme, Recherche und erzeugten Gerätelisten aus. Gespeicherte Daten/Freigaben bleiben erhalten. Explizite Regeln haben Vorrang vor excludeConsumables.'),
  jobId: id, documentScope: z.enum(['internal', 'documentation']).default('internal'), excludeConsumables: z.boolean().default(true), evidence,
  jobVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  requirementScopes: z.array(z.object({ id, scope: z.enum(['internal', 'documentation']) }).strict()).min(1).max(100).optional()
}).strict().refine(value => !value.requirementScopes || Boolean(value.jobVersion), 'Eine Änderung der Anforderungsablage benötigt die aktuelle Auftragsversion.');
const researchFields = ['system', 'abmessung', 'farbe', 'spannung', 'leistung', 'kategorie'];
const researchInput = z.object({
  listId: z.string().min(1).max(100), position: z.number().int().positive(),
  manufacturer: z.string().trim().min(1).max(200), model: z.string().trim().min(1).max(200),
  values: z.object(Object.fromEntries(researchFields.map(field => [field, z.string().trim().min(1).max(2000)]))).partial().strict().refine(value => Object.keys(value).length > 0),
  sourceUrl: z.string().max(2000).refine(value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }),
  evidence
}).strict();
module.exports = { stages, questionTarget, contextQuestion, askInput, startInput, researchFields, researchInput, nextActionQuery };
