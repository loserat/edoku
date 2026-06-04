const savedTheme = localStorage.getItem("dm-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

document.addEventListener("DOMContentLoaded", () => {
  const notices = document.querySelectorAll(".notice");
  const themeToggle = document.querySelector("[data-theme-toggle]");

  notices.forEach((notice) => {
    notice.setAttribute("role", "status");
  });

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.dataset.confirm || "Diese Aktion wirklich ausführen?";
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });

  function updateThemeButton(theme) {
    if (!themeToggle) return;
    themeToggle.textContent = theme === "dark" ? "Nacht" : "Tag";
    themeToggle.setAttribute("aria-label", `Theme wechseln, aktuell ${theme === "dark" ? "Nacht" : "Tag"}`);
  }

  updateThemeButton(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("dm-theme", next);
      updateThemeButton(next);
    });
  }

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

  const pdfPreviewSelect = document.querySelector("[data-pdf-preview-select]");
  const pdfPreviewFrame = document.querySelector("[data-pdf-preview-frame]");
  if (pdfPreviewSelect && pdfPreviewFrame) {
    pdfPreviewSelect.addEventListener("change", () => {
      pdfPreviewFrame.src = `${pdfPreviewSelect.value}#toolbar=1`;
    });
  }

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
          `<td data-col="delete"><label class="cell-check"><input type="checkbox" name="geraetelisten[${listIndex}][positionen][${nextIndex}][_delete]" value="1"><span>Löschen</span></label></td>`
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
    addLeistungsbereichButton.addEventListener("click", () => {
      const index = leistungsbereicheBody.querySelectorAll("tr").length;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="text" name="leistungsbereiche[${index}][name]" value="" placeholder="Neuer Leistungsbereich"></td>
        <td>
          <label class="cell-check">
            <input type="checkbox" name="leistungsbereiche[${index}][aktiv]" checked>
            <span>Aktiv</span>
          </label>
        </td>
        <td>
          <label class="cell-check">
            <input type="checkbox" name="leistungsbereiche[${index}][_delete]" value="1">
            <span>Löschen</span>
          </label>
        </td>`;
      leistungsbereicheBody.appendChild(row);
      const newNameInput = row.querySelector("input[type='text']");
      if (newNameInput) {
        newNameInput.dispatchEvent(new Event("input", { bubbles: true }));
        newNameInput.focus();
      }
    });
  }

  document.querySelectorAll("[data-add-system-default]").forEach((button) => {
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
          <label class="cell-check">
            <input type="checkbox" name="${namePrefix}[_delete]" value="1">
            <span>Löschen</span>
          </label>
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
});
