const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const area = 'Kabeltragsysteme / Verlegesysteme';

test('Unterlagenarbeit: belegte Zustände, Rechte, Versionen, Historie und Wiederaufnahme ohne Erfüllung oder Freigabe', async () => {
  const f = await fixture(), token = f.makeToken('alice', { scopes }), client = mcpClient(f.base, token.token, true);
  const request = (url, opts = {}) => f.request(url, { token: token.token, ...opts });
  const base = '/projects/same';
  try {
    await client.initialize();
    const job = (await request(base + '/assistant/jobs', { method: 'POST', body: { instruction: 'Künstliche Suche und Zurückstellung; keine Freigabe.', requirements: [{ id: 'manual', title: 'Passende Montageanleitung', category: 'Bedienungsanleitungen' }, { id: 'test', title: 'Echtes Messprotokoll', category: 'Messprotokolle' }] } })).data.data;
    const url = base + '/assistant/jobs/' + job.id + '/document-work';
    const plan = async () => (await request(base + '/next-action?jobId=' + job.id + '&limit=10')).data.data;
    const status = async () => (await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data;
    const body = { jobVersion: job.version, target: { kind: 'requirement', requirementId: 'manual' }, state: 'not_found', reason: 'Die passende Montageanleitung wurde bisher nicht gefunden.', sources: ['https://manufacturer.example.invalid/manual'], evidence: { kind: 'research', sourceLabel: 'Künstliche Herstellerquelle', sourceQuote: 'Kein passendes Original vorhanden.' } };
    const send = async value => request(url, { method: 'POST', headers: { 'If-Match': (await request(base)).etag }, body: value });
    const before = JSON.stringify((await request(base + '/assistant/jobs/' + job.id)).data.data);
    const etag = (await request(base)).etag;
    assert.equal((await send({ ...body, sources: [] })).status, 400);
    assert.equal((await send({ ...body, state: 'deferred' })).status, 400);
    assert.equal((await send({ ...body, target: { kind: 'requirement', requirementId: 'unknown' } })).status, 409);
    assert.equal((await send({ ...body, jobVersion: '0'.repeat(64) })).status, 412);
    assert.equal((await send(body)).status, 200);
    assert.equal((await request(url, { method: 'POST', headers: { 'If-Match': etag }, body })).status, 412);
    assert.equal((await send(body)).status, 200);
    assert.equal((await request(url + '?history=true')).data.data.total, 1);
    let p = await plan(); assert.equal(p.waiting.decisions, 1);
    assert.ok(!p.agentActions.items.some(t => t.target?.requirementId === 'manual'));
    assert.ok(p.agentActions.items.some(t => t.target?.requirementId === 'test'));
    assert.equal((await status()).requirements.find(r => r.id === 'manual').fulfilled, false);
    assert.equal((await send({ ...body, state: 'resume', reason: 'Neue Herstellerquelle gefunden; Suche ausdrücklich wieder aufnehmen.' })).status, 200);
    assert.ok((await plan()).agentActions.items.some(t => t.target?.requirementId === 'manual'));
    const foreign = f.makeToken('bob', { scopes }), reader = f.makeToken('alice', { scopes: ['projects:read', 'devices:read', 'assistant:read'] });
    assert.equal((await f.request(url, { token: foreign.token })).status, 404);
    assert.equal((await f.request(url, { token: reader.token, method: 'POST', headers: { 'If-Match': (await request(base)).etag }, body })).status, 403);
    const response = await client.rpc('tools/call', { name: 'edoku_record_document_work', arguments: { projectId: 'same', jobId: job.id, etag: (await request(base)).etag, input: { ...body, state: 'awaiting_manufacturer' } } });
    assert.equal(response.result.structuredContent.success, true);
    const read = await client.rpc('tools/call', { name: 'edoku_document_work_status', arguments: { projectId: 'same', jobId: job.id } });
    assert.equal(read.result.structuredContent.data.items[0].state, 'awaiting_manufacturer');
    assert.equal(JSON.stringify((await request(base + '/assistant/jobs/' + job.id)).data.data), before);
    const question = { id: 'deferred_question', prompt: 'Welche tatsächliche Ausführung wurde verwendet?', stage: 'materials', context: 'Nicht aus Herstellerquellen ableitbar.', targets: [{ kind: 'project', field: 'ortDerAusfuehrung' }] };
    const asked = await request(base + '/assistant/jobs/' + job.id + '/questions', { method: 'POST', body: { version: job.version, question } });
    assert.equal(asked.status, 200);
    const version = asked.data.data.jobVersion;
    assert.equal((await send({ ...body, jobVersion: version, target: { kind: 'question', questionId: question.id }, state: 'deferred', evidence: { kind: 'user', sourceLabel: 'Künstlicher Chat', sourceQuote: 'Das weiß ich gerade nicht; bitte offen lassen.' } })).status, 200);
    assert.ok(!(await plan()).userActions.items.some(t => t.questionId === question.id));
    const answered = await request(base + '/assistant/jobs/' + job.id + '/answers', { method: 'POST', body: { version, answers: [{ questionId: question.id, answer: 'Testort', evidence: { sourceLabel: 'Künstlicher Chat', sourceQuote: 'Testort' } }] } });
    assert.equal(answered.status, 200);
    assert.ok(!(await request(url)).data.data.items.some(r => r.target.kind === 'question'));
    assert.equal((await request(url + '?history=true')).data.data.total, 4);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_review_views').get().n, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_proposals').get().n, 0);
    const { PDFDocument } = require('pdf-lib');
    const service = require('../services/documentAssistantService').createDocumentAssistantService(f.root, { db: f.db, verificationService:f.productVerification });
    const pdf = await PDFDocument.create(); pdf.addPage().drawText('Synthetic unsuitable manual');
    const proposal = await service.propose('alice', job.id, { title: 'Unpassender Testinhalt', category: 'Bedienungsanleitungen', sourceLabel: 'Künstliches Original', reason: 'Belegten Ablehnungsgrund prüfen.', requirementIds: ['manual'] }, { originalName: 'manual.pdf', buffer: Buffer.from(await pdf.save()) });
    const unsuitable = () => ({ ...body, jobVersion: service.get('alice', job.id).version, state: 'unsuitable', proposalId: proposal.id, evidence: { kind: 'user', sourceLabel: 'Künstlicher Chat', sourceQuote: 'Inhalt passte nicht.' } });
    assert.equal((await send(unsuitable())).status, 409);
    service.reject('alice', job.id, proposal.id);
    const decisionBefore = JSON.stringify(service.get('alice', job.id));
    assert.equal((await send(unsuitable())).status, 200);
    assert.equal(JSON.stringify(service.get('alice', job.id)), decisionBefore);
    assert.equal((await status()).requirements.find(r => r.id === 'manual').fulfilled, false);
    assert.ok(!(await plan()).agentActions.items.some(t => t.target?.requirementId === 'manual'));
  } finally { await client.close(); await f.cleanup(); }
});

test('Kompakter MCP-/API-Plan erhält Schutz, Entscheidungen und Kundenpflichten ohne wiederholte interne Entwürfe', async () => {
  const { PDFDocument } = require('pdf-lib');
  const { createDocumentAssistantService } = require('../services/documentAssistantService');
  const f = await fixture(), token = f.makeToken('alice', { scopes }), client = mcpClient(f.base, token.token, true);
  const request = (url, options = {}) => f.request(url, { token: token.token, ...options });
  const base = '/projects/same';
  try {
    await client.initialize();
    const job = (await request(base + '/assistant/jobs', { method: 'POST', body: { instruction: 'Künstliche Prüfung: internen Entwurf ablehnen, tatsächliche Kundenpflicht erhalten.', requirements: [
      { id: 'internal_text', title: 'Interner Arbeitsentwurf', category: 'Nachweise' },
      { id: 'customer_proof', title: 'Tatsächliches Messprotokoll', category: 'Messprotokolle' }
    ] } })).data.data;
    const service = createDocumentAssistantService(f.root, { db: f.db, verificationService:f.productVerification });
    const rejected = [];
    for (const requirementId of ['internal_text', 'customer_proof']) {
      const pdf = await PDFDocument.create(); pdf.addPage().drawText('Synthetic rejected evidence: ' + requirementId);
      const doc = await service.propose('alice', job.id, { title: requirementId, category: requirementId === 'internal_text' ? 'Nachweise' : 'Messprotokolle', sourceLabel: 'Künstlicher Test', reason: 'Ablehnung und Bestandsschutz prüfen.', requirementIds: [requirementId] }, { originalName: 'synthetic.pdf', buffer: Buffer.from(await pdf.save()) });
      service.reject('alice', job.id, doc.id); rejected.push(doc.id);
    }
    const response = await request(base + '/workflow', { method: 'POST', headers: { 'If-Match': (await request(base)).etag }, body: {
      jobId: job.id, jobVersion: service.get('alice', job.id).version, documentScope: 'internal', requirementScopes: [{ id: 'internal_text', scope: 'internal' }],
      evidence: { sourceLabel: 'Synthetischer Benutzerchat', sourceQuote: 'Arbeitsentwurf ausschließlich intern behalten.' }
    } });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const before = service.get('alice', job.id), planUrl = base + '/next-action?jobId=' + job.id;
    const full = await request(planUrl), compact = await request(planUrl + '&view=compact');
    assert.equal(compact.status, 200);
    const a = full.data.data, b = compact.data.data;
    assert.ok(a.structure && a.context && a.agentActions);
    assert.equal(b.view, 'compact'); assert.equal(b.structure, undefined); assert.equal(b.context, undefined);
    for (const key of ['projectETag', 'jobVersion', 'state', 'nextAction', 'datasheets', 'readiness']) assert.deepEqual(b[key], a[key], key);
    assert.equal(b.policy.fileApproval, 'manual_gui_per_file'); assert.equal(b.policy.documentScope, 'internal');
    assert.equal(b.taskCounts.agent, a.agentActions.total); assert.equal(b.contextTool.arguments.section, 'summary');
    assert.equal(b.waiting.rejectedInternal,a.waiting.rejectedInternal.length);
    assert.deepEqual(a.waiting.rejectedInternal, [{ requirementId: 'internal_text', proposalIds: [rejected[0]] }]);
    assert.ok(!a.agentActions.items.some(task => task.code === 'PREPARE_INTERNAL_DOCUMENT' && task.target?.requirementId === 'internal_text'));
    assert.ok(a.agentActions.items.some(task => task.target?.requirementId === 'customer_proof'));
    assert.equal((await request(base + '/documentation-status?assistantJobId=' + job.id)).data.data.requirements.find(item => item.id === 'customer_proof').fulfilled, false);
    const call = async args => (await client.rpc('tools/call', { name: 'edoku_next_action', arguments: { projectId: 'same', jobId: job.id, ...args } })).result;
    const defaultMcp = await call({view:'full'}), compactMcp = await call({ view: 'compact' });
    assert.ok(defaultMcp.content[0].text.length < 600);
    assert.deepEqual(compactMcp.structuredContent.data, b);
    assert.ok(compactMcp.content[0].text.length < 240);
    assert.ok(JSON.stringify(compactMcp).length < JSON.stringify(defaultMcp).length);
    assert.equal((await request(planUrl + '&view=unknown')).status, 400);
    const other = f.makeToken('bob', { scopes });
    assert.equal((await f.request(planUrl + '&view=compact', { token: other.token })).status, 404);
    const narrow = f.makeToken('alice', { scopes: ['projects:read'] });
    assert.equal((await f.request(planUrl + '&view=compact', { token: narrow.token })).status, 403);
    assert.deepEqual(service.get('alice', job.id), before);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM document_review_views').get().n, 0);
  } finally { await client.close(); await f.cleanup(); }
});

test('Agentenablauf: edoku-Struktur, Quellenrecherche, Chatfragen und Wiederaufnahme ohne automatische Dateifreigabe', async t => {
  const f = await fixture({ setup: async ({ root }) => {
    const write = (name, value) => fs.writeFile(path.join(root, 'data', name + '.json'), JSON.stringify(value));
    await write('leistungsbereiche', { optionen: [area], aktiv: [] });
    await write('geraetelisten', []);
    await write('dokumentenmatrix', [{ id: 'description', titel: 'Anlagenbeschreibung', kapitel: '1.1', aktiv: true, export: true, pflicht: true, leistungsbereich: 'Allgemein', dokumenttyp: 'Anlagenbeschreibung', formularart: 'Text' }]);
  } });
  const agent = f.makeToken('alice', { scopes }), client = mcpClient(f.base, agent.token, true);
  const request = (route, options = {}) => f.request(route, { token: agent.token, ...options });
  const call = async (name, args) => {
    const response = await client.rpc('tools/call', { name, arguments: args });
    assert.ok(!response.error && !response.result.isError, JSON.stringify(response));
    return response.result.structuredContent.data;
  };
  let projectId, jobId, listId;
  const route = () => '/projects/' + projectId;
  const jobRoute = () => route() + '/assistant/jobs/' + jobId;
  const revision = async () => (await request(route())).etag;
  const job = async () => (await request(jobRoute())).data.data;
  const plan = () => call('edoku_next_action', { projectId, jobId, limit: 10, view:'full' });
  try {
    await client.initialize();
    const tools = (await client.rpc('tools/list', {})).result.tools;
    assert.ok(tools.some(tool => tool.name === 'edoku_next_action'));
    assert.ok(!tools.some(tool => /approve|freigeben/.test(tool.name)));
    projectId = (await call('edoku_create_project', { requestId: 'agent_workflow_project', input: { projektname: 'Künstlicher Agententest', projektnummer: 'A-01', auftraggeber: 'Synthetischer Kunde', liegenschaft: 'Testhalle', baumassnahme: 'Testinstallation' } })).id;
    jobId = (await call('edoku_create_documentation_job', { projectId, input: { instruction: 'Dokumentation aus der bestätigten Materialliste aufbauen, Verbrauchsmaterial weglassen und jede Datei manuell freigeben lassen.', requirements: [{ id: 'project_evidence', title: 'Projektbezogene Unterlagen zunächst im Bestand prüfen', category: 'Nachweise' }] } })).id;
    await call('edoku_start_workflow', { projectId, etag: await revision(), input: { jobId, documentScope: 'documentation', materialExclusions: { connectionTerminals: true, cablesAndWires: false, fasteningMaterial: true }, evidence: { sourceLabel: 'Synthetischer Benutzerauftrag', sourceQuote: 'Testunterlagen für die Kundendokumentation, auch Kabel dokumentieren; Klemmen und Befestigungsmaterial weglassen.' } } });
    await call('edoku_select_service_areas', { projectId, etag: await revision(), selection: { active: [area] } });
    listId = (await request(route() + '/device-lists')).data.data.items.find(list => list.leistungsbereich === area).id;
    const list = (await request(route() + '/device-lists/' + listId)).data.data;
    const writePosition = async (position, values) => call(list.positionen.total && position === 1 ? 'edoku_patch_device_position' : 'edoku_add_device_position', { projectId, listId, etag: await revision(), ...(list.positionen.total && position === 1 ? { position, changes: values } : { values, requestId: 'agent_material_' + position }) });
    await writePosition(1, { hersteller: 'Künstlicher Hersteller', typ: 'TEST-300', system: 'Testsystem', beschreibung: 'Kein reales Produkt', abmessung: '' });
    await writePosition(2, { hersteller: '', typ: 'NYM-J 3x1,5', system: 'Installationskabel', abmessung: 'bestätigter Testwert' });

    await t.test('Optionale Katalogmaße erzeugen keine Recherchepflicht; unbekannte Hersteller bleiben echte Rückfragen', async () => {
      const p = await plan();
      assert.equal(p.policy.fileApproval, 'manual_gui_per_file');
      assert.equal(p.policy.questions, 'agent_chat');
      assert.equal(p.structure.capabilities.globalStructureChanges, false);
      assert.ok(!p.agentActions.items.some(task => task.code === 'RESEARCH_PRODUCT_DATA' && task.target.position === 1 && task.target.field === 'abmessung'));
      assert.ok(p.userActions.items.some(task => task.code === 'CLARIFY_IN_CHAT' && task.target?.position === 2 && task.target.field === 'hersteller'));
      assert.ok(!p.agentActions.items.some(task => task.code === 'RESEARCH_PRODUCT_DATA' && task.target.position === 2));
      assert.ok(p.agentActions.items.some(task => task.code === 'INSPECT_REQUIRED_DOCUMENT' && task.target.requirementId === 'project_evidence'));
      assert.ok(!p.userActions.items.some(task => task.target?.requirementId === 'project_evidence'));
    });
    let research;
    await t.test('Recherche speichert Herkunft und füllt nur passende fehlende Felder; Konflikte bleiben erhalten', async () => {
      f.db.prepare("UPDATE project_documents SET payload=json_set(payload, '$[0].historicalListField', 'behalten', '$[0].positionen[0].historicalPositionField', 'behalten', '$[0].positionen[0].datenblattId', 'historical-document-reference') WHERE user_id='alice' AND project_id=? AND name='geraetelisten.json'").run(projectId);
      research = { listId, position: 1, manufacturer: 'Künstlicher Hersteller', model: 'TEST-300', values: { abmessung: '60 x 300 mm' }, sourceUrl: 'https://manufacturer.example.invalid/test-300', evidence: { sourceLabel: 'Synthetische Originalquelle im Integrationstest', sourceQuote: 'TEST-300, Abmessung 60 x 300 mm' } };
      const before = await revision();
      await call('edoku_record_research', { projectId, etag: before, input: research });
      assert.equal((await request(route() + '/research', { method: 'POST', headers: { 'If-Match': before }, body: research })).status, 412);
      assert.equal((await request(route() + '/research', { method: 'POST', headers: { 'If-Match': await revision() }, body: { ...research, values: { abmessung: 'falscher Wert' } } })).data.error.code, 'RESEARCH_VALUE_CONFLICT');
      assert.equal((await request(route() + '/research', { method: 'POST', headers: { 'If-Match': await revision() }, body: { ...research, model: 'Anderer Typ' } })).data.error.code, 'DEVICE_REFERENCE_CHANGED');
      assert.equal((await request(route() + '/research', { method: 'POST', headers: { 'If-Match': await revision() }, body: { ...research, values: { hersteller: 'Erfunden' } } })).status, 400);
      const stored = (await request(route())).data.data.projekt;
      assert.equal(stored.produktRecherche.length, 1); assert.equal(stored.produktRecherche[0].evidence.sourceQuote, research.evidence.sourceQuote);
      const rawLists = JSON.parse(f.db.prepare("SELECT payload FROM project_documents WHERE user_id='alice' AND project_id=? AND name='geraetelisten.json'").get(projectId).payload);
      assert.equal(rawLists[0].historicalListField, 'behalten'); assert.equal(rawLists[0].positionen[0].historicalPositionField, 'behalten'); assert.equal(rawLists[0].positionen[0].datenblattId, 'historical-document-reference');
      assert.ok(!(await plan()).agentActions.items.some(task => task.code === 'RESEARCH_PRODUCT_DATA' && task.target.position === 1));
    });
    let question;
    await t.test('Rückfragen landen im Chatkontext, werden dedupliziert und Antworten erst nach Speicherung als erledigt betrachtet', async () => {
      const target = { kind: 'device', listId, position: 2, field: 'hersteller' };
      question = { id: 'actual_cable_make', prompt: 'Welcher Hersteller wurde für dieses Kabel tatsächlich verwendet?', required: true, stage: 'materials', context: 'Ein Kabeltyp identifiziert den eingebauten Hersteller nicht eindeutig.', targets: [target] };
      const first = await call('edoku_ask_question', { projectId, jobId, input: { version: (await job()).version, question } });
      const repeated = await call('edoku_ask_question', { projectId, jobId, input: { version: (await job()).version, question: { ...question, id: 'same_target_again', prompt: 'Nochmals dieselbe Herstellerfrage?' } } });
      assert.equal(first.channel, 'agent_chat'); assert.equal(repeated.created, false); assert.equal(repeated.question.id, question.id);
      let p = await plan();
      assert.equal(p.userActions.items.filter(task => task.questionId === question.id).length, 1);
      const version = (await job()).version;
      await call('edoku_record_user_answers', { projectId, jobId, input: { version, answers: [{ questionId: question.id, answer: 'Bestätigter Testhersteller', evidence: { sourceLabel: 'Synthetischer Agentenchat', sourceQuote: 'Wir haben Bestätigter Testhersteller verwendet.' } }] } });
      assert.equal((await request(jobRoute() + '/questions', { method: 'POST', body: { version, question } })).status, 412);
      p = await plan(); assert.ok(p.agentActions.items.some(task => task.code === 'APPLY_USER_ANSWER' && task.questionId === question.id));
      await call('edoku_patch_device_position', { projectId, listId, position: 2, etag: await revision(), changes: { hersteller: 'Bestätigter Testhersteller' } });
      assert.ok(!(await plan()).agentActions.items.some(task => task.questionId === question.id));
      assert.equal((await job()).questions.length, 1);
    });
    await t.test('Strukturlücken sind echte Rückfragen und schaffen keine erfundenen Felder oder Kapitel', async () => {
      const structural = { id: 'missing_structure', prompt: 'Wie sollen wir die fehlenden Montageort-Angaben in edoku abbilden?', required: true, stage: 'materials', context: 'Die Geräteliste bietet kein eigenes Montageort-Feld.', targets: [{ kind: 'structure', resource: 'device_field', listId, requested: 'Montageort' }] };
      await call('edoku_ask_question', { projectId, jobId, input: { version: (await job()).version, question: structural } });
      assert.ok((await plan()).userActions.items.some(task => task.questionId === structural.id && task.channel === 'agent_chat'));
      assert.equal((await request(jobRoute() + '/questions', { method: 'POST', body: { version: (await job()).version, question: { ...structural, id: 'existing', targets: [{ kind: 'structure', resource: 'device_field', listId, requested: 'abmessung' }] } } })).data.error.code, 'STRUCTURE_EXISTS');
      assert.equal((await request(jobRoute(), { method: 'PATCH', body: { questions: [structural] } })).status, 400);
      assert.equal((await request(route() + '/device-lists/' + listId)).data.data.fields.some(field => field.name === 'Montageort'), false);
    });
    await t.test('Expliziter Kundenumfang erzeugt Kapitelaufgabe; ein Vorschlag benötigt weiterhin manuelle GUI-Prüfung', async () => {
      await call('edoku_start_workflow', { projectId, etag: await revision(), input: { jobId, documentScope: 'documentation', evidence: { sourceLabel: 'Testchat', sourceQuote: 'Eine Anlagenbeschreibung ausdrücklich für die Kundendokumentation vorbereiten.' } } });
      let p = await plan(); assert.ok(p.agentActions.items.some(task => task.code === 'PREPARE_CHAPTER' && task.target.documentId === 'description'));
      const document = await call('edoku_prepare_project_document', { projectId, jobId, etag: await revision(), requestId: 'agent_workflow_chapter', input: { title: 'Künstliche Anlagenbeschreibung', sourceLabel: 'Synthetische Materialliste und Chat', reason: 'Test der Kapitelvorbereitung und verpflichtenden Einzelprüfung', content: { scope: 'documentation', documentId: 'description', sections: [{ heading: 'Bestätigter Umfang', text: 'Nur künstliche Testdaten. Keine Prüfung, Abnahme oder Unterschrift bestätigt.' }] } } });
      p = await plan();
      assert.ok(!p.agentActions.items.some(task => task.code === 'PREPARE_CHAPTER'));
      assert.ok(p.userActions.items.some(task => task.code === 'REVIEW_FILE' && task.target.proposalId === document.id));
      assert.equal(p.readiness.canGenerate, false); assert.equal(p.readiness.technicalExportComplete, false);
      assert.equal((await request(route() + '/attachments')).data.data.total, 0);
      assert.equal((await request(jobRoute() + '/documents/' + document.id + '/approve', { method: 'POST', body: {} })).status, 404);
    });
    await t.test('Neustart erhält Ableitungen und Quellen; Zugriffsrechte schützen Plan und Recherche', async () => {
      const checkpoint = (await plan()).checkpoint;
      await f.restart();
      assert.equal((await plan()).checkpoint, checkpoint);
      const reader = f.makeToken('alice', { scopes: ['projects:read', 'devices:read', 'documents:read', 'assistant:read'] });
      assert.equal((await f.request(route() + '/next-action?jobId=' + jobId, { token: reader.token })).status, 200);
      assert.equal((await f.request(route() + '/research', { token: reader.token, method: 'POST', body: research })).status, 403);
      const other = f.makeToken('bob', { scopes });
      assert.equal((await f.request(route() + '/next-action?jobId=' + jobId, { token: other.token })).status, 404);
      const project = (await request('/projects/same')).data.data.projekt;
      assert.deepEqual(project.custom, { keep: true });
    });
  } finally { await client.close(); await f.cleanup(); }
});
