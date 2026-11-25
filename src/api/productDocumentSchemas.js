const {z}=require('./schemas');
const {documentInput}=require('./assistantSchemas');
const manufacturerDocumentInput=z.object({mode:z.enum(['check','propose']).default('propose'),metadata:documentInput.omit({projectDocument:true})}).strict();
module.exports={manufacturerDocumentInput};
