# Projektupdate edoku

Stand: 2026-06-09

## Beta-Status

edoku ist als Beta-Version für lokale Testläufe und die weitere Entwicklung vorbereitet. Die Anwendung läuft lokal per Node.js und über Docker. Die grundlegenden Module für Elektro-Bestandsdokumentation, projektbezogene Arbeit und PDF-/Exportvorbereitung sind vorhanden.

## Enthaltene Module

- Benutzerregistrierung und Login
- projektbezogener Zugriff mit stabiler `userId`
- Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin`
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
- Deckblätter und separate PDF-Trennstreifen
- Exportliste und finaler Exportordner
- Theme-System mit Editor und Presets
- GitHub-/VS-Code-orientierte Theme-Presets
- schwebende Statusmeldungen ohne Layoutverschiebung
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

## Update 2026-06-07 Abend

- Trennstreifen-Layout tintensparend überarbeitet.
- Trennstreifen werden ohne GitHub-Logo, ohne Projektname und ohne blaue Registerfläche erzeugt.
- Optionen für Innentext und zusätzlichen Registertitel werden gespeichert.
- Innenbereich der Trennstreifen wurde wegen Lochung weiter nach rechts gesetzt.
- Flash-/Statusmeldungen schweben jetzt als kompakte Toasts und verschieben die GUI nicht mehr.
- GitHub-Dokumentation und technische Hinweise für die Beta nachgezogen.

## Update 2026-06-08

- Theme-Presets auf gemeinsame Radius-, Spacing- und Typografiewerte stabilisiert.
- Ziel: Themewechsel sollen keine sichtbaren Layoutsprünge mehr erzeugen.
- GitHub Light und GitHub Dark als GitHub-/VS-Code-orientierte Presets konsolidiert.
- Kontrastvariablen für aktive UI-Elemente ergänzt und feste weiße Schrift in mehreren Komponenten ersetzt.
- Zusätzliche lokale Testbenutzer ergänzt; konkrete lokale Defaults stehen in `INSTALL.md`.
- Docker-Container neu gebaut und Loginpfade für alle drei Benutzer geprüft.

## Update 2026-06-09

- Benutzerverwaltung um Rollen erweitert: `viewer`, `user`, `admin`, `systemadmin`.
- Systemadmins können Benutzer in den Einstellungen anlegen und Rollen verwalten.
- Viewer-Schreibzugriffe werden serverseitig blockiert.
- Benutzerkonten können gesperrt und wieder aktiviert werden.
- Systemadmins können Benutzerpasswörter zurücksetzen; bestehende Sessions des betroffenen Kontos werden beendet.
- `admin` und `berg` sind als lokale Systemadmin-Konten vorbereitet; `marx` bleibt als normaler User vorgesehen.
- Projektbereich neu geordnet: Archiv und Import/Pakete sind im linken Projektmanager angeordnet.
- Projektübersicht zeigt rechts nur noch das aktuell geöffnete Projekt mit kompaktem Status statt aller aktiven Projektkarten.
- Beim Abwählen von Leistungsbereichen erscheint eine Bestätigung, weil zugehörige Gerätelisten und Dokumente deaktiviert werden.
- Login-/Registrierungsbildschirm mittig zentriert; Anmeldehinweise erscheinen oben mittig als Toast.
- Dokumentation bereinigt: konkrete lokale Demo-Zugänge aus der Haupt-README entfernt und in `INSTALL.md` verschoben.

## Wichtige Beta-Einschränkungen

- Rollen- und Rechteverwaltung ist als Beta-Funktion vorhanden und muss weiter produktionsreif gehärtet werden
- keine produktive Server-Härtung
- keine automatisierte Test-Suite
- PDF-Gesamtdatei und ZIP-Export sind als Beta-Funktionen vorhanden und müssen weiter im Praxiseinsatz geprüft werden
- Normtexte und fachliche Formulare müssen weiter geprüft werden
- Default-Zugang ist nur für lokale Entwicklung gedacht

## Nächste sinnvolle Schritte

- PDF-Layout final visuell prüfen
- PDF-Gesamtzusammenführung im Praxistest prüfen
- ZIP-Export und Projektarchive im Praxistest prüfen
- Anhänge/Pläne weiter fachlich ausbauen
- BK 01 und BK 02 definieren
- automatisierte Tests ergänzen
- Lizenzentscheidung treffen
- Benutzerverwaltung weiter ausbauen: eigene Passwortänderung, optionale 2FA und Audit-Log prüfen
