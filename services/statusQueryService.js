const { fault } = require('../src/api/validation');

const brief = (value, max = 240) => {
  const chars = Array.from(String(value || ''));
  return chars.length <= max ? chars.join('') : chars.slice(0, max).join('') + '…';
};
// Count the escaped representation too: text-only MCP must fit the same limit.
const encodedBytes = value => Buffer.byteLength(JSON.stringify(JSON.stringify(value)), 'utf8');
function statusPage(base, rows, { limit, offset, view = 'compact' }, project = row => row) {
  const selected = rows.slice(offset, offset + limit), items = [];
  const result = () => ({ ...base, items, total: rows.length, limit, offset, returned: items.length,
    hasMore: offset + items.length < rows.length, nextOffset: offset + items.length < rows.length ? offset + items.length : null });
  const budget = view === 'compact' ? 6144 : 28672;
  for (const row of selected) {
    items.push(project(row));
    if (encodedBytes(result()) > budget) {
      items.pop();
      if (!items.length) throw fault('Eintrag zu groß. Gezielt die Detailquelle oder kleinere Unterabschnitte abrufen.', 413, 'RESPONSE_LIMIT');
      break;
    }
  }
  const value = result();
  if (encodedBytes(value) > budget) throw fault('Statusantwort zu groß. Abschnitt und Ziel gezielt auswählen.', 413, 'RESPONSE_LIMIT');
  return value;
}
const pick = (row, fields) => Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
function compactStatusRow(section, row) {
  if (section === 'requirements') return { ...pick(row, ['id', 'jobId', 'category', 'scope', 'applicable', 'exclusionReason', 'fulfilled', 'fulfilledBy']), title: brief(row.title, 200),
    deviceCount: (row.devices || (row.device ? [row.device] : [])).length, dependencyCount: (row.dependsOn || []).length };
  if (section === 'issues') return { ...pick(row, ['code', 'jobId', 'requirementId', 'questionId', 'listId', 'position', 'field', 'documentId', 'proposalId', 'entryId']),
    key: brief(row.key, 300), message: brief(row.message), detailsAvailable: true };
  if (section === 'questions') return { id: row.id, prompt: brief(row.prompt), required: row.required, issueKey: brief(row.issueKey, 300) };
  if (section === 'documents') return { ...pick(row, ['jobId', 'proposalId']), title: brief(row.title, 200) };
  return { ...pick(row, ['id', 'status', 'required']), title: brief(row.title, 200), reason: brief(row.reason) };
}
function readinessView(status, query, jobVersion = null) {
  if (query.view === 'full' && query.section === 'summary') return status;
  const counts = { issues: status.issues.length, questions: status.suggestedQuestions.length, pendingDocuments: status.pendingDocuments.length,
    requirements: status.requirements.length, fulfilledRequirements: status.requirements.filter(row => row.fulfilled && row.applicable !== false).length,
    missingRequirements: status.requirements.filter(row => !row.fulfilled && row.applicable !== false).length,
    inactiveRequirements: status.requirements.filter(row => row.applicable === false).length, missingOutputs: status.export.missingOutputs.length };
  const { missingOutputs, ...exportSummary } = status.export;
  const base = { ...pick(status, ['projectId', 'revision', 'canGenerate', 'inputComplete', 'reviewComplete', 'technicalExportComplete', 'professionalApproval', 'firestopDocumentation', 'datasheets']),
    assistantJobId: query.assistantJobId || null, jobVersion, view: query.view, section: query.section, counts,
    issueCounts: status.issues.reduce((counts, row) => ({ ...counts, [row.code]: (counts[row.code] || 0) + 1 }), {}),
    export: { ...exportSummary, missingOutputCount: missingOutputs.length } };
  if (query.section === 'summary') {
    if (encodedBytes(base) > 6144) throw fault('Statuszusammenfassung zu groß.', 413, 'RESPONSE_LIMIT');
    return base;
  }
  let rows = { issues: status.issues, questions: status.suggestedQuestions, documents: status.pendingDocuments, requirements: status.requirements, outputs: missingOutputs }[query.section];
  if (query.entryId) {
    rows = rows.filter(row => row.id === query.entryId);
    if (!rows.length) throw fault('Anforderung wurde nicht gefunden.', 404, 'NOT_FOUND');
  }
  return statusPage(base, rows, query, query.view === 'compact' ? row => compactStatusRow(query.section, row) : row => row);
}
function compactWorkRow(row) {
  return { target: row.target, state: row.state, reason: brief(row.reason), ...(row.resumeCondition ? { resumeCondition: brief(row.resumeCondition, 160) } : {}),
    recordedAt: row.recordedAt, recordedBy: row.recordedBy, sourceCount: (row.sources || []).length,
    evidenceKind: row.evidence.kind, detailsAvailable: true };
}
module.exports = { brief, encodedBytes, statusPage, readinessView, compactWorkRow };
