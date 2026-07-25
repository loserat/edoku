# edoku

<p><strong><span style="color:red;">Mitentwickler gesucht: Ich suche Menschen, die edoku kostenlos testen möchten. Feedback, Fehlerberichte und Ideen sind willkommen. Für Tester gibt es Support innerhalb von 48 Stunden.</span></strong></p>

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

Die aktuelle Arbeitsliste mit offenen Punkten steht in [docs/OFFENE_PUNKTE.md](docs/OFFENE_PUNKTE.md).
Der kompakte aktuelle Projektstand steht in [docs/AKTUELLER_STAND.md](docs/AKTUELLER_STAND.md).
Änderungen werden zusätzlich im [CHANGELOG.md](CHANGELOG.md) gepflegt.

## Funktionen

- Registrierung, Login und Logout
- benutzerbezogene Projektverwaltung
- mehrere Projekte pro Benutzer
- aktuelles Projekt als Arbeitskontext
- Dashboard mit Fortschritt und Kennzahlen
- Projektstammdaten mit Objektstruktur und Stockwerken
- Leistungsbereiche mit Formularvorgaben und Projektzuordnung
- Dokumentenmatrix mit logischer Kapitelnummerierung
- Gerätelisten je Leistungsbereich
- Brandschutzabschottungen mit Foto-Zuordnung über Anhänge
- Anhänge und importierte PDF-Dateien
- Plan-/Messprotokoll-Kategorien für PDF-Importe
- PDF-Erzeugung mit Projektkopf, Logo und optionalem nickgm.de-Branding
- Inhaltsverzeichnis, Formular-PDFs, Gerätelisten und Brandschutz-PDFs
- separate PDF-Trennstreifen im Maß 24 x 10,5 cm
- separate Ordnerrücken für Avery-Zweckform-Formate `61x192-R` und `38x192-R`
- Deckblätter für Hauptkategorien
- Exportliste und finaler Exportordner
- Tag-/Nacht-Theme
- Theme-Editor mit Presets
- Versionsanzeige und GitHub-Update-Prüfung im Systembereich
- schwebende Statusmeldungen, die die Oberfläche nicht verschieben
- Docker-Start
- GitHub-/VS-Code-inspirierte Theme-Presets mit stabilen Layoutgrößen

## Screens und Bedienkonzept

Die Hauptnavigation ist kompakt gehalten:

- Projekte
- Übersicht / aktuelles Projekt
- Anhänge
- Brandschutz
- Gerätelisten
- Export
- System-Icon rechts im Header

Je Hauptbereich werden die Unterpunkte links in der Seitenleiste oder als kompakte Bereichstabs geführt. Links oben im Header steht der Name des aktuell geöffneten Projekts.

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

## Installation und lokale Defaults

Die Installationsschritte, Hinweise zu lokalen Demo-Konten und erste Setup-Schritte stehen in [INSTALL.md](INSTALL.md).

Die Demo-Zugänge sind nur für lokale Entwicklung und Tests gedacht. Passwörter werden nicht im Klartext gespeichert, sondern beim Start gehasht in SQLite abgelegt.

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
- separate Ordnerrücken für Dokumentationsordner
- Konformitätserklärungen
- CE-Bestätigungen
- DGUV-/Errichterbestätigungen
- Gerätelisten
- Brandschutzseiten mit Platz für Fotos
- Exportliste
- finalen Exportordner

Importierte PDF-Anhänge können über Kategorien wie Stromlaufpläne, Schaltpläne, Installationspläne, Schemata und Messprotokolle in Inhaltsverzeichnis und Exportliste aufgenommen werden.

Anhänge werden kategoriebezogen als Kacheln verwaltet. Datei-Metadaten, Vorschau und Brandschutz-Fotozuordnung laufen über ein Bearbeiten-Popup. Bedienungsanleitungen können optional mit Gerätepositionen in Gerätelisten verknüpft werden.

Trennstreifen werden separat erzeugt und bewusst ohne Footer-Branding gedruckt. Der Standarddruck ist tintensparend: schwarze Kapitelnummer am Registerrand, keine blaue Fläche und kein zusätzlicher Projekttext.

Ordnerrücken werden unter `Export > Ordnerrücken` als separate PDF erzeugt. Unterstützt sind Avery-Zweckform-Bögen `61x192-R` mit 4 Rücken je A4-Seite und `38x192-R` mit 7 Rücken je A4-Seite. Der Text wird gedreht, zentriert im Rücken angeordnet und kann Projektname, Projektnummer, Auftraggeber, Liegenschaft, Baumaßnahme und Ordnernummer enthalten. Die Ordneranzahl kann manuell gesetzt oder grob aus den vorhandenen Export-/PDF-Einträgen geschätzt werden.

Gerätelisten können über das Drei-Punkte-Menü als systemweite Vorlage gespeichert werden. Die Verwaltung erfolgt unter `System > Gerätelisten`; passende Vorlagen können später wieder in Gerätelisten geladen werden.

Systemadmins können unter `System > System` das sichtbare edoku-/nickgm-Branding für Oberfläche und PDF-Exporte deaktivieren. Das ist als Vollversions-/Lizenzoption vorbereitet; projektbezogene Logos und Erstellerlogos bleiben davon unabhängig.

## Theme-System

Das Theme-System nutzt zentrale CSS-Variablen für Farben, Radien, Schatten, Abstände und Typografie. Der Editor ist bewusst auf die wichtigsten Werte begrenzt und orientiert sich farblich an GitHub-/VS-Code-Themes. Die Presets verwenden identische Radius-, Spacing- und Typografiewerte, damit beim Wechsel keine sichtbaren Layoutsprünge entstehen.

Aktuelle Presets:

- GitHub Light Default
- GitHub Light High Contrast
- GitHub Light Colorblind
- GitHub Dark Default
- GitHub Dark High Contrast
- GitHub Dark Colorblind
- GitHub Dark Dimmed

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
- interne Tagesupdates und lokale Arbeitsnotizen

Siehe auch:

- [Technische Dokumentation](docs/TECHNIK.md)
- [Installation](INSTALL.md)
- [Aktueller Stand](docs/AKTUELLER_STAND.md)
- [Changelog](CHANGELOG.md)
- [Repo-Sicherheitscheck](docs/REPO_SICHERHEITSCHECK.md)
- [Projektupdate](docs/PROJEKTUPDATE.md)
- [Release Notes](docs/RELEASE_NOTES.md)

## Aktuelle Grenzen

- keine externe Datenbank
- Rollenverwaltung ist als Beta-Funktion vorhanden und muss für produktiven Serverbetrieb weiter gehärtet werden
- PDF-Gesamtdatei und ZIP-Export sind als Beta-Funktion vorhanden und müssen weiter visuell geprüft werden
- automatisierte Tests sind noch nicht aufgebaut

## Lizenz

Noch nicht festgelegt.
