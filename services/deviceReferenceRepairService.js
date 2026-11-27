const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { createIntegrationService, fault } = require('./integrationService');
const { createDocumentAssistantService } = require('./documentAssistantService');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const { resolveAttachmentFile } = require('./attachmentService');
const { resolveDeviceReferences, documentFields, referenceKey } = require('./deviceDocumentService');
const { readJson, writeJson } = require('./jsonService');
const { parse } = require('../src/api/validation');
const same = (a,b) => String(a || '').trim().toLocaleLowerCase('de') === String(b || '').trim().toLocaleLowerCase('de');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Repair only identity metadata for an original that is already linked on the real row.
// An identical product alone cannot prove which physical device was meant.
function repairOptions(data, attachment) {
  const repairs = [], blocked = [], field = documentFields[attachment?.category];
  if (!field) return { repairs, blocked: [{ code: 'UNSUPPORTED_DOCUMENT_CATEGORY' }] };
  const references = attachment.deviceReferences || [];
  const valid = references.map(from => {
    try {
      const resolved = resolveDeviceReferences(data.geraetelisten, [from], attachment.category, attachment.mimeType)[0];
      return resolved.position[field] === attachment.id && resolved.list.aktiv !== false && data.leistungsbereiche.aktiv.includes(resolved.list.leistungsbereich);
    } catch {}
    return false;
  });
  const candidatesByOrigin = [];
  for (const [fromIndex,from] of references.entries()) {
    if(valid[fromIndex]) {
      const keepIndex=references.findIndex((ref,index)=>valid[index]&&referenceKey(ref)===referenceKey(from));
      if(keepIndex!==fromIndex)repairs.push({action:'remove_duplicate',fromIndex,from,to:references[keepIndex],keepIndex});
      continue;
    }
    // A still-existing instance must never be merged into another identical device.
    const originalList=data.geraetelisten.find(list=>list.id===from.listId);
    const original=originalList?.positionen?.find(row=>Number(row.pos)===Number(from.position));
    if(original&&same(original.hersteller,from.manufacturer)&&same(original.typ,from.model)) {
      blocked.push({code:'EXISTING_DEVICE_INSTANCE_CONFLICT',from});continue;
    }
    const candidates = data.geraetelisten.filter(list => list.aktiv !== false && data.leistungsbereiche.aktiv.includes(list.leistungsbereich))
      .flatMap(list => (list.positionen || []).filter(row => row[field] === attachment.id && same(row.hersteller, from.manufacturer) && same(row.typ, from.model)
        && (from.variant === undefined || same(from.variant, [row.abmessung,row.farbe].filter(Boolean).join(' · '))))
        .map(row => ({ listId: list.id, position: Number(row.pos), manufacturer: row.hersteller, model: row.typ,
          ...(from.variant !== undefined ? {variant: [row.abmessung,row.farbe].filter(Boolean).join(' · ')} : {}) })));
    if (candidates.length !== 1 || !Number.isSafeInteger(candidates[0].position) || candidates[0].position < 1) {
      blocked.push({ code: candidates.length ? 'AMBIGUOUS_DEVICE_INSTANCE' : 'NO_CONFIRMED_DEVICE_LINK', from, candidates: candidates.slice(0,3), candidateCount: candidates.length });
      continue;
    }
    candidatesByOrigin.push({fromIndex,from,to:candidates[0]});
  }
  // Evaluate all origins before limiting the batch: pagination must not collapse
  // several formerly distinct physical instances into one current row.
  for(const item of candidatesByOrigin){
    const {fromIndex,from,to}=item;
    if(candidatesByOrigin.filter(other=>referenceKey(other.to)===referenceKey(to)).length>1){
      blocked.push({code:'AMBIGUOUS_REFERENCE_MERGE',from});continue;
    }
    const occupied=references.flatMap((ref,index)=>index!==fromIndex&&referenceKey(ref)===referenceKey(to)?[index]:[]);
    if(occupied.length){
      const keepIndex=occupied.find(index=>valid[index]);
      if(keepIndex===undefined||occupied.some(index=>!valid[index])){blocked.push({code:'DEVICE_REFERENCE_COLLISION',from});continue;}
      repairs.push({action:'remove_duplicate',fromIndex,from,to:references[keepIndex],keepIndex});
    }else repairs.push({action:'rebind',fromIndex,from,to});
  }
  const selected=[];
  for(const repair of repairs){if(selected.length>=3 || Buffer.byteLength(JSON.stringify([...selected,repair]))>5000)break;selected.push(repair);}
  if(repairs.length && !selected.length)blocked.push({code:'REFERENCE_DETAIL_TOO_LARGE'});
  return {repairs:selected, remainingRepairs:Math.max(0,repairs.length-selected.length), blocked};
}

function createDeviceReferenceRepairService(root) {
  const integration = createIntegrationService(root), assistant = createDocumentAssistantService(root);
  async function inspect(auth, projectId, attachmentId) {
    integration.project(auth, projectId);
    const data = await loadProjectWorkspace(root, auth.user.id, projectId);
    const attachment = data.anhaenge.find(row => row.id === attachmentId);
    const provenance = attachment?.assistantProvenance;
    if (!provenance) throw fault('Ein manuell freigegebenes Herstelleroriginal ist erforderlich.',409,'APPROVED_DOCUMENT_REQUIRED');
    const job = assistant.get(auth.user.id, provenance.jobId);
    if (job.projectId !== projectId) throw fault('Auftrag gehört nicht zum Projekt.',404,'NOT_FOUND');
    const document = job.documents.find(row => row.id === provenance.proposalId && row.state === 'approved' && row.attachmentId === attachment.id);
    if (!document || attachment.mimeType !== 'application/pdf') throw fault('Die bestehende Originalfreigabe ist nicht nachweisbar.',409,'APPROVED_DOCUMENT_REQUIRED');
    const options = repairOptions(data,attachment);
    const revision = integration.revision(auth,projectId);
    const previewToken = digest([projectId,revision,job.version,attachment,document.sha256,options.repairs]);
    const result = { projectId, attachmentId, jobId:job.id, projectETag:`"${revision}"`, previewToken,
      sha256:document.sha256, state:options.repairs.length?'ready':options.blocked.length?'blocked':'unchanged',
      repairs:options.repairs, remainingRepairs:options.remainingRepairs || 0, blocked:options.blocked.slice(0,3).map(item=>({code:item.code,...(item.from?{from:{listId:item.from.listId,position:item.from.position}}:{}),...(item.candidateCount!==undefined?{candidateCount:item.candidateCount}:{})})), blockedCount:options.blocked.length,
      fileApproval:'manual_gui_per_file', approvalPreserved:true, fileIntegrity:'checked_on_apply' };
    return {result,data,attachment,document};
  }
  async function preview(auth,projectId,attachmentId) { return (await inspect(auth,projectId,attachmentId)).result; }
  async function apply(auth,projectId,attachmentId,etag,raw) {
    const input = parse(require('../src/api/referenceRepairSchemas').apply,raw);
    return integration.mutate(auth,projectId,etag,async files => {
      const {result,attachment,document} = await inspect(auth,projectId,attachmentId);
      if (result.previewToken !== input.previewToken) throw fault('Vorschau ist veraltet. Neu prüfen.',412,'PRECONDITION_FAILED');
      if (result.state !== 'ready') throw fault('Keine eindeutig belegte Reparatur möglich.',409,'REFERENCE_REPAIR_BLOCKED');
      const file = await resolveAttachmentFile(root,files,attachment.relativePath), stat = await fs.stat(file);
      if (stat.size !== document.bytes || stat.size > 15*1024*1024) throw fault('Freigegebenes Original wurde verändert.',409,'FILE_CHANGED');
      if (crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex') !== document.sha256) throw fault('Freigegebenes Original wurde verändert.',409,'FILE_CHANGED');
      const attachments = await readJson(files.anhaenge,[]), target = attachments.find(row => row.id === attachmentId);
      const before = structuredClone(target.deviceReferences);
      const removed=new Set();
      for (const repair of result.repairs) {
        const index=repair.fromIndex;
        if (JSON.stringify(before[index]) !== JSON.stringify(repair.from)) throw fault('Gerätebezug wurde geändert.',412,'PRECONDITION_FAILED');
        if(repair.action==='remove_duplicate'){
          if(JSON.stringify(before[repair.keepIndex])!==JSON.stringify(repair.to)||result.repairs.some(other=>other.fromIndex===repair.keepIndex))throw fault('Erhaltener Gerätebezug ist nicht mehr eindeutig.',412,'PRECONDITION_FAILED');
          removed.add(index);
        }else target.deviceReferences[index] = {...before[index],...repair.to};
      }
      target.deviceReferences=target.deviceReferences.filter((ref,index)=>!removed.has(index));
      const project = await readJson(files.projekt,{}), history = project.assistantReferenceRepairs || [];
      if (!Array.isArray(history) || history.length >= 1000) throw fault('Reparaturprotokoll ist ungültig oder voll.',409,'REFERENCE_HISTORY_LIMIT');
      project.assistantReferenceRepairs = [...history,{ attachmentId, jobId:result.jobId, before, after:structuredClone(target.deviceReferences), actions:result.repairs, sha256:document.sha256,
        evidence:input.evidence, recordedAt:new Date().toISOString(), recordedBy:auth.user.id }];
      await writeJson(files.anhaenge,attachments); await writeJson(files.projekt,project);
      return { attachmentId, repaired:result.repairs.length, duplicatesRemoved:removed.size, approvalPreserved:true, sha256:document.sha256, fileApproval:'manual_gui_per_file' };
    });
  }
  return {preview,apply};
}
module.exports = {repairOptions,createDeviceReferenceRepairService};
