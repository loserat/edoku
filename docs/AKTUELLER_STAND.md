# Aktueller Stand edoku

Stand: 2026-07-25

Diese Datei fasst zusammen, wo das Projekt gerade steht und wo wir sinnvoll weiterarbeiten sollten.

## Kurzstatus

edoku ist aktuell eine lauffähige Beta-Anwendung für lokale und Docker-basierte Tests. Die Grundmodule für Projektverwaltung, Leistungsbereiche, Anhänge, Gerätelisten, Brandschutz, PDF-Erzeugung, Exportvorbereitung, Benutzerrollen, Themes und ein erstes API-Grundgerüst sind vorhanden.

Der aktuelle Stand ist noch nicht als final gehärtete Produktivversion zu bewerten. Für einen bezahlten Webserverbetrieb fehlen vor allem Sicherheits-, Rollen-, Backup-, Deployment- und Testhärtung.

## Letzter technischer Stand

- Hauptbranch `main` ist mit GitHub synchron.
- Das API-/Backend-Grundgerüst wurde in `main` übernommen.
- Die API liefert einheitliche JSON-Antworten für Healthcheck, Projekte, Leistungsbereiche, Gerätelisten, Dokumente und Exportstatus.
- Session-Cookies wurden für lokalen Betrieb und Reverse-Proxy-/HTTPS-Betrieb gehärtet.
- `config/geraetelistenVorlagen.json` und `config/systemEinstellungen.json` sind lokale Laufzeit-Konfigurationen und sollten nicht ungeprüft committed werden.

## Aktuell vorhandene Hauptbereiche

- Projekte
- Übersicht / Dashboard
- Anhänge
- Brandschutz
- Gerätelisten
- Export
- System

## Wichtige vorhandene Funktionen

- Login, Registrierung und Session-Verwaltung
- Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin`
- projektbezogene Datenablage je Benutzer
- Projektmanager mit aktuellem Projekt
- Projektstammdaten inklusive Objektstruktur und Stockwerken
- Leistungsbereiche mit Formularvorgaben
- Dokumentenmatrix im Exportbereich
- Gerätelisten mit Vorlagenfunktion
- Brandschutzabschottungen mit Foto-1-/Foto-2-Zuordnung
- Anhänge als kategoriebezogene Kacheln
- Bedienungsanleitungen als vorbereitete Anhangskategorie mit Gerätebezug
- PDF-Erzeugung inklusive Deckblättern, Listen, Brandschutzseiten, Trennstreifen und Ordnerrücken
- Theme-System mit GitHub-/VS-Code-orientierten Presets
- Systembereich mit Version und GitHub-Update-Prüfung
- API-Grundgerüst unter `/api/*`

## Wo wir stehen geblieben sind

Zuletzt ging es darum, die Anwendung weiter sauber zu strukturieren und den nächsten fachlichen Bereich anzulegen:

1. `Liegenschaften` soll als eigener Strukturpunkt vorbereitet werden.
2. Darunter soll ein Untermenüpunkt `Gebäude` entstehen.
3. Dieser Bereich soll später Objekt-/Gebäudestruktur zentral verwalten.
4. Die dort definierten Gebäude sollen perspektivisch für Pläne, Brandschutz und projektbezogene Zuordnung nutzbar sein.

Dieser Punkt ist fachlich sinnvoll, weil Stockwerke alleine langfristig nicht reichen, wenn mehrere Gebäude oder Gebäudeteile in einer Liegenschaft dokumentiert werden.

## Nächster sinnvoller Umsetzungsschritt

Als nächstes sollte additiv umgesetzt werden:

- Route für `Liegenschaften > Gebäude`
- Navigation beziehungsweise Unterstruktur passend zum bestehenden UI-Konzept
- zunächst einfache Platzhalter-/Verwaltungsansicht ohne bestehende Logik umzubauen
- keine Datenmigration erzwingen
- spätere Datenstruktur für Gebäude vorbereiten, aber noch nicht tief in Export, Anhänge und Brandschutz verdrahten

## Danach wichtige Prüfpunkte

- Läuft Docker weiterhin ohne Neubauprobleme?
- Funktioniert Login weiterhin lokal und hinter Proxy?
- Bleiben bestehende Projekt-, Anhangs-, Geräte-, Brandschutz- und Exportseiten unverändert erreichbar?
- Ist die neue Gebäude-Struktur neutral und ohne echte Demo-Namen?
- Sind lokale Runtime-Dateien weiterhin nicht versehentlich im Git?

## Größte offene Arbeitspakete

- PDF-Gesamtdokumentation final mit echten Anhängen prüfen
- klickbares Inhaltsverzeichnis im final gemergten PDF umsetzen
- externe PDF-Seitenzahlen sauber in Inhaltsverzeichnis und Sprungmarken einrechnen
- ZIP-Export und Ordnerstruktur im Praxistest härten
- Rechte-/Rollenmodell produktionsreif testen
- Liegenschaften/Gebäude fachlich sauber einführen
- automatisierte Smoke-/Regressionstests erweitern
- Produktivbetrieb mit Backup-, Update- und Deployment-Konzept absichern
