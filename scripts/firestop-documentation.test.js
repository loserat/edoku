const test = require('node:test');
const assert = require('node:assert/strict');
const { firestopRequirements, instructions } = require('../services/firestopDocumentationService');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { writeJson } = require('../services/jsonService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const store = require('../services/projectDataStoreService');
const { buildWorkspace } = require('../services/assistantWorkspaceService');

const workspace = (entries = []) => ({ leistungsbereiche: { aktiv: ['Brandschutzabschottungen'] }, brandschutz: entries, projektSysteme: [] });
const old = [
  { id: 'zz330_delivery_uebereinstimmung', title: 'Ausgefüllte Übereinstimmungsbestätigung der ZZ330-Kabelabschottung', category: 'Brandschutz' },
  { id: 'zz330_delivery_montageanleitung', title: 'Montageanleitung des Abschottungssystems mit ZZ330', category: 'Bedienungsanleitungen' },
  { id: 'zz330_delivery_pruefzeugnis', title: 'Passendes Prüfzeugnis des Abschottungssystems mit ZZ330', category: 'Brandschutz' }
];
test('Brandschutzregel gilt nur im aktiven Bereich, erhält Legacy-Anforderungen und akzeptiert keine Leistungserklärung', () => {
  assert.deepEqual(firestopRequirements({ leistungsbereiche: { aktiv: [] } }, old), []);
  const copy = structuredClone(old), rules = firestopRequirements(workspace(), old);
  assert.equal(rules.length, 3);
  assert.deepEqual(new Set(rules.map(row => row.requirementId)), new Set(old.map(row => row.id)));
  assert.deepEqual(old, copy);
  const declaration = { id: 'le', title: 'Hersteller-Leistungserklärung', category: 'Brandschutz', firestop: { role: 'system_evidence', systemKey: 'unresolved' } };
  assert.ok(firestopRequirements(workspace(), [declaration]).every(row => !row.requirementId));
  assert.match(instructions('declaration'), /keine Konformität oder Unterschrift erfinden/);
});
test('Mehrere tatsächliche Systeme erhalten je Anleitung und Systemnachweis, ohne Schotts oder doppelte Systeme zu erfinden', () => {
  const data = workspace([
    { aktiv: true, hersteller: 'ZAPP-ZIMMERMANN', system: 'ZZ M21-S90', zulassung: 'Z-19.53-2440' },
    { aktiv: true, hersteller: 'ZAPP-ZIMMERMANN', system: 'ZZ M21-S90' },
    { aktiv: true, hersteller: 'Anderer Hersteller', system: 'System B' },
    { aktiv: false, hersteller: 'Inaktiv', system: 'System C' }
  ]);
  const before = structuredClone(data), rules = firestopRequirements(data);
  assert.equal(rules.length, 5); assert.equal(new Set(rules.map(row => row.definition.id)).size, 5);
  assert.equal(rules.filter(row => row.role === 'declaration').length, 1);
  assert.deepEqual(data, before);
  assert.ok(rules.every(row => row.definition.title.length <= 200));
  assert.equal(firestopRequirements(workspace([...data.brandschutz, { aktiv: true, id: 'unknown' }])).length, 7);
});
test('API und echter MCP geben drei verbindliche Schritte vor; Abrufe erhalten Daten und Dateifreigaben', async () => {
  const f = await fixture({ setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await store.withProjectDataTransaction(() => writeJson(files.leistungsbereiche, { aktiv: ['Brandschutzabschottungen'], optionen: ['Brandschutzabschottungen'] }));
  } });
  const token = f.makeToken('alice', { scopes }).token, client = mcpClient(f.base, token, true);
  const request = (url, options = {}) => f.request(url, { token, ...options });
  const base = '/projects/same';
  try {
    const empty = (await request(base + '/documentation-status')).data.data;
    assert.equal(empty.firestopDocumentation.missingRequirements, 3); assert.equal(empty.canGenerate, false);
    const job = (await request(base + '/assistant/jobs', { method: 'POST', body: { instruction: 'Künstliche Brandschutz-Dokumentation mit allen Pflichtunterlagen prüfen.' } })).data.data;
    await client.initialize();
    const call = async (name, args) => {
      const r = (await client.rpc('tools/call', { name, arguments: args })).result;
      assert.ok(!r.isError, JSON.stringify(r)); return r.structuredContent.data;
    };
    const count = () => f.db.prepare('SELECT count(*) n FROM documentation_requirements').get().n;
    const before = count(), plan = await call('edoku_next_action', { projectId: 'same', jobId: job.id });
    assert.equal(plan.policy.firestopDocuments, 'firestop_documents_v2');
    assert.notEqual(plan.nextAction.code, 'DEFINE_FIRESTOP_REQUIREMENTS');
    assert.equal(job.requirements.length, 3); assert.equal(count(), before);
    assert.ok(Buffer.byteLength(JSON.stringify(plan)) < 7168);
    const status = (await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data;
    assert.equal(status.firestopDocumentation.missingRequirements, 0);
    assert.equal(status.requirements.length, 3);
    assert.ok(status.requirements.every(row => !row.fulfilled && row.scope === 'documentation'));
    const full = (await request(base + '/next-action?jobId=' + job.id + '&view=full&limit=10')).data.data;
    assert.equal(full.agentActions.items.filter(row => row.code === 'RESEARCH_FIRESTOP_DOCUMENT').length, 0);
    assert.equal(full.agentActions.items.filter(row => row.code === 'PREPARE_FIRESTOP_DECLARATION').length, 0);
    assert.equal(full.nextAction.code, 'ASK_TARGETED_QUESTION');
    assert.equal(full.nextAction.target.key,'system');
    const saved = (await request(base + '/assistant/jobs/' + job.id)).data.data;
    await call('edoku_next_action', { projectId: 'same', jobId: job.id });
    assert.deepEqual((await request(base + '/assistant/jobs/' + job.id)).data.data, saved);
    assert.equal(saved.documents.length, 0); assert.equal(count(), 3);
    assert.equal(f.db.prepare('SELECT count(*) n FROM document_review_views').get().n, 0);
    const denied = await request(base + '/workflow', { method: 'POST', headers: { 'If-Match': (await request(base)).etag }, body: { jobId: job.id, jobVersion: saved.version, evidence: { sourceLabel: 'Künstlicher Test', sourceQuote: 'Pflicht intern verstecken' }, requirementScopes: [{ id: saved.requirements[0].id, scope: 'internal' }] } });
    assert.equal(denied.status, 409); assert.equal(denied.data.error.code, 'FIRESTOP_REQUIREMENT_PROTECTED');
    const rows = buildWorkspace([{ job: saved, project: {}, pending: [], openQuestions: [], projectReadiness: status, datasheetCoverage: { summary: { articles: 0, approved: 0 }, items: [] }, agentIssues: [] }]);
    assert.equal(rows.rows.length, 3);
  } finally { await client.close(); await f.cleanup(); }
});

test('Automatische Pflichten sind herstellerneutral, wiederholbar und verändern keine Bestandsanforderung', () => {
  const { automaticRequirements } = require('../services/firestopDocumentationService');
  for (const manufacturer of ['Unbekannter neuer Hersteller', 'OBO', 'ZAPP-ZIMMERMANN']) {
    const data = workspace([{ id: 'actual', aktiv: true, hersteller: manufacturer, system: 'Bestätigtes System A' }]);
    const retained = [{ id: 'unrelated', title: 'Bestehende Unterlage', category: 'Allgemein' }];
    const before = JSON.stringify([data, retained]);
    const result = automaticRequirements(data, retained);
    assert.equal(result.length, 4);
    assert.deepEqual(result.filter(row => row.firestop).map(row => row.firestop.role).sort(), ['declaration', 'manual', 'system_evidence']);
    assert.deepEqual(automaticRequirements(data, result), result);
    assert.equal(JSON.stringify([data, retained]), before);
  }
  assert.throws(() => automaticRequirements(workspace(), [{ id: 'firestop_declaration', title: 'Falsche Belegung', category: 'Allgemein' }]), { code: 'FIRESTOP_REQUIREMENT_CONFLICT' });
  assert.throws(() => automaticRequirements(workspace(), Array.from({length: 98}, (_, n) => ({ id: 'old_' + n, title: 'Bestand', category: 'Allgemein' }))), { code: 'REQUIREMENT_LIMIT' });
});

test('Kanäle und Funktionserhalt: nur bestätigter Einbau, gezielte Fakten, getrennte Systemnachweise', () => {
  const knowledge = require('../services/knowledgeService');
  const { automaticRequirements } = require('../services/firestopDocumentationService');
  const data = { projekt: {}, leistungsbereiche: { aktiv: ['Andere Technik'] }, brandschutz: [], projektSysteme: [], geraetelisten: [{ id: 'list', aktiv: true, leistungsbereich: 'Andere Technik', positionen: [{ pos: 1, hersteller: 'Beliebiger Hersteller', typ: 'Brandschutzkanal' }, { pos: 2, hersteller: 'Beliebiger Hersteller', typ: 'Tragsystem' }] }] };
  const job = { id: 'synthetic', requirements: [], documents: [], questions: [] };
  const append = (position, key, value, status = 'confirmed') => {
    data.projekt.assistantFacts = knowledge.appendFragments(data, job, [{ subject: { kind: 'device', listId: 'list', position }, key, status, value, supersedes: [] }], { sourceLabel: 'Künstlicher Beleg', sourceQuote: 'Ausschließlich Testdaten' }, 'decision', 'alice').records;
  };
  assert.equal(automaticRequirements(data, [], job.id).length, 0);
  append(1, 'fireProtectionKind', 'installation_duct');
  append(1, 'installationStatus', 'assumed');
  assert.equal(automaticRequirements(data, [], job.id).length, 0);
  // Replace the test assumption with a separately confirmed fact history.
  data.projekt.assistantFacts = data.projekt.assistantFacts.filter(row => row.key !== 'installationStatus');
  append(1, 'installationStatus', 'confirmed'); append(1, 'system', 'Kanal-System A');
  append(2, 'fireProtectionKind', 'circuit_integrity'); append(2, 'installationStatus', 'confirmed'); append(2, 'system', 'Kabel-Tragsystem B');
  job.requirements = automaticRequirements(data, [], job.id);
  assert.equal(job.requirements.length, 6);
  assert.equal(automaticRequirements(data, [], 'different_job').length, 0);
  const rules = firestopRequirements(data, job.requirements, job.id);
  assert.deepEqual(new Set(rules.map(row => row.system.kind)), new Set(['installation_duct', 'circuit_integrity']));
  const state = knowledge.buildKnowledge(data, job);
  assert.ok(!state.facts.some(row => ['wallThicknessMm', 'sealDepthMm', 'openingWidthMm'].includes(row.key)));
  assert.ok(state.facts.some(row => row.key === 'functionalityClass'));
  assert.match(instructions('system_evidence', 'circuit_integrity'), /keine E-Klasse mit EI-Klasse/);
  const mixed = structuredClone(data);
  mixed.leistungsbereiche.aktiv.push('Brandschutzabschottungen');
  const mixedJob = { ...job, requirements: automaticRequirements(mixed, [], job.id) };
  const mixedState = knowledge.buildKnowledge(mixed, mixedJob);
  assert.equal(mixedJob.requirements.length, 9);
  assert.equal(mixedState.facts.filter(row => row.key === 'system' && row.subject.kind === 'requirement').length, 1, 'Gleiche offene Schottsystemfrage auch bei gemischten Brandschutzarten nur einmal');
  data.geraetelisten[0].positionen[1].typ = 'Geänderter Artikel';
  assert.equal(automaticRequirements(data, [], job.id).length, 3, 'Veraltete Fakten dürfen keine neue Pflicht erzeugen');
});

test('Bestehende Aufträge werden lesend ergänzt; Systemwechsel, Versionsschutz und Rollback erhalten Originale', async () => {
  const f = await fixture();
  const token = f.makeToken('alice', { scopes }).token;
  const request = (url, options = {}) => f.request(url, { token, ...options });
  const base = '/projects/same';
  const files = dataFilesForProject(f.root, 'alice', 'same');
  try {
    const assistant = require('../services/documentAssistantService').createDocumentAssistantService(f.root, { db: f.db, verificationService: f.productVerification });
    const job = assistant.create('alice', 'same', { instruction: 'Künstlichen Auftrag vor Aktivierung der Brandschutzpflichten anlegen.', requirements: [{ id: 'keep', title: 'Bestandsanforderung erhalten', category: 'Allgemein' }] });
    const pdf = await require('pdf-lib').PDFDocument.create(); pdf.addPage().drawText('Synthetic retained document');
    const proposal = await assistant.propose('alice', job.id, { title: 'Bestand', category: 'Allgemein', sourceLabel: 'Test', reason: 'Erhalt der Freigabe prüfen', requirementIds: ['keep'] }, { buffer: Buffer.from(await pdf.save()), originalName: 'retained.pdf' });
    await assistant.content('alice', job.id, proposal.id); assistant.viewed('alice', job.id, proposal.id, proposal.sha256);
    const revision = (await request(base)).etag.slice(1, -1);
    await assistant.approve('alice', job.id, proposal.id, { reviewed: 'on', sha256: proposal.sha256, revision, metadata: { title: proposal.title, category: proposal.category } });
    const protectedTables = () => Object.fromEntries(['document_proposals', 'document_review_views', 'documentation_requirements'].map(name => [name, f.db.prepare('SELECT * FROM ' + name).all()]));
    const retained = protectedTables();
    await store.withProjectDataTransaction(() => writeJson(files.leistungsbereiche, { aktiv: ['Brandschutzabschottungen'] }));
    const first = assistant.get('alice', job.id);
    assert.equal(first.requirements.length, 4); assert.notEqual(first.version, job.version);
    for (let i = 0; i < 3; i++) assert.deepEqual(assistant.get('alice', job.id), first);
    assert.deepEqual(protectedTables(), retained, 'Abrufe dürfen keine Bestandszeilen schreiben');
    const status = (await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data;
    assert.ok(status.requirements.find(row => row.id === 'keep').fulfilled);
    assert.equal(status.requirements.filter(row => row.firestop).length, 3);
    assert.equal(status.firestopDocumentation.missingRequirements, 0);
    // An explicit normal write captures the currently derived identities as history.
    assistant.update('alice', job.id, { message: 'Künstlicher Arbeitsstand' });
    const oldIds = assistant.get('alice', job.id).requirements.filter(row => row.firestop).map(row => row.id);
    await store.withProjectDataTransaction(() => writeJson(files.brandschutz, [{ id: 'actual', aktiv: true, hersteller: 'Neuer Hersteller', system: 'System C' }]));
    const changed = assistant.get('alice', job.id);
    assert.notEqual(changed.version, first.version);
    assert.ok(oldIds.every(id => changed.requirements.some(row => row.id === id)));
    const next = (await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data;
    assert.equal(next.requirements.filter(row => row.firestop && row.applicable !== false).length, 3);
    assert.equal(next.requirements.filter(row => row.firestop && row.applicable === false).length, 2);
    const current = protectedTables();
    assert.deepEqual(current.document_proposals, retained.document_proposals);
    assert.deepEqual(current.document_review_views, retained.document_review_views);
    const count = f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n;
    assert.throws(() => assistant.create('alice', 'same', { instruction: 'Künstlichen Kennungskonflikt atomar prüfen.', requirements: [{ id: 'firestop_declaration', title: 'Falsch', category: 'Allgemein' }] }), { code: 'FIRESTOP_REQUIREMENT_CONFLICT' });
    assert.equal(f.db.prepare('SELECT count(*) n FROM documentation_jobs').get().n, count);
    assert.deepEqual(protectedTables(), current);
    await store.withProjectDataTransaction(() => writeJson(files.leistungsbereiche, { aktiv: [] }));
    const inactive = (await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data;
    assert.ok(inactive.requirements.filter(row => row.firestop).every(row => row.applicable === false));
    assert.deepEqual(protectedTables(), current);
  } finally { await f.cleanup(); }
});
