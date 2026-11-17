# Offene Punkte edoku

Stand: 17.11.2026

Diese Datei sammelt offene Aufgaben, bekannte Beta-Einschränkungen und sinnvolle nächste Schritte. Sie dient als gemeinsame Arbeitsliste, damit Punkte aus Tests, GUI-Feedback und Exportprüfungen nicht im Chat verloren gehen.

## Bereits umgesetzt, weitere Abnahme getrennt

SQLite-Stufen 1 und 2, korrigierte Benutzerverwaltung, Fotowarnungen und die ruhige technische Gestaltung sind umgesetzt und in der normalen lokalen Anwendung aktiviert. 109 automatisierte Prüfungen sowie technische Exportvergleiche mit acht bestehenden Projektkopien sind erfolgreich. Die lokale Aktivierung und der Datenerhalt wurden geprüft. Zusätzlich ist der getrennte Online-Testbetrieb technisch verifiziert; fachliche Freigabe, Druckabnahme und vollständige Betriebsabnahme bleiben offen. Details: [Aktueller Stand](AKTUELLER_STAND.md).

## Priorität A: Für eine belastbare Beta wichtig

### SQLite weiter ausbauen

Status: Stufen 1 und 2 umgesetzt, auf Kopien geprüft und lokal aktiviert; weitere Normalisierung offen

- Neun vollständige Projektdatensätze sind führend in SQLite gespeichert.
- Gerätelisten/Positionen sind zusätzliche, durch Trigger atomar synchronisierte Tabellen. Die vollständigen Datensätze bleiben führend.
- Originale JSON-Ausgangskopien, Konten und historische Dateien sind erhalten; aktueller Export/Rückimport und Rückweg wurden geprüft.
- Offen: gezielte führende Speicherung einzelner Gerätefelder planen; weitere Bereiche wie Brandschutz-/Anhangsmetadaten nur nach gesondertem Entwurf und Kopientests normalisieren. Sie liegen schon jetzt in SQLite, aber noch als vollständige Datensätze.

Details: [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md).

### Fehlende Unterlagen und Brandschutzfotos

Status: Warnlücke behoben; tatsächliche fachliche Quelllücken weiterhin offen

Fehlende aktive Fotodateien werden in Fachseite, Dashboard, Export und Ausgabedokumentation gemeldet. Der Export gilt dadurch nicht als vollständig. Die fehlenden Bilder, Logos oder Nachweise müssen fachlich nachgeliefert und verantwortlich zugeordnet werden; historische Daten werden nicht automatisch bereinigt.

### Externe Sicherung und regelmäßige Proben

Status: lokale Vollsicherung und getrennte Wiederherstellung umgesetzt; externe Betriebsorganisation offen

Zusätzlichen Datenträger/Zielort, Schutz vertraulicher Sicherungen, Aufbewahrung und regelmäßige Wiederherstellungsproben festlegen. Vorhandene Sicherungen und historische Bestände nicht im Rahmen allgemeiner Cache-Bereinigung löschen.


### Datenzugriff und zuverlässiges Speichern absichern

Status: umgesetzt und erweitert geprüft bis 06.11.2026

- Archivdownloads sind auf Manifest/ZIP des eigenen Benutzerprojekts beschränkt; Pfad- und Symlinkprüfungen greifen serverseitig.
- Neue Ausgaben liegen unter stabilen Benutzer-/Projektkennungen. Gemeinsam genutzte Alt-Ausgaben bleiben entsprechend der Benutzerentscheidung separat historisch erhalten.
- Aktivierte Projektdaten werden gemeinsam in SQLite gespeichert; Projektversionen erkennen veraltete Änderungen. Übrige JSON-Dateien werden atomar ersetzt. Fehler werden nicht still als leere Daten übernommen.
- Projektpakete erfassen die tatsächliche Anhangsablage und erstellen echte ZIPs mit Dateiinventar und Prüfsummen. Rückimporte prüfen Kopien und setzen Zielpfade um, ohne bestehende Projekte zu überschreiben.
- Fehlende ursprüngliche Quelldateien und ausgelassene historische Bereiche werden ausdrücklich als Hinweise dokumentiert.
- PDF-Vorgänger und letzte fertige Exporte bleiben erhalten; fehlerhafte finale Ausgaben ersetzen keine fertige Dokumentation.
- Start-/Seitenaufrufe erhalten bestehende Konten und Projektdaten.

Details: [SICHERHEIT.md](SICHERHEIT.md), [PROJEKTARCHIVE.md](PROJEKTARCHIVE.md).
Vollsicherung und getrennte Wiederherstellung sind umgesetzt, siehe [BETA_BETRIEB.md](BETA_BETRIEB.md). Eine zusätzliche externe Sicherung und regelmäßige Wiederherstellungsproben bleiben Betriebsaufgaben.

### PDF-Gesamtdokumentation final prüfen

Status: teilweise erledigt

Die Gesamtlogik ist automatisiert und mit bestehenden Projektkopien technisch geprüft; der konkrete fachliche Inhalt und zusätzliche reale Fremd-PDFs müssen im Praxistest weiter geprüft werden. Wichtig sind insbesondere Reihenfolge, Kapitelnummerierung, Deckblätter, Inhaltsverzeichnis, importierte PDF-Anhänge und verknüpfte Bedienungsanleitungen.

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

Status: automatisiert und technisch auf bestehenden Projektkopien geprüft; fachliche bzw. physische Abnahme offen

Das Inhaltsverzeichnis enthält jetzt klickbare Einträge, die im zusammengeführten Gesamt-PDF direkt zum passenden Kapitel springen. Das ist vor allem wichtig, sobald importierte PDF-Dateien, Bedienungsanleitungen und längere Anhänge eingebunden werden.

Wichtig:

- Sprungmarken müssen im finalen Gesamt-PDF gesetzt werden.
- Seitenzahlen müssen nach dem Einfügen externer PDFs korrekt berechnet werden.
- Importierte PDFs können mehrere Seiten haben; diese Seitenanzahl muss berücksichtigt werden.
- Technisch geprüft: tatsächliche Startseiten und gemessene Linkflächen auch bei mehrseitigem Inhaltsverzeichnis.

### PDF-Merge und importierte PDFs

Status: automatisiert und technisch auf bestehenden Projektkopien geprüft; fachliche bzw. physische Abnahme offen

Importierte PDFs sollen nicht nur in der Matrix und im Inhaltsverzeichnis auftauchen, sondern an der richtigen Stelle in die finale Dokumentation eingefügt werden.

Prüfen:

- Stromlaufpläne nach Stockwerk sortieren.
- Schaltpläne, Installationspläne, Schemata und Messprotokolle nach Stockwerk beziehungsweise Kategorie sortieren.
- Bedienungsanleitungen nach verknüpfter Geräteposition einsortieren.
- Externe PDFs mit korrekter Seitenanzahl übernehmen.

### ZIP-Export mit Ordnerstruktur

Status: automatisiert und technisch auf bestehenden Projektkopien geprüft; fachliche bzw. physische Abnahme offen

Neben PDF-Ausgaben soll ein ZIP-Export erzeugt werden, der eine einfache Ordnerstruktur passend zum Inhaltsverzeichnis enthält. Ziel ist eine saubere Übergabe der Dokumentation ohne zu viele Unterordner.

Umgesetzt, mit Prüfprojekten getestet:

- Ordnerstruktur aus aktiven Exportkapiteln ableiten.
- Erzeugte PDFs und importierte Anhänge einsortieren.
- Dateinamen nach Kapitelnummer und Titel aufbauen.
- ZIP-Datei im Exportbereich bereitstellen.

### Rechte- und Benutzerverwaltung weiterführen

Status: bisherige offene Kernpunkte behoben und mit Testkonten geprüft; weitere Funktionen offen

Erledigt: geschlossene Selbstregistrierung als Standard, einheitliche neue Passwortregeln, Erhalt alter Passwörter, klare Rollen, Kontofehler, Schutz des letzten aktiven Systemadmins, Sperren/Reaktivieren, Sitzungsentzug und serverseitige Schreibgrenzen. Details: [Benutzerverwaltung](BENUTZERVERWALTUNG.md).

Offen:

- Eigener Passwortwechsel für Benutzer.
- Verpflichtender Passwortwechsel nach Admin-Reset, sofern fachlich/organisatorisch gewünscht.
- Zusätzliche Kontoschutzfunktionen wie 2FA zunächst planen und gesondert testen.
- Rechte-/Proxy-/Browserfälle über die vorhandenen Tests hinaus erweitern; keine automatische Änderung bestehender Konten.

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

Gerätepositionen können optional eine importierte Bedienungsanleitung erhalten. Diese Bedienungsanleitung soll im Inhaltsverzeichnis unter Bedienungsanleitungen auftauchen und in der Geräteliste mit Kapitelverweis referenziert werden.

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

Dark/Light, ruhige Standardpaletten und konsistente Formular-/Tabellenflächen sind umgesetzt. Eigene Farbwerte bleiben erhalten. Weitere Themes, Browser und lange Inhalte bleiben zu prüfen.

Erledigt:

- Standard-, Sekundär-, Speichern- und Löschen-Buttons wurden zentral beruhigt.
- Starke metallische Verläufe wurden aus den zentralen Button-Regeln entfernt.
- PDF-Aktionsbuttons im Exportbereich wurden kompakter gesetzt.
- GitHub-orientierte Presets ergänzt: Light/Dark Default, High Contrast, Colorblind und Dark Dimmed.
- Theme-Editor auf die wichtigsten Werte reduziert.
- Gemeinsame Seitenköpfe, Kennzahlenkarten, Authentifizierungsansichten und sechs CSS-Fachdateien umgesetzt.
- App-Icon, Favicon und Startbildschirmvarianten vereinheitlicht.

Offen:

- Kontraste und Größen bei neuen Komponenten oder zusätzlichen individuellen Farbkombinationen erneut prüfen.
- Löschen-Buttons einheitlich mit Papierkorb-Icon und roter Warnwirkung.
- Vorschau-Buttons kompakt und neutral halten.
- Radien und Abstände in allen Themes stabil halten.
- Weitere Presets bei Erweiterungen mit dem bestehenden ruhigen Farbsystem abgleichen.

### Responsive Layout weiter prüfen

Status: bearbeitete Seiten und Dialoge im dokumentierten Raster geprüft; weitere Browser/Geräte offen

Die Oberfläche soll auf verschiedenen Bildschirmgrößen stabil nutzbar sein.

Bei weiteren Änderungen erneut prüfen:

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

### Benutzerverwaltung weiter visuell prüfen

Status: überarbeitet und für das dokumentierte Raster geprüft; vollständige Barrierefreiheit offen

Rollenbeschriftungen, Dialogfelder, Fokusführung, Escape/Schließen, Fokus-Rückgabe und interne Scrollbarkeit sind umgesetzt. Benutzerliste und Dialog wurden bei 320, 390, 768 und 1280 Pixeln in Hell/Dunkel geprüft. Weitere lange Inhalte, Browser und Barrierefreiheitsfälle bleiben prüfenswert.

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
- Dokumentierte HTTPS-/Proxy-/Erstzugangsvariablen bei jeder Installation passend konfigurieren und prüfen; siehe [Coolify](COOLIFY.md).
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

Status: 109 automatisierte Prüfungen und technische Vergleiche bestehender Projektkopien erfolgreich; weitere Abdeckung offen

101 Node.js- und acht Python-Prüfungen decken die dokumentierten Kernfälle ab. Acht bestehende Projektkopien lieferten vor/nach Geräteumstellung gleiche Kapitel, Exportpositionen, Fotowarnungen und 249 tatsächliche PDF-Seiten; ZIPs und Rückimporte wurden geprüft. Die normale lokale Aktivierung wurde auf Datenerhalt, Lesbarkeit und Erreichbarkeit geprüft.

Anleitung und Grenzen: [Tests](TESTS.md). Die GitHub-Prüfungen des Pull Requests und des tatsächlichen main-Merge-Commits `4b4caaa` waren am 17.11.2026 erfolgreich: [109 bestandene Prüfungen](https://github.com/loserat/edoku/actions/runs/44144405963). Vollständiger [Tagesabschluss](TAGESABSCHLUSS_2026-11-17.md). Zusätzliche Fachfälle, beliebige externe PDFs, Browser, physische Druckausgaben und Betriebsabnahme bleiben offen.

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

Status: README und bebilderte Anwenderanleitung aktualisiert; weitere Pflege laufend

README, technische Doku, Release Notes und Projektupdate sind vorhanden. Der GitHub-Auftritt soll für Beta-Tester verständlich bleiben.

Erledigt:

- `CHANGELOG.md` angelegt.
- `docs/REPO_SICHERHEITSCHECK.md` ergänzt.
- README, Installation, Technik, Betrieb, SQLite, Tests, Release Notes und Arbeitsliste auf den Arbeitsstand 06.11.2026 aktualisiert; zentrale Dokumentationsübersicht ergänzt.
- Beta-Prüfanleitung sowie lokales Update-/Sicherungsvorgehen ergänzt.
- README neu gegliedert und [Anwender-Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) mit 16 aktuellen Screenshots eines künstlichen Testprojekts ergänzt. Installation und Serverbetrieb bleiben getrennt.
- Tatsächlichen [Online-Prüfstand](ONLINE_PRUEFSTAND.md) einschließlich unvollständigem Export dokumentiert; historische Screenshotserie erhalten.
- Gesamttestzahlen und technische Anleitungen auf den Stand 17.11.2026 abgeglichen.

Offen:

- Screenshots bei größeren Oberflächenänderungen erneuern und ausschließlich neutrale Daten verwenden.
- Bekannte Einschränkungen aktuell halten.
- Release-Tags sauber pflegen.
- Installationshinweise bei geänderten Bereitstellungswegen erneut prüfen.

### Online-Testbetrieb und produktive Bereitstellung

Status: benannte Online-Testinstanz technisch geprüft; produktive Betriebsabnahme offen

Erledigt am 17.11.2026: Dockerfile-Build, gültiges HTTPS, HTTP-Weiterleitung, fünf persistente Volumes, passende Laufzeitvariablen, eigener Erstzugang ohne Demo-Konten und echte SQLite-Bereitschaft. Anmeldung, Projekt-/Geräteänderungen, Wiederladen und PDF-/ZIP-Erzeugung geprüft. Gespeicherter Testbestand überstand den Containerwechsel. [Einrichtung](COOLIFY.md), [Prüfumfang](ONLINE_PRUEFSTAND.md).

Offen:

- Den konkreten Online-Download unabhängig auf Dateiinhalte und Seiten prüfen; die Browserfreigabe wurde in der bisherigen Runde abgelehnt.
- Fachliche Quelllücken im Testprojekt beziehungsweise tatsächlichen Projekten klären; bereitstehende Dateien sind kein vollständiger Dokumentationsabschluss.
- Externe Sicherung der vollständigen Laufzeitablage, Aufbewahrung und regelmäßige Wiederherstellungsproben organisieren.
- Betriebsüberwachung, weitergehende Sicherheitsabnahme und Updates am festgesetzten Programmcommit bewusst planen.
- Beim Einrichten weiterer Instanzen HTTPS, Volumes und eigene Erstzugänge jeweils neu prüfen; vorhandene Konten nicht durch Startvariablen zurücksetzen.
