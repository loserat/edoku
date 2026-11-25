document.addEventListener('DOMContentLoaded', () => {
  const host = document.querySelector('[data-review-host]');
  if (!host) return;
  let busy = false, uncertain = false;
  const notify = data => { if (parent !== window) parent.postMessage(data, location.origin); };
  const context = () => host.querySelector('[data-review-id]')?.dataset;
  function feedback(message) {
    let node = host.querySelector('[data-review-feedback]');
    if (!node) { node = document.createElement('p'); node.setAttribute('role','status'); host.append(node); }
    node.hidden = false; node.textContent = message;
  }
  function buttons() {
    host.querySelectorAll('button[type="submit"]').forEach(button => {
      const form = button.form;
      button.disabled = busy || uncertain || (form.matches('[data-document-approval]') && (!form.elements.reviewed.checked || !form.elements.revision.value));
    });
  }
  function statusButton(label) {
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{button.disabled=true;try{await loadReview(location.href);}catch(error){button.disabled=false;feedback(error.message);}});host.append(button);
  }
  async function loadReview(rawUrl) {
    const url = new URL(rawUrl,location.origin);
    if (url.origin !== location.origin || !/^\/assistent\/auftraege\/[^/]+\/dateien\/[^/?]+$/.test(url.pathname)) throw Error('Ungültige Prüfansicht.');
    url.searchParams.set('fragment','review'); url.searchParams.set('panel',new URLSearchParams(location.search).get('panel') === '1' ? '1' : '0');
    const response = await fetch(url,{credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'}});
    const value = await response.json();
    if (!response.ok || !value.ok) throw Error(value.message || 'Prüfansicht konnte nicht geladen werden.');
    const current = context();
    if (!current || value.projectId !== current.reviewProject || value.jobId !== current.reviewJob) throw Error('Das geöffnete Projekt hat sich geändert. Bitte den Assistenten erneut öffnen.');
    document.dispatchEvent(new Event('edoku-review-dispose'));
    host.innerHTML = value.html;
    history.replaceState(null,'',url.pathname + (url.searchParams.get('panel') === '1' ? '?panel=1' : ''));
    const updates=document.querySelector('[data-assistant-updates]');
    if(updates){updates.dataset.updatedAt=value.viewVersion;updates.hidden=true;}
    uncertain=false;
    document.dispatchEvent(new Event('edoku-review-replaced'));
    if(value.state!=='pending')notify({type:'edoku-review-saved',projectId:value.projectId,jobId:value.jobId,proposalId:value.proposalId,state:value.state});
    notify({type:'edoku-review-dirty',dirty:false});
    host.querySelector('h2')?.setAttribute('tabindex','-1');host.querySelector('h2')?.focus();
  }
  document.addEventListener('change', event => { if (host.contains(event.target)) buttons(); });
  document.addEventListener('input', event => {
    if(host.contains(event.target))notify({type:'edoku-review-dirty',dirty:true});
  });
  document.addEventListener('submit', async event => {
    const form=event.target;
    if(!host.contains(form)||!form.matches('[data-document-approval],[data-document-rejection],[data-document-withdrawal]'))return;
    event.preventDefault();
    if(busy||uncertain||!form.reportValidity())return;
    const current=context(); if(!current)return;
    const request = new URLSearchParams(new FormData(form));
    busy=true;host.setAttribute('aria-busy','true');buttons();feedback('Entscheidung wird gespeichert …');
    let committed=false;
    try {
      const response=await fetch(form.action,{method:'POST',credentials:'same-origin',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:request,signal:AbortSignal.timeout(90000)});
      const value=await response.json();
      if(!response.ok||!value.ok){
        feedback(value.message||'Speichern nicht möglich. Bitte die Angaben prüfen.');
        if(response.status===409||response.status===412){uncertain=true;statusButton('Aktuellen Dateistatus laden');}
        return;
      }
      if(value.projectId!==current.reviewProject||value.jobId!==current.reviewJob||value.proposalId!==current.reviewId)throw Error('Unerwartete Speicherantwort.');
      committed=true;
      notify({type:'edoku-review-saved',projectId:value.projectId,jobId:value.jobId,proposalId:value.proposalId,state:value.state});
      document.dispatchEvent(new Event('edoku-review-saved'));
      if(value.nextUrl){
        try{await loadReview(value.nextUrl);}catch(error){
          document.dispatchEvent(new Event('edoku-review-dispose'));
          host.replaceChildren();feedback('Entscheidung gespeichert. Die nächste Prüfansicht konnte nicht geladen werden.');
          const link=document.createElement('a');link.href=value.nextUrl;link.textContent='Nächste Datei öffnen';host.append(link);
        }
      } else {
        document.dispatchEvent(new Event('edoku-review-dispose'));
        host.replaceChildren();const title=document.createElement('h2');title.textContent=value.remainingPending ? 'Ende der Prüfreihenfolge erreicht' : 'Keine weitere Datei in diesem Auftrag zu prüfen';host.append(title);
        feedback(value.earlierPending ? 'Entscheidung gespeichert. '+value.earlierPending+' frühere Dateien sind noch offen. Du kannst sie über die Arbeitsliste gezielt öffnen.' : 'Deine Entscheidung ist gespeichert. Neue Vorschläge benötigen weiterhin eine eigene Prüfung.');
        const back=document.createElement('a');back.href='/assistent/auftraege/'+encodeURIComponent(value.jobId)+'?ansicht=dateien&filter=pending';back.textContent=value.remainingPending ? 'Offene Dateien anzeigen' : 'Zur Dateiliste';host.append(back);
      }
    } catch {
      // The write might already have committed. Never automatically submit it again.
      uncertain=true;feedback('Der Speicherstatus ist unklar. Bitte zuerst den Dateistatus prüfen; die Entscheidung wird nicht erneut gesendet.');
      statusButton('Dateistatus prüfen');
    } finally {
      busy=false;host.removeAttribute('aria-busy');buttons();
      if(committed)notify({type:'edoku-review-dirty',dirty:false});
    }
  });
  buttons();
});
