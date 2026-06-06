// Theme wird vor DOMContentLoaded gesetzt, damit beim Laden kein hell/dunkel-Flackern entsteht.
function resolveEdokuThemeMode(mode) {
  if (mode === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode === "dark" ? "dark" : "light";
}

const savedTheme = localStorage.getItem("dm-theme") || window.edokuThemeDefaultMode || "light";
document.documentElement.setAttribute("data-theme", resolveEdokuThemeMode(savedTheme));

document.addEventListener("DOMContentLoaded", () => {
  const notices = document.querySelectorAll(".notice");
  const themeToggle = document.querySelector("[data-theme-toggle]");

  // Statusmeldungen für Screenreader als dynamische Hinweise markieren.
  notices.forEach((notice) => {
    notice.setAttribute("role", "status");
  });

  // Sicherheitsabfrage für Formulare, die eine Bestätigung verlangen.
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (window.edokuDeleteConfirmDialogs === false) return;
      const message = form.dataset.confirm || "Diese Aktion wirklich ausführen?";
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });

  function deleteConfirmDialogsEnabled() {
    return window.edokuDeleteConfirmDialogs !== false;
  }

  function submitAutosaveForm(form) {
    if (!form) return;
    if (form.matches("form[data-autosave]") && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function trashIconMarkup() {
    return `
      <svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"></path>
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <path d="M19 6l-1 16H6L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
      </svg>`;
  }

  // Aktualisiert Beschriftung und Accessibility-Text des Theme-Schalters.
  function updateThemeButton(theme) {
    if (!themeToggle) return;
    const label = themeToggle.querySelector("[data-theme-toggle-label]");
    themeToggle.dataset.themeCurrent = theme;
    if (label) label.textContent = theme === "dark" ? "Nacht" : "Tag";
    themeToggle.setAttribute("aria-label", `Theme wechseln, aktuell ${theme === "dark" ? "Nacht" : "Tag"}`);
    themeToggle.setAttribute("title", `Theme wechseln, aktuell ${theme === "dark" ? "Nacht" : "Tag"}`);
  }

  updateThemeButton(resolveEdokuThemeMode(savedTheme));

  // Tag-/Nacht-Theme lokal im Browser speichern.
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("dm-theme", next);
      updateThemeButton(next);
    });
  }

  const settingsTabs = Array.from(document.querySelectorAll("[data-settings-tab]"));
  const settingsPanels = Array.from(document.querySelectorAll("[data-settings-panel]"));
  if (settingsTabs.length && settingsPanels.length) {
    const storageKey = "edoku-settings-tab";
    const validTabIds = new Set(settingsTabs.map((tab) => tab.dataset.settingsTab));

    // Schaltet Einstellungsbereiche intern um. Es wird kein URL-Hash gesetzt,
    // damit der Browser nicht scrollt und kein Verlaufseintrag entsteht.
    function activateSettingsTab(tabId) {
      const nextTabId = validTabIds.has(tabId) ? tabId : settingsTabs[0].dataset.settingsTab;

      settingsTabs.forEach((tab) => {
        const isActive = tab.dataset.settingsTab === nextTabId;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      settingsPanels.forEach((panel) => {
        panel.hidden = panel.dataset.settingsPanel !== nextTabId;
      });

      localStorage.setItem(storageKey, nextTabId);
    }

    settingsTabs.forEach((tab) => {
      tab.addEventListener("click", () => activateSettingsTab(tab.dataset.settingsTab));
    });

    activateSettingsTab(localStorage.getItem(storageKey));
  }

  // Auto-Save für Formulare mit data-autosave. Änderungen werden verzögert
  // gesendet, parallele Speichervorgänge werden über pending nachgezogen.
  const autosaveForms = Array.from(document.querySelectorAll("form[data-autosave]"));
  if (autosaveForms.length) {
    const autosaveStatus = document.createElement("div");
    autosaveStatus.className = "autosave-status";
    autosaveStatus.textContent = "Auto-Save aktiv";
    document.body.appendChild(autosaveStatus);

    function setAutosaveStatus(text, state = "") {
      autosaveStatus.textContent = text;
      autosaveStatus.dataset.state = state;
    }

    autosaveForms.forEach((form) => {
      let timer = null;
      let saving = false;
      let pending = false;

      async function saveForm() {
        if (saving) {
          pending = true;
          return;
        }

        saving = true;
        pending = false;
        setAutosaveStatus("Speichert...", "saving");

        try {
          const response = await fetch(form.action, {
            method: form.method || "post",
            body: new URLSearchParams(new FormData(form)),
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "Speichern fehlgeschlagen");
          }
          setAutosaveStatus("Gespeichert", "saved");
        } catch (error) {
          setAutosaveStatus(error.message || "Speicherfehler", "error");
        } finally {
          saving = false;
          if (pending) saveForm();
        }
      }

      function scheduleSave(delay = 700) {
        window.clearTimeout(timer);
        setAutosaveStatus("Änderung erkannt", "dirty");
        timer = window.setTimeout(saveForm, delay);
      }

      form.addEventListener("input", (event) => {
        if (event.target.matches("input, select, textarea")) scheduleSave();
      });

      form.addEventListener("change", (event) => {
        if (event.target.matches("input, select, textarea")) scheduleSave(150);
      });

      form.addEventListener("submit", async (event) => {
        if (event.submitter && event.submitter.dataset.noAutosave === "true") return;
        event.preventDefault();
        window.clearTimeout(timer);
        await saveForm();
      });
    });
  }

  // Einheitlicher Löschbutton für wiederholbare Formularbereiche. Der passende
  // Container wird entfernt; dadurch bleiben die bestehenden Backend-Normalisierungen unverändert.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-row]");
    if (!button) return;

    event.preventDefault();
    const label = button.dataset.deleteLabel || "diesen Eintrag";
    if (deleteConfirmDialogsEnabled() && !window.confirm(`${label} wirklich löschen?`)) return;

    const row = button.closest("tr") || button.closest("[data-system-default-card]") || button.closest("[data-leistungsbereich-card]");
    const form = button.closest("form");
    if (row) row.remove();
    submitAutosaveForm(form);
  });

  // Generisches Tab-System. tab-shell ist eine Layout-Sonderform, bei der Panels sichtbar bleiben.
  document.querySelectorAll("[data-tabs]").forEach((tabRoot) => {
    const tabs = Array.from(tabRoot.querySelectorAll("[data-tab-target]"));
    const panels = Array.from(tabRoot.querySelectorAll("[data-tab-panel]"));
    if (tabRoot.classList.contains("tab-shell")) {
      tabs.forEach((tab) => {
        tab.setAttribute("aria-hidden", "true");
        tab.tabIndex = -1;
      });
      panels.forEach((panel) => {
        panel.hidden = false;
        panel.removeAttribute("role");
      });
      return;
    }
    const storageKey = `dm-tab-${window.location.pathname}-${tabRoot.dataset.tabs || "default"}`;

    function activateTab(tabId) {
      const fallback = tabs[0] ? tabs[0].dataset.tabTarget : "";
      const nextTab = tabs.some((tab) => tab.dataset.tabTarget === tabId) ? tabId : fallback;

      tabs.forEach((tab) => {
        const active = tab.dataset.tabTarget === nextTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== nextTab;
      });

      if (nextTab) localStorage.setItem(storageKey, nextTab);
    }

    tabs.forEach((tab) => {
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => activateTab(tab.dataset.tabTarget));
    });

    panels.forEach((panel) => {
      panel.setAttribute("role", "tabpanel");
    });

    activateTab(localStorage.getItem(storageKey));
  });

  // PDF-Vorschau-Iframe aus dem ausgewählten PDF-Pfad aktualisieren.
  const pdfPreviewSelect = document.querySelector("[data-pdf-preview-select]");
  const pdfPreviewFrame = document.querySelector("[data-pdf-preview-frame]");
  if (pdfPreviewSelect && pdfPreviewFrame) {
    pdfPreviewSelect.addEventListener("change", () => {
      pdfPreviewFrame.src = `${pdfPreviewSelect.value}#toolbar=1`;
    });
  }

  const themeEditor = document.querySelector("[data-theme-editor]");
  const themePresetsNode = document.querySelector("#theme-presets-json");
  if (themeEditor) {
    const presets = themePresetsNode ? JSON.parse(themePresetsNode.textContent || "{}") : {};
    const rootStyle = document.documentElement.style;
    const themeAliasMap = {
      "--color-bg-light": [],
      "--color-bg-dark": [],
      "--color-surface": ["--surface-solid"],
      "--color-surface-muted": ["--surface-muted"],
      "--color-surface-dark": [],
      "--color-surface-muted-dark": [],
      "--color-text": ["--text"],
      "--color-text-muted": ["--muted"],
      "--color-text-dark": [],
      "--color-text-muted-dark": [],
      "--color-border": ["--border", "--line"],
      "--color-border-dark": [],
      "--color-primary": ["--accent"],
      "--color-button-primary": ["--primary"],
      "--color-warning": ["--warning"],
      "--color-danger": ["--danger"],
      "--color-success": ["--success"],
      "--radius-button": [],
      "--border-width": [],
      "--spacing-md": [],
      "--page-spacing": [],
      "--card-spacing": [],
      "--form-spacing": [],
      "--table-row-height": [],
      "--font-size-base": [],
      "--font-size-heading": [],
      "--font-size-label": [],
      "--font-size-button": [],
      "--line-height-base": []
    };

    function fieldValue(name, fallback = "") {
      const input = themeEditor.querySelector(`[name="${name}"]`);
      return input ? input.value : fallback;
    }

    // Hält die alten CSS-Aliase synchron, damit bestehende Komponenten sofort
    // auf geänderte Light-/Dark-Farben reagieren.
    function syncResolvedThemeAliases() {
      const isDark = document.documentElement.dataset.theme === "dark";
      const bg = isDark ? fieldValue("bgDark") : fieldValue("bgLight");
      const surface = isDark ? fieldValue("surfaceDark", fieldValue("surface")) : fieldValue("surface");
      const surfaceMuted = isDark ? fieldValue("surfaceMutedDark", fieldValue("surfaceMuted")) : fieldValue("surfaceMuted");
      const text = isDark ? fieldValue("textDark", fieldValue("text")) : fieldValue("text");
      const muted = isDark ? fieldValue("textMutedDark", fieldValue("textMuted")) : fieldValue("textMuted");
      const border = isDark ? fieldValue("borderDark", fieldValue("border")) : fieldValue("border");

      if (bg) rootStyle.setProperty("--bg", bg);
      if (surface) {
        rootStyle.setProperty("--color-surface", surface);
        rootStyle.setProperty("--surface-solid", surface);
        rootStyle.setProperty("--surface", `color-mix(in srgb, ${surface} 82%, transparent)`);
      }
      if (surfaceMuted) {
        rootStyle.setProperty("--color-surface-muted", surfaceMuted);
        rootStyle.setProperty("--surface-muted", `color-mix(in srgb, ${surfaceMuted} 86%, transparent)`);
      }
      if (text) {
        rootStyle.setProperty("--color-text", text);
        rootStyle.setProperty("--text", text);
      }
      if (muted) {
        rootStyle.setProperty("--color-text-muted", muted);
        rootStyle.setProperty("--muted", muted);
      }
      if (border) {
        rootStyle.setProperty("--color-border", border);
        rootStyle.setProperty("--border", `color-mix(in srgb, ${border} 48%, transparent)`);
        rootStyle.setProperty("--line", `color-mix(in srgb, ${border} 48%, transparent)`);
      }
    }

    function applyThemeInput(input) {
      if (!input.dataset.themeVar) return;
      const value = `${input.value}${input.dataset.themeUnit || ""}`;
      rootStyle.setProperty(input.dataset.themeVar, value);
      (themeAliasMap[input.dataset.themeVar] || []).forEach((alias) => rootStyle.setProperty(alias, value));
      if (input.dataset.themeVar === "--color-button-primary") {
        rootStyle.setProperty("--primary-strong", `color-mix(in srgb, ${input.value} 82%, #000)`);
      }
      syncResolvedThemeAliases();
    }

    function applyThemeMode(mode) {
      localStorage.setItem("dm-theme", mode);
      document.documentElement.setAttribute("data-theme", resolveEdokuThemeMode(mode));
      updateThemeButton(resolveEdokuThemeMode(mode));
      syncResolvedThemeAliases();
    }

    function setInput(name, value) {
      const input = themeEditor.querySelector(`[name="${name}"]`);
      if (!input || typeof value === "undefined") return;
      input.value = value;
      applyThemeInput(input);
    }

    function applyPreset(presetKey) {
      const preset = presets[presetKey];
      if (!preset) return;
      setInput("preset", presetKey);
      setInput("name", preset.name || presetKey);
      const modeInput = themeEditor.querySelector(`[name="mode"][value="${preset.mode || "light"}"]`);
      if (modeInput) {
        modeInput.checked = true;
        applyThemeMode(modeInput.value);
      }
      Object.entries(preset.colors || {}).forEach(([key, value]) => setInput(key, value));
      Object.entries(preset.shape || {}).forEach(([key, value]) => setInput(key, value));
      setInput("shadowStrength", preset.shadow ? preset.shadow.strength : "");
      setInput("shadowSoftness", preset.shadow ? preset.shadow.softness : "");
      setInput("globalSpacing", preset.spacing ? preset.spacing.global : "");
      setInput("pageSpacing", preset.spacing ? preset.spacing.page : "");
      setInput("cardSpacing", preset.spacing ? preset.spacing.card : "");
      setInput("formSpacing", preset.spacing ? preset.spacing.form : "");
      setInput("tableRowHeight", preset.spacing ? preset.spacing.tableRowHeight : "");
      setInput("fontSizeBase", preset.typography ? preset.typography.base : "");
      setInput("fontSizeHeading", preset.typography ? preset.typography.heading : "");
      setInput("fontSizeLabel", preset.typography ? preset.typography.label : "");
      setInput("fontSizeButton", preset.typography ? preset.typography.button : "");
      setInput("lineHeightBase", preset.typography ? preset.typography.lineHeight : "");
      syncResolvedThemeAliases();
    }

    themeEditor.querySelectorAll("[data-theme-var]").forEach((input) => {
      input.addEventListener("input", () => applyThemeInput(input));
    });

    themeEditor.querySelectorAll('input[name="mode"]').forEach((input) => {
      input.addEventListener("change", () => applyThemeMode(input.value));
    });

    themeEditor.querySelectorAll("[data-theme-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.themePreset));
    });
  }

  // Standardkapitel beim Upload anhand der gewählten Anhangskategorie setzen.
  const attachmentCategoryDefaultsNode = document.querySelector("#attachment-category-defaults-json");
  if (attachmentCategoryDefaultsNode) {
    const attachmentCategoryDefaults = JSON.parse(attachmentCategoryDefaultsNode.textContent || "{}");
    document.querySelectorAll(".attachment-upload select[name='category']").forEach((select) => {
      select.addEventListener("change", () => {
        const form = select.closest("form");
        const chapterInput = form ? form.querySelector("input[name='kapitel']") : null;
        const defaults = attachmentCategoryDefaults[select.value] || {};
        if (chapterInput && defaults.kapitel) chapterInput.value = defaults.kapitel;
      });
    });
  }

  // Markiert aktive Hash-Tabs in älteren Abschnittsnavigationen.
  const hashSectionLinks = Array.from(document.querySelectorAll(".section-tabs a[href*='#']"));
  if (hashSectionLinks.length) {
    function updateHashTabs() {
      const currentHash = window.location.hash || hashSectionLinks[0].hash;
      hashSectionLinks.forEach((link) => {
        link.classList.toggle("active", link.hash === currentHash);
      });
    }

    hashSectionLinks.forEach((link) => {
      link.addEventListener("click", () => {
        window.setTimeout(updateHashTabs, 0);
      });
    });

    window.addEventListener("hashchange", updateHashTabs);
    updateHashTabs();
  }

  // Sortierbare Tabellen für Brandschutz, Gerätelisten und ähnliche Übersichten.
  document.querySelectorAll("[data-sortable-table]").forEach((table) => {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    function cellValue(row, index) {
      const cell = row.children[index];
      if (!cell) return "";
      if (cell.dataset.sortValue !== undefined) return cell.dataset.sortValue;
      const field = cell.querySelector("input, select, textarea");
      if (field) {
        if (field.type === "checkbox") return field.checked ? "1" : "0";
        return field.value || "";
      }
      return cell.textContent || "";
    }

    table.querySelectorAll("[data-sortable-column]").forEach((header, index) => {
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-sort", "none");

      function sortRows() {
        const direction = header.dataset.sortDirection === "asc" ? "desc" : "asc";
        table.querySelectorAll("[data-sortable-column]").forEach((item) => {
          item.dataset.sortDirection = "";
          item.setAttribute("aria-sort", "none");
        });
        header.dataset.sortDirection = direction;
        header.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");

        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.sort((a, b) => {
          const left = cellValue(a, index).trim();
          const right = cellValue(b, index).trim();
          const numericLeft = Number(left.replace(",", "."));
          const numericRight = Number(right.replace(",", "."));
          const result = !Number.isNaN(numericLeft) && !Number.isNaN(numericRight)
            ? numericLeft - numericRight
            : left.localeCompare(right, "de", { numeric: true, sensitivity: "base" });
          return direction === "asc" ? result : -result;
        });
        rows.forEach((row) => tbody.appendChild(row));
      }

      header.addEventListener("click", sortRows);
      header.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sortRows();
        }
      });
    });
  });

  // Hauptnavigation innerhalb der Gerätelisten: Dashboard oder konkrete Liste anzeigen.
  const deviceMainTabs = document.querySelector("[data-device-main-tabs]");
  if (deviceMainTabs) {
    const buttons = Array.from(deviceMainTabs.querySelectorAll("[data-device-main-target]"));
    const dashboardPanel = document.querySelector("[data-device-dashboard-panel]");
    const summaryPanel = document.querySelector("[data-device-summary]");
    const panels = Array.from(document.querySelectorAll("[data-device-list-panel]"));
    const editPanel = panels[0] ? panels[0].closest(".tab-panel") : null;
    const storageKey = "dm-device-main-tab";

    function activateDeviceList(target) {
      const validTargets = buttons.map((button) => button.dataset.deviceMainTarget);
      const nextTarget = validTargets.includes(target) ? target : "dashboard";

      buttons.forEach((button) => {
        const active = button.dataset.deviceMainTarget === nextTarget;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (dashboardPanel) dashboardPanel.hidden = nextTarget !== "dashboard";
      if (summaryPanel) summaryPanel.hidden = nextTarget !== "dashboard";
      if (editPanel) editPanel.hidden = nextTarget === "dashboard";

      panels.forEach((panel) => {
        panel.hidden = nextTarget === "dashboard" || panel.dataset.deviceListPanel !== nextTarget;
      });

      localStorage.setItem(storageKey, nextTarget);
    }

    buttons.forEach((button) => {
      button.setAttribute("role", "tab");
      button.addEventListener("click", () => activateDeviceList(button.dataset.deviceMainTarget));
    });

    deviceMainTabs.setAttribute("role", "tablist");
    activateDeviceList(localStorage.getItem(storageKey));
  }

  document.querySelectorAll("[data-add-geraet-row]").forEach((button) => {
    const fieldProfilesNode = document.querySelector("#device-field-profiles-json");
    const fieldProfiles = fieldProfilesNode ? JSON.parse(fieldProfilesNode.textContent || "{}") : {};

    // Fügt clientseitig neue Positionszeilen hinzu; gespeichert wird anschließend per Auto-Save.
    button.addEventListener("click", () => {
      const listIndex = button.dataset.listIndex;
      const tbody = document.querySelector(`[data-position-body="${listIndex}"]`);
      const amountInput = button.closest(".add-position-control").querySelector("input[type='number']");
      const amount = Math.min(25, Math.max(1, Number(amountInput.value) || 1));
      let nextIndex = Number(button.dataset.nextIndex) || 0;
      const fields = fieldProfiles[button.dataset.leistungsbereich] || [];

      function escapeAttribute(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll('"', "&quot;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      }

      function cell(field, value = "", extra = "") {
        return `<td data-col="${escapeAttribute(field)}"><input type="text" name="geraetelisten[${listIndex}][positionen][${nextIndex}][${field}]" value="${escapeAttribute(value)}" ${extra}></td>`;
      }

      function fieldCell(field) {
        const defaults = {
          hersteller: button.dataset.defaultHersteller || "",
          system: button.dataset.defaultSystem || ""
        };
        const listAttr = field.suggest === "hersteller"
          ? `list="${button.dataset.herstellerList || ""}" data-device-suggest="hersteller"`
          : field.suggest === "system"
            ? `list="${button.dataset.systemList || ""}" data-device-suggest="system"`
            : field.suggest === "typ"
              ? `list="${button.dataset.typList || ""}" data-device-suggest="typ"`
              : "";
        return cell(field.name, defaults[field.name] || "", listAttr);
      }

      for (let index = 0; index < amount; index += 1) {
        const row = document.createElement("tr");
        const pos = nextIndex + 1;
        row.innerHTML = [
          cell("pos", pos),
          ...fields.map(fieldCell),
          `<td data-col="delete"><button class="row-delete-button danger icon-only-button" type="button" data-delete-row data-delete-label="Geräteposition ${pos}" aria-label="Geräteposition löschen">${trashIconMarkup()}</button></td>`
        ].join("");
        tbody.appendChild(row);
        nextIndex += 1;
      }

      button.dataset.nextIndex = String(nextIndex);
      const firstNewInput = tbody.querySelector(`input[name="geraetelisten[${listIndex}][positionen][${nextIndex - amount}][typ]"]`);
      if (firstNewInput) {
        firstNewInput.dispatchEvent(new Event("input", { bubbles: true }));
        firstNewInput.focus();
      }
    });
  });

  const deviceSuggestionsNode = document.querySelector("#device-suggestions-json");
  const filteredSuggestionsList = document.querySelector("#device-filtered-suggestions");
  if (deviceSuggestionsNode && filteredSuggestionsList) {
    const suggestions = JSON.parse(deviceSuggestionsNode.textContent || "{}");

    // Hersteller-/System-/Typvorschläge werden aus den Systemdefaults gefiltert.
    function normalized(value) {
      return String(value || "").trim().toLowerCase();
    }

    function unique(values) {
      const seen = new Set();
      return values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value) => {
          const key = normalized(value);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    function rowInput(row, field) {
      return row.querySelector(`[data-device-suggest="${field}"]`);
    }

    function currentContext(input) {
      const section = input.closest("[data-suggestion-leistungsbereich]");
      const row = input.closest("tr");
      const leistungsbereich = section ? section.dataset.suggestionLeistungsbereich : "";
      const config = suggestions[leistungsbereich] || {};
      const herstellerValue = rowInput(row, "hersteller") ? rowInput(row, "hersteller").value : "";
      const systemValue = rowInput(row, "system") ? rowInput(row, "system").value : "";
      const hersteller = (config.hersteller || []).find((entry) => normalized(entry.name) === normalized(herstellerValue));
      return { config, hersteller, systemValue };
    }

    function setFilteredOptions(input, values) {
      filteredSuggestionsList.innerHTML = "";
      unique(values).forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        filteredSuggestionsList.appendChild(option);
      });
      input.setAttribute("list", "device-filtered-suggestions");
    }

    function suggestionsFor(input) {
      const field = input.dataset.deviceSuggest;
      const { config, hersteller, systemValue } = currentContext(input);
      if (field === "system") return hersteller ? hersteller.systeme || [] : config.alleSysteme || [];
      if (field === "typ") {
        const typen = hersteller ? hersteller.typen || [] : config.alleTypen || [];
        const filtered = systemValue
          ? typen.filter((typ) => normalized(typ).includes(normalized(systemValue)) || normalized(systemValue).includes(normalized(typ)))
          : typen;
        return filtered.length ? filtered : typen;
      }
      return config.alleHersteller || [];
    }

    document.addEventListener("focusin", (event) => {
      if (!event.target.matches("[data-device-suggest]")) return;
      setFilteredOptions(event.target, suggestionsFor(event.target));
    });

    document.addEventListener("input", (event) => {
      if (!event.target.matches("[data-device-suggest]")) return;
      const row = event.target.closest("tr");
      if (event.target.dataset.deviceSuggest === "hersteller" && rowInput(row, "system")) {
        setFilteredOptions(rowInput(row, "system"), suggestionsFor(rowInput(row, "system")));
      }
      if (event.target.dataset.deviceSuggest === "system" && rowInput(row, "typ")) {
        setFilteredOptions(rowInput(row, "typ"), suggestionsFor(rowInput(row, "typ")));
      }
    });
  }

  const addLeistungsbereichButton = document.querySelector("[data-add-leistungsbereich]");
  const leistungsbereicheBody = document.querySelector("[data-leistungsbereiche-body]");
  if (addLeistungsbereichButton && leistungsbereicheBody) {
    const openStateKey = "edoku-leistungsbereiche-open";

    function leistungsbereichStateKey(card, fallbackIndex = 0) {
      const input = card ? card.querySelector("[data-leistungsbereich-name]") : null;
      return (input && input.value.trim()) || `index-${fallbackIndex}`;
    }

    function readOpenState() {
      try {
        return JSON.parse(localStorage.getItem(openStateKey) || "{}");
      } catch (error) {
        return {};
      }
    }

    function writeOpenState() {
      const state = {};
      leistungsbereicheBody.querySelectorAll("[data-leistungsbereich-card]").forEach((card, index) => {
        state[leistungsbereichStateKey(card, index)] = card.open;
      });
      localStorage.setItem(openStateKey, JSON.stringify(state));
    }

    function syncLeistungsbereichCardName(card) {
      const nameInput = card ? card.querySelector("[data-leistungsbereich-name]") : null;
      if (!nameInput) return;
      const value = nameInput.value.trim();
      card.querySelectorAll("[data-template-leistungsbereich-name]").forEach((input) => {
        input.value = value;
      });
      const title = card.querySelector("summary strong");
      if (title) title.textContent = value || "Neuer Leistungsbereich";
      const activeText = card.querySelector("summary small");
      const activeInput = card.querySelector('input[name$="[aktiv]"]');
      if (activeText && activeInput) activeText.textContent = activeInput.checked ? "aktiv" : "inaktiv";
    }

    const existingState = readOpenState();
    leistungsbereicheBody.querySelectorAll("[data-leistungsbereich-card]").forEach((card, index) => {
      syncLeistungsbereichCardName(card);
      const key = leistungsbereichStateKey(card, index);
      card.open = existingState[key] === true;
      card.addEventListener("toggle", writeOpenState);
    });

    leistungsbereicheBody.addEventListener("input", (event) => {
      if (!event.target.matches("[data-leistungsbereich-name]")) return;
      syncLeistungsbereichCardName(event.target.closest("[data-leistungsbereich-card]"));
      writeOpenState();
    });

    leistungsbereicheBody.addEventListener("change", (event) => {
      if (!event.target.matches('input[name$="[aktiv]"]')) return;
      syncLeistungsbereichCardName(event.target.closest("[data-leistungsbereich-card]"));
    });

    // Ergänzt einen neuen klappbaren Leistungsbereich inklusive leerer Formulartexte.
    addLeistungsbereichButton.addEventListener("click", () => {
      const index = leistungsbereicheBody.querySelectorAll("[data-leistungsbereich-card]").length;
      const templateSource = document.getElementById("form-template-names-json");
      let templates = {};
      if (templateSource) {
        try {
          templates = JSON.parse(templateSource.textContent || "{}");
        } catch (error) {
          console.warn("Formularvorlagen konnten nicht für den neuen Leistungsbereich gelesen werden.", error);
        }
      }
      const card = document.createElement("details");
      card.className = "leistungsbereich-list-row";
      card.dataset.leistungsbereichCard = "true";
      card.open = true;
      const templateCards = Object.entries(templates)
        .map(([key, label]) => `
          <article class="variant-text template-text-card">
            <div class="template-text-card-head">
              <span>${label}</span>
              <label class="switch-control">
                <input type="hidden" name="templates[${key}][leistungsbereichFormulare][${index}][erzeugen]" value="false">
                <input type="checkbox" name="templates[${key}][leistungsbereichFormulare][${index}][erzeugen]" checked>
                <span class="switch-track" aria-hidden="true"></span>
                <span>erzeugen</span>
              </label>
            </div>
            <input type="hidden" data-template-leistungsbereich-name name="templates[${key}][leistungsbereichFormulare][${index}][leistungsbereich]" value="">
            <textarea name="templates[${key}][leistungsbereichFormulare][${index}][text]" rows="4"></textarea>
          </article>`)
        .join("");
      card.innerHTML = `
        <summary class="leistungsbereich-row-summary">
          <span class="leistungsbereich-summary-title">
            <strong>Neuer Leistungsbereich</strong>
            <small>aktiv</small>
          </span>
          <i aria-hidden="true"></i>
        </summary>
        <div class="leistungsbereich-config-body">
          <section class="leistungsbereich-config-section">
            <div class="form-grid compact">
              <label>
                <span>Name</span>
                <input type="text" data-leistungsbereich-name name="leistungsbereiche[${index}][name]" value="" placeholder="Neuer Leistungsbereich">
              </label>
              <label class="switch-control">
                <input type="checkbox" name="leistungsbereiche[${index}][aktiv]" checked>
                <span class="switch-track" aria-hidden="true"></span>
                <span>Aktiv</span>
              </label>
              <button class="row-delete-button danger icon-only-button" type="button" data-delete-row data-delete-label="Leistungsbereich" aria-label="Leistungsbereich löschen">${trashIconMarkup()}</button>
            </div>
          </section>
          <section class="leistungsbereich-config-section">
            <div class="edit-section-head">
              <div>
                <h2>Formulargenerator</h2>
                <p>Texte für automatisch erzeugte Formulare dieses Leistungsbereichs.</p>
              </div>
            </div>
            <div class="template-text-grid">${templateCards}</div>
          </section>
        </div>`;
      const newNameInput = card.querySelector("[data-leistungsbereich-name]");
      leistungsbereicheBody.appendChild(card);
      card.addEventListener("toggle", writeOpenState);
      syncLeistungsbereichCardName(card);
      if (newNameInput) {
        newNameInput.dispatchEvent(new Event("input", { bubbles: true }));
        newNameInput.focus();
      }
    });
  }

  document.querySelectorAll("[data-add-system-default]").forEach((button) => {
    // Fügt einen neuen Herstellerblock in den Systemdefaults hinzu.
    button.addEventListener("click", () => {
      const bereichIndex = button.dataset.addSystemDefault;
      const container = document.querySelector(`[data-system-defaults-body="${bereichIndex}"]`);
      if (!container) return;
      const index = container.querySelectorAll("[data-system-default-card]").length;
      const namePrefix = `systemDefaults[${bereichIndex}][hersteller][${index}]`;
      const card = document.createElement("article");
      card.className = "system-default-card";
      card.dataset.systemDefaultCard = "true";
      card.innerHTML = `
        <div class="system-default-card-head">
          <div>
            <span>Systemhersteller</span>
            <strong>Neuer Hersteller</strong>
          </div>
          <button class="row-delete-button danger icon-only-button" type="button" data-delete-row data-delete-label="Systemhersteller" aria-label="Systemhersteller löschen">${trashIconMarkup()}</button>
        </div>
        <div class="form-grid compact">
          <label>
            <span>Systemhersteller</span>
            <input type="text" name="${namePrefix}[name]" value="" placeholder="Hersteller">
          </label>
          <label>
            <span>Gerätelisten-Kapitel</span>
            <input type="text" name="${namePrefix}[geraetelisteKapitel]" value="" placeholder="z. B. 6.4">
          </label>
          <label>
            <span>Bemerkung</span>
            <input type="text" name="${namePrefix}[bemerkung]" value="">
          </label>
        </div>
        <div class="system-default-levels">
          <label>
            <span>1. Systemarten</span>
            <textarea rows="5" name="${namePrefix}[systemarten]" placeholder="Systemart je Zeile"></textarea>
          </label>
          <label>
            <span>2. Systeme vom Hersteller</span>
            <textarea rows="5" name="${namePrefix}[systeme]" placeholder="System vom Hersteller je Zeile"></textarea>
          </label>
          <label>
            <span>3. Typvorschläge</span>
            <textarea rows="5" name="${namePrefix}[typen]" placeholder="Typ je Zeile"></textarea>
          </label>
          <label>
            <span>4. Dokumentarten</span>
            <textarea rows="5" name="${namePrefix}[dokumentarten]" placeholder="Dokumentart je Zeile"></textarea>
          </label>
          <label>
            <span>5. Kapitel</span>
            <textarea rows="5" name="${namePrefix}[kapitel]" placeholder="Kapitel je Zeile"></textarea>
          </label>
        </div>`;
      container.appendChild(card);
      const firstInput = card.querySelector("input[type='text']");
      if (firstInput) {
        firstInput.dispatchEvent(new Event("input", { bubbles: true }));
        firstInput.focus();
      }
    });
  });

  const templatePreview = document.querySelector("[data-template-preview]");
  if (templatePreview) {
    const previewKey = templatePreview.dataset.templatePreview;
    const fields = document.querySelectorAll(`[data-template-key="${previewKey}"]`);

    // Live-Vorschau für den Formulargenerator in den Einstellungen.
    function templateField(name) {
      return document.querySelector(`[data-template-key="${previewKey}"][data-template-field="${name}"]`);
    }

    function setHidden(selector, hidden) {
      const node = templatePreview.querySelector(selector);
      if (node) node.hidden = hidden;
    }

    function updateTemplatePreview() {
      const prefix = templateField("titelPraefix") ? templateField("titelPraefix").value : "";
      const fallback = templateField("titelFallback") ? templateField("titelFallback").value : "";
      const title = templatePreview.querySelector("[data-preview-title]");
      if (title) {
        title.textContent = `${prefix}${fallback || "Formular"}`;
        title.style.textAlign = templateField("titleAlign") ? templateField("titleAlign").value : "left";
      }

      const body = templatePreview.querySelector("[data-preview-body]");
      if (body && templateField("bodyText")) body.textContent = templateField("bodyText").value;

      const signature = templatePreview.querySelector("[data-preview-signature-label]");
      if (signature && templateField("signatureLabel")) signature.textContent = templateField("signatureLabel").value;

      if (templateField("fontSizeTitle")) {
        templatePreview.style.setProperty("--preview-title-size", `${templateField("fontSizeTitle").value}px`);
      }
      if (templateField("fontSizeBody")) {
        templatePreview.style.setProperty("--preview-body-size", `${templateField("fontSizeBody").value}px`);
      }
      if (templateField("margin")) {
        templatePreview.style.setProperty("--preview-margin", `${templateField("margin").value}px`);
      }

      setHidden("[data-preview-project]", templateField("showProjectHeader") && !templateField("showProjectHeader").checked);
      setHidden("[data-preview-leistungsbereich]", templateField("showLeistungsbereich") && !templateField("showLeistungsbereich").checked);
      setHidden("[data-preview-normen]", templateField("showNormen") && !templateField("showNormen").checked);
      setHidden("[data-preview-signature]", templateField("showSignature") && !templateField("showSignature").checked);
      setHidden("[data-preview-footer]", templateField("showFooter") && !templateField("showFooter").checked);
    }

    fields.forEach((field) => {
      field.addEventListener("input", updateTemplatePreview);
      field.addEventListener("change", updateTemplatePreview);
    });
    updateTemplatePreview();
  }

  const systemConfigNode = document.querySelector("#system-config-json");
  if (systemConfigNode) {
    const systemConfig = JSON.parse(systemConfigNode.textContent);
    const byName = new Map((systemConfig.leistungsbereiche || []).map((entry) => [entry.name, entry]));

    // Aktualisiert abhängige System-/Dokumentart-Auswahlen nach Herstellerwechsel.
    document.querySelectorAll("[data-system-hersteller]").forEach((select) => {
      select.addEventListener("change", () => {
        const section = select.closest("[data-system-section]");
        const bereich = byName.get(section.dataset.leistungsbereich);
        const hersteller = (bereich.hersteller || []).find((entry) => entry.name === select.value) || {};
        const systemartSelect = section.querySelector("[data-systemart-select]");
        const herstellerSystemSelect = section.querySelector("[data-hersteller-system-select]");
        const dokumentarten = section.querySelector("[data-dokumentarten]");

        systemartSelect.innerHTML = "";
        (hersteller.systemarten || []).forEach((systemart) => {
          const option = document.createElement("option");
          option.value = systemart;
          option.textContent = systemart;
          systemartSelect.appendChild(option);
        });

        if (herstellerSystemSelect) {
          herstellerSystemSelect.innerHTML = "";
          (hersteller.systeme || []).forEach((system) => {
            const option = document.createElement("option");
            option.value = system;
            option.textContent = system;
            herstellerSystemSelect.appendChild(option);
          });
        }

        dokumentarten.querySelectorAll("label").forEach((label) => label.remove());
        (hersteller.dokumentarten || []).forEach((dokumentart) => {
          const label = document.createElement("label");
          label.className = "checkbox-card compact";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.name = dokumentarten.dataset.namePrefix;
          input.value = dokumentart;
          input.checked = true;
          const span = document.createElement("span");
          span.textContent = dokumentart;
          label.append(input, span);
          dokumentarten.appendChild(label);
        });
      });
    });
  }

  const pdfModal = document.querySelector("[data-pdf-modal]");
  if (pdfModal) {
    const pdfFrame = pdfModal.querySelector("[data-pdf-modal-frame]");
    const pdfTitle = pdfModal.querySelector("[data-pdf-modal-title]");

    // Öffnet vorhandene Projekt-PDFs in einem Overlay, ohne die aktuelle Seite zu verlassen.
    function openPdfModal(button) {
      const source = button.dataset.pdfSrc;
      if (!source || !pdfFrame) return;
      if (pdfTitle) pdfTitle.textContent = button.dataset.pdfTitle || "PDF-Vorschau";
      pdfFrame.src = source;
      pdfModal.hidden = false;
      document.body.classList.add("modal-open");
    }

    function closePdfModal() {
      pdfModal.hidden = true;
      if (pdfFrame) pdfFrame.src = "about:blank";
      document.body.classList.remove("modal-open");
    }

    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("[data-pdf-modal-open]");
      if (openButton) {
        event.preventDefault();
        openPdfModal(openButton);
        return;
      }

      if (event.target.closest("[data-pdf-modal-close]")) {
        event.preventDefault();
        closePdfModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!pdfModal.hidden && event.key === "Escape") closePdfModal();
    });
  }
});
