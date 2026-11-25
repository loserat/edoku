const { buildWorkspace } = require('../../services/assistantWorkspaceService');
const { compareReviewDocuments, reviewNavigation } = require('../../services/assistantReviewNavigation');
const { createDocumentWorkService } = require('../../services/documentWorkService');
const express = require("express");
const path = require("node:path");
const { requireAuth } = require("../../services/authService");
const { createDocumentAssistantService } = require("../../services/documentAssistantService");
const { readJson, writeJson } = require("../../services/jsonService");
const { mergeSystemSettings, DEFAULT_SYSTEM_SETTINGS } = require("../../services/settingsService");
const store = require("../../services/projectDataStoreService");
const { categories } = require("../api/assistantSchemas");
const { createDocumentationReadinessService } = require("../../services/documentationReadinessService");
const { createIdempotencyService } = require("../../services/idempotencyService");
const { connection, getCurrentProjectId } = require("../../services/dbService");
const crypto = require("node:crypto");
const { dataFilesForProject } = require("../../services/projectArchiveService");
const { deviceReferenceOptions, referencesForDocument, referenceKey } = require("../../services/deviceDocumentService");
const { fault } = require("../api/validation");
const { createDocumentationWorkflowService } = require('../../services/documentationWorkflowService');
const { createDatasheetCoverageService } = require('../../services/datasheetCoverageService');
const { states: datasheetStates } = require('../api/datasheetSchemas');
const wrap = work => (req, res, next) => Promise.resolve().then(() => work(req, res)).catch(next);

function createDocumentAssistantRouter({ root, audit, exportJobs, checkStorage }) {
  const router = express.Router({ caseSensitive: true, strict: true });
  const service = createDocumentAssistantService(root, { checkStorage });
  const readiness = createDocumentationReadinessService(root);
  const workflow = createDocumentationWorkflowService(root);
  const datasheets = createDatasheetCoverageService(root);
  const documentWork = createDocumentWorkService(root);
  const operations = createIdempotencyService(connection());
  const viewVersion = (job, runs, revision) => crypto.createHash("sha256").update(JSON.stringify([job.version, revision, runs.map(run => [run.id, run.state, run.updatedAt])])).digest("hex");
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) && req.user.role === "viewer") return res.status(403).send("Lesekonten dürfen keine Aufträge oder Freigaben ändern.");
    next();
  });
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.locals.flash = { success: req.query.success || "", error: req.query.error || "", warning: "" };
    res.locals.compareReviewDocuments = compareReviewDocuments;
    readJson(path.join(root, "config/systemEinstellungen.json"), DEFAULT_SYSTEM_SETTINGS).then(value => { res.locals.systemSettings = mergeSystemSettings(value); next(); }, next);
  });
  const pdfAssets = path.dirname(require.resolve("pdfjs-dist/package.json"));
  router.get("/viewer/pdf.mjs", (_req, res) => res.type("application/javascript").sendFile(path.join(pdfAssets, "build/pdf.min.mjs")));
  router.get("/viewer/pdf.worker.mjs", (_req, res) => res.type("application/javascript").sendFile(path.join(pdfAssets, "build/pdf.worker.min.mjs")));
  router.use("/viewer/fonts", express.static(path.join(pdfAssets, "standard_fonts"), { index: false, redirect: false, dotfiles: "deny" }));
  // Projektwechsel erfolgen ausschließlich in der regulären Projektverwaltung.
  router.use((req, res, next) => {
    try {
      const projectId = getCurrentProjectId(req.user.id);
      if (!projectId) throw fault('Bitte zuerst ein Projekt in der Projektverwaltung öffnen.', 409, 'ACTIVE_PROJECT_REQUIRED');
      service.project(req.user.id, projectId);
      req.assistantProjectId = projectId;
      res.locals.currentProjectId = projectId;
      if (req.method === 'POST' && req.body.projectId && req.body.projectId !== projectId) throw fault('Das Formular gehört nicht zum aktuell geöffneten Projekt. Bitte den Assistenten neu öffnen.', 409, 'ACTIVE_PROJECT_CHANGED');
      next();
    } catch (error) { next(error); }
  });
  router.param('jobId', (req, _res, next, jobId) => {
    try {
      if (service.job(req.user.id, jobId).project_id !== req.assistantProjectId) throw fault('Auftrag ist im aktuell geöffneten Projekt nicht verfügbar.', 404, 'NOT_FOUND');
      next();
    } catch (error) { next(error); }
  });
  router.param('projectId', (req, _res, next, projectId) => {
    if (projectId !== req.assistantProjectId) return next(fault('Datei ist im aktuell geöffneten Projekt nicht verfügbar.', 404, 'NOT_FOUND'));
    next();
  });
  const auditAction = event => (req, res, next) => {
    try {
      if (req.params.jobId) req.user.currentProjectId = service.job(req.user.id, req.params.jobId).project_id;
      else if (req.body.projectId) { service.project(req.user.id, req.body.projectId); req.user.currentProjectId = req.body.projectId; }
      req.assistantAuditEvent = event;
      audit.middleware(req, res, next);
    } catch (error) { next(error); }
  };
  const jobLink = id => `/assistent/auftraege/${id}`;
  function dashboardSnapshot(userId, jobs, projectId) {
    const versions = jobs.map(job => [job.id, job.updatedAt, job.status, store.projectDataRevision(root, userId, job.projectId),
      exportJobs.list(userId, job.projectId).filter(run => run.assistantJobId === job.id).map(run => [run.id, run.state, run.updatedAt])]);
    return crypto.createHash('sha256').update(JSON.stringify([projectId, versions])).digest('hex');
  }
  const wantsJson = req => /application\/json/i.test(req.get('accept') || '');
  async function reviewView(req,res,selected,review){
    const files=dataFilesForProject(root,req.user.id,req.assistantProjectId);
    const [project,lists]=await Promise.all([readJson(files.projekt,{}),readJson(files.geraetelisten,[])]);
    const activeProject={...project,id:req.assistantProjectId},revision=store.projectDataRevision(root,req.user.id,req.assistantProjectId);
    res.locals.currentProjectName=project.projektname||activeProject.id;res.locals.currentProjectNumber=project.projektnummer||'';
    const runs=exportJobs.list(req.user.id,activeProject.id).filter(x=>x.assistantJobId===selected.id);
    const values={activeProject,selected,review,nextReview:reviewNavigation(selected.documents,review.id).next,panel:req.query.panel==='1',active:'assistent',revision,categories,deviceOptions:deviceReferenceOptions(lists),reviewReferences:referencesForDocument(review,selected.requirements),referenceKey,pending:selected.documents.filter(x=>x.state==='pending').sort(compareReviewDocuments),viewVersion:viewVersion(selected,runs,revision),section:'uebersicht'};
    if(req.query.fragment==='review')return res.render('partials/assistantReview',values,(error,html)=>error?res.status(500).json({ok:false,message:"Prüfansicht konnte nicht geladen werden."}):res.json({ok:true,projectId:activeProject.id,jobId:selected.id,proposalId:review.id,state:review.state,revision,viewVersion:values.viewVersion,html}));
    return res.render('assistent',values);
  }
  function decisionResponse(req,res,state,message){
    const current=service.get(req.user.id,req.params.jobId);
    const navigation=reviewNavigation(current.documents,req.params.proposalId);
    const next=req.body.continueReview==='0'?null:navigation.next;
    // The project middleware commits before sending JSON. The following GET gets the new revision.
    if(wantsJson(req))return res.json({ok:true,projectId:req.assistantProjectId,jobId:current.id,proposalId:req.params.proposalId,state,nextUrl:next?jobLink(current.id)+'/dateien/'+next.id:null,earlierPending:navigation.earlierPending,remainingPending:navigation.remainingPending});
    const target=next?jobLink(current.id)+'/dateien/'+next.id:jobLink(current.id);
    return res.redirect(target+'?'+(req.body.panel==='1'?'panel=1&':'')+'success='+encodeURIComponent(message));
  }
  async function view(req, res, review = null) {
    const selected = req.params.jobId ? service.get(req.user.id, req.params.jobId) : null;
    if(review)return reviewView(req,res,selected,review);
    const projectId = req.assistantProjectId;
    const activeProject = { ...await readJson(dataFilesForProject(root, req.user.id, projectId).projekt, {}), id: projectId };
    const projects = [activeProject];
    res.locals.currentProjectName = activeProject.projektname || projectId;
    res.locals.currentProjectNumber = activeProject.projektnummer || '';
    const jobs = service.list(req.user.id, projectId);
    const sections = selected ? ['uebersicht', 'dateien', 'datenblaetter', 'angaben', 'export', 'verlauf'] : ['uebersicht', 'dateien', 'datenblaetter', 'export', 'verlauf', 'auftraege'];
    const section = sections.includes(req.query.ansicht) ? req.query.ansicht : 'uebersicht';
    const coverageFilter = ['all', 'open', ...datasheetStates].includes(req.query.deckung) ? req.query.deckung : 'open';
    const coverageCache = new Map();
    const coverageFor = projectId => {
      if (!coverageCache.has(projectId)) coverageCache.set(projectId, datasheets.inspect(req.user.id, projectId));
      return coverageCache.get(projectId);
    };
    const scopeProject = projectId;
    const dashboard = !selected ? await Promise.all(jobs.filter(job => job.status !== 'closed' && (!scopeProject || job.projectId === scopeProject)).map(async summary => {
      const job = service.get(req.user.id, summary.id);
      const datasheetCoverage = await coverageFor(job.projectId);
      const projectReadiness = await readiness.inspect(req.user.id, job.projectId, { assistantJobId: job.id, datasheetCoverage });
      const pending = job.documents.filter(document => document.state === 'pending');
      const approved = job.documents.filter(document => document.state === 'approved');
      const openQuestions = job.questions.filter(question => !question.obsolete && !question.answer);
      const proposed = new Set(pending.flatMap(document => document.requirementIds || []));
      const missing = projectReadiness.requirements.filter(item => item.applicable !== false && !item.fulfilled && item.scope !== 'internal' && !proposed.has(item.id));
      const agentIssues = projectReadiness.issues.filter(issue => !['ANSWER_REQUIRED', 'REQUIRED_DOCUMENT_MISSING'].includes(issue.code));
      const workItems = (await documentWork.inspect(req.user.id, job.projectId, job.id, { limit: 1000 })).items;
      return { job, workItems, revision: store.projectDataRevision(root, req.user.id, job.projectId), exportRuns: exportJobs.list(req.user.id, job.projectId).filter(run => run.assistantJobId === job.id), project: projects.find(project => project.id === job.projectId), projectReadiness, pending, approved, openQuestions, agentIssues, datasheetCoverage,
        openCount: pending.length + openQuestions.length + missing.length + agentIssues.length + (datasheetCoverage.summary.complete ? 0 : 1) };
    })) : [];
    if (selected) {
      const project = projects.find(project => project.id === selected.projectId);
      res.locals.currentProjectName = project?.projektname || selected.projectId;
    }
    const revision = selected ? store.projectDataRevision(root, req.user.id, selected.projectId) : "";
    const exportRuns = selected ? exportJobs.list(req.user.id, selected.projectId).filter(run => run.assistantJobId === selected.id) : [];
    const workflowPlan = selected && !review ? await workflow.inspect(req.user.id, selected.projectId, { jobId: selected.id, includeDatasheets: true }) : null;
    const datasheetCoverage = workflowPlan?.datasheetDetails || null;
    const projectReadiness = selected ? await readiness.inspect(req.user.id, selected.projectId, { assistantJobId: selected.id, datasheetCoverage }) : null;
    const deviceOptions = selected ? deviceReferenceOptions(await readJson(dataFilesForProject(root, req.user.id, selected.projectId).geraetelisten, [])) : [];
    const reviewReferences = review ? referencesForDocument(review, selected.requirements) : [];
    const stateOrder = { pending: 0, approved: 1, rejected: 2 };
    const fileFilter = ['pending', 'approved', 'all'].includes(req.query.filter) ? req.query.filter : 'pending';
    const pending = selected?.documents.filter(document => document.state === 'pending') || [];
    const approved = selected?.documents.filter(document => document.state === 'approved') || [];
    const openQuestions = selected?.questions.filter(question => !question.obsolete && !question.answer) || [];
    const agentIssues = projectReadiness?.issues.filter(issue => !['ANSWER_REQUIRED', 'REQUIRED_DOCUMENT_MISSING'].includes(issue.code)) || [];
    const shownDocuments = selected?.documents.filter(document => ['pending', 'approved'].includes(document.state) && (section === 'uebersicht' ? document.state === 'pending' : fileFilter === 'all' || document.state === fileFilter)) || [];
    const documentGroups = selected ? categories.map(category => ({
      category,
      documents: shownDocuments.filter(document => document.category === category).sort((a, b) =>
        stateOrder[a.state] - stateOrder[b.state] || compareReviewDocuments(a,b))
    })).filter(group => group.documents.length) : [];
    const entries = selected ? [{ job: selected, project: projects.find(p => p.id === selected.projectId), pending, approved, openQuestions, agentIssues, projectReadiness, datasheetCoverage: datasheetCoverage || await coverageFor(selected.projectId), revision, workItems: (await documentWork.inspect(req.user.id, selected.projectId, selected.id, { limit: 1000 })).items, exportRuns }] : dashboard;
    if (section === 'verlauf') for (const entry of entries) entry.workHistory = (await documentWork.inspect(req.user.id, entry.job.projectId, entry.job.id, { history: 'true', limit: 1000 })).items;
    const workspace = buildWorkspace(entries);
    const values={ base:selected?jobLink(selected.id):'/assistent',scope:'',statuses:{queued:'Vorbereitet',working:'In Vorbereitung',needs_info:'Angaben offen',review:'Zur Prüfung bereit',closed:'Abgeschlossen'},activeProject, workspace, entries, scopeProject, panel: req.query.panel === '1', active: "assistent", projects, jobs, dashboard, dashboardVersion: !selected ? dashboardSnapshot(req.user.id, jobs, req.assistantProjectId) : '', newJob: req.query.neu === '1', selected, review, revision, categories, documentGroups, deviceOptions, reviewReferences, referenceKey, exportRuns, projectReadiness,
      materialPolicy: require("../../services/documentationMaterialPolicy").effective(activeProject), materialPolicyLabels: require("../../services/documentationMaterialPolicy").labels, materialPolicyRevision: store.projectDataRevision(root,req.user.id,projectId),
      section, fileFilter, coverageFilter, datasheetCoverage, pending, approved, openQuestions, agentIssues, workflowPlan,
      viewVersion: selected ? viewVersion(selected, exportRuns, revision) : "", exportRequestId: crypto.randomUUID() };
    if(req.query.fragment==='workspace')return res.render('partials/assistantWorkspaceSurface',values,(error,html)=>error?res.status(500).json({ok:false,message:"Prüfansicht konnte nicht geladen werden."}):res.json({ok:true,projectId,viewVersion:selected?values.viewVersion:values.dashboardVersion,html}));
    return res.render("assistent",values);
  }
  router.get("/", wrap((req, res) => view(req, res)));
  router.get('/status', wrap((req, res) => {
    const jobs = service.list(req.user.id, req.assistantProjectId);
    const pending = jobs.filter(job => job.status !== 'closed').reduce((sum, job) => sum + service.get(req.user.id, job.id).documents.filter(document => document.state === 'pending').length, 0);
    res.json({ projectId: req.assistantProjectId, viewVersion: dashboardSnapshot(req.user.id, jobs, req.assistantProjectId), pending });
  }));
  router.get("/auftraege/:jobId", wrap((req, res) => view(req, res)));
  router.get("/auftraege/:jobId/status", wrap((req, res) => {
    const current = service.get(req.user.id, req.params.jobId);
    const runs = exportJobs.list(req.user.id, current.projectId).filter(run => run.assistantJobId === current.id);
    return res.json({ projectId: req.assistantProjectId, updatedAt: current.updatedAt, viewVersion: viewVersion(current, runs, store.projectDataRevision(root, req.user.id, current.projectId)), pending: current.documents.filter(document => document.state === "pending").length });
  }));
  router.post('/materialregeln', auditAction('assistant.material_policy.update'), wrap(async(req,res)=>{
    const policy=require('../../services/documentationMaterialPolicy');
    const exclusions=require('../api/materialPolicySchemas').exclusions.parse(Object.fromEntries(policy.keys.map(key=>[key,req.body[key]==='on'])));
    const projectId=req.assistantProjectId;
    const auth={user:req.user,token:{projectIds:[projectId],scopes:['projects:write']}};
    await require('../../services/integrationService').createIntegrationService(root).mutate(auth,projectId,req.body.revision,async files=>{
      const project=await readJson(files.projekt,{});
      if(policy.save(project,exclusions,{actor:req.user.id,source:'manual_gui',evidence:{selection:exclusions}}))await writeJson(files.projekt,project);
    });
    res.redirect('/assistent?success='+encodeURIComponent('Materialregeln gespeichert. Vorhandene Daten und Dateifreigaben bleiben erhalten.'));
  }));
  router.post("/auftraege", auditAction("assistant.job.create"), wrap((req, res) => {
    const job = service.create(req.user.id, req.assistantProjectId, { instruction: req.body.instruction });
    return res.redirect(jobLink(job.id));
  }));
  router.post("/auftraege/:jobId/antworten", auditAction("assistant.answers"), wrap((req, res) => {
    service.answer(req.user.id, req.params.jobId, req.body.answers || {});
    return res.redirect((req.body.returnToOverview === '1' ? '/assistent' : jobLink(req.params.jobId)) + "?success=" + encodeURIComponent("Antworten gespeichert. Der verbundene Agent kann sie jetzt abrufen."));
  }));
  router.post('/auftraege/:jobId/ergaenzen', auditAction('assistant.instruction.append'), wrap((req, res) => {
    service.appendInstruction(req.user.id, req.params.jobId, { version: req.body.jobVersion, kind: req.body.kind, text: req.body.text });
    return res.redirect(jobLink(req.params.jobId) + '?success=' + encodeURIComponent('Ergänzung gespeichert. Im Agentenchat die Bearbeitung fortsetzen.'));
  }));
  router.post('/auftraege/:jobId/arbeit', auditAction('assistant.work.record'), wrap(async (req, res) => {
    const job = service.get(req.user.id, req.params.jobId);
    let target;
    try { target = JSON.parse(req.body.target); } catch { throw fault('Ungültiger Aufgabenbezug.', 400, 'VALIDATION_ERROR'); }
    await documentWork.record({ user: req.user, token: { projectIds: null } }, job.projectId, job.id, '"' + req.body.revision + '"', {
      jobVersion: req.body.jobVersion, target, state: req.body.state, reason: req.body.reason,
      evidence: { kind: 'user', sourceLabel: 'Manuelle Entscheidung im Doku-Assistenten', sourceQuote: req.body.reason },
      ...(req.body.resumeCondition ? { resumeCondition: req.body.resumeCondition } : {})
    });
    return res.redirect(jobLink(job.id) + '?success=' + encodeURIComponent('Bearbeitungsstand gespeichert. Pflichtunterlagen bleiben offen.'));
  }));
  router.get("/auftraege/:jobId/dateien/:proposalId", wrap(async (req, res) => {
    const { row } = service.proposal(req.user.id, req.params.jobId, req.params.proposalId);
    return view(req, res, service.get(req.user.id, req.params.jobId).documents.find(document => document.id === row.id));
  }));
  router.get("/auftraege/:jobId/dateien/:proposalId/inhalt", wrap(async (req, res) => {
    const { bytes, document } = await service.content(req.user.id, req.params.jobId, req.params.proposalId);
    if (req.method !== "HEAD") service.viewed(req.user.id, req.params.jobId, req.params.proposalId, document.sha256);
    res.set({ "Content-Type": document.mimeType, "Content-Disposition": `inline; filename="${document.id}${document.mimeType === 'application/pdf' ? '.pdf' : '.bild'}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'", "X-Content-Type-Options": "nosniff" });
    return res.send(bytes);
  }));
  router.post("/auftraege/:jobId/dateien/:proposalId/uebernehmen", auditAction("assistant.document.approve"), wrap(async (req, res) => {
    let deviceReferences;
    if (req.body.deviceReferencesPresent === "1") {
      try { deviceReferences = (Array.isArray(req.body.deviceReferences) ? req.body.deviceReferences : req.body.deviceReferences ? [req.body.deviceReferences] : []).map(value => JSON.parse(value)); }
      catch { throw fault("Die Gerätezuordnung ist ungültig. Bitte die Prüfseite neu öffnen.", 400, "VALIDATION_ERROR"); }
    }
    const attachmentId = await service.approve(req.user.id, req.params.jobId, req.params.proposalId, {
      reviewed: req.body.reviewed, sha256: req.body.sha256, revision: req.body.revision,
      metadata: { title: req.body.title, category: req.body.category, stockwerk: req.body.stockwerk || "", anlage: req.body.anlage || "", ...(deviceReferences === undefined ? {} : { deviceReferences }) }
    });
    return decisionResponse(req,res,'approved',attachmentId ? 'Datei nach deiner Freigabe übernommen. Weitere Dateien separat prüfen.' : 'Interner Projekttext freigegeben.');
  }));
  router.post("/auftraege/:jobId/dateien/:proposalId/ablehnen", auditAction("assistant.document.reject"), wrap((req, res) => {
    service.reject(req.user.id, req.params.jobId, req.params.proposalId, req.body.reason);
    return decisionResponse(req,res,'rejected','Datei abgelehnt. Weitere Dateien separat prüfen.');
  }));
  router.post('/auftraege/:jobId/dateien/:proposalId/zurueckziehen', auditAction('assistant.document.withdraw'), wrap((req, res) => {
    service.withdrawProposals(req.user.id, req.params.jobId, {
      version: req.body.jobVersion, proposalIds: [req.params.proposalId], reason: req.body.reason,
      evidence: { sourceLabel: 'Manuell im Doku-Assistenten zurückgezogen', sourceQuote: req.body.reason }
    });
    return decisionResponse(req,res,'withdrawn','Vorschlag zurückgezogen. Original und Begründung bleiben im Verlauf.');
  }));
  router.post("/auftraege/:jobId/abschliessen", auditAction("assistant.job.close"), wrap((req, res) => {
    service.close(req.user.id, req.params.jobId);
    return res.redirect(jobLink(req.params.jobId));
  }));
  router.post("/auftraege/:jobId/export", auditAction("documentation.background.request"), wrap(async (req, res) => {
    const job = service.get(req.user.id, req.params.jobId);
    await operations.run({ userId: req.user.id, key: req.body.requestId, operation: "documentation.export.create", request: { projectId: job.projectId, assistantJobId: job.id } }, operationId => exportJobs.create(req.user.id, job.projectId, { assistantJobId: job.id }, { exportId: "exp_" + operationId.slice(3) }));
    return res.redirect(jobLink(job.id) + "?success=" + encodeURIComponent("Export beauftragt. Er wartet bei Bedarf auf Angaben oder deine Dateifreigaben."));
  }));
  for (const [action, method] of [["abbrechen", "cancel"], ["erneut", "retry"]]) {
    router.post(`/auftraege/:jobId/exporte/:exportId/${action}`, auditAction("documentation.background.request"), wrap((req, res) => {
      const job = service.get(req.user.id, req.params.jobId);
      const run = exportJobs.get(req.user.id, job.projectId, req.params.exportId);
      if (run.assistantJobId !== job.id) throw Object.assign(new Error("Exportauftrag wurde nicht gefunden."), { status: 404 });
      exportJobs[method](req.user.id, job.projectId, run.id);
      return res.redirect(jobLink(job.id));
    }));
  }
  router.get("/projekte/:projectId/exporte/:exportId/dateien/:kind", wrap(async (req, res) => {
    const artifact = await exportJobs.file(req.user.id, req.params.projectId, req.params.exportId, req.params.kind);
    return res.download(artifact.path, artifact.name);
  }));
  router.use((error, req, res, _next) => {
    if(res.headersSent)return _next(error);
    if(wantsJson(req))return res.status(error.status||500).json({ok:false,code:error.apiCode||'REVIEW_FAILED',message:error.status&&error.status<500?error.message:'Die Aktion konnte nicht abgeschlossen werden. Bitte den aktuellen Dateistatus prüfen.'});
    if (res.headersSent) return _next(error);
    return res.status(error.status || 500).render("placeholder", { active: "assistent", title: "Aktion nicht ausgeführt", heading: "Aktion nicht ausgeführt", text: error.status && error.status < 500 ? error.message : "Die Aktion konnte nicht abgeschlossen werden. Bitte den aktuellen Auftragsstand prüfen." });
  });
  return router;
}
module.exports = { createDocumentAssistantRouter };
