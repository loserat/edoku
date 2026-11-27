document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.querySelector('[data-work-drawer]');
  let opener;
  let dirty = false;
  function show(content, trigger) {
    opener = trigger; dirty = false;
    const slot = drawer.querySelector('[data-drawer-content]'); slot.replaceChildren(content);
    drawer.showModal(); drawer.querySelector('[data-close-drawer]').focus();
  }
  document.addEventListener('click', event => {
    const detail = event.target.closest('[data-work-detail]');
    if (detail && drawer) { const template = document.getElementById(detail.dataset.workDetail); if (template) show(template.content.cloneNode(true), detail); }
    const link = event.target.closest('a[href*="/dateien/"]');
    if (link && drawer && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0 && /\/assistent\/auftraege\/[^/]+\/dateien\/[^/?]+$/.test(new URL(link.href).pathname)) {
      event.preventDefault(); const frame = document.createElement('iframe'); frame.title = 'Datei einzeln prüfen'; frame.className = 'assistant-review-frame'; frame.src = link.href + (link.search ? '&' : '?') + 'panel=1'; show(frame, link);
    }
    if (event.target.closest('[data-close-drawer]') && (!dirty || confirm('Ungespeicherte Eingaben verwerfen?'))) { dirty = false; drawer.close(); }
  });
  document.addEventListener('input', event => { if (drawer?.contains(event.target) && event.target.closest('form')) dirty = true; });
  document.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  drawer?.addEventListener('cancel', event => { if (dirty && !confirm('Ungespeicherte Eingaben verwerfen?')) event.preventDefault(); else dirty = false; });
  drawer?.addEventListener('close', () => { drawer.querySelector('[data-drawer-content]').replaceChildren(); opener?.focus(); });
  let refreshSequence=0;
  async function refreshWorkspace() {
    const target=document.querySelector('[data-workspace-content]');if(!target)return;
    const sequence=++refreshSequence,url=new URL(location.href),search=target.querySelector('[data-work-search]')?.value||'',fileSearch=target.querySelector('[data-file-search]')?.value||'';
    url.searchParams.set('fragment','workspace');
    try {
      const response=await fetch(url,{credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'}}),value=await response.json();
      if(sequence!==refreshSequence)return;
      const updates=document.querySelector('[data-assistant-updates]');
      if(!response.ok||!value.ok||value.projectId!==updates?.dataset.projectId)throw Error();
      target.innerHTML=value.html;
      const input=target.querySelector('[data-work-search]');if(input)input.value=search;
      const files=target.querySelector('[data-file-search]');if(files){files.value=fileSearch;files.dispatchEvent(new Event('input',{bubbles:true}));}
      if(updates){updates.dataset.updatedAt=value.viewVersion;updates.hidden=true;}
      apply();
    } catch {
      const updates=document.querySelector('[data-assistant-updates]');
      if(updates){updates.hidden=false;updates.querySelector('[data-assistant-update-text]').textContent='Entscheidung gespeichert. Die Übersicht bitte über „Neuen Stand laden“ aktualisieren.';}
    }
  }
  window.addEventListener('message', event => {
    if(event.origin!==location.origin||event.source!==drawer?.querySelector('iframe')?.contentWindow)return;
    if(event.data?.type==='edoku-review-dirty'){dirty=Boolean(event.data.dirty);return;}
    if(event.data?.type==='edoku-review-saved'){
      const updates=document.querySelector('[data-assistant-updates]');
      if(event.data.projectId!==updates?.dataset.projectId)return;
      dirty=false;refreshWorkspace();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-job-target]')) { const form = event.target.form; form.action = '/assistent/auftraege/' + encodeURIComponent(event.target.value) + '/ergaenzen'; form.elements.jobVersion.value = event.target.selectedOptions[0].dataset.version; }
  });
  const getRows=()=>[...document.querySelectorAll('[data-work-row]')];
  let filter = new URLSearchParams(location.search).get('aufgaben') || 'now';
  if (!['now','all','file','question','research','waiting'].includes(filter)) filter = 'now';
  function apply() {
    const rows=getRows(),query = document.querySelector('[data-work-search]')?.value.trim().toLocaleLowerCase('de') || '';
    rows.forEach(row => { row.hidden = !(filter === 'all' || (filter === 'now' ? row.dataset.kind !== 'waiting' : filter === 'research' ? ['source','article'].includes(row.dataset.kind) : row.dataset.kind === filter)) || !row.textContent.toLocaleLowerCase('de').includes(query); });
    document.querySelectorAll('[data-work-group]').forEach(group => {
      const count=[...group.querySelectorAll('[data-work-row]')].filter(row=>!row.hidden).length;
      group.hidden=count===0;
      group.querySelector('[data-group-count]').textContent=count;
    });
    const count = rows.filter(row => !row.hidden).length;
    const empty = document.querySelector('[data-work-empty]'); if (empty) empty.hidden = count > 0;
    document.querySelectorAll('nav [data-work-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workFilter === filter)));
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-work-filter]');if(!button)return;filter=button.dataset.workFilter;const url=new URL(location.href);url.searchParams.set('aufgaben',filter);history.replaceState(null,'',url);apply();});
  document.addEventListener('input',event=>{if(event.target.matches('[data-work-search]'))apply();});apply();
});
