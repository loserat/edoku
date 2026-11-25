# Update und Datenerhalt

Bestehende Installationen bewusst mit geprüfter Sicherung und Wiederherstellungsprobe aktualisieren. Daten, Konten und Dateientscheidungen erhalten; tatsächliche laufende Version nach dem Wechsel prüfen.

## Programm und Daten

Compose bindet fünf bestehende Verzeichnisse nach `/app/` ein:

| Verzeichnis | Inhalt |
| --- | --- |
| `data/` | Startdaten und globale Vorgaben |
| `config/` | Einstellungen, Formulare und Vorlagen |
| `storage/` | SQLite-Datenbank mit Konten, Sitzungen, Projektregister und aktivierten Projektinhalten; Uploads, neue projektgebundene Ausgaben und Sicherheitsprotokoll |
| `output/` | Frühere Ausgaben und gemeinsamer historischer Bestand |
| `templates/` | Dokumentvorlagen |

Alle fünf Ordner gehören gemeinsam zur Vollsicherung. Ein [Projektpaket](PROJEKTARCHIVE.md) enthält keine vollständige Installation. Lokale Änderungen an bereits versionierten Einstellungsdateien unter `config/` nicht durch einen Checkout überschreiben. Keine neuen Startdaten oder Testkopien über vorhandene Laufzeitordner kopieren.

## Geprüfter Ablauf

1. Laufenden Container, tatsächlich verwendete Abbild-ID, Ports und die fünf eingebundenen Datenpfade festhalten. Das bisherige Abbild erhalten.
2. Den neuen Quellstand in einem getrennten sauberen Checkout mit neutralen Startdaten vorbereiten. [Programmprüfungen](TESTS.md) ohne reale Datenanbindungen ausführen. Erst danach eine konsistente Kopie der aktuellen Installation fachlich und technisch prüfen.
3. Vollsicherung einschließlich aktuellem Programmabbild erstellen und prüfen:

   ```bash
   python3 scripts/installation_backup.py create --container edoku_v1
   python3 scripts/installation_backup.py verify --backup /absoluter/sicherungsordner
   ```

   Das Werkzeug hält die Anwendung sauber an, sichert alle fünf Ordner samt SQLite-Betriebsdateien und startet einen zuvor laufenden Dienst wieder. Den ausgegebenen neuen Sicherungspfad festhalten. Eine noch schreibende Datenbank nicht durch einzelnes Kopieren von `app.db` sichern. Weitere Einzelheiten: [Beta-Betrieb](BETA_BETRIEB.md).
4. Vor der Übernahme prüfen, ob sich Originalbestand oder Abbild seit dem Kopientest verändert haben. Bei Abweichungen erneut mit dem aktuellen Stand prüfen. Änderungen am laufenden Dienst nur im freigegebenen Umfang ausführen.
5. Die Anwendung für die Übernahme sauber anhalten. Nur ausdrücklich vorgesehene Datenbankmigrationen mit dem geprüften neuen Abbild ausführen; siehe nächsten Abschnitt. Datenpfade, Ports und Einstellungen erhalten. Danach dieses Abbild starten.
6. HTTP-Erreichbarkeit, Datenbankintegrität, Fremdschlüssel, Lesbarkeit der Projekte und Dateiprüfsummen prüfen. Bisherige Tabellen und Zeilen vergleichen; nur die vorgesehenen Schemaergänzungen dürfen hinzukommen. Operative SQLite-Dateien können sich ändern, obwohl fachliche Daten gleich bleiben. Schreibende Bedien- und Exporttests auf Kopien durchführen.
7. Tatsächlich laufende Abbild-ID, Prüfergebnisse und Sicherungspfad dokumentieren. Nach erfolgreicher Aktivierung eine weitere Vollsicherung erstellen und den anschließenden Wiederanlauf prüfen.

Bestehende PDFs werden durch das Update nicht neu erzeugt. Ein bewusst gestarteter Export aktualisiert interne PDFs und verwendet die aktuelle Kapitelstruktur. Vorhandene Quelllücken bleiben sichtbar.

## SQLite-Stufen bewusst aktivieren

Eine echte Neuinstallation aktiviert Stufen 1 und 2 selbst. Für vorhandene Installationen sind beide Schritte ausdrücklich und zunächst auf Kopien zu prüfen. Der Projektmodus kann JSON, SQLite-Stufe 1 oder SQLite mit Geräteprojektion sein. Den Zustand mit dem passenden neuen Programmabbild abfragen:

```bash
docker compose run --rm --no-deps edoku npm run storage:status -- --root /app
```

Die folgenden Befehle sind **Migrationen**, keine allgemeinen Neustartbefehle. Sie setzen voraus, dass Compose das vorher geprüfte neue Abbild verwendet und weiterhin die richtigen fünf Laufzeitordner einbindet. Erst sichern und Kopien prüfen, dann bei angehaltener Anwendung ausführen:

```bash
docker compose stop edoku
docker compose run --rm --no-deps edoku npm run storage:migrate -- --root /app
docker compose run --rm --no-deps edoku npm run storage:devices -- --root /app
docker compose up -d --no-build
```

`storage:migrate` übernimmt noch nicht erfasste Projektdatensätze in Stufe 1. Bei bereits aktivem SQLite werden vorhandene neuere Datensätze nicht aus alten JSON-Dateien überschrieben. `storage:devices` ergänzt die Geräteprojektion aus dem **aktuellen SQLite-Stand**. Beide Migrationen sind jeweils transaktional; zusammen sind es zwei bewusst getrennte Stufen. Eine JSON-Rückwegkopie mit deaktiviertem SQLite kann nicht ohne ausdrücklichen Datenabgleich wieder aktiviert werden.

Nach einer fehlgeschlagenen Migration zuerst den Fehler und den tatsächlichen Speicherzustand prüfen. Kein beliebiges früheres JSON-Programm gegen die alten Ausgangsdateien starten: Diese enthalten spätere SQLite-Änderungen nicht. Datenmodell, Konflikte, Rückweg und kompatible Stufe-1-Versionen: [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md).

Nach einem Neustart offene Formulare neu laden. CSRF-Geheimnisse sind pro Prozess gültig; Projektversionen verhindern zusätzlich das Speichern veralteter Seiten. Bestehende Login-Sitzungen und Passwörter werden durch das Update nicht zurückgesetzt.

## Wiederherstellung und Rückweg

Eine Vollsicherung zunächst ausschließlich in einen **neuen Ordner** wiederherstellen:

```bash
python3 scripts/installation_backup.py restore --backup /absoluter/sicherungsordner --target /absoluter/neuer/testordner
```

Originalinstallation und Sicherung bleiben unangetastet. Im neuen Testordner das zur Sicherung gehörende Programmabbild verwenden. Start, Anmeldung, Projekte, Dateien und Archive getrennt von der Integritätsprüfung kontrollieren. Genaue Docker-Schritte: [Getrennte Wiederherstellung](BETA_BETRIEB.md#getrennte-wiederherstellung).

Für eine Rückkehr von SQLite zu einem älteren JSON-Programm müssen aktuelle SQLite-Inhalte zuerst in einer neuen Wiederherstellungskopie materialisiert werden. Dafür gibt es `storage:rollback`; die [SQLite-Anleitung](SQLITE_PROJEKTDATEN.md#geprüfter-rückweg-nur-in-einen-neuen-ordner) beschreibt Voraussetzungen und Grenzen. Eine alte Datenbank nicht mit neueren Projektdateien mischen. Vor einer tatsächlichen Rückkehr der Hauptanwendung neu entstandene Daten zusätzlich sichern und abgleichen.

## Historischer Bestand, Privatsphäre und Aufräumen

Gemeinsam verwendete alte Ausgaben unter `output/projekte/` bleiben separat historisch erhalten. Eine Speicherumstellung benennt sie weder um noch ordnet sie automatisch einzelnen Projekten zu. Fehlende Logos oder Fotos werden nicht durch erfundene Dateien ersetzt oder aus Originalprojekten gelöscht.

`backups/`, private Inhalte von `storage/`/`output/`, `intern/` und `.env` gehören nicht nach GitHub. Ignore-Regeln entfernen bereits versionierte Dateien nicht automatisch. Vor einem Commit die tatsächlich ausgewählten Dateien prüfen; lokale Änderungen an `config/` sind nicht automatisch veröffentlichbare Vorlagen.

Temporäre Prüfkopien erst nach Sicherung ihrer Nachweise und vollständiger Archivprüfung entfernen. Projekte, Quellen, ZIPs, Sicherungen und historische Bestände erhalten. Keine pauschale Löschung von Docker-Datenträgern oder Runtime-Ordnern. Ein kleineres Nachweisarchiv beweist keinen sofortigen entsprechenden Zuwachs des physisch freien Mac-Speicherplatzes.
