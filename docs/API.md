# edoku API und MCP

Stand **25.11.2026**: lokal aktiv **App 0.2.0-beta.13 / HTTP-API und MCP 3.9.0**, **64 HTTP-Operationen und 55 MCP-Werkzeuge (22 Lesen / 33 Schreiben)**. Agentenvertrag 2.1, Produktprüfung V7. Die vereinfachte Oberfläche ist nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Neue Dateien weiterhin ausschließlich manuell einzeln in der GUI freigeben.

Änderungen, Tests und lokale Aktivierungen beider Tage: **[Entwicklungsupdate 23.–24.11.2026](ENTWICKLUNGSUPDATE_2026-11-23_24.md)**. Frühere Tagesabschlüsse und vorbereitete Nachweise beschreiben ihren damaligen Zeitpunkt; sie sind keine aktuellen Aktivierungsaufträge.

[Zentraler Einstieg](API_MCP.md) · [erzeugter Vertrag](api/README.md) · [Architektur/Refactoring](API_MCP_REFACTORING.md). Für Agenten gelten [Bearbeitungsrichtlinie](BEARBEITUNGSRICHTLINIE.md), [Agentenvertrag 2.1](AGENTENVERTRAG.md) und [Aufgabensteuerung](ZENTRALE_AUFGABENSTEUERUNG.md). Die folgenden Detailbeispiele ergänzen den führenden erzeugten Vertrag; aktuelle optionale Felder und Grenzen dort prüfen. Pläne unter [MCP/API-Optimierung](MCP_API_OPTIMIERUNG.md) erst nach tatsächlicher Implementierung verwenden.

## Aufbau und Umfang

Externe Programme verwenden `/api/v1`. Ein lokaler MCP-Adapter stellt dieselben Funktionen als Werkzeuge für einen MCP-Client bereit. Beide Wege verwenden dieselben API-Schlüssel, Projektgrenzen und Speichertransaktionen.

```text
Externes Programm ───────────────┐
MCP-Client → lokaler MCP-Adapter ├→ /api/v1 → Projektdienst → bestehender Speicher
                                ┘
```

Umgesetzt sind:

- Projekte wiederholungssicher anlegen, Projektstammdaten lesen und ausgewählte Stammdaten ändern.
- Leistungsbereiche, Systeme und Dokumentauswahl mit der bestehenden Projektlogik ändern; Pflichteinträge bleiben geschützt.
- Konkrete Dokumentationslücken und Pflichtquellen einschließlich Geräte-/Revisionszuordnung prüfen.
- Dauerhafte PDF-/ZIP-Hintergrundaufträge anlegen, abbrechen, erneut starten und geprüfte Ausgabedateien herunterladen.
- Gerätelisten und Positionen lesen; einzelne Positionen hinzufügen und ändern.
- Leistungsbereiche, Systemauswahl, Dokumentenmatrix, Brandschutzeinträge, Anhangsmetadaten und den gespeicherten Exportindex lesen.
- API-Schlüssel im Reiter **Einstellungen → API & MCP** (`/einstellungen#api`) anlegen und widerrufen. Der frühere Link `/integrationen` führt dorthin weiter.
- Öffentlicher maschinenlesbarer Vertrag: `/api/v1/openapi.json`, OpenAPI 3.1.
- Lokaler MCP-Server mit dem offiziellen SDK `@modelcontextprotocol/server` 2.4.0.
- Doku-Assistent mit Aufträgen, Rückfragen, getrennter Dateiablage und verpflichtender GUI-Einzelfreigabe; siehe [Doku-Assistent](DOKU_ASSISTENT.md).

Für Änderungen muss der bestehende SQLite-Projektspeicher für das angesprochene Projekt aktiv sein. Lesen funktioniert auch mit bestehenden JSON-Projekten. Die API aktiviert keine Migration. Geräteänderungen gehen über das vollständige führende Projektdokument; die vorhandenen Trigger aktualisieren die relationale Geräteprojektion. Unbekannte Bestandsfelder werden erhalten.

Das Gerätefeld `bemerkung` bleibt für interne Arbeits- und Quellenhinweise vollständig in GUI, API und Projektspeicher erhalten. Es wird nicht in generierte Geräte-PDFs, deren Spaltenüberschriften oder das daraus zusammengesetzte Kunden-PDF ausgegeben. Ältere generierte Gerätelisten ohne die aktuelle Ausgabeversion werden als veraltet erkannt und vor Verwendung im Export neu erzeugt. Hersteller-Originaldateien und technische Geräteangaben werden dabei nicht verändert.

`spannung` und `leistung` bleiben gültige Gerätefelder des jeweiligen Profils, sind aber mit `guiVisible: false` und `pdfExport: false` gekennzeichnet. Sie belegen keine sichtbaren GUI-/PDF-Spalten mehr. Bestehende Werte bleiben auch beim Speichern des GUI-Formulars erhalten. Die aktuelle Geräte-PDF-Ausgabeversion ist `3`.

## Einstellungen in der Oberfläche

Der Reiter **Einstellungen → API & MCP** bündelt Serverzugang, eigene Schlüssel und die lokale MCP-Einrichtung. Er besitzt denselben Direktlink- und Tab-Wechsel wie die anderen Einstellungsbereiche.

Systemadmins können folgende Vorgaben speichern:

| Einstellung | Wirkung |
| --- | --- |
| API-Zugang aktivieren | Schaltet `/api/v1` sofort ein/aus. Ausgeschaltet liefern weitere Datenanfragen `503` mit `API_DISABLED`. Der öffentliche API-Vertrag bleibt erreichbar. |
| Änderungen über die API erlauben | Ausgeschaltet bleiben Datenzugriffe lesend; Schreibanfragen liefern `403` mit `API_READ_ONLY`, unabhängig von weitergehenden Schlüsselrechten. Das gilt auch für MCP-Zugriffe. |
| Standardgültigkeit neuer Schlüssel | Vorgabe für das Anlegeformular, 1–365 Tage; Standard 90. |
| Maximale Gültigkeit neuer Schlüssel | Serverseitig geprüfte Obergrenze für neue Schlüssel, 1–365 Tage; Standard 365. Die Standardgültigkeit muss kleiner oder gleich dieser Grenze sein. |

Die Vorgaben werden erst beim ausdrücklichen Speichern in `config/integrationen.json` angelegt. Ohne diese Datei gelten die bisherigen Vorgaben: API aktiv, Schreibzugriffe entsprechend Schlüsselrechten erlaubt, 90 Tage Standard und 365 Tage Maximum. Die vorhandene Sicherung der Konfigurationsordner umfasst auch diese Datei. Eine spätere Änderung der Gültigkeitsvorgaben verändert bestehende Schlüssel nicht. Ausschalten löscht keine Schlüssel; die GUI zum Widerrufen bleibt erreichbar. Bereits laufende Anfragen werden dadurch nicht nachträglich zurückgenommen.

Normale Benutzer sehen den Status und verwalten nur ihre eigenen Schlüssel; globale Servervorgaben erfordern einen Systemadmin. Die Schlüsselliste unterscheidet aktiv, abgelaufen, widerrufen, gesperrtes Konto und ungültig nach Passwortwechsel.

Die MCP-Einrichtungshilfe erstellt eine kopierbare Client-Konfiguration aus Serveradresse, lokalem Skriptpfad und API-Schlüssel. Optional lassen sich Schreibwerkzeuge aufnehmen. Der eingegebene Schlüssel wird dafür ausschließlich im Browser verarbeitet und nicht an den Server übermittelt oder in Browser-Speichern abgelegt. Änderungen an Eingaben verwerfen eine zuvor erzeugte Konfiguration. Ein Ausblenden-Knopf leert Schlüssel und Ausgabe. Diese Hilfe startet keinen Adapter und bestätigt keine erfolgreiche Verbindung; die Einrichtung wird anschließend im lokalen MCP-Client abgeschlossen.

## Schlüssel und Rechte

In edoku anmelden, **Einstellungen → API & MCP** öffnen, einen Namen und die benötigten Rechte wählen. Standardmäßig sind nur Leserechte vorausgewählt; die Projektbeschränkung verlangt eine ausdrückliche Auswahl. Alternativ können alle eigenen, auch zukünftigen Projekte freigegeben werden.

Der vollständige Schlüssel wird nur unmittelbar nach dem Anlegen angezeigt. Die Datenbank enthält seinen SHA-256-Hash, nicht den verwendbaren Schlüssel. Gültigkeit: 1 Tag bis zur administrativ festgelegten Obergrenze, höchstens 365 Tage. Ohne eigene Vorgaben: 90 Tage Standard und 365 Tage Maximum. Höchstens 50 gleichzeitig gültige, nicht widerrufene Schlüssel pro Konto. Schlüssel gehören immer zum eigenen Konto, auch bei Systemadmins. Viewer können in dieser ersten Oberfläche keine neuen Schlüssel verwalten; bestehende Viewer-Zugänge dürfen ausschließlich lesen.

| Recht | Umfang |
| --- | --- |
| `projects:read` | Projektübersicht, Stammdaten, Leistungsbereiche und Systemauswahl |
| `projects:write` | Eigene Projekte anlegen; erlaubte Stammdaten, Leistungsbereiche, Systeme und Dokumentauswahl ändern |
| `devices:read` | Gerätelisten und Gerätepositionen lesen |
| `devices:write` | Einzelne Gerätepositionen anlegen und ändern |
| `documents:read` | Dokumentenmatrix, Brandschutz, Anhangsmetadaten und Exportindex lesen |
| `assistant:read` | Assistentenaufträge, Benutzerantworten und Entscheidungen lesen |
| `assistant:write` | Aufträge, Rückfragen und Dateien vorbereiten; keine Übernahme oder Freigabe |
| `exports:read` | Hintergrundaufträge und ihre geprüften PDF-/ZIP-/Berichtsdateien lesen |
| `exports:write` | Hintergrundexporte beauftragen, abbrechen und erneut starten; keine Dateifreigabe |

Lese- und Schreibrechte sind unabhängig: Für einen sinnvollen Schreibzugang auch das passende Leserecht vergeben, damit der Client die aktuelle Version lesen kann. Ein Schlüssel kann zusätzlich auf konkrete eigene Projekt-IDs beschränkt werden. Nicht freigegebene, fremde und gelöschte Projekte ergeben `404`. Archivierte eigene Projekte bleiben entsprechend dem bisherigen App-Verhalten erreichbar.

Sperren und Rollenänderungen werden bei jeder Anfrage geprüft. Ein Passwortwechsel macht die bisherigen Schlüssel ungültig. Ein gesperrtes Konto kann seine Schlüssel nicht verwenden; nach Entsperren sind ungekündigte Schlüssel bei unverändertem Passwort wieder verwendbar. Für einen dauerhaften Entzug den Schlüssel ausdrücklich widerrufen.

API-Zugangsdaten ausschließlich im Header übermitteln:

```http
Authorization: Bearer edoku_…
```

Browser-Cookies und Schlüssel in URLs werden nicht als API-Anmeldung akzeptiert. Die API ersetzt keine Sitzung für die Weboberfläche. Die Formularwege behalten ihre CSRF-Prüfung. Entfernte Verbindungen über HTTPS betreiben. Das bestehende Limit je IP und Serverprozess gilt auch für die API: 300 Lese- und 60 Schreibanfragen je Minute; Überschreitungen liefern `429` und `Retry-After`. JSON-Anfragekörper sind auf 2 MiB begrenzt.

## Endpunkte

Alle folgenden Pfade beginnen mit `/api/v1`.

Die vollständige Liste aller 45 HTTP-Operationen mit Rechten, Versionsschutz und MCP-Zuordnung steht im [aus dem Quellstand erzeugten Vertragsinventar](api/README.md). Konkrete Eingabe- und Antwortschemas: [openapi.json](api/openapi.json). Dieses Handbuch beschreibt die zugehörigen Regeln und Beispiele.

## Änderungen ohne unbemerkten Datenverlust

1. Projekt oder Geräteliste lesen und den `ETag` einschließlich Anführungszeichen übernehmen.
2. Nur die gewünschten Felder als JSON senden und `If-Match` auf den gelesenen ETag setzen.
3. Bei Erfolg den neuen ETag übernehmen. Bei `412` oder `409` neu lesen und den Konflikt mit den beabsichtigten Änderungen abgleichen.

Die Version gilt für das gesamte Projekt: Eine Geräteänderung kann deshalb auch einen zuvor gelesenen Stammdatenstand veralten lassen. Parallele API- und Browseränderungen nutzen dieselbe Versionsprüfung. API-Anfragen wechseln niemals das aktuelle Browserprojekt.

Beispiel, nachdem der Schlüssel lokal als `EDOKU_API_TOKEN` und die Serveradresse als `EDOKU_API_URL` gesetzt wurden:

```bash
curl --fail-with-body "$EDOKU_API_URL/api/v1/projects" \
  -H "Authorization: Bearer $EDOKU_API_TOKEN"

curl --fail-with-body -i "$EDOKU_API_URL/api/v1/projects/projekt_a" \
  -H "Authorization: Bearer $EDOKU_API_TOKEN"

curl --fail-with-body -X PATCH "$EDOKU_API_URL/api/v1/projects/projekt_a" \
  -H "Authorization: Bearer $EDOKU_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'If-Match: "projekt_a:7"' \
  --data '{"bearbeiter":"Beispielteam","stockwerke":["UG","EG","1. OG"]}'
```

Die Beispiel-ID und Version müssen durch die tatsächlichen Werte ersetzt werden.

Erlaubte Stammdaten: `projektname`, `projektnummer`, `auftraggeber`, `liegenschaft`, `baumassnahme`, `massnahmeNr`, `auftragsNr`, `auftragGewerk`, `ortDerAusfuehrung`, `ausfuehrendeFirma`, `firmenanschrift`, `bearbeiter`, `ortDatum`, `stockwerke`. Texte höchstens 2.000 Zeichen, `projektname` darf nicht leer sein. Stockwerke: höchstens 100 Texte zu je 100 Zeichen. Identität, Besitzer, Projektstatus und Dateipfade sind keine änderbaren Felder.

Gerätelisten liefern zusätzlich `fields` mit Feldnamen, Beschriftung und Pflichtfeldstatus des jeweiligen Leistungsbereichs. Der Agent liest vor dem Eintragen Listen und vorhandene Positionen und wählt die passende aktive Liste. Bei mehreren fachlich möglichen Zielen stellt er eine Rückfrage. Globale Gerätefelder: `hersteller`, `system`, `typ`, `beschreibung`, `abmessung`, `farbe`, `spannung`, `leistung`, `kategorie`, `funktionserhalt`, `lvPosition`, `bemerkung`; pro Liste sind nur deren `fields` zulässig. Fremde Felder ergeben `400 DEVICE_FIELD_MISMATCH`, inaktive Listen `409 INACTIVE_DEVICE_LIST`. Positionsnummern werden beim Anlegen serverseitig vergeben. Bestehende Positionen werden über ihre `pos` angesprochen. Mehrdeutige Listen-/Positionskennungen werden abgewiesen; ein Schreibzugriff konvertiert keine alten Listenformate. Die API prüft Struktur und Rechte; die fachliche Einordnung eines Geräts trifft der Agent anhand der Projektangaben und nötiger Benutzerantworten.

Dokumentvorschläge können `deviceReferences` enthalten: eine Liste von `{ listId, position, manufacturer, model, revision, variant }`. Gerätebezüge aus verknüpften Pflichtanforderungen werden ergänzt. Vor dem Einreichen muss das Gerät bereits im Projekt vorhanden sein; ein recherchiertes Datenblatt ist kein Nachweis dafür, dass das Gerät eingebaut wurde. Liste, Position, Hersteller und Modell werden bei Einreichung und Freigabe geprüft. Die GUI wählt die vorgeschlagenen Geräte vor und erlaubt eine Korrektur. Erst die Einzelübernahme einer PDF verknüpft sie atomar als `datenblattId` bzw. `bedienungsanleitungId` mit den ausgewählten Positionen. Diese Verknüpfungsfelder sind nicht über Geräte-PATCH beschreibbar. Bestehende abweichende Verknüpfungen ergeben `409 DEVICE_DOCUMENT_CONFLICT`; sie werden nicht überschrieben. Datenblatt und Anleitung bleiben separate Felder und erscheinen mit Kapitelverweisen im Geräte-PDF. Spätere Geräteänderungen und gelöste Verknüpfungen werden im Dokumentationsstatus gemeldet.

Projekt- und Exportanlage verlangen `Idempotency-Key` (8–128 Zeichen: Buchstaben, Ziffern, `_`, `-`). Derselbe Benutzer, Vorgang, Schlüssel und Inhalt liefern dieselbe Ressource; anderer Inhalt ergibt `409 IDEMPOTENCY_CONFLICT`, ein noch laufender Aufruf `409 OPERATION_IN_PROGRESS`. Für Gerätepositionen und Assistentenaufträge ist der Header aus Kompatibilitätsgründen optional und für zuverlässige Wiederholungen empfohlen. Eine erfolgreiche Positionswiederholung liefert das gespeicherte Ergebnis trotz altem ETag; anschließend den aktuellen Projektstand neu lesen. Ohne Schlüssel kann eine erneute POST-Anfrage ein neues Objekt erzeugen.

API-Projektanlage verändert das aktuelle Browserprojekt nicht und verlangt einen Schlüssel für alle eigenen Projekte. Neue Projekte werden bei aktivem SQLite-Projektspeicher dort aufgenommen. Leistungsbereichsauswahl verwendet `{"active":["<bekannter Bereich>"]}`. Ab API/MCP 3.1.0 sind mehrere Hersteller-/Systemkombinationen je Bereich möglich: `add=true` ergänzt, `selectionId` ändert gezielt und `enabled=false` deaktiviert mit Erhalt. Ohne Kennung werden mehrdeutige Änderungen abgewiesen. Der Systemkatalog liefert kleine Seiten über die Filter `serviceArea` und `manufacturer`; die Schreibantwort enthält nur Kennungen und Zähler. [Vertrag und Kompatibilität](MEHRFACH_SYSTEMAUSWAHL.md). Systemauswahl und Dokumentauswahl verwenden `{"items":[...]}`; die genauen Felder stehen im OpenAPI-Vertrag. Hersteller-/Systemwerte müssen aus den Projektvorgaben stammen. Pflichteinträge dürfen nicht ausgeblendet werden.

## Fehler

```json
{"success":false,"error":{"code":"PRECONDITION_FAILED","message":"Projekt wurde zwischenzeitlich geändert. Bitte neu lesen."},"requestId":"…"}
```

| Status | Bedeutung |
| --- | --- |
| 400 | Ungültiges JSON, unerlaubtes Feld oder ungültiger Wert |
| 401 | Schlüssel fehlt, ist ungültig, widerrufen oder abgelaufen; Konto gesperrt oder Passwort geändert |
| 403 | Fehlendes Recht, Viewer-Schreibversuch oder globaler API-Lesemodus (`API_READ_ONLY`) |
| 404 | Unbekanntes/nicht freigegebenes Projekt, unbekannter Endpunkt oder mehrdeutige Gerätekennung |
| 409 | Gleichzeitige Speicheränderung oder fehlender aktivierter SQLite-Projektspeicher |
| 412 | `If-Match` entspricht nicht der gelesenen Projektversion |
| 413 / 415 | Anfrage zu groß / falscher Inhaltstyp |
| 428 | Erforderlicher `If-Match` oder `Idempotency-Key` fehlt |
| 429 | Anfragelimit erreicht |
| 503 / 507 | API ausgeschaltet (`API_DISABLED`), Konfiguration/Sicherheitsprotokoll nicht verfügbar / Speicherbudget erreicht |

Interne Fehler geben keine Dateipfade, Datenbankdetails oder Zugangsdaten zurück. Erlaubte API-Änderungsversuche und ihr Ergebnis sowie Schlüsselanlage/-widerruf werden im vorhandenen Sicherheitsprotokoll erfasst. Abgelehnte Authentifizierungen und Lesezugriffe werden in dieser ersten Version nicht vollständig protokolliert. Das Protokoll speichert keine Schlüssel oder Nutzdaten. Änderungen an den globalen API-Vorgaben werden ebenfalls als Einstellungsänderung protokolliert.

## MCP einrichten

Für den Host-Adapter zur vorhandenen Docker-Anwendung und die Verbindung mit Codex gibt es eine eigene Anleitung: [Docker-MCP mit Codex](CODEX_DOCKER_MCP.md). Der ältere Docker-Starter bleibt ein Rückweg. Die Einrichtung benötigt keinen zusätzlichen MCP-Netzwerkport; die GUI-Einzelfreigabe bleibt verpflichtend.

Die GUI unter **Einstellungen → API & MCP → MCP-Verbindung einrichten** kann die folgende Konfiguration erstellen und kopieren. Der Skriptpfad bezieht sich auf den Rechner des MCP-Clients, nicht auf den Server oder dessen Container.

Der MCP-Adapter ist ein lokaler Prozess über **stdio**: Der Client startet ihn und kommuniziert über die Prozesseingabe/-ausgabe. Er öffnet keinen zusätzlichen Netzwerkport und greift nicht unmittelbar auf die edoku-Datenbank oder den serverseitigen Projektbestand zu. Für Dateivorschläge liest er ausschließlich lokale Dateien aus dem ausdrücklich eingestellten `EDOKU_MCP_DOCUMENT_ROOT`. Node.js ab 22.13 und installierte Projektabhängigkeiten verwenden.

Beispiel für einen MCP-Client, der eine `mcpServers`-Konfiguration unterstützt:

```json
{
  "mcpServers": {
    "edoku": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/ZU/edoku/scripts/edoku-mcp.js"],
      "env": {
        "EDOKU_API_URL": "http://127.0.0.1:3000",
        "EDOKU_API_TOKEN": "HIER_DEN_EIGENEN_API_SCHLUESSEL_EINTRAGEN"
      }
    }
  }
}
```

Pfad, Adresse und Schlüssel an die Installation anpassen. `EDOKU_API_URL` ist die Serveradresse ohne `/api/v1`, weitere Pfade oder Parameter. Für entfernte Server verlangt der Adapter HTTPS; HTTP ist nur bei `localhost`, `127.0.0.1` oder `[::1]` erlaubt. Weiterleitungen werden nicht verfolgt. Zeitlimit: 15 Sekunden; Antwortlimit: 2 MiB. Große Ergebnisse mit kleinerem `limit` abfragen.

Alle 37 Werkzeuge mit Pflichtargumenten und Zuordnung zum HTTP-Vertrag: [MCP-Vertragsinventar](api/README.md#mcp-zuordnung). Vollständige Schemas: [mcp-tools.json](api/mcp-tools.json).

Optional `EDOKU_MCP_ALLOW_WRITES` in der Prozessumgebung auf den exakten Wert `true` setzen. Der aktuelle Quellstand stellt dann 24 Schreibwerkzeuge bereit. `edoku_patch_attachment` korrigiert Kategorie und Metadaten unter ETag-Schutz; eine Kategorienänderung setzt automatisch das Standardkapitel der neuen Kategorie. Interne Projekttexte sowie Dateien mit Geräteverknüpfungen lassen sich darüber nicht versehentlich umsortieren. `edoku_remove_internal_project_document` ist auf interne Assistenten-Projekttexte beschränkt, verlangt den Projekt-ETag plus `confirm: true` und verschiebt die Datei wiederherstellbar in den Papierkorb. Kundenunterlagen und normale Anhänge bleiben geschützt. Insgesamt sind es 13 Lese- beziehungsweise 37 Werkzeuge mit Schreibfreischaltung. Der Schlüssel benötigt die jeweils passenden Rechte. Fachliche Projektänderungen verlangen den gelesenen ETag; reine Auftrags-/Dateivorbereitung verändert den Projektbestand nicht und benötigt keinen ETag. Es gibt kein Freigabewerkzeug. Dateivorschläge verlangen zusätzlich einen freigegebenen lokalen Dokumentordner; [Einrichtung und Pflichtfreigabe](DOKU_ASSISTENT.md). Projekt- und Exportanlage verlangen `requestId` als stabilen Wiederholungsschlüssel. Für Positionen und Aufträge erzeugt der Adapter ohne eigene `requestId` einen stabilen Schlüssel aus den Parametern. Für einen ausdrücklich neuen, sonst identischen Vorgang eine neue `requestId` verwenden. Der Adapter wiederholt keine Schreibanfrage automatisch.

Den Prozess direkt mit `node scripts/edoku-mcp.js` starten; `npm run mcp` ist für manuelle Starts vorhanden, kann aber npm-Ausgaben auf stdout erzeugen und gehört deshalb nicht als Transportkommando in die MCP-Konfiguration. Geheimnisse außerhalb des Repositories verwahren. Der lokale Codex-Zugang ist separat eingerichtet und tatsächlich geprüft; Einzelheiten und Grenzen stehen in [CODEX_DOCKER_MCP.md](CODEX_DOCKER_MCP.md).

SDK-Grundlage: [offizieller MCP-Serverleitfaden](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server.html), [stdio-Transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html).

## Hintergrundexport und Prüfbericht

`POST /projects/{projectId}/export-jobs` nimmt `{}` oder `{"assistantJobId":"<Auftrag>"}` entgegen und antwortet mit `202`. Ohne Auftragsbindung werden die aktuell offenen Assistentenaufträge des Projekts berücksichtigt. Der Status unterscheidet `queued`, `waiting_input`, `waiting_review`, `running`, `succeeded`, `incomplete`, `failed`, `cancelled` und `stale`. Erst `succeeded` bietet Dateien an. Eine abgelehnte Pflichtunterlage bleibt eine Lücke. Der Arbeiter setzt keine Benutzerantwort und erteilt keine Freigabe.

Jeder Erzeugungsversuch erhält einen eigenen Ordner unter `output/runs/<Export-ID>_a<Versuch>`. Projektversion, Freigabestand, Quelldateien und Zugangsrechte werden vor Veröffentlichung erneut geprüft. Lease und Wartestand liegen in SQLite; ein abgelaufener Prozessbesitz wird nach Neustart übernommen. Abbruch verhindert Veröffentlichung, beendet jedoch keinen gerade laufenden PDF-Rechenschritt sofort. Limits: 20 offene Aufträge pro Benutzer, höchstens zwei aktive Prozesse insgesamt und einer pro Benutzer; bis 1.000 Quelldateien/512 MiB Quellen und 2 GiB pro Ausgabedatei.

PDF, ZIP und `DOKUMENTATIONSBERICHT.json` besitzen SHA-256-Prüfsummen. Der Bericht enthält Projektversion, erfüllte Anforderungen, Quellen-Prüfsummen und technische Vollständigkeit; er bleibt ausdrücklich `professionalApproval: "not_assessed"`. `current` vergleicht die Projektversion, historische Ausgaben bleiben als solche abrufbar. Downloads prüfen den Dateiinhalt erneut. Quelldateien außerhalb der edoku-Abläufe zu verändern ist kein unterstützter Änderungsweg.

## Prüfung und weiterer Ausbau

`npm run test:api` prüft den echten HTTP-Server und einen getrennten MCP-Prozess mit künstlichen Konten und Projekten, einschließlich Schlüsseln, Rollen, Versionskonflikten, Geräteprojektion, CSRF und Sicherheitsprotokoll. `npm run test:workflow` ergänzt den vollständigen künstlichen Ablauf mit unabhängiger ZIP-/PDF-Prüfung, Wiederanlauf und Änderungen während der Erzeugung. Erfolgreiche HTTP-Antworten werden gegen die aus dem tatsächlichen OpenAPI-Vertrag erzeugten Antwortschemas geprüft. Beide Gruppen gehören zu `npm test`. Wie alle edoku-Tests nur im isolierten Checkout/Container ohne Original-Laufzeitdaten ausführen; siehe [Tests](TESTS.md).

Noch geplant, nicht umgesetzt:

- Projekte archivieren/löschen; Projektanlage und ihre Wiederholungssicherheit sind umgesetzt.
- Brandschutzdaten fachlich validiert schreiben; Auswahl von Leistungsbereichen/Systemen/Matrix ist umgesetzt.
- Allgemeiner Dateidownload/-verwaltung; Vorschlagsupload und geprüfte Exportdownloads sind umgesetzt.
- Optional Webhooks, stabile Cursor für große Abgleiche und verteilte Limits bei mehreren Serverprozessen.
- Remote-MCP über Streamable HTTP mit passender OAuth-Anbindung und Clientprüfung. Der lokale stdio-Adapter ist kein öffentlich erreichbarer ChatGPT-Connector.
- Weitergehende Bedien-/Betriebsabnahme und Veröffentlichung. Die tatsächliche lokale Codex-Verbindung ist inzwischen lesend und im Projektablauf geprüft; Remote-Clients und Online-Bereitstellung sind damit nicht abgenommen.

## Bisherige Demo-API

Die älteren Endpunkte bleiben getrennt unter `/api`: `/health`, `/projects`, `/projects/{id}`, `/service-areas`, `/service-areas/{id}`, `/device-lists`, `/device-lists/{id}`, `/documents`, `/documents/{id}`, `/exports/status`. Sie liefern weiterhin neutrale Daten aus `src/data/demoStore.js`, verlangen keinen Schlüssel und schreiben keine Benutzerprojekte. `/api/health` beschreibt diese Demo; für die tatsächliche Betriebsbereitschaft `/ready` verwenden.

`npm run smoke:api` prüft weiterhin ausschließlich die zwölf bisherigen Demo-Aufrufe. Das ist kein Test der neuen Integrations-API.


## Bestandsweite Datenblattprüfung

`GET /api/v1/projects/{projectId}/datasheet-coverage` prüft alle aktiven Artikel unabhängig von Einzelanforderungen; `POST /api/v1/projects/{projectId}/datasheet-searches` speichert belegte Nichtfunde oder unklare Varianten unter `If-Match`. MCP: `edoku_datasheet_coverage` und `edoku_record_datasheet_search`. [Zustände, Rechte, Umfang und Ablauf](DATENBLATTPRUEFUNG.md).


## Belegte Korrektur bestehender Geräteanforderungen

`PATCH /api/v1/projects/{projectId}/assistant/jobs/{jobId}/requirements/{requirementId}` bzw. `edoku_correct_requirement_devices` ist der ausdrückliche Korrekturweg für falsch zugeordnete Geräteanforderungen. Benötigt Projekt-ETag (`If-Match`), gelesene Auftragsversion `version`, `devices`, `category` und tatsächlichen Benutzerbeleg `evidence`. Rechte: `assistant:write`, `projects:write`, `devices:read`.

Eine Anforderung kann jetzt entweder den bisherigen Einzelbezug `device` oder mehrere Bezüge `devices` besitzen. Mehrere Geräte müssen gemeinsam durch das freigegebene Original abgedeckt sein; ein passendes Original für nur eines der Geräte erfüllt die Gesamtanforderung nicht. Alte Einzelbezüge bleiben kompatibel.

Die Korrektur erhält ID und Titel. Sie ändert ausschließlich den Anforderungsbezug; keine Geräte, Anhänge, PDF-Bytes, Vorschläge, Sichtungen oder Freigaben. Zulässig sind aktive reale Positionen desselben bestätigten Artikels; reine Typreferenzen, historische Muster, doppelte Ziele und abweichende Artikel werden abgewiesen. Eine Altkategorie Nachweise darf nur bei ausdrücklich als Datenblatt benannter Anforderung nach Datenblätter berichtigt werden; andere Änderungen der Unterlagenart sind gesperrt. Offene Vorschläge der betroffenen Anforderung müssen zuerst geprüft oder bewusst abgelöst werden.

Der ursprüngliche und korrigierte Anforderungsstand samt Benutzerbeleg und Zeitpunkt werden atomar in `projekt.assistantRequirementCorrections` protokolliert. Versionkonflikte ergeben 412; Historie und Anforderung werden bei einem Speicherfehler gemeinsam zurückgerollt. Der allgemeine Auftrags-PATCH darf vorhandene Anforderungen weiterhin nicht still ändern.
