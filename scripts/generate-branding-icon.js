// The PDF image is generated from the same SVG used by the GUI footer.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
async function main(){
  const folder=path.join(__dirname,'../public/img'),size=256;
  const source=await fs.readFile(path.join(folder,'nickgm-logo-mark.svg'));
  const canvas=createCanvas(size,size),context=canvas.getContext('2d');
  context.drawImage(await loadImage(source),0,0,size,size);
  const png=canvas.toBuffer('image/png');
  await fs.writeFile(path.join(folder,'nickgm-logo-mark.png'),png);
  const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
  await fs.writeFile(path.join(folder,'nickgm-logo-mark.json'),JSON.stringify({source:'nickgm-logo-mark.svg',output:'nickgm-logo-mark.png',width:size,height:size,sourceSha256:sha(source),outputSha256:sha(png)},null,2)+'\n');
  console.log(JSON.stringify({source:'nickgm-logo-mark.svg',output:'nickgm-logo-mark.png',size,bytes:png.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
