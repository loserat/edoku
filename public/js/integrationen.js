document.addEventListener('DOMContentLoaded', () => {
  const panel = document.querySelector('#api-integrations');
  if (!panel) return;
  const copyStatus = panel.querySelector('[data-integration-copy-status]');
  async function copy(value, target) {
    try { await navigator.clipboard.writeText(value); copyStatus.textContent = 'Kopiert.'; }
    catch { if (target) { target.focus(); target.select(); } copyStatus.textContent = target ? 'Bitte den markierten Text manuell kopieren.' : 'Kopieren ist hier nicht verfügbar.'; }
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-copy-text], [data-copy-target], [data-copy-probe]');
    if (!button) return;
    const target = button.dataset.copyTarget ? panel.querySelector(button.dataset.copyTarget) : null;
    const value = button.hasAttribute('data-copy-probe') ? 'Prüfe die edoku-MCP-Verbindung ausschließlich lesend: initialisiere die Verbindung, lade alle Seiten von tools/list und vergleiche Namen und Anzahl mit dem aktuellen edoku-Serverkatalog. Prüfe edoku_identity. Keine Projektänderungen, Dateivorschläge oder Freigaben. Melde Version, Werkzeuganzahl und konkrete Fehler kurz.' : target?.value || button.dataset.copyText;
    if (value) copy(value, target);
  });
  function openPane(name) {
    panel.querySelectorAll('[data-integration-pane]').forEach(pane => { pane.hidden = pane.dataset.integrationPane !== name; });
    panel.querySelectorAll('[data-integration-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.integrationTab === name)));
    if (name === 'tools' && !toolsLoaded) loadTools();
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-integration-tab],[data-integration-go]');
    if (button) openPane(button.dataset.integrationTab || button.dataset.integrationGo);
  });
  const keyForm = panel.querySelector('[data-api-key-form]');
  if (keyForm) {
    const projects = keyForm.querySelector('[data-key-projects]'), choices = [...projects.querySelectorAll('input[name="projectIds"]')];
    const validate = () => {
      const selected = keyForm.querySelector('input[name="projectMode"]:checked')?.value === 'selected';
      projects.hidden = !selected; choices.forEach(choice => { choice.disabled = !selected; });
      keyForm.querySelector('[name="projectMode"][value="selected"]').setCustomValidity(selected && !choices.some(choice => choice.checked) ? 'Bitte mindestens ein Projekt auswählen oder alle eigenen Projekte freigeben.' : '');
      keyForm.querySelector('[name="scopes"]').setCustomValidity(keyForm.querySelector('[name="scopes"]:checked') ? '' : 'Bitte mindestens ein Recht auswählen.');
    };
    keyForm.addEventListener('change', validate);
    keyForm.querySelectorAll('[data-assistant-key-preset]').forEach(button => button.addEventListener('click', () => {
      const selected = button.dataset.assistantKeyPreset;
      const writes = selected === 'full' ? ['assistant:write','projects:write','devices:write','exports:write'] : selected === 'read' ? [] : ['assistant:write'];
      keyForm.querySelectorAll('[name="scopes"]').forEach(input => { input.checked = input.value.endsWith(':read') || writes.includes(input.value); });
      validate();
    }));
    validate();
  }
  const form = panel.querySelector('[data-mcp-setup]'), output = form.querySelector('[data-mcp-config]'), token = form.querySelector('[data-mcp-token]'), status = form.querySelector('[data-mcp-status]');
  const field = name => form.querySelector('[data-mcp-' + name + ']');
  let step = 0, tokenSequence = 0, tokenController;
  function showStep(value) {
    step = value;
    form.querySelectorAll('[data-mcp-step]').forEach(node => { node.hidden = Number(node.dataset.mcpStep) !== step; });
    panel.querySelectorAll('[data-step-label]').forEach(node => { if (Number(node.dataset.stepLabel) === step) node.setAttribute('aria-current','step'); else node.removeAttribute('aria-current'); });
  }
  function invalidate() {
    tokenSequence++; tokenController?.abort(); output.value = ''; status.textContent = '';
    if (step === 2) showStep(1);
  }
  function address() {
    let url;
    try { url = new URL(field('url').value.trim()); } catch { throw Error('Bitte eine gültige edoku-Adresse eingeben.'); }
    if (url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) throw Error('Serveradresse ohne Zugangsdaten, Pfad oder Parameter eingeben.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw Error('Entfernte Server benötigen HTTPS.');
    return url;
  }
  const absolute = value => /^(\/|[a-zA-Z]:[\\/]|\\\\)/.test(value);
  function launch() {
    const url = address(), mode = field('mode').value, script = field('script').value.trim();
    if (mode === 'remote') { if (url.protocol !== 'https:') throw Error('Remote-MCP benötigt eine HTTPS-Adresse.'); return { url, mode }; }
    const suffix = mode === 'docker' ? /[\\/]edoku-mcp-docker\.py$/ : /[\\/]edoku-mcp\.js$/;
    if (!absolute(script) || !suffix.test(script)) throw Error('Vollständigen Pfad zum passenden edoku-MCP-Starter auf dem Client-Rechner eingeben.');
    const container = field('container').value.trim();
    if (mode === 'docker' && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container)) throw Error('Bitte einen gültigen Containernamen eingeben.');
    return { url, mode, script, container };
  }
  function secret() {
    const value = token.value.trim();
    if (!/^edoku_[a-f0-9]{24}\.[a-f0-9]{64}$/.test(value)) throw Error('Bitte einen gültigen edoku-API-Schlüssel eingeben.');
    return value;
  }
  function next() { try { launch(); showStep(1); token.focus(); status.textContent = ''; } catch(error) { status.textContent = error.message; } }
  function build() {
    invalidate();
    try {
      const { url, mode, script, container } = launch(), value = secret(), documentRoot = field('document-root').value.trim();
      if (mode !== 'remote' && documentRoot && !absolute(documentRoot)) throw Error('Bitte einen vollständigen Eingangsordner eingeben.');
      const env = { EDOKU_API_URL: url.origin, EDOKU_API_TOKEN: value, EDOKU_MCP_ALLOW_WRITES: String(field('writes').checked), EDOKU_MCP_RESPONSE_MODE: 'structured' };
      if (documentRoot) env.EDOKU_MCP_DOCUMENT_ROOT = documentRoot;
      if (mode === 'docker') { env.EDOKU_MCP_CONTAINER = container; env.EDOKU_MCP_LAUNCH_MODE = 'environment'; }
      const connection = mode === 'remote' ? { url: url.origin + '/mcp' + (field('writes').checked ? '?access=write' : ''), headers: { Authorization: 'Bearer ' + value } } : { command: mode === 'docker' ? 'python3' : 'node', args: [script], env };
      output.value = JSON.stringify({ mcpServers: { edoku: connection } }, null, 2);
      showStep(2); status.textContent = 'Konfiguration erstellt. Die Verbindung wird erst im MCP-Client gestartet.';
    } catch(error) { status.textContent = error.message; }
  }
  form.addEventListener('input', invalidate);
  form.addEventListener('change', event => {
    invalidate();
    if (event.target === field('mode')) {
      const docker = field('mode').value === 'docker', remote = field('mode').value === 'remote';
      field('script-field').hidden = remote; field('local-files').hidden = remote; field('remote-hint').hidden = !remote;
      field('address-hint').textContent = remote ? 'Öffentliche HTTPS-Adresse des VPS, ohne /mcp. Kein lokaler Starter erforderlich.' : 'Docker vor Ort: meist http://127.0.0.1:3000 im Container.';
      field('container-field').hidden = !docker;
      field('script').value = ''; field('script').placeholder = docker ? '/Pfad/zu/edoku/scripts/edoku-mcp-docker.py' : '/Pfad/zu/edoku/scripts/edoku-mcp.js';
      field('mode-hint').textContent = docker ? 'Python 3 und lokaler Docker-Zugriff erforderlich; kein Node.js auf dem Host nötig.' : 'Node.js 22 und edoku-Abhängigkeiten erforderlich.';
      showStep(0);
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (step === 0) next(); else if (step === 1) build(); });
  field('next').addEventListener('click', next);
  form.querySelector('[data-mcp-build]').addEventListener('click', build);
  form.querySelectorAll('[data-mcp-back]').forEach(button => button.addEventListener('click', () => { invalidate(); showStep(Number(button.dataset.mcpBack)); }));
  panel.querySelector('[data-use-created-key]')?.addEventListener('click', () => {
    invalidate(); token.value = panel.querySelector('[data-created-key]').value; openPane('setup'); showStep(0); field('mode').focus(); status.textContent = 'Schlüssel übernommen. Betriebsart und Serveradresse prüfen.';
  });
  function clearSecrets() {
    invalidate(); token.value = ''; showStep(0);
    const created = panel.querySelector('[data-created-key]');
    if (created) { created.value = ''; created.defaultValue = ''; created.textContent = ''; panel.querySelector('[data-created-key-panel]').hidden = true; }
  }
  form.querySelector('[data-clear-mcp]').addEventListener('click', () => { clearSecrets(); status.textContent = 'Schlüssel und Konfiguration aus der Ansicht entfernt.'; });
  panel.querySelector('[data-hide-created-key]')?.addEventListener('click', () => { clearSecrets(); copyStatus.textContent = 'Schlüssel und Konfiguration aus der Ansicht entfernt.'; });
  window.addEventListener('pagehide', clearSecrets);
  function comparable(url) { return url.protocol + '//' + (['localhost','127.0.0.1','[::1]'].includes(url.hostname) ? 'loopback' : url.hostname) + ':' + (url.port || (url.protocol === 'https:' ? '443' : '80')); }
  form.querySelector('[data-check-token]').addEventListener('click', async () => {
    let value;
    try {
      const url = address(); value = secret();
      if (![new URL(location.origin),new URL(panel.dataset.integrationOrigin)].some(local => comparable(local) === comparable(url))) throw Error('Diese Diagnose prüft nur den hier geöffneten edoku-Server. Auf dem Zielserver öffnen oder im Client prüfen.');
    } catch(error) { status.textContent = error.message; return; }
    const sequence = ++tokenSequence; tokenController?.abort(); const controller = new AbortController(); tokenController = controller;
    const timeout = setTimeout(() => controller.abort(),8000); status.textContent = 'Zugang wird ausschließlich lesend geprüft …';
    try {
      const response = await fetch('/api/v1/me',{headers:{Authorization:'Bearer '+value,Accept:'application/json'},credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
      const result = await response.json(); if (sequence !== tokenSequence) return;
      if (!response.ok || !result.success) throw Error(response.status === 401 ? 'Schlüssel ungültig, abgelaufen oder widerrufen.' : response.status === 503 ? 'API ist ausgeschaltet oder nicht verfügbar.' : 'Zugang konnte nicht geprüft werden.');
      const wantsWrites = field('writes').checked, writes = result.data.scopes.some(scope=>scope.endsWith(':write'));
      status.textContent = wantsWrites && !writes ? 'Schlüssel gültig, aber ohne Schreibrechte. Serverfreigaben unter „Verbindung“ prüfen.' : 'Schlüssel gültig. Externen MCP-Client anschließend separat verbinden und prüfen.';
    } catch(error) { if (sequence === tokenSequence) status.textContent = ['Schlüssel ungültig, abgelaufen oder widerrufen.','API ist ausgeschaltet oder nicht verfügbar.','Zugang konnte nicht geprüft werden.'].includes(error.message) ? error.message : 'Keine Prüfantwort. Serveradresse und Verbindung prüfen.'; }
    finally { clearTimeout(timeout); }
  });
  let diagnosisSequence = 0;
  const diagnosis = panel.querySelector('[data-integration-diagnosis]'), report = panel.querySelector('[data-diagnosis-result]');
  diagnosis.addEventListener('change', () => { diagnosisSequence++; report.replaceChildren(); });
  diagnosis.addEventListener('submit', async event => {
    event.preventDefault(); const sequence = ++diagnosisSequence; const button = diagnosis.querySelector('button'), params = new URLSearchParams();
    for (const [key,value] of new FormData(diagnosis)) if (value) params.set(key,value);
    button.disabled = true; report.replaceChildren();
    try {
      const response = await fetch('/integrationen/diagnose?'+params,{credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
      const value = await response.json(); if (sequence !== diagnosisSequence) return; if (!response.ok) throw Error();
      value.checks.forEach(check => { const row = document.createElement('li'); row.dataset.state = check.state; row.textContent = ({ok:'✓ ',warning:'Hinweis: ',error:'Fehler: ',unknown:'Offen: '}[check.state] || '') + check.label; report.append(row); });
    } catch { const row=document.createElement('li');row.textContent='Diagnose nicht verfügbar. Sitzung und Server prüfen.';report.append(row); }
    finally { button.disabled = false; }
  });
  let toolsLoaded = false, offset = 0, toolsSequence = 0, toolTimer;
  const toolSearch=panel.querySelector('[data-tool-search]'), toolGroup=panel.querySelector('[data-tool-group]'), toolMode=panel.querySelector('[data-tool-mode]'), toolList=panel.querySelector('[data-tool-list]'), toolStatus=panel.querySelector('[data-tool-status]'), prev=panel.querySelector('[data-tool-prev]'), following=panel.querySelector('[data-tool-next]');
  async function loadTools() {
    const sequence=++toolsSequence;prev.disabled=true;following.disabled=true;toolStatus.textContent='Werkzeuge werden geladen …';
    const params=new URLSearchParams({search:toolSearch.value,group:toolGroup.value,mode:toolMode.value,offset:String(offset),limit:'12'});
    try {
      const response=await fetch('/integrationen/werkzeuge?'+params,{credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)}), value=await response.json();
      if(sequence!==toolsSequence)return;if(!response.ok)throw Error(); toolsLoaded=true;toolList.replaceChildren();
      value.items.forEach(tool=>{const row=document.createElement('li'),details=document.createElement('details'),heading=document.createElement('summary'),name=document.createElement('code'),badge=document.createElement('span'),text=document.createElement('p');name.textContent=tool.name;badge.textContent=tool.sensitive?'Löschen / Wiederherstellen':tool.readOnly?'Lesen':'Ändern';heading.append(name,badge);text.textContent=tool.description;details.append(heading,text);row.append(details);toolList.append(row);});
      toolStatus.textContent=value.total ? (offset+1)+'–'+(offset+value.items.length)+' von '+value.total+' Werkzeugen' : 'Keine passenden Werkzeuge.';
      prev.disabled=offset===0;following.disabled=offset+value.limit>=value.total;
    } catch { if(sequence===toolsSequence){toolsLoaded=false;toolList.replaceChildren();toolStatus.textContent='Werkzeugliste nicht verfügbar. Bereich erneut öffnen.';} }
  }
  function resetTools(){offset=0;loadTools();}
  toolSearch.addEventListener('input',()=>{toolsSequence++;clearTimeout(toolTimer);toolTimer=setTimeout(resetTools,200);});
  toolGroup.addEventListener('change',resetTools);toolMode.addEventListener('change',resetTools);
  prev.addEventListener('click',()=>{offset=Math.max(0,offset-12);loadTools();}); following.addEventListener('click',()=>{offset+=12;loadTools();});
  showStep(0);openPane(panel.querySelector('[data-created-key-panel]')?'keys':'connection');
});
