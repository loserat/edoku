# Dokumentation edoku

Stand: **17.11.2026**, Paketversion `0.1.0-beta.1`. Die Dokumentation und der zuvor geprüfte Programmstand sind in `main` übernommen. Historische datierte Einträge bleiben erhalten; ein Dokumentationsupdate ist kein neuer Release.

## Für Anwender

| Du möchtest … | Hier anfangen |
| --- | --- |
| Den gesamten Ablauf Schritt für Schritt lernen | **[Bebilderte Bedienungsanleitung](BEDIENUNGSANLEITUNG.md)** |
| Funktionen und Oberfläche kennenlernen | [Haupt-README](../README.md) |
| Exportzähler und unvollständige Ausgaben verstehen | [Gesamt-PDF und ZIP](BEDIENUNGSANLEITUNG.md#10-gesamt-pdf-und-zip-erstellen) |
| Fehlende Brandschutzfotos zuordnen | [Brandschutz bedienen](BEDIENUNGSANLEITUNG.md#8-brandschutz-dokumentieren), [Warnlogik](BRANDSCHUTZFOTOS.md) |
| Ein Projekt zur Weiterbearbeitung übertragen | [Projektpakete bedienen](BEDIENUNGSANLEITUNG.md#12-projektpakete-und-archiv-verwenden) |
| Darstellungsoptionen finden | [Darstellung und Einstellungen](BEDIENUNGSANLEITUNG.md#13-darstellung-und-einstellungen) |
| Ein Problem lösen | [Fragen und Fehlermeldungen](BEDIENUNGSANLEITUNG.md#15-häufige-fragen-und-fehlermeldungen) |

Die Bedienungsanleitung behandelt ausschließlich die App-Nutzung. Servereinrichtung, Datenbankbetrieb und Bereitstellung sind getrennte Themen für Betreiber.

## Für Betrieb und Administration

| Anliegen | Anleitung |
| --- | --- |
| Neu installieren, Docker und SQLite verstehen | [Installation](../INSTALL.md) |
| Online-Testinstanz mit HTTPS und dauerhaften Datenordnern betreiben | [Coolify](COOLIFY.md) |
| Bestehende Installation aktualisieren | [Update und Datenerhalt](UPDATE.md) |
| Alle Daten einschließlich Konten und Altbestand sichern | [Lokaler Beta-Betrieb](BETA_BETRIEB.md) |
| Sicherung in einen neuen Ordner wiederherstellen | [Getrennte Wiederherstellung](BETA_BETRIEB.md#getrennte-wiederherstellung) |
| Konten, Rollen, Registrierung und Passwortreset verwalten | [Benutzerverwaltung](BENUTZERVERWALTUNG.md) |
| Projektpakete, Validierung und Importbereitstellung verstehen | [Projektarchive](PROJEKTARCHIVE.md) |
| SQLite-Stufen, Herkunftsdaten und Rückweg verstehen | [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md) |
| Rechte, Schreibschutz und Sicherheitsgrenzen beurteilen | [Sicherheit](SICHERHEIT.md) |
| Globale Gestaltung und Themes pflegen | [Gestaltung](GESTALTUNG.md), [Theme-System](THEME.md) |

Die fünf Laufzeitordner `data/`, `config/`, `storage/`, `output/` und `templates/` bilden zusammen den zu sichernden Bestand. Nach SQLite-Aktivierung sind alte Projekt-JSON-Dateien Ausgangskopien und kein aktueller Spiegel. Ein Projektpaket ersetzt keine Vollsicherung. Gemeinsam genutzte historische Ausgaben bleiben separat erhalten.

## Für Entwicklung und Abnahme

- [Aktueller Umfang und Prüfstatus](AKTUELLER_STAND.md)
- [Tatsächlich geprüfter Online-Stand und Grenzen](ONLINE_PRUEFSTAND.md)
- [Technik und gemeinsamer Exportplan](TECHNIK.md)
- [Automatisierte Tests und fachliche Abnahme](TESTS.md)
- [API-Grundgerüst und seine Grenzen](API.md)
- [Priorisierte offene Punkte](OFFENE_PUNKTE.md)
- [Änderungsverlauf](../CHANGELOG.md), [Release Notes](RELEASE_NOTES.md), [Projektupdate](PROJEKTUPDATE.md)
- [Repository-Sicherheitscheck](REPO_SICHERHEITSCHECK.md)
- [Screenshots, Datum und Herkunft](screenshots/README.md)

## Aussagekraft der Nachweise

**109 automatisierte Prüfungen** bestanden im geprüften Node-22-Abbild. Acht bestehende Projekte wurden ausschließlich auf Kopien vor und nach SQLite-Stufe 2 verglichen: gleiche Kapitel und Exportpositionen, 249 tatsächliche PDF-Seiten, ZIPs und Rückimporte. Die normale lokale Anwendung wurde nach Freigabe aktiviert und auf Datenerhalt geprüft. Schreibende Tests mit Originalkonten oder Originalprojekten erfolgten dabei nicht.

Zusätzlich wurden Online-Anmeldung, Speichern/Wiederladen, Erhalt über einen Containerwechsel und PDF-/ZIP-Erzeugung auf einem künstlichen Projekt geprüft. Das Beispiel bleibt wegen 15 fehlender PDF-Quellen unvollständig. Der konkrete Online-Download ist nicht unabhängig verifiziert.

Technische Prüfungen und Screenshots ersetzen keine fachliche Freigabe, Druckabnahme oder vollständige Sicherheits-/Betriebsabnahme. Private Sicherungen und Detailnachweise bleiben in den nicht veröffentlichten Bereichen `backups/` beziehungsweise `intern/`.
