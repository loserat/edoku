# Projektupdate edoku

Stand: 2026-06-04

## Beta-Status

edoku ist als Beta-Version für lokale Testläufe und die weitere Entwicklung vorbereitet. Die Anwendung läuft lokal per Node.js und über Docker. Die grundlegenden Module für Elektro-Bestandsdokumentation sind vorhanden.

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
- PDF-Erzeugung
- Exportliste und finaler Exportordner
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

## Wichtige Beta-Einschränkungen

- keine Rollen- und Rechteverwaltung
- keine produktive Server-Härtung
- keine automatisierte Test-Suite
- keine echte PDF-Zusammenführung zu einer Gesamtdatei
- ZIP-Erzeugung für Projektarchive ist noch nicht final
- Normtexte und fachliche Formulare müssen weiter geprüft werden

## Nächste sinnvolle Schritte

- PDF-Layout final visuell prüfen
- PDF-Gesamtzusammenführung einbauen
- Projektarchive als echte ZIP-Dateien erzeugen
- Anhänge/Pläne weiter ausbauen
- BK 01 und BK 02 definieren
- automatisierte Tests ergänzen
- Lizenzentscheidung treffen
