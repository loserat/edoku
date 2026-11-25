const { z, id, pageQuery } = require('./schemas');
const kinds = ['penetration_seal', 'installation_duct', 'circuit_integrity', 'unknown'];
const guideQuery = pageQuery.extend({ jobId: id.optional(), listId: z.string().min(1).max(100).optional(), position: z.coerce.number().int().positive().optional(),
  manufacturer: z.string().trim().min(1).max(200).optional(), model: z.string().trim().min(1).max(200).optional(), kind: z.enum(kinds).optional(),
  section: z.enum(['summary', 'documents', 'questions', 'sources']).default('summary')
}).strict().superRefine((v, ctx) => {
  if (Boolean(v.listId) !== (v.position !== undefined)) ctx.addIssue({ code: 'custom', message: 'listId und position gemeinsam angeben.' });
  if (v.listId && (v.manufacturer || v.model)) ctx.addIssue({ code: 'custom', message: 'Bei Gerätebezug Hersteller/Modell aus dem Bestand nutzen.' });
});
const https = z.url().max(2000).refine(value => { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; });
const document = z.object({ kind: z.enum(kinds), stage: z.enum(['template', 'incomplete_draft', 'prepared']),
  installationBasis: z.enum(['confirmed', 'test_assumption', 'unknown']).default('unknown'), templateSourceUrl: https.optional(),
  templateSha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
}).strict().refine(v => v.stage !== 'prepared' || v.installationBasis === 'confirmed', 'Vorbereitete Bestätigung benötigt bestätigte Einbaugrundlage; Testannahmen bleiben Entwürfe.');
module.exports = { kinds, guideQuery, document };
