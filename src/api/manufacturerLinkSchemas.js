const { z } = require('./schemas');
const query=z.object({
 manufacturerPageUrl:z.url().max(2000).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443');}),
 listId:z.string().min(1).max(100),position:z.coerce.number().int().positive(),
 category:z.enum(['Datenblätter','Bedienungsanleitungen']).default('Datenblätter')
}).strict();
module.exports={query};
