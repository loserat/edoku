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
- Benutzerkonten können gesperrt und wieder aktiviert werden
- Passwort-Reset durch Systemadmins beendet vorhandene Sessions des betroffenen Kontos
- Projektmanager links erweitert: aktive Projekte, Archiv und Import/Pakete sind dort gebündelt
- Projektübersicht zeigt nur noch das aktuell geöffnete Projekt mit Mini-Status
- Leistungsbereiche fragen beim Abwählen eine Bestätigung ab
- Login-Maske und Auth-Meldungen optisch zentriert
- Installationshinweise und lokale Demo-Defaults nach `INSTALL.md` ausgelagert

### Nachtrag 2026-06-12

- Hauptnavigation und Header weiter bereinigt; links oben steht jetzt nur noch das aktuelle Projekt.
- Menüpunkt `Dokumentation` wurde zu `Anhänge`; die Dokumentenmatrix liegt jetzt im Exportbereich.
- Matrix-Tabellen sind horizontal scrollbar, ohne Zeilenumbrüche und mit lokal speicherbaren Spaltenbreiten.
- Matrix-Auswahl fokussiert auf Erzeugen/Exportieren vorhandener Dokumente.
- Anhangsverwaltung auf kategoriebezogene Kachelansicht umgestellt.
- Upload erfolgt direkt in der gewählten Kategorie; Mehrfachupload ist vorbereitet.
- Anhangsdetails werden in einem Popup bearbeitet, das nur über `Abbrechen` verlassen wird.
- Bildanhänge zeigen eine kleine Vorschau im Popup; PDF-Anhänge erhalten einen eigenen Vorschau-Button.
- Aktionen im Anhangs-Popup wurden unten gebündelt: Download, Vorschau, Löschen, Abbrechen, Speichern.
- Brandschutz-Fotozuordnung wird beim Speichern des Anhangs übernommen; der separate Zuordnen-Button entfällt.
- Kategorie `Bedienungsanleitungen` ergänzt.
- Gerätelisten können optional Bedienungsanleitungen je Geräteposition verknüpfen; Brandschutzlisten sind ausgenommen.
- PDF-/Exportlogik referenziert verknüpfte Bedienungsanleitungen mit Kapitelbezug.
- Exportunterbereiche weiter geordnet: PDF-Dokumentation, PDF-Trennstreifen, ZIP-Export, Matrix und Exporteinstellungen.
- Systembereich zeigt jetzt App-Version, lokale Release Notes und eine sichere GitHub-Update-Prüfung ohne automatische Installation.
- Updates sind als eigener System-Unterpunkt erreichbar.
- Systemzugang wurde aus der mittleren Hauptnavigation entfernt und ganz rechts als Icon platziert.
- Benutzername und Abmeldung sind in ein kompaktes Benutzer-Icon-Menü gewandert.
- Alte Systemauswahl-Verweise wurden aus Startseite, Dashboard-Workflow und sichtbarer Exportliste entfernt.

### Nachtrag 2026-06-13

- Footer-Branding von GitHub auf ein neutrales Labor-Icon mit Link zu `https://nickgm.de` umgestellt.
- PDF-Footer verwenden das neue Branding; Trennstreifen bleiben ohne Footer-Branding.
- Systemadmins können das UI- und PDF-Branding als Vollversions-/Lizenzoption deaktivieren.
- Brandschutz-Hauptnavigation wird nur angezeigt, wenn der passende Leistungsbereich aktiv ist.
- Anhangsdateien werden bei Titeländerung logisch umbenannt und Download/Vorschau nutzen den neuen Dateinamen.
- Anhangskacheln zeigen das Dateiformat als Badge.
- Brandschutz-Fotozuordnung ersetzt vorhandene Foto-1-/Foto-2-Slots eindeutig.
- Anhangs-Popup wurde größer und mit dauerhaft sichtbarer Aktionsleiste verbessert.
- Benutzerverwaltung wurde kompakter gestaltet und nutzt Bearbeiten-Popups für Rolle, Passwort und Status.

### Nachtrag 2026-06-14

- Gerätelisten lassen sich als systemweite Vorlagen speichern.
- Gespeicherte Gerätelisten-Vorlagen können unter `System > Gerätelisten` verwaltet werden.
- Passende Vorlagen können über das Drei-Punkte-Menü einer Geräteliste geladen werden.
- Export-Unterbereich `Ordnerrücken` ergänzt.
- Ordnerrücken können als separate PDF für schmale und breite Dokumentationsordner generiert werden.
- Ordnerrücken-Optionen werden gespeichert und nach dem Generieren wieder angezeigt.
- Die spätere Umsetzung klickbarer Inhaltsverzeichnis-Einträge ist für die finale Gesamt-PDF vorgemerkt.

### Bekannte Grenzen

- Noch keine produktive Server-Härtung
- Rollen- und Rechteverwaltung ist Beta und muss vor produktiver Nutzung weiter geprüft werden
- Noch keine automatisierte Test-Suite
- Gesamt-PDF, ZIP-Export und Trennstreifen müssen im Praxiseinsatz weiter visuell geprüft werden
- Ordnerrücken-Auto-Berechnung nutzt aktuell eine grobe Schätzung und noch keine echten PDF-Seitenzahlen
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden
