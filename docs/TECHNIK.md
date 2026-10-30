# Technische Dokumentation

## Architektur

edoku ist eine Node.js-Webanwendung mit Express und serverseitigem Rendering über EJS. Das Frontend verwendet Vanilla JavaScript und CSS ohne Framework.

Die Anwendung ist so aufgebaut, dass sie lokal auf einem Rechner laufen kann, aber grundsätzlich für späteren Webserverbetrieb vorbereitet ist.

## Backend

- `server.js` enthält Express-App, Routen und zentrale Request-Flows.
- `services/` enthält fachliche und technische Hilfsdienste.
- JSON-Zugriffe laufen über robuste Lese-/Schreibfunktionen.
- Dateipfade werden mit `path.join` und kontrollierten Projektpfaden aufgebaut.
- Projektdateien und neue Ausgaben werden über Benutzer-/Projektkennungen aufgelöst. Archivdownloads und Dateivorschauen prüfen Benutzergrenzen, Dateitypen und Symlinks; siehe `docs/SICHERHEIT.md`.

## Datenhaltung

Fachliche Projektinhalte liegen in JSON-Dateien:

- `projekt.json`
- `leistungsbereiche.json`
- `dokumentenmatrix.json`
- `projektSysteme.json`
- `geraetelisten.json`
- `brandschutz.json`
- `anhaenge.json`
- `exportliste.json`

Benutzer, Sessions und Projektübersicht liegen in SQLite:

```text
storage/app.db
```

Benutzerprojekte liegen unter:

```text
storage/users/[userId]/projects/[projectId]/
```

## Benutzerverwaltung

- Registrierung und Login sind vorhanden.
- Passwörter werden mit `crypto.scrypt` und Salt gehasht.
- Sessions werden als zufällige Tokens in SQLite gespeichert.
- Session-Cookies sind `httpOnly`, nutzen standardmäßig `SameSite=Lax` und können für HTTPS-Betrieb per ENV auf `Secure` gehärtet werden.
- Fachseiten sind nur nach Login erreichbar.
- Projektzugriff erfolgt über die angemeldete `userId`.
- Für lokale Tests werden Seed-Benutzer vorbereitet; konkrete lokale Defaults stehen in `INSTALL.md`.
- Rollen sind als Beta-Funktion vorhanden: `viewer`, `user`, `admin`, `systemadmin`.
- `systemadmin` kann Benutzer anlegen und Rollen verwalten.
- `viewer` darf Fachseiten lesen, aber keine Schreiboperationen ausführen.
- Benutzerkonten besitzen einen Status `active` oder `disabled`.
- Gesperrte Konten können sich nicht anmelden; vorhandene Sessions werden beim Sperren entfernt.
- Passwort-Reset durch Systemadmins schreibt neuen Hash/Salt und beendet vorhandene Sessions des Kontos.
- Der bestehende Admin-Datensatz behält intern seine stabile ID, damit vorhandene Demo-Projekte nicht verloren gehen.

## Session-Cookies und Reverse Proxy

Für lokale Entwicklung bleiben Session-Cookies ohne `Secure`-Attribut, damit `http://localhost:3000` funktioniert. Bei HTTPS-Anfragen wird `Secure` automatisch gesetzt. Hinter einem Reverse Proxy sollte `TRUST_PROXY=true` gesetzt werden, damit Express Proxy-Header korrekt auswertet.

Empfohlene Serverwerte:

```text
NODE_ENV=production
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
```

Optional:

```text
SESSION_COOKIE_NAME=edoku_session
COOKIE_DOMAIN=example.org
COOKIE_SECURE=true
```

`COOKIE_SECURE=true` erzwingt sichere Cookies immer. Das sollte nur gesetzt werden, wenn der Browser die Anwendung tatsächlich über HTTPS erreicht. Bei HTTP-only-Testinstallationen würde ein erzwungenes Secure-Cookie den Login verhindern.

## Projektkonzept

Ein Benutzer kann mehrere Projekte besitzen. Ein Projekt wird als aktueller Arbeitskontext geöffnet. Alle Fachseiten arbeiten mit diesem aktuellen Projekt.

Globale Dateien in `data/` dienen als Startdaten und Defaults. Projektbezogene Daten werden beim Anlegen oder Öffnen eines Projekts in den jeweiligen Storage-Bereich kopiert beziehungsweise dort gelesen.

## Dokumentationslogik

Die Dokumentenmatrix enthält fachliche Kapitel und Exportpunkte. Die internen Original-Kapitel bleiben stabil. Für Ausgabe und Export wird zusätzlich eine logische Nummerierung erzeugt, damit deaktivierte Kapitel keine Lücken erzeugen.

## PDF-Erzeugung

Die PDF-Erzeugung nutzt `pdfkit`.

Aktuell erzeugt werden:

- Inhaltsverzeichnis
- Anlagenbeschreibung
- Konformitätserklärungen
- CE-Bestätigungen
- DGUV-/Errichterbestätigungen
- Gerätelisten
- Brandschutzdokumentation
- Deckblätter für Hauptkategorien
- separate Trennstreifen für Unterkategorien im Maß 24 x 10,5 cm
- separate Ordnerrücken für Avery-Zweckform `61x192-R` und `38x192-R`
- finale Gesamt-PDF und ZIP-Ausgabe als Beta-Funktion

Die Trennstreifen werden ohne GitHub-Branding erzeugt, damit sie als reine Registerstreifen gedruckt werden können. Layoutoptionen für Trennstreifen werden in den Systemeinstellungen gespeichert.

Ordnerrücken werden ebenfalls ohne Footer-Branding erzeugt. Die Ausgabe orientiert sich an A4-Kalibrierungsbögen: `61x192-R` nutzt 4 horizontale Rücken je Seite, `38x192-R` nutzt 7 horizontale Rücken je Seite. Die Druckoptionen für Projektkenndaten werden in `config/systemEinstellungen.json` unter `export.ordnerruecken` gespeichert.

## Oberfläche und Theme

- Globale Farben, Radien, Schatten, Abstände und Typografie werden über CSS-Variablen gesteuert.
- Der Theme-Editor speichert Werte in `config/systemEinstellungen.json`.
- Statusmeldungen werden als schwebende Toasts dargestellt und verschieben keine Seiteninhalte.
- Tag-/Nacht-Umschaltung und Theme-Presets greifen global auf Header, Navigation, Karten, Tabellen, Formulare und Buttons.
- Default-Presets teilen sich identische Radius-, Spacing- und Typografiewerte, damit beim Themewechsel keine Layoutgrößen springen.
- GitHub-orientierte Presets sind vorgesehen: Light Default, Light High Contrast, Light Colorblind, Dark Default, Dark High Contrast, Dark Colorblind und Dark Dimmed.
- Der Theme-Editor zeigt bewusst nur die wichtigsten Werte, damit die Einstellungen wartbar bleiben.

## Anhänge und importierte PDFs

Anhänge werden projektbezogen gespeichert und immer in der aktuell gewählten Kategorie importiert. Die Oberfläche zeigt Anhänge als Kacheln; Detaildaten werden bewusst in einem Bearbeiten-Popup gespeichert, damit keine versehentlichen Auto-Saves beim reinen Öffnen oder Vorschauen entstehen.

PDF-Anhänge können Kategorien erhalten, z. B.:

- Stromlaufpläne
- Schaltpläne
- Installationspläne
- Schemata
- Messprotokolle
- Bedienungsanleitungen

Diese PDF-Anhänge können in Inhaltsverzeichnis und Exportliste aufgenommen werden.

Für Pläne und Messprotokolle wird die Stockwerksangabe zur Sortierung verwendet. Bedienungsanleitungen können in Gerätelisten mit einzelnen Gerätepositionen verknüpft werden. Brandschutzgerätelisten sind davon ausgenommen, weil dort die Bild- und Schottungsdokumentation separat geführt wird.

Bildanhänge können Brandschutzabschottungen als `Foto 1` oder `Foto 2` zugeordnet werden. Die Zuordnung erfolgt im Anhangs-Popup und wird gemeinsam mit den Metadaten über den Speichern-Button übernommen. Das Bearbeiten-Popup zeigt für Bilder eine direkte Vorschau; PDFs werden über eine separate PDF-Vorschau geöffnet.

Importierte Dateien werden serverseitig mit einem logischen Dateinamen aus Kategorie und Metadaten abgelegt. Dadurch bleiben Ablage, Export und Inhaltsverzeichnis nachvollziehbar.

## Docker

Die Anwendung ist über `Dockerfile` und `docker-compose.yml` startbar. Persistente lokale Ordner werden als Volumes eingebunden.

Der Container nutzt Node.js 20. Für lokale Entwicklung sollte ebenfalls Node.js 20 oder neuer verwendet werden.

## GitHub-Upload

Nicht ins Repository gehören:

- `node_modules/`
- `output/`
- `storage/app.db`
- `storage/users/`
- `storage/exports/`
- `storage/imports/`
- `.env`
- interne Tagesupdates

## Beta-Einschränkungen

- Rollen- und Rechteverwaltung ist Beta und muss vor produktiver Nutzung weiter geprüft werden
- keine produktive Webserver-Härtung
- 38 gezielte automatisierte Prüfungen; eine vollständige Fach-, Browser- und Betriebsabnahme fehlt
- PDF-Gesamtdatei, ZIP-Export und Archivstruktur weiter im Praxistest prüfen
- fachliche Texte und Normbezüge müssen weiter geprüft werden

## Einheitliche Kapitel- und Exportzählung (2026-10-30)

`services/documentationPlanService.js` baut die gemeinsame Struktur für Matrix,
Inhaltsverzeichnis, Gerätelisten, Anhänge, Dateinamen und Exportvorschau.
Originalkapitel bleiben Fachschlüssel; die Ausgabenummerierung folgt einem Baum.
Fehlende Vorfahren werden ergänzt. Doppelte Originalnummern, zusätzliche
Gerätelisten und importierte PDFs erhalten eindeutige Ausgabenummern.

Die Zählungen haben unterschiedliche, ausdrücklich getrennte Einheiten:

- Kapitelgruppen: Hauptkapitel, ohne das Inhaltsverzeichnis mit Kennung 0.
- Strukturüberschriften: Gliederung ohne eigene PDF, daher keine fehlende Datei.
- Einzel-PDFs: gewählte Dokumente einschließlich Deckblättern und Inhaltsverzeichnis.
- Seiten: tatsächlich gelesene Seiten vorhandener, lesbarer Einzel-PDFs.
- Gesamt-PDF und separate Druckvorlagen zählen nicht zusätzlich als Einzel-PDFs.
- Dateinummern der final enthaltenen PDFs sind lückenlos; Überschriften verbrauchen keine Dateinummer.

Neu erzeugte PDFs enthalten eine Dokumentkennung und Kapitelnummer als
Metadaten. Alte oder unpassende generierte PDFs werden als veraltet ausgewiesen;
Dateinummern allein reichen nicht für eine eindeutige Zuordnung. Für eine
Dokumentation nach der neuen Struktur wird der Export bewusst neu gestartet.
Das Update selbst erzeugt keine PDFs neu und migriert keine Projektdaten.

Dashboard und Export prüfen den aktuellen Plan und die Quelldateien neu. Eine
leere Exportliste gilt nicht als vollständiger Pflichtnachweis. Pflicht-PDFs
werden im Gesamtfortschritt nicht zusätzlich ein zweites Mal gewichtet.

Beim finalen Export werden interne PDFs aktualisiert und das Inhaltsverzeichnis
mit den tatsächlichen Startseiten neu gesetzt. Die Linkflächen stammen aus dem
gemessenen Textsatz einschließlich mehrzeiliger Titel und Seitenumbrüche.
Unlesbare, fehlende und nicht zuordenbare externe PDFs werden ausdrücklich
gemeldet. Verschlüsselte PDFs werden nicht als lesbare Exportquellen gezählt.
ZIP-Ordner verwenden die tatsächlichen Kapiteltitel, auch wenn Hauptkapitel
durch die Auswahl eine neue Ausgabenummer erhalten.

Die automatische Ordneranzahl berechnet sich aus den vorhandenen PDF-Seiten
und dem einstellbaren Wert `seitenProOrdner` (Standard: 80). Das ist eine
Ablageschätzung; Druckmodus und physische Ordnerkapazität bleiben zu berücksichtigen.

Prüfung: `npm run test:exports`. Die 18 gezielten Prüfungen umfassen unter
anderem Nummernkollisionen, abgewählte Kapitel, mehrere Gerätelisten,
mehrseitige Anhänge, ungültige PDFs, alte Zuordnungen, Dateireihenfolge und ein
dreiseitiges Inhaltsverzeichnis mit 56 überprüften internen Sprunglinks.
Sicherheits- und Archivkorrekturen stehen in `SICHERHEIT.md` und `PROJEKTARCHIVE.md`; externe Vollsicherung und Betriebsabnahme bleiben offen.

## Datenerhalt bei der lokalen Übernahme (2026-10-30)

Beim Start werden Startkonten und das alte JSON-Projektregister nur bei einer
echten Erstinstallation ohne vorhandene Datenbank eingerichtet. Bestehende
Konten behalten Passwort-Hashes, Rollen, Sperren und aktuelles Projekt; auch
eine vorhandene leere Datenbank wird nicht automatisch mit Konten befüllt.
Bereits registrierte Projekte werden beim Aufrufen nicht neu gespeichert.
Die GET-Systemauswahl gleicht ihre Anzeige ab, speichert aber erst nach einer
ausdrücklichen Benutzeraktion.

`npm run test:preservation` prüft drei Fälle einschließlich Neustart und zwölf
angemeldeter Seiten. Zusammen mit `npm run test:exports` bestehen 21 Prüfungen
im tatsächlich eingesetzten Node-20-Abbild. Zusätzlich wurde die neue Version
mit einer konsistenten Kopie der echten Daten vorab geprüft.

Die Hauptinstanz wurde mit denselben fünf eingebundenen Laufzeitordnern
(`data`, `config`, `storage`, `output`, `templates`), Ports und Startparametern
umgestellt. Eine bei gestoppter Anwendung erstellte vollständige Sicherung
enthält 761 Dateien. Nach dem Start wurden sämtliche nichtoperativen
Laufzeitdateien per SHA-256 verglichen; Datenbankschema und alle Tabellenzeilen
wurden gesondert verglichen, weil SQLite seine Betriebsdateien verändern kann.
Es gab keine Inhaltsänderung. Die Sicherung selbst ist bytegleich erhalten.

Der Nachweis liegt lokal unter
`backups/2026-10-30_uebernahme-edoku-6hmt5og/UEBERNAHME.md`.
Die Sicherung liegt außerhalb der Laufzeitordner und wird weder in Git noch in
Docker-Abbilder aufgenommen. Dies ist eine geprüfte lokale Einzelsicherung;
ein allgemeines automatisiertes Backup-/Wiederherstellungssystem bleibt offen.

Reproduzierbare Prüfschritte stehen in [TESTS.md](TESTS.md), das Vorgehen für
weitere lokale Updates in [UPDATE.md](UPDATE.md). Private Sicherungen und
Prüfprotokolle werden nicht veröffentlicht.

## Sicherheits- und Archivstruktur

- `requestSecurityService.js`: signierte sitzungsgebundene CSRF-Tokens, Ursprungsprüfung, Login-/Registrierungsbegrenzung und Weitergabe asynchroner Routenfehler.
- `projectService.js`: nur im Speicher gebundener Projektkontext, neue stabile Ausgabeablage und eindeutige, rein lesende Altbestandszuordnung.
- `pathService.js`: lexikalische Pfadgrenzen plus Prüfung der Dateisystemkomponenten auf Symlinks/Spezialdateien.
- `projectPackageService.js`: Paketformat 2.0, tatsächliche Dateiinventare, Prüfsummen, benutzerbezogene Import-/Exportpfade und konfliktfreie Rückimporte.
- `zipService.js`: Streaming-ZIP mit geprüften relativen Einträgen und Größenlimits, ohne neue Laufzeitabhängigkeit.
- `jsonService.js`: synchronisierte temporäre Dateien und anschließender Austausch; Fehler statt stiller Erfolgsmeldung.

Neue Ausgaben liegen unter `storage/users/<Benutzer-ID>/projects/<Projekt-ID>/output/`.
Bestehende Ordner werden weder umbenannt noch automatisch migriert. Historische
Mehrfachzuordnungen werden nicht als neue Dateirechte verwendet. Originale
abgeleiteter Exportindizes bleiben in Archiv-Begleitmetadaten erhalten;
importierte aktive Indizes werden neu aufgebaut.
