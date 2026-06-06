// Unterstützt sowohl die aktuelle verschachtelte Systemstruktur als auch ältere
// flache Systemlisten aus frühen Projektständen.
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

// Textarea-/CSV-Eingaben aus Einstellungsformularen in Listen umwandeln.
function listFromText(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Normalisiert bearbeitete Systemvorgaben aus dem Einstellungsformular.
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

// Liefert die Systemvorgaben für einen konkreten Leistungsbereich.
function getLeistungsbereichConfig(systemConfig, leistungsbereich) {
  const config = normalizeSystemConfig(systemConfig);
  return config.leistungsbereiche.find((entry) => entry.name === leistungsbereich);
}

// Erstellt eine Projektauswahl aus dem ersten verfügbaren Hersteller/System.
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

// Holt Herstellerkonfiguration oder fällt auf den ersten Hersteller zurück.
function selectedHerstellerConfig(configEntry, herstellerName) {
  return (configEntry.hersteller || []).find((hersteller) => hersteller.name === herstellerName)
    || (configEntry.hersteller || [])[0]
    || {};
}

// Synchronisiert die projektspezifische Systemauswahl mit aktiven Leistungsbereichen.
function syncProjektSysteme(systemConfig, existingSelections, aktiveLeistungsbereiche) {
  const config = normalizeSystemConfig(systemConfig);
  const activeSet = new Set(aktiveLeistungsbereiche || []);
  const existingByName = new Map((existingSelections || []).map((selection) => [selection.leistungsbereich, selection]));
  const result = [];

  config.leistungsbereiche.forEach((configEntry) => {
    const existing = existingByName.get(configEntry.name);
    if (!existing) {
      result.push(defaultSelectionForLeistungsbereich(configEntry, activeSet.has(configEntry.name)));
      return;
    }

    const herstellerConfig = selectedHerstellerConfig(configEntry, existing.hersteller);
    result.push({
      leistungsbereich: configEntry.name,
      code: configEntry.code || existing.code || "",
      aktiv: activeSet.has(configEntry.name),
      hersteller: existing.hersteller || herstellerConfig.name || "",
      systemart: existing.systemart || (herstellerConfig.systemarten || [])[0] || "",
      herstellerSystem: existing.herstellerSystem || (herstellerConfig.systeme || [])[0] || "",
      dokumentarten: existing.dokumentarten && existing.dokumentarten.length ? existing.dokumentarten : herstellerConfig.dokumentarten || [],
      normen: existing.normen && existing.normen.length ? existing.normen : herstellerConfig.normen || [],
      kapitel: existing.kapitel && existing.kapitel.length ? existing.kapitel : herstellerConfig.kapitel || [],
      geraetelisteKapitel: existing.geraetelisteKapitel || herstellerConfig.geraetelisteKapitel || "",
      herstellerOptionen: (configEntry.hersteller || []).map((hersteller) => hersteller.name)
    });
  });

  existingByName.forEach((selection, leistungsbereich) => {
    if (!result.some((entry) => entry.leistungsbereich === leistungsbereich)) {
      result.push({
        ...selection,
        aktiv: activeSet.has(leistungsbereich)
      });
    }
  });

  return result;
}

// Normalisiert gespeicherte Projekt-Systemauswahl aus Formularwerten.
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
        leistungsbereich: entry.leistungsbereich,
        code: entry.code || configEntry.code || "",
        aktiv: activeSet.has(entry.leistungsbereich),
        hersteller: entry.hersteller || herstellerConfig.name || "",
        systemart: entry.systemart || (herstellerConfig.systemarten || [])[0] || "",
        herstellerSystem: entry.herstellerSystem || (herstellerConfig.systeme || [])[0] || "",
        dokumentarten,
        normen: herstellerConfig.normen || [],
        kapitel: herstellerConfig.kapitel || [],
        geraetelisteKapitel: herstellerConfig.geraetelisteKapitel || "",
        herstellerOptionen: (configEntry.hersteller || []).map((hersteller) => hersteller.name)
      };
    });
}

// Kompatibilitätsschicht für ältere Views, die noch flache Systemlisten erwarten.
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

// Sammelt aktive Kapitel aus der projektspezifischen Systemauswahl.
function kapitelFromProjektSysteme(projektSysteme) {
  const kapitel = new Set();
  (projektSysteme || [])
    .filter((entry) => entry.aktiv)
    .forEach((entry) => {
      (entry.kapitel || []).forEach((nummer) => kapitel.add(nummer));
    });
  return kapitel;
}

// Map-Zugriff für Templates: Leistungsbereich -> Auswahl.
function selectionByLeistungsbereich(projektSysteme) {
  return new Map((projektSysteme || []).map((entry) => [entry.leistungsbereich, entry]));
}

// Doppelte Vorschlagswerte entfernen, ohne die sichtbare Schreibweise zu verändern.
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

// Erstellt Hersteller-, System- und Typvorschläge für die Eingabe in Gerätelisten.
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
