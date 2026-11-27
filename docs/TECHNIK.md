# Architektur

edoku ist eine Node.js-/Express-Anwendung mit serverseitigen EJS-Ansichten, SQLite und dateibasierten Originalunterlagen. GUI, HTTP-API und MCP verwenden gemeinsame Fachservices; es gibt keine zweite MCP-Datenhaltung.

## Zuständigkeiten

| Bereich | Führende Stellen |
| --- | --- |
| Server, Anmeldung und GUI | `server.js`, `services/authService.js`, `views/` |
| HTTP-API, Rechte und Schemas | `src/routes/integration.routes.js`, `src/api/` |
| MCP-Adapter und Werkzeuge | `services/mcpServerService.js`, `scripts/edoku-mcp.js` |
| Stabile Bezüge, Reparatur und Aufgabenvertrag | `geraetelistenService.js`, `deviceReferenceRepairService.js`, `agentTaskContractService.js`, `workflowBlockerService.js` |
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

## Abgeleitete Brandschutzanforderungen

`firestopDocumentationService` ist die zentrale herstellerunabhängige Regel (`firestop_documents_v2`). `documentAssistantService.get` ergänzt fehlende Pflichten aus aktuellen Projektdokumenten und auftragsbezogenen bestätigten Einbaufakten. Der synchrone Leser des Projektspeichers berücksichtigt SQLite und laufende Transaktionen; Legacy-Dateien verwenden dieselbe Pfad-/Symlinksperre. Keine Abrufmigration und kein Schreibzugriff beim Lesen.

Auftragsanlage/-änderung, verknüpfter Vorschlag und Auftragsabschluss sichern berechnete Anforderungskennungen atomar. Bestehende Payloads werden nicht überschrieben. Auftragsversionen enthalten die aktuellen abgeleiteten Anforderungen. Bei Systemwechsel bleiben gespeicherte Altkennungen erhalten, sind im Readiness-Status jedoch nicht anwendbar. Geschlossene Aufträge werden nicht nachträglich erweitert.

Readiness, Workflow, Faktenabhängigkeiten und GUI-Arbeitsliste nutzen denselben Regeldienst. Der Workflow liefert direkte Recherche-/Klärungsaufgaben statt einer Anforderungskopie an den Agenten. Für Kanäle und Funktionserhalt sind nur bestätigte aktuelle Gerätefakten mit bestätigtem Einbau maßgeblich, keine Klassifikationsvorschläge aus Texten. Wand-/Schottmaße werden dort nicht als Voraussetzungen übertragen. Die vorhandene PDF-Prüfung und manuelle Dateifreigabe bleiben unverändert; Datenbank- und Projektschema benötigen keine Migration.

## OBO-Maße und klare Zuständigkeiten

`productDimensionEvidenceService.oboPlmDimensions` prüft die originale, noch nicht um synthetische Maßzeilen ergänzte Textevidenz. Millimeterwerte aus dem Abmessungsblock dürfen nur für dieselbe eindeutig beschriftete Artikelnummer verwendet werden. Quelle/Modellbindung und vollständiger Text bleiben erforderlich. Wiederholte Maße müssen gleich sein; widersprüchliche Zahlen bzw. Artikelnummern sind kein Layoutproblem.

`workflowBlockerService` unterscheidet den technischen Layoutbefund vor generischen Artikel-/Varianten-Schlüsselwörtern. `compactVerification` gibt eine knappe `resolution` ohne PDF-Volltext aus. Workflow-Faktenaufgaben enthalten `missingInformation` mit eindeutigem Ziel, Faktenstand und Zuständigkeit. Keine neue Datenbankstruktur oder Abrufmigration; V10 öffnet nur passende ältere V9-Maßsperren.

Bei gezielter Wiederaufnahme bleiben gespeicherte Originalquellen in der berechneten Sicht erhalten (`search.outcome=retry`). Der Arbeitsplan liefert `RETRY_DATASHEET_CHECK`, `reuseOriginal=true`, bis zu zwei kurze `priorSources` und den gezielten Detailabruf. Der Agent prüft das bereits gefundene Original erneut, statt dessen Suche zu wiederholen. Die gespeicherten Recherchebelege werden dabei nicht umgeschrieben.
