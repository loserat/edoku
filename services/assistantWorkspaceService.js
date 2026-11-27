// Reine Darstellung des vorhandenen Bestands; keine zweite Aufgabenhaltung.
const { compareReviewDocuments } = require('./assistantReviewNavigation');
function buildWorkspace(entries) {
  const rows = [], projects = new Map();
  for (const entry of entries) {
    const { job, pending, openQuestions, projectReadiness, datasheetCoverage } = entry;
    const base = '/assistent/auftraege/' + job.id;
    const label = [entry.project?.projektname || job.projectId, entry.project?.projektnummer].filter(Boolean).join(' · ');
    const work = (entry.workItems || []).filter(item => item.state !== 'resume');
    const add = row => rows.push({ ...row, key: job.id + ':' + row.key, base, projectLabel: label, job, revision: entry.revision });
    const stateFor = (kind, id) => work.find(item => item.target.kind === kind && item.target[kind === 'question' ? 'questionId' : 'requirementId'] === id);
    [...pending].sort(compareReviewDocuments).forEach(document => add({ key: document.id, kind: 'file', title: document.title, subtitle: [document.category, document.anlage, document.stockwerk].filter(Boolean).join(' · '), href: base + '/dateien/' + document.id, status: 'Zu prüfen', action: 'Prüfen' }));
    openQuestions.forEach(question => { const record = stateFor('question', question.id); add({ key: question.id, kind: record ? 'waiting' : 'question', title: question.prompt, subtitle: 'Fehlende Angabe', question, target: { kind: 'question', questionId: question.id }, record, status: record ? 'Wartet' : 'Antwort offen', action: 'Bearbeiten' }); });
    const proposed = new Set(pending.flatMap(document => document.requirementIds || []));
    projectReadiness.requirements.filter(item => item.applicable !== false && !item.fulfilled && item.scope !== 'internal' && !proposed.has(item.id)).forEach(requirement => {
      // Datenblattartikel besitzen ihre eigene vollständige Bestandsansicht.
      if (requirement.category === 'Datenblätter' && (requirement.devices?.length || requirement.device)) return;
      const record = stateFor('requirement', requirement.id);
      add({ key: requirement.id, kind: record ? 'waiting' : 'source', title: requirement.title, subtitle: requirement.category, target: { kind: 'requirement', requirementId: requirement.id }, record, status: record ? 'Wartet' : 'Quelle fehlt', action: 'Ansehen' });
    });
    // Mehrere Aufträge desselben Projekts zählen Artikel nur einmal.
    if (!projects.has(job.projectId)) {
      projects.set(job.projectId, datasheetCoverage.summary);
      datasheetCoverage.items.filter(item => !['approved','pending'].includes(item.status)).forEach(article => {
        const waiting = ['not_found','needs_identity','blocked'].includes(article.status);
        add({ key: article.id, kind: waiting ? 'waiting' : 'article', title: [article.manufacturer, article.model].filter(Boolean).join(' · ') || 'Artikelangabe fehlt', subtitle: 'Datenblatt · ' + article.references.length + ' Positionen', article, href: base + '?ansicht=datenblaetter&deckung=all#artikel-' + article.id, status: waiting ? 'Wartet' : 'Datenblatt offen', action: 'Ansehen', record: article.search ? { reason: article.search.reason, resumeCondition: 'Neue Artikelangaben oder eine passende Herstellerquelle', sources: article.search.sources } : null });
      });
    }
    entry.agentIssues.forEach((issue, index) => add({ key: 'issue-' + index, kind: 'source', title: issue.message, subtitle: 'Projekt ergänzen', href: base + '?ansicht=angaben', status: 'Zu klären', action: 'Details' }));
  }
  const groups = [
    { id: 'file', title: 'Dateien prüfen', kinds: ['file'] },
    { id: 'question', title: 'Angaben ergänzen', kinds: ['question'] },
    { id: 'research', title: 'Unterlagen & Zuordnungen', kinds: ['source', 'article'] },
    { id: 'waiting', title: 'Wartet', kinds: ['waiting'] }
  ].map(group => ({ ...group, rows: rows.filter(row => group.kinds.includes(row.kind)) }));
  // Nur vorhandene GUI-Aktionen priorisieren. Keine neue fachliche Aufgabensteuerung.
  const next = groups.filter(group => group.id !== 'waiting').flatMap(group => group.rows)[0] || null;
  return { rows, groups, next, counts: { files: groups[0].rows.length, questions: groups[1].rows.length, research: groups[2].rows.length, waiting: groups[3].rows.length, articles: [...projects.values()].reduce((n,s) => n + s.articles,0), approved: [...projects.values()].reduce((n,s) => n + s.approved,0) } };
}
module.exports = { buildWorkspace };
