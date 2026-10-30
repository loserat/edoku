# Changelog

Alle relevanten Änderungen an `edoku` werden hier dokumentiert.

Das Format orientiert sich an Keep a Changelog. Die Versionierung folgt semantischen Versionen mit Beta-Suffix, solange die Anwendung noch nicht produktionsreif freigegeben ist.

## Unreleased

### Geändert

- README mit fünf Screenshots aus einer getrennten Demo-Installation ergänzt; Release Notes, Installation, Arbeitsstand und offene Punkte aktualisiert.
- Reproduzierbare Test-/Abnahmeanleitung und Vorgehen für lokale Updates, Sicherung und Wiederherstellung dokumentiert.

- Bestehende Konten werden beim Start nicht mehr durch Startkonten überschrieben; eine vorhandene Datenbank wird nicht erneut aus dem alten Projektregister migriert.
- Projektaufrufe aktualisieren keine vorhandenen Projektzeitstempel; GET-Systemauswahl speichert keine automatisch abgeglichene Auswahl.
- Lokale Sicherungen von Git und Docker-Build-Kontext ausgeschlossen.

- Kapitelnummern, Gerätelisten und importierte PDFs nutzen eine gemeinsame Exportstruktur; Nummernkollisionen und falsche Dateistatus-Zuordnungen behoben.
- PDF-Dateien, Strukturüberschriften und tatsächliche Seiten werden getrennt gezählt; Dashboard und Export verwenden denselben aktuellen Stand.
- Gesamt-PDF mit tatsächlichen Startseiten und gemessenen Inhaltsverzeichnis-Sprungflächen; mehrseitige Anhänge und lange Titel berücksichtigt.
- Eindeutige Dokumentkennungen für generierte PDFs, lückenlose finale Dateinummern und passende ZIP-Kapiteltitel ergänzt.
- Ordneranzahl folgt PDF-Seiten und einstellbarer Kapazität; fehlende, veraltete und unlesbare Dateien werden ausdrücklich ausgewiesen.

- App-Icon auf Dokument mit Prüfhaken reduziert; Favicon, Safari-Maske und PNG-Startbildschirmvarianten vereinheitlicht.

- Ruhige technische Oberfläche mit klarer Navigation, flacheren Bedienelementen und vereinheitlichten Abständen.
- Projektübersicht mit Erfassungsstand, hervorgehobenem nächsten Schritt und einheitlichen Kennzahlenkarten überarbeitet.
- Anmeldung und Registrierung mit gemeinsamer technischer Dokumentengrafik gestaltet.
- Seitenkopf und Navigationsdefinition zentralisiert; CSS bei unveränderter Reihenfolge in Fachbereiche aufgeteilt.
- Tastaturfokus, Sprunglink zum Inhalt und reduzierte Bewegung berücksichtigt.

- Browser-Tab-Icons und kompaktes App-Icon fuer Header, Login und Register ergaenzt.
- Kapitelnummerierung im Export korrigiert.
- Doppelte Original-Kapitelnummern in der Dokumentenmatrix erzeugen jetzt keine doppelten Anzeige-Kapitel mehr.
- Importierte PDF-Anhänge erzwingen ihre Elternkapitel im Inhaltsverzeichnis, damit Unterkapitel wie `12.1.1` nicht ohne `12.1` erscheinen.
- Aktueller Projektstand in `docs/AKTUELLER_STAND.md` ergänzt.

### Geprüft

- Übernahme in die lokale Hauptanwendung auf Port 3000 mit vollständiger Sicherung und unverändertem Datenbankinhalt sowie unveränderten Projekt-, Anhangs-, Einstellungs- und Exportdateien.
- Drei zusätzliche Datenerhalt-Prüfungen: bestehende Konten und Projekte über Seitenaufrufe/Neustarts, vorhandene leere Datenbank und echte Erstinstallation. Zusammen mit den Exportprüfungen: 21 erfolgreich.

- 18 automatisierte Kapitel-/Exportprüfungen sowie HTTP-Abgleich von Dashboard, Export und Gesamt-PDF in einer getrennten Testkopie.

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
