// Only bounded text extraction. No rendering, system fonts, OCR or page images.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
console.log=console.warn=console.error=()=>{};
try{
 const require=createRequire(import.meta.url),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const base=path.dirname(require.resolve('pdfjs-dist/package.json'));
 const data=new Uint8Array(await fs.readFile(process.argv[2]));
 const task=getDocument({data,verbosity:0,disableFontFace:true,useSystemFonts:false,isEvalSupported:false,enableXfa:false,useWasm:false,useWorkerFetch:false,standardFontDataUrl:path.join(base,'standard_fonts')+path.sep,cMapUrl:path.join(base,'cmaps')+path.sep,cMapPacked:true});
 const pdf=await task.promise,pages=[],totalPages=pdf.numPages;let chars=0,truncated=false;
 for(let n=1;n<=Math.min(pdf.numPages,12)&&chars<90000;n++){
  const page=await pdf.getPage(n),content=await page.getTextContent();let text='';
  for(const item of content.items)if(typeof item.str==='string')text+=item.str+(item.hasEOL?'\n':' ');
  if(text.length>Math.min(12000,90000-chars))truncated=true;
  text=text.slice(0,Math.min(12000,90000-chars));chars+=text.length;pages.push({page:n,text});page.cleanup();
 }
 await task.destroy();process.stdout.write(JSON.stringify({pages,totalPages,truncated:truncated||pages.length<totalPages}));
}catch(error){process.stderr.write(String(error.message||'PDF_TEXT_UNAVAILABLE').slice(0,300));process.stdout.write(JSON.stringify({error:'PDF_TEXT_UNAVAILABLE'}));process.exitCode=1;}
