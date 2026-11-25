const { z, id, pageQuery } = require('./schemas');
const states = ['research', 'needs_identity', 'pending', 'approved', 'ready_to_link', 'assignment_conflict', 'rejected', 'not_found', 'unsupported', 'blocked'];
const coverageQuery = pageQuery.extend({ status: z.enum(['all', 'open', ...states]).default('all') });
const searchInput = z.object({
  articleId: z.string().regex(/^article_[a-f0-9]{24}$/),
  outcome: z.enum(['not_found', 'needs_identity', 'blocked', 'retry']),
  reason: z.string().trim().min(10).max(1000),
  sources: z.array(z.string().max(2000).refine(value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  })).max(8).default([]),
  evidence: z.object({ sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(1000) }).strict()
}).strict().refine(value => !['not_found','blocked'].includes(value.outcome) || value.sources.length > 0, 'Ein Nichtfund benötigt geprüfte Quellen.');
const reference = z.object({ listId: z.string(), position: z.number().int().positive(), manufacturer: z.string(), model: z.string(), revision: z.string().optional(), variant: z.string().optional() });
const document = z.object({ id: id, title: z.string(), jobId: id.nullable(), url: z.string().nullable() });
const article = z.object({
  id: z.string(), manufacturer: z.string(), model: z.string(), variant: z.string(), description: z.string(),
  status: z.enum(states), references: z.array(reference), uncoveredReferences: z.array(reference),
  linkedPositions: z.number().int().nonnegative(), proposedPositions: z.number().int().nonnegative(),
  documents: z.array(document), reusable: z.array(document), rejected: z.array(document), withdrawn: z.array(document.extend({ reason: z.string() })).optional(),
  search: z.object({ outcome: z.string(), reason: z.string(), sources: z.array(z.string()), recordedAt: z.string() }).nullable()
});
const summary = z.object({ articles: z.number().int().nonnegative(), positions: z.number().int().nonnegative(), excludedPositions: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(), pending: z.number().int().nonnegative(), research: z.number().int().nonnegative(),
  readyToLink: z.number().int().nonnegative(), needsIdentity: z.number().int().nonnegative(), conflicts: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(), notFound: z.number().int().nonnegative(), unsupported: z.number().int().nonnegative(), blocked: z.number().int().nonnegative(), complete: z.boolean() });
const coverage = z.object({ materialExclusions: require('./materialPolicySchemas').exclusions.optional(), exclusionsTotal: z.number().int().nonnegative().optional(), exclusionsTruncated: z.boolean().optional(), projectId: id, revision: z.string().nullable(), inventorySource: z.literal('active_device_lists'), summary,
  items: z.array(article), total: z.number().int().nonnegative(), limit: z.number().int().positive().max(100), offset: z.number().int().nonnegative(),
  exclusions: z.array(z.object({ listId: z.string(), position: z.number(), reason: z.string() })) });
module.exports = { coverageQuery, searchInput, coverage, summary, states };
