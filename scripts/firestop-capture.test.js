const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { input } = require('../src/api/firestopSchemas');
const { normalizePostedBrandschutz, addBrandschutzEintrag } = require('../services/brandschutzService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const { readJson, writeJson } = require('../services/jsonService');
const store = require('../services/projectDataStoreService');
const knowledge = require('../services/knowledgeService');
const evidence = { sourceLabel: 'Künstlicher Benutzerbeleg', sourceQuote: 'ZZ330 mit Steinen; Wand zum Keller, Öffnung 20 × 20 cm. Weitere Einbaudaten unbekannt.' };
const values = { hersteller: 'ZAPP-ZIMMERMANN', components: ['ZZ330', 'Brandschutzsteine (Typ offen)'], raum: 'Wand zum Keller', bauteil: 'Wand', openingWidthMm: 200, openingHeightMm: 200 };
const area = 'Brandschutzabschottungen';
const retained = { id: 'bs_003', aktiv: true, geschoss: 'EG', raum: 'Altbestand', bauteil: 'Wand', custom: { keep: true }, foto_vorher: 'anhaenge/bestand.png', foto_nachher: '', openingWidthMm: 100 };

test('Schottvertrag: nur Einbaudaten, echte mm-Werte und Benutzerbeleg; keine Foto-/Freigabe-/ID-Felder', () => {
  assert.ok(input.safeParse({ values, evidence }).success);
  for (const patch of [{ id: 'bs_fake' }, { aktiv: false }, { foto_vorher: '/etc/passwd' }, { signature: 'unterschrieben' }, { approved: true }, { openingWidthMm: '20cm' }, { openingHeightMm: -1 }, { openingWidthMm: 0 }, { sealDepthMm: Infinity }, { components: Array(21).fill('a') }, { ausfuehrungsdatum: '2026-02-30' }, {}]) {
    assert.equal(input.safeParse({ values: patch, evidence }).success, false, JSON.stringify(patch));
  }
  assert.equal(input.safeParse({ values }).success, false);
  assert.equal(input.safeParse({ values, evidence: { sourceLabel: 'x', sourceQuote: '' } }).success, false);
});

test('GUI-Rundlauf erhält API-Maße, Komponenten, Foto- und unbekannte Bestandsfelder; technische IDs kollidieren nicht', () => {
  const entry = { ...retained, components: ['ZZ330'], wallType: 'Massivwand', sealDepthMm: 150 };
  const result = normalizePostedBrandschutz([{ ...entry, aktiv: 'on', raum: 'Neu', openingWidthMm: '9999', components: ['fremd'] }], [entry])[0];
  assert.equal(result.raum, 'Neu'); assert.equal(result.openingWidthMm, 100); assert.deepEqual(result.components, ['ZZ330']);
  assert.equal(result.sealDepthMm, 150); assert.deepEqual(result.custom, entry.custom); assert.equal(result.foto_vorher, entry.foto_vorher);
  const added = addBrandschutzEintrag([{ id: 'bs_001' }, { id: 'bs_003' }]);
  assert.equal(new Set(added.map(row => row.id)).size, 3); assert.equal(added.at(-1).id, 'bs_004');
});

test('Schott-Fakten nutzen bestätigte Einbaudaten; unbekannte System-/Wand-/Tiefenangaben bleiben offen', () => {
  const entry = { ...values, id: 'bs_test', aktiv: true }, data = { brandschutz: [entry], projekt: {} }, job = { id: 'test', requirements: [] };
  const fact = key => knowledge.resolveFact(data, job, { subject: { kind: 'firestop', entryId: entry.id }, key });
  for (const key of ['openingWidthMm', 'openingHeightMm', 'components', 'ortDerAusfuehrung']) assert.equal(fact(key).state, 'confirmed', key);
  for (const key of ['system', 'wallType', 'sealDepthMm', 'wallThicknessMm', 'fireResistanceMinutes', 'ausfuehrungsdatum']) assert.equal(fact(key).state, 'unknown', key);
  entry.abschottungssystem = 'Bestätigtes System'; assert.equal(fact('system').value, entry.abschottungssystem);
});

test('Echte API/MCP: Schotts gezielt erfassen/ändern, atomar protokollieren, Bestand und manuelle Freigaben erhalten', async t => {
  const f = await fixture({ setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await store.withProjectDataTransaction(async () => {
      await writeJson(files.leistungsbereiche, { aktiv: [area], optionen: [area] });
      await writeJson(files.brandschutz, [retained]);
    });
  } });
  const token = f.makeToken('alice', { scopes }).token;
  const root = '/projects/same', endpoint = root + '/firestops';
  const req = (url, options = {}) => f.request(url, { token, ...options });
  const revision = async () => (await req(root)).etag;
  const files = dataFilesForProject(f.root, 'alice', 'same');
  const snapshot = () => Object.fromEntries(['document_proposals', 'document_review_views'].map(name => [name, f.db.prepare('SELECT * FROM ' + name).all()]));
  let created, etag;
  try {
    const assistant = require('../services/documentAssistantService').createDocumentAssistantService(f.root, { db: f.db, verificationService: f.productVerification });
    const job = assistant.create('alice', 'same', { instruction: 'Künstlichen Dateibestand beim Schotttest erhalten.' });
    const pdf = await require('pdf-lib').PDFDocument.create(); pdf.addPage().drawText('Synthetic retained original');
    const approved = await assistant.propose('alice', job.id, { title: 'Künstlicher Bestandsbeleg', category: 'Allgemein', sourceLabel: 'Test', reason: 'Bestandsschutz prüfen' }, { buffer: Buffer.from(await pdf.save()), originalName: 'synthetic.pdf' });
    await assistant.content('alice', job.id, approved.id); assistant.viewed('alice', job.id, approved.id, approved.sha256);
    await assistant.approve('alice', job.id, approved.id, { reviewed: 'on', sha256: approved.sha256, revision: (await revision()).slice(1, -1), metadata: { title: approved.title, category: approved.category } });
    const other = await req('/projects/second'), beforeDecisions = snapshot();
    await t.test('Pflichtbeleg, Schreibrecht, Version, Projektgrenzen und aktiver Bereich werden geprüft', async () => {
      etag = await revision();
      const request = { method: 'POST', headers: { 'If-Match': etag, 'Idempotency-Key': 'firestop-invalid' }, body: { values, evidence } };
      assert.equal((await req(endpoint, { ...request, headers: { 'Idempotency-Key': 'missing-etag' } })).status, 428);
      assert.equal((await req(endpoint, { ...request, headers: { 'If-Match': etag } })).status, 428);
      assert.equal((await req(endpoint, { ...request, body: { values } })).status, 400);
      const readOnly = f.makeToken('alice', { scopes: ['projects:read', 'documents:read'] }).token;
      assert.equal((await req(endpoint, { ...request, token: readOnly })).status, 403);
      const limited = f.makeToken('alice', { scopes, projectIds: ['second'] }).token;
      assert.equal((await req(endpoint, { ...request, token: limited })).status, 404);
      assert.equal((await req('/projects/second/firestops', { ...request, headers: { 'If-Match': other.etag, 'Idempotency-Key': 'inactive-project' } })).data.error.code, 'INACTIVE_FIRESTOP_AREA');
      assert.deepEqual((await req(endpoint)).data.data.items, [retained]);
    });
    await t.test('Wiederholsichere Anlage erhält Altbestand und lässt fehlende Einbaudaten leer', async () => {
      const request = { method: 'POST', headers: { 'If-Match': etag, 'Idempotency-Key': 'firestop-create-1' }, body: { values, evidence } };
      const response = await req(endpoint, request); assert.equal(response.status, 201);
      created = response.data.data.id; etag = response.etag;
      assert.match(created, /^bs_[a-f0-9]{24}$/); assert.equal(response.data.data.changed, true);
      const replay = await req(endpoint, request); assert.equal(replay.status, 201); assert.equal(replay.replayed, 'true'); assert.equal(replay.data.data.id, created);
      assert.equal((await revision()), etag);
      assert.equal((await req(endpoint, { ...request, body: { values: { ...values, raum: 'anderer Ort' }, evidence } })).status, 409);
      const entries = (await req(endpoint)).data.data.items; assert.equal(entries.length, 2); assert.deepEqual(entries[0], retained);
      const entry = entries[1]; assert.equal(entry.system, ''); assert.equal(entry.feuerwiderstand, ''); assert.equal(entry.ausfuehrungsdatum, ''); assert.equal(entry.wallThicknessMm, undefined);
      const project = await readJson(files.projekt); assert.equal(project.firestopChanges.length, 1); assert.deepEqual(project.firestopChanges[0].evidence, evidence);
    });
    await t.test('Gezieltes Lesen ist nach Eigentümer und Projekt begrenzt', async () => {
      const read = await req(endpoint + '/' + created); assert.equal(read.data.data.openingWidthMm, 200); assert.equal(read.etag, etag);
      assert.equal((await req(endpoint + '/unknown')).status, 404);
      assert.equal((await req('/projects/second/firestops/' + created)).status, 404);
      const bob = f.makeToken('bob', { scopes }).token;
      assert.equal((await req(endpoint + '/' + created, { token: bob })).status, 404);
    });
    await t.test('Teiländerung erhält Originalfelder/Fotos, führt Historie und wird identisch nicht erneut geschrieben', async () => {
      const response = await req(endpoint + '/bs_003', { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { medium: 'Kabel', wallThicknessMm: 300 }, evidence } });
      assert.equal(response.status, 200); assert.notEqual(response.etag, etag); const stale = etag; etag = response.etag;
      const saved = (await req(endpoint + '/bs_003')).data.data;
      assert.deepEqual(saved, { ...retained, medium: 'Kabel', wallThicknessMm: 300 });
      assert.equal((await req(endpoint + '/bs_003', { method: 'PATCH', headers: { 'If-Match': stale }, body: { values: { medium: 'Rohre' }, evidence } })).status, 412);
      const unchanged = await req(endpoint + '/bs_003', { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { medium: 'Kabel' }, evidence } });
      assert.equal(unchanged.data.data.changed, false); assert.equal(unchanged.etag, etag);
      const history = (await readJson(files.projekt)).firestopChanges; assert.equal(history.length, 2); assert.equal(history[1].before.wallThicknessMm, null); assert.equal(history[1].values.wallThicknessMm, 300);
    });
    await t.test('Gleichzeitiges Speichern verliert keine Änderung; unbekannte Ziele verändern nichts', async () => {
      const responses = await Promise.all(['A', 'B'].map(monteur => req(endpoint + '/' + created, { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { monteur }, evidence } })));
      assert.equal(responses.filter(x => x.status === 200).length, 1); assert.ok(responses.some(x => [409, 412].includes(x.status)));
      etag = await revision();
      assert.equal((await req(endpoint + '/unknown', { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { raum: 'x' }, evidence } })).status, 404);
      assert.equal(await revision(), etag);
    });
    await t.test('Atomarer Rollback und eindeutige aktive Altkennungen verhindern Teiländerungen', async () => {
      const project = await readJson(files.projekt), entries = await readJson(files.brandschutz);
      await store.withProjectDataTransaction(() => writeJson(files.projekt, { ...project, firestopChanges: 'kaputt' }));
      etag = await revision();
      assert.equal((await req(endpoint + '/' + created, { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { raum: 'nicht speichern' }, evidence } })).status, 409);
      assert.deepEqual(await readJson(files.brandschutz), entries); assert.equal(await revision(), etag);
      await store.withProjectDataTransaction(async () => { await writeJson(files.projekt, project); await writeJson(files.brandschutz, [...entries, { id: 'bs_off', aktiv: false }, { id: 'dup' }, { id: 'dup' }]); });
      etag = await revision();
      for (const [id, status] of [['bs_off', 409], ['dup', 404]]) assert.equal((await req(endpoint + '/' + id, { method: 'PATCH', headers: { 'If-Match': etag }, body: { values: { raum: 'nicht speichern' }, evidence } })).status, status);
      await store.withProjectDataTransaction(() => writeJson(files.brandschutz, entries)); etag = await revision();
    });
    await t.test('Echter MCP-Katalog und echte Aufrufe: 58 Werkzeuge, einzeln lesen/anlegen/ändern, kein Freigabeweg', async () => {
      const client = mcpClient(f.base, token, true), reader = mcpClient(f.base, token);
      try {
        await client.initialize(); await reader.initialize();
        const catalog = (await client.rpc('tools/list', {})).result.tools; assert.equal(catalog.length, 58);
        assert.ok(catalog.some(x => x.name === 'edoku_add_firestop' && !x.annotations.readOnlyHint)); assert.ok(!catalog.some(x => /approve|freigeben/i.test(x.name)));
        assert.ok(!(await reader.rpc('tools/list', {})).result.tools.some(x => x.name === 'edoku_add_firestop'));
        const call = async (name, args) => { const response = (await client.rpc('tools/call', { name, arguments: args })).result; assert.ok(!response.isError, JSON.stringify(response)); return response.structuredContent; };
        const read = await call('edoku_get_section', { projectId: 'same', section: 'firestops', entryId: created }); assert.equal(read.data.id, created);
        const added = await call('edoku_add_firestop', { projectId: 'same', etag: read.etag, requestId: 'mcp-firestop-create', values: { raum: 'MCP-Testort', bauteil: 'Decke' }, evidence });
        const changed = await call('edoku_patch_firestop', { projectId: 'same', entryId: added.data.id, etag: added.etag, values: { openingWidthMm: 200 }, evidence }); assert.ok(changed.data.changed);
        assert.deepEqual((await call('edoku_get_section', { projectId: 'same', section: 'firestops', entryId: added.data.id })).data.openingWidthMm, 200);
      } finally { await client.close(); await reader.close(); }
    });
    assert.deepEqual(snapshot(), beforeDecisions);
    const otherAfter = await req('/projects/second'); assert.deepEqual(otherAfter.data.data, other.data.data); assert.equal(otherAfter.etag, other.etag);
    assert.equal(f.db.pragma('integrity_check', { simple: true }), 'ok'); assert.deepEqual(f.db.pragma('foreign_key_check'), []);
  } finally { await f.cleanup(); }
});
