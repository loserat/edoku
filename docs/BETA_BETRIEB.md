# Lokaler Beta-Betrieb

Stand: 30.10.2026. Diese Anleitung gilt für die lokale Docker-Installation mit den fünf eingebundenen Ordnern `data`, `config`, `storage`, `output` und `templates`. Sie ersetzt keine Freigabe für öffentlichen Serverbetrieb.

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

## Sicherheitsprotokoll

Systemadmins erreichen **System → Sicherheitsprotokoll**. Gespeichert werden Zeitpunkt, Aktion, Konto-/Projekt-/Zielkennungen, Versuch, Ergebnis und HTTP-Status. Konto-Namen werden erst für die Anzeige aufgelöst. Passwörter, Sitzungswerte, Formularinhalte, Dateien und vollständige URLs werden nicht protokolliert.

Die Ablage liegt unter `storage/audit/events.jsonl` und ist Bestandteil der Vollsicherung. Kritische Anmeldungs-, Konto-, Einstellungs-, Projekt-, Archiv- und Exportaktionen erhalten vor ihrer Ausführung einen dauerhaft geschriebenen Versuchsdatensatz. Bei unlesbarem oder beschädigtem Protokoll werden diese Aktionen abgewiesen. Ist nur der spätere Ergebnisdatensatz nicht schreibbar, bleibt der Versuch erhalten und der Server meldet den Fehler. Nach einem abrupten Prozessabbruch kann daher ein Versuch ohne Ergebnis bestehen.

Hash-Verkettung erkennt beschädigte oder nachträglich einzeln veränderte Datensätze. Sie ist kein Schutz gegen einen Administrator, der die gesamte Datei neu schreibt oder ersetzt. Das Werkzeug ist für eine lokale Instanz mit einem Serverprozess ausgelegt. Rotation, externe unveränderliche Ablage, Aufbewahrungsfristen und Mehrprozessbetrieb sind noch nicht eingerichtet. Eine beschädigte Datei zunächst privat sichern und untersuchen; nicht still löschen oder reparieren.

## Prüfungen und Grenzen

52 automatische Prüfungen laufen in einem getrennten Testabbild: 44 für die Anwendung und acht für Sicherung/Wiederherstellung. Der vollständige Ablauf arbeitet mit künstlichen Daten und kontrolliert sechs PDF-Seiten, fünf Einzel-PDFs, die Originalbytes des importierten Plans und einen Archiv-Rückimport ohne Änderung des Quellprojekts. GitHub Actions führt die Prüfungen bei Änderungen automatisch aus. Siehe [TESTS.md](TESTS.md).

Bestehende Projekte werden durch ein Programmupdate weder neu exportiert noch automatisch zugeordnet. Gemeinsam genutzte historische Ausgaben bleiben separat erhalten. Fachliche Vollständigkeit echter Dokumentationen, Druckabnahme, alle Browservarianten und öffentlicher Mehrbenutzerbetrieb bleiben gesondert zu prüfen.
