# Projektupdate edoku

Stand: 2026-06-07

## Beta-Status

edoku ist als Beta-Version für lokale Testläufe und die weitere Entwicklung vorbereitet. Die Anwendung läuft lokal per Node.js und über Docker. Die grundlegenden Module für Elektro-Bestandsdokumentation, projektbezogene Arbeit und PDF-/Exportvorbereitung sind vorhanden.

## Enthaltene Module

- Benutzerregistrierung und Login
- projektbezogener Zugriff mit stabiler `userId`
- mehrere Projekte je Benutzer
- Dashboard mit Projektfortschritt
- Projektstammdaten inklusive Objektstruktur und Stockwerken
- Leistungsbereiche
- System-/Herstellerauswahl
- Dokumentenmatrix
- logische Kapitelnummerierung
- Gerätelisten mit sortierbaren Tabellen
- Brandschutzabschottungen mit sortierbarer Liste
- Anhänge und importierte PDFs
- Plan-/Messprotokoll-Kategorien
- Kategoriebezogene Anhangsverwaltung mit Stockwerkssortierung
- PDF-Erzeugung
- Exportliste und finaler Exportordner
- Theme-System mit Editor und Presets
- Docker-Setup

## Technischer Stand

- Backend: Node.js, Express
- Templates: EJS
- Frontend: Vanilla JavaScript
- Styling: eigenes CSS
- Projektinhalte: JSON-Dateien
- Benutzer/Sessions/Projektübersicht: SQLite
- PDF-Erzeugung: `pdfkit`
- Containerisierung: Docker Compose
- Zielumgebung: Node.js 20 im Docker-Container

## Wichtige Beta-Einschränkungen

- keine Rollen- und Rechteverwaltung
- keine produktive Server-Härtung
- keine automatisierte Test-Suite
- keine echte PDF-Zusammenführung zu einer Gesamtdatei
- ZIP-Erzeugung für Projektarchive ist noch nicht final
- Normtexte und fachliche Formulare müssen weiter geprüft werden
- Default-Zugang ist nur für lokale Entwicklung gedacht

## Nächste sinnvolle Schritte

- PDF-Layout final visuell prüfen
- PDF-Gesamtzusammenführung einbauen
- Projektarchive als echte ZIP-Dateien erzeugen
- Anhänge/Pläne weiter fachlich ausbauen
- BK 01 und BK 02 definieren
- automatisierte Tests ergänzen
- Lizenzentscheidung treffen
