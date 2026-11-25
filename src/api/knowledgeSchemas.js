const { z, id, projectPatch, positionPatch } = require('./schemas');
const keys = [...new Set([...Object.keys(projectPatch.shape), ...Object.keys(positionPatch.shape), 'manufacturer', 'model', 'variant', 'approval', 'zulassung', 'fireResistanceMinutes', 'components', 'medium', 'wallType', 'wallThicknessMm', 'openingWidthMm', 'openingHeightMm', 'sealDepthMm', 'installationLocation', 'installationDate', 'ausfuehrungsdatum', 'quantity', 'identifier', 'fireProtectionKind', 'installationStatus', 'mountingType', 'installedLengthMm', 'functionalityClass', 'unassigned'])];
const subject = z.object({ kind: z.enum(['project','device','requirement','firestop']), listId: z.string().min(1).max(100).optional(), position: z.number().int().positive().optional(), requirementId: id.optional(), entryId: id.optional() }).strict().superRefine((value, ctx) => {
  const fields = {project:[],device:['listId','position'],requirement:['requirementId'],firestop:['entryId']}[value.kind];
  if(fields.some(key => value[key] === undefined) || Object.keys(value).some(key => key !== 'kind' && !fields.includes(key))) ctx.addIssue({code:'custom',message:'Faktenziel benötigt genau die Kennungen seiner Zielart.'});
});
// Keep the paginated MCP catalogue below its existing byte limit; membership is
// still enforced by Zod rather than duplicating a long enum in every tool schema.
const factKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/).refine(key => keys.includes(key), 'Unbekannter Faktenschlüssel; das vom edoku-Plan gelieferte Ziel verwenden.');
const ref = z.object({ subject, key: factKey }).strict();
const fragment = ref.extend({
  status: z.enum(['confirmed', 'inferred', 'unknown', 'ambiguous', 'deferred']),
  value: z.union([z.string().trim().min(1).max(300), z.number().finite(), z.array(z.string().trim().min(1).max(100)).min(1).max(10)]).optional(),
  origin: z.enum(['user', 'research']).default('user'),
  sourceUrl: z.url().max(1000).refine(url => { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; }).optional(),
  supersedes: z.array(id).max(10).default([]),
  reason: z.string().trim().min(10).max(400).optional(),
  replaceStored: z.boolean().default(false)
}).strict().superRefine((v, ctx) => {
  const bad = message => ctx.addIssue({ code: 'custom', message });
  if (['confirmed', 'inferred'].includes(v.status) && v.value === undefined) bad('Ein zugeordneter Fakt benötigt einen Wert.');
  if (v.key === 'fireProtectionKind' && v.value !== undefined && !require('./fireProtectionSchemas').kinds.includes(v.value)) bad('Unbekannte Brandschutzart.');
  if (v.key === 'installationStatus' && v.value !== undefined && !['confirmed', 'test_assumption', 'unknown'].includes(v.value)) bad('Unbekannte Einbaugrundlage.');
  if (v.key === 'installationStatus' && v.status === 'confirmed' && v.value !== 'confirmed') bad('Testannahme oder unbekannter Einbau darf nicht als bestätigt gespeichert werden.');
  if (v.key === 'unassigned' && !['ambiguous', 'unknown', 'deferred'].includes(v.status)) bad('Unzugeordnete Angaben dürfen nicht als bestätigt gelten.');
  if (/Mm$|Minutes$/.test(v.key) && v.status === 'confirmed' && (typeof v.value !== 'number' || v.value <= 0)) bad('Bestätigte Maße in mm und Dauer in Minuten als positive Zahl angeben.');
  const nativeKey={manufacturer:'hersteller',model:'typ',installationLocation:'ortDerAusfuehrung'}[v.key]||v.key;
  const native=projectPatch.shape[nativeKey]||positionPatch.shape[nativeKey];
  if(v.status==='confirmed'&&native&&!native.safeParse(v.value).success)bad('Der bestätigte Wert passt nicht zum vorhandenen edoku-Feldtyp.');
  if(v.status==='confirmed'&&v.key==='quantity'&&(typeof v.value!=='number'||!Number.isInteger(v.value)||v.value<1))bad('Bestätigte Anzahl als positive ganze Zahl angeben.');
  if(v.status==='confirmed'&&!/Mm$|Minutes$/.test(v.key)&&!['quantity','components','stockwerke','unassigned'].includes(v.key)&&typeof v.value!=='string')bad('Bestätigte Bezeichnungen als Text angeben.');
  if(v.status==='confirmed'&&['installationDate','ausfuehrungsdatum'].includes(v.key)&& (typeof v.value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.value)||Number.isNaN(Date.parse(v.value))||new Date(v.value).toISOString().slice(0,10)!==v.value))bad('Bestätigtes Einbaudatum als tatsächliches gültiges Datum YYYY-MM-DD angeben.');
  if (v.origin === 'research' && (!['inferred','unknown'].includes(v.status) || !v.sourceUrl || (v.status==='unknown'&&!v.reason))) bad('Recherchefragmente benötigen eine Quelle: Treffer bleiben inferred, ungeklärte Ergebnisse unknown mit Begründung; kein Einbaunachweis.');
  if ((v.supersedes.length || v.replaceStored) && (v.status !== 'confirmed' || !v.reason || v.origin !== 'user')) bad('Eine Korrektur benötigt bestätigten Benutzerbeleg und Begründung.');
});
const query = z.object({ section: z.enum(['summary', 'facts', 'dependencies', 'questions', 'history', 'schema']).default('summary'), factId: id.optional(), limit: z.coerce.number().int().min(1).max(10).default(3), offset: z.coerce.number().int().min(0).max(1000000).default(0) }).strict();
module.exports = { subject, ref, fragment, query, keys };
