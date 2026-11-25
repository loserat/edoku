const { z, id, pageQuery } = require('./schemas');
const sections = ['summary', 'issues', 'questions', 'documents', 'requirements', 'outputs'];
const query = pageQuery.extend({
  assistantJobId: id.optional(),
  view: z.enum(['compact', 'full']).default('full'),
  section: z.enum(sections).default('summary'),
  entryId: id.optional()
}).strict().superRefine((value, ctx) => {
  if (value.entryId && (value.section !== 'requirements' || !value.assistantJobId))
    ctx.addIssue({ code: 'custom', message: 'entryId benötigt section=requirements und assistantJobId.' });
});
module.exports = { query, sections };
