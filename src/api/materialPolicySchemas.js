const {z}=require('./schemas');
const exclusions=z.object({connectionTerminals:z.boolean(),cablesAndWires:z.boolean(),fasteningMaterial:z.boolean()}).strict();
module.exports={exclusions};
