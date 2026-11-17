# Tests und Beta-Abnahme

Stand: 17.11.2026. Der geprüfte Stand verwendet Node.js 22 und Python 3.11 oder neuer. Die vollständige Suite besteht aus **109 Prüfungen: 101 Node.js und acht Python**. Die aktuelle GitHub-Prüfung des übernommenen Programmstands ist unten mit konkretem Commit und Lauf verlinkt; ältere datierte Abschnitte behalten ihre damalige Aussage.

## Sicher ausführen

Tests verwenden temporäre Ordner, künstliche Konten und Prüfprojekte. Einige Exporttests schreiben außerdem Nachweise unter `output/pdf/` und `output/counting-review/` des Testcheckouts. Deshalb ausschließlich in einem getrennten Checkout oder Container mit neutralen Startdaten ausführen. Niemals die normalen Laufzeitordner zum Testen einbinden.

```bash
npm run check
npm test
```

Für einen Containerlauf das Prüfabbild in einem sauberen Checkout bauen:

```bash
docker build -t edoku:pruefung .
docker run --rm --network none edoku:pruefung npm run check
docker run --rm --network none edoku:pruefung npm test
```

Die fünf Laufzeitordner werden dabei nicht vom Host eingebunden. `better-sqlite3` muss zur Node-Version und Plattform passen; ein unter Linux gebauter `node_modules`-Ordner ist nicht direkt unter macOS nutzbar. Das Node-22-Abbild vermeidet diesen Plattformwechsel.

## Prüfumfang

| Befehl | Prüfungen | Wesentliche Fälle |
| --- | ---: | --- |
| `npm run test:exports` | 18 | Kapitelkollisionen, Elternkapitel, Reihenfolge, tatsächliche PDF-Seiten, interne Sprunglinks, Dateinummern und ZIP-Zuordnung |
| `npm run test:preservation` | 3 | Bestehende Konten/Passwörter/Projekte bei Start und Seitenaufrufen, leere vorhandene Datenbank, echte Erstinstallation |
| `npm run test:security` | 17 | Projektgrenzen, Dateitypen, Symlinks, Archive, Importpfade, Rechte, CSRF und Fehler beim Publizieren/Speichern |
| `npm run test:audit` | 5 | Erlaubte Protokollmetadaten, parallele Einträge, beschädigte Ablage, HTTP-Ergebnisse und Fehlersperre |
| `npm run test:e2e` | 1 | HTTP-Anmeldung, neues Projekt, Geräteformular, Anhang, PDF/ZIP und Paket-Rückimport |
| `npm run test:photos` | 6 | Aktive fehlende Fotoverweise, leere optionale Felder, Dateigrenzen, frische Prüfung und sichtbarer unvollständiger Exportstatus |
| `npm run test:theme` | 4 | Erhalt alter/eigener Themes, Spezialvorlagen und lesbare Schaltflächen |
| `npm run test:users` | 13 | Neue Passwortregeln, alte Passwörter, Registrierung, Rollen-/Statusfehler, Sperren, Sitzungsentzug und letzter aktiver Systemadmin |
| `npm run test:storage` | 28 | Vollständige Übernahme, Transaktionen, Konflikte, aktuelle Projektpakete, Rückweg und Geräteprojektion |
| `npm run test:backup` | 8 | Vollsicherung, getrennte Wiederherstellung, Prüfsummen, Pfad-/Containergrenzen und Wiederanlauf |
| `npm run test:deployment` | 6 | Eigener Erstzugang, HTTPS-Proxy/Cookies, Neustart, ungültige Erstangaben und echte Bereitschaft |
| **Gesamt** | **109** | `npm test` führt alle aufgeführten Testgruppen aus |

`npm run check` prüft zusätzlich JavaScript-Syntax und EJS-Kompilierung; es ist nicht in der Zahl 109 enthalten. Die Workflow-Konfiguration in `.github/workflows/` führt Quellprüfung und Tests bei Push/PR aus. Ob der aktuelle Arbeitsstand veröffentlicht wurde und der zugehörige CI-Lauf bestanden hat, muss am konkreten Commit geprüft werden.

Das kleine künstliche Exportprojekt erzeugt zwölf Einzel-PDFs mit zusammen 20 Seiten. Ein längeres Prüfprojekt hat 61 Seiten einschließlich dreiseitigem Inhaltsverzeichnis mit 56 geprüften internen Sprunglinks. Der vollständige HTTP-Ablauf prüft sechs PDF-Seiten aus fünf Einzel-PDFs einschließlich eines zweiseitigen importierten Plans. Diese unterschiedlichen Werte gehören zu unterschiedlichen Testfällen.

## SQLite-Stufen

Stufe 1 wird unter anderem auf Erhalt aller Felder und Reihenfolgen, unveränderte Ausgangsdateien, fehlerhafte Quellen, idempotente Wiederholung, gemeinsame Speichertransaktionen, Projektversionen, parallele Anfragen und den Rückweg in einen neuen Ordner geprüft.

Die zehn zusätzlichen Fälle der Stufe 2 prüfen aktuelle SQLite-Quellen statt alter JSON-Dateien, individuelle Felder, doppelte IDs, ältere Formen, Reihenfolge, projektgetrennte Änderungen/Löschungen, atomaren Abbruch, veraltete Anfragen, Stufe-1-kompatible Trigger, erkennbare Tabellenabweichungen, Paket-Rückimport und aktuellen JSON-Rückweg. Eine abgebrochene Übernahme hinterlässt keine Teilaktivierung. Der HTTP-Ablauf prüft außerdem, dass ein im Geräteformular gespeicherter Wert tatsächlich in der Positionstabelle ankommt.

Details zum führenden Datensatz und zur zusätzlichen Projektion: [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md).

## Vergleich bestehender Projektkopien

Vor SQLite-Stufe 2 wurde die aktuelle Installation konsistent vollständig gesichert und in getrennte Prüfbereiche kopiert. Verglichen wurden acht nicht gelöschte Projekte mit dem aktuellen SQLite-Stand vor und nach Geräteübernahme. Ergebnis: 80 Vergleichsprüfungen bestanden, gleiche Kapitel, Exportpositionen, Fotowarnungen und insgesamt 249 tatsächliche PDF-Seiten. Gesamt-PDFs, ZIPs, Paketprüfung und Rückimporte wurden geprüft.

Eine zusätzliche Kopie wurde mit der tatsächlich bisherigen SQLite-Programmversion bearbeitet und mit dem neuen Programm gelesen. Die Geräteprojektion blieb aktuell. Eine aktuelle Kopie wurde vollständig gesichert, in einen neuen Ordner wiederhergestellt und auf den neuesten materialisierten JSON-Stand geprüft. Originaldaten und historischer Bestand wurden dafür nicht bearbeitet.

## Prüfung nach lokaler Aktivierung

Nach ausdrücklicher Freigabe wurde exakt das geprüfte Abbild in der normalen lokalen Anwendung aktiviert. Nachweise: bestehende Tabellenzeilen und Schemaobjekte erhalten; nur Gerätetabellen, Indizes und Trigger ergänzt. Konten, Passwortdaten, Projektinhalte und historische Dateien blieben unverändert. Alle erfassten Projektdatensätze wurden mit der aktiven Speicherlogik über eine schreibgeschützte Verbindung gelesen und verglichen. Datenbankintegrität, Fremdschlüssel, Dateiprüfsummen und Programmprüfsummen bestanden.

Acht öffentliche HTTP-/Zugriffsschutzprüfungen und zwölf lesende API-Prüfungen waren erfolgreich. Vollsicherungen vor und nach Aktivierung sind geprüft; der Wiederanlauf nach der abschließenden Sicherung wurde kontrolliert. Schreibende Tests erfolgten mit Testkonten bzw. Projektkopien, nicht mit bestehenden Originalkonten oder Originalprojekten. Private Detailnachweise liegen lokal unter `intern/`, Sicherungen unter `backups/` und werden nicht veröffentlicht.

## API-Smoke-Test

Bei laufender Anwendung:

```bash
npm run smoke:api
```

Im normalen Container:

```bash
docker exec edoku_v1 node scripts/smoke-api.js
```

Die zwölf lesenden Prüfungen kontrollieren Status, JSON-Hülle und Fehlerantworten. Das API-Grundgerüst nutzt teilweise neutrale Daten. Dieser Test allein belegt keine Lesbarkeit oder fachliche Richtigkeit tatsächlicher Benutzerprojekte.

## Fachliche und manuelle Abnahme

Neue Exporte zunächst in einer getrennten Testinstallation mit neutralen Projekten oder konsistenten Kopien erzeugen. Ein Export in der normalen Anwendung ist eine bewusste schreibende Aktion.

1. Anmeldung, Projektwechsel, Rollen, gesperrte Konten und den sichtbaren aktuellen Projektstand prüfen.
2. Mehrere Leistungsbereiche, Gerätelisten und mehrseitige Anhänge auswählen; Matrix, Vorschau und Dashboard auf dieselben Kapitel und Zähleinheiten vergleichen.
3. Gesamt-PDF öffnen und Inhaltsverzeichnis einschließlich langer Titel und letzter Kapitel anklicken. Überschriften, Seitenzahlen und Geräte-/Anleitungsbezüge fachlich prüfen.
4. ZIP entpacken; Reihenfolge, Kapitelordner, Dateien und Warnungen mit der Gesamt-PDF abgleichen. Tatsächlich fehlende Unterlagen und Fotos nachliefern und verantwortlich zuordnen.
5. Tastatur, schmale/breite Fenster, interne Tabellenscroller, Dialoge und Hell/Dunkel prüfen. Die bisherigen Browserprüfungen sind keine vollständige Barrierefreiheits- oder physische Smartphone-Abnahme.
6. Trennstreifen, Deckblätter und Ordnerrücken auf echten Bögen ausdrucken; Maße, Ausrichtung, Lesbarkeit und Ordnerkapazität prüfen.

Die bestehenden Dokumentationen sind durch die technischen Kopientests nicht fachlich freigegeben. Norm-/Formulartexte, Unterlagenvollständigkeit, reale Druckausgaben, beliebige externe PDFs und öffentlicher Serverbetrieb bleiben gesondert abzunehmen. Weitere Aufgaben: [Offene Punkte](OFFENE_PUNKTE.md).

## Coolify-Deploymentfälle vom 17.11.2026

Die sechs zusätzlichen Fälle prüfen den eigenen Erstzugang nur bei neuer Datenbank, dessen Passwortprüfung vor Datenbankanlage, die echte Bereitschaft und den Containercheck. Das neue Abbild bestand alle 109 Prüfungen. Eine isolierte Compose-Probe startete mit fünf frischen Volumes und überstand den Austausch des Containers mit identischen Tabellenzeilen und Markerdateien. Das ist ein lokaler Bereitstellungsnachweis; die Online-Abnahme ist gesondert zu dokumentieren. Einrichtung: [Coolify](COOLIFY.md).

Der abschließend korrigierte Paketstand vom 17.11.2026 bestand die vollständige Suite ebenfalls mit 109 Prüfungen. Die ergänzende Paketprüfung `npm audit --omit=dev` meldete 0 bekannte Lücken. Das ersetzt keine vollständige Sicherheitsabnahme.


## Tatsächliche Online-Prüfung und Dokumentationspflege vom 17.11.2026

Der lokal geprüfte Programmcommit wurde zusätzlich online aktiviert. HTTPS, `/ready`, Anmeldung, Stammdaten, Geräteänderungen, Wiederladen und Erhalt über einen Containerwechsel geprüft. Der finale Export erzeugte 33 vorhandene Einzel-PDFs mit 35 Seiten, Gesamt-PDF und ZIP, meldete aber 15 fehlende PDF-Quellen. Die Ausgabe ist fachlich unvollständig; der konkrete Download wurde nicht unabhängig geprüft. Der vollständige [Online-Prüfstand](ONLINE_PRUEFSTAND.md) trennt diese Befunde von den automatisierten Fällen.

Die spätere README-/Handbuchpflege ändert keinen Anwendungscode und wiederholt deshalb nicht sämtliche schreibenden Anwendungstests. Dokumentationsprüfungen umfassen lokale Linkziele und Sprungmarken, eingebundene Screenshots, Trennung von Anwender-/Betreiberinformationen, Veröffentlichungsumfang sowie unveränderte geschützte Laufzeitdateien und Datenbankinhalte. Screenshots dokumentieren sichtbare Ansichten; sie sind keine neue End-to-End-Abnahme aller dargestellten Schaltflächen.


## Nachgewiesene GitHub-Prüfungen des main-Übergangs

Am 17.11.2026 waren sowohl [Pull Request #1](https://github.com/loserat/edoku/actions/runs/44144263505) als auch der tatsächliche [main-Merge-Commit `4b4caaa`](https://github.com/loserat/edoku/actions/runs/44144405963) erfolgreich. Die Protokolle des Hauptbranch-Laufs bestätigen 101 bestandene Node.js-Tests, null Fehler und acht erfolgreiche Python-Tests: **109 insgesamt**. Der Git-Baum des Merge-Commits entsprach exakt der vorbereiteten Übernahme; gegenüber dem bisherigen geprüften Branch änderten sich nur neun Dokumente.

Zusätzlich wurde die GitHub-Vorschau der Anwenderanleitung erneut live geprüft: alle 16 Screenshots mit positiver Bildgröße vollständig geladen, alle 16 Inhaltsverzeichnisziele vorhanden, ein Kapitelsprung samt Bild sichtbar bestätigt. Der zuvor beobachtete GitHub-Dateiansichtsfehler trat dabei nicht mehr auf.

Der anschließende Tagesabschluss verändert nur Dokumentation. Er wird durch Link-, Umfangs- und Bestandsschutzprüfungen validiert; die Belege oben gehören ausdrücklich zum genannten Programmcommit. Neue Dokumentationscommits sind daran und an ihren eigenen CI-Läufen zu unterscheiden. Vollständiger [Tagesabschluss](TAGESABSCHLUSS_2026-11-17.md).
