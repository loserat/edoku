# Versionsanzeige unter Einstellungen → System

Seit App-Version **0.3.0-beta.2** zeigt der Systembereich eine kompakte Zeile mit **Software**, **MCP** und **API**. Die Werte sind reine Statusangaben, keine Einstellungen zum Bearbeiten. Es wird weder ein Speicheraufruf noch eine externe Updateabfrage ausgelöst.

Software kommt aus dem tatsächlich laufenden `package.json`. API und MCP stammen aus `services/interfaceVersions.js`; dieselben Konstanten verwenden OpenAPI und tatsächlicher MCP-Handshake. MCP bezeichnet den edoku-MCP-Server, nicht die Version eines externen Clients. Die OpenAPI-Formatkennung 3.1.0 ist eine andere Angabe.

Der aktuelle Quellstand verwendet Software **0.3.2** und API/MCP **3.15.0**, 69 HTTP-Operationen und 58 Werkzeuge. Keine neuen Rechte oder Abhängigkeiten. Für den Vorschlagsspeicher besteht ein ausdrücklich auszuführender, vorher auf einer Wiederherstellung zu prüfender Upgrade-Schritt; siehe Update-Anleitung. Jede neue Datei bleibt bis zur tatsächlichen manuellen Einzelprüfung ein Vorschlag.

Historische Erstprüfung für 0.3.0-beta.2: 39 gezielte Integrations-, Vertrags-, Theme- und Starttests sowie Browserprüfung bei 1440/375/320 Pixeln. Softwareanzeige gegen Paketversion, API-Anzeige gegen echte HTTP-OpenAPI-Antwort und MCP-Anzeige gegen echten Initialisierungshandshake verglichen. Kein horizontaler Überlauf und keine abgeschnittenen Werte. Testdaten künstlich; fachliche Abnahme bleibt getrennt.

[Versionsschema](VERSIONIERUNG.md) · [API/MCP](API_MCP.md) · [Prüfungen](TESTS.md). Lokale Aktivierung und tatsächlicher Online-Rollout sind eigenständige Schritte; ein GitHub-Push aktualisiert keine vorhandenen Volumes oder Container automatisch.

Die neue Versionsnummer bezeichnet den Quellstand. Auf einer bestehenden Installation erscheint 0.3.2 erst nach deren gesonderter Aktualisierung; ein geänderter README-Eintrag oder GitHub-Push verändert keine laufende Instanz.
