const POLICY = 'fire_protection_workflow_v1';
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function classify({ manufacturer = '', model = '', system = '', description = '' } = {}) {
  const text = [model, system, description].join(' '), publisher = normalize(manufacturer);
  const plm = ['obo', 'obobettermann'].includes(publisher) && /pyroline.*rapid|\bPLM\s*D\s*0|\b7218000\b|\b4012197351205\b/i.test(text);
  const kind = plm ? 'installation_duct' : /funktionserhalt|DIN\s*4102[-\s]*(?:Teil\s*)?12/i.test(text) ? 'circuit_integrity'
    : /brandschutzkanal|installationskanal.*brandschutz|pyroline/i.test(text) ? 'installation_duct'
    : /abschott|brandschutz(?:stein|schaum)|\bZZ[\s®-]*(?:217|330|M\d)|pyroplug|pyrosit|pyromix|pyroplate/i.test(text) ? 'penetration_seal' : 'unknown';
  return { kind, state: kind === 'unknown' ? 'unclassified' : 'candidate', installationConfirmed: false,
    ...(plm ? { productLimit: 'PYROLINE Rapid PLM: laut Hersteller kein elektrischer Funktionserhalt nach DIN 4102-12.' } : {}) };
}
const labels = { penetration_seal: 'Kabel-/Rohr-/Kombiabschottung', installation_duct: 'Brandschutz-Installationskanal', circuit_integrity: 'Elektrischer Funktionserhalt', unknown: 'Brandschutzart noch zu klären' };
function documents(kind) {
  const base = [{ role: 'datasheet', title: 'Exaktes Produktdatenblatt', instruction: 'EAN/Artikelnummer und Variante auf Herstellerseite und verlinktem PDF prüfen; vorhandene Originale zuerst wiederverwenden.' },
    { role: 'manual', title: 'Systembezogene Montageanleitung', instruction: 'Zum tatsächlichen System und zur Montageart passende Anleitung, keine benachbarte Produktfamilie.' }];
  if (kind === 'unknown') return [{ role: 'classification', title: 'Brandschutzart bestimmen', instruction: 'Zuerst Produkt und Anwendung einordnen; keine Schottanforderungen aus einem Kanal oder allgemeinem Brandschutztext erzeugen.' }];
  return [...base, { role: 'system_evidence', title: kind === 'penetration_seal' ? 'Passender Anwendbarkeits-/Zulassungsnachweis' : 'Passender System-/Klassifizierungsnachweis',
    instruction: kind === 'installation_duct' ? 'Produktspezifisch ETA, Klassifizierung oder Nachweis prüfen. EI/I und elektrisches E30/E90 nicht gleichsetzen. Kein pauschales Schott-Prüfzeugnis übernehmen.'
      : kind === 'circuit_integrity' ? 'Nachweis für tatsächliche Kabel-/Tragsystemkombination und E-Klasse prüfen; eine EI-Kanalangabe belegt keinen elektrischen Funktionserhalt.'
      : 'Tatsächliche Dokumentart (z. B. aBG, abP, ETA) benennen; System, Ausführung, Zeitraum und Geltungsbereich prüfen.' },
    { role: 'declaration_template', title: 'Passende Errichter-/Übereinstimmungsvorlage suchen', instruction: 'Zuerst Hersteller-Systemseite/Downloadbereich, dann Muster im zugehörigen Nachweis. Allgemeine Herstellerformulare auf Systemumfang prüfen. Kein Eigenformular, solange passende Originalvorlage verfügbar ist. EU-Konformität/Leistungserklärung ist keine Errichterbestätigung.' }];
}
function questions(kind) {
  const common = [{ key: 'installationStatus', prompt: 'Ist der Einbau tatsächlich bestätigt oder ausdrücklich nur eine Testannahme?' }, { key: 'system', prompt: 'Welches tatsächliche System ist durch Schild oder Einbaunachweis belegt?' },
    { key: 'installationLocation', prompt: 'Wo genau ist das System eingebaut?' }, { key: 'installationDate', prompt: 'An welchem tatsächlichen Datum wurde es eingebaut?' },
    { key: 'ausfuehrendeFirma', subjectKind: 'project', prompt: 'Welche ausführende Firma bestätigt die tatsächliche Ausführung?' }, { key: 'firmenanschrift', subjectKind: 'project', prompt: 'Wie lautet die tatsächliche Firmenanschrift?' }, { key: 'bearbeiter', subjectKind: 'project', prompt: 'Wer ist der tatsächliche Bearbeiter? Keine Unterschrift erzeugen.' }];
  if (kind === 'penetration_seal') return [...common, { key: 'quantity', prompt: 'Wie viele tatsächliche Schotts wurden ausgeführt?' }, { key: 'identifier', prompt: 'Welche vorhandenen Schottkennungen gibt es? Unbekannte Kennungen offenlassen.' },
    { key: 'wallType', prompt: 'Wand/Decke und Baustoff?' }, { key: 'wallThicknessMm', prompt: 'Bauteildicke in mm?' }, { key: 'openingWidthMm', prompt: 'Öffnungsbreite in mm?' }, { key: 'openingHeightMm', prompt: 'Öffnungshöhe in mm?' }, { key: 'fireResistanceMinutes', prompt: 'Welche Feuerwiderstandsdauer ist gefordert und belegt?' },
    { key: 'sealDepthMm', prompt: 'Tatsächliche Schotttiefe in mm? Nicht aus Wanddicke ableiten.' }, { key: 'medium', prompt: 'Kabel, Rohre oder beides; tatsächliche Belegung?' }];
  if (kind === 'installation_duct') return [...common, { key: 'mountingType', prompt: 'Tatsächliche Wand-, Decken- oder Tragsystemmontage und Befestigungsgrund?' },
    { key: 'installedLengthMm', prompt: 'Tatsächlich montierte Länge und Kanalverlauf? Lieferlänge nicht als Einbaulänge übernehmen.' }, { key: 'fireResistanceMinutes', prompt: 'Welche Feuerwiderstandsklasse/-dauer ist gefordert und belegt?' }];
  if (kind === 'circuit_integrity') return [...common, { key: 'functionalityClass', prompt: 'Welche E-Klasse und tatsächliche Kabel-/Tragsystemkombination sind belegt?' }, { key: 'mountingType', prompt: 'Welche Befestigung und welcher Befestigungsgrund wurden tatsächlich verwendet?' }];
  return [{ key: 'fireProtectionKind', prompt: 'Handelt es sich um eine Abschottung, einen Installationskanal oder elektrischen Funktionserhalt?' }];
}
function sources(manufacturer, model, kind) {
  const key = normalize(manufacturer), common = { checkedAt: '2026-11-22', use: 'research_entry_point', reverify: true };
  const source = (title, pageUrl, pdfUrl) => ({ ...common, title, pageUrl, ...(pdfUrl ? { pdfUrl } : {}) });
  if (['zappzimmermann', 'zappzimmermanngmbh'].includes(key)) return [source('ZZ-Downloadbereich; passende Systemunterlagen auswählen', 'https://www.z-z.de/downloads/hochbau/'),
    ...(kind === 'penetration_seal' ? [source('ZZ-Allgemeine Übereinstimmungsvorlage; Systemtabelle prüfen', 'https://www.z-z.de/downloads/hochbau/', 'https://www.z-z.de/media/catalog/downloads/UEE/Uebereinstimmungserklaerung-Allgemein.pdf')] : [])];
  if (!['obo', 'obobettermann'].includes(key)) return [];
  const list = [source('OBO-Brandschutzzertifikate; Systemgruppe beachten', 'https://www.obo.de/de-de/wissen/mediathek/downloads/brandschutzzertifikate')];
  if (kind === 'penetration_seal') list.push(source('OBO-Abschottungsvorlage; nicht als Kanalvorlage verwenden', list[0].pageUrl, 'https://api.production.obo.digital/v1/asset/DZ0KRtTxKfrBDWl1mHN1A3/BSS_%C3%9Cbereinstimmungsbest%C3%A4tigung.pdf'));
  if (kind === 'installation_duct' && /plm|7218000|4012197351205|pyroline.*rapid/i.test(model)) list.push(source('PYROLINE Rapid PLM: Systemseite mit ETA und Montageanleitung', 'https://www.obo.de/de-de/produkte/brandschutzkanaele/brandschutzkanal-metall-pyroline-R-rapid-plm'));
  return list;
}
function workingDeclaration(document) {
  const value = document?.fireProtectionDocument || document?.assistantProvenance?.fireProtectionDocument;
  if (value && (value.stage !== 'prepared' || value.installationBasis !== 'confirmed')) return true;
  const title = String(document?.title || document?.assistantProvenance?.title || '');
  return /übereinstimmung|uebereinstimmung/i.test(title) && /entwurf|vorlage|muster|blanko|unvollständig|unvollstaendig/i.test(title);
}
function assertDocumentBinding(document, fault) {
  if (document.fireProtectionDocument && !['Brandschutz', 'Nachweise'].includes(document.category)) throw fault('Brandschutz-Erklärungsstatus benötigt eine Nachweiskategorie.', 400, 'FIRE_PROTECTION_CATEGORY');
  if (workingDeclaration(document) && document.requirementIds?.length) throw fault('Vorlage oder unvollständiger Entwurf darf keine Pflichtanforderung erfüllen.', 409, 'INCOMPLETE_DECLARATION_BINDING');
}
module.exports = { POLICY, labels, classify, documents, questions, sources, workingDeclaration, assertDocumentBinding };
