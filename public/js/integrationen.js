document.addEventListener("DOMContentLoaded", () => {
  const panel = document.querySelector("#api-integrations");
  if (!panel) return;
  const copyStatus = panel.querySelector("[data-integration-copy-status]");
  panel.addEventListener("click", async event => {
    const button = event.target.closest("[data-copy-text], [data-copy-target]");
    if (!button) return;
    const target = button.dataset.copyTarget ? panel.querySelector(button.dataset.copyTarget) : null;
    const value = target?.value || button.dataset.copyText;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      copyStatus.textContent = "Kopiert.";
    } catch {
      if (target) { target.focus(); target.select(); }
      copyStatus.textContent = target ? "Bitte den markierten Text manuell kopieren." : "Kopieren ist hier nicht verfügbar. Die Adresse steht oben im Bereich API-Adresse.";
    }
  });
  const keyForm = panel.querySelector("[data-api-key-form]");
  if (keyForm) {
    const projects = keyForm.querySelector("[data-key-projects]");
    const choices = Array.from(projects.querySelectorAll('input[name="projectIds"]'));
    const validate = () => {
      const selected = keyForm.querySelector('input[name="projectMode"]:checked')?.value === "selected";
      projects.hidden = !selected;
      for (const choice of choices) choice.disabled = !selected;
      const radio = keyForm.querySelector('input[name="projectMode"][value="selected"]');
      radio.setCustomValidity(selected && !choices.some(choice => choice.checked) ? "Bitte mindestens ein Projekt auswählen oder alle eigenen Projekte freigeben." : "");
      const scope = keyForm.querySelector('input[name="scopes"]');
      scope.setCustomValidity(keyForm.querySelector('input[name="scopes"]:checked') ? "" : "Bitte mindestens ein Recht auswählen.");
    };
    keyForm.addEventListener("change", validate);
    for (const preset of keyForm.querySelectorAll("[data-assistant-key-preset]")) preset.addEventListener("click", () => {
      const writable = preset.dataset.assistantKeyPreset === "full" ? ["assistant:write", "projects:write", "devices:write", "exports:write"] : ["assistant:write"];
      for (const input of keyForm.querySelectorAll('input[name="scopes"]')) input.checked = input.value.endsWith(":read") || writable.includes(input.value);
      validate();
    });
    validate();
  }
  const form = panel.querySelector("[data-mcp-setup]");
  const result = form.querySelector("[data-mcp-result]");
  const output = form.querySelector("[data-mcp-config]");
  const token = form.querySelector("[data-mcp-token]");
  const status = form.querySelector("[data-mcp-status]");
  function clearConfiguration() { output.value = ""; result.hidden = true; }
  form.addEventListener("input", () => { clearConfiguration(); status.textContent = ""; });
  panel.querySelector("[data-use-created-key]")?.addEventListener("click", () => {
    token.value = panel.querySelector("[data-created-key]").value;
    clearConfiguration();
    status.textContent = "Schlüssel übernommen. Bitte den Skriptpfad ergänzen und die Konfiguration erstellen.";
    panel.querySelector("#mcp-setup").scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector("[data-mcp-script]").focus({ preventScroll: true });
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    clearConfiguration();
    try {
      const url = new URL(form.querySelector("[data-mcp-url]").value.trim());
      if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw Error("Bitte die Serveradresse ohne Zugangsdaten, Pfad oder Parameter eingeben.");
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw Error("Entfernte Server benötigen eine HTTPS-Adresse.");
      const script = form.querySelector("[data-mcp-script]").value.trim();
      if (!/^(\/|[a-zA-Z]:[\\/]|\\\\)/.test(script) || !/[\\/]edoku-mcp\.js$/.test(script)) throw Error("Bitte den vollständigen Pfad zur Datei edoku-mcp.js auf deinem Computer eingeben.");
      const secret = token.value.trim();
      if (!/^edoku_[a-f0-9]{24}\.[a-f0-9]{64}$/.test(secret)) throw Error("Bitte einen gültigen edoku-API-Schlüssel eintragen.");
      const env = { EDOKU_API_URL: url.origin, EDOKU_API_TOKEN: secret };
      const documentRoot = form.querySelector("[data-mcp-document-root]").value.trim();
      if (documentRoot) {
        if (!/^(\/|[a-zA-Z]:[\\/]|\\\\)/.test(documentRoot)) throw Error("Bitte einen vollständigen lokalen Dokumentordner eingeben.");
        env.EDOKU_MCP_DOCUMENT_ROOT = documentRoot;
      }
      if (form.querySelector("[data-mcp-writes]").checked) env.EDOKU_MCP_ALLOW_WRITES = "true";
      output.value = JSON.stringify({ mcpServers: { edoku: { command: "node", args: [script], env } } }, null, 2);
      result.hidden = false;
      status.textContent = "Konfiguration erstellt. Die Verbindung wird erst in deinem MCP-Client gestartet.";
    } catch (error) { status.textContent = error.message; }
  });
  form.querySelector("[data-clear-mcp]").addEventListener("click", () => {
    token.value = "";
    clearConfiguration();
    const created = panel.querySelector("[data-created-key]");
    if (created) { created.value = ""; panel.querySelector("[data-created-key-panel]").hidden = true; }
    status.textContent = "Schlüssel und Konfiguration wurden aus der Ansicht entfernt.";
  });
  window.addEventListener("pagehide", () => { token.value = ""; clearConfiguration(); });
});
