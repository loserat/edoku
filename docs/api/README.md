# API-/MCP-Vertragsinventar

Automatisch erzeugt mit `npm run docs:api`. Nicht von Hand bearbeiten. `npm run docs:check` erkennt Abweichungen. Diese Referenz beschreibt den Quellstand. [Versionsschema](../VERSIONIERUNG.md) und [Prüfverfahren](../TESTS.md) ergänzen den Vertrag.

OpenAPI **3.15.0** · MCP **3.16.0** · **69 HTTP-Operationen** · **22 Lese- / 36 Schreibwerkzeuge**.

## HTTP-Vertrag

Alle Pfade beginnen mit `/api/v1`. Rechte sind zusätzlich zur Benutzer-/Projektgrenze nötig. If-Match und Auftragsversion sind verschiedene Schutzmechanismen. Schema und sämtliche Pflichtfelder: [openapi.json](openapi.json).

| Methode | Pfad | Rechte | Versions-/Wiederholungsschutz | Operation |
| --- | --- | --- | --- | --- |
| GET | `/me` | beliebiges gültiges Recht. | — | `getIntegrationIdentity` |
| GET | `/openapi.json` | Öffentlich | — | `getOpenApi` |
| GET | `/projects` | projects:read. | — | `listProjects` |
| POST | `/projects` | projects:write; unbeschränkter eigener Projektschlüssel. | Wiederholungsschlüssel | `createProject` |
| GET | `/projects/{projectId}` | projects:read. | — | `getProject` |
| PATCH | `/projects/{projectId}` | projects:write. | Projekt-ETag | `patchProject` |
| POST | `/projects/{projectId}/approved-document-links` | devices:write, documents:read. | Projekt-ETag | `linkApprovedDocument` |
| GET | `/projects/{projectId}/assistant/jobs` | assistant:read. | — | `listDocumentationJobs` |
| POST | `/projects/{projectId}/assistant/jobs` | assistant:write. | Wiederholungsschlüssel optional | `createDocumentationJob` |
| DELETE | `/projects/{projectId}/assistant/jobs/{jobId}` | projects:read, devices:read, documents:read, assistant:read, projects:write, devices:write, assistant:write. | Projekt-ETag, Wiederholungsschlüssel | `deleteDocumentationJob` |
| GET | `/projects/{projectId}/assistant/jobs/{jobId}` | assistant:read. | — | `getDocumentationJob` |
| PATCH | `/projects/{projectId}/assistant/jobs/{jobId}` | assistant:write. | — | `updateDocumentationJob` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/answers` | assistant:write. | Auftragsversion | `recordUserAnswers` |
| GET | `/projects/{projectId}/assistant/jobs/{jobId}/decisions` | assistant:read, projects:read. | — | `getChatDecisions` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/decisions` | projects:write, devices:read, assistant:read, assistant:write. | Projekt-ETag, Auftragsversion bedingt, Wiederholungsschlüssel | `recordChatDecision` |
| GET | `/projects/{projectId}/assistant/jobs/{jobId}/document-work` | projects:read, devices:read, assistant:read. | — | `getDocumentWork` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/document-work` | projects:write, devices:read, assistant:read, assistant:write. | Projekt-ETag, Auftragsversion bedingt | `recordDocumentWork` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/documents` | assistant:write. Nur Zwischenablage, keine Projektübernahme. Freigaben sind ausschließlich in der angemeldeten GUI möglich. Identische Dateien pro Auftrag werden anhand SHA-256 dedupliziert. Multipart-Anfrage höchstens 15 MiB. | — | `proposeDocument` |
| GET | `/projects/{projectId}/assistant/jobs/{jobId}/knowledge` | projects:read, devices:read, assistant:read. | — | `getDocumentationKnowledge` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/manufacturer-documents` | assistant:write, projects:read, devices:read, documents:read. | — | `checkOrProposeManufacturerDocument` |
| GET | `/projects/{projectId}/assistant/jobs/{jobId}/manufacturer-links` | projects:read, devices:read, documents:read, assistant:read. | — | `discoverManufacturerLinks` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/prepare-document` | assistant:write, projects:read, documents:read. | Projekt-ETag, Wiederholungsschlüssel | `prepareProjectDocument` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/questions` | assistant:write, projects:read, devices:read. | Auftragsversion | `askContextualQuestion` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/replacements` | assistant:write. | Auftragsversion | `replaceDocumentProposals` |
| PATCH | `/projects/{projectId}/assistant/jobs/{jobId}/requirements/{requirementId}` | assistant:write, projects:write, devices:read. | Projekt-ETag, Auftragsversion | `correctRequirementDevices` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/withdrawals` | assistant:write, projects:read, documents:read. | Auftragsversion | `withdrawDocumentProposals` |
| GET | `/projects/{projectId}/attachments` | documents:read. | — | `get_attachments` |
| DELETE | `/projects/{projectId}/attachments/{attachmentId}` | projects:read, devices:read, documents:read, assistant:read, projects:write, devices:write, assistant:write. | Projekt-ETag, Wiederholungsschlüssel | `deleteProjectDocument` |
| PATCH | `/projects/{projectId}/attachments/{attachmentId}` | projects:write. | Projekt-ETag | `patchAttachment` |
| GET | `/projects/{projectId}/attachments/{attachmentId}/device-repair` | projects:read, devices:read, documents:read, assistant:read. | — | `previewDeviceReferenceRepair` |
| POST | `/projects/{projectId}/attachments/{attachmentId}/device-repair` | projects:read, devices:read, documents:read, assistant:read, projects:write, devices:write. | Projekt-ETag | `repairDeviceReferences` |
| GET | `/projects/{projectId}/datasheet-coverage` | projects:read, devices:read, documents:read, assistant:read. | — | `getDatasheetCoverage` |
| POST | `/projects/{projectId}/datasheet-searches` | projects:write, devices:read, documents:read, assistant:read. | Projekt-ETag | `recordDatasheetSearch` |
| GET | `/projects/{projectId}/deletions` | projects:read, devices:read, documents:read, assistant:read. | — | `listItemDeletions` |
| POST | `/projects/{projectId}/deletions/{deletionId}/restore` | projects:read, devices:read, documents:read, assistant:read, projects:write, devices:write, assistant:write. | Projekt-ETag, Wiederholungsschlüssel | `restoreDeletedItem` |
| GET | `/projects/{projectId}/deletions/preview` | projects:read, devices:read, documents:read, assistant:read. | — | `previewItemDeletion` |
| GET | `/projects/{projectId}/device-lists` | devices:read. | — | `listDeviceLists` |
| GET | `/projects/{projectId}/device-lists/{listId}` | devices:read. | — | `getDeviceList` |
| POST | `/projects/{projectId}/device-lists/{listId}/positions` | devices:write. | Projekt-ETag, Wiederholungsschlüssel optional | `addDevicePosition` |
| DELETE | `/projects/{projectId}/device-lists/{listId}/positions/{position}` | projects:read, devices:read, documents:read, assistant:read, projects:write, devices:write, assistant:write. | Projekt-ETag, Wiederholungsschlüssel | `deleteDevicePosition` |
| PATCH | `/projects/{projectId}/device-lists/{listId}/positions/{position}` | devices:write. | Projekt-ETag | `patchDevicePosition` |
| GET | `/projects/{projectId}/documentation-status` | projects:read, devices:read, documents:read, assistant:read. | — | `getDocumentationStatus` |
| GET | `/projects/{projectId}/documents` | documents:read. | — | `get_documents` |
| PATCH | `/projects/{projectId}/documents` | projects:write. | Projekt-ETag | `select_documents` |
| GET | `/projects/{projectId}/export-jobs` | exports:read. | — | `listExportJobs` |
| POST | `/projects/{projectId}/export-jobs` | exports:write. | Wiederholungsschlüssel | `queueExport` |
| GET | `/projects/{projectId}/export-jobs/{exportId}` | exports:read. | — | `getExportJob` |
| POST | `/projects/{projectId}/export-jobs/{exportId}/cancel` | exports:write. | — | `cancelExportJob` |
| GET | `/projects/{projectId}/export-jobs/{exportId}/files/{kind}` | exports:read. | — | `downloadExportArtifact` |
| POST | `/projects/{projectId}/export-jobs/{exportId}/retry` | exports:write. | — | `retryExportJob` |
| GET | `/projects/{projectId}/exports` | documents:read. | — | `get_exports` |
| GET | `/projects/{projectId}/fire-protection-guide` | projects:read, devices:read, assistant:read. | — | `getFireProtectionGuide` |
| GET | `/projects/{projectId}/firestops` | documents:read. | — | `get_firestops` |
| POST | `/projects/{projectId}/firestops` | projects:write; tatsächliches Schott mit Benutzerbeleg, keine Dateifreigabe. | Projekt-ETag, Wiederholungsschlüssel | `addFirestop` |
| GET | `/projects/{projectId}/firestops/{entryId}` | documents:read. | — | `getFirestop` |
| PATCH | `/projects/{projectId}/firestops/{entryId}` | projects:write; bestätigte Teiländerung, Fotos/Originalfelder erhalten. | Projekt-ETag | `patchFirestop` |
| DELETE | `/projects/{projectId}/internal-documents/{attachmentId}` | projects:write; ausschließlich interne Assistenten-Projekttexte. | Projekt-ETag | `removeInternalProjectDocument` |
| GET | `/projects/{projectId}/material-import` | projects:read, devices:read. Gezielte Materialzeilen, Quelle oder Entscheidungsbeleg. section=decision benötigt zusätzlich assistant:read und rowId. | — | `getMaterialImport` |
| POST | `/projects/{projectId}/material-import` | projects:write, devices:read. Materialquelle und Zuordnung belegt führen. Manuelle Umfangsausnahmen und ihre Wiederaufnahme benötigen zusätzlich assistant:read sowie eine gespeicherte aktuelle Benutzerantwort zum genauen Zeilenziel. Keine Geräte-/Dateilöschung oder Freigabe. | Projekt-ETag | `recordMaterialImport` |
| GET | `/projects/{projectId}/next-action` | projects:read, devices:read, documents:read, assistant:read. | — | `getNextDocumentationAction` |
| POST | `/projects/{projectId}/research` | projects:write, devices:write, devices:read. | Projekt-ETag | `recordProductResearch` |
| POST | `/projects/{projectId}/reset` | projects:write, devices:write, documents:read, assistant:write, exports:write. | Projekt-ETag, Wiederholungsschlüssel | `resetProject` |
| GET | `/projects/{projectId}/reset-preview` | projects:read, devices:read, documents:read, assistant:read, exports:read. | — | `previewProjectReset` |
| GET | `/projects/{projectId}/service-areas` | projects:read. | — | `get_service_areas` |
| PATCH | `/projects/{projectId}/service-areas` | projects:write. | Projekt-ETag | `select_service_areas` |
| GET | `/projects/{projectId}/system-catalog` | projects:read. | — | `get_system_catalog` |
| GET | `/projects/{projectId}/systems` | projects:read. | — | `get_systems` |
| PATCH | `/projects/{projectId}/systems` | projects:write. | Projekt-ETag | `select_systems` |
| POST | `/projects/{projectId}/workflow` | projects:write, assistant:read; für requirementScopes zusätzlich assistant:write. | Projekt-ETag, Auftragsversion bedingt | `startDocumentationWorkflow` |

## MCP-Zuordnung

Vollständige Eingabeschemas und Serveranweisungen: [mcp-tools.json](mcp-tools.json). Die Zuordnung zu operationId ist bewusst gepflegt und wird auf Vollständigkeit geprüft. HTTP-Download und OpenAPI-Abruf haben kein eigenes MCP-Werkzeug. Werkzeughinweise ersetzen keine serverseitige Rechteprüfung.

| Werkzeug | Art | Pflichtargumente | API-Operationen |
| --- | --- | --- | --- |
| `edoku_add_device_position` | Schreiben | `projectId`, `listId`, `etag`, `values` | `addDevicePosition` |
| `edoku_add_firestop` | Schreiben | `projectId`, `etag`, `requestId`, `values`, `evidence` | `addFirestop` |
| `edoku_ask_question` | Schreiben | `projectId`, `jobId`, `input` | `askContextualQuestion` |
| `edoku_cancel_export` | Schreiben | `projectId`, `exportId` | `cancelExportJob` |
| `edoku_chat_decisions` | Lesen | `projectId`, `jobId` | `getChatDecisions` |
| `edoku_correct_requirement_devices` | Schreiben | `projectId`, `jobId`, `requirementId`, `etag`, `input` | `correctRequirementDevices` |
| `edoku_create_documentation_job` | Schreiben | `projectId`, `input` | `createDocumentationJob` |
| `edoku_create_project` | Schreiben | `input`, `requestId` | `createProject` |
| `edoku_datasheet_coverage` | Lesen | `projectId` | `getDatasheetCoverage` |
| `edoku_delete_device_position` | Schreiben | `projectId`, `etag`, `requestId`, `input`, `listId`, `position` | `deleteDevicePosition` |
| `edoku_delete_document` | Schreiben | `projectId`, `etag`, `requestId`, `input`, `attachmentId` | `deleteProjectDocument` |
| `edoku_delete_documentation_job` | Schreiben | `projectId`, `etag`, `requestId`, `input`, `jobId` | `deleteDocumentationJob` |
| `edoku_document_work_status` | Lesen | `projectId`, `jobId` | `getDocumentWork` |
| `edoku_documentation_status` | Lesen | `projectId` | `getDocumentationStatus` |
| `edoku_find_manufacturer_documents` | Lesen | `projectId`, `jobId`, `manufacturerPageUrl`, `listId`, `position` | `discoverManufacturerLinks` |
| `edoku_fire_protection_guide` | Lesen | `projectId` | `getFireProtectionGuide` |
| `edoku_get_device_list` | Lesen | `projectId`, `listId` | `getDeviceList` |
| `edoku_get_documentation_job` | Lesen | `projectId`, `jobId` | `getDocumentationJob` |
| `edoku_get_export_job` | Lesen | `projectId`, `exportId` | `getExportJob` |
| `edoku_get_project` | Lesen | `projectId` | `getProject` |
| `edoku_get_section` | Lesen | `projectId`, `section` | `get_service_areas`, `get_systems`, `get_system_catalog`, `get_documents`, `get_firestops`, `getFirestop`, `get_attachments`, `get_exports` |
| `edoku_identity` | Lesen | — | `getIntegrationIdentity` |
| `edoku_knowledge` | Lesen | `projectId`, `jobId` | `getDocumentationKnowledge` |
| `edoku_link_existing_document` | Schreiben | `projectId`, `etag`, `input` | `linkApprovedDocument` |
| `edoku_list_deletions` | Lesen | `projectId` | `listItemDeletions` |
| `edoku_list_device_lists` | Lesen | `projectId` | `listDeviceLists` |
| `edoku_list_documentation_jobs` | Lesen | `projectId` | `listDocumentationJobs` |
| `edoku_list_export_jobs` | Lesen | `projectId` | `listExportJobs` |
| `edoku_list_projects` | Lesen | — | `listProjects` |
| `edoku_material_import` | Lesen | `projectId` | `getMaterialImport` |
| `edoku_next_action` | Lesen | `projectId` | `getNextDocumentationAction` |
| `edoku_patch_attachment` | Schreiben | `projectId`, `attachmentId`, `etag`, `changes` | `patchAttachment` |
| `edoku_patch_device_position` | Schreiben | `projectId`, `listId`, `position`, `etag`, `changes` | `patchDevicePosition` |
| `edoku_patch_firestop` | Schreiben | `projectId`, `entryId`, `etag`, `values`, `evidence` | `patchFirestop` |
| `edoku_patch_project` | Schreiben | `projectId`, `etag`, `changes` | `patchProject` |
| `edoku_prepare_project_document` | Schreiben | `projectId`, `jobId`, `etag`, `input`, `requestId` | `prepareProjectDocument` |
| `edoku_preview_deletion` | Lesen | `projectId`, `target` | `previewItemDeletion` |
| `edoku_preview_project_reset` | Lesen | `projectId` | `previewProjectReset` |
| `edoku_propose_document` | Schreiben | `projectId`, `jobId`, `metadata` | `proposeDocument`, `checkOrProposeManufacturerDocument` |
| `edoku_queue_export` | Schreiben | `projectId`, `requestId` | `queueExport` |
| `edoku_record_chat_decision` | Schreiben | `projectId`, `jobId`, `etag`, `input` | `recordChatDecision` |
| `edoku_record_datasheet_search` | Schreiben | `projectId`, `etag`, `input` | `recordDatasheetSearch` |
| `edoku_record_document_work` | Schreiben | `projectId`, `jobId`, `etag`, `input` | `recordDocumentWork` |
| `edoku_record_material_import` | Schreiben | `projectId`, `etag`, `input` | `recordMaterialImport` |
| `edoku_record_research` | Schreiben | `projectId`, `etag`, `input` | `recordProductResearch` |
| `edoku_record_user_answers` | Schreiben | `projectId`, `jobId`, `input` | `recordUserAnswers` |
| `edoku_remove_internal_project_document` | Schreiben | `projectId`, `attachmentId`, `etag`, `confirm` | `removeInternalProjectDocument` |
| `edoku_repair_document_references` | Schreiben | `projectId`, `attachmentId` | `previewDeviceReferenceRepair`, `repairDeviceReferences` |
| `edoku_replace_document_proposals` | Schreiben | `projectId`, `jobId`, `input` | `replaceDocumentProposals` |
| `edoku_reset_project` | Schreiben | `projectId`, `etag`, `requestId`, `input` | `resetProject` |
| `edoku_restore_deleted_item` | Schreiben | `projectId`, `deletionId`, `etag`, `requestId`, `input` | `restoreDeletedItem` |
| `edoku_retry_export` | Schreiben | `projectId`, `exportId` | `retryExportJob` |
| `edoku_select_documents` | Schreiben | `projectId`, `etag`, `selection` | `select_documents` |
| `edoku_select_service_areas` | Schreiben | `projectId`, `etag`, `selection` | `select_service_areas` |
| `edoku_select_systems` | Schreiben | `projectId`, `etag`, `selection` | `select_systems` |
| `edoku_start_workflow` | Schreiben | `projectId`, `etag`, `input` | `startDocumentationWorkflow` |
| `edoku_update_documentation_job` | Schreiben | `projectId`, `jobId`, `update` | `updateDocumentationJob` |
| `edoku_withdraw_document_proposals` | Schreiben | `projectId`, `jobId`, `input` | `withdrawDocumentProposals` |

Die Beschreibung und das jeweilige Schema entscheiden über verschachtelte Pflichtfelder. Dateivorschläge werden ausschließlich in der angemeldeten GUI nach Sichtung und Einzelbestätigung übernommen. API und MCP stellen keine Dateifreigabe bereit. Internetrecherche führt der externe Agent aus; tools/list führt weder API-Aufrufe noch Recherche aus.
