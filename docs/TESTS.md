# Tests

Automatisierte Prüfungen verwenden künstliche Projekte oder getrennte Kopien. Keine aktive Datenbank oder echte Uploadordner an Testcontainer binden. Technische Tests ersetzen keine fachliche Anlagenfreigabe, Druckabnahme oder Prüfung der tatsächlichen Installation.

## Standardprüfungen

```bash
npm ci
npm run check
npm run docs:check
npm run test:maintenance
npm test
```

Node.js 22, Python 3 und die Paketabhängigkeiten werden benötigt. Native Datenbankabhängigkeiten müssen zur Plattform passen. Für Docker dieselbe bereinigte Quellversion verwenden; keine fremden Betriebssystem-Binärdateien als `node_modules` einbinden. Mac-/APFS-Wartungstests werden auf anderen Plattformen ausdrücklich übersprungen; daraus folgt kein nativer Mac-Prüfnachweis.

## Abdeckung

`npm test` prüft unter anderem API/MCP und Rechte, Projektgrenzen, Material-/Aufgabensteuerung, Artikel-/PDF-Prüfung, manuelle Dateientscheidungen, Löschung/Wiederherstellung, Export, Anmeldung, SQLite und Bestandsschutz. Die Sicherungsprüfungen laufen anschließend mit. `test:maintenance` prüft Vertragsgenerierung und Wartungswerkzeuge.

Die Versionsanzeige wird gegen Paketversion, tatsächliche OpenAPI-Antwort und echten MCP-Handshake verglichen. Dateiprüfung umfasst gesperrte Freigabe ohne Sichtung, einzelne Entscheidung und nächste Datei mit erneut leerer Sichtungsbestätigung. Bereits entschiedene Dateien und andere Projekte müssen erhalten bleiben.

## Oberfläche und Bereitstellung

Suche, Filter, Dialoge, Tastaturbedienung und schmale Ansichten im Browser prüfen. Für erforderliche Fensterbreiten `document.documentElement.scrollWidth <= innerWidth` nachweisen. Lange Versions-/Artikelnamen nicht abschneiden. Nach Softwareupdates tatsächlich laufende Version und ausgelieferte Dateien prüfen; ein bestandener Quelltest belegt keinen Rollout.

Sicherung getrennt wiederherstellen und mit passendem Abbild starten, bevor eine bestehende Installation gewechselt wird. Integrität, Fremdschlüssel, Projekt-/Dateibestand und Entscheidungen vor/nach vergleichen. Keine künstliche Sichtung oder Freigabe als realer Benutzer ausführen. [Betrieb](BETA_BETRIEB.md), [Update](UPDATE.md).

[GitHub-Prüflauf für main](https://github.com/loserat/edoku/actions/workflows/local-beta.yml). Lokale Tests, GitHub-Prüfung und tatsächliche Online-/Fachabnahme sind getrennte Aussagen. Persönliche Testlogs und Betriebsnachweise gehören nicht in die öffentliche Dokumentation.
