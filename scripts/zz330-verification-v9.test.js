const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { matchDocument } = require('../services/productDocumentMatchingService');
const { POLICY, retryAfterPolicyChange } = require('../services/productDocumentVerificationService');
const { fixture, mcpClient } = require('./helpers/integrationFixture');
const { scopes } = require('../src/api/schemas');
const { dataFilesForProject } = require('../services/projectArchiveService');
const { writeJson, readJson } = require('../services/jsonService');
const area = 'Brandschutzabschottungen';
const target = { listId: 'devices', position: 1, manufacturer: 'ZAPP-ZIMMERMANN', model: 'ZZ330', variant: '', pageArticleConfirmed: true };
const text = '1 / 6 Technische Änderungen und Irrtümer vorbehalten\n2023-09-08\nZZ ®   330 Brandschutzschaum\nTechnisches Datenblatt\nTechnisches Datenblatt\nHandelsname:   ZZ ®   330 Brandschutzschaum\nBeschreibung: Testprodukt\nFarbe: Rotbraun';
const check = (pages = [{ page: 1, text }, { page: 2, text: 'ZAPP-ZIMMERMANN GmbH' }], extra = {}) => matchDocument({ pages, totalPages: pages.length, targets: [target], sourceLinked: true, manual: false, ...extra });

test('ZZ330: Handelsname, passende Überschrift, Hersteller und verknüpfte Produktseite belegen das Datenblatt', () => {
  const result = check(); assert.equal(result.state, 'matched'); assert.equal(result.targets[0].via, 'pdf_trade_name'); assert.equal(result.targets[0].page, 1);
  for (const model of ['ZZ330', 'ZZ 330', 'ZZ® 330']) assert.equal(check(undefined, { targets: [{ ...target, model }] }).state, 'matched');
  assert.equal(check(undefined, { targets: [{ ...target, manufacturer: 'ZAPP-ZIMMERMANN GmbH' }] }).state, 'matched');
});

test('ZZ330: ähnliche Nummern, andere Namen, Beifang und widersprüchliche Handelsnamen werden nicht übernommen', () => {
  for (const bad of [text.replaceAll('330', '3300'), text.replaceAll('330', '333'), text.replaceAll('330 Brandschutzschaum', '330-X Brandschutzschaum'), text.replaceAll('Brandschutzschaum', 'Brandschutzstein'), text.replace('ZZ ®   330 Brandschutzschaum', 'ZZ ® 333 Brandschutzschaum')]) assert.equal(check([{ page: 1, text: bad }, { page: 2, text: 'ZAPP-ZIMMERMANN GmbH' }]).state, 'unclear');
  const conflicting = [{ page: 1, text }, { page: 2, text: 'ZAPP-ZIMMERMANN GmbH\nHandelsname: ZZ333 Brandschutzmasse' }];
  assert.equal(check(conflicting).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, model: 'ZZ3300' }] }).state, 'unclear');
  assert.equal(check([{ page: 1, text: text.replace('Handelsname:', 'Hinweis auf Handelsname:') }, { page: 2, text: 'ZAPP-ZIMMERMANN GmbH' }]).state, 'unclear');
});

test('ZZ330: fehlende Quellen-/Herstellerbindung und ein Sicherheitsdatenblatt bleiben gesperrt', () => {
  assert.equal(check(undefined, { sourceLinked: false }).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, pageArticleConfirmed: false }] }).state, 'unclear');
  assert.equal(check([{ page: 1, text }]).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, manufacturer: 'Anderer Hersteller' }] }).state, 'unclear');
  assert.equal(check([{ page: 1, text: text.replaceAll('Technisches Datenblatt', 'Sicherheitsdatenblatt') }, { page: 2, text: 'ZAPP-ZIMMERMANN GmbH' }]).state, 'unclear');
});

test('ZZ330-Handelsnamensregel bestätigt weder unbekannte Varianten noch ein bestimmtes Schottsystem', () => {
  assert.equal(check(undefined, { targets: [{ ...target, variant: 'Rotbraun' }] }).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, variant: 'schwarz' }] }).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, systemModel: 'ZZ M21-S90' }] }).state, 'unclear');
  assert.equal(check(undefined, { targets: [{ ...target, documentModel: 'ZZ330' }] }).state, 'unclear');
});

test('V9 öffnet nur den behobenen ZZ330-V8-Befund; neue und fremde Sperren bleiben bestehen', () => {
  const record = { outcome: 'blocked', verificationPolicy: 'manufacturer_pdf_article_variant_v8', blockerCode: 'PRODUCT_DOCUMENT_UNCONFIRMED', reason: 'PDF-Handelsname wurde nicht erkannt.' };
  assert.equal(retryAfterPolicyChange(record, target), true);
  for (const change of [{ verificationPolicy: POLICY }, { outcome: 'not_found' }, { reason: 'SOURCE_HTTP_ERROR' }, { reason: 'pdf_not_linked_by_manufacturer' }, { reason: 'variant_not_confirmed' }, { blockerCode: '', reason: 'Unbekannte Prüfsperre' }]) assert.equal(retryAfterPolicyChange({ ...record, ...change }, target), false);
  for (const change of [{ model: 'ZZ3300' }, { model: 'ZZ217' }, { manufacturer: 'OBO Bettermann' }, { variant: 'Rotbraun' }]) assert.equal(retryAfterPolicyChange(record, { ...target, ...change }), false);
});

test('Echte API/MCP: ZZ330-Vorschlag nach V9 erneut prüfen, nur pending, Systempflichten und alte Freigabe erhalten', async () => {
  const f = await fixture({ productChecks: true, setup: async ({ root }) => {
    const files = dataFilesForProject(root, 'alice', 'same');
    await writeJson(files.leistungsbereiche, { aktiv: [area], optionen: [area] });
    await writeJson(files.geraetelisten, [{ id: 'devices', aktiv: true, leistungsbereich: area, positionen: [{ pos: 1, hersteller: target.manufacturer, typ: target.model }, { pos: 2, hersteller: target.manufacturer, typ: 'ZZ3300' }] }]);
  } });
  const token = f.makeToken('alice', { scopes }).token, client = mcpClient(f.base, token, true);
  const request = (url, options = {}) => f.request(url, { token, ...options });
  try {
    const pageUrl = 'https://z-z.de/test/zz330', pdfUrl = 'https://z-z.de/test/zz330.pdf';
    const pdf = await PDFDocument.create(); pdf.addPage().drawText(text, { x: 30, y: 780, size: 11, lineHeight: 16 }); pdf.addPage().drawText('ZAPP-ZIMMERMANN GmbH');
    await fs.writeFile(path.join(f.root, 'zz330.pdf'), await pdf.save());
    await fs.writeFile(path.join(f.root, 'zz330.html'), `<h1>ZZ® 330 Brandschutzschaum</h1><a href="${pdfUrl}">Technisches Datenblatt</a>`);
    await fs.writeFile(path.join(f.root, 'product-source-fixture.json'), JSON.stringify({ [pageUrl]: 'zz330.html', [pdfUrl]: 'zz330.pdf' }));
    const files = dataFilesForProject(f.root, 'alice', 'same'), service = require('../services/documentAssistantService').createDocumentAssistantService(f.root, { db: f.db, verificationService: f.productVerification });
    const rules = require('../services/firestopDocumentationService').firestopRequirements({ leistungsbereiche: { aktiv: [area] }, brandschutz: [] }).map(row => row.definition);
    const job = service.create('alice', 'same', { instruction: 'Künstlicher ZZ330-Datenblatttest mit offenen Systempflichten.', requirements: rules });
    const oldPdf = await PDFDocument.create(); oldPdf.addPage().drawText('Synthetic retained original');
    const original = await service.propose('alice', job.id, { title: 'Bestehender Testbeleg', category: 'Allgemein', sourceLabel: 'Test', reason: 'Bestandsschutz' }, { buffer: Buffer.from(await oldPdf.save()), originalName: 'retained.pdf' });
    await service.content('alice', job.id, original.id); service.viewed('alice', job.id, original.id, original.sha256);
    await service.approve('alice', job.id, original.id, { reviewed: 'on', sha256: original.sha256, revision: (await request('/projects/same')).etag.slice(1, -1), metadata: { title: original.title, category: original.category } });
    const oldRow = f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(original.id), oldViews = f.db.prepare('SELECT * FROM document_review_views').all(), lists = await readJson(files.geraetelisten);
    const coverage = (await request('/projects/same/datasheet-coverage')).data.data;
    const records = coverage.items.map(item => ({ articleId: item.id, outcome: 'blocked', verificationPolicy: 'manufacturer_pdf_article_variant_v8', blockerCode: 'PRODUCT_DOCUMENT_UNCONFIRMED', reason: 'Handelsname nicht erkannt', sources: [pageUrl, pdfUrl], recordedAt: new Date().toISOString(), evidence: { sourceLabel: 'Test', sourceQuote: 'PRODUCT_DOCUMENT_UNCONFIRMED' } }));
    const project = await readJson(files.projekt); await writeJson(files.projekt, { ...project, datenblattRecherche: records });
    const reopened = (await request('/projects/same/datasheet-coverage')).data.data.items;
    assert.equal(reopened.find(row => row.model === 'ZZ330').status, 'research'); assert.equal(reopened.find(row => row.model === 'ZZ3300').status, 'blocked');
    await client.initialize();
    const response = (await client.rpc('tools/call', { name: 'edoku_propose_document', arguments: { projectId: 'same', jobId: job.id, metadata: { title: 'ZZ330 Testdatenblatt', category: 'Datenblätter', manufacturerPageUrl: pageUrl, sourceUrl: pdfUrl, sourceLabel: 'Künstliche Originalquelle', reason: 'Produktdaten unabhängig von Systemzuordnung prüfen', deviceReferences: [{ listId: 'devices', position: 1, manufacturer: target.manufacturer, model: target.model }] } } })).result;
    assert.ok(!response.isError, JSON.stringify(response)); const proposed = response.structuredContent.data;
    assert.equal(proposed.state, 'pending'); assert.equal(proposed.productVerification.state, 'matched'); assert.equal(proposed.productVerification.policy, POLICY);
    const saved = service.get('alice', job.id).documents.find(row => row.id === proposed.id); assert.equal(saved.state, 'pending'); assert.equal(saved.attachmentId, null);
    assert.equal((await request('/projects/same/documentation-status')).data.data.requirements.filter(row => row.firestop && row.fulfilled).length, 0);
    assert.deepEqual(f.db.prepare('SELECT * FROM document_proposals WHERE id=?').get(original.id), oldRow); assert.deepEqual(f.db.prepare('SELECT * FROM document_review_views').all(), oldViews); assert.deepEqual(await readJson(files.geraetelisten), lists);
    const tools = (await client.rpc('tools/list', {})).result.tools; assert.equal(tools.length, 58); assert.ok(!tools.some(tool => /approve|freigeben/i.test(tool.name)));
    await assert.rejects(service.approve('alice', job.id, proposed.id, { reviewed: 'on', sha256: saved.sha256, revision: (await request('/projects/same')).etag.slice(1, -1), metadata: { title: saved.title, category: saved.category } }), { apiCode: 'REVIEW_REQUIRED' });
  } finally { await client.close(); await f.cleanup(); }
});
