# Tagesabschluss 17.11.2026

Der geprüfte edoku-Stand einschließlich Anwenderdokumentation ist in **main** übernommen. Die Paketversion bleibt `0.1.0-beta.1`; es wurde kein neuer Release-Tag erstellt. Bestehende Projekte, Konten, Passwortdaten, Sicherungen und der historische Altbestand sind erhalten.

## Programmstand und Bereitstellungen

| Bereich | Dokumentierter Stand |
| --- | --- |
| GitHub-Hauptbranch | Übernahme durch [Pull Request #1](https://github.com/loserat/edoku/pull/1), Programm-Merge [`4b4caaa`](https://github.com/loserat/edoku/commit/4b4caaa156b894cf0d661f37ffddf7dbe118715a) |
| Ursprünglicher Prüfbranch | `gm/coolify-test-20261117`, einschließlich Dokumentation bei `f96b6246f3a2f9c91dd4a91dd545469ab84e5988`; als Verlauf erhalten |
| Online-Testinstanz | Heute erfolgreich geprüfter Programmcommit `a07104ba18c0cb1ea0d7958ebc32504c47bd002e`, in der Ressource festgesetzt |
| Normale lokale Anwendung | Bisheriger, am 06.11.2026 aktivierter SQLite-Stand bleibt aktiv; heutiger GitHub-Merge änderte die laufende Installation nicht |
| Tagesabschluss | Reine Dokumentationspflege auf dem übernommenen Stand; keine Datenmigration und keine zusätzliche App-Bereitstellung |

GitHub-Quellstand, Online-Instanz und lokale Installation sind getrennte Zustände. Ein Merge aktualisiert vorhandene Datenablagen nicht automatisch. Die heutige Online-Testinstanz durfte nach ausdrücklicher Freigabe mit frischem Testbestand eingerichtet werden; diese Freigabe galt nicht für lokale Originale oder historische Dateien.

## Heute umgesetzt

- Docker-Laufzeit mit mehrstufigem Build, direktem Node-Start und tatsächlicher Bereitschaftsprüfung unter `/ready` ergänzt.
- Online-Testbetrieb mit gültigem HTTPS, Weiterleitung, eigenem Erstkonto und fünf persistenten Datenordnern eingerichtet und geprüft.
- Kompatible Paketkorrekturen innerhalb der bestehenden Versionsbereiche veröffentlicht. Die datierte npm-Prüfung meldete danach keine bekannten Paketlücken.
- README neu gegliedert, Anwender- und Betreiberinformationen getrennt sowie die [Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) mit 16 echten Screenshots künstlicher Testdaten erstellt.
- Anwenderanleitung auf App-Nutzung beschränkt; Installation, Serverbetrieb und Datenbankverwaltung bleiben in separaten technischen Anleitungen.
- Geprüften Programmstand, Tests, Grafiken und Dokumentation nach main übernommen. Gegenüber dem geprüften Branch änderten sich dabei ausschließlich neun Dokumentationsdateien für den Hauptbranch.
- Eigene synthetische lokale Compose-Testumgebung nach Archivierung entfernt. Vorhandene Sicherungen, Originaldaten und historische Ausgaben blieben erhalten.

## Tatsächlich geprüft

| Nachweis | Ergebnis |
| --- | --- |
| Lokales Node-22-Testabbild | 101 Node.js- und acht Python-Prüfungen bestanden; nach Paketkorrekturen erneut erfolgreich |
| Pull Request | [GitHub-Prüfung erfolgreich](https://github.com/loserat/edoku/actions/runs/44144263505) |
| Tatsächlicher main-Merge-Commit | [GitHub-Prüfung erfolgreich](https://github.com/loserat/edoku/actions/runs/44144405963): 109 Prüfungen, davon 101 Node.js und acht Python |
| Online-Betriebsbereitschaft | HTTPS ohne Zertifikatsausnahme, HTTP-Weiterleitung und echte SQLite-Bereitschaft erfolgreich |
| Online-Bedienung | Anmeldung, Projektanlage, Stammdaten und Geräteangaben gespeichert und nach Neuladen wieder sichtbar |
| Persistenz | Gespeicherte Testdaten und Anmeldung überstanden den nachfolgenden Containerwechsel; zusätzlich getrennte Compose-Probe mit fünf erhaltenen Volumes |
| Online-Ausgabe | Interne PDFs, Gesamt-PDF, ZIP und Reihenfolgeprotokoll erstellt; fachlicher Teilstand ausdrücklich gemeldet |
| GitHub-Handbuch | Alle 16 Bilder vollständig geladen, alle 16 Inhaltsverzeichnisziele vorhanden, Kapitelansicht mit Bild visuell bestätigt |
| Bestandsschutz | 758 lokale Bestandsdateien sowie Schema und Inhalte aller neun Datenbanktabellen beim Merge unverändert; vorhandene lokale Quelländerungen erhalten |

Der vorherige GitHub-Fehler in der Handbuch-Dateiansicht trat bei der erneuten Browserprüfung nicht mehr auf. Die Bilder zeigen ausschließlich künstliche Angaben. Private Detailnachweise und Sicherungen werden nicht veröffentlicht.

Frühere technische Vergleiche von acht bestehenden Projektkopien mit insgesamt 249 tatsächlichen PDF-Seiten bleiben als datierter Nachweis erhalten. Sie wurden heute nicht nochmals als neue fachliche Abnahme ausgeführt.

## Wichtige Grenze des Testexports

Das künstliche Online-Projekt hat **48 geplante Einzel-PDFs, 33 vorhandene Einzel-PDFs und 35 tatsächliche Seiten**. **15 PDF-Dateien fehlen**, darunter zwei Pflichtunterlagen. Die Anwendung meldet deshalb **Unvollständiger Export**.

Die Ausgabedateien sind als Teilstand verfügbar. **„Bereit“ an einer Datei bedeutet nicht, dass die Dokumentation vollständig oder fachlich freigegeben ist.** Der konkrete Online-Download wurde wegen abgelehnter Browserfreigabe nicht unabhängig geprüft. Diese Grenze bleibt offen; sie wurde nicht durch Abwählen benötigter Unterlagen verdeckt.

## Bestand und Sicherungen

Konten und Passwortdaten wurden beim Repository-Merge nicht zurückgesetzt. Lokale Projekte und Daten wurden weder durch Testkopien ersetzt noch neu migriert. Gemeinsam verwendete historische Ausgaben bleiben separat erhalten. Bestehende Vollsicherungen vor und nach der früheren lokalen SQLite-Aktivierung bleiben vorhanden.

Zur vollständigen Sicherung gehören weiterhin `data/`, `config/`, `storage/`, `output/` und `templates/` einschließlich SQLite. Alte Projekt-JSON-Dateien sind nach SQLite-Aktivierung kein aktueller Spiegel. Projektpaket, Dokumentations-ZIP und Vollsicherung haben unterschiedliche Zwecke; siehe [Sicherung und Betrieb](BETA_BETRIEB.md) und [Projektarchive](PROJEKTARCHIVE.md).

## Offen und nächster sinnvoller Schritt

1. Den unvollständigen Testexport anhand der fehlenden Quellen und des Reihenfolgeprotokolls fachlich prüfen. Benötigte Unterlagen ergänzen und anschließend PDF und ZIP einschließlich Download kontrollieren. Bestehende Originalprojekte dafür weiterhin nur auf Kopien verwenden.
2. Externe Sicherung, Aufbewahrung und regelmäßige Wiederherstellungsproben organisieren.
3. Ausdrucke von Ordnerrücken, Trennstreifen und Deckblättern praktisch prüfen; weitere Browser- und Barrierefreiheitsfälle abnehmen.
4. Eigenen Passwortwechsel und gegebenenfalls verpflichtenden Wechsel nach Reset sowie zusätzliche Kontoschutzfunktionen gesondert planen.
5. Weiteren SQLite-Ausbau, echte Benutzerprojekt-API, Betriebsüberwachung und Lizenzentscheidung getrennt bearbeiten.

Für heute ist die Umsetzung abgeschlossen. Der nächste Arbeitsschritt ist eine gesonderte fachliche Prüfung; es läuft keine unbeauftragte Migration oder Bereitstellung weiter.

[Aktueller Stand](AKTUELLER_STAND.md) · [Prüfumfang](TESTS.md) · [Offene Punkte](OFFENE_PUNKTE.md) · [Dokumentationsübersicht](README.md)
