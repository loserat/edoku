const crypto = require("node:crypto");
const fs = require("node:fs");
const { loadProjectWorkspace } = require("./projectWorkspaceService");
const { buildExportliste } = require("./exportService");
const { filterExportGeraetelisten, summarizeExportEntries } = require("./documentationPlanService");
const { deviceListFieldsForLeistungsbereich } = require("./geraetelistenService");
const { BRANDSCHUTZ_REQUIRED_FIELDS } = require("./brandschutzService");
const { resolveAttachmentFile } = require("./attachmentService");
const { createDocumentAssistantService } = require("./documentAssistantService");
const { connection } = require("./dbService");
const store = require("./projectDataStoreService");
const { fault, parse } = require("../src/api/validation");
const { query: statusQuery } = require('../src/api/statusSchemas');
const { readinessView } = require('./statusQueryService');
const { resolveDeviceReferences, documentFields, referenceKey, requirementDevices } = require("./deviceDocumentService");
const { requirementScope, internalProposal } = require('./requirementScopeService');
const { createDatasheetCoverageService } = require('./datasheetCoverageService');
const { firestopRequirements, POLICY: FIRESTOP_POLICY } = require('./firestopDocumentationService');
const { buildKnowledge } = require('./knowledgeService');

const projectFields = {
  projektname: "Projektname", projektnummer: "Projektnummer", auftraggeber: "Auftraggeber",
  liegenschaft: "Liegenschaft", baumassnahme: "Baumaßnahme"
};
const present = value => typeof value === "string" && value.trim().length > 0;
const same = (a, b) => String(a || "").trim().toLocaleLowerCase("de") === String(b || "").trim().toLocaleLowerCase("de");
async function sha256File(file, expectedBytes, { maxBytes = 15 * 1024 * 1024 } = {}) {
  const hash = crypto.createHash("sha256");
  let size = 0;
  const stream = fs.createReadStream(file);
  try {
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > expectedBytes || size > maxBytes) throw Error("FILE_SIZE");
      hash.update(chunk);
    }
    if (size !== expectedBytes) throw Error("FILE_SIZE");
    return hash.digest("hex");
  } finally { stream.destroy(); }
}

function createDocumentationReadinessService(root, { db = connection() } = {}) {
  const assistant = createDocumentAssistantService(root, { db });
  async function inspect(userId, projectId, { assistantJobId = null, data: workspace, datasheetCoverage } = {}) {
    return store.withProjectDataTransaction(async () => {
      const data = workspace || await loadProjectWorkspace(root, userId, projectId);
      const revision = store.projectDataRevision(root, userId, projectId);
      const issues = [], questions = [];
      const add = (code, scope, message, details = {}, prompt = "") => {
        const key = `${code}:${scope}`;
        issues.push({ code, key, message, ...details });
        if (prompt) questions.push({ id: "q_" + crypto.createHash("sha256").update(key).digest("hex").slice(0, 20), prompt, required: true, issueKey: key });
      };
      if (!revision) add("STORAGE_REQUIRED", "storage", "Für einen fortsetzbaren Export muss der SQLite-Projektspeicher aktiviert sein.");
      for (const [field, label] of Object.entries(projectFields)) if (!present(data.projekt[field])) add("PROJECT_FIELD_MISSING", field, `${label} fehlt.`, { field }, `Bitte ${label} für dieses Projekt angeben.`);
      if (!data.leistungsbereiche.aktiv.length) add("SERVICE_AREA_MISSING", "areas", "Es ist kein Leistungsbereich ausgewählt.", {}, "Welche Leistungsbereiche gehören zu dieser Dokumentation?");
      for (const entry of data.matrix) if (entry.pflicht && (!entry.aktiv || entry.export === false)) add("REQUIRED_DOCUMENT_EXCLUDED", entry.id, `Pflichteintrag ist von der Ausgabe ausgeschlossen: ${entry.titel}.`, { documentId: entry.id });
      const allLists = filterExportGeraetelisten(data.geraetelisten, data.leistungsbereiche);
      const material=require('./materialImportService').summary(data);
      if(material.source==='material_list'&&material.recording!=='complete')add('MATERIAL_IMPORT_INCOMPLETE','material-import','Die deklarierte Materialquelle wurde noch nicht vollständig erfasst.');
      if(material.source==='material_list'&&material.open)add('MATERIAL_ASSIGNMENT_OPEN','material-assignment',`${material.open} Materialpositionen sind noch nicht eindeutig zugeordnet.`);
      const lists = filterExportGeraetelisten(data.geraetelisten, data.leistungsbereiche, data.projekt);
      // Only explicitly configured customer documentation requires native chapter content.
      // Legacy projects and internal working notes retain their existing export behavior.
      if (data.projekt.assistantWorkflow?.documentScope === 'documentation' && (!assistantJobId || data.projekt.assistantWorkflow.jobId === assistantJobId)) {
        for (const entry of data.matrix.filter(item => item.aktiv && item.export !== false && item.formularart === 'Text')) {
          const content = data.projekt.dokumentInhalte?.[entry.id];
          if (content?.scope !== 'documentation' || !data.anhaenge.some(item => item.id === content.attachmentId && item.matrixDocumentId === entry.id && item.export !== false && item.assistantProvenance?.sha256 === content.sha256)) add('CHAPTER_CONTENT_MISSING', entry.id, `Projektbezogener Inhalt fehlt: ${entry.titel}.`, { documentId: entry.id });
        }
      }
      for (const list of lists) {
        if (!list.positionen.length) add("DEVICE_LIST_EMPTY", list.id, `Die Geräteliste ${list.titel} enthält keine Positionen.`, { listId: list.id });
        const required = deviceListFieldsForLeistungsbereich(list.leistungsbereich).filter(field => field.required);
        for (const [index, position] of list.positionen.entries()) {
          if(require('./documentationMaterialPolicy').historicalSample(position))continue;
          const pos = Number(position.pos || index + 1);
          for (const field of required) if (!present(position[field.name])) add("DEVICE_FIELD_MISSING", `${list.id}:${pos}:${field.name}`, `${field.label} fehlt in ${list.titel}, Position ${pos}.`, { listId: list.id, position: pos, field: field.name }, `Welcher Wert für ${field.label} gehört zu ${list.titel}, Position ${pos}?`);
        }
      }
      if (data.leistungsbereiche.aktiv.includes("Brandschutzabschottungen")) {
        const entries = data.brandschutz.filter(entry => entry.aktiv);
        if (!entries.length) add("FIRESTOPS_MISSING", "firestops", "Für den aktiven Brandschutzbereich wurden keine Schottungen erfasst.");
        for (const entry of entries) for (const field of BRANDSCHUTZ_REQUIRED_FIELDS) if (!present(entry[field])) add("FIRESTOP_FIELD_MISSING", `${entry.id}:${field}`, `Brandschutzangabe ${field} fehlt.`, { entryId: entry.id, field });
      }
      const jobs = assistantJobId ? [assistant.get(userId, assistantJobId)] : assistant.list(userId, projectId).filter(job => job.status !== "closed").map(job => assistant.get(userId, job.id));
      const activeRows=allLists.flatMap(list=>list.positionen);
      if(jobs.length&&activeRows.length&&activeRows.every(require('./documentationMaterialPolicy').historicalSample))add('MATERIAL_SCOPE_UNCONFIRMED','historical-inventory','Der Gerätebestand enthält ausschließlich gekennzeichnete Muster. Tatsächliche Materialbasis klären.');
      if(jobs.length&&material.source==='material_list_required')add('MATERIAL_SOURCE_MISSING','material-source','Die beauftragte Materialliste fehlt noch.');
      if (jobs.some(job => job.projectId !== projectId)) throw fault("Auftrag wurde nicht gefunden.", 404, "NOT_FOUND");
      const pending = [], requirements = [];
      let firestopMissing = 0;
      if (!jobs.length) for (const rule of firestopRequirements(data)) {
        firestopMissing++;
        add('FIRESTOP_REQUIREMENT_MISSING', rule.definition.id, `Brandschutz-Pflichtunterlage fehlt: ${rule.definition.title}.`, { definition: rule.definition });
      }
      for (const job of jobs) {
        const firestopRules = firestopRequirements(data, job.requirements);
        const firestopIds = new Set(firestopRules.map(rule => rule.requirementId).filter(Boolean));
        for (const rule of firestopRules.filter(rule => !rule.requirementId)) {
          firestopMissing++;
          add('FIRESTOP_REQUIREMENT_MISSING', `${job.id}:${rule.definition.id}`, `Brandschutz-Pflichtunterlage fehlt: ${rule.definition.title}.`, { jobId: job.id, definition: rule.definition });
        }
        for (const question of job.questions) if (question.required && !present(question.answer) && !question.obsolete && require('./materialImportService').questionRelevant(data,question)) add("ANSWER_REQUIRED", `${job.id}:${question.id}`, question.prompt, { jobId: job.id, questionId: question.id });
        for (const document of job.documents) if (document.state === "pending") pending.push({ jobId: job.id, proposalId: document.id, title: document.title });
        for (const document of job.documents.filter(item => item.state === "approved")) {
          const attachment = data.anhaenge.find(item => item.id === document.attachmentId);
          if (!attachment?.deviceReferences?.length) continue;
          try {
            const targets = resolveDeviceReferences(data.geraetelisten, attachment.deviceReferences, attachment.category, attachment.mimeType);
            if (targets.some(target => target.position[documentFields[attachment.category]] !== attachment.id)) throw Error("UNLINKED_DEVICE_DOCUMENT");
          } catch {
            add("DEVICE_DOCUMENT_CHANGED", `${job.id}:${document.id}`, `Die Geräteverknüpfung für ${document.title} passt nicht mehr. Gerät und Unterlage erneut prüfen.`, { jobId: job.id, proposalId: document.id });
          }
        }
        for (const requirement of job.requirements) {
          const scope = firestopIds.has(requirement.id) ? 'documentation' : requirementScope(data.projekt, job.id, requirement);
          if(require('./documentationMaterialPolicy').historicalRequirement(data,requirement)){
            requirements.push({...requirement,jobId:job.id,scope,applicable:false,fulfilled:false,fulfilledBy:null,exclusionReason:'historical_example'});
            continue;
          }
          if(require('./documentationMaterialPolicy').excludedRequirement(data,requirement)){
            requirements.push({...requirement,jobId:job.id,scope,applicable:false,fulfilled:false,fulfilledBy:null,exclusionReason:'material_policy'});
            continue;
          }
          // Retain historical policy rows, but do not require an inactive/replaced system.
          if (requirement.firestop && !firestopIds.has(requirement.id)) {
            requirements.push({ ...requirement, jobId: job.id, scope, applicable: false, fulfilled: false, fulfilledBy: null });
            continue;
          }
          if (scope === 'internal') {
            let fulfilledBy = null;
            for (const candidate of job.documents.filter(document => document.state === 'approved' && !require('./fireProtectionPolicy').workingDeclaration(document) && internalProposal(document) && document.requirementIds.includes(requirement.id))) {
              const stored = Object.values(data.projekt.interneDokumente || {}).some(note => note.sha256 === candidate.sha256 && note.approvedBy === userId && note.scope === 'internal');
              if (!stored) continue;
              try { await assistant.content(userId, job.id, candidate.id); fulfilledBy = candidate.id; break; } catch { /* Missing or changed internal originals remain incomplete. */ }
            }
            requirements.push({ ...requirement, jobId: job.id, scope, fulfilled: Boolean(fulfilledBy), fulfilledBy });
            continue;
          }
          const devices = requirementDevices(requirement);
          const deviceMatches = devices.every(device => {
            const list = allLists.filter(item => item.id === device.listId);
            const positions = list.length === 1 ? list[0].positionen.filter((position, index) => Number(position.pos || index + 1) === device.position) : [];
            return positions.length === 1 && same(positions[0].hersteller, device.manufacturer) && same(positions[0].typ, device.model)
              && (device.variant === undefined || same(device.variant, [positions[0].abmessung, positions[0].farbe].filter(Boolean).join(' · ')));
          });
          if (!deviceMatches) add("DEVICE_REFERENCE_CHANGED", `${job.id}:${requirement.id}`, `Die Gerätezuordnung für ${requirement.title} passt nicht zum aktuellen Projektstand.`, { jobId: job.id, requirementId: requirement.id });
          let fulfilledBy = null;
          // Für die Kategorie gilt die vom Benutzer freigegebene Anhangszuordnung.
          for (const candidate of job.documents.filter(document => document.state === "approved" && !require('./fireProtectionPolicy').workingDeclaration(document) && devices.every(device => !device.revision || same(document.documentRevision, device.revision)))) {
            const attachment = data.anhaenge.find(item => {
              if (item.id !== candidate.attachmentId || item.export === false) return false;
              if (item.category === requirement.category) return true;
              // Legacy jobs sometimes filed a specifically named datasheet as Nachweise.
              // Reclassifying that same manually approved original must not lose its
              // explicit requirement binding. Never generalize this to other evidence.
              return requirement.category === 'Nachweise' && /datenblatt/i.test(requirement.title)
                && candidate.category === 'Nachweise' && candidate.requirementIds?.includes(requirement.id)
                && item.category === 'Datenblätter' && item.mimeType === 'application/pdf'
                && item.deviceReferences?.length > 0;
            });
            // An original already manually approved for this exact device can be reused
            // after a verified explicit device link, without changing proposal metadata.
            const linkedOriginal = devices.length > 0 && documentFields[requirement.category] && devices.every(device => attachment?.deviceReferences?.some(reference => referenceKey(reference) === referenceKey(device) && same(reference.manufacturer, device.manufacturer) && same(reference.model, device.model)));
            if (!candidate.requirementIds?.includes(requirement.id) && !linkedOriginal) continue;
            if (!attachment) continue;
            if (devices.length && documentFields[attachment.category]) {
              try {
                const expected = resolveDeviceReferences(data.geraetelisten, devices, attachment.category, attachment.mimeType);
                if (expected.some(({position,reference:device}) => position[documentFields[attachment.category]] !== attachment.id || !attachment.deviceReferences?.some(reference => referenceKey(reference) === referenceKey(device) && same(reference.manufacturer, device.manufacturer) && same(reference.model, device.model)))) continue;
              } catch { continue; }
            }
            try {
              const file = await resolveAttachmentFile(root, data.files, attachment.relativePath);
              if (await sha256File(file, candidate.bytes) === candidate.sha256) { fulfilledBy = candidate.id; break; }
            } catch { /* Eine fehlende oder veränderte Quelle erfüllt keine Anforderung. */ }
          }
          requirements.push({ ...requirement, jobId: job.id, scope, fulfilled: Boolean(fulfilledBy && deviceMatches), fulfilledBy });
          if (!fulfilledBy) add("REQUIRED_DOCUMENT_MISSING", `${job.id}:${requirement.id}`, `Freigegebene Unterlage fehlt: ${requirement.title}.`, { jobId: job.id, requirementId: requirement.id, category: requirement.category });
        }
      }
      for (const job of jobs) {
        const knowledge = buildKnowledge(data, job, { requirements: requirements.filter(row => row.jobId === job.id) });
        for (const node of knowledge.dependencies.filter(node => node.requirementId && !node.ready && !requirements.some(row=>row.jobId===job.id&&row.id===node.requirementId&&row.scope==='internal'))) add('FACT_DEPENDENCY_MISSING', `${job.id}:${node.requirementId}`, `Bestätigte Voraussetzungen fehlen: ${node.title}.`, { jobId: job.id, requirementId: node.requirementId, missingFacts: node.missingFacts });
      }
      const entries = await buildExportliste(root, data.projekt, data.matrix, data.files.exportliste, data.projektSysteme, data.anhaenge, data.geraetelisten, data.leistungsbereiche, { persist: false, brandschutz: data.brandschutz });
      const exportSummary = summarizeExportEntries(entries);
      for (const warning of entries.flatMap(entry => entry.photoWarnings || [])) add("PHOTO_SOURCE_MISSING", warning.id || warning.relativePath, warning.message || "Ein benötigtes Brandschutzfoto fehlt.");
      const missingOutputs = entries.filter(entry => entry.requiresFile !== false && entry.status !== "vorhanden").map(entry => ({ id: entry.id, title: entry.titel, status: entry.status, required: Boolean(entry.pflicht), reason: entry.fehler || "Noch nicht erzeugt oder Quelle nicht vorhanden." }));
      const hasExports = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documentation_exports'").get();
      const latest = hasExports && revision ? db.prepare("SELECT id,result FROM documentation_exports WHERE user_id=? AND project_id=? AND state='succeeded' AND input_revision=? AND (? IS NULL OR assistant_job_id=?) ORDER BY updated_at DESC,id DESC LIMIT 1").get(userId, projectId, revision, assistantJobId, assistantJobId) : null;
      const latestResult = latest ? JSON.parse(latest.result) : null;
      const currentSourcesInvalid = entries.some(entry => entry.attachmentId && entry.status !== "vorhanden");
      const currentExport = latestResult?.summary?.complete && !currentSourcesInvalid ? latestResult.summary : exportSummary;
      datasheetCoverage ||= await createDatasheetCoverageService(root).inspect(userId, projectId, { data });
      return {
        projectId, revision: revision || null, canGenerate: issues.length === 0 && pending.length === 0,
        inputComplete: issues.length === 0, reviewComplete: pending.length === 0,
        technicalExportComplete: issues.length === 0 && pending.length === 0 && currentExport.complete,
        professionalApproval: "not_assessed", issues, suggestedQuestions: questions, pendingDocuments: pending, requirements,
        firestopDocumentation: { policy: FIRESTOP_POLICY, active: data.leistungsbereiche.aktiv.includes('Brandschutzabschottungen'), missingRequirements: firestopMissing },
        datasheets: datasheetCoverage.summary,
        export: { ...currentExport, missingOutputs: latestResult?.summary?.complete && !currentSourcesInvalid ? [] : missingOutputs, latestExportId: latest?.id || null }
      };
    });
  }
  async function query(userId, projectId, raw = {}) {
    return store.withProjectDataTransaction(async () => {
      const options = parse(statusQuery, raw);
      const jobVersion = options.assistantJobId ? assistant.get(userId, options.assistantJobId).version : null;
      const result = await inspect(userId, projectId, options);
      if (jobVersion) assistant.assertVersion(userId, options.assistantJobId, jobVersion);
      return readinessView(result, options, jobVersion);
    });
  }
  return { inspect, query };
}
module.exports = { createDocumentationReadinessService, sha256File };
