# Versionen und Veröffentlichungsstand

Stand 25.11.2026. edoku verwendet getrennte Versionskennungen, weil Anwendung, Schnittstelle und Datenmodell unterschiedliche Aufgaben haben.

| Bereich | Kennung | Führende Stelle |
| --- | --- | --- |
| Anwendung / Quellpaket | `0.3.0-beta.1` | `package.json`; dieselbe Version in den beiden Wurzeleinträgen von `package-lock.json` |
| HTTP-API | `3.9.0` | `src/api/openapi.js`, `info.version` |
| MCP-Server | `3.9.0` | `services/mcpServerService.js` |
| Schnittstellenumfang | 64 HTTP-Operationen, 55 Werkzeuge (22 Lesen, 33 Schreiben) | erzeugtes `docs/api/manifest.json` |
| Agentenvertrag | `2.1` | kompakte Pläne, Belege, Versionsschutz und begrenzte Antworten |
| Fachregeln | `material_dependencies_v1`, `autonomous_workflow_v1`, `evidence_dependencies_v1`, `firestop_documents_v1`, `fire_protection_workflow_v1`, `manufacturer_link_discovery_v1`, `manufacturer_pdf_article_variant_v7`, `documentation_material_exclusions_v1` | gemeinsame Fachservices; unabhängig von der App-Nummer |

Die OpenAPI-Spezifikationskennung `openapi: 3.1.0` bezeichnet das Format der Vertragsdatei und bleibt unverändert. Sie ist nicht die edoku-API-Version. Datenbankspeicher- und Sicherungsformatversionen werden ebenfalls nicht durch einen App-Versionswechsel erhöht.

## Aktuelle Erweiterung 0.3.0-beta.1

Bündelt den API-/MCP- und Doku-Assistenten-Ausbau für den nächsten öffentlichen Quellstand. App-Version 0.3.0-beta.1, API/MCP unverändert 3.9.0; keine Versionsanhebung der Schnittstelle ohne Vertragsänderung. Lokaler Betrieb beta.13 und tatsächliches Online-Deployment bleiben eigenständige Nachweise. Neue Dateien weiterhin nur manuell einzeln freigeben.

## Historische Erweiterung 0.2.0-beta.13

[Vereinfachter Doku-Assistent](GUI_ASSISTENT_VEREINFACHUNG.md), App-Paket beta.13; API/MCP unverändert 3.9.0. Keine Schemaänderung oder Abhängigkeitsaktualisierung. Seit 25.11.2026 nach geprüfter Vor-/Nachsicherung und getrennter Wiederherstellungs-/Startprobe alt/neu lokal aktiv. 2.000 geschützte Dateien/16 fachliche Tabellen unverändert, GUI und MCP lesend bestätigt; keine Veröffentlichung. [Betriebsnachweis](AKTUELLER_STAND.md).

## Historische Erweiterung 0.2.0-beta.12

[Geradlinige PDF-Prüfreihenfolge](PRUEFREIHENFOLGE.md) und begründetes Zurückziehen. API/MCP 3.9.0 mit 55 Werkzeugen. Seit 24.11.2026 nach ausdrücklicher Freigabe, frischer Vollsicherung, getrennter Wiederherstellungs-/Startprobe und Nachsicherung lokal aktiviert; 1.954 geschützte Dateien/16 Tabellen unverändert. [Betriebsnachweis](AKTUELLER_STAND.md).

## Historische Erweiterung 0.2.0-beta.11

[Dateivorschläge begründet zurückziehen](DATEIVORSCHLAEGE_ZURUECKZIEHEN.md): additive API/MCP-Operation, belegter Verlauf und GUI-Wechsel; keine Migration oder automatische Dateientscheidung. Als Einzelversion nicht separat aktiviert; seit der gesicherten lokalen Aktivierung von beta.12 enthalten und verfügbar.

## Historische Erweiterung 0.2.0-beta.10

Herstellerquellen-/Markenzuordnung, veröffentlichte Downloads ohne Dateiendung, Familienartikelbindung, exakte Variantenprüfung und optionale Katalogmaße. [Regeln](ME01_QUELLEN_UND_MASSE.md). Am 24.11.2026 nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Bestand und Dateientscheidungen unverändert; keine Veröffentlichung.

## Historische Erweiterung 0.2.0-beta.9

Am 23.11.2026 nach ausdrücklicher Freigabe mit frischer Sicherung und getrennter Wiederherstellungs-/Startprobe alt/neu lokal aktiviert; laufende App/API und MCP 3.8.1 lesend bestätigt. 1.557 geschützte Dateien/16 Tabellen unverändert, Nachsicherung geprüft.

Gezielte Passungsprüfung für RAW-Innen-/Gesamtbreite und OBO-Artikel 6277290, beständige Blocker und explizite Mustererkennung. [Regeln und Tests](PRUEFLUECKEN_ME01.md). Quellstand und lokale Aktivierung getrennt führen.

## Historische Erweiterung 0.2.0-beta.8

Am 23.11.2026 nach ausdrücklicher Benutzerfreigabe gesichert lokal aktiviert; App/API/MCP und neue Werkzeuge lesend bestätigt. [Betriebsnachweis](AKTUELLER_STAND.md).

Zentrale Material-/Aufgabensteuerung, zwei gezielte Materialimport-Werkzeuge und atomare Fragepakete. [Ablauf](ZENTRALE_AUFGABENSTEUERUNG.md).

## Historische Erweiterung 0.2.0-beta.7

Projektbezogene Materialregeln für Import, Recherche und erzeugte Gerätelisten; Altbestände und manuelle Dateientscheidungen erhalten. Kein neues Werkzeug; optionaler Umfang im bestehenden Workflow-Aufruf. [Fachregel und Aktivierungsstand](MATERIALAUSSCHLUESSE.md).

## Historische Erweiterung 0.2.0-beta.6

Leere normale Projektanlage in GUI/API/MCP, neue Listen ohne Platzhalterposition. Keine Änderungen bestehender Projekte oder Importdaten. [Fachregel und Aktivierungsstand](LEERE_PROJEKTANLAGE.md). Solange der Materialimport läuft, bleibt lokal die vorherige Version aktiv.

## Historische Erweiterung 0.2.0-beta.5

API/MCP 3.6.0: ein zusätzlicher lesender Hersteller-Linkweg, unveränderte Freigaberechte; Produktprüfung v5 mit gezielter NIEDAX-KTUM-Maßzuordnung. Keine Datenmigration. [Ablauf](KOMPAKTE_HERSTELLER_LINKS.md).

## Historische Erweiterung 0.2.0-beta.4

API/MCP 3.5.0 ergänzt eine lesende Brandschutz-Recherchehilfe, weitere Faktenkeys und optionalen Erklärungsstatus. Keine Datenmigration oder neuen Berechtigungsarten. [Ablauf, Quellen und Grenzen](BRANDSCHUTZ_AGENTENABLAUF.md).

## Historische Erweiterung 0.2.0-beta.3

API/MCP 3.4.0 ergänzt vorhandene Lesewege um kompakte Statusübersicht, Abschnittsseiten und direkte Anforderungs-/Warteziele. Bestehende HTTP-Defaults bleiben kompatibel; MCP liefert die neuen kompakten Defaults. Keine neuen Werkzeuge, Rechte oder Datenmigrationen. [Vertrag und Nachweis](KOMPAKTE_STATUSABFRAGEN.md).

## Korrektur 0.2.0-beta.2 (historisch)

Die Brandschutz-PDF-Korrektur erhöht die Beta-Patchfolge; API/MCP `3.3.1` beschreibt die korrigierte Zuordnung und Herstellerprüfung bei unverändertem Umfang. Keine Datenmigration und keine neuen Abhängigkeiten. [Nachweis](BRANDSCHUTZ_PDF_VERKNUEPFUNG.md).

## Warum 0.2.0-beta.1?

Seit `0.1.0-beta.1` kamen zusammenhängende neue Funktionen für API/MCP, Doku-Assistent, Artikelprüfung, gezielte Rückfragen und geschützte Dateiarbeit hinzu. Deshalb wird die App-Nebenversion erhöht. Der Beta-Zusatz bleibt bestehen: fachliche Abnahme und die dokumentierten Produktlücken sind damit nicht erledigt. API/MCP bleiben bei `3.3.0`, weil dieses Dokumentations-/Versionspaket deren Vertrag nicht verändert. Abhängigkeiten und Datenmodell bleiben unverändert.

## Verbindliche Pflege

- Aktuelle App-Version in Paketdateien, README, Dokumentationsübersicht, aktuellem Stand und aktuellen Release Notes gemeinsam pflegen. Die GUI liest die App-Version aus `package.json`; `/ready` zeigt die tatsächlich laufende Version.
- Fachliche Änderungen im Changelog und der passenden Anleitung beschreiben. Aktuelle Grenzen gehören in `OFFENE_PUNKTE.md`; erledigte Punkte nicht weiter als aktuelle Aufgaben führen.
- API-/MCP-Änderungen aus dem Quellvertrag erzeugen: `npm run docs:api`, Diff prüfen, `npm run docs:check`. Die App-Version allein ändert weder Werkzeuganzahl noch Zugriffsrechte.
- Datierte historische Nachweise behalten ihre damaligen Versions- und Testzahlen. Keine pauschale Textersetzung über alle Dokumente.
- Vor lokaler Aktivierung ein geprüftes Abbild, Vollsicherung, getrennte Wiederherstellung/Startprüfung und Bestandsvergleich herstellen. Ein Versionswechsel darf keine Projekt-/Datei-/Freigabemigration auslösen.
- Interne Tagesupdates verweisen auf Detailberichte. Private Daten, lokale Verbindungseinstellungen, Sicherungen und Testoriginale bleiben außerhalb von Git und Docker-Buildkontext.

## Vier getrennte Zustände

**Im Quellstand geändert**, **getestet**, **lokal aktiviert** und **öffentlich veröffentlicht** sind getrennte Aussagen. Ein lokales Docker-Abbild oder eine Versionsnummer erzeugt keinen Git-Tag, GitHub-Release, Push oder Online-Deploy. Eine Veröffentlichung wird gesondert beauftragt und geprüft.

Aktueller Prüf-/Betriebsstand: [AKTUELLER_STAND.md](AKTUELLER_STAND.md). Umfang: [Release Notes](RELEASE_NOTES.md). Fachliche Anleitung: [Fakten und Abhängigkeiten](FAKTEN_UND_ABHAENGIGKEITEN.md).

## Lokaler Nachweis 22.11.2026

App `0.2.0-beta.1` nach vollständiger Prüfung, Vollsicherung und getrenntem Restore lokal aktiviert. Die laufende Versionsauskunft und Release Notes sind geprüft; API/MCP-Vertrag und Paketabhängigkeiten blieben unverändert. Bestandsvergleich: 1.334 Dateien/16 Tabellen unverändert. Eine öffentliche Veröffentlichung ist nicht Bestandteil dieses lokalen Abschlusses.
