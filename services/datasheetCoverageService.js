const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const { createDocumentAssistantService } = require('./documentAssistantService');
const { createIntegrationService } = require('./integrationService');
const { resolveAttachmentFile } = require('./attachmentService');
const { referencesForDocument, referenceKey, isTypeReference } = require('./deviceDocumentService');
const store = require('./projectDataStoreService');
const { readJson, writeJson } = require('./jsonService');
const { parse, fault } = require('../src/api/validation');
const { searchInput } = require('../src/api/datasheetSchemas');
const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity = row => [normalize(row.hersteller), normalize(row.typ), normalize(row.abmessung), normalize(row.farbe)];
const variant = row => [row.abmessung, row.farbe].filter(Boolean).join(' · ');
const sameProduct = (reference, row) => normalize(reference.manufacturer) === normalize(row.hersteller) && normalize(reference.model) === normalize(row.typ)
  && (reference.variant === undefined || normalize(reference.variant) === normalize(variant(row)));

function createDatasheetCoverageService(root) {
  const assistant = createDocumentAssistantService(root);
  function excluded(row, project) {
    const text = [row.typ, row.beschreibung].filter(Boolean).join(' ');
    if (!text.trim() && !normalize(row.hersteller)) return 'empty';
    if (require('./documentationMaterialPolicy').historicalSample(row)) return 'historical_example';
    if (isTypeReference(row)) return 'type_reference';
    const group=require('./documentationMaterialPolicy').excluded(row,project);
    if(group)return group==='manual_consumable'||require('./documentationMaterialPolicy').explicit(project)?group:'consumable';

    return null;
  }
  async function inspect(userId, projectId, { data, jobId } = {}) {
    return store.withProjectDataTransaction(async () => {
      assistant.project(userId, projectId);
      if (jobId && assistant.get(userId, jobId).projectId !== projectId) throw fault('Auftrag wurde nicht gefunden.', 404, 'NOT_FOUND');
      data ||= await loadProjectWorkspace(root, userId, projectId);
      const jobs = assistant.list(userId, projectId).map(job => assistant.get(userId, job.id));
      const groups = new Map(), exclusions = [], rows = new Map();
      const scope = new Set(data.leistungsbereiche.aktiv);
      for (const list of data.geraetelisten) for (const [index, row] of list.positionen.entries()) {
        const position = Number(row.pos || index + 1), key = referenceKey({ listId: list.id, position });
        if (rows.has(key) && list.aktiv && scope.has(list.leistungsbereich)) throw fault('Geräteposition ist nicht eindeutig.', 409, 'AMBIGUOUS_DEVICE_POSITION');
        rows.set(key, row);
        const reason = !list.aktiv || !scope.has(list.leistungsbereich) ? 'inactive' : excluded(row, data.projekt);
        if (reason) { exclusions.push({ listId: list.id, position, reason }); continue; }
        if (!Number.isSafeInteger(position) || position < 1) throw fault('Geräteposition ist nicht eindeutig.', 409, 'INVALID_DEVICE_POSITION');
        const product = identity(row);
        const id = 'article_' + hash(product[0] && product[1] ? product : [...product, list.id, position]).slice(0, 24);
        if (!groups.has(id)) groups.set(id, { id, manufacturer: String(row.hersteller || ''), model: String(row.typ || ''), variant: [row.abmessung, row.farbe].filter(Boolean).join(' · '), description: String(row.beschreibung || ''), references: [], rows: [] });
        const group = groups.get(id);
        group.references.push({ listId: list.id, position, manufacturer: String(row.hersteller || ''), model: String(row.typ || ''), variant: variant(row) });
        group.rows.push(row);
      }
      const fileCache = new Map();
      const validAttachment = attachment => {
        if (!attachment || attachment.category !== 'Datenblätter' || attachment.mimeType !== 'application/pdf' || attachment.export === false) return Promise.resolve(false);
        if (!fileCache.has(attachment.id)) fileCache.set(attachment.id, (async () => {
          try {
            const file = await resolveAttachmentFile(root, data.files, attachment.relativePath);
            const stat = await fs.stat(file);
            if (stat.size < 5 || stat.size > 15 * 1024 * 1024 || (attachment.size && stat.size !== attachment.size)) return false;
            const bytes = await fs.readFile(file);
            if (bytes.subarray(0, 5).toString() !== '%PDF-') return false;
            const expected = attachment.assistantProvenance?.sha256;
            return !expected || crypto.createHash('sha256').update(bytes).digest('hex') === expected;
          } catch { return false; }
        })());
        return fileCache.get(attachment.id);
      };
      const proposals = jobs.flatMap(job => job.documents.filter(doc => ['pending', 'rejected', 'withdrawn'].includes(doc.state) && doc.category === 'Datenblätter').map(doc => ({ ...doc, jobId: job.id, references: referencesForDocument(doc, job.requirements) })));
      const pendingValid = new Map();
      const checkPending = proposal => {
        if (!pendingValid.has(proposal.id)) pendingValid.set(proposal.id, assistant.content(userId, proposal.jobId, proposal.id).then(() => true, () => false));
        return pendingValid.get(proposal.id);
      };
      const publicDoc = (doc, jobId = null) => ({ id: doc.id, title: doc.title, jobId: jobId || doc.assistantProvenance?.jobId || null,
        url: jobId ? `/assistent/auftraege/${encodeURIComponent(jobId)}/dateien/${encodeURIComponent(doc.id)}` : doc.assistantProvenance ? `/assistent/auftraege/${encodeURIComponent(doc.assistantProvenance.jobId)}/dateien/${encodeURIComponent(doc.assistantProvenance.proposalId)}` : null });
      const records = Array.isArray(data.projekt.datenblattRecherche) ? data.projekt.datenblattRecherche : [];
      const items = [];
      for (const group of groups.values()) {
        const isMatchingReference = reference => {
          const row = rows.get(referenceKey(reference));
          return row && sameProduct(reference, row) && hash(identity(row)) === hash(identity(group.rows[0]));
        };
        const reusable = [];
        for (const attachment of data.anhaenge) {
          const knownReferences = attachment.deviceReferences || [];
          if (!knownReferences.some(isMatchingReference) || !await validAttachment(attachment)) continue;
          reusable.push(attachment);
        }
        const linked = [], remaining = [], documents = new Map(), pendingRefs = new Set(), rejected = new Map(), withdrawn = new Map();
        let stalePending = false;
        for (const [index, reference] of group.references.entries()) {
          const row = group.rows[index], attachment = data.anhaenge.find(doc => doc.id === row.datenblattId);
          const confirmed = attachment?.deviceReferences?.some(ref => referenceKey(ref) === referenceKey(reference) && sameProduct(ref, row));
          if (confirmed && await validAttachment(attachment)) { linked.push(reference); documents.set(attachment.id, publicDoc(attachment)); }
          else remaining.push(reference);
        }
        for (const proposal of proposals) {
          if (proposal.state === 'pending' && proposal.references.some(ref => group.references.some(target => referenceKey(target) === referenceKey(ref)) && !sameProduct(ref, group.rows[group.references.findIndex(target => referenceKey(target) === referenceKey(ref))]))) {
            stalePending = true;
            documents.set(proposal.id, publicDoc(proposal, proposal.jobId));
          }
          const matching = proposal.references.filter(reference => {
            const index = group.references.findIndex(target => referenceKey(target) === referenceKey(reference));
            return index >= 0 && sameProduct(reference, group.rows[index]);
          });
          if (!matching.length) continue;
          if (proposal.state === 'rejected') { rejected.set(proposal.id, publicDoc(proposal, proposal.jobId)); continue; }
          if (proposal.state === 'withdrawn') { withdrawn.set(proposal.id, { ...publicDoc(proposal, proposal.jobId), reason: proposal.withdrawal.reason }); continue; }
          if (!await checkPending(proposal)) continue;
          documents.set(proposal.id, publicDoc(proposal, proposal.jobId));
          matching.forEach(reference => pendingRefs.add(referenceKey(reference)));
        }
        const uncoveredReferences = remaining.filter(ref => !pendingRefs.has(referenceKey(ref)));
        const record = records.findLast(value => value.articleId === group.id);
        const reopened = record && require('./productDocumentVerificationService').retryAfterPolicyChange(record,group);
        const search = record ? { outcome: reopened ? 'retry' : record.outcome, reason: record.reason, sources: record.sources, recordedAt: record.recordedAt,...(record.blockerCode?{blockerCode:record.blockerCode}:{}) } : null;
        const status = !normalize(group.manufacturer) || !normalize(group.model) ? 'needs_identity'
          : !remaining.length ? 'approved'
          : !uncoveredReferences.length ? 'pending'
          : stalePending || remaining.some(ref => group.rows[group.references.indexOf(ref)].datenblattId) ? (search?.outcome === 'blocked' ? 'blocked' : 'assignment_conflict')
          : reusable.length ? 'ready_to_link'
          : search?.outcome === 'needs_identity' ? 'needs_identity'
          : search?.outcome === 'blocked' ? 'blocked'
          : search?.outcome === 'not_found' ? 'not_found'
          : rejected.size ? 'rejected' : 'research';
        const blocker=require('./workflowBlockerService').classify(search);
        items.push({ ...(blocker&&['blocked','not_found'].includes(status)?{blocker}:{}), id: group.id, manufacturer: group.manufacturer, model: group.model, variant: group.variant, description: group.description, status,
          references: group.references, uncoveredReferences, linkedPositions: linked.length, proposedPositions: remaining.length - uncoveredReferences.length,
          documents: [...documents.values()], reusable: reusable.map(doc => publicDoc(doc)), rejected: [...rejected.values()], ...(withdrawn.size ? { withdrawn: [...withdrawn.values()] } : {}), search });
      }
      items.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer, 'de') || a.model.localeCompare(b.model, 'de', { numeric: true }) || a.id.localeCompare(b.id));
      const count = state => items.filter(item => item.status === state).length;
      const summary = { articles: items.length, positions: items.reduce((sum, item) => sum + item.references.length, 0), excludedPositions: exclusions.length,
        approved: count('approved'), pending: count('pending'), research: count('research'), readyToLink: count('ready_to_link'), needsIdentity: count('needs_identity'),
        conflicts: count('assignment_conflict'), rejected: count('rejected'), notFound: count('not_found'), unsupported: count('unsupported'), blocked: count('blocked'), complete: items.every(item => item.status === 'approved') };
      return { projectId, revision: store.projectDataRevision(root, userId, projectId), inventorySource: 'active_device_lists', summary, items, exclusions };
    });
  }
  async function recordSearch(auth, projectId, etag, input) {
    const value = parse(searchInput, input);
    return createIntegrationService(root).mutate(auth, projectId, etag, async files => {
      const current = await inspect(auth.user.id, projectId);
      if (!current.items.some(item => item.id === value.articleId)) throw fault('Artikel hat sich geändert oder gehört nicht mehr zum aktiven Bestand.', 409, 'ARTICLE_CHANGED');
      const project = await readJson(files.projekt, {});
      if (project.datenblattRecherche && !Array.isArray(project.datenblattRecherche)) throw fault('Recherchehistorie ist ungültig.', 409, 'INVALID_RESEARCH_HISTORY');
      const records = [...(project.datenblattRecherche || [])];
      const last = records.findLast(item => item.articleId === value.articleId);
      if (!last || last.inputHash !== hash(value) || (value.outcome==='blocked'&&last.verificationPolicy!==require('./productDocumentVerificationService').POLICY)) {
        if (records.length >= 1000) throw fault('Recherchehistorie ist voll.', 409, 'RESEARCH_LIMIT');
        records.push({ ...value, ...(value.outcome==='blocked'?{verificationPolicy:require('./productDocumentVerificationService').POLICY}:{}), inputHash: hash(value), recordedAt: new Date().toISOString(), recordedBy: auth.user.id });
        project.datenblattRecherche = records;
        await writeJson(files.projekt, project);
      }
      return { articleId: value.articleId, outcome: value.outcome };
    });
  }
  return { inspect, recordSearch };
}
module.exports = { createDatasheetCoverageService };
