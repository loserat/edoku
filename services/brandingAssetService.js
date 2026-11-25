const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.join(__dirname,'../public/img');
let verified=false;
function pdfBrandIcon(){
  const image=path.join(directory,'nickgm-logo-mark.png');
  if(!verified){
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'nickgm-logo-mark.json'),'utf8'));
    const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if(manifest.sourceSha256!==sha(path.join(directory,'nickgm-logo-mark.svg'))||manifest.outputSha256!==sha(image))throw new Error('PDF-Bildmarke passt nicht zur GUI-Quelle. node scripts/generate-branding-icon.js ausführen.');
    verified=true;
  }
  return image;
}
module.exports={pdfBrandIcon};
