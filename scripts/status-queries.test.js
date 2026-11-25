const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const output = require('../src/api/responses');
const { statusPage, encodedBytes } = require('../services/statusQueryService');
const { readJson, writeJson } = require('../services/jsonService');
const { dataFilesForProject } = require('../services/projectArchiveService');
const store = require('../services/projectDataStoreService');
const area = 'Elektroinstallation / DIN VDE 0100';

test('Statusseiten: UTF-8 und escaped Text begrenzen, ohne übersprungene Einträge', () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: 'row_' + i, text: ('ü😀\\"\u0001').repeat(120) }));
  const seen = []; let offset = 0;
  do {
    const result = statusPage({ view: 'compact' }, rows, { limit: 10, offset });
    assert.ok(encodedBytes(result) <= 6144); assert.ok(result.returned > 0); assert.equal(result.total, rows.length);
    assert.equal(result.returned, result.items.length); assert.ok(result.returned < 10);
    assert.ok(Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ success: true, data: result }) }] })) < 8192);
    seen.push(...result.items.map(row => row.id)); offset = result.nextOffset;
  } while (offset !== null);
  assert.deepEqual(seen, rows.map(row => row.id));
  assert.deepEqual(statusPage({}, [], { limit: 3, offset: 0 }).items, []);
  assert.throws(() => statusPage({}, [{ text: 'x'.repeat(9000) }], { limit: 1, offset: 0 }), error => error.apiCode === 'RESPONSE_LIMIT');
});

async function setup() {
  const f = await fixture({ setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await writeJson(files.leistungsbereiche, { aktiv: [area], optionen: [area] });
    await writeJson(files.geraetelisten, [{ id: 'devices', titel: 'Großer künstlicher Bestand', leistungsbereich: area, aktiv: true, export: true,
      positionen: Array.from({ length: 100 }, (_, i) => ({ pos: i + 1, hersteller: 'Testhersteller', typ: 'ART-' + i, system: '', custom: 'behalten' })) }]);
  } });
  const key = f.makeToken('alice', { scopes });
  const request = (url, options = {}) => f.request(url, { token: key.token, ...options });
  const requirements = Array.from({ length: 100 }, (_, i) => ({ id: 'req_' + i, title: ('Künstliche Anforderung ' + i + ' ').padEnd(195, 'ä'), category: 'Nachweise', ...(i === 0 ? { devices: Array.from({ length: 100 }, (_, pos) => ({ listId: 'devices', position: pos + 1, manufacturer: 'Testhersteller', model: 'ART-' + pos })) } : {}) }));
  const created = await request('/projects/same/assistant/jobs', { method: 'POST', body: { instruction: 'Großer synthetischer Bestand für ausschließlich lesende Statusprüfungen.', requirements } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  return { ...f, key, request, job: created.data.data, requirements, files: dataFilesForProject(f.root, 'alice', 'same') };
}
const capture = f => Object.fromEntries(['project_documents', 'project_data_revisions', 'project_device_lists', 'project_device_positions', 'documentation_jobs', 'documentation_requirements', 'document_proposals', 'document_review_views'].map(table => [table, JSON.stringify(f.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all())]));
const assertReadOnly = (f, before) => assert.deepEqual(capture(f), before);

test('HTTP-Status: kompakte Gesamtzähler, direktes Anforderungsziel, Seiten und unveränderte Altantwort', async () => {
  const f = await setup();
  try {
    const before = capture(f), base = '/projects/same/documentation-status';
    const compact = await f.request(base + '?view=compact');
    assert.equal(compact.status, 200, JSON.stringify(compact.data)); assert.ok(output.envelope(output.statusResponse).safeParse(compact.data).success);
    const c = compact.data.data;
    assert.equal(c.counts.requirements, 100); assert.equal(c.counts.fulfilledRequirements, 0); assert.equal(c.counts.missingRequirements, 100);
    assert.equal(c.professionalApproval, 'not_assessed'); assert.equal(c.view, 'compact'); assert.equal(c.section, 'summary');
    assert.equal(c.issues, undefined); assert.equal(c.requirements, undefined); assert.equal(c.export.missingOutputs, undefined);
    assert.ok(Buffer.byteLength(JSON.stringify(compact.data)) < 8192);
    const query = base + '?view=compact&assistantJobId=' + f.job.id;
    const target = await f.request(query + '&section=requirements&entryId=req_99');
    assert.equal(target.status, 200); assert.equal(target.data.data.items.length, 1); assert.equal(target.data.data.items[0].id, 'req_99');
    assert.equal(target.data.data.items[0].fulfilled, false); assert.equal(target.data.data.total, 1); assert.equal(target.etag, compact.etag);
    assert.equal(target.data.data.jobVersion, f.job.version);
    const many = (await f.request(query + '&section=requirements&entryId=req_0')).data.data.items[0];
    assert.equal(many.deviceCount, 100); assert.equal(many.devices, undefined);
    const details = await f.request(query.replace('view=compact', 'view=full') + '&section=requirements&entryId=req_0');
    assert.equal(details.status, 200); assert.equal(details.data.data.items[0].devices.length, 100);
    for (const section of ['issues', 'questions', 'documents', 'outputs', 'requirements']) {
      const page = await f.request(query + '&section=' + section + '&limit=10');
      assert.equal(page.status, 200, JSON.stringify(page.data)); assert.ok(output.envelope(output.statusResponse).safeParse(page.data).success);
      assert.equal(page.data.data.returned, page.data.data.items.length); assert.ok(Buffer.byteLength(JSON.stringify(page.data)) < 8192);
    }
    const ids = []; let offset = 0;
    do {
      const page = (await f.request(query + '&section=requirements&limit=10&offset=' + offset)).data.data;
      ids.push(...page.items.map(row => row.id)); offset = page.nextOffset;
    } while (offset !== null);
    assert.equal(new Set(ids).size, f.requirements.length);
    assert.deepEqual([...ids].sort(), f.requirements.map(row => row.id).sort());
    assert.equal((await f.request(query + '&section=requirements&entryId=unknown')).status, 404);
    for (const suffix of ['&entryId=req_99', '&section=requirements&limit=11', '&section=unknown', '&section=issues&entryId=req_99', '&unexpected=yes'])
      assert.equal((await f.request(query + suffix)).status, 400, suffix);
    assert.equal((await f.request(base + '?view=compact&section=requirements&entryId=req_99')).status, 400);
    // Existing small HTTP callers keep their full response; large full reads remain bounded.
    const small = await f.request('/projects/second/documentation-status'); assert.equal(small.status, 200); assert.ok(Array.isArray(small.data.data.issues));
    assert.equal(small.data.data.view, undefined);
    const smallCompact = (await f.request('/projects/second/documentation-status?view=compact')).data.data;
    for (const flag of ['canGenerate', 'inputComplete', 'reviewComplete', 'technicalExportComplete', 'professionalApproval']) assert.equal(smallCompact[flag], small.data.data[flag]);
    assert.equal(smallCompact.counts.issues, small.data.data.issues.length);
    assert.equal((await f.request(base + '?view=full')).status, 413);
    assertReadOnly(f, before);
  } finally { await f.cleanup(); }
});

async function seedWork(f) {
  const jobRoute = '/projects/same/assistant/jobs/' + f.job.id;
  const question = { id: 'waiting_q', prompt: 'Welche tatsächliche Ausführung?', stage: 'materials', context: 'Synthetisches Statusziel.', targets: [{ kind: 'project', field: 'ortDerAusfuehrung' }] };
  const ask = await f.request(jobRoute + '/questions', { method: 'POST', body: { version: f.job.version, question } });
  assert.equal(ask.status, 200); f.job.version = ask.data.data.jobVersion;
  const targets = [{ target: { kind: 'requirement', requirementId: 'req_99' }, state: 'awaiting_user' }, { target: { kind: 'requirement', requirementId: 'req_0' }, state: 'not_found' }, { target: { kind: 'question', questionId: question.id }, state: 'awaiting_manufacturer' }];
  const sources = Array.from({ length: 8 }, (_, i) => 'https://manufacturer.example.invalid/' + i + '?q=' + 'x'.repeat(1800));
  for (const entry of targets) {
    const response = await f.request(jobRoute + '/document-work', { method: 'POST', headers: { 'If-Match': (await f.request('/projects/same')).etag }, body: {
      ...entry, jobVersion: f.job.version, reason: 'Künstlicher Recherchebeleg ' + 'ü😀\\"'.repeat(150), sources,
      evidence: { kind: 'user', sourceLabel: 'Künstliche Chatantwort', sourceQuote: 'Dieses Testziel bitte noch offen lassen.' }
    } });
    assert.equal(response.status, 200, JSON.stringify(response.data));
  }
  const project = await readJson(f.files.projekt), record = project.assistantWorkHistory.find(row => row.target.requirementId === 'req_99');
  // Synthetic history reuses its valid context fingerprint; production records are untouched.
  project.assistantWorkHistory.push(...Array.from({ length: 21 }, (_, i) => ({ ...record, state: i % 2 ? 'resume' : 'awaiting_user', inputHash: crypto.createHash('sha256').update('test-' + i).digest('hex'), recordedAt: new Date(1800000000000 + i * 1000).toISOString() })));
  await writeJson(f.files.projekt, project);
  return jobRoute;
}

test('Wartezustände: vor Pagination nach Ziel/Zustand filtern, Historie und Originalbelege erhalten', async () => {
  const f = await setup();
  try {
    const route = await seedWork(f), before = capture(f), base = route + '/document-work?view=compact';
    const target = await f.request(base + '&requirementId=req_99');
    assert.equal(target.status, 200); assert.equal(target.data.data.total, 1); assert.equal(target.data.data.items[0].target.requirementId, 'req_99');
    assert.equal(target.data.data.items[0].state, 'awaiting_user'); assert.equal(target.data.data.items[0].sources, undefined);
    const state = await f.request(base + '&state=not_found&limit=1');
    assert.equal(state.data.data.total, 1); assert.equal(state.data.data.items[0].target.requirementId, 'req_0');
    const q = await f.request(base + '&questionId=waiting_q'); assert.equal(q.data.data.items[0].target.questionId, 'waiting_q');
    assert.equal((await f.request(base + '&requirementId=req_98')).data.data.total, 0);
    assert.equal((await f.request(base + '&requirementId=unknown')).status, 404);
    assert.equal((await f.request(base + '&questionId=unknown')).status, 404);
    assert.equal((await f.request(base + '&requirementId=req_99&questionId=waiting_q')).status, 400);
    assert.equal((await f.request(base + '&state=approved')).status, 400);
    const history = await f.request(base + '&requirementId=req_99&history=true&state=resume&limit=10');
    assert.equal(history.data.data.total, 10); assert.ok(history.data.data.items.every(row => row.state === 'resume'));
    const full = await f.request(route + '/document-work?view=full&requirementId=req_99&limit=1');
    assert.equal(full.status, 200); assert.equal(full.data.data.items[0].sources.length, 8);
    assert.equal(full.data.data.items[0].evidence.sourceQuote, 'Dieses Testziel bitte noch offen lassen.');
    assertReadOnly(f, before);
  } finally { await f.cleanup(); }
});

for (const mode of ['structured', 'text']) test('Echter MCP: kompakte Defaults, gezielte Statusziele und Bytegrenze (' + mode + ')', async () => {
  const f = await setup(); let client;
  try {
    await seedWork(f); const before = capture(f);
    client = mcpClient(f.base, f.key.token, false, '', mode); await client.initialize();
    const catalog = (await client.rpc('tools/list', {})).result.tools;
    assert.equal(catalog.length, 22); assert.ok(!catalog.some(tool => /approve/.test(tool.name)));
    const status = catalog.find(tool => tool.name === 'edoku_documentation_status'); assert.equal(status.inputSchema.properties.view.default, 'compact');
    const call = async (name, args) => {
      const result = (await client.rpc('tools/call', { name, arguments: { projectId: 'same', ...args } })).result;
      assert.ok(!result.isError, JSON.stringify(result)); assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 8192);
      return (result.structuredContent || JSON.parse(result.content[0].text)).data;
    };
    const summary = await call('edoku_documentation_status', {});
    assert.equal(summary.view, 'compact'); assert.equal(summary.counts.requirements, 100); assert.equal(summary.requirements, undefined);
    const req = await call('edoku_documentation_status', { jobId: f.job.id, section: 'requirements', entryId: 'req_99' });
    assert.equal(req.items[0].id, 'req_99'); assert.equal(req.items[0].fulfilled, false);
    const page = await call('edoku_documentation_status', { jobId: f.job.id, section: 'issues', limit: 10 });
    assert.ok(page.hasMore); assert.ok(page.nextOffset > 0);
    const work = await call('edoku_document_work_status', { jobId: f.job.id, requirementId: 'req_99' });
    assert.equal(work.items.length, 1); assert.equal(work.items[0].state, 'awaiting_user');
    const hist = await call('edoku_document_work_status', { jobId: f.job.id, requirementId: 'req_99', history: 'true', state: 'resume', limit: 10 });
    assert.equal(hist.total, 10);
    assertReadOnly(f, before);
  } finally { if (client) await client.close(); await f.cleanup(); }
});

test('Statusziele: Benutzer-, Projekt-, Auftrags- und Rechteprüfung bleiben wirksam', async () => {
  const f = await setup();
  try {
    const restricted = f.makeToken('alice', { scopes, projectIds: ['second'] });
    const bob = f.makeToken('bob', { scopes }), missingScope = f.makeToken('alice', { scopes: ['projects:read', 'assistant:read'] });
    for (const query of ['/projects/same/documentation-status?view=compact&assistantJobId=' + f.job.id + '&section=requirements&entryId=req_99', '/projects/same/assistant/jobs/' + f.job.id + '/document-work?view=compact&requirementId=req_99']) {
      assert.equal((await f.request(query, { token: restricted.token })).status, 404);
      assert.equal((await f.request(query, { token: bob.token })).status, 404);
      assert.equal((await f.request(query, { token: missingScope.token })).status, 403);
    }
    assert.equal((await f.request('/projects/second/documentation-status?view=compact&assistantJobId=' + f.job.id)).status, 404);
    assert.equal((await f.request('/projects/second/assistant/jobs/' + f.job.id + '/document-work?requirementId=req_99')).status, 404);
    const sameIdJob = await f.request('/projects/same/assistant/jobs', { method: 'POST', body: { instruction: 'Separater künstlicher Auftrag.', requirements: [{ id: 'req_99', title: 'Anderes Ziel', category: 'Nachweise' }] } });
    const target = await f.request('/projects/same/documentation-status?view=compact&assistantJobId=' + sameIdJob.data.data.id + '&section=requirements&entryId=req_99');
    assert.equal(target.data.data.items[0].title, 'Anderes Ziel');
    assert.equal((await f.request('/projects/same/assistant/jobs/' + sameIdJob.data.data.id + '/document-work?requirementId=req_99&view=compact')).data.data.total, 0);
  } finally { await f.cleanup(); }
});
