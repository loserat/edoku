const {z,id}=require('./schemas');
const target=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('device'),listId:z.string().min(1).max(100),position:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict(),
  z.object({kind:z.literal('document'),attachmentId:id}).strict(),
  z.object({kind:z.literal('job'),jobId:id}).strict()
]);
const evidence=z.object({sourceLabel:z.string().trim().min(1).max(300),sourceQuote:z.string().trim().min(1).max(1000)}).strict();
const confirmation=z.object({confirm:z.literal(true),reason:z.string().trim().min(3).max(500),evidence}).strict();
const deletionInput=confirmation.extend({previewCheckpoint:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const previewQuery=z.object({kind:z.enum(['device','document','job']),listId:z.string().min(1).max(100).optional(),position:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),attachmentId:id.optional(),jobId:id.optional()}).strict();
module.exports={target,confirmation,deletionInput,previewQuery};
