const {createProjectResetService}=require('../../services/projectResetService');
const {resetInput}=require('../api/resetSchemas');
const {createItemDeletionService}=require('../../services/itemDeletionService');
const deletionSchemas=require('../api/deletionSchemas');
const { bounded,detail,createAgentContractService } = require('../../services/agentContractService');
const { decisionInput,projectView } = require('../api/agentSchemas');
const express = require("express");
const { createIntegrationService, parse, fault } = require("../../services/integrationService");
const store = require("../../services/projectDataStoreService");
const { pageQuery, z, projectPatch } = require("../api/schemas");
const { ok, apiError } = require("../api/http");
const openapi = require("../api/openapi");
const { createIntegrationSettingsService } = require("../../services/integrationSettingsService");
const { createDocumentAssistantService } = require("../../services/documentAssistantService");
const { parseMultipartUpload } = require("../../services/attachmentService");
const { createDocumentationReadinessService } = require("../../services/documentationReadinessService");
const { createIdempotencyService } = require("../../services/idempotencyService");
const { connection } = require("../../services/dbService");
const { createProject } = require("../../services/projectArchiveService");
const { deviceListFieldsForLeistungsbereich } = require("../../services/geraetelistenService");
const { projectCreate, exportJobInput, id } = require("../api/schemas");
const path = require("node:path");
const { prepareProjectDocument } = require("../../services/projectDocumentDraftService");
const { prepareDocumentInput } = require("../api/assistantSchemas");
const { createDocumentationWorkflowService } = require('../../services/documentationWorkflowService');
const { createDatasheetCoverageService } = require('../../services/datasheetCoverageService');
const { coverageQuery } = require('../api/datasheetSchemas');
const { createDocumentWorkService } = require('../../services/documentWorkService');
const { query: documentWorkQuery } = require('../api/documentWorkSchemas');
const { nextActionQuery } = require('../api/workflowSchemas');
const wrap = handler => (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);
const paginate = (items, { limit, offset }) => ({ items: items.slice(offset, offset + limit), total: items.length, limit, offset });

function createIntegrationRouter({ root, tokens, audit, exportJobs, checkStorage = () => {} }) {
  const router = express.Router({ caseSensitive: true, strict: true });
  const service = createIntegrationService(root);
  const datasheets = createDatasheetCoverageService(root);
  const settings = createIntegrationSettingsService(root);
  const assistant = createDocumentAssistantService(root, { checkStorage });
  const readiness = createDocumentationReadinessService(root);
  const manufacturerLinks = require('../../services/manufacturerLinkService').createManufacturerLinkService(root);
  const fireProtectionGuide = require('../../services/fireProtectionGuideService').createFireProtectionGuideService(root);
  const workflow = createDocumentationWorkflowService(root);
  const documentWork = createDocumentWorkService(root);
  const agentContract = createAgentContractService(root);
  const operations = createIdempotencyService(connection());
  const projectReset=createProjectResetService(root);
  const itemDeletion=createItemDeletionService(root,{checkStorage});
  router.get("/openapi.json", (_req, res) => res.json(openapi));
  router.use((req, _res, next) => {
    settings.read().then(value => {
      if (!value.apiEnabled) return next(fault("Der API-Zugang ist in den Einstellungen ausgeschaltet.", 503, "API_DISABLED"));
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !value.allowWrites) return next(fault("Die API ist auf Lesezugriffe beschränkt.", 403, "API_READ_ONLY"));
      next();
    }, () => next(fault("Integrationseinstellungen sind nicht verfügbar.", 503, "SETTINGS_UNAVAILABLE")));
  });
  router.use((req, res, next) => {
    const match = /^Bearer (\S+)$/i.exec(req.get("authorization") || "");
    const auth = match && tokens.authenticate(match[1]);
    if (!auth) {
      res.set("WWW-Authenticate", 'Bearer realm="edoku-api"');
      return next(fault("Gültiger API-Schlüssel erforderlich.", 401, "UNAUTHORIZED"));
    }
    req.integration = auth;
    // Eine Browser-Sitzung darf keine API-Rechte oder Benutzergrenzen erweitern.
    req.user = { ...auth.user };
    next();
  });
  function scope(required) {
    return (req, _res, next) => {
      if (!req.integration.token.scopes.includes(required) || (required.endsWith(":write") && req.user.role === "viewer")) return next(fault("API-Rechte reichen für diese Aktion nicht aus.", 403, "FORBIDDEN"));
      next();
    };
  }
  function query(req) { return parse(pageQuery, req.query); }
  function respondRead(handler) {
    return wrap(async (req, res) => {
      const result = await store.withProjectDataTransaction(async () => {
        const data = await handler(req);
        return { data, revision: req.params.projectId ? service.revision(req.integration, req.params.projectId) : null };
      });
      if (result.revision) res.set("ETag", `"${result.revision}"`);
      return ok(req, res, bounded(result.data,31744));
    });
  }
  const authorizedProject = (req, _res, next) => {
    try {
      service.project(req.integration, req.params.projectId);
      req.user.currentProjectId = req.params.projectId;
      next();
    } catch (error) { next(error); }
  };
  const guard = (req, res, next) => {
    if (!req.is("application/json")) return next(fault("Content-Type application/json ist erforderlich.", 415, "UNSUPPORTED_MEDIA_TYPE"));
    Promise.resolve().then(() => checkStorage(req.user.id, Number(req.get("content-length")) || 0)).then(() => next(), next);
  };
  const authorizedJob = (req, _res, next) => {
    try {
      if (assistant.job(req.user.id, req.params.jobId).project_id !== req.params.projectId) throw fault("Auftrag wurde nicht gefunden.", 404, "NOT_FOUND");
      next();
    } catch (error) { next(error); }
  };
  router.get("/me", respondRead(req => ({ userId: req.user.id, role: req.user.role, scopes: req.integration.token.scopes, projectIds: req.integration.token.projectIds, expiresAt: req.integration.token.expiresAt })));
  router.get("/projects", scope("projects:read"), respondRead(req => service.list(req.integration, query(req))));
  router.post("/projects", scope("projects:write"), guard, audit.middleware, wrap(async (req, res) => {
    if (req.integration.token.projectIds !== null) throw fault("Projektbeschränkte Schlüssel dürfen keine weiteren Projekte anlegen.", 403, "PROJECT_SCOPE_REQUIRED");
    const input = parse(projectCreate, req.body);
    const result = await operations.run({ userId: req.user.id, key: req.get("idempotency-key"), operation: "project.create", request: input }, async operationId => {
      const projectId = "prj_" + operationId.slice(3);
      await createProject(root, path.join(root, "data"), req.user.id, input, { projectId, makeCurrent: false, projectData: input });
      return service.get(req.integration, projectId);
    });
    res.set("Idempotency-Replayed", String(result.replayed));
    return ok(req, res, result.value, 201);
  }));
  router.get('/projects/:projectId/reset-preview',scope('projects:read'),scope('devices:read'),scope('documents:read'),scope('assistant:read'),scope('exports:read'),authorizedProject,respondRead(req=>projectReset.preview(req.integration,req.params.projectId)));
  const deletionRead=[scope('projects:read'),scope('devices:read'),scope('documents:read'),scope('assistant:read'),authorizedProject];
  const deletionWrite=[...deletionRead,scope('projects:write'),scope('devices:write'),scope('assistant:write')];
  router.get('/projects/:projectId/deletions/preview',...deletionRead,respondRead(req=>itemDeletion.preview(req.integration,req.params.projectId,parse(deletionSchemas.target,parse(deletionSchemas.previewQuery,req.query)))));
  router.get('/projects/:projectId/deletions',...deletionRead,respondRead(req=>itemDeletion.list(req.integration,req.params.projectId,query(req))));
  for(const [route,target]of [
    ['/projects/:projectId/device-lists/:listId/positions/:position',req=>({kind:'device',listId:req.params.listId,position:Number(req.params.position)})],
    ['/projects/:projectId/attachments/:attachmentId',req=>({kind:'document',attachmentId:req.params.attachmentId})],
    ['/projects/:projectId/assistant/jobs/:jobId',req=>({kind:'job',jobId:req.params.jobId})]
  ])router.delete(route,...deletionWrite,guard,audit.middleware,wrap(async(req,res)=>{
    const input=parse(deletionSchemas.deletionInput,req.body),selected=parse(deletionSchemas.target,target(req));
    const result=await exportJobs.withProjectPaused(req.user.id,req.params.projectId,()=>operations.run({userId:req.user.id,key:req.get('idempotency-key'),operation:'item.delete',request:{projectId:req.params.projectId,target:selected,input}},(operationId,complete)=>itemDeletion.remove(req.integration,req.params.projectId,selected,req.get('if-match'),input,'del_'+operationId.slice(3),complete)));
    res.set('ETag','"'+service.revision(req.integration,req.params.projectId)+'"');res.set('Idempotency-Replayed',String(result.replayed));return ok(req,res,result.value);
  }));
  router.post('/projects/:projectId/deletions/:deletionId/restore',...deletionWrite,guard,audit.middleware,wrap(async(req,res)=>{
    const input=parse(deletionSchemas.confirmation,req.body),deletionId=parse(id,req.params.deletionId);
    const result=await exportJobs.withProjectPaused(req.user.id,req.params.projectId,()=>operations.run({userId:req.user.id,key:req.get('idempotency-key'),operation:'item.restore',request:{projectId:req.params.projectId,deletionId,input}},(_operationId,complete)=>itemDeletion.restore(req.integration,req.params.projectId,deletionId,req.get('if-match'),input,complete)));
    res.set('ETag','"'+service.revision(req.integration,req.params.projectId)+'"');res.set('Idempotency-Replayed',String(result.replayed));return ok(req,res,result.value);
  }));
  router.post('/projects/:projectId/reset',scope('projects:write'),scope('devices:write'),scope('documents:read'),scope('assistant:write'),scope('exports:write'),authorizedProject,guard,audit.middleware,wrap(async(req,res)=>{
    const input=parse(resetInput,req.body);
    const result=await exportJobs.withProjectPaused(req.user.id,req.params.projectId,()=>operations.run({userId:req.user.id,key:req.get('idempotency-key'),operation:'project.reset',request:{projectId:req.params.projectId,input}},(operationId,complete)=>projectReset.execute(req.integration,req.params.projectId,req.get('if-match'),input,'reset_'+operationId.slice(3),complete)));
    let cleanup;try{cleanup=await projectReset.cleanup(req.integration,req.params.projectId,result.value)}catch{cleanup={status:'pending',retrySameRequest:true,error:'RESET_CLEANUP_PENDING'};}
    res.set('Idempotency-Replayed',String(result.replayed));res.set('ETag','"'+service.revision(req.integration,req.params.projectId)+'"');return ok(req,res,{...result.value,cleanup});
  }));
  router.get("/projects/:projectId", scope("projects:read"), respondRead(async req => { const value=await service.get(req.integration,req.params.projectId);if(parse(projectView,req.query).view==='full')return value;return {...value,projekt:Object.fromEntries(Object.entries(value.projekt).filter(([key])=>Object.hasOwn(projectPatch.shape,key)))}; }));
  router.get('/projects/:projectId/datasheet-coverage', scope('projects:read'), scope('devices:read'), scope('documents:read'), scope('assistant:read'), authorizedProject, respondRead(async req => {
    const options = parse(coverageQuery, req.query);
    const result = await datasheets.inspect(req.user.id, req.params.projectId);
    const items = result.items.filter(item => options.status === 'all' || (options.status === 'open' ? item.status !== 'approved' : item.status === options.status));
    return { ...result, ...paginate(items, options), exclusions: result.exclusions.slice(0,3), exclusionsTotal: result.exclusions.length, exclusionsTruncated: result.exclusions.length>3, materialExclusions: require("../../services/documentationMaterialPolicy").effective((await service.get(req.integration,req.params.projectId)).projekt).exclusions };
  }));
  router.post('/projects/:projectId/datasheet-searches', scope('projects:write'), scope('devices:read'), scope('documents:read'), scope('assistant:read'), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const result = await datasheets.recordSearch(req.integration, req.params.projectId, req.get('if-match'), req.body);
    res.set('ETag', `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, result);
  }));
  router.get("/projects/:projectId/documentation-status", scope("projects:read"), scope("devices:read"), scope("documents:read"), scope("assistant:read"), authorizedProject, respondRead(req => readiness.query(req.user.id, req.params.projectId, req.query)));
  router.get('/projects/:projectId/next-action', scope('projects:read'), scope('devices:read'), scope('documents:read'), scope('assistant:read'), authorizedProject, respondRead(req => workflow.inspect(req.user.id, req.params.projectId, parse(nextActionQuery, req.query))));
  const materialImports=require('../../services/materialImportService').createMaterialImportService(root);
  router.get('/projects/:projectId/material-import',scope('projects:read'),scope('devices:read'),authorizedProject,respondRead(req=>materialImports.inspect(req.integration,req.params.projectId,req.query)));
  router.post('/projects/:projectId/material-import',scope('projects:write'),scope('devices:read'),authorizedProject,guard,audit.middleware,wrap(async(req,res)=>{
    const result=await materialImports.record(req.integration,req.params.projectId,req.get('if-match'),req.body);
    res.set('ETag',`"${service.revision(req.integration,req.params.projectId)}"`);return ok(req,res,result);
  }));
  router.get('/projects/:projectId/assistant/jobs/:jobId/manufacturer-links', scope('projects:read'), scope('devices:read'), scope('assistant:read'), scope('documents:read'), authorizedProject, respondRead(req => manufacturerLinks.inspect(req.user.id, req.params.projectId, req.params.jobId, req.query)));
  router.get('/projects/:projectId/fire-protection-guide', scope('projects:read'), scope('devices:read'), scope('assistant:read'), authorizedProject, respondRead(req => fireProtectionGuide.inspect(req.user.id, req.params.projectId, req.query)));
  router.get('/projects/:projectId/assistant/jobs/:jobId/document-work', scope('projects:read'), scope('devices:read'), scope('assistant:read'), authorizedProject, authorizedJob, respondRead(req => documentWork.inspect(req.user.id, req.params.projectId, req.params.jobId, parse(documentWorkQuery, req.query))));
  router.post('/projects/:projectId/assistant/jobs/:jobId/document-work', scope('projects:write'), scope('devices:read'), scope('assistant:read'), scope('assistant:write'), authorizedProject, authorizedJob, guard, audit.middleware, wrap(async (req, res) => {
    const data = await documentWork.record(req.integration, req.params.projectId, req.params.jobId, req.get('if-match'), req.body);
    res.set('ETag', `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.post('/projects/:projectId/workflow', scope('projects:write'), scope('assistant:read'), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    if (req.body?.requirementScopes && !req.integration.token.scopes.includes('assistant:write')) throw fault('Ablageentscheidungen benötigen zusätzlich assistant:write.', 403, 'FORBIDDEN');
    const data = await workflow.start(req.integration, req.params.projectId, req.get('if-match'), req.body);
    res.set('ETag', `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.post('/projects/:projectId/research', scope('devices:write'), scope('projects:write'), scope('devices:read'), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const data = await workflow.recordResearch(req.integration, req.params.projectId, req.get('if-match'), req.body);
    res.set('ETag', `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.get("/projects/:projectId/export-jobs", scope("exports:read"), authorizedProject, respondRead(req => paginate(exportJobs.list(req.user.id, req.params.projectId), query(req))));
  router.get("/projects/:projectId/export-jobs/:exportId", scope("exports:read"), authorizedProject, respondRead(req => exportJobs.get(req.user.id, req.params.projectId, req.params.exportId)));
  router.get("/projects/:projectId/export-jobs/:exportId/files/:kind", scope("exports:read"), authorizedProject, wrap(async (req, res) => {
    const file = await exportJobs.file(req.user.id, req.params.projectId, req.params.exportId, req.params.kind);
    return res.download(file.path, file.name);
  }));
  router.post("/projects/:projectId/export-jobs", scope("exports:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const input = parse(exportJobInput, req.body);
    const result = await operations.run({ userId: req.user.id, key: req.get("idempotency-key"), operation: "documentation.export.create", request: { projectId: req.params.projectId, ...input } }, operationId => exportJobs.create(req.user.id, req.params.projectId, input, { exportId: "exp_" + operationId.slice(3), tokenId: req.integration.token.id }));
    res.set("Idempotency-Replayed", String(result.replayed));
    return ok(req, res, result.value, 202);
  }));
  for (const action of ["cancel", "retry"]) {
    router.post(`/projects/:projectId/export-jobs/:exportId/${action}`, scope("exports:write"), authorizedProject, audit.middleware, wrap((req, res) => {
      if (!req.is("application/json")) throw fault("Content-Type application/json ist erforderlich.", 415, "UNSUPPORTED_MEDIA_TYPE");
      parse(z.object({}).strict(), req.body);
      return ok(req, res, exportJobs[action](req.user.id, req.params.projectId, req.params.exportId, { tokenId: req.integration.token.id }), action === "retry" ? 202 : 200);
    }));
  }
  router.get("/projects/:projectId/assistant/jobs", scope("assistant:read"), authorizedProject, respondRead(req => paginate(assistant.list(req.user.id, req.params.projectId).map(j=>({id:j.id,projectId:j.projectId,status:j.status,createdAt:j.createdAt,updatedAt:j.updatedAt,openQuestions:j.questions.filter(q=>!q.answer&&!q.obsolete).length})), query(req))));
  router.get('/projects/:projectId/assistant/jobs/:jobId/decisions', scope('assistant:read'), scope('projects:read'), authorizedProject, authorizedJob, respondRead(req=>agentContract.history(req.integration,req.params.projectId,req.params.jobId,req.query)));
  router.get('/projects/:projectId/assistant/jobs/:jobId/knowledge', scope('projects:read'), scope('devices:read'), scope('assistant:read'), authorizedProject, authorizedJob, respondRead(req=>agentContract.inspectKnowledge(req.integration,req.params.projectId,req.params.jobId,req.query)));
  router.post('/projects/:projectId/assistant/jobs/:jobId/decisions', scope('projects:write'), scope('devices:read'), scope('assistant:read'), scope('assistant:write'), authorizedProject, authorizedJob, guard, audit.middleware, wrap(async (req,res)=>{
    const input=parse(decisionInput,req.body);
    const receipt=await operations.run({userId:req.user.id,key:req.get('idempotency-key'),operation:'assistant.decision.capture',request:{projectId:req.params.projectId,jobId:req.params.jobId,input}},(_operationId,complete)=>agentContract.capture(req.integration,req.params.projectId,req.params.jobId,req.get('if-match'),input,{onCommit:complete}));
    const plan=await workflow.inspect(req.user.id,req.params.projectId,{jobId:req.params.jobId,view:'compact',limit:3});
    res.set('ETag',plan.projectETag);res.set("Idempotency-Replayed",String(receipt.replayed));return ok(req,res,{receipt:receipt.value,plan});
  }));
  router.get("/projects/:projectId/assistant/jobs/:jobId", scope("assistant:read"), authorizedProject, authorizedJob, respondRead(req => detail(assistant.get(req.user.id, req.params.jobId),req.query)));
  router.post("/projects/:projectId/assistant/jobs", scope("assistant:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    // Vorhandene Clients bleiben kompatibel; neue Agenten senden für sichere Wiederholungen einen Schlüssel.
    const input = parse(require("../api/assistantSchemas").jobInput, req.body);
    if (!req.get("idempotency-key")) { await agentContract.validateDependencies(req.integration,req.params.projectId,input.requirements); return ok(req, res, assistant.create(req.user.id, req.params.projectId, input), 201); }
    const result = await operations.run({ userId: req.user.id, key: req.get("idempotency-key"), operation: "assistant.create", request: { projectId: req.params.projectId, ...input } }, async operationId => {await agentContract.validateDependencies(req.integration,req.params.projectId,input.requirements);return assistant.create(req.user.id, req.params.projectId, input, { jobId: "job_" + operationId.slice(3) });});
    res.set("Idempotency-Replayed", String(result.replayed));
    return ok(req, res, result.value, 201);
  }));
  router.patch("/projects/:projectId/assistant/jobs/:jobId", scope("assistant:write"), authorizedProject, authorizedJob, guard, audit.middleware, wrap(async (req, res) => {
    if (Array.isArray(req.body?.questions) && req.body.questions.some(question => question?.targets)) throw fault('Zielbezogene Rückfragen über den questions-Endpunkt mit Auftragsversion einstellen.', 400, 'CONTEXTUAL_QUESTION_REQUIRED');
    const view=parse(projectView,{...req.query,view:req.query.view||'full'}).view;
    const input=parse(require('../api/assistantSchemas').jobUpdate,req.body);
    await agentContract.validateDependencies(req.integration,req.params.projectId,input.requirements,req.params.jobId);
    const updated=assistant.update(req.user.id, req.params.jobId, input);
    return ok(req,res,view==='compact'?require('../../services/agentContractService').detail(updated,{}):updated);
  }));
  router.post("/projects/:projectId/assistant/jobs/:jobId/answers", scope("assistant:write"), authorizedProject, authorizedJob, guard, audit.middleware, wrap((req, res) => ok(req, res, assistant.recordAnswers(req.user.id, req.params.jobId, req.body))));
  router.patch('/projects/:projectId/assistant/jobs/:jobId/requirements/:requirementId', scope('assistant:write'), scope('projects:write'), scope('devices:read'), authorizedProject, authorizedJob, guard,
    (req, res, next) => { req.assistantAuditEvent = 'assistant.requirement.correct'; next(); }, audit.middleware, wrap(async (req, res) => {
      const result = await service.mutate(req.integration, req.params.projectId, req.get('if-match'), () => assistant.correctRequirement(req.user.id, req.params.jobId, parse(id, req.params.requirementId), req.body));
      return ok(req, res, result);
    }));
  router.post('/projects/:projectId/assistant/jobs/:jobId/questions', scope('assistant:write'), scope('projects:read'), scope('devices:read'), authorizedProject, authorizedJob, guard, audit.middleware, wrap(async (req, res) => ok(req, res, await workflow.ask(req.integration, req.params.projectId, req.params.jobId, req.body))));
  router.post("/projects/:projectId/assistant/jobs/:jobId/replacements", scope("assistant:write"), authorizedProject, authorizedJob, guard, audit.middleware, wrap((req, res) => ok(req, res, assistant.replaceProposals(req.user.id, req.params.jobId, req.body))));
  router.post('/projects/:projectId/assistant/jobs/:jobId/withdrawals', scope('assistant:write'), scope('projects:read'), scope('documents:read'), authorizedProject, authorizedJob, guard, audit.middleware,
    wrap((req, res) => ok(req, res, assistant.withdrawProposals(req.user.id, req.params.jobId, req.body))));
  router.post("/projects/:projectId/assistant/jobs/:jobId/prepare-document", scope("assistant:write"), scope("projects:read"), scope("documents:read"), authorizedProject, authorizedJob, guard, audit.middleware, wrap(async (req, res) => {
    const input = parse(prepareDocumentInput, req.body);
    const result = await operations.run({ userId: req.user.id, key: req.get("idempotency-key"), operation: "assistant.prepare", request: { projectId: req.params.projectId, jobId: req.params.jobId, input } }, () => prepareProjectDocument(root, assistant, req.user.id, req.params.projectId, req.params.jobId, req.get("if-match"), input));
    return ok(req, res, result.value, 201);
  }));
  router.post('/projects/:projectId/assistant/jobs/:jobId/manufacturer-documents',scope('assistant:write'),scope('projects:read'),scope('devices:read'),scope('documents:read'),authorizedProject,authorizedJob,guard,audit.middleware,wrap(async(req,res)=>{
    const input=parse(require('../api/productDocumentSchemas').manufacturerDocumentInput,req.body);
    const result=await assistant.manufacturerDocument(req.user.id,req.params.jobId,input);
    return ok(req,res,result,input.mode==='check'?200:201);
  }));
  router.post("/projects/:projectId/assistant/jobs/:jobId/documents", scope("assistant:write"), authorizedProject, authorizedJob,
    (req, res, next) => req.is("multipart/form-data") ? express.raw({ type: "multipart/form-data", limit: "15mb" })(req, res, next) : next(fault("Ein Multipart-Upload ist erforderlich.", 415, "UNSUPPORTED_MEDIA_TYPE")),
    audit.middleware, wrap(async (req, res) => {
      const upload = await parseMultipartUpload(req);
      if (upload.files.length !== 1) throw fault("Bitte genau eine Datei pro Vorschlag einreichen.", 400, "VALIDATION_ERROR");
      let metadata;
      try { metadata = JSON.parse(upload.fields.metadata); } catch { throw fault("Gültige Dokumentmetadaten sind erforderlich.", 400, "VALIDATION_ERROR"); }
      if (metadata.projectDocument) throw fault("Projekttexte über prepare-document vorbereiten.", 400, "VALIDATION_ERROR");
      return ok(req, res, await assistant.propose(req.user.id, req.params.jobId, metadata, upload.file), 201);
    }));
  router.get("/projects/:projectId/device-lists", scope("devices:read"), respondRead(async req => {
    const lists = await service.devices(req.integration, req.params.projectId);
    return paginate(lists.map(({ positionen, ...list }) => ({ ...list, fields: deviceListFieldsForLeistungsbereich(list.leistungsbereich), positionCount: Array.isArray(positionen) ? positionen.length : 0 })), query(req));
  }));
  router.get("/projects/:projectId/device-lists/:listId", scope("devices:read"), respondRead(async req => {
    const matches = (await service.devices(req.integration, req.params.projectId)).filter(list => list.id === req.params.listId);
    if (matches.length !== 1) throw fault("Geräteliste wurde nicht eindeutig gefunden.", 404, "NOT_FOUND");
    const { positionen, ...list } = matches[0];
    return { ...list, fields: deviceListFieldsForLeistungsbereich(list.leistungsbereich), positionen: paginate(positionen || [], query(req)) };
  }));
  for (const section of ["service-areas", "systems", "system-catalog", "documents", "firestops", "attachments", "exports"]) {
    const permission = ["service-areas", "systems", "system-catalog"].includes(section) ? "projects:read" : "documents:read";
    router.get(`/projects/:projectId/${section}`, scope(permission), respondRead(async req => {
      const page = section==='system-catalog' ? parse(require('../api/schemas').systemCatalogQuery,req.query) : query(req), data = await service.section(req.integration, req.params.projectId, section);
      if(section==='system-catalog')return require('../../services/systemCatalogService').catalogPage(data,page);
      return Array.isArray(data) ? paginate(data, page) : data;
    }));
  }
  router.patch("/projects/:projectId", scope("projects:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const data = await service.patchProject(req.integration, req.params.projectId, req.get("if-match"), req.body);
    res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.post("/projects/:projectId/approved-document-links", scope("devices:write"), scope("documents:read"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const data = await service.linkApprovedDocument(req.integration, req.params.projectId, req.get("if-match"), req.body);
    res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.delete("/projects/:projectId/internal-documents/:attachmentId", scope("projects:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    parse(z.object({ confirm: z.literal(true) }).strict(), req.body);
    const data = await service.removeInternalProjectDocument(req.integration, req.params.projectId, req.get("if-match"), req.params.attachmentId);
    res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  router.patch("/projects/:projectId/attachments/:attachmentId", scope("projects:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
    const data = await service.patchAttachment(req.integration, req.params.projectId, req.get("if-match"), req.params.attachmentId, req.body);
    res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
    return ok(req, res, data);
  }));
  for (const [section, method, permission] of [["service-areas", "selectServiceAreas", "projects:write"], ["systems", "selectSystems", "projects:write"], ["documents", "selectDocuments", "projects:write"]]) {
    router.patch(`/projects/:projectId/${section}`, scope(permission), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
      const data = await service[method](req.integration, req.params.projectId, req.get("if-match"), req.body);
      res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
      return ok(req, res, data);
    }));
  }
  for (const [method, route, status] of [["post", "/projects/:projectId/device-lists/:listId/positions", 201], ["patch", "/projects/:projectId/device-lists/:listId/positions/:position", 200]]) {
    router[method](route, scope("devices:write"), authorizedProject, guard, audit.middleware, wrap(async (req, res) => {
      const position = method === "post" ? null : parse(z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER), req.params.position);
      let data, replayed = false;
      if (method === "post" && req.get("idempotency-key")) {
        const result = await operations.run({ userId: req.user.id, key: req.get("idempotency-key"), operation: "device.position.create", request: { projectId: req.params.projectId, listId: req.params.listId, body: req.body } }, (_operationId, complete) => service.changePosition(req.integration, req.params.projectId, req.params.listId, null, req.get("if-match"), req.body, { onCommit: complete }));
        data = result.value; replayed = result.replayed;
        res.set("Idempotency-Replayed", String(replayed));
      } else data = await service.changePosition(req.integration, req.params.projectId, req.params.listId, position, req.get("if-match"), req.body);
      if (!replayed) res.set("ETag", `"${service.revision(req.integration, req.params.projectId)}"`);
      return ok(req, res, data, status);
    }));
  }
  router.use((_req, _res, next) => next(fault("API-Endpunkt wurde nicht gefunden.", 404, "NOT_FOUND")));
  router.use(apiError);
  return router;
}
module.exports = { createIntegrationRouter };
