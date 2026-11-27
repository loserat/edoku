# HTTP-API

Externe Programme verwenden `/api/v1`. Authentifizierung, Projektgrenzen und Fachregeln gelten ebenso für den [MCP-Adapter](API_MCP.md). API-Version **3.15.0**; vollständige Routen, Rechte, Schemas und Versionsbedingungen stehen in der [erzeugten Referenz](api/README.md) und [OpenAPI-Datei](api/openapi.json). Der laufende Server liefert sie unter `GET /api/v1/openapi.json`.

## Zugriff einrichten

In Einstellungen → API & MCP die Integration prüfen und einen eigenen Schlüssel erzeugen. Nur benötigte Rechte vergeben, nach Möglichkeit auf passende Projekte begrenzen und die Laufzeit beschränken. Ein Schlüssel ersetzt keine Benutzerberechtigung. Schreibzugriff benötigt zusätzlich die entsprechenden aktivierten Integrationsrechte.

Schlüssel werden nur bei der Erstellung vollständig angezeigt. Privat speichern, nicht in URLs, Screenshots, Logs oder das Repository übernehmen. Nicht mehr benötigte Schlüssel widerrufen. GUI-Formulare verwenden weiterhin Anmeldung und CSRF-Schutz; ein Bearer-Schlüssel umgeht diesen Schutz nicht.

## Leseaufruf

API-Ursprung und Schlüssel als private Umgebungswerte bereitstellen:

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $EDOKU_API_TOKEN" \
  "$EDOKU_API_URL/api/v1/projects"
```

`EDOKU_API_URL` enthält hier den Ursprung, beispielsweise `http://127.0.0.1:3000`. Für entfernte Server HTTPS verwenden. Erfolgs-/Fehlerhülle und Pagination anhand der jeweiligen OpenAPI-Operation auswerten; nicht alle Endpunkte haben dieselbe Antwortform.

## Änderungen sicher ausführen

Vorhandenen gezielten Stand lesen und die verlangten Projekt-/Auftragsversionen mitgeben. `If-Match`, Auftragsversion und Wiederholungsschlüssel schützen unterschiedliche Bedingungen. Welche Felder erforderlich sind, steht pro Operation im Vertrag. Bei Konflikten neu lesen und Änderungen abgleichen; keine fremden Felder oder zwischenzeitlichen Benutzerentscheidungen überschreiben.

Materialimport, Artikelzuordnung, Rückfragen, Vorschläge und Hintergrundexport sind getrennte Vorgänge. Gespeicherte Quellen und tatsächliche Benutzerbelege verwenden. [Agentenablauf](API_MCP.md#aufgabensteuerung-für-einen-agenten).

## Dateien und destruktive Vorgänge

Neue Dateien bleiben Vorschläge bis zur manuellen GUI-Einzelprüfung. Es gibt keinen API-Endpunkt zum automatischen Freigeben. Herstellerunterlagen benötigen die [Produktprüfung](PRODUKTPRUEFUNG.md).

Offene Vorschläge können mit aktueller Version, Begründung und tatsächlichem Beleg zurückgezogen werden; Originale und Verlauf bleiben erhalten. Bereits freigegebene oder anderweitig entschiedene Vorschläge sind geschützt. Gezielte Geräte-/Dokument-/Auftragslöschung benötigt die aktuelle Vorschau und ausdrückliche Bestätigung; Wiederherstellung verwendet den protokollierten Originalstand. Vollständiger Projektreset zusätzlich nur nach geprüfter Sicherung. Fremdprojekt- und Fachsperren bleiben wirksam.

## Ausgabe und Fehler

PDF-/ZIP-Exporte laufen als Hintergrundaufträge. Fehlende Angaben oder Dateientscheidungen bleiben als Voraussetzungen sichtbar. Ein technischer Export ist keine fachliche Vollständigkeitsbestätigung. Vorhandene Ausgaben und Quellunterlagen behalten.

Fehler anhand Status und maschinenlesbarem Code behandeln: etwa fehlende Anmeldung/Rechte, ungültige Eingaben, Versionskonflikt oder Größenlimit. Die Grenze nicht durch wiederholte große Abrufe umgehen. Zugehörige Anforderungskennung für die Fehlersuche verwenden; Zugangsdaten nicht protokollieren.

[Bedienung](BEDIENUNGSANLEITUNG.md) · [MCP-Einrichtung](CODEX_DOCKER_MCP.md) · [Sicherheit](SICHERHEIT.md).
