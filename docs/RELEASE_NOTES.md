# Release Notes

## 0.1.0-beta.1 - 2026-06-07

Erste öffentliche Beta-Vorbereitung für `edoku`.

### Enthalten

- Login und lokale Benutzerverwaltung mit SQLite
- projektbezogene JSON-Datenhaltung
- Projektverwaltung mit aktuellem Arbeitsprojekt
- Dashboard mit Fortschritts- und Statusdaten
- Leistungsbereiche mit Formularvorgaben
- Dokumentenmatrix und logische Kapitelnummerierung
- Gerätelisten und Brandschutzlisten mit sortierbaren Tabellen
- Anhangsverwaltung für Pläne, Messprotokolle, Nachweise und Bilder
- PDF-Erzeugung für Inhaltsverzeichnis, Anlagenbeschreibung, Formulare, Listen und Brandschutzseiten
- Theme-Editor mit Presets und globalen CSS-Variablen
- Docker-Start über `docker compose up --build`

### Geändert

- Projektname und Branding auf `edoku` bereinigt
- Default-Demozugang auf ein lokales Admin-Konto umgestellt; konkrete lokale Defaults stehen in `INSTALL.md`
- Anhänge werden nach Kategorie und Stockwerk für Inhaltsverzeichnis und Export sortiert
- UI-Schalter für Aktiv-/Export-Optionen vereinheitlicht
- interne Tagesupdates und lokale Arbeitsnotizen bleiben per `.gitignore` außerhalb des Repositories
- Finaler Export erzeugt jetzt zusätzlich eine Gesamt-PDF und ein ZIP mit flacher Kapitelstruktur
- PDF-Zuordnung in der Exportliste nutzt logische Kapitelnummern und Titelabgleich, damit gleich nummerierte Dokumente nicht verwechselt werden
- Separate Trennstreifen können für Unterkategorien erzeugt werden
- Trennstreifen wurden auf tintensparenden Schwarz-Weiß-Druck ohne GitHub-Branding umgestellt
- Statusmeldungen erscheinen als schwebende Toasts und verschieben die Oberfläche nicht mehr

### Nachtrag 2026-06-08

- Zusätzliche lokale Testbenutzer ergänzt; konkrete lokale Defaults stehen in `INSTALL.md`
- Theme-Presets verwenden gemeinsame Radius-, Spacing- und Typografiewerte, damit beim Themewechsel keine Layoutsprünge entstehen
- GitHub-/VS-Code-orientierte Presets konsolidiert: GitHub Light und GitHub Dark
- Aktive Buttons, Tabs und Badges nutzen Theme-Kontrastvariablen statt festem Weiß
- Einzelne Preset-Farbwerte für bessere Lesbarkeit nachgeschärft

### Nachtrag 2026-06-09

- Rollenmodell ergänzt: `viewer`, `user`, `admin`, `systemadmin`
- Systemadmin-Benutzerverwaltung in den Einstellungen ergänzt
- Viewer-Schreibzugriffe werden serverseitig blockiert
- Projektmanager links erweitert: aktive Projekte, Archiv und Import/Pakete sind dort gebündelt
- Projektübersicht zeigt nur noch das aktuell geöffnete Projekt mit Mini-Status
- Leistungsbereiche fragen beim Abwählen eine Bestätigung ab
- Login-Maske und Auth-Meldungen optisch zentriert
- Installationshinweise und lokale Demo-Defaults nach `INSTALL.md` ausgelagert

### Bekannte Grenzen

- Noch keine produktive Server-Härtung
- Rollen- und Rechteverwaltung ist Beta und muss vor produktiver Nutzung weiter geprüft werden
- Noch keine automatisierte Test-Suite
- Gesamt-PDF, ZIP-Export und Trennstreifen müssen im Praxiseinsatz weiter visuell geprüft werden
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden
