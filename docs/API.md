# eDoku API

## Zweck

Die API ist ein vorsichtiges Backend-Grundgeruest fuer spaetere Integrationen, Frontend-Clients und Deployment-Checks. Sie ersetzt keine bestehende EJS-Oberflaeche und schreibt aktuell keine Projektdaten.

## Aktuelle Grenzen

- Die Endpunkte liefern neutrale Demo-Daten aus `src/data/demoStore.js`.
- Es gibt noch keine schreibenden API-Endpunkte.
- Die API nutzt noch nicht die produktiven Projekt-JSON-Dateien.
- Bestehende Formularrouten, Autosave-Funktionen, Uploads und PDF-Exporte bleiben unveraendert.
- Authentifizierung fuer die API ist in diesem Grundgeruest noch nicht aktiv.
- Es ist keine neue Datenbank, keine Upload-Funktion und keine neue PDF-Engine fuer die API aktiv.

## Antwortformat

Erfolg:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

Fehler:

```json
{
  "success": false,
  "error": {
    "message": "API-Endpunkt nicht gefunden",
    "code": "API_NOT_FOUND"
  }
}
```

## Verfuegbare Endpunkte

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/health` | Healthcheck fuer Betrieb und Deployment |
| GET | `/api/projects` | Demo-Projekte auflisten |
| GET | `/api/projects/:id` | Demo-Projekt nach ID laden |
| GET | `/api/service-areas` | Demo-Leistungsbereiche auflisten |
| GET | `/api/service-areas/:id` | Demo-Leistungsbereich nach ID laden |
| GET | `/api/device-lists` | Demo-Geraetelisten auflisten |
| GET | `/api/device-lists/:id` | Demo-Geraeteliste nach ID laden |
| GET | `/api/documents` | Demo-Dokumente, Erklaertexte und Normhinweise laden |
| GET | `/api/documents/:id` | Demo-Dokument nach ID laden |
| GET | `/api/exports/status` | Demo-Exportstatus laden |

## Beispielantwort Healthcheck

```json
{
  "success": true,
  "data": {
    "app": "eDoku",
    "version": "0.1.0-beta.1",
    "status": "ok",
    "mode": "demo",
    "database": "demoStore",
    "timestamp": "2026-06-15T20:00:00.000Z"
  },
  "message": "Backend erreichbar"
}
```

## Beispielantwort Listenabfrage

`GET /api/projects`

```json
{
  "success": true,
  "data": [
    {
      "id": "musterprojekt",
      "name": "Musterprojekt",
      "projectNumber": "MP-2026-001",
      "customer": "Demo GmbH",
      "site": "Baustelle Musterstrasse",
      "building": "Verwaltungsgebaeude",
      "status": "active"
    }
  ],
  "message": "Projekte geladen"
}
```

## Beispielantwort fuer unbekannte ID

`GET /api/projects/unbekannt`

```json
{
  "success": false,
  "error": {
    "message": "Projekt nicht gefunden",
    "code": "PROJECT_NOT_FOUND"
  }
}
```

## Beispielantwort fuer unbekannte API-Route

`GET /api/does-not-exist`

```json
{
  "success": false,
  "error": {
    "message": "API-Endpunkt nicht gefunden",
    "code": "API_NOT_FOUND"
  }
}
```

## Lokaler Test

App starten:

```bash
npm start
```

Oder per Docker:

```bash
docker compose up --build
```

API pruefen:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/projects
curl http://localhost:3000/api/projects/musterprojekt
curl http://localhost:3000/api/projects/unbekannt
curl http://localhost:3000/api/service-areas
curl http://localhost:3000/api/device-lists
curl http://localhost:3000/api/documents
curl http://localhost:3000/api/exports/status
curl http://localhost:3000/api/does-not-exist
```

Wenn die App lokal auf einem anderen Port laeuft, kann die URL entsprechend angepasst werden, zum Beispiel:

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/projects
curl http://localhost:3100/api/projects/musterprojekt
curl http://localhost:3100/api/projects/unbekannt
curl http://localhost:3100/api/does-not-exist
```

Automatischer Smoke-Test:

```bash
npm run smoke:api
```

Bei abweichender Basis-URL:

```bash
API_BASE_URL=http://localhost:3100 npm run smoke:api
```

## Spaetere Erweiterung

Sinnvolle naechste Schritte:

- API-Authentifizierung an vorhandene Sessions oder Token anbinden.
- Lesende Endpunkte auf echte benutzerbezogene Projektdateien umstellen.
- Rollenrechte fuer Schreibzugriffe definieren.
- POST/PUT/DELETE nur nach klarer Rechte- und Validierungslogik ergaenzen.
- PDF- und Exportaktionen nur kontrolliert als Hintergrundjobs oder geschuetzte Endpunkte anbieten.
- Demo-Daten im `demoStore` schrittweise durch Service-Zugriffe auf `storage/users/...` ersetzen.
