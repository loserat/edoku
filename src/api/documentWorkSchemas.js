const { z, id, pageQuery } = require('./schemas');
const target = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('requirement'), requirementId: id }).strict(),
  z.object({ kind: z.literal('question'), questionId: id }).strict()
]);
const states = ['not_found', 'awaiting_manufacturer', 'awaiting_user', 'deferred', 'unsuitable', 'resume'];
const input = z.object({
  jobVersion: z.string().regex(/^[a-f0-9]{64}$/), target, state: z.enum(states),
  reason: z.string().trim().min(10).max(1000),
  sources: z.array(z.string().max(2000).refine(value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } })).max(8).default([]),
  evidence: z.object({ kind: z.enum(['research', 'user']), sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(1000) }).strict(),
  proposalId: id.optional(), resumeCondition: z.string().trim().min(1).max(500).optional()
}).strict().superRefine((value, ctx) => {
  const invalid = message => ctx.addIssue({ code: 'custom', message });
  if (value.state === 'not_found' && !value.sources.length) invalid('Ein Nichtfund benötigt geprüfte Quellen.');
  if (['deferred', 'unsuitable'].includes(value.state) && value.evidence.kind !== 'user') invalid('Diese Entscheidung benötigt einen tatsächlichen Benutzerbeleg.');
  if (value.state === 'unsuitable' && (!value.proposalId || value.target.kind !== 'requirement')) invalid('Unpassender Inhalt benötigt einen abgelehnten Vorschlag zur Anforderung.');
  if (value.proposalId && value.state !== 'unsuitable') invalid('Vorschlag nur bei dokumentierter Ablehnung angeben.');
});
const query = pageQuery.extend({ history: z.enum(['true', 'false']).default('false'),
  view: z.enum(['compact', 'full']).default('full'), requirementId: id.optional(), questionId: id.optional(), state: z.enum(states).optional()
}).strict().refine(value => !value.requirementId || !value.questionId, 'requirementId und questionId nicht gleichzeitig angeben.');
module.exports = { input, query, states };
