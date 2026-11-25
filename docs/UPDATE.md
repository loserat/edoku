# Lokales Update und Datensicherung

Stand **25.11.2026**: lokal aktiv **App 0.2.0-beta.13 / HTTP-API und MCP 3.9.0**, **64 HTTP-Operationen und 55 MCP-Werkzeuge (22 Lesen / 33 Schreiben)**. Agentenvertrag 2.1, Produktprüfung V7. Die vereinfachte Oberfläche ist nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Neue Dateien weiterhin ausschließlich manuell einzeln in der GUI freigeben.

Änderungen, Tests und lokale Aktivierungen beider Tage: **[Entwicklungsupdate 23.–24.11.2026](ENTWICKLUNGSUPDATE_2026-11-23_24.md)**. Frühere Tagesabschlüsse und vorbereitete Nachweise beschreiben ihren damaligen Zeitpunkt; sie sind keine aktuellen Aktivierungsaufträge.

Die beta.13-Aktivierung am 25.11.2026 wurde nach Vollsicherung und getrennter Wiederherstellung mit Start alter/neuer Version geprüft. **2.000 Dateien/16 fachliche Tabellen im Aktivierungsvergleich unverändert**, Schema, Integrität und Fremdschlüssel geprüft. Vor- und Nachsicherung samt Abbildern erhalten; GUI-Dateien, laufende Version und MCP-Verbindung lesend bestätigt. Keine Veröffentlichung. [Bedienung und Prüfung](GUI_ASSISTENT_VEREINFACHUNG.md), [Tagesabschluss](TAGESABSCHLUSS_2026-11-25.md). Die folgenden datierten Schritte dokumentieren frühere Aktualisierungen beziehungsweise den allgemeinen Ablauf.

## Lokales Sicherheitsupdate vom 17.11.2026

Der neue Container läuft ohne Root-Rechte. Bei bestehenden Bind-Mounts zuerst deren vorhandene Eigentümer prüfen und über eine private `docker-compose.override.yml` die passende Benutzerkennung setzen; keine pauschale Änderung der Bestandsrechte. Die lokale Mac-Installation verwendet `501:20`. Die Vollsicherung enthält nun auch die privaten Compose-Dateien; beim getrennten Restore wird die tatsächliche Containerkennung übernommen. Vor- und Nachsicherung einschließlich Abbild sowie ein getrennter Restore sind für die lokale Aktivierung geprüft. [Konkreter Nachweis](SICHERHEITSUPDATE_2026-11-17.md). Eine Online-Aktualisierung ist damit nicht erfolgt.

Stand: 22.11.2026. App-Ziel `0.2.0-beta.1`, API/MCP `3.3.0`; [Releaseumfang](RELEASE_NOTES.md) und [Versionsschema](VERSIONIERUNG.md). Diese Anleitung gilt für die lokale Docker-Installation. Sie beschreibt eine bewusste Aktualisierung mit Erhalt des Bestands. Der GitHub-Updatehinweis in der Anwendung installiert keine Version automatisch.

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
