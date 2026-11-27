const { getProject, listProjectsForUser, connection } = require("./dbService");
const { archivedApproval } = require('./deletionEvidenceService');
const { projectResetGeneration } = require('./idempotencyService');
const { dataFilesForProject, upsertProjectFromData } = require("./projectArchiveService");
const { readJson, writeJson } = require("./jsonService");
const { assertSafePath } = require("./pathService");
const store = require("./projectDataStoreService");
const { id, projectPatch, positionPatch, approvedDocumentLink, attachmentPatch, sections, serviceAreaSelection, documentSelection, systemSelection } = require("../src/api/schemas");
const { linkDeviceDocuments, resolveDeviceReferences, referenceKey } = require("./deviceDocumentService");
const { resolveAttachmentFile, deleteAttachment, syncAttachmentFileName } = require("./attachmentService");
const { updateAttachmentDocumentMeta, defaultDocumentMetaForCategory } = require("./documentAttachmentService");
const { createDocumentAssistantService } = require("./documentAssistantService");
const crypto = require("node:crypto"), fs = require("node:fs/promises");
const { syncProjectDerivedData, loadProjectWorkspace, syncDeviceListsPreservingFields } = require("./projectWorkspaceService");
const { systemSelectionsWithIds } = require("./systemService");
const { saveSystemSelections } = require("./systemSelectionService");
const { parse, fault } = require("../src/api/validation");
const { deviceListFieldsForLeistungsbereich } = require("./geraetelistenService");

function createIntegrationService(root) {
  function project(auth, projectId) {
    parse(id, projectId);
    const row = getProject(auth.user.id, projectId);
    if (!row || row.status === "geloescht" || (auth.token.projectIds !== null && !auth.token.projectIds.includes(projectId))) throw fault("Projekt wurde nicht gefunden.", 404, "NOT_FOUND");
    return row;
  }
  async function read(auth, projectId, name) {
    project(auth, projectId);
    const file = dataFilesForProject(root, auth.user.id, projectId)[name];
    const stored = store.readProjectDocument(file);
    if (stored.handled) return stored.value;
    await assertSafePath(root, file, { type: "file" });
    return readJson(file);
  }
  function revision(auth, projectId) {
    return store.projectDataRevision(root, auth.user.id, projectId);
  }
  async function list(auth, { limit, offset }) {
    const rows = listProjectsForUser(auth.user.id).filter(row => row.status !== "geloescht" && (auth.token.projectIds === null || auth.token.projectIds.includes(row.id)));
    // Erst berechtigen und paginieren, danach die Inhalte lesen.
    const items = [];
    for (const row of rows.slice(offset, offset + limit)) {
      const data = await read(auth, row.id, "projekt");
      items.push({ id: row.id, status: row.status, projektname: data.projektname || "", projektnummer: data.projektnummer || "" });
    }
    return { items, total: rows.length, limit, offset };
  }
  async function get(auth, projectId) {
    const row = project(auth, projectId);
    return { id: row.id, status: row.status, projekt: await read(auth, projectId, "projekt"), revision: revision(auth, projectId) || null };
  }
  async function section(auth, projectId, sectionName) {
    if (sectionName === "system-catalog") {
      project(auth, projectId);
      return (await loadProjectWorkspace(root, auth.user.id, projectId)).systemConfig;
    }
    const name = sections[sectionName];
    if (!name) throw fault("Bereich wurde nicht gefunden.", 404, "NOT_FOUND");
    return sectionName === "systems" ? systemSelectionsWithIds(await read(auth, projectId, name)) : read(auth, projectId, name);
  }
  async function mutate(auth, projectId, ifMatch, work, { onCommit, skipUnchanged = false } = {}) {
    project(auth, projectId);
    if (!revision(auth, projectId)) throw fault("Schreibzugriffe benötigen den aktivierten SQLite-Projektspeicher.", 409, "STORAGE_REQUIRED");
    if (!ifMatch) throw fault("If-Match mit der zuletzt gelesenen Projektversion ist erforderlich.", 428, "PRECONDITION_REQUIRED");
    const expected = `"${revision(auth, projectId)}"`;
    if (ifMatch !== expected) throw fault("Projekt wurde zwischenzeitlich geändert. Bitte neu lesen.", 412, "PRECONDITION_FAILED");
    return store.withProjectDataTransaction(async () => {
      store.assertProjectRevision(root, auth.user.id, projectId, ifMatch.slice(1, -1));
      const result = await work(dataFilesForProject(root, auth.user.id, projectId));
      if (!skipUnchanged || result?.changed !== false) await upsertProjectFromData(root, auth.user.id, projectId);
      if (onCommit) store.onProjectDataCommit(() => onCommit(result));
      return result;
    });
  }
  async function patchProject(auth, projectId, ifMatch, body) {
    const patch = parse(projectPatch, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const data = { ...await read(auth, projectId, "projekt"), ...patch };
      await writeJson(files.projekt, data);
      return data;
    });
  }
  async function devices(auth, projectId) {
    return read(auth, projectId, "geraetelisten");
  }
  async function linkApprovedDocument(auth, projectId, ifMatch, body) {
    const input = parse(approvedDocumentLink, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const attachments = await read(auth, projectId, "anhaenge");
      const attachment = attachments.find(item => item.id === input.attachmentId);
      const provenance = attachment?.assistantProvenance;
      if (!provenance) throw fault("Eine bereits manuell freigegebene Assistenten-Datei ist erforderlich.", 409, "APPROVED_DOCUMENT_REQUIRED");
      let document;
      try { document = createDocumentAssistantService(root).get(auth.user.id, provenance.jobId).documents.find(item => item.id === provenance.proposalId && item.state === "approved" && item.attachmentId === attachment.id); }
      catch(error) { if(error.status!==404)throw error; }
      if(!document){const archived=archivedApproval(connection(),auth.user.id,projectId,provenance.jobId,provenance.proposalId);if(archived?.attachment_id===attachment.id)document={...archived,attachmentId:archived.attachment_id};}
      if (!document) throw fault("Die manuelle Freigabe ist nicht nachweisbar.", 409, "APPROVED_DOCUMENT_REQUIRED");
      const file = await resolveAttachmentFile(root, files, attachment.relativePath), stat = await fs.stat(file);
      if (stat.size !== document.bytes || stat.size > 15 * 1024 * 1024 || crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex") !== document.sha256) throw fault("Freigegebene Quelldatei wurde verändert.", 409, "FILE_CHANGED");
      const lists = await devices(auth, projectId);
      const currentReferences=resolveDeviceReferences(lists,input.devices,attachment.category,attachment.mimeType).map(({reference,position})=>({...reference,variant:[position.abmessung,position.farbe].filter(Boolean).join(' · ')}));
      const needsRecheck=currentReferences.some(ref=>(attachment.deviceReferences||[]).some(old=>referenceKey(old)===referenceKey(ref)&&(old.manufacturer!==ref.manufacturer||old.model!==ref.model||String(old.variant||'')!==ref.variant)));
      if(needsRecheck){
        const verifier=require('./productDocumentVerificationService').createProductDocumentVerificationService(root);
        if(!verifier.technical(attachment.category))throw fault('Geänderte Variante benötigt eine erneute Originalprüfung.',409,'PRODUCT_DOCUMENT_RECHECK_REQUIRED');
        const checked=await verifier.check(auth.user.id,projectId,provenance.jobId,{category:attachment.category,manufacturerPageUrl:document.manufacturerPageUrl,sourceUrl:document.sourceUrl,deviceReferences:input.devices});
        if(checked.report.state!=='matched')throw verifier.blocked(checked.report);
        if(checked.report.sha256!==document.sha256)throw fault('Aktuelles Hersteller-PDF unterscheidet sich vom freigegebenen Original. Neue Datei manuell prüfen lassen.',409,'APPROVED_SOURCE_CHANGED');
      }
      linkDeviceDocuments(lists, input.devices, attachment.category, attachment.mimeType, attachment.id);
      attachment.deviceReferences = [...(attachment.deviceReferences || [])];
      for(const reference of currentReferences){const index=attachment.deviceReferences.findIndex(item=>referenceKey(item)===referenceKey(reference));if(index<0)attachment.deviceReferences.push(reference);else if(needsRecheck)attachment.deviceReferences[index]={...attachment.deviceReferences[index],...reference};}
      await writeJson(files.geraetelisten, lists);
      await writeJson(files.anhaenge, attachments);
      return { attachmentId: attachment.id, devices: attachment.deviceReferences, revalidated:needsRecheck };
    });
  }
  async function removeInternalProjectDocument(auth, projectId, ifMatch, attachmentId) {
    parse(id, attachmentId);
    return mutate(auth, projectId, ifMatch, async files => {
      const attachments = await read(auth, projectId, "anhaenge");
      if (!Array.isArray(attachments)) throw fault("Die Anhangsliste ist ungültig.", 409, "INVALID_ATTACHMENTS");
      const attachment = attachments.find(item => item.id === attachmentId);
      if (!attachment) throw fault("Interner Projekttext-Anhang wurde nicht gefunden.", 404, "NOT_FOUND");
      const provenance = attachment.assistantProvenance;
      const projectText = provenance?.projectDocument;
      if (!projectText || projectText.scope === "documentation") throw fault("Über MCP dürfen nur interne Projekttext-Entwürfe entfernt werden.", 403, "INTERNAL_DOCUMENT_ONLY");
      const proposal = createDocumentAssistantService(root).get(auth.user.id, provenance.jobId).documents.find(item => item.id === provenance.proposalId);
      if (!proposal || proposal.state !== "approved" || proposal.attachmentId !== attachment.id) throw fault("Die manuelle Freigabe dieses internen Entwurfs ist nicht nachweisbar.", 409, "APPROVED_DOCUMENT_REQUIRED");
      const brandschutz = await read(auth, projectId, "brandschutz");
      await writeJson(files.anhaenge, attachments.filter(item => item.id !== attachmentId));
      await writeJson(files.brandschutz, (Array.isArray(brandschutz) ? brandschutz : []).map(item => ({
        ...item,
        foto_vorher: item.foto_vorher === attachment.relativePath ? "" : item.foto_vorher,
        foto_nachher: item.foto_nachher === attachment.relativePath ? "" : item.foto_nachher
      })));
      if (projectText.documentId) {
        const projectData = await read(auth, projectId, "projekt");
        const previous = projectData.dokumentInhalte?.[projectText.documentId];
        if (previous?.attachmentId === attachmentId) {
          projectData.dokumentInhalte = { ...(projectData.dokumentInhalte || {}) };
          delete projectData.dokumentInhalte[projectText.documentId];
          projectData.interneDokumente = { ...(projectData.interneDokumente || {}), [projectText.documentId]: { ...projectText, sha256: provenance.sha256 || previous.sha256, approvedAt: provenance.approvedAt || previous.approvedAt, approvedBy: provenance.approvedBy || previous.approvedBy } };
          await writeJson(files.projekt, projectData);
        }
      }
      await deleteAttachment(root, [attachment], attachmentId, files);
      return { attachmentId, removed: true, recoverable: true };
    });
  }
  async function patchAttachment(auth, projectId, ifMatch, attachmentId, body) {
    parse(id, attachmentId);
    const input = parse(attachmentPatch, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const attachments = await read(auth, projectId, "anhaenge");
      if (!Array.isArray(attachments)) throw fault("Die Anhangsliste ist ungültig.", 409, "INVALID_ATTACHMENTS");
      const current = attachments.find(item => item.id === attachmentId);
      if (!current) throw fault("Anhang wurde nicht gefunden.", 404, "NOT_FOUND");
      const projectText = current.assistantProvenance?.projectDocument;
      if (projectText && projectText.scope !== "documentation") throw fault("Interne Projekttexte dürfen nicht als normale Anhänge umkategorisiert werden.", 403, "INTERNAL_DOCUMENT_ONLY");
      const category = input.category || current.category;
      const categoryChanged = category !== current.category;
      if (categoryChanged && current.deviceReferences?.length) throw fault("Vor einer Kategorienänderung zuerst die Geräteverknüpfung prüfen.", 409, "DEVICE_DOCUMENT_CATEGORY_CONFLICT");
      const categoryDefaults = defaultDocumentMetaForCategory(category);
      const updated = updateAttachmentDocumentMeta(attachments, attachmentId, {
        ...current,
        ...input,
        category,
        kapitel: categoryChanged ? categoryDefaults.kapitel || "" : current.kapitel,
        export: current.export
      });
      const synced = await syncAttachmentFileName(root, files, updated, attachmentId);
      await writeJson(files.anhaenge, synced.attachments);
      return synced.attachments.find(item => item.id === attachmentId);
    });
  }
  async function selectServiceAreas(auth, projectId, ifMatch, body) {
    const input = parse(serviceAreaSelection, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const current = await read(auth, projectId, "leistungsbereiche");
      const lists = await read(auth, projectId, "geraetelisten");
      if (!Array.isArray(lists) || lists.some(list => !list || !Array.isArray(list.positionen))) throw fault("Das ältere Geräteformat muss vor einer API-Änderung in der Oberfläche geprüft werden.", 409, "LEGACY_DEVICE_FORMAT");
      if (input.active.some(area => !(current.optionen || []).includes(area))) throw fault("Ein Leistungsbereich ist nicht in den Projektvorgaben vorhanden.", 400, "UNKNOWN_SERVICE_AREA");
      await writeJson(files.leistungsbereiche, { ...current, aktiv: [...new Set(input.active)] });
      await syncProjectDerivedData(root, files);
      return read(auth, projectId, "leistungsbereiche");
    });
  }
  async function selectDocuments(auth, projectId, ifMatch, body) {
    const input = parse(documentSelection, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const matrix = await read(auth, projectId, "dokumentenmatrix");
      if (new Set(input.items.map(item => item.id)).size !== input.items.length) throw fault("Eine Dokumentkennung wurde mehrfach angegeben.", 400, "VALIDATION_ERROR");
      for (const item of input.items) {
        const entries = matrix.filter(entry => entry.id === item.id);
        if (entries.length !== 1) throw fault("Dokument wurde nicht eindeutig gefunden.", 404, "NOT_FOUND");
        if (entries[0].pflicht && (item.active === false || item.export === false)) throw fault("Pflichtdokumente dürfen nicht über die API ausgeblendet werden.", 403, "REQUIRED_DOCUMENT");
        if (item.active !== undefined) entries[0].aktiv = item.active;
        if (item.export !== undefined) { entries[0].export = item.export; if (item.export) entries[0].aktiv = true; }
      }
      await writeJson(files.dokumentenmatrix, matrix);
      return matrix;
    });
  }
  async function selectSystems(auth, projectId, ifMatch, body) {
    return mutate(auth, projectId, ifMatch, async () => saveSystemSelections(await loadProjectWorkspace(root, auth.user.id, projectId), body));
  }

  async function changePosition(auth, projectId, listId, position, ifMatch, body, options = {}) {
    const patch = parse(positionPatch, body);
    return mutate(auth, projectId, ifMatch, async files => {
      const lists = await devices(auth, projectId);
      const matches = lists.filter(list => list.id === listId);
      if (matches.length !== 1 || !Array.isArray(matches[0].positionen)) throw fault("Geräteliste wurde nicht eindeutig gefunden.", 404, "NOT_FOUND");
      const list = matches[0];
      if (list.aktiv === false) throw fault("Bitte den Leistungsbereich vor dem Eintragen von Geräten aktivieren.", 409, "INACTIVE_DEVICE_LIST");
      const fields = new Set(deviceListFieldsForLeistungsbereich(list.leistungsbereich).map(field => field.name));
      if (Object.keys(patch).some(field => !fields.has(field))) throw fault("Ein Feld gehört nicht zum gewählten Leistungsbereich. Die Feldbeschreibung der Geräteliste neu lesen.", 400, "DEVICE_FIELD_MISMATCH");
      const categoryField=deviceListFieldsForLeistungsbereich(list.leistungsbereich).find(field=>field.name==='kategorie');
      if(patch.kategorie!==undefined&&categoryField?.guiVisible===false&&!['',require('./documentationMaterialPolicy').MANUAL_CONSUMABLE_CATEGORY].includes(patch.kategorie))throw fault('Diese Liste unterstützt nur die ausdrückliche interne Verbrauchsmaterial-Kennzeichnung.',400,'DEVICE_FIELD_MISMATCH');
      let result;
      if (position === null) {
        require("./documentationMaterialPolicy").assertIncluded(patch,await readJson(files.projekt,{}));
        if (list.positionen.length >= 10000) throw fault("Geräteliste hat die maximale Größe erreicht.", 409, "LIST_LIMIT");
        const positions = list.positionen.map((entry, i) => Number(entry.pos || i + 1));
        const db=connection();
        const reserved=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_item_deletions'").get()?db.prepare("SELECT COALESCE(MAX(json_extract(snapshot,'$.target.position')),0) AS position FROM project_item_deletions WHERE user_id=? AND project_id=? AND kind='device' AND json_extract(snapshot,'$.generation')=? AND json_extract(snapshot,'$.target.listId')=?").get(auth.user.id,projectId,projectResetGeneration(db,auth.user.id,projectId),listId).position:0;
        const pos = Math.max(Number(list.positionSequence) || 0, 0, ...positions,reserved) + 1;
        if (!Number.isSafeInteger(pos)) throw fault("Positionsnummern müssen zuerst bereinigt werden.", 409, "INVALID_POSITIONS");
        result = { pos, ...patch };
        list.positionSequence = pos;
        list.positionen.push(result);
      } else {
        const entries = list.positionen.filter((entry, i) => Number(entry.pos || i + 1) === position);
        if (entries.length !== 1) throw fault("Geräteposition wurde nicht eindeutig gefunden.", 404, "NOT_FOUND");
        Object.assign(entries[0], patch);
        result = entries[0];
      }
      // Führendes Dokument ändern; die vorhandenen Trigger pflegen die Geräteprojektion.
      await writeJson(files.geraetelisten, lists);
      return result;
    }, options);
  }
  return { project, list, get, section, devices, linkApprovedDocument, removeInternalProjectDocument, patchAttachment, patchProject, changePosition, revision, selectServiceAreas, selectDocuments, selectSystems, mutate, read };
}

module.exports = { createIntegrationService, parse, fault };
