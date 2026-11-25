document.addEventListener("DOMContentLoaded", () => {
  const dirtyForms = new Set();
  document.addEventListener('input',event=>{const form=event.target.closest('form[action$="/antworten"], [data-document-approval], [data-document-rejection], [data-document-withdrawal]');if(form)dirtyForms.add(form);});
  document.addEventListener('submit',event=>{if(!event.target.matches('[data-document-approval],[data-document-rejection],[data-document-withdrawal]'))dirtyForms.delete(event.target);});
  document.addEventListener('edoku-review-saved',()=>dirtyForms.clear());
  document.addEventListener('edoku-review-replaced',()=>dirtyForms.clear());
  window.addEventListener('beforeunload',event=>{if(dirtyForms.size){event.preventDefault();event.returnValue='';}});
  document.addEventListener('input',event=>{
    if(!event.target.matches('[data-file-search]'))return;
    const query=event.target.value.trim().toLocaleLowerCase('de'),rows=[...document.querySelectorAll('[data-file-row]')];
    rows.forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('de').includes(query);});
    document.querySelectorAll('[data-file-group]').forEach(group=>{group.hidden=![...group.querySelectorAll('[data-file-row]')].some(row=>!row.hidden);});
    const empty=document.querySelector('[data-file-empty]');if(empty)empty.hidden=rows.some(row=>!row.hidden);
  });
  const updates = document.querySelector("[data-assistant-updates]");
  if (!updates) return;
  function projectChanged() {
    // Bereits geladene fremde Projektdaten nach einem Wechsel nicht weiter anzeigen.
    const main = document.getElementById('main-content');
    document.querySelector('dialog[open]')?.close();
    for (const child of main.children) if (child !== updates) child.hidden = true;
    updates.hidden = false;
    updates.querySelector('[data-assistant-update-text]').textContent = 'Das geöffnete Projekt hat sich geändert. Bitte den Assistenten für das aktuelle Projekt neu öffnen.';
    updates.querySelector('a').href = '/assistent';
    updates.querySelector('a').textContent = 'Aktuelles Projekt öffnen';
  }
  async function poll() {
    if (!document.hidden) {
      try {
        const response = await fetch(updates.dataset.statusUrl || `/assistent/auftraege/${encodeURIComponent(updates.dataset.jobId)}/status`, { credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
        if ([404, 409].includes(response.status)) { projectChanged(); return; }
        if (response.ok) {
          const state = await response.json();
          if (state.projectId && state.projectId !== updates.dataset.projectId) { projectChanged(); return; }
          if ((state.viewVersion || state.updatedAt) !== updates.dataset.updatedAt) {
            updates.querySelector("[data-assistant-update-text]").textContent = `Neuer Stand · ${state.pending} Dateien zu prüfen`;
            updates.hidden = false;
          }
        }
      } catch { /* Eingaben und die manuelle Prüfung bei Verbindungsproblemen erhalten. */ }
    }
    timer = window.setTimeout(poll, 15000);
  }
  let timer = window.setTimeout(poll, 15000);
  window.addEventListener("pagehide", () => window.clearTimeout(timer), { once: true });
});
