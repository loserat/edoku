const {connection}=require('./dbService');
const {projectResetGeneration}=require('./idempotencyService');
const crypto = require('node:crypto');
const { createIntegrationService } = require('./integrationService');
const { createDocumentAssistantService } = require('./documentAssistantService');
const { createDocumentationReadinessService } = require('./documentationReadinessService');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const { deviceListFieldsForLeistungsbereich } = require('./geraetelistenService');
const { writeJson, readJson } = require('./jsonService');
const store = require('./projectDataStoreService');
const { parse, fault } = require('../src/api/validation');
const { startInput, askInput, researchInput, researchFields } = require('../src/api/workflowSchemas');
const { internalProposal } = require('./requirementScopeService');
const { createDatasheetCoverageService } = require('./datasheetCoverageService');
const { requirementDevices } = require('./deviceDocumentService');
const { createDocumentWorkService } = require('./documentWorkService');
const firestopDocs = require('./firestopDocumentationService');
const knowledgeService = require('./knowledgeService');

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const present = value => typeof value === 'string' && Boolean(value.trim());
const same = (a, b) => String(a || '').trim().toLocaleLowerCase('de') === String(b || '').trim().toLocaleLowerCase('de');
const stages = [
  ['project', 'Projekt klären', 'Bestätigte Stammdaten und passende Leistungsbereiche sind erfasst.'],
  ['materials', 'Material zuordnen', 'Verwendete Geräte stehen in den passenden aktiven edoku-Listen; Verbrauchsmaterial ist ausgesondert.'],
  ['research', 'Produktdaten ergänzen', 'Pflichtfelder sind für die bestätigte Variante aus nachvollziehbaren Quellen ergänzt.'],
  ['chapters', 'Kapitel vorbereiten', 'Gewünschte Texte sind den vorhandenen edoku-Kapiteln zugeordnet und zur Sichtung vorbereitet.'],
  ['evidence', 'Unterlagen beschaffen', 'Passende Originalunterlagen und tatsächliche Projektnachweise liegen vor.'],
  ['review', 'Dateien einzeln prüfen', 'Der Benutzer hat jede aktuelle Datei gesichtet und einzeln freigegeben oder abgelehnt.'],
  ['export', 'Ausgabe prüfen', 'Ein aktueller vollständiger technischer PDF-/ZIP-Export liegt vor. Fachliche Abnahme bleibt gesondert.']
];
const targetKey = target => JSON.stringify(target);
const pendingQuestion = question => !question.obsolete && !present(question.answer);
function positionFor(data, target) {
  const lists = data.geraetelisten.filter(list => list.id === target.listId && list.aktiv !== false && data.leistungsbereiche.aktiv.includes(list.leistungsbereich));
  const positions = lists.length === 1 ? lists[0].positionen.filter((position, index) => Number(position.pos || index + 1) === target.position) : [];
  if (positions.length !== 1) throw fault('Aktive Geräteposition wurde nicht eindeutig gefunden.', 409, 'DEVICE_TARGET_CHANGED');
  return { list: lists[0], position: positions[0] };
}

function createDocumentationWorkflowService(root) {
  const integration = createIntegrationService(root);
  const assistant = createDocumentAssistantService(root);
  const readinessService = createDocumentationReadinessService(root);
  const datasheets = createDatasheetCoverageService(root);
  const documentWork = createDocumentWorkService(root);
  function matchingJob(userId, projectId, jobId) {
    const job = assistant.get(userId, jobId);
    if (job.projectId !== projectId) throw fault('Auftrag wurde nicht gefunden.', 404, 'NOT_FOUND');
    return job;
  }
  async function start(auth, projectId, ifMatch, input) {
    const value = parse(startInput, input);
    return integration.mutate(auth, projectId, ifMatch, async files => {
      const job = matchingJob(auth.user.id, projectId, value.jobId);
      if (job.status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
      const project = await readJson(files.projekt, {});
      if (project.assistantWorkflow && project.assistantWorkflow.jobId !== value.jobId && matchingJob(auth.user.id, projectId, project.assistantWorkflow.jobId).status !== 'closed') throw fault('Für dieses Projekt ist bereits ein anderer Ablauf aktiv.', 409, 'WORKFLOW_CONFLICT');
      const previous = project.assistantWorkflow?.jobId === value.jobId ? project.assistantWorkflow : {};
      if ((previous.requirementScopes && !Array.isArray(previous.requirementScopes)) || (previous.scopeHistory && !Array.isArray(previous.scopeHistory))) throw fault('Die gespeicherte Ablagezuordnung ist ungültig.', 409, 'INVALID_REQUIREMENT_SCOPE');
      const scopes = [...(previous.requirementScopes || [])], changes = [];
      if (value.requirementScopes) {
        assistant.assertVersion(auth.user.id, value.jobId, value.jobVersion);
        const firestopIds = new Set(firestopDocs.firestopRequirements(await loadProjectWorkspace(root, auth.user.id, projectId), job.requirements).map(rule => rule.requirementId).filter(Boolean));
        if (new Set(value.requirementScopes.map(item => item.id)).size !== value.requirementScopes.length) throw fault('Anforderung mehrfach angegeben.', 400, 'VALIDATION_ERROR');
        const attachments = await readJson(files.anhaenge, []);
        for (const selected of value.requirementScopes) {
          const requirement = job.requirements.find(item => item.id === selected.id);
          if (!requirement) throw fault('Unbekannte Anforderung.', 400, 'UNKNOWN_REQUIREMENT');
          if (selected.scope === 'internal' && (requirement.firestop || firestopIds.has(selected.id))) throw fault('Brandschutz-Pflichtunterlagen gehören zur Kundendokumentation.', 409, 'FIRESTOP_REQUIREMENT_PROTECTED');
          if (selected.scope === 'internal' && requirementDevices(requirement).length) throw fault('Gerätebezogene Herstelleroriginale müssen in der Kundendokumentation bleiben.', 409, 'DEVICE_REQUIREMENT_PROTECTED');
          if (selected.scope === 'internal' && job.documents.some(document => document.state === 'approved' && document.requirementIds.includes(selected.id) && attachments.some(attachment => attachment.id === document.attachmentId && attachment.export !== false))) throw fault('Eine bereits ausgegebene Datei muss zuerst bewusst intern umgeordnet werden. Bestehende Freigaben werden nicht still geändert.', 409, 'APPROVED_DOCUMENT_SCOPE_CONFLICT');
          const index = scopes.findIndex(item => item.id === selected.id), from = index < 0 ? 'documentation' : scopes[index].scope;
          if (from !== selected.scope) changes.push({ id: selected.id, from, to: selected.scope });
          if (index < 0) scopes.push(selected); else scopes[index] = selected;
        }
      }
      const history = [...(previous.scopeHistory || [])];
      if (changes.length) {
        if (history.length >= 200) throw fault('Die Ablagehistorie ist voll.', 409, 'SCOPE_HISTORY_LIMIT');
        history.push({ changes, evidence: value.evidence, jobVersion: value.jobVersion, recordedAt: new Date().toISOString(), recordedBy: auth.user.id });
      }
      if(value.materialExclusions)require('./documentationMaterialPolicy').save(project,value.materialExclusions,{actor:auth.user.id,source:'mcp_workflow',evidence:value.evidence});
      project.assistantWorkflow = { ...previous, jobId: value.jobId, documentScope: value.documentScope, excludeConsumables: value.excludeConsumables, evidence: value.evidence, requirementScopes: scopes, scopeHistory: history, version: 1, startedAt: previous.startedAt || new Date().toISOString() };
      if (value.jobVersion) assistant.assertVersion(auth.user.id, value.jobId, value.jobVersion);
      if (value.jobVersion) store.onProjectDataCommit(() => assistant.assertVersion(auth.user.id, value.jobId, value.jobVersion));
      await writeJson(files.projekt, project);
      return project.assistantWorkflow;
    });
  }
  function validateTarget(data, job, target) {
    if(target.kind==='material'){require('./materialImportService').validateTarget(data.projekt,target);return;}
    if(target.kind==='material_source'){if(target.importId&&!require('./materialImportService').entry(data.projekt,target.importId))throw fault('Materialquelle gehört nicht zum Projekt.',409,'MATERIAL_TARGET_INVALID');return;}
    if (target.kind === 'fact') {
      const fact = knowledgeService.buildKnowledge(data, job).facts.find(row => row.id === knowledgeService.factId(target));
      if (!fact || fact.revision !== target.revision || fact.state === 'invalid_target') throw fault('Faktenstand hat sich geändert. Nächsten Plan erneut lesen.', 409, 'FACT_STATE_CHANGED');
      return;
    }
    if (target.kind === 'project') return;
    if (target.kind === 'device') {
      const { list } = positionFor(data, target);
      if (!deviceListFieldsForLeistungsbereich(list.leistungsbereich).some(field => field.name === target.field)) throw fault('Feld gehört nicht zur Geräteposition.', 400, 'DEVICE_FIELD_MISMATCH');
    } else if (target.kind === 'requirement') {
      if (!job.requirements.some(item => item.id === target.requirementId)) throw fault('Unbekannte Unterlagenanforderung.', 400, 'UNKNOWN_REQUIREMENT');
    } else if (target.resource === 'device_field') {
      const list = data.geraetelisten.find(item => item.id === target.listId);
      if (!list) throw fault('Für eine Feldlücke muss die vorhandene Geräteliste angegeben werden.', 400, 'UNKNOWN_DEVICE_LIST');
      if (deviceListFieldsForLeistungsbereich(list.leistungsbereich).some(field => same(field.name, target.requested) || same(field.label, target.requested))) throw fault('Dieses Feld ist bereits vorhanden. Vorhandene Struktur verwenden.', 409, 'STRUCTURE_EXISTS');
    } else {
      const values = target.resource === 'device_list' ? data.geraetelisten.flatMap(list => [list.id, list.titel]) : target.resource === 'document_chapter' ? data.matrix.flatMap(entry => [entry.id, entry.titel]) : data.leistungsbereiche.optionen;
      if (values.some(value => same(value, target.requested))) throw fault('Dieses Ziel ist bereits vorhanden. Vorhandene Struktur verwenden.', 409, 'STRUCTURE_EXISTS');
    }
  }
  async function ask(auth, projectId, jobId, input) {
    const value = parse(askInput, input);
    return store.withProjectDataTransaction(async () => {
      integration.project(auth, projectId);
      assistant.assertVersion(auth.user.id, jobId, value.version);
      const job = matchingJob(auth.user.id, projectId, jobId);
      if (job.status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
      const data = await loadProjectWorkspace(root, auth.user.id, projectId);
      const incoming = value.questions || [value.question], additions = [], results = [];
      for (const question of incoming) {
        for (const target of question.targets) validateTarget(data, job, target);
        const keys = JSON.stringify(question.targets.map(targetKey).sort());
        const duplicate = [...job.questions.filter(q => !q.obsolete), ...additions].find(q => q.targets && JSON.stringify(q.targets.map(targetKey).sort()) === keys);
        results.push({ id: duplicate?.id || question.id, created: !duplicate });
        if (!duplicate) additions.push(question);
      }
      // A reread immediately before the synchronous SQL write protects changes made during workspace loading.
      assistant.assertVersion(auth.user.id, jobId, value.version);
      const updated = additions.length ? assistant.update(auth.user.id, jobId, { questions: additions }) : job;
      if (!value.questions) return { question: updated.questions.find(q => q.id === results[0].id), jobVersion: updated.version, created: results[0].created, channel: 'agent_chat' };
      return { questions: results.map(r => ({ question: updated.questions.find(q => q.id === r.id), created: r.created })), createdCount: additions.length, jobVersion: updated.version, channel: 'agent_chat' };
    });
  }
  async function recordResearch(auth, projectId, ifMatch, input) {
    const value = parse(researchInput, input);
    return integration.mutate(auth, projectId, ifMatch, async files => {
      const data = await loadProjectWorkspace(root, auth.user.id, projectId);
      // Mutate the original document: display normalization drops unknown historical fields.
      const lists = await readJson(files.geraetelisten, []);
      if (!Array.isArray(lists) || lists.some(list => !Array.isArray(list?.positionen))) throw fault('Älteres Geräteformat zuerst in der Oberfläche prüfen.', 409, 'LEGACY_DEVICE_FORMAT');
      const { list, position } = positionFor({ ...data, geraetelisten: lists }, value);
      if (!same(position.hersteller, value.manufacturer) || !same(position.typ, value.model)) throw fault('Recherche passt nicht mehr zu Hersteller und Typ der Geräteposition.', 409, 'DEVICE_REFERENCE_CHANGED');
      const allowed = deviceListFieldsForLeistungsbereich(list.leistungsbereich).map(field => field.name);
      if (Object.keys(value.values).some(field => !allowed.includes(field))) throw fault('Ein recherchiertes Feld gehört nicht zu dieser Geräteliste.', 400, 'DEVICE_FIELD_MISMATCH');
      for (const [field, text] of Object.entries(value.values)) if (present(position[field]) && !same(position[field], text)) throw fault('Vorhandene Angaben werden durch Recherche nicht überschrieben. Abweichung im Chat klären.', 409, 'RESEARCH_VALUE_CONFLICT');
      const project = await readJson(files.projekt, {});
      const records = project.produktRecherche || [];
      if (!Array.isArray(records)) throw fault('Recherchehistorie ist ungültig.', 409, 'INVALID_RESEARCH_HISTORY');
      const key = hash(value);
      if (!records.some(record => record.key === key)) {
        if (records.length >= 1000) throw fault('Recherchehistorie hat die maximale Größe erreicht.', 409, 'RESEARCH_LIMIT');
        records.push({ key, ...value, recordedAt: new Date().toISOString(), recordedBy: auth.user.id });
      }
      Object.assign(position, value.values);
      project.produktRecherche = records;
      await writeJson(files.projekt, project);
      await writeJson(files.geraetelisten, lists);
      return { listId: list.id, position: value.position, values: value.values, provenanceKey: key, sourceUrl: value.sourceUrl };
    });
  }
  async function inspect(userId, projectId, { jobId, limit = 8, offset = 0, includeDatasheets = false, view = 'full', sinceCheckpoint } = {}) {
    return store.withProjectDataTransaction(async () => {
      const data = await loadProjectWorkspace(root, userId, projectId);
      const selectedId = jobId || data.projekt.assistantWorkflow?.jobId;
      const candidates = selectedId ? [] : assistant.list(userId, projectId).filter(job => job.status !== 'closed');
      if (!selectedId && candidates.length > 1) throw fault('Mehrere offene Aufträge: jobId ausdrücklich auswählen.', 409, 'JOB_SELECTION_REQUIRED');
      const job = selectedId || candidates[0]?.id ? matchingJob(userId, projectId, selectedId || candidates[0].id) : null;
      const coverage = await datasheets.inspect(userId, projectId, { data });
      const status = await readinessService.inspect(userId, projectId, { assistantJobId: job?.id || null, data, datasheetCoverage: coverage });
      const policy = data.projekt.assistantWorkflow?.jobId === job?.id ? data.projekt.assistantWorkflow : null;
      const agent = [], user = [], seen = new Set(), rejectedInternal = [];
      let knowledgeSummary = null;
      const work = job ? documentWork.current(data, job).filter(record => record.state !== 'resume' && (record.target.kind !== 'requirement' || !status.requirements.some(r => r.jobId === job.id && r.id === record.target.requirementId && r.fulfilled))) : [];
      const held = task => task.code !== 'REVIEW_FILE' && work.some(record => {
        if (record.target.kind === 'requirement') return task.target?.kind === 'requirement' && task.target.requirementId === record.target.requirementId;
        if (task.questionId === record.target.questionId) return true;
        const question = job.questions.find(q => q.id === record.target.questionId);
        return task.target && question?.targets?.some(t => targetKey(t) === targetKey(task.target));
      });
      const add = (owner, stage, code, title, target = null, extra = {}) => {
        const id = 'task_' + hash([stage, code, target, extra.questionId || null]).slice(0, 20);
        if (!seen.has(id)) { seen.add(id); (owner === 'agent' ? agent : user).push({ id, owner, stage, code, title, target, ...extra }); }
      };
      const material = require('./materialImportService').tasks(data);
      if(job?.status!=='closed')for(const [owner,list] of [['agent',material.agent],['user',material.user]])for(const task of list){
        const {code,title,target,...extra}=task;
        const question=job?.questions.find(q=>!q.obsolete&&q.targets?.some(t=>targetKey(t)===targetKey(target)));
        if(question?.answer&&owner==='user')add('agent','materials','APPLY_MATERIAL_ANSWER',title,target,{...extra,answer:question.answer,questionId:question.id,tool:'edoku_record_material_import',instructions:'Gespeicherte Antwort gezielt zuordnen, über resolve belegt ergänzen und nur bei ausreichenden Angaben wiederaufnehmen. Kein ungeprüftes Kopieren in Gerätefelder.'});
        else if(!question||owner==='agent')add(owner,'materials',code,title,target,extra);
      }
      const questions = job?.questions.filter(question => !question.obsolete&&require('./materialImportService').questionRelevant(data,question)) || [];
      for (const question of questions.filter(pendingQuestion)) add('user', question.stage || 'project', 'ANSWER_IN_CHAT', question.prompt, null, { questionId: question.id, channel: 'agent_chat', context: question.context || 'Offene Projektangabe', required: question.required, targets: question.targets || [], tool: 'edoku_record_user_answers' });
      const missingTarget = (target, issue, stage, title, research = false, extra = {}) => {
        const question = questions.find(item => item.targets?.some(value => targetKey(value) === targetKey(target)));
        if (question && pendingQuestion(question)) return;
        if (question && present(question.answer)) {
          add('agent', stage, 'APPLY_USER_ANSWER', title, target, { questionId: question.id, answer: question.answer, evidence: question.evidence || null, tool: target.kind === 'device' ? 'edoku_patch_device_position' : target.kind === 'project' ? 'edoku_patch_project' : 'edoku_propose_document', instructions: 'Antwort fachlich dem Ziel zuordnen und speichern; keine ganze Chatantwort ungeprüft als Feldwert kopieren. Reicht die Antwort nicht, gezielt im Chat nachfragen.', ...extra });
        } else if (research) add('agent', stage, 'RESEARCH_PRODUCT_DATA', title, target, { tool: 'edoku_record_research', sourcePolicy: 'Hersteller-Originalquelle für exakt bestätigten Hersteller und Typ lesen. Unklare Varianten im Chat klären; keine Installation aus Katalogdaten ableiten.', ...extra });
        else add('user', stage, 'CLARIFY_IN_CHAT', title, target, { channel: 'agent_chat', questionId: 'q_' + hash(issue.key).slice(0, 20), tool: 'edoku_ask_question', ...extra });
      };
      if (!job) add('agent', 'project', 'CREATE_JOB', 'Dokumentationsauftrag aus der tatsächlichen Benutzeranweisung anlegen.', null, { tool: 'edoku_create_documentation_job' });
      if (job?.status !== 'closed') {
        const firestopRules = firestopDocs.firestopRequirements(data, job?.requirements || []);
        const missingFirestop = firestopRules.filter(rule => !rule.requirementId);
        if (job && missingFirestop.length) add('agent', 'evidence', 'DEFINE_FIRESTOP_REQUIREMENTS', 'Brandschutz-Pflichtunterlagen im bestehenden Auftrag anlegen', null, {
          tool: 'edoku_update_documentation_job', requirements: missingFirestop.slice(0, 3).map(rule => rule.definition), remaining: missingFirestop.length,
          instructions: 'Die gelieferten Anforderungen unverändert mit update.requirements im bestehenden Auftrag ergänzen; vorhandene Daten und Anforderungen erhalten. Danach nächsten Plan lesen. Keine Dateien oder Freigaben erzeugen.'
        });
        for (const rule of firestopRules.filter(rule => rule.requirementId)) {
          const requirement = status.requirements.find(item => item.jobId === job?.id && item.id === rule.requirementId && item.applicable !== false && !item.fulfilled);
          if (!requirement || job.documents.some(document => document.state === 'pending' && document.requirementIds.includes(requirement.id))) continue;
          const rejected = job.documents.filter(document => document.state === 'rejected' && document.requirementIds.includes(requirement.id)).map(document => ({ id: document.id, sha256: document.sha256, title: document.title }));
          add('agent', 'evidence', rule.role === 'declaration' ? 'PREPARE_FIRESTOP_DECLARATION' : 'RESEARCH_FIRESTOP_DOCUMENT', requirement.title, { kind: 'requirement', requirementId: requirement.id }, { role: rule.role, system: rule.system, tool: rule.role === 'declaration' ? 'edoku_fire_protection_guide' : 'edoku_propose_document', rejected, instructions: firestopDocs.instructions(rule.role) });
        }
        for (const article of coverage.items) {
          const target = { kind: 'article', articleId: article.id };
          const protection = require('./fireProtectionPolicy').classify({ manufacturer: article.manufacturer, model: article.model, description: article.description });
          const details = { article: { manufacturer: article.manufacturer, model: article.model, variant: article.variant }, devices: article.uncoveredReferences,
            ...(protection.kind !== 'unknown' ? { fireProtection: { ...protection, guideTool: 'edoku_fire_protection_guide' } } : {}) };
          if (['research', 'rejected'].includes(article.status)) add('agent', 'evidence', 'RESEARCH_DATASHEET', `Datenblatt: ${article.manufacturer} ${article.model}`, target, { ...details, rejected: article.rejected, tool: 'edoku_propose_document', category: 'Datenblätter', instructions: 'Offizielle Produktseite einmal ermitteln; edoku_find_manufacturer_documents liefert gezielt maximal drei PDF-Links ohne HTML-Volltext; manufacturerPageUrl und sourceUrl an edoku_propose_document übergeben. Edoku lädt das PDF und prüft Artikelnummer und Variante. Nur passende Unterlagen einmal vorschlagen; mode check prüft ohne Vorschlag. Kein vollständiges PDF im Chat lesen oder routinemäßig rendern. Frühere Ablehnungen beachten. Keine ähnliche Variante verwenden. Einen belegten Nichtfund über edoku_record_datasheet_search speichern; keine Dateifreigabe.' });
          else if (article.status === 'ready_to_link') add('agent', 'evidence', 'LINK_EXISTING_DATASHEET', `Vorhandenes Datenblatt zuordnen: ${article.manufacturer} ${article.model}`, target, { ...details, documents: article.reusable, tool: 'edoku_link_existing_document' });
          else if (article.status === 'needs_identity') {
            const question = questions.find(item => item.targets?.some(value => value.kind === 'device' && article.references.some(ref => ref.listId === value.listId && ref.position === value.position)));
            if (!question) add('user', 'materials', 'CLARIFY_DATASHEET_IDENTITY', `Artikel/Variante für ${article.manufacturer} ${article.model} klären.`, target, { ...details, targets: article.references.slice(0, 20).map(ref => ({ kind: 'device', listId: ref.listId, position: ref.position, field: article.manufacturer ? 'typ' : 'hersteller' })), context: article.search?.reason || 'Ein passendes Datenblatt benötigt einen eindeutig bestätigten Artikel.', channel: 'agent_chat', tool: 'edoku_ask_question' });
          } else if (['assignment_conflict', 'unsupported'].includes(article.status)) add('agent', 'evidence', 'RESOLVE_DATASHEET_ASSIGNMENT', `Datenblattzuordnung prüfen: ${article.manufacturer} ${article.model}`, target, { ...details, tool: 'edoku_get_device_list', instructions: 'Verknüpfung und Original prüfen. Bestehende andere Zuordnung nicht überschreiben. Nicht unterstützte Struktur im Chat benennen.' });
        }
        for (const requirement of status.requirements.filter(item => item.jobId === job?.id && item.applicable !== false && item.scope === 'internal' && !item.fulfilled)) {
          const proposals = job.documents.filter(document => document.state === 'pending' && document.requirementIds.includes(requirement.id));
          const rejected = job.documents.filter(document => document.state === 'rejected' && document.requirementIds.includes(requirement.id));
          if (!proposals.length && rejected.length) {
            rejectedInternal.push({ requirementId: requirement.id, proposalIds: rejected.map(document => document.id) });
            continue;
          }
          if (!proposals.some(internalProposal)) add('agent', 'chapters', 'PREPARE_INTERNAL_DOCUMENT', `Interne Projektunterlage vorbereiten: ${requirement.title}`, { kind: 'requirement', requirementId: requirement.id }, { tool: 'edoku_prepare_project_document', scope: 'internal', supersedes: proposals.map(document => document.id), instructions: 'Bestätigte Fakten und offene Punkte intern zusammenstellen. Keine Kundenanlage oder Prüfung erfinden. Passende interne Unterlagen dürfen zusammengefasst werden. Jede neue Datei bleibt einzeln manuell zu prüfen.' });
        }
        for (const issue of status.issues) {
          if (['ANSWER_REQUIRED', 'FIRESTOP_REQUIREMENT_MISSING', 'FACT_DEPENDENCY_MISSING'].includes(issue.code)) continue;
          if (issue.code === 'PROJECT_FIELD_MISSING') missingTarget({ kind: 'project', field: issue.field }, issue, 'project', issue.message);
          else if (issue.code === 'DEVICE_FIELD_MISSING') {
            const target = { kind: 'device', listId: issue.listId, position: issue.position, field: issue.field };
            const { position } = positionFor(data, target);
            const research = researchFields.includes(issue.field) && present(position.hersteller) && present(position.typ);
            missingTarget(target, issue, research ? 'research' : 'materials', issue.message, research, { device: { manufacturer: position.hersteller || '', model: position.typ || '', description: position.beschreibung || '' } });
          } else if (issue.code === 'REQUIRED_DOCUMENT_MISSING') {
            const requirement = job?.requirements.find(item => item.id === issue.requirementId);
            if (!requirement || job.documents.some(document => document.state === 'pending' && document.requirementIds.includes(requirement.id))) continue;
            const target = { kind: 'requirement', requirementId: requirement.id };
            const rejected = job.documents.filter(document => document.state === 'rejected' && document.requirementIds.includes(requirement.id)).map(document => ({ id: document.id, sha256: document.sha256, title: document.title }));
            const firestopRule = firestopRules.find(rule => rule.requirementId === requirement.id);
            if (firestopRule) add('agent', 'evidence', firestopRule.role === 'declaration' ? 'PREPARE_FIRESTOP_DECLARATION' : 'RESEARCH_FIRESTOP_DOCUMENT', requirement.title, target, { role: firestopRule.role, system: firestopRule.system, tool: 'edoku_propose_document', rejected, instructions: firestopDocs.instructions(firestopRule.role) });
            else if (requirementDevices(requirement).length && ['Datenblätter', 'Bedienungsanleitungen'].includes(requirement.category)) add('agent', 'evidence', 'RESEARCH_ORIGINAL_DOCUMENT', requirement.title, target, { tool: 'edoku_propose_document', ...(requirement.device ? { device: requirement.device } : { devices: requirementDevices(requirement) }), rejected, instructions: 'Passende Hersteller-Originalunterlage beschaffen. Bereits freigegebene passende Dateien zuerst wiederverwenden. Abgelehnte Dateien nicht unverändert erneut einreichen. Jede neue Datei benötigt GUI-Einzelfreigabe.' });
            else if (questions.some(question => question.targets?.some(value => targetKey(value) === targetKey(target)))) missingTarget(target, issue, 'evidence', issue.message, false, { instructions: 'Gespeicherte Antwort prüfen und passende tatsächliche Unterlage verwenden; keine Messwerte oder Unterschriften erfinden.' });
            else add('agent', 'evidence', 'INSPECT_REQUIRED_DOCUMENT', issue.message, target, { tool: 'edoku_get_documentation_job', requirement, scope: policy?.documentScope || 'internal', previousProposals: job.documents.filter(document => document.requirementIds.includes(requirement.id)).map(document => ({ id: document.id, state: document.state, sourceLabel: document.sourceLabel, projectDocument: document.projectDocument || null })), instructions: 'Zuerst vorhandene Unterlagen, ursprünglichen Auftrag und frühere Vorschläge abgleichen. Generierbare Projekttexte und Verzeichnisse selbst aus bestätigten Daten vorbereiten; vorhandene edoku-Kapitel und den gewünschten Ablageumfang beachten. Nur tatsächlich fehlende Originale oder einen unklaren Umfang anschließend mit edoku_ask_question im Chat klären. Alte Entwurfstitel allein sind kein Grund für eine Benutzerfrage.' });
          } else if (issue.code === 'CHAPTER_CONTENT_MISSING') {
            if (!job?.documents.some(document => document.state === 'pending' && document.projectDocument?.documentId === issue.documentId && document.projectDocument.scope === 'documentation')) add('agent', 'chapters', 'PREPARE_CHAPTER', issue.message, { kind: 'chapter', documentId: issue.documentId }, { tool: 'edoku_prepare_project_document', scope: 'documentation' });
          }
          else if (issue.code === 'DEVICE_LIST_EMPTY') {if(material.summary.source==='legacy_inventory')add('agent', 'materials', 'MAP_MATERIAL', issue.message, { kind: 'list', listId: issue.listId }, { tool: 'edoku_get_device_list', instructions: 'Nur tatsächliches Material zuordnen, keine Geräte erfinden. Bei fehlender fachlicher Struktur edoku_ask_question mit structure-Ziel verwenden.' });}
          else if (['MATERIAL_SOURCE_MISSING','MATERIAL_IMPORT_INCOMPLETE','MATERIAL_ASSIGNMENT_OPEN'].includes(issue.code)) continue;
          else if (issue.code==='MATERIAL_SCOPE_UNCONFIRMED')add('user','materials','CONFIRM_MATERIAL_SCOPE',issue.message,{kind:'material_source',field:'source'},{tool:'edoku_ask_question',channel:'agent_chat',context:'Muster nicht als tatsächlich verwendetes Material behandeln; aktuelle Materialliste bereitstellen.'});
          else if (['SERVICE_AREA_MISSING', 'FIRESTOPS_MISSING', 'FIRESTOP_FIELD_MISSING'].includes(issue.code)) add('user', issue.code === 'SERVICE_AREA_MISSING' ? 'project' : 'evidence', 'CLARIFY_IN_CHAT', issue.message, null, { channel: 'agent_chat', tool: 'edoku_ask_question', instructions: 'Fehlende Ausführungsdaten oder Struktur im Chat klären. Keine unpassenden Ersatzfelder verwenden.' });
          else if(issue.code==='DEVICE_DOCUMENT_CHANGED'&&job){
            const document=job.documents.find(row=>row.id===issue.proposalId);
            const attachment=data.anhaenge.find(row=>row.id===document?.attachmentId);
            const refs=attachment?.deviceReferences||[];
            const handled=refs.length&&refs.every(ref=>coverage.items.some(article=>['blocked','assignment_conflict'].includes(article.status)&&article.references.some(target=>target.listId===ref.listId&&target.position===ref.position)));
            // Coverage already owns the concrete recheck task or recorded blocker.
            // Keep the readiness issue; do not schedule the same failed work forever.
            if(!handled)add('agent','evidence','RESOLVE_VALIDATION',issue.message,null,{issue,instructions:'Verknüpfung und Original gezielt prüfen; keine bestehende Dateientscheidung ersetzen.'});
          }
          else add('agent', 'evidence', 'RESOLVE_VALIDATION', issue.message, null, { issue, instructions: 'Passenden vorhandenen edoku-Bereich lesen; nicht unterstützte Änderungen und Widersprüche im Chat erklären und klären.' });
        }
        for (const question of questions.filter(question => question.targets?.some(target => target.kind === 'structure') && present(question.answer))) add('agent', question.stage, 'RESOLVE_STRUCTURE_GAP', question.prompt, null, { questionId: question.id, answer: question.answer, targets: question.targets, tool: 'edoku_get_section', instructions: 'Vorhandene Struktur und Antwort abgleichen. Dieser Zugang ändert keine globalen Strukturen und erfindet keine Felder. Fehlende unterstützte Erweiterung im Agentenchat als offene Produktaufgabe melden; betroffene Daten nicht falsch ablegen.' });
        for (const document of status.pendingDocuments) add('user', 'review', 'REVIEW_FILE', document.title, { kind: 'proposal', proposalId: document.proposalId }, { channel: 'edoku_gui', url: `/assistent/auftraege/${document.jobId}/dateien/${document.proposalId}` });
        for (const list of [agent, user]) for (let i = list.length - 1; i >= 0; i--) if (held(list[i])) list.splice(i, 1);
        if (job) {
          const knowledge = knowledgeService.buildKnowledge(data, job, { tasks: agent, work, requirements: status.requirements });
          knowledgeSummary = { policy: knowledge.policy, ...knowledge.summary, tool: 'edoku_knowledge' };
          for (const fact of knowledge.facts.filter(row => row.needsApplication)) add('agent','materials','APPLY_CONFIRMED_FACT',`Bestätigte Angabe in edoku übernehmen: ${fact.label}`,fact.subject.kind==='project'?{kind:'project',field:fact.key}:{kind:'device',listId:fact.subject.listId,position:fact.subject.position,field:fact.key},{tool:fact.subject.kind==='project'?'edoku_patch_project':'edoku_patch_device_position',factId:fact.id,values:{[fact.key]:fact.value},instructions:'Belegten bestätigten Wert gezielt mit aktueller Projektversion übernehmen; andere Felder und Dateien erhalten. Bei inzwischen abweichendem Bestand erneut abgleichen.'});
          for (let index = agent.length - 1; index >= 0; index--) {
            const task = agent[index];
            const node = knowledge.dependencies.find(row => row.taskId === task.id || (task.target?.kind === 'requirement' && row.requirementId === task.target.requirementId));
            if (node && !node.ready) agent.splice(index, 1);
            else if (node) task.dependencies = { ready: true, facts: node.dependsOn.length };
          }
          for (const selected of knowledge.questions.slice(0,3).reverse()) {
          const activeFactQuestion = job.questions.some(question => !question.answer && !question.obsolete && question.targets?.some(target => target.kind === 'fact' && knowledgeService.factId(target) === selected.factId && target.revision === selected.target.revision));
          if (!activeFactQuestion) {
            const hasLegacy = selected.legacyQuestionIds.length > 0;
            const canResearch = !hasLegacy && selected.researchInputs.length > 0;
            add('agent', 'evidence', hasLegacy ? 'STRUCTURE_EXISTING_INFORMATION' : canResearch ? 'RESEARCH_SYSTEM_IDENTITY' : 'ASK_TARGETED_QUESTION', hasLegacy ? 'Vorhandene Antwort als belegte Fakten strukturieren' : canResearch ? 'Systemidentität aus bestätigten Fragmenten recherchieren' : selected.prompt, selected.target, {
              tool: hasLegacy ? 'edoku_get_documentation_job' : canResearch ? 'edoku_knowledge' : 'edoku_ask_question', factId: selected.factId, unlocks: selected.unlocks, immediatelyUnblocks: selected.immediatelyUnblocks,
              ...(hasLegacy ? { questionIds: selected.legacyQuestionIds, instructions: 'Vorhandene Frage gezielt mit section=questions und entryId lesen; bei Bedarf einzelne Historienseite. Tatsächliche Originalbelege als facts über edoku_record_chat_decision sichern. Fehlendes unknown/deferred, Unsicheres inferred/ambiguous speichern. Nicht erneut fragen und keine freie Antwort ungeprüft als Feldwert übernehmen.' } : canResearch ? {
                inputs: selected.researchInputs, nextTool: 'edoku_record_chat_decision', instructions: 'Hersteller-Originalquelle anhand dieser bestätigten Komponenten/Herstellerkennung recherchieren. Systemzuordnung als facts mit origin=research, status=inferred und HTTPS-Quellenadresse sichern; dies bestätigt keinen Einbau. Danach gezielt bestätigen lassen. Bei ungeklärtem Ergebnis einen begründeten unknown-Befund speichern und nicht unverändert erneut suchen.'
              } : {
                question: { id: 'q_' + hash([selected.factId, selected.target.revision]).slice(0,20), stage: 'evidence', required: true, prompt: selected.prompt, context: `Faktenziel klären; entsperrt ${selected.unlocks} Aufgaben. Bestätigte Fakten nicht erneut fragen, keine Ausführung erfinden.`, targets: [selected.target] },
                instructions: 'Erst unabhängige Aufgaben bearbeiten. Danach mit execution.questionBatch bis zu drei thematisch passende Fragen gemeinsam speichern und im Chat bündeln. Antwort als belegte facts mit eindeutigem Ziel speichern; Unklares ambiguous/unassigned lassen.'
              })
            });
            const task = agent.pop();
            const index = agent.findIndex(row => !['CREATE_JOB','DEFINE_FIRESTOP_REQUIREMENTS'].includes(row.code));
            agent.splice(index < 0 ? agent.length : index, 0, task);
          }
          }
          for (const node of knowledge.dependencies.filter(row => row.missingFacts.some(id => knowledge.facts.find(fact => fact.id === id)?.state === 'invalid_target'))) add('agent', 'evidence', 'RESOLVE_FACT_TARGET', 'Verändertes Faktenziel abgleichen', {kind:'requirement',requirementId:node.requirementId}, {tool:'edoku_knowledge',instructions:'Gezielt Abhängigkeiten und betroffenes Faktenziel lesen; gelöschte oder fremde Ziele nicht ersetzen oder wiederherstellen.'});
        }
        if (status.canGenerate && coverage.summary.complete && !status.technicalExportComplete && !agent.length) add('agent', 'export', 'QUEUE_OR_CHECK_EXPORT', 'Aktuellen technischen PDF-/ZIP-Export beauftragen oder laufenden Auftrag prüfen.', null, { tool: 'edoku_list_export_jobs', nextTool: 'edoku_queue_export' });
      }
      if (job?.status === 'closed') { agent.length = 0; user.length = 0; }
      const execution = require('./autonomousWorkflowService').build({ agent, user, state: job?.status === 'closed' ? 'closed' : status.technicalExportComplete && coverage.summary.complete && !agent.length && !user.length ? 'technically_complete' : !agent.length && !user.length && !work.length && coverage.summary.complete ? 'inspect_scope' : 'open', pendingFiles: status.pendingDocuments.length });
      const revision = store.projectDataRevision(root, userId, projectId);
      const stageStates = stages.map(([id, title, completion]) => ({ id, title, completion, agentTasks: agent.filter(task => task.stage === id).length, userTasks: user.filter(task => task.stage === id).length }));
      const state = job?.status === 'closed' ? 'closed' : status.technicalExportComplete && coverage.summary.complete && !agent.length && !user.length ? 'technically_complete' : agent.length ? 'agent_action' : user.length ? 'waiting_user' : work.length || !coverage.summary.complete ? 'waiting_sources' : 'inspect_scope';
      const nextAction = job?.status === 'closed' ? null : agent[0] || user[0] || null;
      const resetGeneration=projectResetGeneration(connection(),userId,projectId);
      const result = {
        ...(resetGeneration?{reset:{generation:resetGeneration,materialPolicy:'new_material_only',instruction:'Dieses Projekt wurde bewusst zurückgesetzt. Frühere Materiallisten und Aufträge aus dem Chat nicht wieder einspielen. Nur neu bereitgestellte Materialien und den neuen Auftrag verwenden.'}}:{}),
        ...(knowledgeSummary ? {knowledge:knowledgeSummary} : {}),
        contractVersion: '2.1', material: material.summary, projectId, jobId: job?.id || null, jobVersion: job?.version || null,
        projectETag: revision ? `"${revision}"` : null, checkpoint: hash([execution.policy,userId,projectId,job?.id,revision,job?.version,agent,user,work,view,limit,offset]), state, execution,
        stage: nextAction?.stage || (state === 'technically_complete' ? 'export' : 'project'), nextAction,
        policy: { documentScope: policy?.documentScope || 'internal', requirementScopes: policy?.requirementScopes || [], excludeConsumables: policy?.excludeConsumables !== false, materialExclusions: require('./documentationMaterialPolicy').effective(data.projekt).exclusions, materialPolicy: require('./documentationMaterialPolicy').POLICY, fileApproval: 'manual_gui_per_file', questions: 'agent_chat', research: 'manufacturer_sources_first', fireProtectionWorkflow: require('./fireProtectionPolicy').POLICY,productDocumentCheck:require('./productDocumentVerificationService').POLICY, ...(status.firestopDocumentation.active ? { firestopDocuments: firestopDocs.POLICY } : {}) },
        context: { instruction: job?.instruction || '', project: Object.fromEntries(Object.keys(require('../src/api/schemas').projectPatch.shape).filter(field => Object.hasOwn(data.projekt, field)).map(field => [field, data.projekt[field]])), toolsForExistingSources: ['edoku_get_documentation_job', 'edoku_get_section', 'edoku_get_device_list'] },
        rules: ['Nach jedem Arbeitsschritt edoku_next_action erneut lesen. Bei Versionskonflikt neu lesen und Änderungen abgleichen.', 'Vorhandene Angaben und passende freigegebene Unterlagen zuerst nutzen; erst dann recherchieren und anschließend gezielt nachfragen.', 'Neue Datenblätter und Anleitungen benötigen eine verlinkende Hersteller-Produktseite sowie die gezielte serverseitige PDF-, Artikelnummern- und Variantenprüfung. Unklare Befunde gezielt klären; keine wiederholten Vollabrufe.', 'Unabhängige Agentenaufgaben trotz offener Rückfragen weiterbearbeiten. Keine erfundenen Projektfakten, Messwerte, Abnahmen oder Unterschriften.', 'edoku gibt Felder, Leistungsbereiche und Kapitel vor. Strukturlücken im Chat klären; keine Ersatzstruktur erfinden.', 'Dateien bleiben Vorschläge bis zur individuellen manuellen GUI-Freigabe. Interne Texte niemals automatisch zum Kundenexport machen.'],
        stages: stageStates, agentActions: { total: agent.length, items: agent.slice(offset, offset + limit), limit, offset }, userActions: { total: user.length, items: user.slice(offset, offset + limit), limit, offset },
        structure: {
          serviceAreas: data.leistungsbereiche,
          deviceLists: data.geraetelisten.map(list => ({ id: list.id, title: list.titel || list.id, active: list.aktiv !== false && data.leistungsbereiche.aktiv.includes(list.leistungsbereich), serviceArea: list.leistungsbereich, positions: list.positionen.length, fields: deviceListFieldsForLeistungsbereich(list.leistungsbereich).map(({ name, label, required }) => ({ name, label, required })) })),
          chapters: data.matrix.filter(entry => entry.aktiv && entry.export !== false).map(entry => ({ id: entry.id, title: entry.titel, chapter: entry.kapitel || '', form: entry.formularart || '', required: Boolean(entry.pflicht) })),
          capabilities: { projectFields: true, deviceFields: 'listed_fields_only', originalDocuments: 'proposals_only', globalStructureChanges: false, customFields: false, fileApproval: false }
        },
        datasheets: coverage.summary,
        waiting: { datasheetsNotFound: coverage.summary.notFound, datasheetBlocked:coverage.summary.blocked, datasheetIdentity: coverage.summary.needsIdentity, files: status.pendingDocuments.length, rejectedInternal, decisions: work.length },
        documentWork: { total: work.length, items: work.slice(offset, offset + limit), limit, offset },
        ...(includeDatasheets ? { datasheetDetails: coverage } : {}),
        readiness: { canGenerate: status.canGenerate, technicalExportComplete: status.technicalExportComplete, professionalApproval: 'not_assessed', issues: status.issues.length, pendingFiles: status.pendingDocuments.length, datasheetsComplete: coverage.summary.complete }
      };
      if (sinceCheckpoint === result.checkpoint) return {contractVersion:result.contractVersion,changed:false,view,projectId,jobId:result.jobId,jobVersion:result.jobVersion,projectETag:result.projectETag,checkpoint:result.checkpoint,state,execution:{policy:execution.policy,action:execution.action,independentTasks:execution.independentTasks,onUnchanged:execution.onUnchanged}};
      if (view !== 'compact') return result;
      return {
        ...(result.reset?{reset:result.reset}:{}),
        ...(knowledgeSummary ? {knowledge:knowledgeSummary} : {}),
        contractVersion: result.contractVersion, changed:true, view: 'compact', projectId, jobId: result.jobId,
        jobVersion: result.jobVersion, projectETag: result.projectETag, checkpoint: result.checkpoint,
        state, stage: result.stage, nextAction, execution, material: result.material,
        policy: { fileApproval: result.policy.fileApproval, documentScope: result.policy.documentScope, excludeConsumables: result.policy.excludeConsumables, materialExclusions: result.policy.materialExclusions, materialPolicy: result.policy.materialPolicy, questions: result.policy.questions, research: result.policy.research,productDocumentCheck:require('./productDocumentVerificationService').POLICY, fireProtectionWorkflow:require('./fireProtectionPolicy').POLICY, ...(result.policy.firestopDocuments ? { firestopDocuments: result.policy.firestopDocuments } : {}) },
        taskCounts: { agent: agent.length, user: user.length },
        datasheets: result.datasheets, waiting: {datasheetsNotFound:result.waiting.datasheetsNotFound,datasheetBlocked:result.waiting.datasheetBlocked,datasheetIdentity:result.waiting.datasheetIdentity,files:result.waiting.files,decisions:work.length,rejectedInternal:rejectedInternal.length}, readiness: result.readiness,
        decisionTool: 'edoku_record_chat_decision', decisionPolicy: 'Benutzerantwort und betroffene Warte-/Zurückstellungsziele gemeinsam mit wörtlichem Beleg speichern. Keine Interpretation ohne tatsächliche Benutzerangabe.',
        contextTool: result.jobId ? { name: 'edoku_get_documentation_job', arguments: {projectId,jobId:result.jobId,section:'summary'} } : {name:'edoku_list_documentation_jobs',arguments:{projectId,limit:3,offset:0}}
      };
    });
  }
  return { inspect, start, ask, recordResearch };
}
module.exports = { createDocumentationWorkflowService };
