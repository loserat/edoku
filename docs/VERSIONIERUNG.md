# Versionierung

| Bereich | Version | Quelle |
| --- | --- | --- |
| Anwendung | `0.3.2` | `package.json`; beide Wurzeleinträge in `package-lock.json` |
| HTTP-API | `3.15.0` | `services/interfaceVersions.js`, verwendet von OpenAPI |
| MCP-Server | `3.15.0` | `services/interfaceVersions.js`, verwendet vom MCP-Server |
| Schnittstellenumfang | 69 Operationen / 58 Werkzeuge | erzeugtes `docs/api/manifest.json` |
| Aufgabenvertrag | `2.5` | `services/documentationWorkflowService.js` |
| Produktprüfung | `manufacturer_pdf_article_variant_v10` | `services/productDocumentVerificationService.js` |
| Brandschutzpflichten | `firestop_documents_v2` | `services/firestopDocumentationService.js` |
| Materialzuordnung | `material_dependencies_v2` | `services/materialImportService.js` |

App, Schnittstelle und Fachregeln werden getrennt geführt. Eine App-Version erhöht nicht automatisch API-/MCP-Version oder Datenbankschema. OpenAPI 3.1.0 bezeichnet das Format, nicht die API-Version. Tatsächlich installierte Werte stehen unter [Einstellungen → System](SYSTEMVERSIONEN.md).

Paket/Lock, README und aktuelle Release Notes gemeinsam pflegen. Fachliche Änderungen im Changelog und passender Produktanleitung beschreiben. API-/MCP-Referenz aus dem Quellvertrag erzeugen und prüfen; erzeugte Dateien nicht von Hand ändern.

Quellstand, getestetes Abbild, lokale Aktivierung, GitHub-main und Online-Deployment sind getrennte Zustände. Kein Push beweist den Zustand bestehender Volumes. Vor einer Aktivierung bestehende Daten sichern und getrennt wiederherstellen. Datierte interne Nachweise bleiben in der privaten Ablage; öffentliche Versionshistorie im [Changelog](../CHANGELOG.md) und den [Release Notes](RELEASE_NOTES.md).
