const {z,id}=require('./schemas');
const resetInput=z.object({previewCheckpoint:z.string().regex(/^[a-f0-9]{64}$/),confirm:z.literal(true),confirmProjectId:id,confirmProjectNumber:z.string().max(2000),evidence:z.object({sourceLabel:z.string().trim().min(1).max(300),sourceQuote:z.string().trim().min(1).max(1000)}).strict()}).strict();
module.exports={resetInput};
