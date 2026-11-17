# Dokumentation edoku

Stand: 17.11.2026. Diese Dokumentation beschreibt den aktuellen Arbeitsstand `0.1.0-beta.1`. Ein lokal aktivierter Programmstand ist kein neuer GitHub-Release. Ältere datierte Abschnitte in Changelog und Release Notes bleiben als Verlauf erhalten.

## Einstieg und Bedienung

| Anliegen | Anleitung |
| --- | --- |
| Funktionen und Screenshots kennenlernen | [Haupt-README](../README.md) |
| Online-Testinstanz mit HTTPS und dauerhaften Datenordnern betreiben | [Coolify](COOLIFY.md) |
| Neu installieren; Docker und SQLite verstehen | [Installation](../INSTALL.md) |
| Aktuellen Umfang und Prüfstatus überblicken | [Aktueller Stand](AKTUELLER_STAND.md) |
| Konten, Rollen, Registrierung und Passwortreset verwalten | [Benutzerverwaltung](BENUTZERVERWALTUNG.md) |
| Fehlende Brandschutzfotos und Exportwarnungen beurteilen | [Brandschutzfotos](BRANDSCHUTZFOTOS.md) |
| Hell/Dunkel, eigene Farben und Gestaltung verstehen | [Gestaltung](GESTALTUNG.md), [Theme-System](THEME.md) |
| Ein einzelnes Projekt übertragen | [Projektarchive](PROJEKTARCHIVE.md) |

## Betrieb und Datenerhalt

| Anliegen | Anleitung |
| --- | --- |
| Vorhandene Installation aktualisieren | [Update und Datensicherung](UPDATE.md) |
| Alle Daten einschließlich Konten und Altbestand sichern | [Lokaler Beta-Betrieb](BETA_BETRIEB.md) |
| Sicherung in einen neuen Ordner wiederherstellen | [Getrennte Wiederherstellung](BETA_BETRIEB.md#getrennte-wiederherstellung) |
| SQLite-Stufen, Herkunftsdaten und Rückweg verstehen | [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md) |
| Rechte, Schreibschutz und Sicherheitsgrenzen beurteilen | [Sicherheit](SICHERHEIT.md) |

Die fünf Laufzeitordner `data/`, `config/`, `storage/`, `output/` und `templates/` bilden zusammen den zu sichernden Bestand. Nach SQLite-Aktivierung sind die alten Projekt-JSON-Dateien Ausgangskopien und kein aktueller Spiegel. Ein Projektpaket ersetzt keine Vollsicherung. Gemeinsam genutzte historische Ausgaben bleiben separat erhalten.

## Entwicklung und Abnahme

- [Technik und gemeinsamer Exportplan](TECHNIK.md)
- [Automatisierte Tests und fachliche Abnahme](TESTS.md)
- [API-Grundgerüst und seine Grenzen](API.md)
- [Priorisierte offene Punkte](OFFENE_PUNKTE.md)
- [Änderungsverlauf](../CHANGELOG.md), [Release Notes](RELEASE_NOTES.md), [Projektupdate](PROJEKTUPDATE.md)
- [Repository-Sicherheitscheck](REPO_SICHERHEITSCHECK.md)

## Aussagekraft der Nachweise

109 automatisierte Prüfungen sind im geprüften Node-22-Abbild erfolgreich. Zusätzlich wurden acht bestehende Projekte ausschließlich auf Kopien vor und nach SQLite-Stufe 2 verglichen: gleiche Kapitel und Exportpositionen, 249 tatsächliche PDF-Seiten, ZIPs und Rückimporte. Die normale lokale Anwendung wurde anschließend nach Freigabe aktiviert und lesend sowie auf Datenerhalt geprüft. Schreibende Tests mit bestehenden Originalkonten oder Originalprojekten wurden dabei nicht durchgeführt.

Technisch bestandene Prüfungen ersetzen weder die fachliche Freigabe einer Dokumentation noch eine Druck- oder Sicherheitsabnahme für öffentlichen Serverbetrieb. Private Sicherungen und detaillierte Prüfnachweise bleiben außerhalb der veröffentlichten Dokumentation in `backups/` bzw. `intern/`; sie werden nicht eingecheckt.
