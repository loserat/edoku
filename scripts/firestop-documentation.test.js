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
    assert.equal(plan.policy.firestopDocuments, 'firestop_documents_v1');
    assert.equal(plan.nextAction.code, 'DEFINE_FIRESTOP_REQUIREMENTS');
    assert.equal(plan.nextAction.requirements.length, 3); assert.equal(count(), before);
    assert.ok(Buffer.byteLength(JSON.stringify(plan)) < 7168);
    await call('edoku_update_documentation_job', { projectId: 'same', jobId: job.id, update: { requirements: plan.nextAction.requirements } });
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
