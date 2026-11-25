const crypto = require('node:crypto');
const { fault } = require('../src/api/validation');
const { firestopRequirements } = require('./firestopDocumentationService');
const POLICY = 'evidence_dependencies_v1';
const nativeFields = { project: new Set(Object.keys(require('../src/api/schemas').projectPatch.shape)), device: new Set(Object.keys(require('../src/api/schemas').positionPatch.shape)) };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const aliases = { manufacturer: 'hersteller', model: 'typ', installationLocation: 'ortDerAusfuehrung', installationDate: 'ausfuehrungsdatum', approval: 'zulassung' };
const labels = { fireProtectionKind: 'Brandschutzart', installationStatus: 'bestätigter Einbau oder Testannahme', mountingType: 'tatsächliche Montageart', installedLengthMm: 'tatsächliche Einbaulänge in mm', functionalityClass: 'elektrische Funktionserhaltsklasse', quantity: 'Anzahl tatsächlicher Einbauten', identifier: 'vorhandene Kennung', system: 'genaue Systembezeichnung', hersteller: 'Hersteller', typ: 'Artikel-/Typnummer', variant: 'Variante', components: 'verwendete Systemkomponenten', medium: 'abgeschottete Leitungen oder Rohre', wallType: 'Wandart', wallThicknessMm: 'Wanddicke in mm', openingWidthMm: 'Öffnungsbreite in mm', openingHeightMm: 'Öffnungshöhe in mm', sealDepthMm: 'Schotttiefe in mm', fireResistanceMinutes: 'geforderte Feuerwiderstandsdauer in Minuten', ortDerAusfuehrung: 'genauer Einbauort', ausfuehrungsdatum: 'Einbaudatum', ausfuehrendeFirma: 'ausführende Firma', firmenanschrift: 'Firmenanschrift', unassigned: 'Zuordnung der unklaren Angabe' };
const norm = value => typeof value === 'string' ? value.trim().toLocaleLowerCase('de') : Array.isArray(value) ? value.map(norm).sort() : value;
const equal = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
function preview(value) { return typeof value === 'string' ? value.slice(0,300) : Array.isArray(value) ? value.slice(0,10).map(item=>typeof item==='string'?item.slice(0,100):item) : value; }
function publicFact(row) {
  const result={...row}; let truncated=false;
  for(const field of ['value','storedValue','alternatives','rawValues'])if(row[field]!==undefined){result[field]=preview(row[field]);if(!equal(row[field],result[field]))truncated=true;}
  return {...result,...(truncated?{valueTruncated:true}:{})};
}
const usable = (value,key) => value !== undefined && value !== null && value !== '' && !(typeof value === 'string' && (/\b(dummy|unbekannt|offen|ungeklärt)\b/i.test(value) || (key==='system'&&/^(kabelabschottung|rohrabschottung|kombiabschottung|brandschutzschaum|brandschutzsteine?)$/i.test(value.trim()))));
function ref(input) { return { subject: input.subject, key: aliases[input.key] || input.key }; }
function factId(input) { return 'k_' + hash(ref(input)).slice(0, 20); }
function source(data, job, subject) {
  if (subject.kind === 'project') return { value: data.projekt, fingerprint: 'project' };
  if (subject.kind === 'requirement') {
    const requirement = job.requirements.find(row => row.id === subject.requirementId);
    if (!requirement) throw fault('Faktenziel gehört nicht zu diesem Auftrag.', 409, 'FACT_TARGET_CHANGED');
    return { value: {}, fingerprint: hash(requirement) };
  }
  if (subject.kind === 'firestop') {
    const entry = data.brandschutz.find(row => row.id === subject.entryId && row.aktiv !== false);
    if (!entry) throw fault('Aktives Schott wurde nicht gefunden.', 409, 'FACT_TARGET_CHANGED');
    return { value: entry, fingerprint: hash([entry.id, entry.hersteller, entry.abschottungssystem, entry.system, entry.zulassung]) };
  }
  const list = data.geraetelisten.find(row => row.id === subject.listId && row.aktiv !== false && data.leistungsbereiche.aktiv.includes(row.leistungsbereich));
  const rows = list?.positionen.filter((row, index) => Number(row.pos || index + 1) === subject.position) || [];
  if (rows.length !== 1) throw fault('Aktive Geräteposition wurde nicht eindeutig gefunden.', 409, 'FACT_TARGET_CHANGED');
  const value = rows[0];
  return { value, fingerprint: hash([list.id, subject.position, value.hersteller, value.typ, value.abmessung, value.farbe]) };
}
function records(data) {
  const rows = data.projekt.assistantFacts || [];
  if (!Array.isArray(rows)) throw fault('Faktenhistorie ist ungültig.', 409, 'INVALID_FACT_HISTORY');
  return rows;
}
function appendFragments(data, job, fragments, evidence, decisionId, userId) {
  const result = [...records(data)], seen = new Set(); let added = 0;
  for (const input of fragments) {
    const target = ref(input), key = factId(target), context = source(data, job, target.subject);
    if (seen.has(key)) throw fault('Dasselbe Faktenziel im Paket mehrfach angegeben.', 400, 'DUPLICATE_FACT');
    seen.add(key);
    for (const previousId of input.supersedes) {
      if (!result.some(row => row.id === previousId && row.jobId === job.id && (row.factId === key || (row.key === 'unassigned' && target.key !== 'unassigned' && equal(row.subject, target.subject))) && row.fingerprint === context.fingerprint)) throw fault('Eine Korrektur darf nur eigene aktuelle Fragmente desselben Faktenziels oder eine ausdrücklich zugeordnete unklare Angabe ablösen.', 409, 'FACT_CORRECTION_CONFLICT');
    }
    const inputHash = hash([job.id, target, input, evidence, context.fingerprint]);
    if (result.some(row => row.inputHash === inputHash)) continue;
    if (result.length >= 1000) throw fault('Faktenhistorie ist voll.', 409, 'FACT_HISTORY_LIMIT');
    result.push({ ...input, ...target, id: 'fact_' + crypto.randomBytes(12).toString('hex'), factId: key, jobId: job.id, fingerprint: context.fingerprint, inputHash, decisionId, recordedAt: new Date().toISOString(), recordedBy: userId }); added++;
  }
  return { records: result, added };
}
function resolveFact(data, job, input, seed) {
  const target = ref(input), id = factId(target), all = records(data).filter(row => row.jobId === job.id && row.factId === id);
  let context;
  try { context = source(data, job, target.subject); }
  catch { return { id, ...target, state: 'invalid_target', label: labels[target.key] || target.key, revision: hash(['invalid', target]), fragmentIds: [] }; }
  const current = all.filter(row => row.fingerprint === context.fingerprint);
  const superseded = new Set(records(data).filter(row => row.jobId === job.id && row.fingerprint === context.fingerprint && equal(row.subject, target.subject)).flatMap(row => row.supersedes));
  const active = current.filter(row => !superseded.has(row.id));
  const confirmed = active.filter(row => row.status === 'confirmed' && usable(row.value,target.key));
  const values = [];
  confirmed.forEach(row => { if (!values.some(value => equal(value, row.value))) values.push(row.value); });
  const stored = context.value[target.key] ?? seed;
  let state, value;
  if (values.length > 1 || (values.length === 1 && usable(stored,target.key) && !equal(stored, values[0]) && !confirmed.some(row => row.replaceStored))) state = 'conflict';
  else if (values.length === 1) { state = 'confirmed'; value = values[0]; }
  else if (usable(stored,target.key)) { state = 'confirmed'; value = stored; }
  else if (current.length && !active.length) state = 'resolved';
  else if (active.at(-1)?.status === 'deferred') state = 'deferred';
  else if (active.some(row => row.status === 'ambiguous') || target.key === 'unassigned') state = 'ambiguous';
  else if (active.some(row => row.status === 'inferred')) { state = 'inferred'; value = active.filter(row => row.status === 'inferred').at(-1).value; }
  else state = all.length && !current.length ? 'stale' : 'unknown';
  return { id, ...target, label: labels[target.key] || target.key, state, ...(value !== undefined ? { value } : {}), ...(usable(stored) ? { storedValue: stored, source: 'project_field' } : {}),
    ...(state === 'ambiguous' ? {rawValues:active.filter(row=>row.status==='ambiguous'&&row.value!==undefined).slice(-3).map(row=>row.value)} : {}),
    ...(state === 'confirmed' && nativeFields[target.subject.kind]?.has(target.key) && !equal(context.value[target.key],value) ? {needsApplication:true} : {}),
    ...(state === 'conflict' ? { alternatives: values.slice(0, 3), ...(usable(stored) ? { storedValue: stored } : {}) } : {}),
    revision: hash([target, context.fingerprint, active.map(row => row.id), stored ?? null]), fragmentIds: active.map(row => row.id).slice(-10), hasFragments: Boolean(current.length), staleFragments: all.length - current.length };
}
function defaultDependencies(data, job) {
  const rules = firestopRequirements(data, job.requirements), result = new Map();
  const make = (subject, keys) => keys.map(key => ({ subject, key }));
  const declarations = rules.filter(row => row.role === 'declaration' && row.requirementId);
  const entries = data.brandschutz.filter(row => row.aktiv !== false);
  for (const rule of rules.filter(row => row.requirementId)) {
    const companion = rules.find(row => row.requirementId && row.role === 'manual' && row.system?.key === rule.system?.key);
    const shared = { kind: 'requirement', requirementId: companion?.requirementId || rule.requirementId };
    if (rule.role !== 'declaration') result.set(rule.requirementId, make(shared, ['system']));
    else {
      const needs = make({ kind: 'project' }, ['ausfuehrendeFirma', 'firmenanschrift']);
      const subjects = entries.length ? entries.map(row => ({ kind: 'firestop', entryId: row.id })) : [{ kind: 'requirement', requirementId: rule.requirementId }];
      subjects.forEach(subject => needs.push(...make(subject, ['system', 'medium', 'wallType', 'fireResistanceMinutes', 'wallThicknessMm', 'openingWidthMm', 'openingHeightMm', 'sealDepthMm', 'ortDerAusfuehrung', 'ausfuehrungsdatum'])));
      for (const manual of rules.filter(row => row.role === 'manual' && row.requirementId)) needs.push(...make({ kind: 'requirement', requirementId: manual.requirementId }, ['system']));
      result.set(rule.requirementId, needs);
    }
  }
  // In a single-system project, declaration and original documents share system identity.
  if (declarations.length && rules.filter(row => row.role === 'manual').length === 1) {
    const manual = rules.find(row => row.role === 'manual' && row.requirementId);
    if (manual && !entries.length) result.set(declarations[0].requirementId, result.get(declarations[0].requirementId).map(item => item.key === 'system' ? { subject: { kind: 'requirement', requirementId: manual.requirementId }, key: 'system' } : item));
  }
  return result;
}
function buildKnowledge(data, job, { tasks = [], work = [], requirements = [] } = {}) {
  const facts = new Map(), nodes = [], defaults = defaultDependencies(data, job);
  const rules = firestopRequirements(data, job.requirements);
  const add = input => {
    const key = factId(input);
    if (!facts.has(key)) {
      const rule = rules.find(row => row.requirementId === input.subject.requirementId);
      const seed = input.key === 'system' && rule?.system?.key !== 'unresolved' ? rule?.system?.system : undefined;
      facts.set(key, resolveFact(data, job, input, seed));
    }
    return key;
  };
  for (const requirement of job.requirements) {
    if (requirements.some(row => row.id === requirement.id && row.applicable === false)) continue;
    const needs = [...(defaults.get(requirement.id) || []), ...(requirement.dependsOn || [])];
    if (!needs.length) continue;
    const dependsOn = [...new Set(needs.map(add))];
    const fulfilled = requirements.length ? requirements.some(row => row.id === requirement.id && row.fulfilled) : job.documents.some(row => row.state === 'approved' && !require('./fireProtectionPolicy').workingDeclaration(row) && row.attachmentId && row.requirementIds.includes(requirement.id));
    const pending = job.documents.some(row => row.state === 'pending' && !require('./fireProtectionPolicy').workingDeclaration(row) && row.requirementIds.includes(requirement.id));
    nodes.push({ id: 'req_' + requirement.id, requirementId: requirement.id, title: requirement.title, dependsOn, fulfilled, pending, priority: defaults.has(requirement.id) ? 2 : 1 });
  }
  for (const task of tasks.filter(row => row.target?.kind === 'article' && row.devices?.length)) {
    const dependsOn = [...new Set(task.devices.flatMap(device => ['hersteller', 'typ'].map(key => add({ subject: { kind: 'device', listId: device.listId, position: device.position }, key }))))];
    nodes.push({ id: task.id, taskId: task.id, title: task.title, dependsOn, priority: 1 });
  }
  records(data).filter(row => row.jobId === job.id).forEach(add);
  nodes.forEach(node => { node.missingFacts = node.dependsOn.filter(key => facts.get(key).state !== 'confirmed'); node.ready = !node.missingFacts.length; });
  const questions = [];
  for (const fact of facts.values()) {
    const dependents = nodes.filter(node => node.missingFacts.includes(fact.id));
    const held = dependents.length && dependents.every(node => work.some(record => record.target.kind === 'requirement' && record.target.requirementId === node.requirementId && record.state !== 'resume'));
    if (['confirmed', 'deferred', 'resolved', 'invalid_target'].includes(fact.state) || held || (!dependents.length && fact.key !== 'unassigned')) continue;
    const target = { kind: 'fact', subject: fact.subject, key: fact.key, revision: fact.revision };
    const open = job.questions.find(row => !row.obsolete && !row.answer && row.targets?.some(item => item.kind === 'fact' && factId(item) === fact.id && item.revision === fact.revision));
    if (open) continue;
    const legacy = !fact.hasFragments && !fact.staleFragments ? job.questions.filter(row => !row.obsolete && row.answer && row.targets?.some(item =>
      item.kind === 'fact' ? factId(item) === fact.id : item.kind === fact.subject.kind && (item.kind === 'requirement' ? item.requirementId === fact.subject.requirementId : item.kind === 'device' ? item.listId === fact.subject.listId && item.position === fact.subject.position && (aliases[item.field] || item.field) === fact.key : item.kind === 'project' && (aliases[item.field] || item.field) === fact.key)
    )).slice(0, 3).map(row => row.id) : [];
    const immediate = dependents.filter(node => node.missingFacts.length === 1).length;
    const score = (fact.state === 'conflict' ? 10000 : fact.state === 'ambiguous' ? 9000 : 0) + immediate * 100 + dependents.reduce((n, node) => n + node.priority * 10, 0);
    const display = value => (Array.isArray(value)?value.join(', '):String(value)).slice(0,80);
    const alternatives = [...(fact.alternatives || []), ...(fact.storedValue !== undefined ? [fact.storedValue] : [])].map(display).filter((value,index,all)=>all.indexOf(value)===index);
    const prompt = fact.state === 'conflict' ? `Für ${fact.label} liegen unterschiedliche Angaben vor: ${alternatives.join(' / ')}. Welcher Wert ist richtig?` : fact.key === 'unassigned' ? `Worauf bezieht sich die Angabe „${(fact.rawValues||[]).map(display).join(' / ')}“? Bitte das konkrete Feld und den Wert bestätigen.` : fact.state === 'inferred' ? `Kannst du ${fact.label} „${display(fact.value)}“ bestätigen? Die Zuordnung ist bisher nur eine begründete Vermutung.` : fact.key === 'system' ? 'Welche genaue Systembezeichnung steht auf dem Kennzeichnungsschild oder der verwendeten Systemunterlage? Falls unbekannt, bitte ausdrücklich offenlassen.' : `Welche Angabe gilt für ${fact.label}? Unbekanntes bitte ausdrücklich offenlassen.`;
    const researchInputs = fact.key === 'system' && fact.state === 'unknown' && !fact.hasFragments ? [...facts.values()].filter(row=>equal(row.subject,fact.subject)&&row.state==='confirmed'&&['hersteller','typ','components','zulassung'].includes(row.key)).slice(0,3).map(row=>({factId:row.id,key:row.key,value:preview(row.value),...(!equal(row.value,preview(row.value))?{valueTruncated:true}:{})})) : [];
    questions.push({ factId: fact.id, score, unlocks: dependents.length, immediatelyUnblocks: immediate, target, prompt, legacyQuestionIds: legacy, researchInputs, state: fact.state });
  }
  questions.sort((a, b) => b.score - a.score || a.factId.localeCompare(b.factId));
  return { policy: POLICY, facts: [...facts.values()], dependencies: nodes, questions, summary: { facts: facts.size, confirmed: [...facts.values()].filter(row => row.state === 'confirmed').length, conflicts: [...facts.values()].filter(row => row.state === 'conflict').length, blockedTasks: nodes.filter(node => !node.fulfilled && !node.pending && !node.ready).length, readyTasks: nodes.filter(node => !node.fulfilled && !node.pending && node.ready).length, questions: questions.length } };
}
module.exports = { POLICY, factId, ref, source, records, appendFragments, resolveFact, buildKnowledge, defaultDependencies, publicFact };
