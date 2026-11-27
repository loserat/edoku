// Add only schema-valid, focused calls. Research URLs and actual user facts remain inputs.
function attach(task,{projectId,jobId,etag}) {
  if (!task) return task;
  const scope = {projectId,...(jobId?{jobId}:{})};
  if (task.tool === 'edoku_repair_document_references') task.call = {tool:task.tool,arguments:{projectId,attachmentId:task.attachmentId,mode:'preview'}};
  else if (task.code === 'LINK_EXISTING_DATASHEET' && task.documents?.length === 1) task.call = {tool:task.tool,arguments:{projectId,etag,input:{attachmentId:task.documents[0].id,devices:task.devices}}};
  else if (task.target?.kind === 'requirement') task.contextRead = {tool:'edoku_documentation_status',arguments:{...scope,section:'requirements',entryId:task.target.requirementId,limit:1}};
  else if (task.target?.kind === 'article') task.contextRead = {tool:'edoku_datasheet_coverage',arguments:{projectId,articleId:task.target.articleId,limit:1}};
  else if (task.target?.kind === 'device') task.contextRead = {tool:'edoku_get_device_list',arguments:{projectId,listId:task.target.listId,position:task.target.position,limit:1}};
  else if (task.questionId) task.contextRead = {tool:'edoku_get_documentation_job',arguments:{...scope,section:'questions',entryId:task.questionId,limit:1}};
  if (['RESEARCH_DATASHEET','RETRY_DATASHEET_CHECK'].includes(task.code)) task.requiredInputs = ['manufacturerPageUrl','sourceUrl'];
  return task;
}
module.exports = {attach};
