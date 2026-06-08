# edoku

edoku ist eine lokale Web-Anwendung zur strukturierten Erstellung von Elektro-Bestandsdokumentationen. Die Anwendung verwaltet Projektstammdaten, Leistungsbereiche, Dokumentenmatrix, Gerätelisten, Brandschutzdokumentation, Anhänge, PDF-Erzeugung und Exportvorbereitung.

Version 1 ist bewusst leichtgewichtig aufgebaut:

- Node.js und Express
- EJS-Templates
- Vanilla JavaScript
- eigenes CSS ohne Frontend-Framework
- JSON-Dateien für fachliche Projektdaten
- SQLite für Benutzer, Sessions und Projektübersicht
- Docker-fähig

## Status

edoku ist aktuell als **Beta-Version** vorgesehen. Die Anwendung ist lokal und per Docker lauffähig und kann bereits für Testläufe, Demo-Projekte und die Weiterentwicklung der Elektro-Bestandsdokumentation genutzt werden.

Die Beta ist noch nicht als produktiv abgesicherte Webserver-Anwendung gedacht. Es gibt bewusst noch Einschränkungen bei Rollen/Rechten, automatisierten Tests, PDF-Merge und Archivfunktionen.

## Funktionen

- Registrierung, Login und Logout
- benutzerbezogene Projektverwaltung
- mehrere Projekte pro Benutzer
- aktuelles Projekt als Arbeitskontext
- Dashboard mit Fortschritt und Kennzahlen
- Projektstammdaten mit Objektstruktur und Stockwerken
- Leistungsbereiche mit System- und Herstellerbezug
- Dokumentenmatrix mit logischer Kapitelnummerierung
- Gerätelisten je Leistungsbereich
- Brandschutzabschottungen mit Foto-Zuordnung über Anhänge
- Anhänge und importierte PDF-Dateien
- Plan-/Messprotokoll-Kategorien für PDF-Importe
- PDF-Erzeugung mit Projektkopf, Logo und GitHub-Branding
- Inhaltsverzeichnis, Formular-PDFs, Gerätelisten und Brandschutz-PDFs
- separate PDF-Trennstreifen im Maß 24 x 10,5 cm
- Deckblätter für Hauptkategorien
- Exportliste und finaler Exportordner
- Tag-/Nacht-Theme
- Theme-Editor mit Presets
- schwebende Statusmeldungen, die die Oberfläche nicht verschieben
- Docker-Start
- GitHub-/VS-Code-inspirierte Theme-Presets mit stabilen Layoutgrößen

## Screens und Bedienkonzept

Die Hauptnavigation ist kompakt gehalten:

- Übersicht
- Projekte
- Dokumentation
- Brandschutz
- Gerätelisten
- Export
- System

Je Hauptbereich werden die Unterpunkte links in der Seitenleiste geführt. Das aktuell geöffnete Projekt wird im Header angezeigt.

## Start mit Docker

```bash
docker compose up --build
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

Im Hintergrund starten:

```bash
docker compose up -d
```

Stoppen:

```bash
docker compose down
```

Logs anzeigen:

```bash
docker compose logs -f
```

## Start ohne Docker

Voraussetzung: Node.js 20 oder neuer. Docker nutzt ebenfalls Node.js 20.

```bash
npm install
npm start
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

## Standard-Benutzer im lokalen Demo-Stand

Für die lokale Entwicklung werden beim Start Demo-Benutzer vorbereitet:

```text
Benutzer: admin
Passwort: admin

Benutzer: marx
Passwort: marx

Benutzer: berg
Passwort: berg
```

Die Zugangsdaten sind nur für lokale Entwicklung und Tests gedacht. Passwörter werden nicht im Klartext gespeichert, sondern beim Start gehasht in SQLite abgelegt.

## Projektstruktur

```text
.
├── config/              # System- und Formular-Konfiguration
├── data/                # globale Startdaten und JSON-Defaults
├── docs/                # technische Doku, Projektupdate und Release Notes
├── intern/              # lokale interne Notizen, größtenteils ignoriert
├── public/              # CSS, JavaScript, Logo
├── services/            # Backend-Services
├── storage/             # lokaler Runtime-Speicher, nicht für Git
├── templates/           # spätere Dokumentvorlagen
├── views/               # EJS-Templates
├── Dockerfile
├── docker-compose.yml
├── package.json
└── server.js
```

## Datenhaltung

Fachliche Projektinhalte bleiben in Version 1 JSON-basiert. Benutzer, Sessions und Projekt-Metadaten werden in SQLite gespeichert.

Lokale Laufzeitdaten werden unter `storage/` erzeugt:

```text
storage/app.db
storage/users/[userId]/projects/[projectId]/
storage/exports/
storage/imports/
```

Diese Daten sind in `.gitignore` ausgeschlossen und gehören nicht ins öffentliche Repository.

## Export und PDFs

edoku erzeugt aktuell:

- Inhaltsverzeichnis
- Anlagenbeschreibung unter Kapitel `3.1`
- Deckblätter für Hauptkategorien
- separate Trennstreifen für Unterkategorien
- Konformitätserklärungen
- CE-Bestätigungen
- DGUV-/Errichterbestätigungen
- Gerätelisten
- Brandschutzseiten mit Platz für Fotos
- Exportliste
- finalen Exportordner

Importierte PDF-Anhänge können über Kategorien wie Stromlaufpläne, Schaltpläne, Installationspläne, Schemata und Messprotokolle in Inhaltsverzeichnis und Exportliste aufgenommen werden.

Trennstreifen werden separat erzeugt und bewusst ohne GitHub-Branding gedruckt. Der Standarddruck ist tintensparend: schwarze Kapitelnummer am Registerrand, keine blaue Fläche und kein zusätzlicher Projekttext.

## Theme-System

Das Theme-System nutzt zentrale CSS-Variablen für Farben, Radien, Schatten, Abstände und Typografie. Die Default-Presets verwenden identische Radius-, Spacing- und Typografiewerte, damit beim Wechsel zwischen Themes keine sichtbaren Layoutsprünge entstehen.

Aktuelle Presets:

- Apple Light
- Apple Dark
- Graphite
- Blue Steel
- GitHub Light
- GitHub Dark
- GitHub Dimmed
- High Contrast
- Sage Copper
- Warm Graphite
- Nordic Light
- Violet Amber

## GitHub-Hinweise

Diese Inhalte sollen ins Repository:

- Quellcode
- Views
- CSS und Frontend-JS
- Konfigurationsdateien
- JSON-Startdaten
- Dokumentation
- Docker-Dateien

Diese Inhalte sollen nicht ins Repository:

- `node_modules/`
- `output/`
- `storage/` außer `storage/README.md`
- `.env`
- `.DS_Store`
- interne Tagesupdates außer `intern/tagesupdates/README.md`

Siehe auch:

- [Technische Dokumentation](docs/TECHNIK.md)
- [Projektupdate](docs/PROJEKTUPDATE.md)
- [Release Notes](docs/RELEASE_NOTES.md)

## Aktuelle Grenzen

- keine externe Datenbank
- keine Rollen/Rechteverwaltung
- PDF-Gesamtdatei und ZIP-Export sind als Beta-Funktion vorhanden und müssen weiter visuell geprüft werden
- automatisierte Tests sind noch nicht aufgebaut

## Lizenz

Noch nicht festgelegt.
