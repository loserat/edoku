const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { PDFDocument } = require("pdf-lib");
const { getProject, connection } = require("./dbService");
const store = require("./projectDataStoreService");
const { dataFilesForProject, upsertProjectFromData } = require("./projectArchiveService");
const { readJson, writeJson } = require("./jsonService");
const { assertSafePath, sanitizeFileName } = require("./pathService");
const { detectAttachmentMime } = require("./attachmentService");
const { defaultDocumentMetaForCategory } = require("./documentAttachmentService");
const { parse, fault } = require("../src/api/validation");
const { id, z } = require("../src/api/schemas");
const { jobInput, jobUpdate, documentInput, approvalInput, answerInput, replacementsInput, requirementCorrection, withdrawalInput } = require("../src/api/assistantSchemas");
const { referencesForDocument, resolveDeviceReferences, linkDeviceDocuments, requirementDevices, isTypeReference } = require("./deviceDocumentService");
const { assertProposalScope } = require('./requirementScopeService');
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();
const MAX_BYTES = 15 * 1024 * 1024;
const mimeExtensions = { "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
const questionOpen = question => question.required && !question.answer && !question.obsolete;
const {createProductDocumentVerificationService,compactVerification}=require('./productDocumentVerificationService');

function createDocumentAssistantService(root, { db = connection(), checkStorage = async () => {}, verificationService=createProductDocumentVerificationService(root) } = {}) {
  const exists = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documentation_jobs'").get());
  function schema() {
    db.exec(`CREATE TABLE IF NOT EXISTS documentation_jobs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, instruction TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN('queued','working','needs_info','review','closed')),
      message TEXT NOT NULL DEFAULT '', questions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(questions)),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id,user_id) REFERENCES projects(id,user_id));
      CREATE TABLE IF NOT EXISTS document_proposals (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES documentation_jobs(id),
      metadata TEXT NOT NULL CHECK(json_valid(metadata)), filename TEXT NOT NULL, mime_type TEXT NOT NULL,
      bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','approved','rejected')),
      created_at TEXT NOT NULL, decided_at TEXT, decided_by TEXT REFERENCES users(id), attachment_id TEXT);
      CREATE TABLE IF NOT EXISTS document_review_views (
      proposal_id TEXT NOT NULL REFERENCES document_proposals(id), user_id TEXT NOT NULL REFERENCES users(id),
      sha256 TEXT NOT NULL, viewed_at TEXT NOT NULL, PRIMARY KEY(proposal_id,user_id));`);
    db.exec(`CREATE TABLE IF NOT EXISTS documentation_requirements (
      job_id TEXT NOT NULL REFERENCES documentation_jobs(id), id TEXT NOT NULL,
      payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(job_id,id));`);
    db.exec(require('./documentProposalStorageService').INDEX);
  }
  function project(userId, projectId) {
    parse(id, userId); parse(id, projectId);
    const row = getProject(userId, projectId);
    if (!row || row.status === "geloescht") throw fault("Projekt wurde nicht gefunden.", 404, "NOT_FOUND");
    return row;
  }
  function job(userId, jobId) {
    parse(id, jobId);
    const row = exists() && db.prepare("SELECT * FROM documentation_jobs WHERE id=? AND user_id=?").get(jobId, userId);
    if (!row) throw fault("Auftrag wurde nicht gefunden.", 404, "NOT_FOUND");
    project(userId, row.project_id);
    return row;
  }
  function publicJob(row) {
    return { id: row.id, projectId: row.project_id, instruction: row.instruction, status: row.status, message: row.message, questions: JSON.parse(row.questions), createdAt: row.created_at, updatedAt: row.updated_at };
  }
  function publicProposal(row) {
    const metadata = JSON.parse(row.metadata);
    delete metadata.productVerificationPolicy;
    return { id: row.id, jobId: row.job_id, deviceReferences: [], supersedes: [], ...metadata, filename: row.filename, mimeType: row.mime_type,
      ...(metadata.productVerification?{productVerification:compactVerification(metadata.productVerification)}:{}),bytes: row.bytes, sha256: row.sha256, state: row.state === 'pending' && metadata.withdrawal ? 'withdrawn' : metadata.supersededBy && row.state === "pending" ? "superseded" : row.state, createdAt: row.created_at, decidedAt: row.decided_at, attachmentId: row.attachment_id };
  }
  function list(userId, projectId) {
    if (projectId) project(userId, projectId);
    if (!exists()) return [];
    return db.prepare("SELECT j.* FROM documentation_jobs j JOIN projects p ON p.id=j.project_id AND p.user_id=j.user_id WHERE j.user_id=? AND p.status<>'geloescht' AND (? IS NULL OR j.project_id=?) ORDER BY (j.status='closed'),j.created_at DESC,j.id LIMIT 100").all(userId, projectId || null, projectId || null).map(publicJob);
  }
  function get(userId, jobId) {
    const row = job(userId, jobId);
    const hasRequirements = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documentation_requirements'").get();
    const value = { ...publicJob(row), requirements: hasRequirements ? db.prepare("SELECT payload FROM documentation_requirements WHERE job_id=? ORDER BY id").all(jobId).map(item => JSON.parse(item.payload)) : [], documents: db.prepare("SELECT * FROM document_proposals WHERE job_id=? ORDER BY created_at,id").all(jobId).map(publicProposal) };
    // Compute obligations without writing on reads, migrating legacy rows or touching decisions.
    if (row.status !== 'closed') {
      const read = (name, fallback) => store.readProjectDocumentSync(root, userId, row.project_id, name + '.json', fallback);
      const data = { projekt: read('projekt', {}), leistungsbereiche: read('leistungsbereiche', { aktiv: [] }), brandschutz: read('brandschutz', []), projektSysteme: read('projektSysteme', []), geraetelisten: read('geraetelisten', []) };
      value.requirements = require('./firestopDocumentationService').automaticRequirements(data, value.requirements, jobId);
    }
    return { ...value, version: hash(JSON.stringify(value)) };
  }
  function assertVersion(userId, jobId, version) {
    if (get(userId, jobId).version !== version) throw fault("Auftrag wurde zwischenzeitlich geändert. Neu lesen und Angaben abgleichen.", 412, "PRECONDITION_FAILED");
  }
  function replaceProposals(userId, jobId, input) {
    const data = parse(replacementsInput, input);
    db.transaction(() => {
      assertVersion(userId, jobId, data.version);
      if (job(userId, jobId).status === "closed") throw fault("Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
      const previousIds = new Set(data.replacements.map(item => item.previousId));
      if (previousIds.size !== data.replacements.length || data.replacements.some(item => previousIds.has(item.replacementId))) throw fault("Widersprüchliche Ablösung.", 400, "VALIDATION_ERROR");
      for (const item of data.replacements) {
        const previous = proposal(userId, jobId, item.previousId).row;
        const replacement = publicProposal(proposal(userId, jobId, item.replacementId).row);
        if (publicProposal(previous).state !== "pending" || !["pending", "approved"].includes(replacement.state) || publicProposal(previous).requirementIds.some(key => !replacement.requirementIds.includes(key))) throw fault("Nur offene Vorgänger mit erhaltenen Anforderungen dürfen abgelöst werden.", 409, "SUPERSESSION_CONFLICT");
        db.prepare("UPDATE document_proposals SET metadata=? WHERE id=?").run(JSON.stringify({ ...JSON.parse(previous.metadata), supersededBy: item.replacementId }), item.previousId);
      }
      db.prepare("UPDATE documentation_jobs SET updated_at=? WHERE id=?").run(now(), jobId);
    })();
    return get(userId, jobId);
  }
  function withdrawProposals(userId, jobId, input) {
    const data = parse(withdrawalInput, input);
    db.transaction(() => {
      assertVersion(userId, jobId, data.version);
      if (job(userId, jobId).status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
      if (new Set(data.proposalIds).size !== data.proposalIds.length) throw fault('Dateivorschlag mehrfach angegeben.', 400, 'VALIDATION_ERROR');
      const rows = data.proposalIds.map(proposalId => proposal(userId, jobId, proposalId).row);
      if (rows.some(row => publicProposal(row).state !== 'pending')) throw fault('Nur offene, nicht abgelöste Dateivorschläge dürfen zurückgezogen werden.', 409, 'WITHDRAWAL_CONFLICT');
      const at = now();
      for (const row of rows) {
        const metadata = JSON.parse(row.metadata);
        metadata.withdrawal = { reason: data.reason, evidence: data.evidence, recordedAt: at, recordedBy: userId };
        db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify(metadata), row.id);
      }
      db.prepare('UPDATE documentation_jobs SET updated_at=? WHERE id=?').run(at, jobId);
    })();
    return { jobId, version: get(userId, jobId).version, withdrawn: data.proposalIds, fileApproval: 'manual_gui_per_file' };
  }
  function recordAnswers(userId, jobId, input) {
    const data = parse(answerInput, input);
    db.transaction(() => {
      assertVersion(userId, jobId, data.version);
      const row = job(userId, jobId);
      if (row.status === "closed") throw fault("Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
      const questions = JSON.parse(row.questions), seen = new Set();
      for (const item of [...data.answers, ...data.obsolete]) {
        if (seen.has(item.questionId)) throw fault("Rückfrage mehrfach angegeben.", 400, "VALIDATION_ERROR");
        seen.add(item.questionId);
        const question = questions.find(value => value.id === item.questionId);
        if (!question) throw fault("Unbekannte Rückfrage.", 400, "VALIDATION_ERROR");
        question.history = [...(question.history || []), { answer: question.answer, answeredAt: question.answeredAt, evidence: question.evidence || null, obsolete: question.obsolete || null }];
        question.evidence = { ...item.evidence, recordedBy: userId, recordedAt: now(), kind: "chat" };
        if (item.answer) { question.answer = item.answer; question.answeredAt = now(); delete question.obsolete; }
        else question.obsolete = { reason: item.reason, ...question.evidence };
      }
      db.prepare("UPDATE documentation_jobs SET questions=?,status=?,updated_at=? WHERE id=?").run(JSON.stringify(questions), questions.some(questionOpen) ? "needs_info" : "queued", now(), jobId);
    })();
    return get(userId, jobId);
  }
  function create(userId, projectId, input, { jobId: fixedId = null } = {}) {
    project(userId, projectId);
    const data = parse(jobInput, input);
    schema();
    if (fixedId) {
      parse(id, fixedId);
      const existing = db.prepare("SELECT id,project_id FROM documentation_jobs WHERE id=? AND user_id=?").get(fixedId, userId);
      if (existing) {
        if (existing.project_id !== projectId) throw fault("Auftragszuordnung ist ungültig.", 409, "JOB_CONFLICT");
        return get(userId, fixedId);
      }
    }
    if (db.prepare("SELECT count(*) n FROM documentation_jobs WHERE user_id=? AND status<>'closed'").get(userId).n >= 50) throw fault("Bitte zuerst bestehende Aufträge abschließen. Höchstens 50 offene Aufträge pro Konto.", 409, "JOB_LIMIT");
    const jobId = fixedId || "job_" + crypto.randomBytes(12).toString("hex"), stamp = now();
    db.transaction(() => {
      db.prepare("INSERT INTO documentation_jobs(id,user_id,project_id,instruction,status,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(jobId, userId, projectId, data.instruction, stamp, stamp);
      addRequirements(jobId, data.requirements);
      addRequirements(jobId, get(userId, jobId).requirements);
    })();
    return get(userId, jobId);
  }
  function addRequirements(jobId, requirements) {
    for (const incoming of requirements || []) {
      const existing = db.prepare("SELECT payload FROM documentation_requirements WHERE job_id=? AND id=?").get(jobId, incoming.id);
      if (existing && existing.payload !== JSON.stringify(incoming)) throw fault("Bestehende Dokumentanforderungen dürfen nicht still verändert oder entfernt werden.", 409, "REQUIREMENT_CONFLICT");
      if (!existing) db.prepare("INSERT INTO documentation_requirements(job_id,id,payload) VALUES(?,?,?)").run(jobId, incoming.id, JSON.stringify(incoming));
    }
    if (db.prepare("SELECT count(*) n FROM documentation_requirements WHERE job_id=?").get(jobId).n > 100) throw fault("Höchstens 100 Dokumentanforderungen pro Auftrag.", 400, "REQUIREMENT_LIMIT");
  }
  async function correctRequirement(userId, jobId, requirementId, input) {
    const data = parse(requirementCorrection, input);
    assertVersion(userId, jobId, data.version);
    const current = get(userId, jobId);
    if (current.status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
    const previous = current.requirements.find(item => item.id === requirementId);
    if (!previous) throw fault('Anforderung wurde nicht gefunden.', 404, 'NOT_FOUND');
    const originalDevices = requirementDevices(previous);
    if (!originalDevices.length) throw fault('Nur vorhandene Geräteanforderungen können so korrigiert werden.', 409, 'DEVICE_REQUIREMENT_REQUIRED');
    if (data.category !== previous.category && !(previous.category === 'Nachweise' && data.category === 'Datenblätter' && /datenblatt/i.test(previous.title))) throw fault('Die Unterlagenart darf durch diese Korrektur nicht geändert werden.', 409, 'REQUIREMENT_CATEGORY_CONFLICT');
    if (current.documents.some(document => document.state === 'pending' && document.requirementIds.includes(requirementId))) throw fault('Offene Dateivorschläge dieser Anforderung zuerst prüfen oder bewusst ablösen.', 409, 'PENDING_REQUIREMENT_DOCUMENTS');
    const files = dataFilesForProject(root, userId, current.projectId);
    const [lists, areas, projectData] = await Promise.all([readJson(files.geraetelisten, []), readJson(files.leistungsbereiche, {}), readJson(files.projekt, {})]);
    const targets = resolveDeviceReferences(lists, data.devices, data.category, 'application/pdf');
    const same = (a,b) => String(a || '').trim().toLocaleLowerCase('de') === String(b || '').trim().toLocaleLowerCase('de');
    if (targets.some(({list,position,reference}) => !areas.aktiv?.includes(list.leistungsbereich) || isTypeReference(position) || /\b(?:Beispieldatensatz|Testposition|Musterposition)\b/i.test(position.beschreibung || '') || !originalDevices.some(original => same(original.manufacturer, reference.manufacturer) && same(original.model, reference.model)))) throw fault('Die Korrektur benötigt reale aktive Geräte desselben bestätigten Artikels; Typreferenzen sind keine Geräteinstanzen.', 409, 'INVALID_REQUIREMENT_DEVICE');
    const { device, devices, ...rest } = previous;
    const corrected = { ...rest, category: data.category, devices: data.devices };
    if (JSON.stringify(previous) === JSON.stringify(corrected)) return corrected;
    if (projectData.assistantRequirementCorrections && !Array.isArray(projectData.assistantRequirementCorrections)) throw fault('Die Korrekturhistorie ist ungültig.', 409, 'INVALID_REQUIREMENT_HISTORY');
    const history = [...(projectData.assistantRequirementCorrections || [])];
    if (history.length >= 200) throw fault('Die Korrekturhistorie ist voll.', 409, 'REQUIREMENT_HISTORY_LIMIT');
    const stamp = now();
    history.push({ jobId, requirementId, previous, corrected, evidence: data.evidence, previousJobVersion: data.version, recordedAt: stamp, recordedBy: userId });
    await writeJson(files.projekt, { ...projectData, assistantRequirementCorrections: history });
    store.onProjectDataCommit(() => {
      assertVersion(userId, jobId, data.version);
      db.prepare('UPDATE documentation_requirements SET payload=? WHERE job_id=? AND id=?').run(JSON.stringify(corrected), jobId, requirementId);
      db.prepare('UPDATE documentation_jobs SET updated_at=? WHERE id=?').run(stamp, jobId);
    });
    return corrected;
  }
  function update(userId, jobId, input) {
    const data = parse(jobUpdate, input);
    if (data.requirements) schema();
    db.transaction(() => {
      const row = job(userId, jobId);
      if (row.status === "closed") throw fault("Dieser Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
      const questions = JSON.parse(row.questions);
      for (const incoming of data.questions || []) {
        const existing = questions.find(question => question.id === incoming.id);
        if (existing && ['prompt', 'required', 'stage', 'context', 'targets'].some(key => JSON.stringify(existing[key]) !== JSON.stringify(incoming[key]))) throw fault("Bestehende Rückfragen dürfen nicht nachträglich verändert werden.", 409, "QUESTION_CONFLICT");
        if (!existing) questions.push({ ...incoming, answer: "", answeredAt: null });
      }
      if (questions.length > 200 || questions.filter(question => !question.obsolete && !question.answer).length > 20) throw fault("Höchstens 20 offene und 200 historische Rückfragen pro Auftrag.", 400, "QUESTION_LIMIT");
      if (data.requirements) addRequirements(jobId, data.requirements);
      const status = questions.some(questionOpen) ? "needs_info" : data.status || row.status;
      db.prepare("UPDATE documentation_jobs SET status=?,message=?,questions=?,updated_at=? WHERE id=?").run(status, data.message ?? row.message, JSON.stringify(questions), now(), jobId);
      addRequirements(jobId, get(userId, jobId).requirements);
    })();
    return get(userId, jobId);
  }
  function answer(userId, jobId, input) {
    const answers = parse(z.record(id, z.string().trim().max(2000)), input);
    db.transaction(() => {
      const row = job(userId, jobId);
      if (row.status === "closed") throw fault("Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
      const questions = JSON.parse(row.questions);
      if (Object.keys(answers).some(key => !questions.some(question => question.id === key))) throw fault("Unbekannte Rückfrage.", 400, "VALIDATION_ERROR");
      for (const question of questions) if (Object.hasOwn(answers, question.id) && !question.obsolete) { question.answer = answers[question.id]; question.answeredAt = now(); question.evidence = { kind: "gui", recordedBy: userId, recordedAt: now() }; }
      const status = questions.some(questionOpen) ? "needs_info" : "queued";
      db.prepare("UPDATE documentation_jobs SET questions=?,status=?,updated_at=? WHERE id=?").run(JSON.stringify(questions), status, now(), jobId);
    })();
  }
  function proposal(userId, jobId, proposalId) {
    const parent = job(userId, jobId); parse(id, proposalId);
    const row = db.prepare("SELECT * FROM document_proposals WHERE id=? AND job_id=?").get(proposalId, jobId);
    if (!row) throw fault("Dateivorschlag wurde nicht gefunden.", 404, "NOT_FOUND");
    return { parent, row };
  }
  function fileFor(userId, jobId, row) {
    return path.join(root, "storage/users", userId, "assistant", jobId, row.id + mimeExtensions[row.mime_type]);
  }
  async function propose(userId, jobId, metadata, upload) {
    const parent = job(userId, jobId), data = parse(documentInput, metadata);
    require('./fireProtectionPolicy').assertDocumentBinding(data, fault);
    if (data.supersedes.length && !data.expectedJobVersion) throw fault("Ablösungen benötigen die zuletzt gelesene Auftragsversion.", 428, "PRECONDITION_REQUIRED");
    const validateSupersedes = () => {
      for (const previousId of data.supersedes) {
        const previous = publicProposal(proposal(userId, jobId, previousId).row);
        if (previous.state !== "pending" || previous.requirementIds.some(key => !data.requirementIds.includes(key))) throw fault("Nur offene Vorgänger mit erhaltenen Dokumentanforderungen dürfen ersetzt werden.", 409, "SUPERSESSION_CONFLICT");
      }
    };
    const requirements = get(userId, jobId).requirements;
    if (data.requirementIds.some(key => !requirements.some(requirement => requirement.id === key))) throw fault("Unbekannte Dokumentanforderung.", 400, "UNKNOWN_REQUIREMENT");
    assertProposalScope(await readJson(dataFilesForProject(root, userId, parent.project_id).projekt, {}), jobId, requirements, data, fault);
    if (parent.status === "closed") throw fault("Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
    if (!upload?.buffer?.length || upload.buffer.length > MAX_BYTES) throw fault("Eine PDF- oder Bilddatei mit höchstens 15 MiB ist erforderlich.", 413, "FILE_LIMIT");
    const mime = detectAttachmentMime(upload.buffer);
    if (!mimeExtensions[mime]) throw fault("Der Dateiinhalt ist kein unterstütztes PDF oder Bild.", 415, "UNSUPPORTED_FILE");
    data.deviceReferences = referencesForDocument(data, requirements);
    await assertMaterialIncluded(userId,parent.project_id,data);
    if (data.deviceReferences.length) {
      const files = dataFilesForProject(root, userId, parent.project_id);
      resolveDeviceReferences(await readJson(files.geraetelisten, []), data.deviceReferences, data.category, mime);
    }
    if (data.projectDocument) {
      const matrix = await readJson(dataFilesForProject(root, userId, parent.project_id).dokumentenmatrix, []);
      if (data.projectDocument.documentId && !matrix.some(entry => entry.id === data.projectDocument.documentId && entry.aktiv && entry.formularart === "Text")) throw fault("Das Textkapitel ist nicht aktiv oder unterstützt keine Projekttexte.", 409, "DOCUMENT_TARGET_CHANGED");
    }
    if (mime === "application/pdf") {
      try { const pdf = await PDFDocument.load(upload.buffer); if (pdf.getPageCount() < 1 || pdf.getPageCount() > 1000) throw Error(); }
      catch { throw fault("Die PDF-Datei ist beschädigt, verschlüsselt oder zu umfangreich.", 415, "INVALID_PDF"); }
    }
    const digest = hash(upload.buffer);
    const duplicates = db.prepare("SELECT * FROM document_proposals WHERE job_id=? AND sha256=? ORDER BY created_at,id").all(jobId, digest);
    const withdrawn=duplicates.filter(row=>JSON.parse(row.metadata).withdrawal);
    const duplicate = duplicates.find(row=>!JSON.parse(row.metadata).withdrawal);
    if (duplicate) {
      const saved = JSON.parse(duplicate.metadata); delete saved.supersededBy;delete saved.withdrawal;delete saved.productVerification;delete saved.productVerificationPolicy;delete saved.withdrawnPredecessors;
      const previous = parse(documentInput, saved);
      previous.deviceReferences = referencesForDocument(previous, requirements);
      delete previous.expectedJobVersion;
      const comparable = { ...data }; delete comparable.expectedJobVersion;
      if (JSON.stringify(previous) !== JSON.stringify(comparable)) throw fault("Diese Datei wurde bereits mit anderen Metadaten eingereicht. Vorhandenen Vorschlag prüfen; Zuordnungen werden nicht still verändert.", 409, "PROPOSAL_CONFLICT");
      return publicProposal(duplicate);
    }
    if(withdrawn.length){
      const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de');
      const destination=value=>JSON.stringify([value.category,[...value.requirementIds].sort(),value.deviceReferences.map(ref=>[ref.listId,ref.position,normalized(ref.manufacturer),normalized(ref.model),normalized(ref.variant)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
      for(const old of withdrawn){
        const saved=JSON.parse(old.metadata);delete saved.withdrawal;delete saved.productVerification;delete saved.productVerificationPolicy;delete saved.withdrawnPredecessors;delete saved.supersededBy;
        const previous=parse(documentInput,saved);previous.deviceReferences=referencesForDocument(previous,requirements);
        delete previous.expectedJobVersion;const comparable={...data};delete comparable.expectedJobVersion;
        if(JSON.stringify(previous)===JSON.stringify(comparable))return publicProposal(old);
        if(destination(previous)===destination(data))throw fault('Zurückgezogene Datei nicht durch geänderte Beschriftungen erneut einreichen.',409,'PROPOSAL_CONFLICT');
      }
      if(!data.expectedJobVersion)throw fault('Ein neuer Gerätebezug nach Zurückziehen benötigt die aktuelle Auftragsversion.',428,'PRECONDITION_REQUIRED');
      if(require('./documentProposalStorageService').legacy(db))throw fault('Vorschlagsspeicher zuerst nach Sicherung getrennt prüfen und ausdrücklich aktualisieren.',409,'PROPOSAL_STORAGE_UPGRADE_REQUIRED');
      data.withdrawnPredecessors=withdrawn.map(row=>row.id);
    }
    if (data.expectedJobVersion) assertVersion(userId, jobId, data.expectedJobVersion);
    validateSupersedes();
    data.productVerificationPolicy=require('./productDocumentVerificationService').POLICY;
    let checked;
    if(verificationService.technical(data.category)){
      checked=await verificationService.check(userId,parent.project_id,jobId,data,upload.buffer);
      if(checked.report.state!=='matched')throw verificationService.blocked(checked.report);
      data.productVerification=checked.report;
    }
    if (db.prepare("SELECT count(*) n FROM document_proposals WHERE job_id=?").get(jobId).n >= 100) throw fault("Höchstens 100 Dateivorschläge pro Auftrag.", 409, "PROPOSAL_LIMIT");
    await checkStorage(userId, upload.buffer.length);
    const proposalId = "doc_" + crypto.randomBytes(12).toString("hex");
    const row = { id: proposalId, job_id: jobId, mime_type: mime };
    const file = fileFor(userId, jobId, row);
    await assertSafePath(root, file, { allowMissing: true });
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.writeFile(file, upload.buffer, { flag: "wx", mode: 0o600 });
    try {
      db.transaction(() => {
        if(checked?.revision)store.assertProjectRevision(root,userId,parent.project_id,checked.revision);
        if (data.expectedJobVersion) assertVersion(userId, jobId, data.expectedJobVersion);
        validateSupersedes();
        if (job(userId, jobId).status === "closed") throw fault("Auftrag ist abgeschlossen.", 409, "JOB_CLOSED");
        const currentRequirements = get(userId, jobId).requirements;
        for (const requirementId of data.requirementIds) {
          const current = currentRequirements.find(row => row.id === requirementId);
          const original = requirements.find(row => row.id === requirementId);
          if (!current || JSON.stringify(current) !== JSON.stringify(original)) throw fault('Brandschutzanforderung wurde zwischenzeitlich geändert.', 409, 'FIRESTOP_REQUIREMENT_CHANGED');
        }
        addRequirements(jobId, currentRequirements.filter(row => data.requirementIds.includes(row.id)));
        db.prepare("INSERT INTO document_proposals(id,job_id,metadata,filename,mime_type,bytes,sha256,created_at) VALUES(?,?,?,?,?,?,?,?)").run(proposalId, jobId, JSON.stringify(data), sanitizeFileName(upload.originalName || "Dokument"), mime, upload.buffer.length, digest, now());
        for (const previousId of data.supersedes) {
          const previous = proposal(userId, jobId, previousId).row;
          db.prepare("UPDATE document_proposals SET metadata=? WHERE id=?").run(JSON.stringify({ ...JSON.parse(previous.metadata), supersededBy: proposalId }), previousId);
        }
        db.prepare("UPDATE documentation_jobs SET status=CASE WHEN status='needs_info' THEN status ELSE 'review' END,updated_at=? WHERE id=?").run(now(), jobId);
      })();
    } catch (error) { await fs.unlink(file).catch(() => {}); throw error; }
    return publicProposal(proposal(userId, jobId, proposalId).row);
  }
  async function content(userId, jobId, proposalId) {
    const { row } = proposal(userId, jobId, proposalId);
    const file = await assertSafePath(root, fileFor(userId, jobId, row), { type: "file" });
    const stat = await fs.stat(file);
    if (stat.size !== row.bytes || stat.size > MAX_BYTES) throw fault("Die vorbereitete Datei hat sich verändert. Bitte neu einreichen.", 409, "FILE_CHANGED");
    const handle = await fs.open(file, "r");
    let bytes;
    try {
      const buffer = Buffer.alloc(row.bytes + 1);
      let size = 0;
      while (size < buffer.length) { const chunk = await handle.read(buffer, size, buffer.length - size, null); if (!chunk.bytesRead) break; size += chunk.bytesRead; }
      if (size !== row.bytes) throw fault("Die vorbereitete Datei hat sich verändert.", 409, "FILE_CHANGED");
      bytes = buffer.subarray(0, size);
    } finally { await handle.close(); }
    if (hash(bytes) !== row.sha256) throw fault("Die vorbereitete Datei hat sich verändert. Bitte neu einreichen.", 409, "FILE_CHANGED");
    return { bytes, document: publicProposal(row) };
  }
  function viewed(userId, jobId, proposalId, sha256) {
    const { row } = proposal(userId, jobId, proposalId);
    if (row.sha256 !== sha256) throw fault("Datei wurde verändert.", 409, "FILE_CHANGED");
    db.prepare("INSERT INTO document_review_views(proposal_id,user_id,sha256,viewed_at) VALUES(?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET sha256=excluded.sha256,viewed_at=excluded.viewed_at").run(proposalId, userId, sha256, now());
  }
  async function approve(userId, jobId, proposalId, { reviewed, sha256, revision, metadata }) {
    const { parent, row } = proposal(userId, jobId, proposalId);
    if (publicProposal(row).state !== "pending") throw fault("Über diesen Vorschlag wurde bereits entschieden oder er wurde ersetzt.", 409, "ALREADY_DECIDED");
    const view = db.prepare("SELECT sha256 FROM document_review_views WHERE proposal_id=? AND user_id=?").get(proposalId, userId);
    if (reviewed !== "on" || sha256 !== row.sha256 || view?.sha256 !== row.sha256) throw fault("Bitte zuerst die Datei öffnen, sichten und die Sichtung ausdrücklich bestätigen.", 409, "REVIEW_REQUIRED");
    const values = parse(approvalInput, metadata);
    values.deviceReferences ??= referencesForDocument(JSON.parse(row.metadata), get(userId, jobId).requirements);
    if (!store.projectDataRevision(root, userId, parent.project_id)) throw fault("Die Übernahme benötigt den aktivierten SQLite-Projektspeicher.", 409, "STORAGE_REQUIRED");
    store.assertProjectRevision(root, userId, parent.project_id, revision);
    const { bytes } = await content(userId, jobId, proposalId);
    const savedMetadata=JSON.parse(row.metadata);
    require('./fireProtectionPolicy').assertDocumentBinding(savedMetadata, fault);
    if((savedMetadata.productVerificationPolicy||savedMetadata.productVerification)&&verificationService.technical(values.category)){
      const checked=await verificationService.check(userId,parent.project_id,jobId,{...savedMetadata,...values},bytes);
      if(checked.report.state!=='matched')throw verificationService.blocked(checked.report);
    }
    await checkStorage(userId, bytes.length);
    const files = dataFilesForProject(root, userId, parent.project_id);
    const preparedContent = JSON.parse(row.metadata).projectDocument;
    assertProposalScope(await readJson(files.projekt, {}), jobId, get(userId, jobId).requirements, JSON.parse(row.metadata), fault);
    const internalOnly = Boolean(preparedContent && preparedContent.scope !== "documentation");
    const attachmentId = internalOnly ? null : "anh_" + proposalId;
    const fileName = attachmentId ? attachmentId + mimeExtensions[row.mime_type] : null;
    const target = attachmentId ? path.join(path.dirname(files.dataDir), "anhaenge", fileName) : null;
    if (target) {
      await assertSafePath(root, target, { allowMissing: true });
      await fs.mkdir(path.dirname(target), { recursive: true });
      // Ein nach Absturz übrig gebliebenes, noch nicht indexiertes Ziel darf nur identisch wiederverwendet werden.
      try { await fs.writeFile(target, bytes, { flag: "wx", mode: 0o600 }); }
      catch (error) { if (error.code !== "EEXIST" || hash(await fs.readFile(target)) !== row.sha256) throw error; }
    }
    await store.withProjectDataTransaction(async () => {
      store.assertProjectRevision(root, userId, parent.project_id, revision);
      assertProposalScope(await readJson(files.projekt, {}), jobId, get(userId, jobId).requirements, JSON.parse(row.metadata), fault);
      const attachments = await readJson(files.anhaenge, []);
      if (!Array.isArray(attachments)) throw fault("Die Anhangsliste ist ungültig.", 409, "INVALID_ATTACHMENTS");
      if (values.deviceReferences.length && !internalOnly) {
        const lists = await readJson(files.geraetelisten, []);
        linkDeviceDocuments(lists, values.deviceReferences, values.category, row.mime_type, attachmentId);
        await writeJson(files.geraetelisten, lists);
      }
      const defaults = defaultDocumentMetaForCategory(values.category);
      if (preparedContent) {
        const matrix = await readJson(files.dokumentenmatrix, []);
        if (!internalOnly && !matrix.some(entry => entry.id === preparedContent.documentId && entry.aktiv && entry.export && entry.formularart === "Text")) throw fault("Das Textkapitel hat sich geändert. Zuordnung erneut prüfen.", 409, "DOCUMENT_TARGET_CHANGED");
        const projectData = await readJson(files.projekt, {});
        if (internalOnly) {
          const internalKey = preparedContent.documentId || `internal-${proposalId}`;
          projectData.interneDokumente = { ...(projectData.interneDokumente || {}), [internalKey]: { ...preparedContent, sha256: row.sha256, approvedAt: now(), approvedBy: userId } };
        } else {
          for (const previous of attachments.filter(item => item.matrixDocumentId === preparedContent.documentId && item.export !== false)) {
            previous.export = false;
            previous.replacedByAttachmentId = attachmentId;
          }
          projectData.dokumentInhalte = { ...(projectData.dokumentInhalte || {}), [preparedContent.documentId]: { ...preparedContent, attachmentId, sha256: row.sha256, approvedAt: now(), approvedBy: userId } };
        }
        await writeJson(files.projekt, projectData);
      }
      if (!internalOnly) {
        attachments.push({ ...values, id: attachmentId, originalName: row.filename, fileName,
          ...(preparedContent ? { matrixDocumentId: preparedContent.documentId } : {}),
          relativePath: path.relative(root, target).split(path.sep).join("/"), mimeType: row.mime_type,
          size: row.bytes, kapitel: defaults.kapitel || "", sortierung: defaults.sortierung ?? null, export: true, uploadedAt: now(),
          assistantProvenance: { jobId, proposalId, sha256: row.sha256, ...JSON.parse(row.metadata), approvedBy: userId, approvedAt: now() } });
        await writeJson(files.anhaenge, attachments);
      }
      await upsertProjectFromData(root, userId, parent.project_id);
      store.onProjectDataCommit(() => {
        if (publicProposal(proposal(userId, jobId, proposalId).row).state !== 'pending') throw fault('Vorschlag ist nicht mehr offen.', 409, 'ALREADY_DECIDED');
        if (!db.prepare("UPDATE document_proposals SET state='approved',decided_at=?,decided_by=?,attachment_id=? WHERE id=? AND state='pending'").run(now(), userId, attachmentId, proposalId).changes) throw fault("Über diesen Vorschlag wurde bereits entschieden.", 409, "ALREADY_DECIDED");
        db.prepare("UPDATE documentation_jobs SET updated_at=? WHERE id=?").run(now(), jobId);
      });
    });
    return attachmentId;
  }
  function appendInstruction(userId, jobId, input) {
    const value = parse(z.object({ version: z.string().regex(/^[a-f0-9]{64}$/), kind: z.enum(['material','instruction']), text: z.string().trim().min(10).max(8000) }).strict(), input);
    db.transaction(() => {
      assertVersion(userId, jobId, value.version);
      const row = job(userId, jobId);
      if (row.status === 'closed') throw fault('Auftrag ist abgeschlossen.', 409, 'JOB_CLOSED');
      const instruction = row.instruction + '\n\n[' + (value.kind === 'material' ? 'Materialergänzung' : 'Benutzerauftrag') + ' · ' + now() + ']\n' + value.text;
      if (instruction.length > 30000) throw fault('Auftrag ist zu lang. Bitte einen weiteren Auftrag anlegen.', 400, 'VALIDATION_ERROR');
      db.prepare('UPDATE documentation_jobs SET instruction=?,updated_at=? WHERE id=?').run(instruction, now(), jobId);
    })();
  }
  function reject(userId, jobId, proposalId, reason) {
    if (reason !== undefined) reason = parse(z.string().trim().min(3).max(1000), reason);
    db.transaction(() => {
      if (publicProposal(proposal(userId, jobId, proposalId).row).state !== "pending") throw fault("Vorschlag ist nicht mehr offen.", 409, "ALREADY_DECIDED");
      if (reason) {
        const row = proposal(userId, jobId, proposalId).row;
        const metadata = { ...JSON.parse(row.metadata), rejectionReason: reason };
        db.prepare('UPDATE document_proposals SET metadata=? WHERE id=?').run(JSON.stringify(metadata), proposalId);
      }
      if (!db.prepare("UPDATE document_proposals SET state='rejected',decided_at=?,decided_by=? WHERE id=? AND state='pending'").run(now(), userId, proposalId).changes) throw fault("Über diesen Vorschlag wurde bereits entschieden.", 409, "ALREADY_DECIDED");
      db.prepare("UPDATE documentation_jobs SET updated_at=? WHERE id=?").run(now(), jobId);
    })();
  }
  function close(userId, jobId) {
    db.transaction(() => {
      const row = job(userId, jobId);
      if (get(userId, jobId).documents.some(document => document.state === "pending")) throw fault("Bitte zuerst über alle Dateivorschläge entscheiden.", 409, "REVIEW_REQUIRED");
      if (JSON.parse(row.questions).some(questionOpen)) throw fault("Es sind noch erforderliche Rückfragen offen.", 409, "ANSWERS_REQUIRED");
      addRequirements(jobId, get(userId, jobId).requirements);
      db.prepare("UPDATE documentation_jobs SET status='closed',updated_at=? WHERE id=?").run(now(), jobId);
    })();
  }
  async function assertMaterialIncluded(userId,projectId,data){
    if(!['Datenblätter','Bedienungsanleitungen'].includes(data.category))return;
    const files=dataFilesForProject(root,userId,projectId),project=await readJson(files.projekt,{});
    const policy=require('./documentationMaterialPolicy');
    const lists=await readJson(files.geraetelisten,[]);
    for(const ref of data.deviceReferences||[]){
      const list=lists.find(item=>item.id===ref.listId),rows=list?.positionen.filter((row,index)=>Number(row.pos||index+1)===ref.position)||[];
      if(rows.length===1)policy.assertIncluded(rows[0],project);
    }
  }
  async function manufacturerDocument(userId,jobId,raw){
    const {manufacturerDocumentInput}=require('../src/api/productDocumentSchemas');
    const {mode,metadata}=parse(manufacturerDocumentInput,raw),parent=job(userId,jobId);
    if(parent.status==='closed')throw fault('Auftrag ist abgeschlossen.',409,'JOB_CLOSED');
    if(!verificationService.technical(metadata.category))throw fault('Dieser Weg gilt für Datenblätter und Bedienungs-/Montageanleitungen.',400,'INVALID_CATEGORY');
    if(metadata.expectedJobVersion)assertVersion(userId,jobId,metadata.expectedJobVersion);
    metadata.deviceReferences=referencesForDocument(metadata,get(userId,jobId).requirements);
    await assertMaterialIncluded(userId,parent.project_id,metadata);
    const checked=await verificationService.check(userId,parent.project_id,jobId,metadata);
    if(mode==='check')return {state:checked.report.state,verification:require('./productDocumentVerificationService').compactVerification(checked.report),proposalCreated:false};
    if(checked.report.state!=='matched')throw verificationService.blocked(checked.report);
    const result=await propose(userId,jobId,metadata,{buffer:checked.bytes,originalName:'Hersteller-'+checked.report.sha256.slice(0,16)+'.pdf'});
    return {...Object.fromEntries(['id','jobId','title','category','state','bytes','sha256','attachmentId','productVerification'].map(k=>[k,result[k]])),
      deviceReferences:result.deviceReferences.slice(0,3),deviceReferenceCount:result.deviceReferences.length,
      requirementIds:result.requirementIds.slice(0,3),requirementCount:result.requirementIds.length};
  }
  return { manufacturerDocument, appendInstruction, project, job, list, get, create, update, correctRequirement, answer, recordAnswers, replaceProposals, withdrawProposals, assertVersion, proposal, propose, content, viewed, approve, reject, close };
}
module.exports = { createDocumentAssistantService };
