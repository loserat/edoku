# Lokales Update und Datensicherung

Stand: 2026-10-30. Dieser Ablauf beschreibt eine lokale Docker-Installation.
Er ist kein automatisches Backup-/Restore-System und keine Freigabe für
öffentlichen Serverbetrieb.

## Daten und Programm getrennt behandeln

Compose bindet fünf bestehende Verzeichnisse nach `/app/` ein:

| Verzeichnis | Inhalt |
| --- | --- |
| `data/` | Startdaten und globale Vorgaben |
| `config/` | Einstellungen, Formulare und Vorlagen |
| `storage/` | Datenbank, Konten, Sitzungen, Projekte und hochgeladene Dateien |
| `output/` | vorhandene PDFs und Exporte |
| `templates/` | Dokumentvorlagen |

Für eine vollständige Sicherung alle fünf Verzeichnisse gemeinsam erfassen.
Ein [Projektpaket](PROJEKTARCHIVE.md) enthält keine vollständige Installation und ersetzt diese Sicherung nicht. Lokale
Anpassungen der bereits versionierten Einstellungsdateien unter `config/`
nicht durch einen unkontrollierten Checkout überschreiben.

## Ablauf

1. Aktuelle Containerkonfiguration, Abbild-ID, Ports und eingebundene Datenpfade festhalten. Das vorherige Abbild unter einem eindeutigen Tag behalten.
2. Den gewünschten Quellstand in einem separaten sauberen Checkout vorbereiten. [Tests](TESTS.md) im neuen Abbild ohne reale Datenanbindungen ausführen; danach mit einer konsistenten Kopie des Bestands prüfen. Niemals Testordner in die normale Anwendung zurückkopieren.
3. Die normale Anwendung kurz stoppen. Alle fünf Ordner samt SQLite-Datenbank und vorhandenen `app.db-wal`, `app.db-shm` oder `app.db-journal` vollständig in einen neuen privaten Sicherungsordner kopieren. Die Ordnerstruktur erhalten. Eine noch schreibende SQLite-Datenbank nicht durch einfaches Kopieren einzelner Dateien sichern.
4. Kopie und Original mit Dateiprüfsummen vergleichen. Die Datenbankintegrität an einer Arbeitskopie der Sicherung prüfen; den eigentlichen Sicherungsbestand nicht durch Prüfläufe verändern.
5. Das geprüfte neue Abbild mit denselben Datenpfaden und Ports starten. Die Laufzeitordner weder löschen noch durch neutrale Startdaten ersetzen.
6. HTTP-Erreichbarkeit, Anmeldung und reine Seitenaufrufe prüfen. Vorher/Nachher-Vergleich aller fachlichen Dateien und Datenbankinhalte durchführen. Bei SQLite zusätzlich Schema und Tabellenzeilen vergleichen, da sich Betriebsdateien trotz gleicher Inhalte ändern können.
7. Abbild-IDs, Prüfergebnisse und Sicherungspfad festhalten. Alte Sicherungen und Ausgaben erst im Rahmen eines gesonderten Aufräumauftrags entfernen.

Bestehende PDFs werden durch das Update nicht neu erzeugt. Ältere PDFs können
nach der Kapitelkorrektur als veraltet erscheinen. Ein bewusst gestarteter
Export aktualisiert interne PDFs und verwendet die neue Struktur.

## Wiederherstellung

Eine Wiederherstellung zunächst in einer getrennten Arbeitskopie erproben.
Vor jedem Rückspielen die Anwendung stoppen und den inzwischen aktuellen
Bestand zusätzlich sichern. Erst danach die zusammengehörigen Laufzeitordner
und die dazu passende geprüfte Programmversion verwenden. Keine einzelne alte
Datenbank mit neueren Projektdateien mischen.

Ältere Programmstände können beim Start Demo-Konten zurücksetzen. Die am
30.10.2026 getestete Version verhindert das; bei einer Rückkehr zu früherem
Code muss dieses Verhalten vorab in der Kopie geprüft und abgesichert werden.

## GitHub und private Sicherungen

`backups/`, `storage/`, `output/` und `.env` sind von Git ausgeschlossen.
`backups/` ist zusätzlich vom Docker-Build ausgeschlossen. Diese Regeln
entfernen keine bereits versionierten Dateien automatisch: vor jedem Commit
die tatsächlich vorgemerkten Dateien prüfen.

Die lokale Hauptanwendung wurde am 30.10.2026 nach diesem Ablauf aktualisiert.
Die Sicherung und privaten Vorher/Nachher-Nachweise bleiben lokal. Ein
allgemein getesteter automatisierter Wiederherstellungsablauf, externe
Sicherung und regelmäßige Aufbewahrungskontrolle sind weiterhin offen.

## Werkzeug für vollständige Sicherung und getrennte Wiederherstellung

Das neue Werkzeug übernimmt Anhalten, vollständige Kopie aller fünf Laufzeitordner, Docker-Abbild, Prüfsummen und Wiederanlauf. Die Wiederherstellung ist ausschließlich in einen neuen Ordner erlaubt. Befehle, Datenschutz und Grenzen stehen in [BETA_BETRIEB.md](BETA_BETRIEB.md). Ein Projektpaket ersetzt diese Vollsicherung weiterhin nicht.

## Sicherheits-/Archivstand vom 30.10.2026

Die neue Ausgabeablage benötigt keine automatische Datenmigration. Gemeinsam
verwendete Alt-Ausgaben bleiben auf Benutzerwunsch als historischer Bestand
unverändert erhalten. Nach dem Neustart bereits offene Formulare einmal neu
laden, damit der neue CSRF-Token verwendet wird. Bestehende Sitzungen und
Passwörter werden nicht zurückgesetzt.

Vorhandene Quelldateilücken werden in Projektpaketen ausdrücklich dokumentiert;
sie werden beim Update weder durch Platzhalterdateien verdeckt noch aus den
Originalprojekten gelöscht.
