const test = require('node:test'), assert = require('node:assert/strict');
const { buildWorkspace } = require('../services/assistantWorkspaceService');

function entry(id, overrides = {}) {
  return { job: { id, projectId: 'synthetic', version: 1 }, pending: [], openQuestions: [], workItems: [],
    projectReadiness: { requirements: [] }, agentIssues: [],
    datasheetCoverage: { summary: { articles: 0, approved: 0 }, items: [] }, ...overrides };
}
test('GUI priorisiert prüfbare Dateien vor Fragen und Recherche, ohne den Bestand zu ändern', () => {
  const question = { id: 'place', prompt: 'Einbauort?' };
  const files = [{ id: 'z', title: 'Zeta', category: 'Datenblätter', state: 'pending' }, { id: 'a', title: 'Alpha', category: 'Datenblätter', state: 'pending' }];
  const entries = [entry('questions', { openQuestions: [question] }), entry('files', { pending: files,
    projectReadiness: { requirements: [{ id: 'manual', title: 'Anleitung', category: 'Bedienungsanleitungen' }] },
    agentIssues: [{ message: 'Zuordnung fehlt' }] })];
  const original = JSON.stringify(entries), view = buildWorkspace(entries);
  assert.equal(view.next.title, 'Alpha');
  assert.equal(view.next.href, '/assistent/auftraege/files/dateien/a');
  assert.deepEqual(view.groups.map(group => group.rows.length), [2, 1, 2, 0]);
  assert.equal(view.counts.research, 2);
  assert.equal(view.groups.flatMap(group => group.rows).length, view.rows.length);
  assert.equal(new Set(view.groups.flatMap(group => group.rows)).size, view.rows.length);
  assert.equal(JSON.stringify(entries), original);
});
test('Wartende Punkte bleiben sichtbar, gelten aber nicht als nächste aktive Aktion', () => {
  const view = buildWorkspace([entry('waiting', { openQuestions: [{ id: 'place', prompt: 'Einbauort?' }],
    workItems: [{ state: 'deferred', target: { kind: 'question', questionId: 'place' }, reason: 'Nach Ortstermin' }] })]);
  assert.equal(view.next, null);
  assert.equal(view.counts.waiting, 1);
  assert.equal(view.groups[3].rows[0].record.reason, 'Nach Ortstermin');
  assert.equal(buildWorkspace([]).next, null);
});
test('Artikel nur einmal zählen; geprüfte oder vorgeschlagene Unterlagen bleiben aus der Recherchegruppe', () => {
  const coverage = { summary: { articles: 4, approved: 1 }, items: ['approved','pending','missing','blocked'].map((status, id) => ({ id: String(id), status, manufacturer: 'Test', model: String(id), references: [{}] })) };
  const view = buildWorkspace([entry('one', { datasheetCoverage: coverage }), entry('two', { datasheetCoverage: coverage })]);
  assert.equal(view.counts.articles, 4);
  assert.equal(view.counts.approved, 1);
  assert.equal(view.counts.research, 1);
  assert.equal(view.counts.waiting, 1);
  assert.equal(view.next.kind, 'article');
});
