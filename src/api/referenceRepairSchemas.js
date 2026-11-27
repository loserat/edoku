const { z } = require('./schemas');
const apply = z.object({
  previewToken: z.string().regex(/^[a-f0-9]{64}$/),
  evidence: z.object({ sourceLabel: z.string().trim().min(1).max(300), sourceQuote: z.string().trim().min(1).max(1000) }).strict()
}).strict();
module.exports = { apply };
