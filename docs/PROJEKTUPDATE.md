# Projektupdate edoku

Stand: 2026-06-12

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
- leistungsbereichsbezogene Formular- und Exportvorgaben
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
- Toolbar-Branding nachgeschärft: `edoku` wird oben links größer dargestellt und bevorzugt eine Pixel-/Geist-Pixel-Schrift, falls diese lokal oder später als Webfont verfügbar ist.

## Update 2026-06-12

- Hauptnavigation weiter bereinigt: `Projekte` steht links in der Menüfolge, `Dokumentation` wurde zu `Anhänge`.
- Die Dokumentenmatrix ist in den Exportbereich gewandert und wird dort als eigene Export-Untersektion geführt.
- Matrix-Tabellen werden ohne Zeilenumbrüche dargestellt, horizontal scrollbar gehalten und können im Browser spaltenweise in der Breite angepasst werden.
- Die Matrix steuert jetzt primär, welche vorhandenen Dokumente in der Ausgabe erzeugt beziehungsweise exportiert werden.
- Der manuelle Button zum Aktualisieren der Matrix aus Leistungsbereichen wurde entfernt, weil die Synchronisierung im Hintergrund erfolgt.
- Exportbereich wurde in die Unterbereiche `PDF-Dokumentation`, `PDF-Trennstreifen`, `ZIP-Export`, `Matrix` und `Exporteinstellungen` gegliedert.
- Nicht benötigte Export-Kennzahlen wurden aus den Unterseiten entfernt, damit die Exportseiten ruhiger wirken.
- Anhänge wurden neu als kategoriebezogene Dateiablage aufgebaut: Upload erfolgt direkt in der gewählten Kategorie.
- Anhänge werden als Kacheln dargestellt; Bearbeitung erfolgt nur noch über den Button `Bearbeiten`.
- Anhangs-Popups schließen nicht mehr per Klick auf den Hintergrund, sondern bewusst über `Abbrechen`.
- Bildanhänge erhalten eine direkte Vorschau im Popup; PDF-Anhänge öffnen eine Vorschau über einen separaten Vorschau-Button.
- Die Aktionen `Download`, `Vorschau`, `Löschen`, `Abbrechen` und `Speichern` sind unten im Anhangs-Popup gebündelt.
- `Speichern` übernimmt auch die Brandschutz-Fotozuordnung; der separate Zuordnen-Button wurde aus dem Workflow entfernt.
- Mehrfachupload für Anhänge wurde vorbereitet, damit mehrere Dateien in einer Kategorie importiert werden können.
- Neue Kategorie `Bedienungsanleitungen` ergänzt.
- Gerätelisten können optional Bedienungsanleitungen mit Gerätepositionen verknüpfen; Brandschutzgerätelisten bleiben davon ausgenommen.
- Export und PDF-Logik berücksichtigen verknüpfte Bedienungsanleitungen mit passender Kapitelreferenz.
- Der Header links zeigt jetzt nur noch den Namen des aktuell geöffneten Projekts und nicht mehr zusätzlich App-Name und Projekt-Hinweistext.
- Docker wurde nach den Änderungen neu gebaut und geprüft.

## Update 2026-06-13

- Schwebendes Footer-Icon von GitHub auf ein neutrales Labor-/Reagenzglas-Icon umgestellt.
- UI- und PDF-Branding verlinken jetzt auf `https://nickgm.de`.
- Normale PDFs erhalten das neue Footer-Branding; Trennstreifen bleiben weiterhin ohne Branding.
- Brandschutz erscheint in der Hauptnavigation nur noch, wenn der Leistungsbereich `Brandschutzabschottungen` im Projekt aktiv ist.
- Anhangsdateien werden beim Bearbeiten des Titels logisch umbenannt; Download und Vorschau verwenden den aktualisierten Dateinamen.
- Anhangskacheln zeigen jetzt das Dateiformat wie `PDF`, `PNG` oder `JPG` statt eines generischen Icons/Punkts.
- Brandschutz-Fotozuordnung wurde verschärft: je Brandschottung gibt es nur ein Foto 1 und ein Foto 2; neue Zuordnungen ersetzen alte Slot-Belegungen.
- Anhangs-Popup wurde größer und die untere Aktionsleiste bleibt beim Scrollen sichtbar.
- Benutzerverwaltung optisch verdichtet: lange Werte werden gekürzt, das Datum lesbar formatiert und Rollen-/Passwort-/Statusaktionen liegen in einem Bearbeiten-Popup.
- Systembereich zeigt die installierte Version, lokale Release Notes und eine reine GitHub-Update-Prüfung.
- Update-Prüfung liest nur die neuesten GitHub Releases und führt bewusst keine automatische Server-Aktualisierung aus.
- Systemzugang sitzt in der Kopfzeile jetzt ganz rechts als reines Icon; Benutzername und Logout liegen im kompakten Benutzer-Icon-Menü.
- Version und GitHub-Update-Prüfung sind als eigener Unterpunkt `Updates` im Systembereich angeordnet.
- System-Untertabs wurden schmaler und zentrierter gestaltet, damit keine große leere Kapsel entsteht.
- Systemadmins können das sichtbare edoku-/nickgm-Branding für Oberfläche und normale PDF-Exporte als Vollversionsoption deaktivieren.
- Alte Systemauswahl-Verweise wurden aus Startseite, Dashboard-Workflow und sichtbarer Exportliste entfernt.
- Dashboard verlinkt die Dokumentenmatrix jetzt in den Exportbereich.
- Docker wurde nach den Änderungen neu gebaut und geprüft.

## Update 2026-06-14

- Gerätelisten können über das Drei-Punkte-Menü als systemweite Vorlage gespeichert werden.
- Unter `System > Gerätelisten` können gespeicherte Gerätelisten-Vorlagen umbenannt und entfernt werden.
- Gerätelisten-Vorlagen können aus dem Drei-Punkte-Menü wieder in passende Gerätelisten geladen werden; dabei wird vor dem Ersetzen der aktuellen Positionen bestätigt.
- Exportbereich um `Ordnerrücken` erweitert.
- Ordnerrücken werden als separate PDF für Avery-Zweckform-Bögen erzeugt, aktuell mit `61x192-R` und `38x192-R`.
- Die Anzahl der Ordnerrücken kann manuell gesetzt oder zunächst grob anhand vorhandener Export-/PDF-Einträge geschätzt werden.
- Für klickbare Inhaltsverzeichnisse ist der fachlich sinnvolle Ansatz festgehalten: Umsetzung im final zusammengeführten Gesamt-PDF, nicht in isolierten Einzel-PDFs.
- Docker wurde nach den Änderungen neu gebaut und die neuen Export-/Vorlagen-Routen wurden per HTTP geprüft.

## Update 2026-06-15

- Ordnerrücken-Layout anhand der Avery-Kalibrierungsbögen präzisiert.
- `61x192-R` wird als A4-Bogen mit 4 horizontalen Rücken erzeugt.
- `38x192-R` wird als A4-Bogen mit 7 horizontalen Rücken erzeugt.
- Text auf Ordnerrücken wird gedreht und mittig im Rücken ausgerichtet.
- Projektname, Projektnummer, Auftraggeber, Liegenschaft und Baumaßnahme können als kompakte Projektkenndaten auf den Rücken gedruckt werden.
- Ordnerrücken bleiben weiterhin ohne Footer-/Branding-Icon, damit sie als reine Druckvorlage nutzbar sind.
- Docker wurde nach der Layoutanpassung neu gebaut und die PDF-Erzeugung für beide Avery-Formate geprüft.
- Zentrale Datei `docs/OFFENE_PUNKTE.md` ergänzt, damit offene Aufgaben, Beta-Einschränkungen und nächste Arbeitspakete sauber nachvollziehbar bleiben.
- README verlinkt jetzt direkt auf die offene-Punkte-Liste.
- Brandschutzbilder können nur noch freien Foto-1-/Foto-2-Slots zugeordnet werden; belegte Slots werden in der Auswahl ausgeblendet und serverseitig geschützt.
- Button-Styles wurden zentral beruhigt und Export-Aktionsbuttons kompakter gestaltet.
- PDF-Dokumentationsbaum im Exportbereich nutzt mehr Bildschirmhöhe.
- GitHub-orientierte Theme-Presets ergänzt: Light/Dark Default, High Contrast, Colorblind und Dark Dimmed.
- Theme-Editor auf die wichtigsten Werte reduziert, damit die Systemeinstellungen nicht überladen wirken.

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
- Datei-Popup für Anhänge weiter visuell prüfen und bei Bedarf verfeinern
- Bedienungsanleitungen in Inhaltsverzeichnis, Gerätelisten und PDF-Gesamtexport im Praxistest prüfen
- BK 01 und BK 02 definieren
- automatisierte Tests ergänzen
- Lizenzentscheidung treffen
- Better-Comments-Kommentierung für `server.js`, `public/js/app.js` und `public/css/style.css` nachziehen
- Klickbare Kapitel-Sprungmarken im finalen Gesamt-PDF prüfen und umsetzen
- Ordnerrücken-Auto-Berechnung später mit echten PDF-Seitenzahlen über `pdf-lib` präzisieren
- Benutzerverwaltung weiter ausbauen: eigene Passwortänderung, optionale 2FA und Audit-Log prüfen
