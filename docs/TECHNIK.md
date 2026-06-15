# Technische Dokumentation

## Architektur

edoku ist eine Node.js-Webanwendung mit Express und serverseitigem Rendering über EJS. Das Frontend verwendet Vanilla JavaScript und CSS ohne Framework.

Die Anwendung ist so aufgebaut, dass sie lokal auf einem Rechner laufen kann, aber grundsätzlich für späteren Webserverbetrieb vorbereitet ist.

## Backend

- `server.js` enthält Express-App, Routen und zentrale Request-Flows.
- `services/` enthält fachliche und technische Hilfsdienste.
- JSON-Zugriffe laufen über robuste Lese-/Schreibfunktionen.
- Dateipfade werden mit `path.join` und kontrollierten Projektpfaden aufgebaut.
- Uploads und Downloads sind projekt- und benutzerbezogen gekapselt.

## Datenhaltung

Fachliche Projektinhalte liegen in JSON-Dateien:

- `projekt.json`
- `leistungsbereiche.json`
- `dokumentenmatrix.json`
- `projektSysteme.json`
- `geraetelisten.json`
- `brandschutz.json`
- `anhaenge.json`
- `exportliste.json`

Benutzer, Sessions und Projektübersicht liegen in SQLite:

```text
storage/app.db
```

Benutzerprojekte liegen unter:

```text
storage/users/[userId]/projects/[projectId]/
```

## Benutzerverwaltung

- Registrierung und Login sind vorhanden.
- Passwörter werden mit `crypto.scrypt` und Salt gehasht.
- Sessions werden als zufällige Tokens in SQLite gespeichert.
- Fachseiten sind nur nach Login erreichbar.
- Projektzugriff erfolgt über die angemeldete `userId`.
- Für lokale Tests werden Seed-Benutzer vorbereitet; konkrete lokale Defaults stehen in `INSTALL.md`.
- Rollen sind als Beta-Funktion vorhanden: `viewer`, `user`, `admin`, `systemadmin`.
- `systemadmin` kann Benutzer anlegen und Rollen verwalten.
- `viewer` darf Fachseiten lesen, aber keine Schreiboperationen ausführen.
- Benutzerkonten besitzen einen Status `active` oder `disabled`.
- Gesperrte Konten können sich nicht anmelden; vorhandene Sessions werden beim Sperren entfernt.
- Passwort-Reset durch Systemadmins schreibt neuen Hash/Salt und beendet vorhandene Sessions des Kontos.
- Der bestehende Admin-Datensatz behält intern seine stabile ID, damit vorhandene Demo-Projekte nicht verloren gehen.

## Projektkonzept

Ein Benutzer kann mehrere Projekte besitzen. Ein Projekt wird als aktueller Arbeitskontext geöffnet. Alle Fachseiten arbeiten mit diesem aktuellen Projekt.

Globale Dateien in `data/` dienen als Startdaten und Defaults. Projektbezogene Daten werden beim Anlegen oder Öffnen eines Projekts in den jeweiligen Storage-Bereich kopiert beziehungsweise dort gelesen.

## Dokumentationslogik

Die Dokumentenmatrix enthält fachliche Kapitel und Exportpunkte. Die internen Original-Kapitel bleiben stabil. Für Ausgabe und Export wird zusätzlich eine logische Nummerierung erzeugt, damit deaktivierte Kapitel keine Lücken erzeugen.

## PDF-Erzeugung

Die PDF-Erzeugung nutzt `pdfkit`.

Aktuell erzeugt werden:

- Inhaltsverzeichnis
- Anlagenbeschreibung
- Konformitätserklärungen
- CE-Bestätigungen
- DGUV-/Errichterbestätigungen
- Gerätelisten
- Brandschutzdokumentation
- Deckblätter für Hauptkategorien
- separate Trennstreifen für Unterkategorien im Maß 24 x 10,5 cm
- separate Ordnerrücken für Avery-Zweckform `61x192-R` und `38x192-R`
- finale Gesamt-PDF und ZIP-Ausgabe als Beta-Funktion

Die Trennstreifen werden ohne GitHub-Branding erzeugt, damit sie als reine Registerstreifen gedruckt werden können. Layoutoptionen für Trennstreifen werden in den Systemeinstellungen gespeichert.

Ordnerrücken werden ebenfalls ohne Footer-Branding erzeugt. Die Ausgabe orientiert sich an A4-Kalibrierungsbögen: `61x192-R` nutzt 4 horizontale Rücken je Seite, `38x192-R` nutzt 7 horizontale Rücken je Seite. Die Druckoptionen für Projektkenndaten werden in `config/systemEinstellungen.json` unter `export.ordnerruecken` gespeichert.

## Oberfläche und Theme

- Globale Farben, Radien, Schatten, Abstände und Typografie werden über CSS-Variablen gesteuert.
- Der Theme-Editor speichert Werte in `config/systemEinstellungen.json`.
- Statusmeldungen werden als schwebende Toasts dargestellt und verschieben keine Seiteninhalte.
- Tag-/Nacht-Umschaltung und Theme-Presets greifen global auf Header, Navigation, Karten, Tabellen, Formulare und Buttons.
- Default-Presets teilen sich identische Radius-, Spacing- und Typografiewerte, damit beim Themewechsel keine Layoutgrößen springen.
- GitHub-orientierte Presets sind vorgesehen: Light Default, Light High Contrast, Light Colorblind, Dark Default, Dark High Contrast, Dark Colorblind und Dark Dimmed.
- Der Theme-Editor zeigt bewusst nur die wichtigsten Werte, damit die Einstellungen wartbar bleiben.

## Anhänge und importierte PDFs

Anhänge werden projektbezogen gespeichert und immer in der aktuell gewählten Kategorie importiert. Die Oberfläche zeigt Anhänge als Kacheln; Detaildaten werden bewusst in einem Bearbeiten-Popup gespeichert, damit keine versehentlichen Auto-Saves beim reinen Öffnen oder Vorschauen entstehen.

PDF-Anhänge können Kategorien erhalten, z. B.:

- Stromlaufpläne
- Schaltpläne
- Installationspläne
- Schemata
- Messprotokolle
- Bedienungsanleitungen

Diese PDF-Anhänge können in Inhaltsverzeichnis und Exportliste aufgenommen werden.

Für Pläne und Messprotokolle wird die Stockwerksangabe zur Sortierung verwendet. Bedienungsanleitungen können in Gerätelisten mit einzelnen Gerätepositionen verknüpft werden. Brandschutzgerätelisten sind davon ausgenommen, weil dort die Bild- und Schottungsdokumentation separat geführt wird.

Bildanhänge können Brandschutzabschottungen als `Foto 1` oder `Foto 2` zugeordnet werden. Die Zuordnung erfolgt im Anhangs-Popup und wird gemeinsam mit den Metadaten über den Speichern-Button übernommen. Das Bearbeiten-Popup zeigt für Bilder eine direkte Vorschau; PDFs werden über eine separate PDF-Vorschau geöffnet.

Importierte Dateien werden serverseitig mit einem logischen Dateinamen aus Kategorie und Metadaten abgelegt. Dadurch bleiben Ablage, Export und Inhaltsverzeichnis nachvollziehbar.

## Docker

Die Anwendung ist über `Dockerfile` und `docker-compose.yml` startbar. Persistente lokale Ordner werden als Volumes eingebunden.

Der Container nutzt Node.js 20. Für lokale Entwicklung sollte ebenfalls Node.js 20 oder neuer verwendet werden.

## GitHub-Upload

Nicht ins Repository gehören:

- `node_modules/`
- `output/`
- `storage/app.db`
- `storage/users/`
- `storage/exports/`
- `storage/imports/`
- `.env`
- interne Tagesupdates

## Beta-Einschränkungen

- Rollen- und Rechteverwaltung ist Beta und muss vor produktiver Nutzung weiter geprüft werden
- keine produktive Webserver-Härtung
- keine automatisierte Test-Suite
- PDF-Gesamtdatei, ZIP-Export und Archivstruktur weiter im Praxistest prüfen
- fachliche Texte und Normbezüge müssen weiter geprüft werden
