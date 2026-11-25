// * INFO: Unterstützt sowohl die aktuelle verschachtelte Systemstruktur als auch ältere
// * INFO: flache Systemlisten aus frühen Projektständen.
function normalizeSystemConfig(raw) {
  if (raw && Array.isArray(raw.leistungsbereiche)) {
    return raw;
  }

  if (Array.isArray(raw)) {
    const byLeistungsbereich = new Map();
    raw.forEach((entry) => {
      if (!entry.leistungsbereich || !entry.hersteller) return;
      if (!byLeistungsbereich.has(entry.leistungsbereich)) {
        byLeistungsbereich.set(entry.leistungsbereich, {
          name: entry.leistungsbereich,
          code: "",
          beschreibung: "",
          hersteller: []
        });
      }
      byLeistungsbereich.get(entry.leistungsbereich).hersteller.push({
        name: entry.hersteller,
        systeme: entry.system ? [entry.system] : [],
        systemarten: entry.system ? [entry.system] : [],
        typen: [],
        dokumentarten: [],
        normen: entry.normen || [],
        kapitel: entry.zugeordneteKapitel || [],
        geraetelisteKapitel: "",
        bemerkung: (entry.normen || []).join(", ")
      });
    });
    return { leistungsbereiche: [...byLeistungsbereich.values()] };
  }

  return { leistungsbereiche: [] };
}

// Belegte Sondertypen ergänzen nur dieses Projekt; globale Vorgaben bleiben erhalten.
function projectSystemCatalog(raw, project = {}) {
  const config = structuredClone(normalizeSystemConfig(raw));
  for (const item of project.systemErgaenzungen || []) {
    const area = config.leistungsbereiche.find(entry => entry.name === item.leistungsbereich);
    if (!area || !item.evidence || !item.hersteller) continue;
    let manufacturer = area.hersteller.find(entry => entry.name === item.hersteller);
    if (!manufacturer) {
      const defaults = area.hersteller[0] || {};
      manufacturer = { name: item.hersteller, systemarten: [], systeme: [], typen: [], dokumentarten: [...(defaults.dokumentarten || [])], normen: [...(defaults.normen || [])], kapitel: [...(defaults.kapitel || [])], geraetelisteKapitel: defaults.geraetelisteKapitel || "" };
      area.hersteller.push(manufacturer);
    }
    for (const [field, key] of [["systemart", "systemarten"], ["herstellerSystem", "systeme"]]) if (item[field]) manufacturer[key] = [...new Set([...(manufacturer[key] || []), item[field]])];
  }
  return config;
}

// * INFO: Textarea-/CSV-Eingaben aus Einstellungsformularen in Listen umwandeln.
function listFromText(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// * INFO: Normalisiert bearbeitete Systemvorgaben aus dem Einstellungsformular.
function normalizePostedSystemConfig(posted) {
  const entries = Array.isArray(posted) ? posted : Object.values(posted || {});
  const leistungsbereiche = entries
    .filter((entry) => entry && String(entry.name || "").trim())
    .map((entry) => {
      const herstellerRows = Array.isArray(entry.hersteller)
        ? entry.hersteller
        : Object.values(entry.hersteller || {});
      const hersteller = herstellerRows
        .filter((row) => row && row._delete !== "1" && String(row.name || "").trim())
        .map((row) => ({
          name: String(row.name || "").trim(),
          systeme: listFromText(row.systeme),
          systemarten: listFromText(row.systemarten),
          typen: listFromText(row.typen),
          dokumentarten: listFromText(row.dokumentarten),
          normen: listFromText(row.normen),
          kapitel: listFromText(row.kapitel),
          geraetelisteKapitel: String(row.geraetelisteKapitel || "").trim(),
          bemerkung: String(row.bemerkung || "").trim()
        }));

      return {
        name: String(entry.name || "").trim(),
        code: String(entry.code || "").trim(),
        beschreibung: String(entry.beschreibung || "").trim(),
        hersteller
      };
    });

  return { leistungsbereiche };
}

// * INFO: Liefert die Systemvorgaben für einen konkreten Leistungsbereich.
function getLeistungsbereichConfig(systemConfig, leistungsbereich) {
  const config = normalizeSystemConfig(systemConfig);
  return config.leistungsbereiche.find((entry) => entry.name === leistungsbereich);
}

// * INFO: Erstellt eine Projektauswahl aus dem ersten verfügbaren Hersteller/System.
function defaultSelectionForLeistungsbereich(configEntry, aktiv) {
  const firstHersteller = (configEntry.hersteller || [])[0] || {};
  return {
    leistungsbereich: configEntry.name,
    code: configEntry.code || "",
    aktiv,
    hersteller: firstHersteller.name || "",
    systemart: (firstHersteller.systemarten || [])[0] || "",
    herstellerSystem: (firstHersteller.systeme || [])[0] || "",
    dokumentarten: firstHersteller.dokumentarten || [],
    normen: firstHersteller.normen || [],
    kapitel: firstHersteller.kapitel || [],
    geraetelisteKapitel: firstHersteller.geraetelisteKapitel || "",
    herstellerOptionen: (configEntry.hersteller || []).map((hersteller) => hersteller.name)
  };
}

// * INFO: Holt Herstellerkonfiguration oder fällt auf den ersten Hersteller zurück.
function selectedHerstellerConfig(configEntry, herstellerName) {
  return (configEntry.hersteller || []).find((hersteller) => hersteller.name === herstellerName)
    || (configEntry.hersteller || [])[0]
    || {};
}

// * INFO: Synchronisiert die projektspezifische Systemauswahl mit aktiven Leistungsbereichen.
function syncProjektSysteme(systemConfig, existingSelections, aktiveLeistungsbereiche) {
  const config = normalizeSystemConfig(systemConfig);
  const activeSet = new Set(aktiveLeistungsbereiche || []);
  const existing = systemSelectionsWithIds(existingSelections);
  const result = [];
  config.leistungsbereiche.forEach(configEntry => {
    const rows = existing.filter(selection => selection.leistungsbereich === configEntry.name);
    if (!rows.length) { result.push(defaultSelectionForLeistungsbereich(configEntry, activeSet.has(configEntry.name))); return; }
    for (const selection of rows) {
      const manufacturer = selectedHerstellerConfig(configEntry, selection.hersteller);
      result.push({ ...selection,
        aktiv: activeSet.has(configEntry.name) && selection.enabled !== false,
        hersteller: selection.hersteller || manufacturer.name || '',
        systemart: selection.systemart ?? (manufacturer.systemarten || [])[0] ?? '',
        herstellerSystem: selection.herstellerSystem ?? (manufacturer.systeme || [])[0] ?? '',
        dokumentarten: selection.dokumentarten ?? manufacturer.dokumentarten ?? [],
        normen: selection.normen ?? manufacturer.normen ?? [],
        kapitel: selection.kapitel ?? manufacturer.kapitel ?? [],
        geraetelisteKapitel: selection.geraetelisteKapitel || manufacturer.geraetelisteKapitel || '',
        herstellerOptionen: (configEntry.hersteller || []).map(item => item.name)
      });
    }
  });
  for (const selection of existing) if (!config.leistungsbereiche.some(item => item.name === selection.leistungsbereich)) {
    result.push({ ...selection, aktiv: activeSet.has(selection.leistungsbereich) && selection.enabled !== false });
  }

  return systemSelectionsWithIds(result);
}

// * INFO: Normalisiert gespeicherte Projekt-Systemauswahl aus Formularwerten.
function normalizePostedProjektSysteme(posted, systemConfig, aktiveLeistungsbereiche) {
  const config = normalizeSystemConfig(systemConfig);
  const activeSet = new Set(aktiveLeistungsbereiche || []);
  const entries = Array.isArray(posted) ? posted : Object.values(posted || {});

  return entries
    .filter((entry) => entry && entry.leistungsbereich)
    .map((entry) => {
      const configEntry = getLeistungsbereichConfig(config, entry.leistungsbereich) || { hersteller: [] };
      const herstellerConfig = selectedHerstellerConfig(configEntry, entry.hersteller);
      const dokumentarten = Array.isArray(entry.dokumentarten)
        ? entry.dokumentarten
        : entry.dokumentarten
          ? [entry.dokumentarten]
          : [];

      return {
        ...entry,
        leistungsbereich: entry.leistungsbereich,
        code: entry.code || configEntry.code || "",
        enabled: entry.enabled !== false,
        aktiv: activeSet.has(entry.leistungsbereich) && entry.enabled !== false,
        hersteller: entry.hersteller || herstellerConfig.name || "",
        systemart: entry.systemart ?? (herstellerConfig.systemarten || [])[0] ?? "",
        herstellerSystem: entry.herstellerSystem ?? (herstellerConfig.systeme || [])[0] ?? "",
        dokumentarten,
        normen: herstellerConfig.normen || [],
        kapitel: herstellerConfig.kapitel || [],
        geraetelisteKapitel: herstellerConfig.geraetelisteKapitel || "",
        herstellerOptionen: (configEntry.hersteller || []).map((hersteller) => hersteller.name)
      };
    });
}

// * INFO: Kompatibilitätsschicht für ältere Views, die noch flache Systemlisten erwarten.
function flattenSystemConfigForLegacy(systemConfig) {
  const config = normalizeSystemConfig(systemConfig);
  return config.leistungsbereiche.flatMap((leistungsbereich) =>
    (leistungsbereich.hersteller || []).map((hersteller) => ({
      id: `${leistungsbereich.code || leistungsbereich.name}-${hersteller.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      leistungsbereich: leistungsbereich.name,
      hersteller: hersteller.name,
      system: (hersteller.systemarten || [])[0] || "",
      herstellerSystem: (hersteller.systeme || [])[0] || "",
      normen: hersteller.dokumentarten || [],
      zugeordneteKapitel: hersteller.kapitel || []
    }))
  );
}

// * INFO: Sammelt aktive Kapitel aus der projektspezifischen Systemauswahl.
function kapitelFromProjektSysteme(projektSysteme) {
  const kapitel = new Set();
  (projektSysteme || [])
    .filter((entry) => entry.aktiv)
    .forEach((entry) => {
      (entry.kapitel || []).forEach((nummer) => kapitel.add(nummer));
    });
  return kapitel;
}

// * INFO: Map-Zugriff für Templates: Leistungsbereich -> Auswahl.
function systemSelectionsWithIds(entries = []) {
  const counts = new Map();
  return entries.map(entry => {
    const index = counts.get(entry.leistungsbereich) || 0; counts.set(entry.leistungsbereich,index+1);
    const selectionId = entry.selectionId || 'sys_' + require('node:crypto').createHash('sha256').update(entry.leistungsbereich + ':' + index).digest('hex').slice(0,24);
    return { ...entry, selectionId };
  });
}

function selectionByLeistungsbereich(projektSysteme) {
  const grouped = new Map();
  for (const entry of systemSelectionsWithIds(projektSysteme)) {
    if (!grouped.has(entry.leistungsbereich)) grouped.set(entry.leistungsbereich, []);
    grouped.get(entry.leistungsbereich).push(entry);
  }
  return new Map([...grouped].map(([area, selections]) => {
    const active=selections.filter(entry=>entry.aktiv!==false && entry.enabled!==false);
    const summary={...selections[0],leistungsbereich:area,aktiv:active.length>0,selections};
    for(const key of ['hersteller','systemart','herstellerSystem']) summary[key]=uniqueValues(active.map(entry=>entry[key])).join(' / ');
    for(const key of ['normen','kapitel','dokumentarten']) summary[key]=uniqueValues(active.flatMap(entry=>entry[key]||[]));
    return [area,summary];
  }));
}

// * INFO: Doppelte Vorschlagswerte entfernen, ohne die sichtbare Schreibweise zu verändern.
function uniqueValues(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// * INFO: Erstellt Hersteller-, System- und Typvorschläge für die Eingabe in Gerätelisten.
function buildGeraetelistenSuggestions(systemConfig) {
  const config = normalizeSystemConfig(systemConfig);
  return Object.fromEntries(config.leistungsbereiche.map((bereich) => {
    const hersteller = (bereich.hersteller || []).map((entry) => {
      const systemarten = uniqueValues(entry.systemarten || []);
      const herstellerSysteme = uniqueValues(entry.systeme || []);
      const typen = uniqueValues([...(entry.typen || []), ...herstellerSysteme]);
      return {
        name: entry.name || "",
        systeme: uniqueValues([...systemarten, ...herstellerSysteme]),
        typen: typen.length ? typen : systemarten
      };
    }).filter((entry) => entry.name);

    return [bereich.name, {
      hersteller,
      alleHersteller: uniqueValues(hersteller.map((entry) => entry.name)),
      alleSysteme: uniqueValues(hersteller.flatMap((entry) => entry.systeme)),
      alleTypen: uniqueValues(hersteller.flatMap((entry) => entry.typen))
    }];
  }));
}

module.exports = {
  systemSelectionsWithIds,
  projectSystemCatalog,
  buildGeraetelistenSuggestions,
  flattenSystemConfigForLegacy,
  getLeistungsbereichConfig,
  kapitelFromProjektSysteme,
  normalizePostedProjektSysteme,
  normalizePostedSystemConfig,
  normalizeSystemConfig,
  selectedHerstellerConfig,
  selectionByLeistungsbereich,
  syncProjektSysteme
};
