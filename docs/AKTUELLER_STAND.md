# Aktueller Stand edoku

Stand: 17.11.2026. Paketversion: `0.1.0-beta.1`. Dieser Überblick beschreibt den geprüften Arbeitsstand und die getrennte Online-Testbereitstellung. Der zuvor auf `gm/coolify-test-20261117` geprüfte Programmstand ist einschließlich Bedienungsanleitung und Screenshots in `main` übernommen; ein neuer Release-Tag wurde nicht erstellt. Die Übernahme im Repository ersetzt keine bestehende Installation und startet keine Datenmigration. Der datierte Verlauf bleibt im [Changelog](../CHANGELOG.md) erhalten.

## Online-Testbetrieb vom 17.11.2026

Mehrstufiger Docker-Build, direkter Node-Start mit Bereitschaftsprüfung, eigener Online-Erstzugang und separate Compose-Datei mit fünf dauerhaften Volumes ergänzt. Alle 109 Prüfungen und eine getrennte Compose-Neuinstallation samt Containeraustausch bestanden. Die ältere lokale Übernahme vom 06.11.2026 bleibt als solche dokumentiert. Zusätzlich wurden HTTPS, Anmeldung, Speichern/Wiederladen und PDF-/ZIP-Erzeugung online am Programmcommit `a07104ba18c0cb1ea0d7958ebc32504c47bd002e` verifiziert. Das künstliche Testprojekt liefert 33 Einzel-PDFs mit 35 Seiten, meldet aber 15 fehlende PDF-Quellen; es ist kein vollständiger Export. Der konkrete Download wurde nicht unabhängig geprüft. [Online-Prüfstand und Grenzen](ONLINE_PRUEFSTAND.md), [technischer Betrieb](COOLIFY.md).

Die [bebilderte Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) beschreibt ausschließlich die App-Nutzung. Installation und Betrieb bleiben getrennt dokumentiert. Neue Screenshots zeigen nur künstliche Testdaten; ältere Aufnahmen bleiben als Verlauf erhalten.

## Ergebnis

edoku ist eine lokal lauffähige Beta für Elektro-Bestandsdokumentationen. Die normale lokale Docker-Anwendung wurde nach Vollsicherung und ausdrücklicher Freigabe auf die geprüften SQLite-Stufen 1 und 2 umgestellt. Konten, Passwortdaten, bestehende Projektinhalte und historische Dateien sind dabei erhalten geblieben. Die aktuelle Ergänzung macht Gerätelisten und Positionen gezielt per SQL abfragbar.

## Umgesetzt und geprüft

| Bereich | Aktueller Umfang | Prüfung und Grenze |
| --- | --- | --- |
| Oberfläche | Ruhige technische Gestaltung, gemeinsame Formulare, Navigation, App-Icon, Hell/Dunkel und Erhalt eigener Themes | Browserprüfungen für die bearbeiteten Seiten; keine vollständige Barrierefreiheitsabnahme |
| Kapitel und Exporte | Gemeinsamer Kapitelplan, tatsächliche PDF-Seiten, klickbares Inhaltsverzeichnis, finale Dateinummern, PDF und ZIP | Automatisierte Exportfälle und Vergleich bestehender Projektkopien; fachliche Freigabe und Druckabnahme offen |
| Brandschutzfotos | Fehlende aktive Fotoverweise sichtbar in Fachseite, Dashboard, Export und Ausgabedokumentation | Unvollständiger Exportstatus; fehlende Bilder werden nicht erfunden oder aus Projekten entfernt |
| Benutzerverwaltung | Geschlossene Selbstregistrierung als Standard, einheitliche neue Passwortregeln, klare Rollen, Kontofehler, Schutz des letzten aktiven Systemadmins | Testkonten und HTTP-/Dialogprüfungen; bestehende Passwörter und alte Rollen bleiben erhalten |
| Sicherheit und Archive | Projektgrenzen, CSRF, Loginbegrenzung, geprüfte Dateitypen/Pfade, echte Projektpakete und konfliktfreie Rückimporte | Automatisierte Kernfälle; öffentlicher Mehrbenutzerbetrieb nicht vollständig abgenommen |
| Sicherung | Vollsicherung aller fünf Laufzeitordner einschließlich Datenbank und Programmabbild, Prüfsummen, Wiederherstellung in neue Ordner | Lokale Sicherung und Rückwege geprüft; zusätzliche externe Sicherung und regelmäßige Proben bleiben Betriebsaufgaben |
| SQLite-Stufe 1 | Neun vollständige Projektdatensätze in `storage/app.db`, gemeinsame Speichertransaktionen und Konflikterkennung | Ausgangs-JSON bleibt unverändert, ist aber kein aktueller Spiegel |
| SQLite-Stufe 2 | Zusätzliche Tabellen für Gerätelisten und Positionen, atomar durch SQLite-Trigger synchronisiert | Vollständiger Projektdatensatz bleibt führend; keine unabhängig beschreibbare zweite Datenquelle |

Details: [Gestaltung](GESTALTUNG.md), [Brandschutzfotos](BRANDSCHUTZFOTOS.md), [Benutzerverwaltung](BENUTZERVERWALTUNG.md), [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md).

## Nachgewiesener Prüfstand

- **109 automatisierte Prüfungen:** 101 Node.js und acht Python, erfolgreich im geprüften Node-22-Abbild. Anleitung: [Tests](TESTS.md).
- **Bestehende Projektkopien:** acht nicht gelöschte Projekte vor/nach SQLite-Stufe 2 verglichen, 80 Vergleichsprüfungen, gleiche Kapitel, Exportpositionen, Fotowarnungen und insgesamt 249 tatsächliche PDF-Seiten. ZIP-Erzeugung, Paketprüfung und Rückimport erfolgreich.
- **Rückwege:** bisherige SQLite-Programmversion kann die vollständigen Datensätze weiter bearbeiten und die Geräteprojektion bleibt aktuell. Rückweg zu JSON wurde ausschließlich in einer neuen Wiederherstellungskopie geprüft.
- **Normale Anwendung nach Aktivierung:** bestehende Tabellenzeilen und bisherigen Schemaobjekte erhalten; Gerätetabellen, Indizes und Trigger ergänzt. Alle erfassten Projektdatensätze lesend mit der aktiven Speicherlogik geprüft. Dateiprüfsummen, Datenbankintegrität, Fremdschlüssel, Programmabbild, Einbindungen und Einstellungen geprüft. Acht öffentliche HTTP-/Zugriffsschutzprüfungen und zwölf lesende API-Prüfungen erfolgreich.
- **Sicherungen:** geprüfte Vollsicherungen vor und nach Aktivierung vorhanden. Private Detailnachweise bleiben lokal; sie enthalten keine für GitHub geeigneten Demodaten.

Die zwölf API-Smoke-Prüfungen allein belegen keine Benutzerprojektfunktion: Das additive API-Grundgerüst nutzt teilweise neutrale Daten. Schreibende Abläufe wurden mit Testkonten bzw. Projektkopien geprüft, nicht an bestehenden Originalprojekten. Die fachliche Abnahme der bestehenden Dokumentationen bleibt offen.

## Datenhaltung und Bestandsschutz

SQLite ist eingebettet: Es wird kein zusätzlicher Datenbankserver benötigt. Docker liefert die benötigte Laufzeitbibliothek mit; die Anwendung legt bei einer echten Neuinstallation `storage/app.db` an. Neuinstallationen verwenden beide SQLite-Stufen. Vorhandene Installationen wechseln nur durch eine ausdrückliche, zuvor auf Kopien geprüfte Aktivierung.

Die vollständigen Projektdatensätze bleiben in SQLite in ihren bisherigen Objekt-/Listenstrukturen erhalten. Fotos, Anhänge, PDFs und ZIPs bleiben Dateien. Globale Einstellungen und Vorlagen bleiben dateibasiert. Neue Ausgaben gehören über stabile Benutzer-/Projektkennungen zu ihrem Projekt. Gemeinsam genutzte historische Ausgaben werden weder neu zugeordnet noch automatisch migriert.

## Was noch offen ist

1. Bestehende Unterlagen, Brandschutzfotos, Objekt-/Geräteangaben und Formulartexte fachlich vervollständigen und verantwortlich freigeben. Technisch erzeugbare PDFs sind keine fachlich vollständige Dokumentation.
2. Externe Sicherung, Aufbewahrung und regelmäßige Wiederherstellungsproben im tatsächlichen Betrieb einrichten.
3. Physische Druckprüfung von Ordnerrücken, Trennstreifen und Deckblättern sowie weitere Browser-/Barrierefreiheitsprüfung.
4. Eigenen Passwortwechsel, verpflichtenden Wechsel nach Reset und gegebenenfalls weitere Kontoschutzfunktionen planen; vorhandene Konten nicht automatisch verändern.
5. Weitere SQLite-Ausbaustufen gesondert planen: führende Speicherung einzelner Gerätefelder, anschließend gegebenenfalls Brandschutz- und Anhangsmetadaten. Aktuell ist Stufe 2 eine relationale Projektion.
6. Echte API-Anbindung, öffentlicher Serverbetrieb, Betriebsüberwachung und Lizenzentscheidung. Liegenschaften/Gebäude weiterhin additiv vorbereiten.

Die vollständige Arbeitsliste einschließlich fachlicher Detailaufgaben steht in [Offene Punkte](OFFENE_PUNKTE.md). Einstieg in alle Anleitungen: [Dokumentationsübersicht](README.md).
