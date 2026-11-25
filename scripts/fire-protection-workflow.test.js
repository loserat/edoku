const test = require('node:test'), assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { document: documentStatus, guideQuery } = require('../src/api/fireProtectionSchemas');
const { fragment } = require('../src/api/knowledgeSchemas');
const policy = require('../services/fireProtectionPolicy');
const knowledge = require('../services/knowledgeService');
const store = require('../services/projectDataStoreService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const { writeJson, readJson } = require('../services/jsonService');
const { createDocumentAssistantService } = require('../services/documentAssistantService');
const { createDocumentationReadinessService } = require('../services/documentationReadinessService');
const area = 'Elektroinstallation / DIN VDE 0100';
const subject = { kind: 'device', listId: 'devices', position: 1 };

test('Brandschutzfamilien und Herstellerquellen trennen; EAN ist kein Einbaunachweis', () => {
  const channel = policy.classify({ manufacturer: 'OBO', model: '4012197351205' });
  assert.equal(channel.kind, 'installation_duct'); assert.equal(channel.installationConfirmed, false);
  assert.match(channel.productLimit, /kein elektrischer Funktionserhalt/);
  assert.equal(policy.classify({ manufacturer: 'ZAPP-ZIMMERMANN', model: 'ZZ330 und ZZ 217' }).kind, 'penetration_seal');
  assert.equal(policy.classify({ description: 'Tragsystem DIN 4102-12' }).kind, 'circuit_integrity');
  assert.equal(policy.classify({ model: 'Unbekannt' }).kind, 'unknown');
  assert.ok(!policy.sources('OBO', 'PLM D 0404 FS', 'installation_duct').some(row => row.pdfUrl));
  assert.ok(policy.sources('OBO', 'PLM D 0404 FS', 'installation_duct').some(row => /Rapid PLM/.test(row.title)));
  assert.ok(policy.sources('ZAPP-ZIMMERMANN', 'ZZ330', 'penetration_seal').some(row => /Uebereinstimmung/.test(row.pdfUrl)));
  assert.deepEqual(policy.sources('ZAPP-ZIMMERMANN-Fremdfirma', '', 'penetration_seal'), []);
  assert.match(policy.documents('installation_duct').find(row => row.role === 'system_evidence').instruction, /nicht gleichsetzen/);
  assert.match(policy.documents('penetration_seal').find(row => row.role === 'declaration_template').instruction, /Muster im zugehörigen Nachweis/);
});
test('Testannahme, bestätigter Einbau und Dokumentstand sind getrennte Vertragswerte', () => {
  assert.equal(fragment.safeParse({ subject, key: 'installationStatus', status: 'confirmed', value: 'test_assumption' }).success, false);
  assert.equal(fragment.safeParse({ subject, key: 'installationStatus', status: 'inferred', value: 'test_assumption' }).success, true);
  assert.equal(documentStatus.safeParse({ kind: 'penetration_seal', stage: 'prepared', installationBasis: 'test_assumption' }).success, false);
  assert.equal(documentStatus.safeParse({ kind: 'penetration_seal', stage: 'incomplete_draft', templateSourceUrl: 'http://unsafe.example' }).success, false);
  assert.equal(guideQuery.safeParse({ listId: 'devices' }).success, false);
  assert.equal(guideQuery.safeParse({ ...subject, manufacturer: 'OBO' }).success, false);
  for (const kind of ['penetration_seal', 'installation_duct', 'circuit_integrity', 'unknown']) for (const item of policy.questions(kind))
    assert.ok(fragment.safeParse({ subject, key: item.key, status: 'unknown' }).success, item.key);
});

async function setup() {
  const f = await fixture({ setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await writeJson(files.leistungsbereiche, { aktiv: [area], optionen: [area] });
    await writeJson(files.geraetelisten, [{ id: 'devices', leistungsbereich: area, aktiv: true, export: true, positionen: [{ pos: 1, hersteller: 'OBO', typ: '4012197351205', custom: 'behalten' }] }]);
  } });
  const token = f.makeToken('alice', { scopes }).token;
  const request = (url, options = {}) => f.request(url, { token, ...options });
  const assistant = createDocumentAssistantService(f.root, { db: f.db, verificationService: f.productVerification });
  const job = assistant.create('alice', 'same', { instruction: 'Ausschließlich künstliche Brandschutz-Arbeitsabläufe testen.', requirements: [{ id: 'declaration', title: 'Ausgefüllte Übereinstimmungsbestätigung', category: 'Brandschutz' }] });
  return { ...f, token, request, assistant, job };
}
const capture = f => Object.fromEntries(['project_documents','project_data_revisions','project_device_positions','documentation_jobs','documentation_requirements','document_proposals','document_review_views'].map(table => [table, JSON.stringify(f.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all())]));

test('HTTP und echter MCP: kompakte Recherchehilfe, Pagination, Autorisierung und unveränderter Bestand', async () => {
  const f = await setup(), client = mcpClient(f.base, f.token, false);
  try {
    const before = capture(f), query = '/projects/same/fire-protection-guide?jobId=' + f.job.id + '&listId=devices&position=1';
    const summary = await f.request(query); assert.equal(summary.status, 200, JSON.stringify(summary.data));
    assert.equal(summary.data.data.classification.selectedKind, 'installation_duct');
    assert.equal(summary.data.data.installation.confirmed, false); assert.equal(summary.data.data.sequence.length, 7);
    const mismatch = (await f.request(query + '&kind=penetration_seal&section=sources')).data.data;
    assert.equal(mismatch.classification.conflict, true); assert.equal(mismatch.classification.selectedKind, 'unknown');
    assert.ok(!mismatch.items.some(row => row.pdfUrl));
    for (const section of ['documents','questions','sources']) {
      let offset = 0, seen = 0, total;
      do {
        const r = await f.request(query + '&section=' + section + '&limit=1&offset=' + offset);
        assert.equal(r.status, 200, JSON.stringify(r.data)); const page = r.data.data;
        assert.ok(Buffer.byteLength(JSON.stringify(r.data)) < 8192); assert.ok(page.returned <= 1);
        seen += page.returned; total = page.total; offset = page.nextOffset;
      } while (offset !== null);
      assert.equal(seen, total);
    }
    assert.equal((await f.request(query + '&manufacturer=Other')).status, 400);
    assert.equal((await f.request(query.replace('position=1','position=2'))).status, 404);
    assert.equal((await f.request(query.replace('projects/same','projects/second'))).status, 404);
    const narrow = f.makeToken('alice', { scopes: ['projects:read'] }).token;
    assert.equal((await f.request(query, { token: narrow })).status, 403);
    const bob = f.makeToken('bob', { scopes }).token;
    assert.equal((await f.request(query, { token: bob })).status, 404);
    await client.initialize();
    const tools = (await client.rpc('tools/list', {})).result.tools;
    assert.equal(tools.length, 22); assert.ok(tools.find(t => t.name === 'edoku_fire_protection_guide').annotations.readOnlyHint);
    for (const section of ['summary','documents','questions','sources']) {
      const r = (await client.rpc('tools/call', { name: 'edoku_fire_protection_guide', arguments: { projectId: 'same', jobId: f.job.id, manufacturer: 'OBO', model: 'PLM D 0404 FS', section, limit: 10 } })).result;
      assert.ok(!r.isError, JSON.stringify(r)); assert.ok(Buffer.byteLength(JSON.stringify(r)) < 8192);
      assert.equal(r.structuredContent.data.fileApproval, 'manual_gui_per_file');
    }
    assert.deepEqual(capture(f), before);
  } finally { await client.close(); await f.cleanup(); }
});

test('Gespeicherte Annahmen und Zurückstellungen steuern Rückfragen; Widersprüche bleiben offen', async () => {
  const f = await setup();
  try {
    const files = dataFilesForProject(f.root, 'alice', 'same');
    const { loadProjectWorkspace } = require('../services/projectWorkspaceService');
    await store.withProjectDataTransaction(async () => {
      const data = await loadProjectWorkspace(f.root, 'alice', 'same');
      const result = knowledge.appendFragments(data, f.job, [
        fragment.parse({ subject, key: 'installationStatus', status: 'inferred', value: 'test_assumption' }),
        fragment.parse({ subject, key: 'installationDate', status: 'deferred' }),
        fragment.parse({ subject, key: 'fireProtectionKind', status: 'confirmed', value: 'installation_duct' })
      ], { sourceLabel: 'Synthetischer Chat', sourceQuote: 'Nur annehmen; Datum offenlassen.' }, 'decision_test', 'alice');
      await writeJson(files.projekt, { ...data.projekt, assistantFacts: result.records });
    });
    const query = '/projects/same/fire-protection-guide?jobId=' + f.job.id + '&listId=devices&position=1';
    const summary = (await f.request(query)).data.data;
    assert.equal(summary.installation.basis, 'test_assumption'); assert.equal(summary.installation.confirmed, false);
    const questions = (await f.request(query + '&section=questions&limit=10')).data.data.items;
    assert.equal(questions.find(row => row.key === 'installationDate').action, 'do_not_ask');
    const conflict = (await f.request(query + '&kind=penetration_seal')).data.data;
    assert.equal(conflict.classification.conflict, true); assert.equal(conflict.classification.selectedKind, 'unknown');
  } finally { await f.cleanup(); }
});

async function pdf() { const doc = await PDFDocument.create(); doc.addPage().drawText('SYNTHETIC DRAFT ' + require('node:crypto').randomUUID()); return { buffer: Buffer.from(await doc.save()), originalName: 'synthetic.pdf' }; }
const draft = { kind: 'penetration_seal', stage: 'incomplete_draft', installationBasis: 'unknown', templateSourceUrl: 'https://manufacturer.example/original.pdf', templateSha256: 'a'.repeat(64) };
test('Vorlage und Entwurf dürfen keine Pflicht binden; echte manuelle Prüfung bleibt erforderlich', async () => {
  const f = await setup();
  try {
    const metadata = { title: 'Unvollständiger Entwurf', category: 'Brandschutz', sourceLabel: 'Künstliche Originalvorlage', reason: 'Offene Angaben sichtbar lassen.', fireProtectionDocument: draft };
    await assert.rejects(f.assistant.propose('alice', f.job.id, { ...metadata, requirementIds: ['declaration'] }, await pdf()), e => e.apiCode === 'INCOMPLETE_DECLARATION_BINDING');
    await assert.rejects(f.assistant.propose('alice', f.job.id, { ...metadata, fireProtectionDocument: undefined, title: 'Übereinstimmungsbestätigung – Muster', requirementIds: ['declaration'] }, await pdf()), e => e.apiCode === 'INCOMPLETE_DECLARATION_BINDING');
    const p = await f.assistant.propose('alice', f.job.id, metadata, await pdf());
    assert.equal(p.state, 'pending'); assert.deepEqual(p.requirementIds, []);
    const revision = () => store.projectDataRevision(f.root, 'alice', 'same');
    await assert.rejects(f.assistant.approve('alice', f.job.id, p.id, { revision: revision(), reviewed: 'on', sha256: p.sha256, metadata: { title: 'Nachweis', category: 'Brandschutz' } }), e => e.apiCode === 'REVIEW_REQUIRED');
    await f.assistant.content('alice', f.job.id, p.id); f.assistant.viewed('alice', f.job.id, p.id, p.sha256);
    // Simulates a human review ONLY in the isolated synthetic fixture.
    const approved = await f.assistant.approve('alice', f.job.id, p.id, { revision: revision(), reviewed: 'on', sha256: p.sha256, metadata: { title: 'Umbenannter Nachweis', category: 'Brandschutz' } });
    assert.ok(approved);
    const attachments = await readJson(dataFilesForProject(f.root, 'alice', 'same').anhaenge, []);
    assert.deepEqual(attachments[0].assistantProvenance.fireProtectionDocument, draft);
    assert.equal(policy.workingDeclaration(attachments[0]), true);
    // Legacy or corrupt bindings must never make an approved draft count as final.
    const row = f.db.prepare('SELECT metadata FROM document_proposals WHERE id=?').get(p.id);
    f.db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.metadata), requirementIds: ['declaration'] }), p.id);
    const status = await createDocumentationReadinessService(f.root).inspect('alice', 'same', { assistantJobId: f.job.id });
    assert.equal(status.requirements.find(r => r.id === 'declaration').fulfilled, false);
    assert.equal(f.assistant.get('alice', f.job.id).documents[0].state, 'approved');
    const ready = await f.assistant.propose('alice', f.job.id, { ...metadata, title: 'Ausgefüllte Übereinstimmungsbestätigung', requirementIds: ['declaration'], fireProtectionDocument: { ...draft, stage: 'prepared', installationBasis: 'confirmed' } }, await pdf());
    assert.equal(ready.state, 'pending'); assert.deepEqual(ready.requirementIds, ['declaration']);
  } finally { await f.cleanup(); }
});
