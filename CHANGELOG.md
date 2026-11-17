# Changelog

## Geprüften Stand in main übernommen – 17.11.2026

- Geprüften Programmstand aus `gm/coolify-test-20261117` einschließlich Tests, Grafiken und Anwenderdokumentation zusammengeführt.
- README, Installationshinweise und Projektstatus auf `main` aktualisiert; historische Prüfstände erhalten.
- Keine privaten Laufzeitdateien oder lokalen Konfigurationsänderungen veröffentlicht. Bestehende Installationen, Konten, Projekte und historischer Altbestand bleiben erhalten.
- Die Repository-Übernahme ist keine Datenmigration und keine fachliche Freigabe unvollständiger Dokumentationen.

## Dokumentation und Online-Nachweis – 17.11.2026

- README auf einen schnellen Produktüberblick mit klar getrennten Anwender- und Betreiber-Einstiegen umgestellt.
- Bebilderte [Bedienungsanleitung](docs/BEDIENUNGSANLEITUNG.md) für den vollständigen Nutzerablauf ergänzt; keine Servereinrichtung in der Anwenderanleitung.
- Neue Aufnahmen ausschließlich mit künstlichen Testdaten; frühere Screenshots erhalten und datiert abgegrenzt.
- [Tatsächlichen Online-Prüfstand](docs/ONLINE_PRUEFSTAND.md) dokumentiert: HTTPS, SQLite, Anmeldung, Speichern/Wiederladen und PDF-/ZIP-Erzeugung; 15 fehlende PDF-Quellen im Testbestand ausdrücklich als unvollständigen Export abgegrenzt.
- Aktuelle Gesamttestzahlen und Bereitstellungsangaben in den technischen Anleitungen abgeglichen; historische Prüfstände erhalten.
- Reine Dokumentationspflege: keine Änderung von Anwendungscode, Konten, Projekten oder historischem Altbestand, keine neue Bereitstellung.

## Coolify-Testbetrieb – 17.11.2026

- Mehrstufiges Node-22-Abbild ohne Compiler in der Laufzeit; Python für Sicherungswerkzeuge erhalten. Direkter Node-Start und echter Healthcheck.
- Öffentliche Bereitschaftsprüfung `/ready` liest tatsächliche Datenbanktabellen und prüft Laufzeitordner und SQLite-Stufen.
- Optionaler eigener Erstzugang statt bekannter Demo-Konten bei Neuinstallation; bestehende Konten/Passwörter bleiben bei Neustart führend.
- Separate Coolify-Compose-Datei mit fünf Volumes, ohne feste Containernamen und öffentliche Host-Ports.
- Kompatible Sicherheitsaktualisierungen der gesperrten Abhängigkeiten; nach Korrektur 0 bekannte Paketlücken und erneut alle 109 Prüfungen erfolgreich.
- Sechs neue Deploymentfälle; 109 Prüfungen erfolgreich. Isolierte Container-Neuerstellung mit gleichen Datenbankzeilen und allen fünf Datenordnern geprüft.
- Einrichtung und Grenzen: [Coolify-Testbetrieb](docs/COOLIFY.md). Online-Abnahme ist vom lokalen Nachweis zu unterscheiden.

Dokumentierter Arbeitsstand: 06.11.2026, Paketversion `0.1.0-beta.1`. Datierte Einträge bewahren den jeweiligen damaligen Prüfstand; die aktuelle Gesamtsuite umfasst 109 Prüfungen. Lokale Aktivierung ist kein neuer Release-Tag.

## SQLite-Gerätetabellen – 06.11.2026

Nach Kopientests und ausdrücklicher Freigabe in der normalen lokalen Anwendung aktiviert; vollständige Sicherungen vor und nach Übernahme geprüft. Bestehende Konten, Passwortdaten, Projektinhalte und historische Dateien erhalten. 103 automatische Prüfungen, acht technische Projektkopienvergleiche mit 249 PDF-Seiten sowie lesende Prüfungen nach Aktivierung erfolgreich.

Gerätelisten und Positionen als projektgebundene Tabellen ergänzt. SQLite-Trigger halten die relationale Projektion und den vollständigen Datensatz atomar synchron; individuelle Felder und Reihenfolgen bleiben erhalten. Bestehende Installationen aktivieren die Stufe ausdrücklich nach Kopientests. Neue Installationen nutzen beide Stufen. Details: [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md).

## SQLite-Projektdaten – 06.11.2026

Projektbezogene strukturierte Daten schrittweise auf eine versionierte SQLite-Ablage umgestellt; vollständiger Erhalt der bisherigen Strukturen und JSON-Ausgangskopien. Transaktionales Speichern, Konflikterkennung, aktuelle Projektpakete und geprüfter Rückweg ergänzt. Details: [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md).

## Benutzerverwaltung – 06.11.2026

- Einheitliche Prüfung neuer Passwörter; bestehende Konten und Passwörter bleiben erhalten.
- Selbstregistrierung standardmäßig geschlossen und für Systemadmins steuerbar.
- Fehlende Konten und ungültige Rollen/Statuswerte melden Fehler; letzter aktiver Systemadmin geschützt.
- Verständliche Rollen ohne Berechtigungsänderung bestehender Konten; klare Dialogfelder, Escape und Tastaturfokus.
- 13 neue Prüfungen, insgesamt 75 erfolgreich. Details: [Benutzerverwaltung](docs/BENUTZERVERWALTUNG.md).

## Einheitliche Gestaltung – 03.11.2026

- Ruhige Standardfarben in Hell und Dunkel, einheitliche Navigation, Flächen, Formulare und Tabellen.
- Mobile Auswahlkarten und Archivformulare umbrechend; breite Tabellen scrollen im eigenen Bereich.
- Bestehende Standardthemes ohne Dateimigration lesend verfeinert; individuelle Werte bleiben erhalten. Dynamisch lesbare Schaltflächenbeschriftung auch bei eigenen Farben.
- Vier Theme-Prüfungen ergänzt. Beschreibung: [Gestaltung](docs/GESTALTUNG.md).

## Fehlende Brandschutzfotos – 03.11.2026

- Sichtbare Warnung mit Schottung und Fotofeld in Brandschutz, Dashboard und Export.
- Fehlende Dateiverweise stehen im PDF und im ZIP-Protokoll; sie verhindern einen vollständigen Exportstatus, ohne PDF-Datei-/Seitenzähler zu verändern.
- Optionale leere Felder und inaktive Schottungen erzeugen keine Fehlwarnung; vorhandene Daten werden nicht migriert.
- Sechs Regressionstests ergänzt, insgesamt 58 Prüfungen. Anleitung: [Brandschutzfotos](docs/BRANDSCHUTZFOTOS.md).

## Lokaler Beta-Betrieb – 30.10.2026

- Sicherheitsprotokoll für kritische Verwaltungsaktionen mit Versuchs-/Ergebnisdatensätzen, Hash-Verkettung und Systemadmin-Ansicht; keine Formularinhalte oder Zugangsdaten.
- Vollsicherung aller fünf Laufzeitordner einschließlich SQLite, Einstellungen, Medien, Ausgaben und historischem Bestand; Docker-Abbild inklusive. Wiederherstellung ausschließlich in einen neuen Ordner und mit Prüfsummenprüfung.
- Formular-Sicherheitstoken werden nach der Prüfung entfernt, bevor allgemeine Projektformulare gespeichert werden. Bestehende Dateien werden nicht migriert.
- Reproduzierbares Node-22-Abbild mit `npm ci`; GitHub-Prüfung und 52 automatische Tests einschließlich vollständigem PDF-/ZIP-/Archiv-Ablauf.
- Betriebsanleitung: [BETA_BETRIEB.md](docs/BETA_BETRIEB.md).

Alle relevanten Änderungen an `edoku` werden hier dokumentiert.

Das Format orientiert sich an Keep a Changelog. Die Versionierung folgt semantischen Versionen mit Beta-Suffix, solange die Anwendung noch nicht produktionsreif freigegeben ist.

## Unreleased

### Sicherheit und Projektarchive

- Archivdownloads auf eigene Manifest-/ZIP-Dateien begrenzt; Datei- und Symlinkgrenzen für Vorschauen, Anhänge und Pakete ergänzt.
- Ausgabeablage von sichtbaren Namen auf stabile Benutzer-/Projektkennungen umgestellt; Altbestände bleiben unverändert und eindeutig zuordenbare Dateien lesbar. Gemeinsame Alt-Ausgaben bleiben auf Benutzerwunsch separat historisch erhalten.
- Signierte CSRF-Tokens für Formulare, Auto-Save und Uploads; Login-/Registrierungsbegrenzung und Systemadmin-Grenzen für globale Änderungen.
- Atomare JSON-Speicherung und Fehlerweitergabe; vorherige PDFs/fertige Exporte sowie entfernte Anhänge bleiben in privaten Rückfallebenen erhalten.
- Echte Streaming-ZIPs und Paketformat 2.0 mit Prüfsummen, tatsächlichen Anhängen und sicheren Rückimporten ohne Überschreiben vorhandener Projekte.
- Alte Exportindizes bleiben als passive Begleitmetadaten erhalten; fehlende ursprüngliche Quellen werden ausdrücklich dokumentiert.
- 17 zusätzliche Sicherheits-/Archivprüfungen; insgesamt 38 erfolgreich. Alle acht nicht gelöschten Projekte in einer echten Datenkopie erfolgreich exportiert und rückimportiert, ursprüngliche Dateien und bestehende Datenbankzeilen unverändert.
- Anleitungen zu Zugriffsschutz, Archivformat und Wiederherstellung ergänzt.

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
