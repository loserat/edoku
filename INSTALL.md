# Installation

Diese Anleitung beschreibt den lokalen Start von `edoku` für Entwicklung, Tests und Beta-Prüfungen.

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

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm start
```

Danach im Browser öffnen:

```text
http://localhost:3000
```

## Lokale Demo-Konten

Nur bei einer Erstinstallation ohne vorhandene `storage/app.db` werden lokale Demo-Konten vorbereitet. Eine vorhandene Datenbank wird beim Neustart weder mit Demo-Konten befüllt noch erneut aus dem alten JSON-Projektregister migriert. Eigene Konten, Passwortänderungen, Rollen und Sperren bleiben erhalten. Das gilt auch für eine vorhandene leere Datenbank; sie wird nicht automatisch mit Testkonten gefüllt.

```text
Benutzer: admin
Passwort: admin
Rolle: systemadmin

Benutzer: berg
Passwort: berg
Rolle: systemadmin

Benutzer: marx
Passwort: marx
Rolle: user
```

Diese Konten sind nur für lokale Entwicklung und Tests vorgesehen. Für öffentlich erreichbare Installationen müssen eigene Konten angelegt und Demo-Zugänge entfernt oder geändert werden.

## Persistente Daten

Lokale Laufzeitdaten liegen unter:

```text
storage/app.db
storage/users/
storage/exports/
storage/imports/
output/
```

Diese Daten werden nicht in Git versioniert.

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

Die aktuelle Version ist eine Beta. Für produktiven Serverbetrieb müssen unter anderem HTTPS, sichere Secrets, Härtung der Sessions, Benutzerrollen, Backups und Reverse-Proxy-Konfiguration geprüft werden.

Systemadmins können Benutzer in der Anwendung sperren, wieder aktivieren, Rollen ändern und Passwörter zurücksetzen. Für öffentliche Installationen sollten die lokalen Demo-Konten direkt nach dem ersten Start angepasst oder ersetzt werden.

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
