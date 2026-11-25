// Test-checkout dependency doubles only. Production code has no bypass flag.
const fs=require('node:fs/promises'),path=require('node:path');
const legacyVerification={technical:()=>false};
async function install(root,real){
 const file=path.join(root,'services/productDocumentVerificationService.js');
 if(!real){await fs.appendFile(file,"\nmodule.exports.createProductDocumentVerificationService=()=>({technical:()=>false});\n");return;}
 // Exercise the real verifier/worker and replace only the external HTTP transport.
 await fs.appendFile(file,`\nconst fixtureFactory=module.exports.createProductDocumentVerificationService;
 module.exports.createProductDocumentVerificationService=(root,options)=>fixtureFactory(root,{...options,sourceLoader:async url=>{
 const map=JSON.parse(await require('node:fs/promises').readFile(require('node:path').join(root,'product-source-fixture.json'),'utf8'));
 if(!Object.hasOwn(map,url))throw Error('Unregistered synthetic manufacturer URL');
 return {bytes:await require('node:fs/promises').readFile(require('node:path').join(root,map[url])),finalUrl:url};
 }});\n`);
}
function realVerification(root){return require('../../services/productDocumentVerificationService').createProductDocumentVerificationService(root,{sourceLoader:async url=>{
 const map=JSON.parse(await fs.readFile(path.join(root,'product-source-fixture.json'),'utf8'));
 if(!Object.hasOwn(map,url))throw Error('Unregistered synthetic manufacturer URL');
 return {bytes:await fs.readFile(path.join(root,map[url])),finalUrl:url};
}});}
module.exports={install,legacyVerification,realVerification};
