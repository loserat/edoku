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

Die finale PDF-Zusammenführung zu einer Gesamtdatei ist noch nicht Bestandteil der Beta.

## Anhänge und importierte PDFs

Anhänge werden projektbezogen gespeichert. PDF-Anhänge können Kategorien erhalten, z. B.:

- Stromlaufpläne
- Schaltpläne
- Installationspläne
- Schemata
- Messprotokolle

Diese PDF-Anhänge können in Inhaltsverzeichnis und Exportliste aufgenommen werden.

## Docker

Die Anwendung ist über `Dockerfile` und `docker-compose.yml` startbar. Persistente lokale Ordner werden als Volumes eingebunden.

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

- keine Rollen- und Rechteverwaltung
- keine produktive Webserver-Härtung
- keine automatisierte Test-Suite
- keine echte PDF-Gesamtzusammenführung
- Projektarchive ohne finale ZIP-Erzeugung
- fachliche Texte und Normbezüge müssen weiter geprüft werden
