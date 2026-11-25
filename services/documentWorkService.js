const crypto = require('node:crypto');
const { createDocumentAssistantService } = require('./documentAssistantService');
const { createIntegrationService } = require('./integrationService');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const { readJson, writeJson } = require('./jsonService');
const store = require('./projectDataStoreService');
const { parse, fault } = require('../src/api/validation');
const { input } = require('../src/api/documentWorkSchemas');
const { requirementDevices } = require('./deviceDocumentService');
const knowledge = require('./knowledgeService');
const { statusPage, compactWorkRow } = require('./statusQueryService');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = target => target.kind === 'requirement' ? `requirement:${target.requirementId}` : `question:${target.questionId}`;
function createDocumentWorkService(root) {
  const assistant = createDocumentAssistantService(root), integration = createIntegrationService(root);
  function jobFor(userId, projectId, jobId) {
    assistant.project(userId, projectId);
    const job = assistant.get(userId, jobId);
    if (job.projectId !== projectId) throw fault('Auftrag wurde nicht gefunden.', 404, 'NOT_FOUND');
    return job;
  }
  function fingerprint(data, job, target) {
    if (target.kind === 'question') {
      const question = job.questions.find(q => q.id === target.questionId && !q.obsolete);
      if (!question) throw fault('Aktuelle Rückfrage wurde nicht gefunden.', 409, 'WORK_TARGET_CHANGED');
      return hash([question.id, question.prompt, question.targets || [], question.answer || '']);
    }
    const requirement = job.requirements.find(r => r.id === target.requirementId);
    if (!requirement) throw fault('Anforderung wurde nicht gefunden.', 409, 'WORK_TARGET_CHANGED');
    const devices = requirementDevices(requirement).map(ref => {
      const lists = data.geraetelisten.filter(l => l.id === ref.listId && l.aktiv !== false && data.leistungsbereiche.aktiv.includes(l.leistungsbereich));
      const rows = lists.length === 1 ? lists[0].positionen.filter((r, i) => Number(r.pos || i + 1) === ref.position) : [];
      return rows.length === 1 ? [ref.listId, ref.position, ...['hersteller', 'typ', 'abmessung', 'farbe'].map(field => rows[0][field] || '')] : ['changed', ref.listId, ref.position];
    });
    const answers = job.questions.filter(q => q.targets?.some(t => t.kind === 'requirement' && t.requirementId === requirement.id)).map(q => [q.id, q.answer || '', q.obsolete || null]);
    const refs = new Set([...(knowledge.defaultDependencies(data, job).get(requirement.id) || []), ...(requirement.dependsOn || [])].map(knowledge.factId));
    const facts = knowledge.records(data).filter(row => row.jobId === job.id && (refs.has(row.factId) || (row.subject.kind === 'requirement' && row.subject.requirementId === requirement.id))).map(row => row.id);
    return hash([requirement, devices, answers, ...(facts.length ? [facts] : [])]);
  }
  function records(data) {
    const value = data.projekt.assistantWorkHistory || [];
    if (!Array.isArray(value)) throw fault('Bearbeitungshistorie ist ungültig.', 409, 'INVALID_WORK_HISTORY');
    return value;
  }
  function current(data, job, target = null) {
    const latest = new Map();
    for (const record of records(data)) if (record.jobId === job.id && (!target || key(record.target) === key(target))) latest.set(key(record.target), record);
    return [...latest.values()].filter(record => {
      try { return record.fingerprint === fingerprint(data, job, record.target); } catch { return false; }
    });
  }
  async function inspect(userId, projectId, jobId, { data, job, history = 'false', view = 'full', requirementId, questionId, state, limit = 20, offset = 0 } = {}) {
    return store.withProjectDataTransaction(async () => {
      job = jobFor(userId, projectId, jobId);
      if (requirementId && questionId) throw fault('Nur ein Ziel angeben.', 400, 'VALIDATION_ERROR');
      if ((requirementId && !job.requirements.some(row => row.id === requirementId)) || (questionId && !job.questions.some(row => row.id === questionId)))
        throw fault('Ziel wurde nicht gefunden.', 404, 'NOT_FOUND');
      data ||= await loadProjectWorkspace(root, userId, projectId);
      const target = requirementId ? { kind: 'requirement', requirementId } : questionId ? { kind: 'question', questionId } : null;
      let items = history === 'true' ? records(data).filter(r => r.jobId === job.id && (!target || key(r.target) === key(target))) : current(data, job, target);
      if (state) items = items.filter(row => row.state === state);
      const base = { projectId, jobId, jobVersion: job.version };
      if (view === 'full') return { ...base, items: items.slice(offset, offset + limit), total: items.length, limit, offset };
      return statusPage({ ...base, view, history, target, ...(state ? { state } : {}) }, items, { limit, offset, view }, compactWorkRow);
    });
  }
  async function record(auth, projectId, jobId, etag, raw, { fingerprintJob } = {}) {
    const value = parse(input, raw);
    return integration.mutate(auth, projectId, etag, async files => {
      const job = jobFor(auth.user.id, projectId, jobId);
      assistant.assertVersion(auth.user.id, jobId, value.jobVersion);
      if (job.status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
      const data = await loadProjectWorkspace(root, auth.user.id, projectId), print = fingerprint(data, fingerprintJob || job, value.target);
      if (value.proposalId && !job.documents.some(d => d.id === value.proposalId && d.state === 'rejected' && d.requirementIds.includes(value.target.requirementId))) throw fault('Ablehnung gehört nicht zu dieser Anforderung.', 409, 'REJECTION_TARGET_MISMATCH');
      const old = current(data, job).find(r => key(r.target) === key(value.target));
      const payload = { ...value }; delete payload.jobVersion;
      const inputHash = hash([payload, print]);
      if (old?.inputHash === inputHash) return old;
      const previous = records(data);
      if (previous.length >= 1000) throw fault('Bearbeitungshistorie ist voll.', 409, 'WORK_HISTORY_LIMIT');
      const result = { ...payload, jobId, fingerprint: print, inputHash, recordedAt: new Date().toISOString(), recordedBy: auth.user.id };
      const project = await readJson(files.projekt, {});
      project.assistantWorkHistory = [...previous, result];
      store.onProjectDataCommit(() => assistant.assertVersion(auth.user.id, jobId, value.jobVersion));
      await writeJson(files.projekt, project);
      return result;
    });
  }
  return { inspect, record, current };
}
module.exports = { createDocumentWorkService };
