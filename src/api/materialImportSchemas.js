const {z,id,pageQuery}=require('./schemas');
const candidate=z.object(Object.fromEntries(['hersteller','typ','beschreibung','abmessung','farbe'].map(k=>[k,z.string().trim().max(300).optional()]))).strict();
const device=z.object({listId:z.string().min(1).max(100),position:z.number().int().positive()}).strict();
const evidence=z.object({sourceLabel:z.string().trim().min(1).max(300),sourceQuote:z.string().trim().min(1).max(3000)}).strict();
const common={importId:id,evidence};
const input=z.discriminatedUnion('operation',[
 z.object({...common,operation:z.literal('begin'),expectedRows:z.number().int().min(1).max(5000)}).strict(),
 z.object({...common,operation:z.literal('stage'),rows:z.array(z.object({rowId:id,text:z.string().trim().min(1).max(500),candidate:candidate.optional()}).strict()).min(1).max(20)}).strict(),
 z.object({...common,operation:z.literal('resolve'),rows:z.array(z.object({rowId:id,disposition:z.enum(['linked','existing','clarify','excluded','resume']),candidate:candidate.optional(),device:device.optional(),reason:z.string().trim().min(1).max(500).optional()}).strict()).min(1).max(20)}).strict(),
 z.object({...common,operation:z.literal('finish')}).strict()
]);
const query=pageQuery.extend({limit:z.coerce.number().int().min(1).max(5).default(3),importId:id.optional(),rowId:id.optional(),section:z.enum(['rows','source']).default('rows'),status:z.enum(['all','open']).default('open')});
module.exports={input,query};
