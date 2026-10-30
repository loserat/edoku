# Offene Punkte edoku

Stand: 2026-10-30

Diese Datei sammelt offene Aufgaben, bekannte Beta-Einschränkungen und sinnvolle nächste Schritte. Sie dient als gemeinsame Arbeitsliste, damit Punkte aus Tests, GUI-Feedback und Exportprüfungen nicht im Chat verloren gehen.

## Priorität A: Für eine belastbare Beta wichtig

### Datenzugriff und zuverlässiges Speichern absichern

Status: umgesetzt und getestet am 30.10.2026

- Archivdownloads sind auf Manifest/ZIP des eigenen Benutzerprojekts beschränkt; Pfad- und Symlinkprüfungen greifen serverseitig.
- Neue Ausgaben liegen unter stabilen Benutzer-/Projektkennungen. Gemeinsam genutzte Alt-Ausgaben bleiben entsprechend der Benutzerentscheidung separat historisch erhalten.
- JSON-Speicherung erfolgt atomar je Datei; Fehler werden bis zur Oberfläche weitergereicht. Beschädigte bestehende Dateien werden nicht still durch leere Werte ersetzt.
- Projektpakete erfassen die tatsächliche Anhangsablage und erstellen echte ZIPs mit Dateiinventar und Prüfsummen. Rückimporte prüfen Kopien und setzen Zielpfade um, ohne bestehende Projekte zu überschreiben.
- Fehlende ursprüngliche Quelldateien und ausgelassene historische Bereiche werden ausdrücklich als Hinweise dokumentiert.
- PDF-Vorgänger und letzte fertige Exporte bleiben erhalten; fehlerhafte finale Ausgaben ersetzen keine fertige Dokumentation.
- Start-/Seitenaufrufe erhalten bestehende Konten und Projektdaten.

Details: [SICHERHEIT.md](SICHERHEIT.md), [PROJEKTARCHIVE.md](PROJEKTARCHIVE.md).
Vollsicherung und getrennte Wiederherstellung sind umgesetzt, siehe [BETA_BETRIEB.md](BETA_BETRIEB.md). Eine zusätzliche externe Sicherung und regelmäßige Wiederherstellungsproben bleiben Betriebsaufgaben.

### PDF-Gesamtdokumentation final prüfen

Status: teilweise erledigt

Die Einzel-PDFs werden erzeugt, die finale Gesamtlogik muss aber im Praxistest weiter geprüft werden. Wichtig sind insbesondere Reihenfolge, Kapitelnummerierung, Deckblätter, Inhaltsverzeichnis, importierte PDF-Anhänge und verknüpfte Bedienungsanleitungen.

Erledigt:

- Doppelte Original-Kapitelnummern erzeugen keine doppelten Anzeige-Kapitel mehr.
- Importierte PDF-Anhänge erhalten ihre Elternkapitel im Inhaltsverzeichnisbaum.

Prüfen:

- Sind alle gewählten Leistungsbereiche im Inhaltsverzeichnis enthalten?
- Tauchen nur vorhandene beziehungsweise aktiv erzeugte Dokumente auf?
- Werden Anhänge an der richtigen Stelle einsortiert?
- Stimmen Dateinamen, Kapitelnummern und sichtbare Titel überein?
- Werden Bedienungsanleitungen mit Bezug zur Geräteposition korrekt aufgeführt?

### Klickbares Inhaltsverzeichnis im Gesamt-PDF

Status: umgesetzt und mit Prüfprojekten getestet; Abnahme mit realen Projektdaten offen

Das Inhaltsverzeichnis enthält jetzt klickbare Einträge, die im zusammengeführten Gesamt-PDF direkt zum passenden Kapitel springen. Das ist vor allem wichtig, sobald importierte PDF-Dateien, Bedienungsanleitungen und längere Anhänge eingebunden werden.

Wichtig:

- Sprungmarken müssen im finalen Gesamt-PDF gesetzt werden.
- Seitenzahlen müssen nach dem Einfügen externer PDFs korrekt berechnet werden.
- Importierte PDFs können mehrere Seiten haben; diese Seitenanzahl muss berücksichtigt werden.
- Technisch geprüft: tatsächliche Startseiten und gemessene Linkflächen auch bei mehrseitigem Inhaltsverzeichnis.

### PDF-Merge und importierte PDFs

Status: umgesetzt und mit Prüfprojekten getestet; Abnahme mit realen Projektdaten offen

Importierte PDFs sollen nicht nur in der Matrix und im Inhaltsverzeichnis auftauchen, sondern an der richtigen Stelle in die finale Dokumentation eingefügt werden.

Prüfen:

- Stromlaufpläne nach Stockwerk sortieren.
- Schaltpläne, Installationspläne, Schemata und Messprotokolle nach Stockwerk beziehungsweise Kategorie sortieren.
- Bedienungsanleitungen nach verknüpfter Geräteposition einsortieren.
- Externe PDFs mit korrekter Seitenanzahl übernehmen.

### ZIP-Export mit Ordnerstruktur

Status: umgesetzt und mit Prüfprojekten getestet; Abnahme mit realen Projektdaten offen

Neben PDF-Ausgaben soll ein ZIP-Export erzeugt werden, der eine einfache Ordnerstruktur passend zum Inhaltsverzeichnis enthält. Ziel ist eine saubere Übergabe der Dokumentation ohne zu viele Unterordner.

Umgesetzt, mit Prüfprojekten getestet:

- Ordnerstruktur aus aktiven Exportkapiteln ableiten.
- Erzeugte PDFs und importierte Anhänge einsortieren.
- Dateinamen nach Kapitelnummer und Titel aufbauen.
- ZIP-Datei im Exportbereich bereitstellen.

### Rechte- und Benutzerverwaltung härten

Status: zentrale Grenzen umgesetzt und automatisiert geprüft; weitere Abdeckung offen

Das Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin` ist vorhanden. Für produktivere Nutzung muss die Rechteprüfung weiter systematisch getestet und gehärtet werden.

Prüfen:

- Viewer darf keine Schreibzugriffe ausführen.
- User sieht nur eigene Projekte.
- Admin/Systemadmin-Funktionen sind korrekt begrenzt.
- Gesperrte Benutzer können sich nicht anmelden.
- Passwortänderungen beenden alte Sessions.

## Priorität B: Fachliche Funktionen weiter ausbauen

### Liegenschaften und Gebäude

Status: offen

Für größere Objekte reicht die reine Stockwerksliste langfristig nicht aus. Es soll ein eigener Bereich `Liegenschaften` mit Unterpunkt `Gebäude` vorbereitet werden. Darüber können später Gebäude, Gebäudeteile und Zuordnungen für Pläne und Brandschutz sauberer gepflegt werden.

Geplant:

- Navigation und Route für `Liegenschaften > Gebäude` additiv ergänzen.
- Zunächst eine einfache Verwaltungsansicht ohne bestehende Projektlogik umzubauen.
- Spätere Datenstruktur für Gebäude neutral vorbereiten.
- Gebäude später für Pläne und Brandschutz nutzbar machen.
- Keine vorhandenen Projekt-, Anhangs- oder Exportdaten automatisch migrieren.

### Anhänge-Verwaltung finalisieren

Status: teilweise erledigt

Anhänge sind kategoriebezogen aufgebaut und werden als Kacheln angezeigt. Das Bearbeiten erfolgt über Popup-Fenster. Die Zuordnung zu Brandschottungen ist verbessert, muss aber im Detail weiter getestet werden.

Erledigt:

- Brandschutzbilder dürfen je Brandschottung nur einen Foto-1- und einen Foto-2-Slot belegen.
- Bereits belegte Brandschutz-Foto-Slots werden in der Auswahl nicht mehr angeboten.
- Die Slot-Belegung wird zusätzlich serverseitig geprüft.

Offen:

- Mehrfachimport in allen Kategorien sauber testen.
- Dateinamen beim Bearbeiten des Titels weiter prüfen.
- Vorschau für Bilder und PDFs in Popups final prüfen.
- Bedienungsanleitungen sauber mit Gerätepositionen verknüpfen.

### Bedienungsanleitungen je Gerät

Status: teilweise vorhanden

Gerätepositionen können künftig optional eine Bedienungsanleitung erhalten. Diese Bedienungsanleitung soll im Inhaltsverzeichnis unter Bedienungsanleitungen auftauchen und in der Geräteliste mit Kapitelverweis referenziert werden.

Offen:

- Upload/Zuordnung aus der Geräteliste weiter verfeinern.
- Kapitelverweis in der exportierten Geräteliste final prüfen.
- Importierte Bedienungsanleitungs-PDFs im Gesamt-PDF korrekt einsortieren.
- Brandschutzgerätelisten bleiben von dieser Funktion ausgenommen.

### Gerätelisten-Vorlagen

Status: teilweise vorhanden

Gerätelisten können als systemweite Vorlage gespeichert und später in andere Projekte geladen werden.

Offen:

- Verwaltung unter `System > Gerätelisten` weiter optisch verbessern.
- Bearbeitung von Vorlagen in einem Popup weiter ausbauen.
- Beim Laden klar anzeigen, dass bestehende Positionen ersetzt werden.
- Vorlagen fachlich je Leistungsbereich sauber kategorisieren.

### Leistungsbereiche und Formularvorgaben

Status: teilweise vorhanden

Leistungsbereiche können systemweit gepflegt und in Projekten ausgewählt werden. Formulare je Leistungsbereich sollen direkt in den aufgeklappten Leistungsbereichsdetails gepflegt werden.

Offen:

- Formulargenerator je Leistungsbereich weiter aufräumen.
- Konformitätserklärungen, CE-Bestätigungen, DGUV-Bestätigungen und Errichterbestätigungen je Leistungsbereich vordefinieren.
- Fachliche Normtexte weiter prüfen.
- Klären, welche Dokumente bei Auswahl eines Leistungsbereiches automatisch erzeugt werden sollen.

### Normen und Formulartexte fachlich prüfen

Status: offen

Die vorhandenen Texte sind Arbeitsgrundlage und müssen fachlich weiter geprüft werden. Besonderes Augenmerk liegt auf Konformitäts- und Errichterbestätigungen.

Zu prüfen:

- DIN VDE 0100
- DIN EN 1838
- ASR A3.4 und DIN EN 12464
- DIN 14675
- DIN VDE 0833
- DIN EN 54
- DIN VDE 0100-410
- DIN VDE 0100-540
- DIN 18014
- DIN EN 50173
- DIN EN 50174
- Kabeltragsysteme mit und ohne Funktionserhalt

## Priorität C: Export und Druckvorlagen

### Ordnerrücken final testen

Status: teilweise vorhanden

Ordnerrücken für Avery-Zweckform `61x192-R` und `38x192-R` sind vorhanden. Die Kalibrierungsbögen wurden berücksichtigt.

Offen:

- Ausdruck real prüfen.
- Textrichtung je Ablageart final festlegen.
- Zentrierung auf echten Avery-Bögen prüfen.
- Projektkenndaten auf Lesbarkeit prüfen.
- Seitenbasierte Ablageschätzung (umgesetzt und automatisiert geprüft) mit tatsächlicher Ordnerkapazität und Druckmodus praktisch abgleichen.

### Trennstreifen final prüfen

Status: teilweise vorhanden

Trennstreifen werden separat erzeugt, Deckblätter sollen immer Teil der Dokumentation bleiben.

Offen:

- Druckmaß 24 x 10,5 cm real prüfen.
- Registertitel und Innentext-Optionen weiter testen.
- Tintensparende Ausgabe ohne große Farbflächen beibehalten.
- Keine Branding-Logos auf Trennstreifen verwenden.

### Deckblätter

Status: teilweise vorhanden

Deckblätter für Hauptkategorien sollen bei der PDF-Dokumentation immer mit erzeugt werden.

Offen:

- Layout prüfen.
- Kapitelnummern und Titel prüfen.
- Einheitlichen Dokumentkopf beibehalten.

## Priorität D: GUI und Bedienbarkeit

### Theme-System finalisieren

Status: teilweise erledigt

Dark/Light und Theme-Presets sind vorhanden. Die GUI soll weiterhin ruhiger, konsistenter und weniger sprunghaft wirken.

Erledigt:

- Standard-, Sekundär-, Speichern- und Löschen-Buttons wurden zentral beruhigt.
- Starke metallische Verläufe wurden aus den zentralen Button-Regeln entfernt.
- PDF-Aktionsbuttons im Exportbereich wurden kompakter gesetzt.
- GitHub-orientierte Presets ergänzt: Light/Dark Default, High Contrast, Colorblind und Dark Dimmed.
- Theme-Editor auf die wichtigsten Werte reduziert.
- Gemeinsame Seitenköpfe, Kennzahlenkarten, Authentifizierungsansichten und sechs CSS-Fachdateien umgesetzt.
- App-Icon, Favicon und Startbildschirmvarianten vereinheitlicht.

Offen:

- Buttonfarben und Größen in Light/Dark im Browser final prüfen.
- Löschen-Buttons einheitlich mit Papierkorb-Icon und roter Warnwirkung.
- Vorschau-Buttons kompakt und neutral halten.
- Radien und Abstände in allen Themes stabil halten.
- Farben an GitHub-/VS-Code-Themes orientieren.

### Responsive Layout prüfen

Status: offen

Die Oberfläche soll auf verschiedenen Bildschirmgrößen stabil nutzbar sein.

Prüfen:

- Header verschiebt sich nicht bei breiten Tabellen.
- Tabellen scrollen horizontal innerhalb ihres Containers.
- Seiten ohne Sidebar nutzen die volle Breite sinnvoll.
- Popups bleiben bedienbar und zeigen wichtige Aktionsleisten sichtbar.
- Linkes Labor-Icon bleibt unten links sichtbar und stört keine Inhalte.

### Exportbereich weiter glätten

Status: teilweise erledigt

Der Exportbereich ist in Untertabs gegliedert: PDF-Dokumentation, PDF-Trennstreifen, ZIP-Export, Matrix, Ordnerrücken und Exporteinstellungen.

Erledigt:

- PDF-Dokumentationsbaum ist links als scrollbarer Inhaltsbaum umgesetzt.
- Baumlinien und Ein-/Ausklapp-Icons sind vorhanden.
- Vorschau-Dateien können aus dem Inhaltsbaum gewählt werden.
- Generieren-Buttons wurden kompakter gesetzt.

Offen:

- Inhaltsbaum im Browser mit echten Projektdaten visuell prüfen.
- Prüfen, ob die Baumstruktur alle später gemergten Dokumente exakt abbildet.

### Benutzerverwaltung optisch verbessern

Status: teilweise erledigt

Die Benutzerverwaltung wurde verdichtet, kann aber weiter optimiert werden.

Erledigt:

- Bearbeitung erfolgt über Popup statt über viele Inline-Aktionen.
- Rollen, Status und Passwortänderung sind im Popup gruppiert.
- Lange Logins und Projektnamen werden in der Tabelle gekürzt.

Offen:

- Benutzerverwaltung in Light/Dark visuell prüfen.
- Optional weitere Verdichtung für sehr kleine Bildschirme.

### Projektbereich und Archiv

Status: teilweise vorhanden

Projektübersicht und Archiv wurden in den Projektmanager verschoben.

Offen:

- Archiv links unter Projektmanager weiter verdichten.
- Projektübersicht nur auf aktuelles Projekt und Mini-Dashboard fokussieren.
- Projektwechsel und Projektstatus weiter visuell prüfen.

## Priorität E: Dokumentation, Tests und Release

### API-Grundgerüst härten

Status: teilweise erledigt

Das API-Grundgerüst unter `/api/*` ist vorhanden und nutzt neutrale Demo-Daten. Es ersetzt die bestehende App nicht, sondern liegt additiv daneben.

Erledigt:

- Healthcheck, Projekte, Leistungsbereiche, Gerätelisten, Dokumente und Exportstatus als GET-Endpunkte vorhanden.
- Einheitliches Erfolgs- und Fehlerformat.
- JSON-404 fuer unbekannte API-Routen und unbekannte IDs.
- API-Dokumentation in `docs/API.md`.

Offen:

- Spätere echte Projektdaten nur kontrolliert anbinden.
- Rechte-/Session-Prüfung für produktive API-Nutzung planen.
- Keine Schreibendpunkte freischalten, bevor Zugriffskonzept und Validierung sauber definiert sind.

### Produktive Sicherheit

Status: offen

Die Anwendung ist als Beta vorbereitet, aber noch nicht als bezahltes produktives SaaS-Angebot gehärtet.

Offen:

- Rechteprüfung über die bereits automatisierten Kernfälle hinaus erweitern.
- Weitere Browser-/Proxy-Konstellationen für den umgesetzten CSRF-Schutz prüfen.
- Verteilte Rate-Limits und spätere produktive API-Nutzung planen; Login-/Registrierungsgrenzen je Prozess sind umgesetzt.
- Sichere Produktions-ENV dokumentieren.
- Externe Aufbewahrung und regelmäßige Proben für das vorhandene Vollsicherungs-/Wiederherstellungswerkzeug einrichten.
- Zentrale Ablage außerhalb des Anwendungsrechners sowie Rotation des vorhandenen lokalen Sicherheitsprotokolls planen.

### Better Comments

Status: offen

Der Code soll später weiter mit Better-Comments-kompatiblen deutschen Kommentaren ergänzt werden.

Tags:

- `// ! WICHTIG:`
- `// ? WARUM:`
- `// TODO:`
- `// * INFO:`
- `// FIXME:`

### Tests

Status: gezielte Export- und Datenerhalt-Prüfungen vorhanden; weitere Abdeckung offen

18 gezielte Kapitel-/Exporttests sind über `npm run test:exports` vorhanden,
drei weitere Datenerhalt-Prüfungen über `npm run test:preservation`.
Weitere 17 Sicherheits-/Archivprüfungen sind über `npm run test:security` vorhanden.
Zusätzlich bestehen fünf Protokolltests, acht Sicherungstests und ein vollständiger HTTP-Ablauf. Alle 52 Prüfungen sind im Node-22-Abbild erfolgreich; GitHub Actions führt sie automatisch aus.
In einer echten Datenkopie wurden alle acht nicht gelöschten Projekte exportiert und unter neuer Kennung rückimportiert; bestehende Projektdateien und Datenbankzeilen blieben unverändert.
Anleitung, Prüfumfang und Grenzen stehen in [TESTS.md](TESTS.md).
Eine vollständige Test-Suite für alle Fachbereiche fehlt weiterhin.

Manuelle Tests:

- Docker-Start
- Login/Logout
- Rollenrechte
- Projektwechsel
- Projektanlage
- Leistungsbereiche abwählen mit Bestätigung
- Gerätelisten bearbeiten
- Brandschutz bearbeiten
- Anhänge importieren, bearbeiten und löschen
- Brandschutzbilder zuordnen
- PDF-Dokumentation erzeugen
- Trennstreifen erzeugen
- Ordnerrücken erzeugen
- ZIP-Export erzeugen

### GitHub-Auftritt

Status: teilweise vorhanden

README, technische Doku, Release Notes und Projektupdate sind vorhanden. Der GitHub-Auftritt soll für Beta-Tester verständlich bleiben.

Erledigt:

- `CHANGELOG.md` angelegt.
- `docs/REPO_SICHERHEITSCHECK.md` ergänzt.
- README, Release Notes, technische Doku und Arbeitsstand auf den 30.10.2026 aktualisiert.
- Beta-Prüfanleitung sowie lokales Update-/Sicherungsvorgehen ergänzt.
- Fünf Screenshots mit künstlichen Beispieldaten aus einer getrennten Demo-Installation im README eingebunden.

Offen:

- Screenshots bei größeren Oberflächenänderungen erneuern und ausschließlich neutrale Daten verwenden.
- Bekannte Einschränkungen aktuell halten.
- Release-Tags sauber pflegen.
- Installationshinweise für Docker/Coolify weiter ausbauen.

### Produktive Bereitstellung

Status: offen

Coolify/GitHub-Deployment ist grundsätzlich möglich, muss aber sauber dokumentiert und getestet werden.

Offen:

- Reverse Proxy korrekt konfigurieren.
- Persistente Volumes für `storage`, `data`, `config`, `output` und `templates` prüfen.
- Umgebungsvariablen für Produktion definieren.
- Default-Zugänge nach Installation ändern.
- Backups für `storage/app.db` und projektbezogene Dateien planen.
