// * INFO: Default-Layouts und Textbausteine für generierte Formulare.
// * INFO: Gespeicherte Konfigurationen können diese Werte überschreiben.
const DEFAULT_FORM_TEMPLATES = {
  konformitaet: {
    name: "Konformitätserklärung",
    titelPraefix: "",
    titelFallback: "Konformitätserklärung",
    showProjectHeader: true,
    showLeistungsbereich: true,
    showNormen: true,
    showSignature: true,
    showFooter: true,
    fontSizeTitle: 18,
    fontSizeBody: 10,
    margin: 48,
    spacing: 1,
    titleAlign: "left",
    bodyText:
      "Hiermit wird bestätigt, dass die ausgeführten Leistungen im oben genannten Leistungsbereich entsprechend den öffentlich-rechtlichen Anforderungen, den allgemein anerkannten Regeln der Technik sowie den einschlägigen technischen Bestimmungen ausgeführt wurden.",
    textVarianten: {
      default: {
        label: "Standard",
        match: [],
        text: "Hiermit wird bestätigt, dass die ausgeführten Leistungen im oben genannten Leistungsbereich entsprechend den öffentlich-rechtlichen Anforderungen, den allgemein anerkannten Regeln der Technik sowie den einschlägigen technischen Bestimmungen ausgeführt wurden."
      },
      elektroinstallation: {
        label: "Elektroinstallation / DIN VDE 0100",
        match: ["Elektroinstallation / DIN VDE 0100"],
        text: "Hiermit wird bestätigt, dass die elektrische Anlage nach DIN VDE 0100, den allgemein anerkannten Regeln der Technik sowie den projektspezifischen Vorgaben errichtet und dokumentiert wurde."
      },
      sicherheitsbeleuchtung: {
        label: "Sicherheitsbeleuchtung / DIN EN 1838",
        match: ["Sicherheitsbeleuchtung"],
        text: "Hiermit wird bestätigt, dass die Sicherheitsbeleuchtungsanlage nach DIN EN 1838 sowie nach den einschlägigen technischen Regeln, Herstellerangaben und projektspezifischen Anforderungen ausgeführt und dokumentiert wurde."
      },
      kabeltragsysteme: {
        label: "Kabeltragsysteme / DIN EN 61537",
        match: ["Kabeltragsysteme / Verlegesysteme"],
        text: "Hiermit wird bestätigt, dass die Kabeltragsysteme und Verlegesysteme nach DIN EN 61537, den Montagevorgaben der Hersteller und den projektspezifischen Anforderungen ausgeführt wurden."
      },
      kabeltragsystemeFunktionserhalt: {
        label: "Kabeltragsysteme Funktionserhalt / DIN 4102-12",
        match: ["Kabeltragsysteme / Verlegesysteme mit Funktionserhalt"],
        text: "Hiermit wird bestätigt, dass die Kabeltragsysteme und Verlegesysteme mit Funktionserhalt nach DIN 4102-12 sowie den Systemzulassungen und Montagevorgaben ausgeführt und dokumentiert wurden."
      },
      verteilungen: {
        label: "Niederspannungsschaltanlagen / DIN EN 61439",
        match: ["Niederspannungsschaltanlagen / Verteilungen"],
        text: "Hiermit wird bestätigt, dass die Niederspannungsschaltanlagen und Verteilungen nach DIN EN 61439, Herstellerangaben und projektspezifischen Vorgaben ausgeführt und gekennzeichnet wurden."
      },
      erdung: {
        label: "Erdung / Potentialausgleich",
        match: ["Erdung / Potentialausgleich"],
        text: "Hiermit wird bestätigt, dass Erdung und Potentialausgleich nach DIN VDE 0100-410, DIN VDE 0100-540 und DIN 18014 sowie den projektspezifischen Anforderungen hergestellt und dokumentiert wurden."
      },
      blitzschutz: {
        label: "Blitzschutzanlage",
        match: ["Blitzschutzanlage"],
        text: "Hiermit wird bestätigt, dass die Blitzschutzanlage nach DIN EN 62305 bzw. DIN VDE 0185-305 sowie den projektspezifischen Anforderungen ausgeführt und dokumentiert wurde."
      },
      datentechnik: {
        label: "Datentechnik / Kommunikationsverkabelung",
        match: ["Datentechnik / Kommunikationsverkabelung", "Telekommunikation", "Breitbandkommunikationsanlage"],
        text: "Hiermit wird bestätigt, dass die Kommunikations- und Datentechnik nach DIN EN 50173, ISO/IEC 11801 und DIN EN 50174 sowie den vereinbarten Systemvorgaben ausgeführt und dokumentiert wurde."
      },
      beleuchtung: {
        label: "Beleuchtungsanlagen / ASR A3.4 / DIN EN 12464",
        match: ["Beleuchtungsanlage", "Präsenzmelder"],
        text: "Hiermit wird bestätigt, dass die Beleuchtungsanlage unter Berücksichtigung der ASR A3.4 sowie der DIN EN 12464 ausgeführt und dokumentiert wurde."
      },
      brandmeldeanlage: {
        label: "Brandmeldeanlage",
        match: ["Brandmeldeanlage"],
        text: "Hiermit wird bestätigt, dass die Brandmeldeanlage nach DIN 14675, DIN VDE 0833 Teil 1 und 2 sowie DIN EN 54 ausgeführt und dokumentiert wurde."
      },
      gefahrenmeldeanlage: {
        label: "Gefahrenmelde- / Alarmanlage",
        match: ["Gefahrenmelde- / Alarmanlage"],
        text: "Hiermit wird bestätigt, dass die Gefahrenmelde- und Alarmanlage nach DIN VDE 0833 Teil 1 und 3 sowie den projektspezifischen Anforderungen ausgeführt und dokumentiert wurde."
      },
      rauchwarnmelder: {
        label: "Rauchwarnmelderanlage",
        match: ["Rauchwarnmelderanlage"],
        text: "Hiermit wird bestätigt, dass die Rauchwarnmelderanlage nach DIN 14676 sowie den projektspezifischen Anforderungen ausgeführt und dokumentiert wurde."
      }
    },
    normenFallback: "siehe Vertragsunterlagen, Regelwerke und Herstellerangaben",
    signatureLabel: "Firmenstempel / Unterschrift:"
  },
  ceBestaetigung: {
    name: "CE-Bestätigung",
    titelPraefix: "",
    titelFallback: "CE-Bestätigung",
    showProjectHeader: true,
    showSignature: true,
    showFooter: true,
    fontSizeTitle: 18,
    fontSizeBody: 10,
    margin: 48,
    spacing: 1,
    titleAlign: "left",
    bodyText:
      "Die erforderlichen CE-Kennzeichnungen befinden sich auf den Datenblättern der entsprechenden Unterlagen oder auf dem elektrischen Betriebsmittel selbst.",
    signatureLabel: "Firmenstempel / Unterschrift:"
  },
  dguv: {
    name: "DGUV-Bestätigung",
    titelPraefix: "",
    titelFallback: "Bestätigung nach DGUV Vorschrift 3",
    showProjectHeader: true,
    showSignature: false,
    showFooter: true,
    fontSizeTitle: 18,
    fontSizeBody: 10,
    margin: 48,
    spacing: 1,
    titleAlign: "left",
    bodyText:
      "Hiermit wird als Platzhalter bestätigt, dass die erforderlichen Prüfungen und Nachweise gemäß DGUV Vorschrift 3 für die dokumentierten elektrischen Anlagen vorbereitet und in der finalen Dokumentation zu ergänzen sind.",
    signatureLabel: "Firmenstempel / Unterschrift:"
  },
  errichter: {
    name: "Errichterbestätigung",
    titelPraefix: "",
    titelFallback: "Errichterbestätigung",
    showProjectHeader: true,
    showSignature: true,
    showFooter: true,
    fontSizeTitle: 18,
    fontSizeBody: 10,
    margin: 48,
    spacing: 1,
    titleAlign: "left",
    bodyText: "Hiermit erklären wir, dass die Anlagen nach DIN VDE 0100 elektrisch angeschlossen und in Betrieb genommen wurden.",
    signatureLabel: "Firmenstempel / Unterschrift:"
  }
};

// * INFO: Begrenzung numerischer Formularwerte, damit PDF-Layouts nicht ausbrechen.
function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// * INFO: HTML-Checkboxen in echte Boolean-Werte umwandeln.
function checkbox(value) {
  if (Array.isArray(value)) return value.some((entry) => checkbox(entry));
  return value === "on" || value === true || value === "true";
}

// * INFO: Mischt Default-Textvarianten mit gespeicherten Anpassungen.
function mergeTextVarianten(defaults = {}, existing = {}) {
  const keys = new Set([...Object.keys(defaults), ...Object.keys(existing)]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const defaultVariant = defaults[key] || {};
      const existingVariant = existing[key] || {};
      return [
        key,
        {
          ...defaultVariant,
          ...existingVariant,
          match: Array.isArray(existingVariant.match) ? existingVariant.match : defaultVariant.match || []
        }
      ];
    })
  );
}

// * INFO: Projekt-/Leistungsbereichstexte als Objekt normalisieren.
function normalizeLeistungsbereichTexte(value = {}) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value
      .map((entry) => [
        String((entry && entry.leistungsbereich) || "").trim(),
        String((entry && entry.text) || "").trim()
      ])
      .filter(([leistungsbereich]) => leistungsbereich));
  }

  if (value && typeof value === "object") {
    const indexedEntries = Object.values(value).filter((entry) => entry && typeof entry === "object" && "leistungsbereich" in entry);
    if (indexedEntries.length) {
      return Object.fromEntries(indexedEntries
        .map((entry) => [
          String(entry.leistungsbereich || "").trim(),
          String(entry.text || "").trim()
        ])
        .filter(([leistungsbereich]) => leistungsbereich));
    }
  }

  return Object.fromEntries(
    Object.entries(value || {})
      .map(([leistungsbereich, text]) => [String(leistungsbereich || "").trim(), String(text || "").trim()])
      .filter(([leistungsbereich]) => leistungsbereich)
  );
}

// * INFO: Steuerung je Leistungsbereich und Formular normalisieren.
// * INFO: In den Leistungsbereichen wird nur definiert, ob ein Formular grundsätzlich erzeugt wird.
function normalizeLeistungsbereichFormulare(value = {}, fallbackTexte = {}) {
  const entries = Array.isArray(value)
    ? value
    : Object.values(value || {}).filter((entry) => entry && typeof entry === "object" && "leistungsbereich" in entry);

  if (entries.length) {
    return Object.fromEntries(entries
      .map((entry) => {
        const leistungsbereich = String(entry.leistungsbereich || "").trim();
        return [
          leistungsbereich,
          {
            erzeugen: entry.erzeugen === undefined ? true : checkbox(entry.erzeugen),
            text: String(entry.text || "").trim()
          }
        ];
      })
      .filter(([leistungsbereich]) => leistungsbereich));
  }

  return Object.fromEntries(
    Object.entries(fallbackTexte || {}).map(([leistungsbereich, text]) => [
      leistungsbereich,
      { erzeugen: true, text: String(text || "").trim() }
    ])
  );
}

// * INFO: Ergänzt fehlende Formular-Templates aus den Defaults.
function mergeFormTemplates(templates = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_FORM_TEMPLATES).map(([key, defaults]) => {
      const existing = templates[key] || {};
      return [
        key,
        {
          ...defaults,
          ...existing,
          leistungsbereichTexte: normalizeLeistungsbereichTexte(existing.leistungsbereichTexte || {}),
          leistungsbereichFormulare: normalizeLeistungsbereichFormulare(existing.leistungsbereichFormulare || {}, existing.leistungsbereichTexte || {}),
          textVarianten: mergeTextVarianten(defaults.textVarianten || {}, existing.textVarianten || {})
        }
      ];
    })
  );
}

// * INFO: Normalisiert die Formular-Generator-Eingaben aus den Einstellungen.
function normalizePostedFormTemplates(body = {}) {
  const posted = body.templates || {};
  const merged = mergeFormTemplates(posted);

  return Object.fromEntries(
    Object.entries(merged).map(([key, template]) => {
      const input = posted[key] || {};
      const textVarianten = mergeTextVarianten(template.textVarianten || {}, input.textVarianten || {});
      const leistungsbereichTexte = normalizeLeistungsbereichTexte(input.leistungsbereichTexte || template.leistungsbereichTexte || {});
      const leistungsbereichFormulare = normalizeLeistungsbereichFormulare(input.leistungsbereichFormulare || template.leistungsbereichFormulare || {}, leistungsbereichTexte);
      const normalizedVarianten = Object.fromEntries(
        Object.entries(textVarianten).map(([variantKey, variant]) => [
          variantKey,
          {
            ...variant,
            label: String(variant.label || "").trim(),
            text: String(variant.text || "").trim(),
            match: Array.isArray(variant.match) ? variant.match : []
          }
        ])
      );

      return [
        key,
        {
          ...template,
          titelPraefix: String(input.titelPraefix || "").trim(),
          titelFallback: String(input.titelFallback || template.titelFallback || "").trim(),
          bodyText: String(input.bodyText || template.bodyText || "").trim(),
          normenFallback: String(input.normenFallback || template.normenFallback || "").trim(),
          signatureLabel: String(input.signatureLabel || template.signatureLabel || "").trim(),
          showProjectHeader: checkbox(input.showProjectHeader),
          showLeistungsbereich: checkbox(input.showLeistungsbereich),
          showNormen: checkbox(input.showNormen),
          showSignature: checkbox(input.showSignature),
          showFooter: checkbox(input.showFooter),
          fontSizeTitle: numberInRange(input.fontSizeTitle, template.fontSizeTitle, 12, 28),
          fontSizeBody: numberInRange(input.fontSizeBody, template.fontSizeBody, 7, 14),
          margin: numberInRange(input.margin, template.margin, 24, 72),
          spacing: numberInRange(input.spacing, template.spacing, 0.5, 2),
          titleAlign: ["left", "center", "right"].includes(input.titleAlign) ? input.titleAlign : template.titleAlign,
          leistungsbereichTexte,
          leistungsbereichFormulare,
          textVarianten: normalizedVarianten
        }
      ];
    })
  );
}

// * INFO: Wählt den passenden Konformitätstext anhand des Leistungsbereichs.
function textForKonformitaet(template, leistungsbereich) {
  const leistungsbereiche = Array.isArray(leistungsbereich) ? leistungsbereich : [leistungsbereich];
  const leistungsbereichFormulare = normalizeLeistungsbereichFormulare(template.leistungsbereichFormulare || {}, template.leistungsbereichTexte || {});
  const formText = leistungsbereiche
    .map((entry) => leistungsbereichFormulare[entry] && leistungsbereichFormulare[entry].text)
    .find((text) => String(text || "").trim());
  if (formText) return formText;

  const leistungsbereichTexte = normalizeLeistungsbereichTexte(template.leistungsbereichTexte || {});
  const customText = leistungsbereiche
    .map((entry) => leistungsbereichTexte[entry])
    .find((text) => String(text || "").trim());
  if (customText) return customText;

  const variants = template.textVarianten || {};
  const match = Object.values(variants).find((variant) => {
    return (variant.match || []).some((entry) => leistungsbereiche.includes(entry));
  });
  return (match && match.text) || (variants.default && variants.default.text) || template.bodyText || "";
}

// * INFO: Prüft, ob ein Formular für die angegebenen Leistungsbereiche erzeugt werden soll.
function formEnabledForLeistungsbereiche(template, leistungsbereich) {
  const leistungsbereiche = Array.isArray(leistungsbereich) ? leistungsbereich : [leistungsbereich];
  const leistungsbereichFormulare = normalizeLeistungsbereichFormulare(template.leistungsbereichFormulare || {}, template.leistungsbereichTexte || {});
  const configured = leistungsbereiche
    .map((entry) => leistungsbereichFormulare[entry])
    .filter(Boolean);
  if (!configured.length) return true;
  return configured.some((entry) => entry.erzeugen !== false);
}

// * INFO: Baut den sichtbaren Formulartitel aus Präfix und Fallback.
function templateTitle(template, fallbackTitle) {
  const title = fallbackTitle || template.titelFallback || template.name || "Formular";
  return `${template.titelPraefix || ""}${title}`;
}

module.exports = {
  DEFAULT_FORM_TEMPLATES,
  mergeFormTemplates,
  normalizePostedFormTemplates,
  formEnabledForLeistungsbereiche,
  textForKonformitaet,
  templateTitle
};
