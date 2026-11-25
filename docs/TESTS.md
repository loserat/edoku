# Prüfungen und Beta-Abnahme edoku

## Bereinigter Veröffentlichungsstand 0.3.0-beta.1 – 25.11.2026

Vollständige Prüfung im frisch gebauten Produktionsabbild mit neutralen Ausgangseinstellungen: **319 Anwendungstests, acht Sicherungsprüfungen und zwei Vertragsprüfungen bestanden**. Syntax: 175 JS-Dateien/48 EJS-Vorlagen; erzeugter Vertrag 3.9.0, 64 Operationen/55 Werkzeuge. Fünf Mac-/APFS-Wartungstests unter Linux übersprungen. Kein echter Projektbestand eingebunden. Der GitHub-Prüflauf und tatsächliche Online-Rollout sind davon getrennte Nachweise. [Veröffentlichungsprüfung](GITHUB_STAND_2026-11-25.md).

## Lokal aktiviertes GUI-Paket vom 25.11.2026

[Schlichter Doku-Assistent](GUI_ASSISTENT_VEREINFACHUNG.md): **43 gezielte Funktionstests und 46 Browserprüfungen bestanden**. Suche/Filter, alle Ansichten, Antworten, Seitenbereiche und Einzelprüfung mit direktem Dateiwechsel geprüft; nächste Sichtungscheckbox leer und Freigabe gesperrt. Breiten 1440/900/768/375/320 Pixel ohne horizontalen Seitenüberlauf; mobile Dateiprüfung ebenfalls geprüft. Syntax 175 JS-Dateien/48 Vorlagen, API-/MCP-Vertrag unverändert gültig. Tests nur mit künstlichen Daten; Testcontainer beendet. Die 43 Funktionstests außerdem direkt im neuen beta.13-Abbild erfolgreich wiederholt. Lokale Aktivierung: frische Vor-/Nachsicherung, getrennte Wiederherstellungs-/Startprobe alt/neu, 2.000 Dateien/16 Tabellen unverändert und Datenbankprüfung fehlerfrei; ausgelieferte GUI und lesender MCP geprüft. Kein neuer vollständiger Anwendungstestlauf. Die folgenden beta.12-Nachweise bleiben der frühere Releaseprüfstand.

## Abschließender Prüfstand 24.11.2026

App **0.2.0-beta.12 / API-MCP 3.9.0**: **319 Anwendungstests, acht Sicherungsprüfungen und zwei Vertragsprüfungen** bestanden. Zuvor **35 gezielte Prüfungen** einschließlich reproduziertem Rücksprung in der Dateiprüfung. Syntax: **175 JavaScript-Dateien und 48 EJS-Vorlagen**; erzeugter Vertrag: 64 HTTP-Operationen/55 MCP-Werkzeuge. Fünf unveränderte Mac-/APFS-Wartungstests unter Linux übersprungen; keine neue native Mac-Prüfung daraus ableiten.

Softwaretests verwendeten künstliche Projekte oder getrennte Kopien. Nachweise zu Zwischenversionen und Herstelleroriginalen stehen im [Entwicklungsupdate 23.–24.11.](ENTWICKLUNGSUPDATE_2026-11-23_24.md) sowie den Fachanleitungen für [Aufgabensteuerung](ZENTRALE_AUFGABENSTEUERUNG.md), [V6-Prüflücken](PRUEFLUECKEN_ME01.md), [V7-Prüfung](ME01_QUELLEN_UND_MASSE.md), [Zurückziehen](DATEIVORSCHLAEGE_ZURUECKZIEHEN.md) und [Prüfreihenfolge](PRUEFREIHENFOLGE.md).

## Lokaler Betrieb getrennt verifiziert

Geprüfte Vor-/Nachsicherung, unabhängiger Restore/Start alt und neu, Datenvergleich während Aktivierung (1.954 Dateien/16 Tabellen unverändert), SQLite-Integrität/Fremdschlüssel, laufender Vertrag und ausgelieferte GUI-Skripte bestätigt. 70 eingefrorene Laufzeit-/Testquellen entsprechen dem geprüften Stand. Diese Aktivierungszahlen sind zeitgebundene Nachweise.

Nach MCP-Neustart wurde das neue Rückziehwerkzeug auf ausdrücklichen Auftrag real für fünf offene Vorschläge verwendet; anschließend fünf Gerätepositionen wiederherstellbar entfernt. Vorher-/Nachher-Vergleich dieser eigenen Doku-Handlung bestätigt erhaltene Freigaben und übrige Daten. Keine Sichtung oder Freigabe als Benutzer simuliert und keine echte Wiederherstellung dieser gewünschten Löschungen ausgeführt. Wiederherstellung und Konfliktfälle sind mit künstlichen Daten getestet.

„Es läuft schon flüssiger“ ist Benutzerfeedback, keine gemessene Leistungsverbesserung. Fachliche Abnahme, echte Einbauprüfung, physischer Drucktest und Online-Bereitstellung bleiben getrennt.

## Historische Nachweise und Prüfverfahren

Die folgenden datierten Abschnitte betreffen frühere Stände. Aktuelle Testzahlen stehen oben; ältere Prüfzahlen werden nicht addiert. Die allgemeinen Ausführungs- und Abnahmeverfahren bleiben darunter erhalten.

## MCP-Dateiquellen vom 21.11.2026

216 Anwendungstests und acht Sicherungstests bestanden. Sieben neue Quellenprüfungen für Browser-Container-Übergabe, lokale Dateien, öffentliche IPs, Redirect-/DNS-Bindung, Zugangsdatenweitergabe, Größen-/Zeit-/PDF-Grenzen, Symlinks und Cachekonflikte. Endgültiger isolierter Lauf mit eigenen temporären Ausgabeordnern, ohne Produktionsdaten. Syntax 129 JavaScript-Dateien/44 EJS-Vorlagen; erzeugter Vertrag und Diff geprüft.

Exakt gescheiterte reale Dateiübergabe im vorhandenen Test-Auftrag über neuen Host-MCP 2.3.0 erfolgreich wiederholt. Ein PDF bleibt `pending`; Konten, sämtliche Projektdokumente, Anforderungen und Sichtungsdaten unverändert nachgewiesen. Nach Neustart native 49 Werkzeuge und optionaler Dateipfad bestätigt, Vorschlag rein lesend verifiziert. Kein Docker-Update und keine Dateifreigabe. [Bericht](MCP_DATEIUEBERGABE.md).

## Einzellöschung und Wiederherstellung vom 21.11.2026

**209 Anwendungstests und acht Sicherungstests bestanden**, zusätzlich zwei Vertragswartungstests und fünf Mac-Speicherwartungstests. Syntaxprüfung: 127 JavaScript-Dateien/44 EJS-Vorlagen, Vertrags- und Diff-Prüfung bestanden. Sechs neue künstliche Integrationstests prüfen die tatsächlichen MCP-/API-Löschwege und Wiederherstellung einschließlich Freigabeherkunft, offener Vorschläge, Artikel-/Positions-/Dateikonflikten, Rechten, Wiederholungsschutz, Exportsperren und atomarer Rücknahme.

Vollsicherung getrennt wiederhergestellt und gestartet, lokal aktiviert. 1.143 Bestandsdateien und 16 geschützte Tabellen unverändert. Frischer MCP 2.2.0/49 Werkzeuge und laufende API 2.2.0/57 Operationen geprüft, 32 Quelldateien abgeglichen. Reale Projekte nur gelesen; keine echten Löschungen, Wiederherstellungen oder Freigaben. [Details und Grenzen](EINZELLOESCHUNG.md).

## Gesicherter Projektreset vom 21.11.2026

Endgültiges lokal aktiviertes Abbild: **203 Anwendungstests und acht Sicherungstests bestanden**, zusätzlich sieben Wartungsprüfungen. Syntaxprüfung: 122 JavaScript-Dateien und 44 EJS-Vorlagen; Vertragsprüfung und Diff-Prüfung bestanden. Neue künstliche HTTP-/MCP-Tests decken bestätigten Reset, Sicherungswiederherstellung, Rechte-/Versionsschutz, laufende Exporte, atomare Rücknahme, beschädigte Sicherung, sichere Wiederholung, parallele Bereinigung und gemeinsame Alt-Ausgaben ab. Echte Dateifreigaben ausschließlich in künstlichen Testdaten simuliert.

Vollsicherung des Originals getrennt wiederhergestellt und gestartet. Nur Beispielprojekt A danach ausdrücklich beauftragt über MCP zurückgesetzt; tatsächliche Abschlussprüfung 0 Dokumente, 0 Gerätezeilen, 0 Aufträge und 0 Exporte. Andere Projekte/Konten anhand von 13 Tabellen und Dateiprüfsummen unverändert. Laufender API-Vertrag 2.1.0 und 28 Quelldateien abgeglichen, frischer MCP 2.1.0 mit 43 Werkzeugen geprüft; Dateifreigabe weiterhin manuell. Einzelheiten, Sicherungspfade und Prüfgrenzen: [Projektreset](PROJEKT_RESET.md).

## Agentenvertrag 2.0 vom 21.11.2026

200 Node.js- und acht Python-Sicherungsprüfungen bestanden; zusätzlich sieben Wartungsprüfungen. Neue HTTP-/MCP-Tests decken kompakte Defaults, kleine Katalogseiten, Cursor, UTF-8-/Transportgrenzen, Textmodus, versionierte atomare Entscheidungen, Wiederholungsschutz, Fehler-Rollback, automatische Zurückstellung und dauerhafte Historie ab. Lokal gesichert aktiviert; 1.131 Dateien/neun geschützte Tabellen unverändert, 24 Laufzeitdateien und Vertrag abgeglichen. Frischer MCP vollständig mit 41 Werkzeugen; realer Standardplan 2.734 Bytes, Auftragsübersicht 631 Bytes, identischer Checkpoint `changed:false`. Keine Produktionsdatei freigegeben. [Details und Grenzen](AGENTENVERTRAG.md#aktivierungsnachweis).

## Projektbindung vom 21.11.2026

197 Node.js- und acht Python-Sicherungsprüfungen bestanden. Zusätzliche Fälle prüfen Sperren anderer Projekte bei direkten Links, alten Formularen, Status und Exportdateien. Mit zwei künstlichen Projekten im Browser geprüft: keine Projektwahl, nur aktueller Bestand, sichere Auftragsanlage und Kontextwechsel in anderem Fenster. Bei 375 Pixeln kein Überlauf. Sicherung getrennt wiederhergestellt und gestartet; 1.131 geschützte Dateien und neun Tabellen unverändert. [Details](GUI_ASSISTENT_ARBEITSPLATZ.md#anschlusskorrektur-ausschließlich-geöffnetes-projekt).

## Arbeitsplatzintegration vom 21.11.2026

196 Node.js-Prüfungen und acht Python-Sicherungsprüfungen im endgültigen Abbild bestanden, zusätzlich sieben Wartungsprüfungen. Browserprüfung mit künstlichen Daten bei 1366/375 Pixeln einschließlich echter PDF-Darstellung, gespeicherter Antworten, Zurückstellung/Wiederaufnahme und einzelner Testentscheidungen. Sicherung getrennt wiederhergestellt und gestartet; 1.131 Dateien und neun geschützte Tabellen unverändert. Laufender Vertrag und 26 bereitgestellte Quelldateien abgeglichen. [Details und Grenzen](GUI_ASSISTENT_ARBEITSPLATZ.md).

## Datenblatt-Tagesziel vom 20.11.2026

Das endgültige Abbild `edoku:datasheet-goal-20261120` besteht **194 Node.js- und acht Python-Sicherungsprüfungen, insgesamt 202**. Zusätzlich sieben Wartungsprüfungen, `docs:check`, Syntaxprüfung (112 JavaScript / 40 EJS) und `git diff --check`. Der neue Regressionstest prüft echten MCP-/API-Abgleich im Kompaktmodus, unveränderten Standard-Textmodus, Rechte/Fremdprojekte, ungültige Ansichten, erhaltene Versionen und Freigaberegeln sowie unterdrückte interne Entwürfe bei weiterhin offener Kundenpflicht.

Im künstlichen Browser: Suchdatum und Quellenlink sichtbar, bei 375 und 1366 Pixeln kein horizontaler Überlauf. Reale frische MCP-Aufrufe nach Aktivierung: Voll-/Kompaktplan gleicher Checkpoint, 60 Artikel erfasst, fünf Vorschläge ohne Freigabe. Gegenüber vor dem Update sind 1.126 Dateien und neun geschützte Tabellen unverändert. Die finale Sicherung wurde bei angehaltener Originalinstanz getrennt wiederhergestellt und gestartet. Alle 15 Seiten der lesbaren TRILUX-Anleitung sind zum erhaltenen Original pixelgleich. [Tagesprotokoll mit Messwerten und Prüfgrenzen](TAGESABSCHLUSS_2026-11-20.md).

## Dokumentations- und Speicherwartung vom 19.11.2026

Die neuen Wartungswerkzeuge bestanden **sieben Prüfungen**: zwei Node.js-Prüfungen für echten MCP-Lese-/Vollkatalog, erzeugte Referenz und erkannte Vertragsabweichungen; fünf macOS-Prüfungen für unabhängige APFS-Klone, Wiederherstellung, unveränderte Originale, geänderte Ziele, unzulässige Pfade/Ausgaben und ausgeschlossene fehlerhafte Sicherungen. Befehl: `npm run test:maintenance`. Auf Linux werden die fünf Mac-Prüfungen ausdrücklich übersprungen.

`npm run docs:check` besteht für 45 HTTP-Operationen und 37 Werkzeuge. Der erzeugte OpenAPI-Vertrag wurde zusätzlich exakt mit der laufenden lokalen API verglichen; 19 relevante Schnittstellenmodule sind gegenüber dem zuletzt aktivierten Abbild unverändert. Die neue Quellprüfung umfasst 112 JavaScript-Dateien und 40 EJS-Vorlagen. Lokale Dokumentationslinks und `git diff --check` wurden geprüft.

Reale Speicherpflege: 6.723 identische Dateien aus 30 verifizierten Sicherungen und Prüfnachweisen als unabhängige APFS-Klone erhalten; 1.115 aktive Dateien und neun geschützte Tabellen unverändert. Die kompaktierte Sicherung `bals-requirement-pre-20261119` wurde zusätzlich mit 1.633 Manifesteinträgen in ein getrenntes temporäres Verzeichnis wiederhergestellt und geprüft. Vorhandene abweichende SQLite-Arbeitsdatei eines älteren Sicherungsstands separat dokumentiert und nicht verändert. [Verfahren, Messwerte und Grenzen](SPEICHERPFLEGE.md).

Dies war keine neue App-Aktivierung und keine Wiederholung der nachfolgenden 201 App-Prüfungen. Die laufende App blieb unverändert gesund; die CI-Konfiguration wurde ergänzt, aber nicht veröffentlicht oder auf GitHub ausgeführt.

## Aktueller lokaler Prüfstand vom 19.11.2026

Im aktivierten Abbild `edoku:bals-requirement-20261119` bestanden **193 Node.js- und acht Python-Prüfungen, insgesamt 201, null Fehler**. Der vorherige Stand ohne Bestandsabdeckung bestand 191 Prüfungen. Tests laufen ausschließlich isoliert ohne Original-Laufzeitordner.

Beim letzten App-Abgleich prüfte `npm run check` 110 JavaScript-Dateien und 40 EJS-Vorlagen. 178 Programm-/Vorlagen-/Assetdateien wurden mit dem aktivierten Abbild verglichen. Die folgenden datierten Abschnitte beschreiben ältere Prüfstände, keine erneut ausgeführten heutigen Läufe.

- `requirement-corrections.test.js`: explizite Korrektur auf zwei reale Geräte, vollständige Zuordnung beider Instanzen, unveränderte Dateifrage/Freigabe und Geräte-/Anhangsdaten, GUI zeigt beide Positionen, Versionen/Rechte, Typreferenz-/Fremdartikelschutz, atomare Rückabwicklung und echter MCP-Aufruf.
- `datasheet-coverage.test.js`: alle aktiven Artikel ohne Einzelanforderungen, Instanzbündelung, passives Zubehör/Verbrauchsteile, Rechte/ETags, Nichtfunde, Wiederverwendung, Typ-/Variantenwechsel, Dateiintegrität, echter MCP/API-Abgleich und eng begrenzter Altkategorie-Fall mit negativem Herstellererklärungs-Test.
- `documentation-workflow.test.js`: Menüeinstieg mit mehreren eigenen Aufträgen, fremde Aufträge unsichtbar/nicht beschreibbar, direkte Antworten im richtigen Auftrag, Rückkehr zur Übersicht und unveränderte ungesichtete Dateien. Statusänderungen werden erkannt; Auftragsanlage bleibt erreichbar.
- `device-document-links.test.js`: Anleitung/Datenblatt getrennt, Kapitelverweise erhalten, Bemerkungen/Spannung/Leistung fehlen im Geräte-PDF. GUI zeigt keine Spannungs-/Leistungsspalten, führt bestehende Werte unsichtbar weiter.
- `export-counting.test.js`: auch mehrseitige Geräte- und Gesamt-PDFs ohne interne Bemerkungen oder entfallene Spalten; alte Geräte-PDF-Ausgabeversion 2 bis zur Neuerzeugung gesperrt, historische Bytes erhalten.
- Browser mit künstlichen Daten: Assistent bei 1366×900 und 375 Pixeln ohne horizontalen Seitenüberlauf, gesamte mobile Navigation sichtbar, Antworten, Suche/Filter, neue Aufträge, MCP-Direktlink und tatsächliches PDF-Rendering. Manuelle Einzelbestätigung führt zur nächsten unbestätigten Datei. Automatisierte Freigaben sind ausschließlich Testsimulationen.
- Geräte-Browserprüfung: andere Beschreibung speichern/neuladen erhält vorhandene Werte `230 V`/`125 W`; neue Zeilen ohne entfallene Spalten.
- Getrennte reale Projektkopie: sechs Gerätelisten, sieben PDF-Seiten textlich geprüft, erste Seite jeder Liste gerendert und visuell kontrolliert. Keine Änderung der Originalprojektdaten und kein fachlich abgenommener Gesamt-Kundenexport.
- Lokale Aktivierung: Vorsicherungen mit Abbild separat wiederhergestellt und Kopie gestartet. Acht geschützte Tabellen, Mounts, Ports und Benutzerkennung nach Update unverändert. Anwendung bereit; echte native MCP-Aufrufe nach Containerupdates erfolgreich.

Detailprotokolle bleiben privat unter `intern/device-columns-20261119/` und `intern/assistant-overview-20261119/`. Der heutige Dokumentationsabschluss prüft Links und Konsistenz; er wiederholt die Programmsuite nicht und schreibt deren Nachweise nicht einem neuen Dokumentationsstand zu. [Tagesabschluss](TAGESABSCHLUSS_2026-11-19.md).

## Vollständiger künstlicher Dokumentationsablauf am 18.11.2026

Im isolierten Abbild `edoku:goal-flow-test` bestanden **150 Node.js- und acht Python-Prüfungen, insgesamt 158**. Die API-/MCP-Prüfungen umfassen zusammen 40 Prüfungen einschließlich Gruppen. `npm run test:workflow` führt den neuen Gesamtfluss separat aus (13 Prüfungen). Nach der Gesamtsuite wurde zusätzlich der erfolgreiche zweite Erzeugungsversuch desselben Auftrags nach einem künstlichen Fehler geprüft; die 13 Ablaufprüfungen bestanden erneut.

Geprüft sind echte stdio-MCP-Aufrufe für Projektanlage/Auswahl/Geräte/Aufträge/Exporte, strukturierte Lücken, Pflichtquellen mit Geräte- und Revisionsbindung, GUI-Antworten, persistierte Wartezustände nach Neustart und abgelaufene Prozesssperren. Die Dateifreigabe erfolgt im Test durch eine **simulierte angemeldete Benutzeraktion** mit Vorschau, CSRF, Prüfsumme und Checkbox. API und MCP besitzen weiterhin keinen Freigabeweg. Eine abgelehnte Pflichtdatei blockiert die Ausgabe.

PDF-Seiten lassen sich mit PDF-Lib lesen; ZIP wird unabhängig mit Python `zipfile` auf Einträge/CRC geprüft und enthält die unveränderten freigegebenen PDF-Bytes. Die sieben Seiten der künstlichen Gesamtdokumentation, ZIP und JSON-Bericht liegen lokal unter `output/goal-flow-test/`. Alle Ausgabedateien werden mit Manifest-Prüfsummen verglichen; manipulierte Downloads werden abgewiesen. Projekt-/Quelldateiänderung, Abbruch, Rechteentzug und Erzeugungsfehler während des Laufs veröffentlichen keine Ausgabe. Erfolgreiche HTTP-Antworten der API-Prüfungen werden gegen die aus OpenAPI erzeugten Antwortschemas geprüft.

Zusätzlich im Browser geprüft: Rückfrage speichern, Geräte-/Revisionsbezug und gerenderte PDF-Vorschau, zwei weiterhin unentschiedene Dateivorschläge und Export-Wartestand bei Versuch 0. Bei 390 Pixeln beträgt die Dokumentbreite ebenfalls 390 Pixel; die PDF-Canvas ist 314 Pixel breit. Screenshots: `output/goal-demo/auftrag-mit-pflichtfreigabe.jpg`, `datei-sichtung-offen.jpg`, `datei-sichtung-mobil.jpg`. Der Demonstrationscontainer hat keine Datei übernommen. Original-Storage, Sicherungen und Original-Projektordner wurden nicht eingebunden.

Das ist eine technische Abnahme mit künstlichen Quellen. Reale Herstellerrecherche, fachliche Freigabe, Einrichtung im tatsächlichen Agentenclient und Veröffentlichung bleiben gesondert offen. [Abnahmeprotokoll](ASSISTENT_GOAL_ABNAHME.md).


## Doku-Assistent und Pflichtfreigabe am 18.11.2026

Im isolierten Abbild `edoku:assistant-review-test-20261118` bestanden **137 Node.js- und acht Python-Prüfungen, insgesamt 145**. Die API-/MCP-Gruppe umfasst jetzt 27 Prüfungen einschließlich ihrer Gruppen. Zusätzliche Fälle prüfen Rückfragen und Benutzerantworten, unveränderten Projektbestand bei Dateivorschlägen, Dateideduplizierung, fehlende API-Freigabepfade, notwendige GUI-Sitzung/CSRF/Sichtung/Prüfsumme, manipulierte Dateien, veraltete Projektversionen, Zielprojektbindung, doppelte Entscheidungen, Freigabe-Rollback und den freigegebenen lokalen MCP-Dateiordner.

Im Browser mit künstlichen Daten geprüft: Auftrag anlegen, Rückfrage beantworten, PDF tatsächlich darstellen, einzelne Datei übernehmen, andere Datei ablehnen und Status getrennt anzeigen. Bei 390 Pixeln war die PDF gerendert, ohne horizontalen Seitenüberlauf. Screenshots unter `output/assistant-review/`. Ein echter recherchierender Agent oder eine laufende Benutzerinstanz wurde nicht angebunden. [Ablauf und Grenzen](DOKU_ASSISTENT.md).

## Integrations-API und MCP am 18.11.2026

Im isolierten Node-22-Docker-Abbild `edoku:api-mcp-test-20261118` bestanden **127 Node.js- und acht Python-Prüfungen, insgesamt 135**. Das Abbild wurde mit neutralen Startdaten gebaut; Original-Laufzeitordner waren nicht eingebunden. Die Quellprüfung bestand für den ersten API-Stand zusätzlich für 80 JavaScript-Dateien und 31 EJS-Vorlagen; mit dem anschließenden GUI-Ausbau sind es 82 JavaScript-Dateien und weiterhin 31 Vorlagen.

Die neue Gruppe `npm run test:api` umfasst 17 Prüfungen einschließlich ihrer Testgruppe. Sie startet den echten HTTP-Server und getrennte MCP-Prozesse: Rechte, Projektbeschränkungen, Passwortwechsel, Sperren, Schlüsselablauf/-widerruf, If-Match, parallele Änderungen, Erhalt unbekannter Felder, SQLite-Geräteprojektion, Paginierung, JSON-Fehler, CSRF-geschützte Schlüsselverwaltung, MCP-Protokollaushandlung, Lese-/Schreibwerkzeuge und Sicherheitsprotokoll.

Der anschließende GUI-Ausbau integriert API & MCP als echten Einstellungsreiter. Erweiterte HTTP-Prüfungen kontrollieren sofort wirksame API-/Schreibsperren, Gültigkeitsgrenzen, persistierte Vorgaben und die Trennung von normalen Benutzern und Systemadmins. Im Browser geprüft: Tab/Direktlink, Desktopdarstellung, Umbruch bei 390 Pixeln ohne horizontalen Seitenüberlauf, Konfigurationserstellung mit künstlichem Schlüssel, optionale Schreibwerkzeuge, HTTPS-Prüfung und Leeren der Ausgabe. Ein Screenshot liegt lokal unter `output/api-gui-review/einstellungen-api-mcp.jpg`.

Das belegt die technische Integration im künstlichen Prüfaufbau. Eine Einrichtung in einem echten MCP-Benutzerclient und eine Bereitstellung in der laufenden lokalen oder Online-Instanz sind damit nicht erfolgt. Umfang und weitere Schritte: [API und MCP](API.md).

## Oberfläche und Navigation vom 18.11.2026

Die lokal aktivierte Einstellungsleiste und der Theme-Fix bestanden die vollständige Suite mit **118 Prüfungen**. Der GitHub-Programmcommit `2993893` bestand den eigenen [GitHub-Prüflauf](https://github.com/loserat/edoku/actions/runs/44359775011). Die tatsächlich online geprüften Schritte stehen im [Online-Prüfstand](ONLINE_PRUEFSTAND.md#update-und-prüfung-vom-18112026).

Die anschließende Docker-Vorschau wurde im Browser mit künstlichem Bestand geprüft. Dazu gehörten die Projektanlage per Enter, das Website-Logo in Hell und Dunkel, der Klick auf den Link, die Einstellungs-Direktlinks, der Rückweg vom Protokoll sowie der Umbruch bei 390 Pixeln. Ein Lesekonto erhielt für das Sicherheitsprotokoll HTTP 403. Quell- und Vorlagenprüfung und die vier vorhandenen Theme-Tests ergänzen diese Prüfung. [Prüfschritte und Ergebnisse](TAGESABSCHLUSS_2026-11-18.md#änderungen-in-der-docker-vorschau)

## Sicherheitsnachprüfung am 17.11.2026

118 Prüfungen bestanden im isolierten Node-22-Docker-Abbild ohne Einbindung der Originaldaten. Acht bestehende Projektkopien wurden gegen das vorherige Abbild verglichen: 80 Vergleiche, 249 tatsächliche PDF-Seiten unverändert, acht erfolgreiche Paket-Rückimporte. Browserprüfung auf einer Kopie: Anmeldung, Speichern/Wiederladen, Geräteliste, PDF-Vorschau und Export; erwartete fehlende Quelldateien bleiben als Warnung sichtbar. Das ist technische Prüfung, keine fachliche Freigabe. [Einzelheiten](SICHERHEITSUPDATE_2026-11-17.md).

Stand: 17.11.2026. Der geprüfte Stand verwendet Node.js 22 und Python 3.11 oder neuer. Die vollständige Suite besteht aus **118 Prüfungen: 110 Node.js und acht Python**. Die aktuelle GitHub-Prüfung des übernommenen Programmstands ist unten mit konkretem Commit und Lauf verlinkt; ältere datierte Abschnitte behalten ihre damalige Aussage.

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

## Historischer Prüfumfang vom 17.11.2026

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
| `npm run test:hardening` | 9 | Sichere JSON-Ausgabe, Produktionsstart, CSP, Routenvarianten, Anfragelimits, Arbeitssperren, Speicherbudget und Protokollrotation |
| **Gesamt** | **118** | `npm test` führt alle aufgeführten Testgruppen aus |

`npm run check` prüft zusätzlich JavaScript-Syntax und EJS-Kompilierung; es ist nicht in der Zahl 118 enthalten. Die Workflow-Konfiguration in `.github/workflows/` führt Quellprüfung und Tests bei Push/PR aus. Ob der aktuelle Arbeitsstand veröffentlicht wurde und der zugehörige CI-Lauf bestanden hat, muss am konkreten Commit geprüft werden.

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


## Strukturierter Agentenablauf vom 19.11.2026

Im isolierten Abbild `edoku:agent-workflow-20261119` bestanden 172 Node.js- und acht Python-Prüfungen. `scripts/agent-workflow.test.js` prüft echte MCP-Aufrufe, Quellenbelege, Erhalt älterer Zusatzfelder und Dateiverweise, zielbezogene/deduplizierte Chatfragen, tatsächliche Feldspeicherung nach Antworten, Strukturlücken, Neustart und verweigerte Freigabewege. Die gemeinsame Ablauflogik versorgt auch die kompakte GUI. Browserprüfung bei 1440×900 und 390 Pixeln ohne horizontalen Überlauf; Einzelentscheidung öffnet die nächste Datei unbestätigt. Lokaler Aktivierungs- und Bestandsschutznachweis: `intern/agent-workflow-20261119/ABNAHME.md`. Ablauf und technische Grenzen: [AGENTENABLAUF.md](AGENTENABLAUF.md).


## Interne Anforderungen vom 19.11.2026

Die getrennte Ablage bestand 180 Node.js- und acht Python-Prüfungen. Acht neue Prüfungen in `scripts/requirement-scope.test.js` decken belegte und versionierte Ablageentscheidungen, Originalschutz, unveränderte Pflichtkataloge, GUI-Ablagekennzeichnung, gesperrte alte Kundenfassungen, manuelle interne Freigabe, beschädigte interne Quellen und die Rückkehr zur Kundenpflicht ab. Die reale interne Arbeits-PDF wurde in beiden Seiten gerendert und visuell geprüft; sie bleibt ein unbestätigter Dateivorschlag. Aktivierungsbelege: `intern/internal-scope-20261119/`.

## Hersteller-PDF-Prüfung 21.11.2026 (API/MCP 3.0)

Endgültiges Abbild: **226 Anwendungstests, acht Sicherungstests, zwei Vertragsprüfungen bestanden**. Zehn neue Prüfungen in `scripts/product-document-verification.test.js`: exakte Artikel statt Teiltreffer, Varianten einschließlich Dezimalstellen und Nachbartabellen, Quellenbindung, tatsächliche PDF.js-Extraktion, passender Vorschlag und zwingende manuelle Sichtung, unlesbare/falsche/gefälschte Unterlagen, generische Anleitung nur über konkrete Herstellerverknüpfung, echte MCP-Aufrufe ohne lokalen Dateipfad, Cache-/Variantenbindung, belegte Aliasse und gemeinsame Gerätebezüge sowie spätere Kategorieänderung. Alte Tests isolieren die neue Abhängigkeit ausdrücklich; kein Produktions-Schalter zur Umgehung. Sichere Downloads zusätzlich durch die vorhandenen sieben Quellenprüfungen abgesichert.

Laufender HTTP-Vertrag entspricht exakt dem erzeugten Stand. Vollsicherung getrennt wiederhergestellt und gestartet; 1.150 Dateien/16 Tabellen nach Aktivierung unverändert. Neuer Host-MCP 3.0 bestätigt das vorhandene BALS-11962-PDF im Modus `check`; keine neue reale Datei oder Freigabe. Nach vollständigem Neustart auch die native Verbindung dieses Chats geprüft: 49 Werkzeuge, neues Schema, kompakter Plan und BALS-Prüfung mit Cachetreffer; keine neue Datei, sieben geschützte Tabellen unverändert. [Bericht](PRODUKTPRUEFUNG.md), private Protokolle `intern/product-verification-20261121/`.

## ESYLUX-/Gira-Korrektur 21.11.2026 (API/MCP 3.0.1)

**229 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen im endgültigen Abbild bestanden.** Drei neue Regressionen für reale Spalten-/Tabellenlayouts, gruppierte Kennungen und Herstellerbeleg über gebundene Artikel-/GTIN-Paarung einschließlich negativer GTIN-, Varianten- und Nachbarartikelproben. Zwei echte Hersteller-PDFs zunächst getrennt geprüft, nach verifizierter Sicherung/Wiederherstellung lokal aktiviert und über die bestehende MCP-Verbindung als `pending` vorgeschlagen. Bisherige 1.154 Dateien und vorhandene Daten/Entscheidungen unverändert; keine Sichtung oder Freigabe. [Details](PRODUKTPRUEFUNG_KORREKTUR.md), private Nachweise `intern/product-check-fix-20261121/`.


## 21.11.2026 – Freigabe ohne vollständiges Neuladen

237 Anwendungstests und acht Sicherungsprüfungen im endgültigen Abbild bestanden; zwei Vertragsprüfungen und fünf Mac-spezifische Wartungsprüfungen zusätzlich erfolgreich. 138 JavaScript-Dateien/46 EJS-Vorlagen syntaktisch geprüft. Neue Regressionen für schlanke Einzelansicht, JSON-Entscheidung, eigene Sichtung, Wiederholungs-/Versionsschutz, Folgeformular, Auftragsende und Arbeitsflächenfragmente. Künstliche Browserprüfung mit zwei Aufträgen, PDF-Darstellung nach Wechsel und manueller Einzelbestätigung; 375 Pixel ohne horizontalen Überlauf. Vollsicherung separat wiederhergestellt/gestartet; 1.329 Bestandsdateien und 16 Tabellen bei Aktivierung unverändert. [Detaillierter Nachweis und Grenzen](GUI_FREIGABEABLAUF.md).


## 21.11.2026 – Mehrfach-Systemauswahl, API/MCP 3.1.0

244 Anwendungstests und acht Sicherungstests im endgültigen Abbild bestanden; zusätzlich sieben Wartungsprüfungen. Neue Tests prüfen echte MCP-Aufrufe, Bestand ohne Migration, zwei Hersteller und mehrere Systeme, gezielte Kennungen, deaktivierte/reversible Auswahl, Duplikate, veraltete Versionen, fehlende Rechte, CSRF, atomaren Teilfehler und zusätzliche Gerätefelder. Katalog mit 182 synthetischen Herstellern paginiert, künstliche GUI einschließlich sichtbarem Menüaufruf sowie 375 Pixel ohne Überlauf geprüft. [Detaillierter Betriebsnachweis](MEHRFACH_SYSTEMAUSWAHL.md).


## 21.11.2026 – Gemeinsames GUI-/PDF-Fußlogo

245 Anwendungstests und acht Sicherungstests bestanden. Neue Regression prüft eingebettete RGB-/Transparenzdaten gegen die aus der GUI-SVG abgeleitete PNG, mehrseitige Einzel-/Gesamt-PDFs, Website-Link und Branding-Deaktivierung. Vierseitiger künstlicher Export vollständig visuell geprüft. 144 JavaScript-Dateien/47 EJS-Vorlagen sowie Asset-Prüfsummen geprüft. [Details](PDF_BRANDING.md).
