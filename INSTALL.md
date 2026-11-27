# Installation

Aktueller App-Stand: `0.3.2`, API/MCP `3.15.0`. [Release Notes](docs/RELEASE_NOTES.md) · [Versionen](docs/VERSIONIERUNG.md). Bestehende Installationen ausschließlich nach [Update-Anleitung](docs/UPDATE.md) mit Sicherung aktualisieren.


Stand: 27.11.2026. Diese Anleitung beschreibt eine Neuinstallation des aktuellen Arbeitsstands für Entwicklung, Tests und lokalen Betrieb. Bei einer vorhandenen Installation zuerst [Update und Datenerhalt](docs/UPDATE.md) lesen. Quellstand, freigegebener Git-Stand und laufende Installation sind getrennt; die Versionsanhebung allein veröffentlicht oder aktiviert nichts. Den gewünschten Branch beziehungsweise Commit vor dem Bauen ausdrücklich auswählen. Die reine Nutzung erklärt die [Bedienungsanleitung](docs/BEDIENUNGSANLEITUNG.md).

## Online-Testinstanz mit Coolify

Für Coolify gibt es eine separate [Einrichtungsanleitung](docs/COOLIFY.md) und `docker-compose.coolify.yml`. Das Docker-Abbild prüft die echte Betriebsbereitschaft unter `/ready`. Bei einer neuen Online-Installation beide Variablen `EDOKU_INITIAL_ADMIN_LOGIN` und `EDOKU_INITIAL_ADMIN_PASSWORD` als Laufzeitwerte setzen: Dann entsteht genau ein eigener Systemadmin und keine bekannten Demo-Konten. Vorhandene Konten bleiben bei späteren Starts unverändert. Im Produktionsmodus bricht eine Neuinstallation ohne beide Variablen vor der Datenbankanlage ab. Bestehende Datenbanken benötigen keine neuen Startzugangsdaten.

## Start mit Docker

```bash
docker compose up --build
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

Im Hintergrund starten:

```bash
docker compose up -d
```

Stoppen:

```bash
docker compose down
```

Logs anzeigen:

```bash
docker compose logs -f
```

## Start ohne Docker

Voraussetzungen: Node.js 22 und installierte Abhängigkeiten; Python 3.11 oder neuer für die Sicherungswerkzeuge. `better-sqlite3` enthält ein zur jeweiligen Plattform passendes natives Modul. Abhängigkeiten zwischen macOS und Linux nicht als fertigen `node_modules`-Ordner austauschen; bei Bedarf im Zielsystem neu installieren. Docker liefert eine passende Node-/SQLite-Laufzeit mit.

```bash
npm install
npm start
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

## Wird die Datenbank mit installiert?

Ja. SQLite ist eine eingebettete Datenbank und benötigt keinen eigenen Server und keinen zweiten Docker-Dienst. Das Programmabbild enthält die benötigte SQLite-Anbindung (`better-sqlite3`). Die Datenbankdatei `storage/app.db` entsteht beim ersten Anwendungsstart, wenn noch keine Datenbank vorhanden ist.

Eine echte Neuinstallation aktiviert die beiden aktuellen Speicherstufen: vollständige strukturierte Projektdatensätze in SQLite sowie synchronisierte Tabellen für Gerätelisten und Positionen. Beim ersten Einrichten eines Projekts werden dessen Datensätze erfasst. Fotos, Anhänge, PDFs und ZIPs bleiben Dateien; globale Einstellungen und Vorlagen ebenfalls.

Compose bindet `storage/` vom Rechner nach `/app/storage/` ein. Datenbank und Projekte überstehen deshalb einen Austausch des Containers, solange dieselben fünf Laufzeitordner erhalten bleiben. Die Datenbank ist nicht als vorgefüllte Datei Teil des GitHub-Repositories. Eine vorhandene Datenbank wird nicht durch eine neue ersetzt; eine vorhandene leere Datenbank wird auch nicht automatisch mit Startkonten gefüllt. `storage/app.db` niemals löschen, um ein Konto oder eine Installation vermeintlich zurückzusetzen.

Bestehende Installationen wechseln nicht allein durch einen Programmneustart in einen neuen Speicherstand. Zunächst Vollsicherung und Projektkopien prüfen, danach gegebenenfalls [SQLite ausdrücklich aktivieren](docs/SQLITE_PROJEKTDATEN.md). Status im passenden Programmabbild prüfen:

```bash
docker compose run --rm --no-deps edoku npm run storage:status -- --root /app
```

Der Befehl zeigt den Projektmodus und die zusätzliche Geräteprojektion an. Er setzt voraus, dass das verwendete Abbild die aktuellen Speicherbefehle enthält.

## Eigener Erstzugang und bestehende Konten

Vor einer echten Neuinstallation einen eigenen Erstzugang über die Laufzeitvariablen `EDOKU_INITIAL_ADMIN_LOGIN` und `EDOKU_INITIAL_ADMIN_PASSWORD` konfigurieren. Das Passwort benötigt 12 bis 256 Zeichen und darf nicht nur aus Leerzeichen bestehen. Beide Werte privat hinterlegen; keine Zugangsdaten in Git speichern. Bei einer so eingerichteten Neuinstallation entsteht genau ein eigener Systemadmin, ohne bekannte Demo-Konten.

Bei lokalem Docker Compose reicht eine `.env`-Datei allein nicht aus, da die normale Compose-Datei diese beiden Variablen nicht an den Container weitergibt. Eine **private**, automatisch geladene Zusatzdatei `docker-compose.override.yml` anlegen:

```yaml
services:
  edoku:
    environment:
      EDOKU_INITIAL_ADMIN_LOGIN: ${EDOKU_INITIAL_ADMIN_LOGIN:?Eigene Kennung setzen}
      EDOKU_INITIAL_ADMIN_PASSWORD: ${EDOKU_INITIAL_ADMIN_PASSWORD:?Eigenes Passwort setzen}
```

Die beiden Werte vor dem Start in einer privaten `.env`-Datei festlegen. Das Passwort dort in einfachen Anführungszeichen notieren, damit etwa Dollarzeichen wörtlich erhalten bleiben. `.env` und `docker-compose.override.yml` nicht veröffentlichen. Die Zusatzdatei wird beim normalen Start automatisch geladen:

```bash
docker compose up -d --build
```

Für die jeweils eigene Bereitstellung die privaten Werte in der passenden Laufzeitkonfiguration erhalten. Für Online-Betrieb ist die [separate Betreiberanleitung](docs/COOLIFY.md) maßgeblich.

Docker verwendet `NODE_ENV=production`: Ohne eigene Erstzugangsvariablen wird keine neue Datenbank angelegt. Nur ausdrücklich gestartete Entwicklungs- oder Testumgebungen behalten das Demo-Verhalten. Diese Dokumentation veröffentlicht keine Klartext-Zugangsliste.

Das Abbild läuft standardmäßig als Benutzer `node` (UID/GID 1000:1000). Vorhandene Bind-Mounts müssen für den ausführenden Benutzer beschreibbar sein. Auf macOS mit `id -u` und `id -g` die eigene Kennung ermitteln und in der privaten Zusatzdatei unter `services.edoku` beispielsweise `user: "501:20"` ergänzen; immer die tatsächlich ermittelten Werte verwenden. Alternativ vor jedem Compose-Aufruf `EDOKU_UID` und `EDOKU_GID` setzen. Bestehende Datenordner nicht pauschal umbenennen oder deren Eigentümer ändern. Vollsicherungen erhalten die private Zusatzdatei und die tatsächliche Container-Benutzerkennung für die Wiederherstellung.

Eine vorhandene Datenbank hat Vorrang: Bei Neustarts werden eigene Konten, Passwortänderungen, Rollen und Sperren erhalten; auch eine leere vorhandene Datenbank wird nicht automatisch mit Startkonten befüllt. Die Erstzugangsvariablen sind **kein Passwortreset**. Bestehende Zugänge durch den zuständigen Systemadmin verwalten; die Datenbank niemals zum Zurücksetzen löschen.

## Persistente Daten

Lokale Laufzeitdaten liegen unter:

```text
storage/app.db
storage/users/
storage/exports/
storage/imports/
output/
```

Die gesamten fünf Laufzeitordner müssen gemeinsam gesichert werden. Insbesondere enthält `storage/app.db` nach SQLite-Aktivierung auch die aktuellen Projektinhalte. Alte Projekt-JSON-Dateien sind dann nur Ausgangskopien. Details: [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md). Die privaten Inhalte unter `storage/` und `output/` werden nicht in Git versioniert.

## Docker-Volumes

`docker-compose.yml` bindet persistente lokale Ordner ein, damit Projektdaten außerhalb des Containers erhalten bleiben.

Wichtige Ordner:

- `data/`
- `config/`
- `output/`
- `templates/`
- `storage/`

## Vorhandene Installation aktualisieren

Vor dem Update alle fünf eingebundenen Ordner gemeinsam sichern und die neue
Version zunächst mit einer Kopie prüfen. Testdaten werden niemals zurück in
die normale Anwendung kopiert. Ablauf und Wiederherstellung stehen in
[docs/UPDATE.md](docs/UPDATE.md).

Die automatisierten Prüfungen werden in [docs/TESTS.md](docs/TESTS.md) beschrieben.

## Sicherheitshinweis

Für produktiven Serverbetrieb müssen unter anderem HTTPS, sichere Secrets, Härtung der Sessions, Benutzerrollen, Backups und Reverse-Proxy-Konfiguration geprüft werden.

Selbstregistrierung ist standardmäßig geschlossen. Neue Passwörter müssen 12 bis 256 Zeichen enthalten und dürfen nicht nur aus Leerzeichen bestehen; vorhandene Passwörter werden beim Update nicht geändert. Systemadmins können Benutzer in der Anwendung sperren, wieder aktivieren, Rollen ändern und Passwörter zurücksetzen. Details: [Benutzerverwaltung](docs/BENUTZERVERWALTUNG.md). Für öffentliche Installationen sollten die bekannten Startpasswörter direkt nach dem ersten Start geändert und nicht benötigte Konten gesperrt werden.

## Serverbetrieb: Cookie-Optionen

Für HTTPS-Betrieb hinter einem Reverse Proxy sollten mindestens folgende Umgebungsvariablen gesetzt werden:

```text
NODE_ENV=production
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
```

Optional:

```text
SESSION_COOKIE_NAME=edoku_session
COOKIE_DOMAIN=deine-domain.example
COOKIE_SECURE=true
```

`COOKIE_SECURE=true` erzwingt HTTPS-Cookies. Wenn eine Testinstallation noch per HTTP erreichbar ist, darf dieser Wert nicht gesetzt werden, sonst kann der Browser die Login-Session nicht speichern.

Lokal bleiben diese Werte normalerweise leer, damit die Anmeldung unter `http://localhost:3000` weiterhin funktioniert.
