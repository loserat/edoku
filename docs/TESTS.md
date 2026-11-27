# Tests

Automatisierte Prüfungen verwenden künstliche Projekte oder getrennte Kopien. Keine aktive Datenbank oder echte Uploadordner an Testcontainer binden. Technische Tests ersetzen keine fachliche Anlagenfreigabe, Druckabnahme oder Prüfung der tatsächlichen Installation.


## Remote-MCP ab 0.3.3-beta.1

`npm run test:remote-mcp` prüft mit künstlichen Konten den echten HTTP-Transport: Default aus, HTTPS-/Proxy-/Host-/Origin-Prüfung, reine Bearer-Anmeldung, ungültige und abgelaufene/widerrufene Schlüssel, Rollenwechsel, beide SDK-Protokollwege, 22/58 Werkzeuge, Rechte-/Projektgrenzen, ETags, lokale Dateipfadsperre, Bodylimit und verbotene Batches. Lang laufende und abgebrochene Aufrufe bleiben bis Arbeitsende begrenzt. GUI-Tests prüfen Adminschalter und erhaltene Schlüssel; bestehende API-/Assistententests sichern weiterhin die manuelle Einzelprüfung.

HTTPS-Terminierung wird im Integrationstest durch einen vertrauten Testproxy nachgebildet. Das ersetzt keine Zertifikats-/Proxy-/Verbindungsprüfung auf dem Ziel-VPS. Browserprüfung der Remote-Konfiguration und tatsächlicher Online-Rollout werden getrennt nachgewiesen.

## Nachweis zur Versionsanhebung 0.3.1

Die Versionsanhebung ändert Paket-/Lock-Version und Dokumentation, keine Fachlogik oder Abhängigkeiten. Der identische beta.10-Funktionsstand wurde mit 365 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen geprüft. Für 0.3.1 Paketkonsistenz, unveränderte Fachdateien, Syntax, `docs:check` und gezielte Vertrags-/Startprüfungen nachweisen. Eine erneute fachliche oder Browserabnahme wird daraus nicht abgeleitet.

## Standardprüfungen

`scripts/obo-plm-dimensions.test.js` prüft OBO-PLM-Maßtabellen, Artikel-/Quellenbindung, fehlende Einheiten, abweichende Achsen/Werte, fremde oder widersprüchliche Seiten, technische statt erfundener Datenfragen, gezielte V9-Wiederaufnahme und echte API-/MCP-Aufrufe mit erhaltenen Bestandsfreigaben. Optional kann ein privat bereitgestelltes Original-PDF über `EDOKU_OBO_TEST_PDF` gegen seine bekannte Prüfsumme erneut geprüft werden; es gehört nicht zum öffentlichen Repository oder Docker-Abbild.


`scripts/firestop-documentation.test.js` prüft automatische herstellerunabhängige Anforderungen im echten API-/MCP-Weg sowie die GUI-Arbeitsliste, schreibfreie Abrufe bestehender Aufträge, Systemwechsel und Deaktivierung, erhaltene Bestandsfreigaben, Kennungskonflikte mit atomarem Rollback sowie getrennte Kanal-/Funktionserhalt-Fakten statt unpassender Schottmaße. Bestätigte, unbekannte und veraltete Einbaufakten werden getrennt behandelt.


`scripts/zz330-verification-v9.test.js` prüft Handelsname und Produktüberschrift mit Leerzeichen/Markenzeichen, ähnliche Nummern und falsche Produkte, widersprüchliche Namen, Hersteller-/Quellenbindung, Sicherheitsdatenblatt-Abgrenzung, Varianten-/Systemschutz und gezielte Wiederaufnahme alter ZZ330-Sperren. Der echte API-/MCP-Test erzeugt ausschließlich einen offenen Vorschlag im künstlichen Projekt; bestehende Freigabe und Sichtung bleiben erhalten, Systempflichten weiterhin offen.

`scripts/firestop-capture.test.js` prüft den tatsächlichen HTTP-/MCP-Weg für Schottanlage, gezieltes Lesen und Ergänzen: Benutzer-/Projektgrenzen, Rechte, Belegpflicht, Versionskonflikte, konkurrierende Änderungen, Wiederholungsschlüssel, atomare Fehler, erhaltene Foto-/Bestandsfelder und unveränderte bestehende Dateifreigaben. Schema und GUI-Rundlauf prüfen strukturierte Millimeterwerte und unbekannte Angaben. Alle Einbaudaten und Dateien dieser Tests sind künstlich.

```bash
npm ci
npm run check
npm run docs:check
npm run test:maintenance
npm test
```

Node.js 22, Python 3 und die Paketabhängigkeiten werden benötigt. Native Datenbankabhängigkeiten müssen zur Plattform passen. Für Docker dieselbe bereinigte Quellversion verwenden; keine fremden Betriebssystem-Binärdateien als `node_modules` einbinden. Mac-/APFS-Wartungstests werden auf anderen Plattformen ausdrücklich übersprungen; daraus folgt kein nativer Mac-Prüfnachweis.

## Abdeckung

`publisher-verification-v8.test.js` prüft veröffentlichte unquoted HTML-Links und Täuschungsfälle, begrenzte HTML-Projektion, den konkreten PDF.js-Wrapper einschließlich fremder Ziele, Rittal-Schreibweisen, Herstellergrenzen, gezielte Wiederaufnahme und korrekte Fehlerzuständigkeit. Hinzu kommen manueller Verbrauchsmaterial-Ausschluss ohne Datenlöschung sowie der getrennte Vorschlag nach Zurückziehen mit unverändertem Original und neuer Sichtungspflicht. Die explizite Speicherumstellung wird auf künstlichen Daten samt Fremdschlüsseln geprüft.

`npm test` prüft unter anderem API/MCP und Rechte, Projektgrenzen, Material-/Aufgabensteuerung, Artikel-/PDF-Prüfung, manuelle Dateientscheidungen, Löschung/Wiederherstellung, Export, Anmeldung, SQLite und Bestandsschutz. Die Sicherungsprüfungen laufen anschließend mit. `test:maintenance` prüft Vertragsgenerierung und Wartungswerkzeuge.

Die Versionsanzeige wird gegen Paketversion, tatsächliche OpenAPI-Antwort und echten MCP-Handshake verglichen. Dateiprüfung umfasst gesperrte Freigabe ohne Sichtung, einzelne Entscheidung und nächste Datei mit erneut leerer Sichtungsbestätigung. Bereits entschiedene Dateien und andere Projekte müssen erhalten bleiben.

## Oberfläche und Bereitstellung

Suche, Filter, Dialoge, Tastaturbedienung und schmale Ansichten im Browser prüfen. Für erforderliche Fensterbreiten `document.documentElement.scrollWidth <= innerWidth` nachweisen. Lange Versions-/Artikelnamen nicht abschneiden. Nach Softwareupdates tatsächlich laufende Version und ausgelieferte Dateien prüfen; ein bestandener Quelltest belegt keinen Rollout.

Sicherung getrennt wiederherstellen und mit passendem Abbild starten, bevor eine bestehende Installation gewechselt wird. Integrität, Fremdschlüssel, Projekt-/Dateibestand und Entscheidungen vor/nach vergleichen. Keine künstliche Sichtung oder Freigabe als realer Benutzer ausführen. [Betrieb](BETA_BETRIEB.md), [Update](UPDATE.md).

[GitHub-Prüflauf für main](https://github.com/loserat/edoku/actions/workflows/local-beta.yml). Lokale Tests, GitHub-Prüfung und tatsächliche Online-/Fachabnahme sind getrennte Aussagen. Persönliche Testlogs und Betriebsnachweise gehören nicht in die öffentliche Dokumentation.

## Stabile Gerätebezüge und Folgeaufgaben

`stable-device-workflow.test.js` prüft Speichern mit Positionslücken, Sortierung/Löschung, Nummernreserve und Vorlagen, eindeutige Reparaturvorschau, Mehrdeutigkeit, Versionskonflikte, veränderte PDF-Bytes, unveränderte Originalfreigaben und Reparaturprotokoll. API und echter MCP-Transport werden mit künstlichen Projekten geprüft. Dazu gehören gezielte Artikel-/Positionsfilter, Ursachen/Wiederaufnahmebedingungen und optionale kompakte Folgeantworten einschließlich Rechtebegrenzung. Reale Projektdateien werden dabei weder gesichtet noch freigegeben.

Auf macOS und Linux getrennt passende native Abhängigkeiten verwenden. Ein zu kleiner temporärer Testbereich kann die reguläre Speicherreserve auslösen (HTTP 507); die Produktionsgrenze hierfür nicht herabsetzen. Linux-Läufe ersetzen keine Mac-/APFS-Prüfungen.

## Materialausnahmen und alte Doppelbezüge

`material-scope-duplicates.test.js` prüft alle drei manuellen Materialabschlüsse über API und echten MCP-Transport: gespeicherte Belege, Zeilenziele, zusätzliche Leserechte, Versionskonflikte, atomare Fehlerfälle, zurückgestellte Antworten, aktive Geräte und unveränderte Wiederholungen. Wiederaufnahme und neuere Antworten dürfen alte Entscheidungen nicht still überschreiben. Quellzeilen, Geräte, Dateistatus und historische Wartezustände bleiben erhalten; erledigte Materialfragen werden aus aktuellen Sperren entfernt.

Die Referenzprüfung umfasst gültige Anker, alte/aktuelle Doppelbezüge, mehrere reale Instanzen, Variantenkonflikte und mehrere alte Ursprünge mit demselben Ziel. Gemischte Reparatur-/Entfernungsaktionen werden ohne verschobene Indizes angewendet. Originalbytes, ursprüngliche Freigabe und vollständiges Vorher-/Nachher-Protokoll werden verglichen; manipulierte Bytes und veraltete Vorschauen werden abgewiesen. Batchgrenzen bleiben wirksam. Keine tatsächlichen Benutzerfreigaben werden dabei simuliert.
