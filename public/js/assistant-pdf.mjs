import { getDocument, GlobalWorkerOptions } from "/assistent/viewer/pdf.mjs";
GlobalWorkerOptions.workerSrc = "/assistent/viewer/pdf.worker.mjs";
let dispose = () => {};
async function initializePreview() {
  dispose();
  const root=document.querySelector('[data-pdf-preview]');
  if(!root)return;
  const canvas=root.querySelector('canvas'),previous=root.querySelector('[data-pdf-previous]'),next=root.querySelector('[data-pdf-next]');
  const pageLabel=root.querySelector('[data-pdf-page]'),status=root.querySelector('[data-pdf-status]'),fit=root.querySelector('[data-pdf-fit]');
  let pdf,loadingTask,renderTask,pageNumber=1,rendering=false,fitPage=false,cancelled=false,resizeTimer;
  async function render() {
    if(rendering||!pdf||cancelled)return;
    rendering=true;previous.disabled=true;next.disabled=true;
    try {
      const page=await pdf.getPage(pageNumber);if(cancelled)return;
      const natural=page.getViewport({scale:1});if(!natural.width||!natural.height)throw Error();
      const availableWidth=Math.min(root.clientWidth-2,1300);
      const cssWidth=fitPage?Math.min(availableWidth,(root.querySelector('.assistant-pdf-canvas').clientHeight-2)*natural.width/natural.height):availableWidth;
      const scale=Math.max(1,cssWidth)/natural.width,density=Math.min(window.devicePixelRatio||1,2,Math.sqrt(6000000/(natural.width*natural.height*scale*scale)));
      const viewport=page.getViewport({scale:scale*density});
      canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));
      canvas.style.width=cssWidth+'px';canvas.style.height=natural.height*scale+'px';
      renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
      if(cancelled)return;
      pageLabel.textContent=`Seite ${pageNumber} von ${pdf.numPages}`;status.textContent='';root.dataset.pdfRendered='true';
    } catch {if(!cancelled)status.textContent='Diese Seite kann nicht angezeigt werden. Bitte die Datei separat öffnen und prüfen.';}
    finally {rendering=false;if(!cancelled){previous.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;}}
  }
  const resize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);};
  window.addEventListener('resize',resize);
  dispose=()=>{cancelled=true;clearTimeout(resizeTimer);window.removeEventListener('resize',resize);renderTask?.cancel();loadingTask?.destroy().catch(()=>{});};
  previous.addEventListener('click',()=>{if(!rendering&&pageNumber>1){pageNumber--;render();}});
  next.addEventListener('click',()=>{if(!rendering&&pageNumber<pdf.numPages){pageNumber++;render();}});
  fit?.addEventListener('click',()=>{if(!rendering){fitPage=!fitPage;fit.textContent=fitPage?'Seitenbreite':'Ganze Seite';render();}});
  try {
    loadingTask=getDocument({url:root.dataset.pdfUrl,withCredentials:true,isEvalSupported:false,enableXfa:false,useWasm:false,standardFontDataUrl:'/assistent/viewer/fonts/',disableAutoFetch:true,disableStream:true,disableRange:true});
    pdf=await loadingTask.promise;if(!cancelled)await render();
  } catch {if(!cancelled){pageLabel.textContent='Vorschau nicht verfügbar';status.textContent='PDF konnte nicht dargestellt werden. Bitte die Datei separat öffnen und prüfen.';}}
}
document.addEventListener('edoku-review-dispose',()=>dispose());
document.addEventListener('edoku-review-replaced',initializePreview);
window.addEventListener('pagehide',()=>dispose(),{once:true});
initializePreview();
