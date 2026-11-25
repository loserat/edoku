# Lokaler Beta-Betrieb

Stand: 19.11.2026. Diese Anleitung gilt für die lokale Docker-Installation mit den fünf eingebundenen Ordnern `data`, `config`, `storage`, `output` und `templates`. Sie ersetzt keine Freigabe für öffentlichen Serverbetrieb.

## Aktueller lokaler Betriebsnachweis

Zum Tagesabschluss läuft genau ein edoku-Anwendungscontainer `edoku_v1` auf Port 3000 mit Benutzerkennung `501:20`, SQLite-Geräteprojektion und Status `healthy`. Aktives Abbild: `edoku:device-columns-20261119`. Die Codex-Verbindung nutzt den Host-MCP-Adapter; sie benötigt keinen zweiten edoku-Container. Vollständige Image-ID und Prüfergebnisse: [Tagesabschluss 19.11.](TAGESABSCHLUSS_2026-11-19.md).

Die jüngsten Vorsicherungen `backups/assistant-overview-pre-20261119` und `backups/device-columns-pre-20261119` wurden jeweils separat wiederhergestellt und mit dem neuen Abbild gestartet. Beim letzten Update blieben acht geschützte Tabellen, Datenpfade, Ports und Benutzerkennung unverändert. Das ist kein heutiger neuer Nachweis einer externen Sicherung oder eines vollständigen fachlichen Exports.

`mcp-documents/` ist eine zusätzliche lokale Recherche-Eingangsablage. Private Codex-Starter und Verbindungsdateien liegen außerhalb der fünf Laufzeitordner und sind gesondert zu sichern; vorhandene private Host-Adapter-Sicherung erhalten. [Einrichtung und Grenzen](CODEX_DOCKER_MCP.md). Nach einem Rückweg zuerst neue Projekte, Antworten und Dateientscheidungen sichern; nie einen älteren Datenstand ungeprüft über neuere Daten kopieren.

## Vollständige Sicherung

Im Projektordner mit Python 3.11 oder neuer und laufendem Docker ausführen:

```bash
python3 scripts/installation_backup.py create --container edoku_v1
```

Das Werkzeug prüft zuerst die fünf Containeranbindungen, hält eine laufende Anwendung sauber an, kopiert sämtliche Laufzeitdateien und speichert standardmäßig auch das tatsächlich verwendete Docker-Abbild. Danach startet es die zuvor laufende Anwendung auch bei einem Kopierfehler wieder. Ein zuvor gestoppter Container bleibt gestoppt. Gleichzeitige Sicherungsläufe desselben Projektordners sind gesperrt. Während der kurzen Unterbrechung die Anwendung nicht bedienen und die Ordner nicht anderweitig verändern.

Das Ergebnis liegt in einem neuen privaten Unterordner von `backups/`. Enthalten sind Prüfsummen, Datenbankprüfung, Containerkonfiguration und gegebenenfalls `.env`. Die Sicherung enthält vertrauliche Projekte und Zugangsdaten der Installation und gehört weder nach GitHub noch in öffentliche Freigaben. `--destination /absoluter/neuer/sicherungsordner` erlaubt ein anderes Ziel außerhalb der Laufzeitordner. `--no-image` spart das Abbild aus; dann muss dessen exakte Version separat verfügbar bleiben.

Nur eine erfolgreich verifizierte Sicherung verwenden:

```bash
python3 scripts/installation_backup.py verify --backup /absoluter/sicherungsordner
```

Bei einem Fehler bleibt die angefangene Kopie zur Untersuchung liegen. Das Werkzeug repariert beschädigte Daten nicht automatisch. Es löscht keine älteren Sicherungen. Eine Kopie auf einem weiteren Datenträger und regelmäßige Wiederherstellungsproben bleiben erforderlich; lokale Sicherungen schützen nicht vor Ausfall des gesamten Rechners.

## Getrennte Wiederherstellung

Das Ziel darf noch nicht existieren. Originalordner, bestehende Projekte und Sicherungsordner werden nicht überschrieben:

```bash
python3 scripts/installation_backup.py restore --backup /absoluter/sicherungsordner --target /absoluter/neuer/testordner
```

Das Werkzeug prüft vor und nach dem Kopieren Dateien, Prüfsummen und Datenbankinhalte. Historische Ausgaben werden unverändert übernommen. Externe symbolische Verknüpfungen erfordern eine manuelle Prüfung und verhindern die automatische Wiederherstellung.

Bei einer Docker-Sicherung entsteht `compose.restore.json` mit den wiederhergestellten Ordnern, dem ursprünglichen Abbild und einem nur lokal erreichbaren Prüfport 3104. Das Abbild bleibt platzsparend in der Sicherung. Auf einem anderen Rechner zuerst laden, anschließend im neuen Testordner starten:

```bash
docker image load --input /absoluter/sicherungsordner/image.tar
docker compose -f compose.restore.json up -d
```

Danach `http://localhost:3104` öffnen und die kopierten Projekte prüfen. Bei belegtem Prüfport die Portangabe in dieser neuen Prüfkonfiguration ändern. Den Originalcontainer dabei nicht ersetzen. Die technische Integritätsprüfung allein belegt noch keinen erfolgreichen Anwendungsstart; beides getrennt prüfen. Eine bewusste Rückkehr der Hauptanwendung auf eine ältere Sicherung braucht einen eigenen Plan, damit neuere Daten erhalten bleiben.

## SQLite beim Sichern und Zurückkehren

Nach Aktivierung liegen die aktuellen strukturierten Projektdaten zusätzlich zu Konten und Sitzungen in `storage/app.db`. Die alten Projekt-JSON-Dateien sind Ausgangskopien und kein aktueller Spiegel. Eine Sicherung nur dieser JSON-Dateien reicht nicht aus. Das Vollsicherungswerkzeug erfasst die Datenbank samt vorhandener Betriebsdateien und alle übrigen Inhalte gemeinsam bei angehaltener Anwendung.

Eine normale Wiederherstellung bringt den gesicherten Speicherstand mit dem zugehörigen Programmabbild zurück. Der gesonderte Rückweg zu einem älteren JSON-Programm muss dagegen die aktuellen SQLite-Inhalte in einer neuen Kopie als JSON materialisieren; erst dort darf SQLite deaktiviert werden. Nicht eigenständig auf alte Ausgangsdateien umschalten. Anleitung: [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md).

`--no-image` ist nur sinnvoll, wenn das exakt passende Programmabbild anderweitig erhalten bleibt. Eine Sicherung auf demselben Mac ist keine externe Sicherung. Nach Wiederherstellung zusätzlich Anwendungsstart, eigene Anmeldung, Projektzuordnung und Dateien prüfen; eine bestandene Prüfsumme ersetzt diese Bedienprüfung nicht.

## Sicherheitsprotokoll

Das Sicherheitsprotokoll ist für Systemadmins unter `/einstellungen/protokoll` verfügbar. In der Vorschau vom 18.11.2026 ist es direkt über **Einstellungen → Sicherheitsprotokoll** erreichbar. Gespeichert werden Zeitpunkt, Aktion, Konto-/Projekt-/Zielkennungen, Versuch, Ergebnis und HTTP-Status. Kontonamen werden erst für die Anzeige aufgelöst. Passwörter, Sitzungswerte, Formularinhalte, Dateien und vollständige URLs werden nicht protokolliert.

Die Ablage liegt unter `storage/audit/events.jsonl` und ist Bestandteil der Vollsicherung. Kritische Anmeldungs-, Konto-, Einstellungs-, Projekt-, Archiv- und Exportaktionen erhalten vor ihrer Ausführung einen dauerhaft geschriebenen Versuchsdatensatz. Bei unlesbarem oder beschädigtem Protokoll werden diese Aktionen abgewiesen. Ist nur der spätere Ergebnisdatensatz nicht schreibbar, bleibt der Versuch erhalten und der Server meldet den Fehler. Nach einem abrupten Prozessabbruch kann daher ein Versuch ohne Ergebnis bestehen.

Die Hashkette erkennt beschädigte oder einzeln veränderte Datensätze. Sie setzt voraus, dass die Ablage gegen komplettes Umschreiben geschützt ist. Der lokal aktivierte Sicherheitsstand rotiert die Protokolldatei und behält die bisherigen Einträge. Externe unveränderliche Ablage, Aufbewahrungsregeln und Betrieb mit mehreren gleichzeitig schreibenden Prozessen sind noch offen. Eine beschädigte Datei zunächst privat sichern und untersuchen. [Lokale Protokolländerungen](SICHERHEITSUPDATE_2026-11-17.md)

## Prüfungen und Grenzen

103 automatische Prüfungen laufen in einem getrennten Testabbild: 95 Node.js-Prüfungen und acht Python-Prüfungen für Sicherung/Wiederherstellung. Der vollständige Ablauf arbeitet mit künstlichen Daten und kontrolliert sechs PDF-Seiten, fünf Einzel-PDFs, die Originalbytes des importierten Plans und einen Archiv-Rückimport ohne Änderung des Quellprojekts. Die GitHub-Actions-Konfiguration führt diese Prüfungen bei Push/PR aus; ein erfolgreicher Lauf muss am jeweiligen veröffentlichten Commit bestätigt werden. Siehe [TESTS.md](TESTS.md).

Bestehende Projekte werden durch ein Programmupdate weder neu exportiert noch automatisch zugeordnet. Gemeinsam genutzte historische Ausgaben bleiben separat erhalten. Fachliche Vollständigkeit echter Dokumentationen, Druckabnahme, alle Browservarianten und öffentlicher Mehrbenutzerbetrieb bleiben gesondert zu prüfen.
