const { guideQuery } = require('../src/api/fireProtectionSchemas');
const { parse, fault } = require('../src/api/validation');
const { loadProjectWorkspace } = require('./projectWorkspaceService');
const { createDocumentAssistantService } = require('./documentAssistantService');
const knowledge = require('./knowledgeService');
const store = require('./projectDataStoreService');
const { statusPage, brief } = require('./statusQueryService');
const policy = require('./fireProtectionPolicy');

function createFireProtectionGuideService(root) {
  const assistant = createDocumentAssistantService(root);
  async function inspect(userId, projectId, raw = {}) {
    return store.withProjectDataTransaction(async () => {
      const query = parse(guideQuery, raw);
      assistant.project(userId, projectId);
      const job = query.jobId ? assistant.get(userId, query.jobId) : null;
      if (job && job.projectId !== projectId) throw fault('Auftrag wurde nicht gefunden.', 404, 'NOT_FOUND');
      const data = await loadProjectWorkspace(root, userId, projectId);
      let manufacturer = query.manufacturer || '', model = query.model || '', row, subject;
      if (query.listId) {
        const lists = data.geraetelisten.filter(list => list.id === query.listId && list.aktiv !== false && data.leistungsbereiche.aktiv.includes(list.leistungsbereich));
        const rows = lists.length === 1 ? lists[0].positionen.filter((value, index) => Number(value.pos || index + 1) === query.position) : [];
        if (rows.length !== 1) throw fault('Aktive Geräteposition wurde nicht eindeutig gefunden.', 404, 'NOT_FOUND');
        row = rows[0]; manufacturer = row.hersteller || ''; model = row.typ || '';
        subject = { kind: 'device', listId: query.listId, position: query.position };
      }
      const hint = policy.classify({ manufacturer, model, system: row?.system, description: row?.beschreibung });
      const declared = job && subject ? knowledge.resolveFact(data, job, { subject, key: 'fireProtectionKind' }) : null;
      const installation = job && subject ? knowledge.resolveFact(data, job, { subject, key: 'installationStatus' }) : null;
      const conflict = (query.kind && hint.kind !== 'unknown' && query.kind !== hint.kind) || declared?.state === 'conflict' || (declared?.state === 'confirmed' && ((hint.kind !== 'unknown' && declared.value !== hint.kind) || (query.kind && query.kind !== declared.value)));
      const kind = conflict ? 'unknown' : query.kind || (declared?.state === 'confirmed' ? declared.value : hint.kind);
      const base = { projectId, jobId: job?.id || null, jobVersion: job?.version || null, policy: policy.POLICY, view: 'compact', section: query.section,
        assessment: 'guidance_only', fileApproval: 'manual_gui_per_file', professionalApproval: 'not_assessed',
        target: subject || null, article: { manufacturer: brief(manufacturer, 200), model: brief(model, 200) },
        classification: { ...hint, selectedKind: kind, ...(query.kind ? { requestedKind: query.kind } : {}), label: policy.labels[kind], ...(declared?.state === 'confirmed' ? { recordedKind: declared.value } : {}), conflict: Boolean(conflict) },
        installation: { state: installation?.state || 'unknown', basis: installation?.value || 'unknown', confirmed: installation?.state === 'confirmed' && installation.value === 'confirmed' } };
      if (query.section === 'summary') return { ...base,
        sequence: ['EAN/Artikel und Variante identifizieren', 'Abschottung, Kanal und Funktionserhalt unterscheiden', 'Vorhandene Originale und Entscheidungen abgleichen',
          'Hersteller-Systemunterlagen und passende Originalvorlage suchen', 'Artikel/System und tatsächliche Einbaudaten getrennt prüfen',
          'Vorlage, unvollständigen Entwurf und vorbereitete Erklärung kennzeichnen', 'Datei ausschließlich zur manuellen Einzelprüfung vorschlagen'],
        templatePolicy: 'Herstellerformular vor Eigenformular; Systemumfang prüfen. Falls nicht verfügbar, Muster im passenden Systemnachweis suchen und Nichtfund belegen.',
        draftPolicy: 'Testannahmen, DUMMY-Werte und offene Angaben sichtbar lassen; Entwürfe/Vorlagen erfüllen keine Pflicht. Keine Unterschrift oder Systemauswahl erfinden.',
        questionPolicy: 'Vorhandene Belege zuerst strukturieren, quantity/identifier nutzen, Zurückstellungen respektieren und nur neue Einbaudaten fragen.' };
      let items = { documents: policy.documents(kind), questions: policy.questions(kind), sources: policy.sources(manufacturer, model, kind) }[query.section];
      if (query.section === 'questions') {
        items = items.map(item => {
          const targetSubject = item.subjectKind === 'project' ? { kind: 'project' } : subject;
          if (!job || !targetSubject) return { ...item, action: 'check_knowledge_first' };
          const fact = knowledge.resolveFact(data, job, { subject: targetSubject, key: item.key });
          return { ...item, target: { subject: targetSubject, key: item.key }, state: fact.state, factRevision: fact.revision, action: ['confirmed', 'deferred'].includes(fact.state) ? 'do_not_ask' : fact.state === 'conflict' ? 'clarify_conflict' : 'check_knowledge_first' };
        });
      }
      return statusPage(base, items, query);
    });
  }
  return { inspect };
}
module.exports = { createFireProtectionGuideService };
