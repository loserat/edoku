const { z, id } = require('./schemas');
const { input: work } = require('./documentWorkSchemas');
const detailQuery = z.object({ view:z.enum(['compact','full']).default('compact'), section:z.enum(['summary','questions','documents','requirements','instruction','message','question_history']).default('summary'), entryId:id.optional(), history:z.enum(['true','false']).default('false'), limit:z.coerce.number().int().min(1).max(10).default(3), offset:z.coerce.number().int().min(0).max(1000000).default(0) }).strict();
const evidence = z.object({ sourceLabel:z.string().trim().min(1).max(300), sourceQuote:z.string().trim().min(1).max(1000) }).strict();
const decisionInput = z.object({ jobVersion:z.string().regex(/^[a-f0-9]{64}$/), evidence,
  answers:z.array(z.object({ questionId:id, answer:z.string().trim().min(1).max(2000), disposition:z.enum(['confirmed','deferred','awaiting_user']), reason:z.string().trim().min(10).max(1000).optional(), resumeCondition:z.string().trim().min(1).max(500).optional() }).strict().refine(a=>a.disposition==='confirmed'||Boolean(a.reason),'Warten oder Zurückstellung benötigt einen Grund.')).max(10).default([]),
  decisions:z.array(z.object(Object.fromEntries(Object.entries(work.shape).filter(([key])=>!['jobVersion','evidence'].includes(key)))).strict()).max(10).default([]),
  facts:z.array(require('./knowledgeSchemas').fragment).max(10).default([])
}).strict().refine(v=>v.answers.length+v.decisions.length+v.facts.length>0,'Mindestens eine tatsächliche Entscheidung oder ein belegtes Fragment angeben.');
const projectView=z.object({view:z.enum(['compact','full']).default('compact')}).strict();
const decisionQuery=require('./schemas').pageQuery.extend({entryId:id.optional()});
module.exports={detailQuery,decisionInput,decisionQuery,projectView};
