# Architektur

edoku ist eine Node.js-/Express-Anwendung mit serverseitigen EJS-Ansichten, SQLite und dateibasierten Originalunterlagen. GUI, HTTP-API und MCP verwenden gemeinsame Fachservices; es gibt keine zweite MCP-Datenhaltung.

## Zuständigkeiten

| Bereich | Führende Stellen |
| --- | --- |
| Server, Anmeldung und GUI | `server.js`, `services/authService.js`, `views/` |
| HTTP-API, Rechte und Schemas | `src/routes/integration.routes.js`, `src/api/` |
| MCP-Adapter und Werkzeuge | `services/mcpServerService.js`, `scripts/edoku-mcp.js` |
| Schnittstellenversionen | `services/interfaceVersions.js`; Software aus `package.json` |
| Führender Projektstand und atomare Änderungen | `projectDataStoreService.js`, `deviceDataStoreService.js`, `integrationService.js` |
| Aufträge, Fragen und Vorschläge | `documentAssistantService.js`, `documentationWorkflowService.js` |
| Materialquelle und Ausschlüsse | `materialImportService.js`, `documentationMaterialPolicy.js` |
| Fakten, Entscheidungen und Abhängigkeiten | `knowledgeService.js`, `agentContractService.js` |
| Herstellerlinks und PDF-Prüfung | `manufacturerLinkService.js`, `productDocumentVerificationService.js` |
| Manuelle Prüfung und Reihenfolge | `documentAssistant.routes.js`, `assistantReviewNavigation.js` |
| Hintergrundexport | `exportJobService.js`, `exportService.js`, `documentationPlanService.js` |

Servicenamen liegen unter `services/`, GUI-Routen unter `src/routes/`. Fachlogik nicht in Toolbeschreibungen oder getrennten Adapter-Speichern nachbauen.

## Daten und Nebenläufigkeit

SQLite ist für aktivierte Projekte führend. Frühere JSON-Dateien sind Herkunftskopien, kein aktueller Spiegel. Gerätelisten werden zusätzlich relational projiziert. Konten, Aufträge, Anforderungen, Vorschläge und Sichtungen bleiben versioniert; Originaldateien bleiben dateibasiert. Projektversionen und atomare Commits schützen zwischenzeitliche Änderungen. Keine SQLite-Transaktion über beliebige asynchrone Arbeit offenhalten.

Die fünf Laufzeitordner `data/`, `config/`, `storage/`, `output/` und `templates/` gemeinsam sichern. Ein Projektpaket ersetzt keine Vollsicherung. [Datenmodell und Rückweg](SQLITE_PROJEKTDATEN.md), [Updateablauf](UPDATE.md).

## Ausgabe und Oberfläche

Ein gemeinsamer Dokumentationsplan bestimmt Kapitel, Pflichtquellen und Ausgabeumfang. PDF-/ZIP-Aufträge arbeiten dauerhaft im Hintergrund und prüfen veränderte Voraussetzungen vor Veröffentlichung. Bestehende Ausgaben und Quellen nicht überschreiben, nur um einen Status zu erfüllen. GUI und PDF verwenden gemeinsame Gestaltungs-/Brandingregeln; [Theme](THEME.md).

## Änderungen prüfen

[Tests](TESTS.md) angemessen zur Änderung ausführen. Bei API-/MCP-Änderungen `npm run docs:api`, erzeugten Diff prüfen und `npm run docs:check` ausführen; Referenzen nicht von Hand ändern. Eingabe-/Antwortgrenzen, Rechte, Versionsschutz und manuelle Dateiprüfung erhalten. [Vertrag](api/README.md), [Versionierung](VERSIONIERUNG.md).
