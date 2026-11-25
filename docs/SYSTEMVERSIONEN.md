# Versionsanzeige unter Einstellungen → System

Seit lokal aktivierter App **0.3.0-beta.2** (25.11.2026) zeigt der Systembereich eine kompakte Zeile mit **Software**, **MCP** und **API**. Die Werte sind reine Statusangaben, keine Einstellungen zum Bearbeiten. Es wird weder ein Speicheraufruf noch eine externe Updateabfrage ausgelöst.

Software kommt aus dem tatsächlich laufenden `package.json`. API und MCP stammen aus `services/interfaceVersions.js`; dieselben Konstanten verwenden OpenAPI und tatsächlicher MCP-Handshake. MCP bezeichnet den edoku-MCP-Server, nicht die Version eines externen Clients. Die OpenAPI-Formatkennung 3.1.0 ist eine andere Angabe.

API/MCP unverändert **3.9.0**, 64 HTTP-Operationen und 55 Werkzeuge. Keine neuen Rechte, Abhängigkeiten oder Datenmigration. Jede neue Datei bleibt bis zur tatsächlichen manuellen Einzelprüfung ein Vorschlag.

Prüfung: 39 gezielte Integrations-, Vertrags-, Theme- und Starttests sowie Browserprüfung bei 1440/375/320 Pixeln. Softwareanzeige gegen Paketversion, API-Anzeige gegen echte HTTP-OpenAPI-Antwort und MCP-Anzeige gegen echten Initialisierungshandshake verglichen. Kein horizontaler Überlauf und keine abgeschnittenen Werte. Testdaten künstlich; fachliche Abnahme bleibt getrennt.

[Versionsschema](VERSIONIERUNG.md) · [API/MCP](API_MCP.md) · [Prüfungen](TESTS.md). Lokale Aktivierung und tatsächlicher Online-Rollout sind eigenständige Schritte; ein GitHub-Push aktualisiert keine vorhandenen Volumes oder Container automatisch.
