const crypto = require('node:crypto');
const AREA = 'Brandschutzabschottungen';
const POLICY = 'firestop_documents_v1';
const ROLES = ['declaration', 'manual', 'system_evidence'];
const normalize = value => String(value || '').toLocaleLowerCase('de').replace(/[^a-z0-9äöüß]/g, '');
const known = value => value && !/offen|unbekannt|ungeklärt/i.test(value);

// A documentation rule, not a legal assessment or confirmation of an installation.
function firestopRequirements(data, existing = []) {
  if (!data.leistungsbereiche?.aktiv?.includes(AREA)) return [];
  const systems = new Map();
  const addSystem = (manufacturer, system, approval) => {
    if (!known(system) && !known(approval)) return;
    const key = crypto.createHash('sha256').update(JSON.stringify([normalize(manufacturer), normalize(known(system) ? system : approval)])).digest('hex').slice(0, 20);
    systems.set(key, { key, manufacturer: manufacturer || '', system: system || '', approval: approval || '' });
  };
  const entries = (data.brandschutz || []).filter(entry => entry.aktiv !== false);
  entries.forEach(entry => addSystem(entry.hersteller, entry.abschottungssystem || entry.system, entry.zulassung));
  // System selections are a fallback; never invent physical firestops from materials.
  if (!systems.size) (data.projektSysteme || []).filter(row => row.leistungsbereich === AREA && row.aktiv && row.enabled !== false).forEach(row => addSystem(row.hersteller, row.herstellerSystem, ''));
  if (entries.some(entry => !known(entry.abschottungssystem || entry.system) && !known(entry.zulassung))) systems.set('unresolved', { key: 'unresolved', manufacturer: '', system: 'System noch zu klären', approval: '' });
  if (!systems.size) systems.set('unresolved', { key: 'unresolved', manufacturer: '', system: 'System noch zu klären', approval: '' });
  const groups = [...systems.values()];
  const definitions = [{ id: 'firestop_declaration', title: 'Brandschutzabschottungen – ausgefüllte Übereinstimmungsbestätigung aller ausgeführten Schotts', category: 'Brandschutz', firestop: { role: 'declaration', systemKey: 'project' } }];
  for (const group of groups) {
    const label = [group.manufacturer, group.system, group.approval].filter(Boolean).join(' · ').slice(0, 110);
    definitions.push(
      { id: 'firestop_manual_' + group.key, title: 'Brandschutz – Montageanleitung: ' + label, category: 'Bedienungsanleitungen', firestop: { role: 'manual', systemKey: group.key } },
      { id: 'firestop_evidence_' + group.key, title: 'Brandschutz – Zulassungs-/Prüfnachweis: ' + label, category: 'Brandschutz', firestop: { role: 'system_evidence', systemKey: group.key } }
    );
  }
  const used = new Set();
  return definitions.map(definition => {
    const { role, systemKey } = definition.firestop;
    const group = systems.get(systemKey);
    const matches = existing.filter(item => {
      if (used.has(item.id)) return false;
      if (/leistungserklärung|leistungserklaerung/i.test(item.title || '')) return false;
      if (item.firestop) return item.firestop.role === role && item.firestop.systemKey === systemKey && item.category === definition.category;
      const title = String(item.title || '');
      const context = item.category === 'Brandschutz' || /brandschutz|abschott|schott|\bzz[\s®_-]*\d|\bzz[\s®_-]*m\d/i.test(title);
      if (!context || /leistungserklärung|leistungserklaerung/i.test(title)) return false;
      const typeMatches = role === 'declaration' ? /übereinstimmung|uebereinstimmung/i.test(title) : role === 'manual' ? /montageanleitung/i.test(title) : /prüfzeugnis|pruefzeugnis|prüfnachweis|zulassung|bauartgenehmigung|anwendbarkeitsnachweis/i.test(title);
      if (!typeMatches || item.category !== definition.category) return false;
      return role === 'declaration' || groups.length === 1 || [group.system, group.approval].filter(known).some(value => normalize(title).includes(normalize(value)));
    });
    // Ambiguous legacy requirements are retained for an explicit review, not silently bound.
    const match = matches.length === 1 ? matches[0] : null;
    if (match) used.add(match.id);
    return { definition, requirementId: match?.id || null, role, system: group || null };
  });
}

function instructions(role) {
  const common = 'Alle tatsächlich verwendeten Systeme/Schotts berücksichtigen. Passende freigegebene Originale zuerst nutzen; neue Dateien nur zur manuellen GUI-Einzelprüfung vorschlagen. Keine Hersteller-Leistungserklärung als Ersatz. ';
  if (role === 'declaration') return common + 'Zuerst über edoku_fire_protection_guide passende Hersteller-Originalvorlage suchen; Systemumfang prüfen, alternativ Muster im zugehörigen Nachweis. Vorhandene Belege vor Rückfragen strukturieren; quantity/identifier sind eigene Faktenziele. Echte Firma, Bauort, Kennungen, Datum, System und Einbaudaten klären; Zurückstellungen respektieren. DUMMY-Werte/Testannahmen und offene Felder sichtbar lassen, keine Konformität oder Unterschrift erfinden. Formularfelder/Widgets und Original erhalten, Systemauswahl nur bei bestätigtem Einbau, Ergebnis rendern/prüfen. fireProtectionDocument.stage template/incomplete_draft darf keine Pflicht erfüllen; Dateien nur manuell freigeben.';
  if (role === 'manual') return common + 'Montageanleitung für das konkrete bestätigte Abschottungssystem auf der Herstellerseite recherchieren. Produktname des Schaums allein genügt nicht. Herstellerseite und dort verlinktes Original-PDF an die verbindliche Artikel-/Variantenprüfung übergeben; Prüfsperren nicht umgehen.';
  return common + 'Systembezogenen Zulassungs-/Prüfnachweis recherchieren (z. B. aBG, abP oder passende Zulassung). Tatsächliche Nachweisart korrekt benennen; System, Ausführung, Errichtungsdatum und Geltungsbereich abgleichen. Keinen pauschalen Prüfzeugnis-Ersatz erfinden.';
}
module.exports = { AREA, POLICY, ROLES, firestopRequirements, instructions };
