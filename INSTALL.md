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

Beim Start werden lokale Demo-Konten vorbereitet, falls sie noch nicht vorhanden sind.

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

## Sicherheitshinweis

Die aktuelle Version ist eine Beta. Für produktiven Serverbetrieb müssen unter anderem HTTPS, sichere Secrets, Härtung der Sessions, Benutzerrollen, Backups und Reverse-Proxy-Konfiguration geprüft werden.

Systemadmins können Benutzer in der Anwendung sperren, wieder aktivieren, Rollen ändern und Passwörter zurücksetzen. Für öffentliche Installationen sollten die lokalen Demo-Konten direkt nach dem ersten Start angepasst oder ersetzt werden.

## Serverbetrieb: Cookie-Optionen

Für HTTPS-Betrieb hinter einem Reverse Proxy sollten mindestens folgende Umgebungsvariablen gesetzt werden:

```text
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
```

Optional:

```text
SESSION_COOKIE_NAME=edoku_session
COOKIE_DOMAIN=deine-domain.example
```

Lokal bleiben diese Werte normalerweise leer, damit die Anmeldung unter `http://localhost:3000` weiterhin funktioniert.
