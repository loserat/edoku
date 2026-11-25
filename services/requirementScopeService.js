function requirementScope(project, jobId, requirement) {
  // Device originals remain documentation requirements, including on older projects.
  if (requirement.firestop || requirement.device || requirement.devices?.length || project.assistantWorkflow?.jobId !== jobId) return 'documentation';
  const scopes = project.assistantWorkflow.requirementScopes;
  return Array.isArray(scopes) && scopes.some(item => item?.id === requirement.id && item.scope === 'internal') ? 'internal' : 'documentation';
}
function internalProposal(document) {
  return Boolean(document.projectDocument && document.projectDocument.scope !== 'documentation');
}
function assertProposalScope(project, jobId, requirements, metadata, fault) {
  if (requirements.some(requirement => metadata.requirementIds.includes(requirement.id) && requirementScope(project, jobId, requirement) === 'internal') && !internalProposal(metadata)) throw fault('Diese Anforderung ist als interne Projektunterlage festgelegt. Einen internen Projekttext vorbereiten; keine Kundenanlage übernehmen.', 409, 'REQUIREMENT_SCOPE_MISMATCH');
}
module.exports = { requirementScope, internalProposal, assertProposalScope };
