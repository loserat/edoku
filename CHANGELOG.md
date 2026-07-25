# Changelog

Alle relevanten Änderungen an `edoku` werden hier dokumentiert.

Das Format orientiert sich an Keep a Changelog. Die Versionierung folgt semantischen Versionen mit Beta-Suffix, solange die Anwendung noch nicht produktionsreif freigegeben ist.

## Unreleased

### Geändert

- Kapitelnummerierung im Export korrigiert.
- Doppelte Original-Kapitelnummern in der Dokumentenmatrix erzeugen jetzt keine doppelten Anzeige-Kapitel mehr.
- Importierte PDF-Anhänge erzwingen ihre Elternkapitel im Inhaltsverzeichnis, damit Unterkapitel wie `12.1.1` nicht ohne `12.1` erscheinen.
- Aktueller Projektstand in `docs/AKTUELLER_STAND.md` ergänzt.

### Geprüft

- Docker-Container neu gebaut und gestartet.
- API-Smoke-Test im Container erfolgreich ausgeführt.
- Inhaltsverzeichnisbaum im Container geprüft: keine doppelten Kapitelnummern.

## 0.1.0-beta.1 - 2026-06-07

### Hinzugefügt

- Login und lokale Benutzerverwaltung mit SQLite.
- Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin`.
- Benutzerbezogene Projektverwaltung mit aktuellem Projektkontext.
- Dashboard mit Fortschritts- und Statusdaten.
- Projektstammdaten inklusive Objektstruktur und Stockwerken.
- Leistungsbereiche mit Formularvorgaben.
- Dokumentenmatrix mit logischer Kapitelnummerierung.
- Gerätelisten je Leistungsbereich.
- Systemweite Gerätelisten-Vorlagen.
- Brandschutzabschottungen mit Foto-Zuordnung.
- Kategoriebezogene Anhangsverwaltung mit Kachelansicht.
- Bedienungsanleitungen als vorbereitete Anhangskategorie mit Gerätebezug.
- PDF-Erzeugung für Inhaltsverzeichnis, Anlagenbeschreibung, Formulare, Gerätelisten und Brandschutzseiten.
- Separate PDF-Trennstreifen.
- Separate Ordnerrücken für Avery-Zweckform `61x192-R` und `38x192-R`.
- Finaler Exportordner und ZIP-Ausgabe als Beta-Funktion.
- Theme-Editor mit GitHub-/VS-Code-orientierten Presets.
- Versionsanzeige und GitHub-Update-Prüfung im Systembereich.
- API-Grundgerüst unter `/api/*` mit Demo-Daten.
- Docker-Setup.

### Geändert

- Branding und UI-Texte auf `edoku` bereinigt.
- Hauptnavigation verdichtet.
- Dokumentationsbereich in `Anhänge` umbenannt.
- Dokumentenmatrix in den Exportbereich verschoben.
- Matrix-Tabellen horizontal scrollbar und mit anpassbaren Spaltenbreiten vorbereitet.
- Anhangsbearbeitung in Popup-Fenster verlagert.
- Brandschutz-Fotozuordnung auf eindeutige Foto-1-/Foto-2-Slots begrenzt.
- Systemzugang nach rechts in die Header-Leiste verschoben.
- Session-Cookie-Erkennung für lokalen HTTP-Betrieb und HTTPS hinter Reverse Proxy verbessert.

### Bekannte Grenzen

- Noch keine produktive Server-Härtung.
- Rollen- und Rechteverwaltung ist Beta und muss weiter systematisch getestet werden.
- Noch keine vollständige automatisierte Test-Suite.
- Gesamt-PDF, ZIP-Export, Trennstreifen und Ordnerrücken müssen weiter im Praxiseinsatz geprüft werden.
- Klickbare Inhaltsverzeichnis-Einträge im finalen Gesamt-PDF sind noch offen.
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden.
