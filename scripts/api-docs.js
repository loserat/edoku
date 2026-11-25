// Reproduzierbare Referenz aus OpenAPI und echtem MCP-tools/list, ohne API-Zugang.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),readline=require('node:readline');
const root=path.resolve(__dirname,'..');
const routes={
 edoku_material_import:['getMaterialImport'],edoku_record_material_import:['recordMaterialImport'],
 edoku_find_manufacturer_documents:['discoverManufacturerLinks'],
 edoku_fire_protection_guide:['getFireProtectionGuide'],
 edoku_knowledge:['getDocumentationKnowledge'],
 edoku_preview_deletion:['previewItemDeletion'],edoku_list_deletions:['listItemDeletions'],edoku_delete_device_position:['deleteDevicePosition'],edoku_delete_document:['deleteProjectDocument'],edoku_delete_documentation_job:['deleteDocumentationJob'],edoku_restore_deleted_item:['restoreDeletedItem'],
 edoku_preview_project_reset:['previewProjectReset'],edoku_reset_project:['resetProject'],
 edoku_chat_decisions:['getChatDecisions'],
 edoku_record_chat_decision:['recordChatDecision'],
 edoku_document_work_status:['getDocumentWork'],edoku_record_document_work:['recordDocumentWork'],
 edoku_identity:['getIntegrationIdentity'],edoku_datasheet_coverage:['getDatasheetCoverage'],edoku_list_projects:['listProjects'],edoku_get_project:['getProject'],
 edoku_get_section:['get_service_areas','get_systems','get_system_catalog','get_documents','get_firestops','get_attachments','get_exports'],
 edoku_list_device_lists:['listDeviceLists'],edoku_get_device_list:['getDeviceList'],edoku_list_documentation_jobs:['listDocumentationJobs'],edoku_get_documentation_job:['getDocumentationJob'],
 edoku_documentation_status:['getDocumentationStatus'],edoku_list_export_jobs:['listExportJobs'],edoku_get_export_job:['getExportJob'],edoku_next_action:['getNextDocumentationAction'],
 edoku_record_datasheet_search:['recordDatasheetSearch'],edoku_start_workflow:['startDocumentationWorkflow'],edoku_ask_question:['askContextualQuestion'],edoku_record_research:['recordProductResearch'],
 edoku_link_existing_document:['linkApprovedDocument'],edoku_patch_attachment:['patchAttachment'],edoku_remove_internal_project_document:['removeInternalProjectDocument'],edoku_patch_project:['patchProject'],
 edoku_add_device_position:['addDevicePosition'],edoku_patch_device_position:['patchDevicePosition'],edoku_create_documentation_job:['createDocumentationJob'],edoku_create_project:['createProject'],
 edoku_select_service_areas:['select_service_areas'],edoku_select_systems:['select_systems'],edoku_select_documents:['select_documents'],edoku_queue_export:['queueExport'],edoku_cancel_export:['cancelExportJob'],
 edoku_retry_export:['retryExportJob'],edoku_update_documentation_job:['updateDocumentationJob'],edoku_correct_requirement_devices:['correctRequirementDevices'],edoku_record_user_answers:['recordUserAnswers'],
 edoku_withdraw_document_proposals:['withdrawDocumentProposals'],edoku_replace_document_proposals:['replaceDocumentProposals'],edoku_prepare_project_document:['prepareProjectDocument'],edoku_propose_document:['proposeDocument','checkOrProposeManufacturerDocument']
};
async function catalog(allowWrites){
 const child=spawn(process.execPath,[path.join(root,'scripts/edoku-mcp.js')],{cwd:root,env:{...process.env,EDOKU_API_URL:'http://127.0.0.1:1',EDOKU_API_TOKEN:'edoku_'+'0'.repeat(24)+'.'+'0'.repeat(64),EDOKU_MCP_ALLOW_WRITES:String(allowWrites),EDOKU_MCP_DOCUMENT_ROOT:''},stdio:['pipe','pipe','pipe']});
 const pending=new Map();let sequence=0,errors='';
 child.stderr.on('data',data=>{errors=(errors+data).slice(-2000)});
 const fail=error=>{for(const p of pending.values()){clearTimeout(p.timeout);p.reject(error)}pending.clear()};
 child.on('error',fail);child.on('exit',()=>fail(Error('MCP-Dokumentationsprozess beendet: '+errors)));
 readline.createInterface({input:child.stdout}).on('line',line=>{try{const response=JSON.parse(line),p=pending.get(response.id);if(p){pending.delete(response.id);clearTimeout(p.timeout);response.error?p.reject(Error(JSON.stringify(response.error))):p.resolve(response.result)}}catch(error){fail(error)}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{pending.delete(id);reject(Error('MCP-Dokumentationsabfrage abgelaufen'))},10000);pending.set(id,{resolve,reject,timeout});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')});
 try{
  const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'edoku-docs',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const first=await rpc('tools/list',{}),tools=[...first.tools];let cursor=first.nextCursor;while(cursor){const page=await rpc('tools/list',{cursor});tools.push(...page.tools);cursor=page.nextCursor;}return {server:init.serverInfo,instructions:init.instructions,tools:tools.sort((a,b)=>a.name.localeCompare(b.name,'en'))};
 }finally{if(child.exitCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed}fail(Error('Dokumentationsabfrage geschlossen'))}
}
const json=value=>JSON.stringify(value,null,2)+'\n';
const cell=value=>String(value??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
const code=value=>'`'+cell(value)+'`';
function operationIndex(api){return Object.entries(api.paths).flatMap(([url,methods])=>Object.entries(methods).map(([method,op])=>({url,method:method.toUpperCase(),...op}))).sort((a,b)=>a.url.localeCompare(b.url,'en')||a.method.localeCompare(b.method,'en'))}
function validateMap(operations,full,read){
 const ids=new Set(operations.map(x=>x.operationId)),names=new Set(full.tools.map(x=>x.name));
 for(const name of Object.keys(routes))if(!names.has(name))throw Error('MCP-Zuordnung ohne Werkzeug: '+name);
 for(const tool of full.tools){if(!routes[tool.name]?.length)throw Error('MCP-Zuordnung fehlt: '+tool.name);for(const id of routes[tool.name])if(!ids.has(id))throw Error('Unbekannte API-Operation: '+id)}
 const readonly=full.tools.filter(t=>t.annotations?.readOnlyHint).map(t=>t.name).sort();
 if(json(readonly)!==json(read.tools.map(t=>t.name).sort()))throw Error('Lesekatalog und Lesehinweise stimmen nicht überein');
}
async function generate(){
 const api=require('../src/api/openapi'),[full,read]=await Promise.all([catalog(true),catalog(false)]),operations=operationIndex(api);validateMap(operations,full,read);
 const sources=['services/materialImportService.js','src/api/materialImportSchemas.js','services/autonomousWorkflowService.js','services/documentationMaterialPolicy.js','src/api/materialPolicySchemas.js','services/emptyProjectService.js','src/api/knowledgeSchemas.js','services/knowledgeService.js','services/firestopDocumentationService.js','services/systemService.js','services/systemSelectionService.js','services/systemCatalogService.js','services/projectWorkspaceService.js','services/productDocumentVerificationService.js','services/productDocumentMatchingService.js','services/productDimensionEvidenceService.js','services/manufacturerSourcePolicy.js','services/manufacturerPageService.js','services/workers/pdfTextWorker.mjs','src/api/productDocumentSchemas.js','services/documentAssistantService.js','src/api/http.js','services/mcpDocumentSourceService.js','src/api/deletionSchemas.js','services/itemDeletionService.js','services/deletionPatchService.js','services/deletionEvidenceService.js','services/projectService.js','src/api/resetSchemas.js','services/projectResetService.js','services/idempotencyService.js','services/exportJobService.js','services/geraetelistenService.js','src/api/agentSchemas.js','services/agentContractService.js','src/api/documentWorkSchemas.js','services/documentWorkService.js','src/api/openapi.js','src/api/schemas.js','src/api/assistantSchemas.js','src/api/workflowSchemas.js','src/api/datasheetSchemas.js','src/api/responses.js','src/routes/integration.routes.js','services/mcpServerService.js','services/integrationService.js','services/documentAssistantService.js','services/documentationWorkflowService.js','services/documentationReadinessService.js','services/datasheetCoverageService.js','services/deviceDocumentService.js','services/requirementScopeService.js','services/projectDataStoreService.js','services/apiTokenService.js','services/exportJobService.js','scripts/edoku-mcp.js'];
 const hashes=Object.fromEntries(await Promise.all(sources.map(async file=>[file,crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')])));
 const manifest={apiVersion:api.info.version,mcpVersion:full.server.version,operations:operations.length,readTools:read.tools.length,writeTools:full.tools.length-read.tools.length,totalTools:full.tools.length,sources:hashes};
 let md='# API-/MCP-Vertragsinventar\n\nAutomatisch erzeugt mit `npm run docs:api`. Nicht von Hand bearbeiten. `npm run docs:check` erkennt Abweichungen. Diese Referenz beschreibt den Quellstand; der Betriebsstand steht in [AKTUELLER_STAND.md](../AKTUELLER_STAND.md).\n\n';
 md+=`OpenAPI **${api.info.version}** · MCP **${full.server.version}** · **${operations.length} HTTP-Operationen** · **${read.tools.length} Lese- / ${full.tools.length-read.tools.length} Schreibwerkzeuge**.\n\n`;
 md+='## HTTP-Vertrag\n\nAlle Pfade beginnen mit `/api/v1`. Rechte sind zusätzlich zur Benutzer-/Projektgrenze nötig. If-Match und Auftragsversion sind verschiedene Schutzmechanismen. Schema und sämtliche Pflichtfelder: [openapi.json](openapi.json).\n\n| Methode | Pfad | Rechte | Versions-/Wiederholungsschutz | Operation |\n| --- | --- | --- | --- | --- |\n';
 for(const o of operations){const p=o.parameters||[],body=o.requestBody?.content?.['application/json']?.schema,guards=[];if(p.some(x=>x.name==='If-Match'))guards.push('Projekt-ETag');if(body?.properties?.version)guards.push('Auftragsversion');if(body?.properties?.jobVersion)guards.push('Auftragsversion bedingt');const key=p.find(x=>x.name==='Idempotency-Key');if(key)guards.push(key.required?'Wiederholungsschlüssel':'Wiederholungsschlüssel optional');md+=`| ${o.method} | ${code(o.url)} | ${cell(o.description?.replace(/^Erforderliche Rechte: /,'')||'Öffentlich')} | ${guards.join(', ')||'—'} | ${code(o.operationId)} |\n`}
 md+='\n## MCP-Zuordnung\n\nVollständige Eingabeschemas und Serveranweisungen: [mcp-tools.json](mcp-tools.json). Die Zuordnung zu operationId ist bewusst gepflegt und wird auf Vollständigkeit geprüft. HTTP-Download und OpenAPI-Abruf haben kein eigenes MCP-Werkzeug. Werkzeughinweise ersetzen keine serverseitige Rechteprüfung.\n\n| Werkzeug | Art | Pflichtargumente | API-Operationen |\n| --- | --- | --- | --- |\n';
 for(const t of full.tools)md+=`| ${code(t.name)} | ${t.annotations?.readOnlyHint?'Lesen':'Schreiben'} | ${(t.inputSchema.required||[]).map(code).join(', ')||'—'} | ${routes[t.name].map(code).join(', ')} |\n`;
 md+='\nDie Beschreibung und das jeweilige Schema entscheiden über verschachtelte Pflichtfelder. Dateivorschläge werden ausschließlich in der angemeldeten GUI nach Sichtung und Einzelbestätigung übernommen. API und MCP stellen keine Dateifreigabe bereit. Internetrecherche führt der externe Agent aus; tools/list führt weder API-Aufrufe noch Recherche aus.\n';
 return {'openapi.json':json(api),'mcp-tools.json':json({...full,readOnlyToolNames:read.tools.map(t=>t.name),operationMap:routes}),'manifest.json':json(manifest),'README.md':md};
}
async function main(){const files=await generate(),check=process.argv.includes('--check'),folder=path.join(root,'docs/api'),stale=[];if(!check)await fs.mkdir(folder,{recursive:true});for(const[name,text]of Object.entries(files)){const file=path.join(folder,name);if(check){if(await fs.readFile(file,'utf8').catch(()=>null)!==text)stale.push('docs/api/'+name)}else await fs.writeFile(file,text)}if(stale.length)throw Error('API-/MCP-Dokumentation veraltet: '+stale.join(', ')+'; npm run docs:api ausführen und Änderungen prüfen.');console.log(JSON.stringify({documentation:check?'aktuell':'erzeugt',...JSON.parse(files['manifest.json']),sources:undefined}))}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={catalog,generate,operationIndex,validateMap};
