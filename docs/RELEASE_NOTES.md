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
- Default-Demozugang auf `admin` / `admin` umgestellt
- Anhänge werden nach Kategorie und Stockwerk für Inhaltsverzeichnis und Export sortiert
- UI-Schalter für Aktiv-/Export-Optionen vereinheitlicht
- interne Tagesupdates und lokale Arbeitsnotizen bleiben per `.gitignore` außerhalb des Repositories

### Bekannte Grenzen

- Noch keine produktive Server-Härtung
- Noch keine Rollen- und Rechteverwaltung
- Noch keine automatisierte Test-Suite
- Gesamt-PDF-Merge und ZIP-Archivierung sind vorbereitet, aber noch nicht final
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden
