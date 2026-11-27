# Docker und MCP-Client verbinden

edoku läuft als Webanwendung im Docker-Container. Lokal stellt ein Node.js-Prozess die Werkzeuge für einen MCP-Client wie Codex bereit und spricht über die geschützte HTTP-API mit edoku. Auf einem VPS kann der Client edoku alternativ direkt über den optionalen HTTPS-MCP-Endpunkt erreichen; dafür braucht er keinen lokalen Starter. Der Client benötigt dafür keine direkte Datenbankverbindung.

## Remote-MCP auf dem VPS

1. edoku hinter einem vertrauenswürdigen HTTPS-Proxy betreiben. `APP_ORIGIN=https://edoku.example.org` ohne Pfad oder Zugangsdaten setzen, `TRUST_PROXY` passend zum tatsächlich vorgeschalteten Proxy konfigurieren. Den internen Anwendungsport nicht öffentlich freigeben. Host und Authorization unverändert an edoku weitergeben, Streaming erlauben und `/mcp` nicht zwischenspeichern. [Coolify](COOLIFY.md).
2. Als Systemadmin unter **Einstellungen → API & MCP → Erweitert** API-Zugang und **Remote-MCP per HTTPS erlauben** einschalten. Standardmäßig bleibt Remote-MCP aus. Vorhandene Schlüssel werden weder erneuert noch erweitert.
3. Unter **Einrichten → Remote per HTTPS-URL** öffentliche Serveradresse und eigenen API-Schlüssel eingeben. Ein Client mit URL und eigenen Bearer-Headern ist erforderlich. Die generische JSON-Konfiguration in das Format des jeweiligen Clients übertragen. Kein OAuth-Anmeldefluss.

```json
{
  "mcpServers": {
    "edoku": {
      "url": "https://edoku.example.org/mcp",
      "headers": { "Authorization": "Bearer DEIN_PRIVATER_API_SCHLUESSEL" }
    }
  }
}
```

Die URL ohne Parameter bietet nur Lesen. Für Änderungen `https://edoku.example.org/mcp?access=write` verwenden und zusätzlich passende Schlüsselrechte, Kontorolle und serverseitige Schreibfreigabe vorsehen. Schlüssel niemals als URL-Parameter oder in öffentlichen Dateien speichern. Die GUI zeigt Aktivierung und URL, bestätigt damit jedoch keine tatsächlich gestartete externe Verbindung.

Alle 58 Werkzeuge stehen im Schreibmodus zur Verfügung; jede tatsächliche Operation bleibt durch ihre API-Rechte und Projektgrenzen geschützt. Ohne Schreibmodus sind es 22 Lesewerkzeuge. Der Transport hält keine dauerhaften Sitzungen. Nach einem Serverneustart neu verbinden; Schreibanfragen mit unbekanntem Ergebnis erst im Projekt prüfen, bevor sie erneut ausgeführt werden.

Herstellerdatenblätter können durch Produktseite und PDF-URL geprüft und vorgeschlagen werden. Lokale Serverpfade werden über Remote-MCP nicht gelesen; optionale Eingangsordner gelten nur für die bestehenden lokalen Adapter. Jede Datei bleibt bis zur manuellen GUI-Einzelprüfung ein Vorschlag. Für andere Dateiarten ist kein allgemeiner Remote-Upload ergänzt.

Zuerst den kopierbaren lesenden Prüfauftrag ausführen: Initialisierung, alle Seiten von `tools/list`, `edoku_identity`. Anschließend im beauftragten Projekt mit `edoku_next_action` beginnen. HTTPS und tatsächliche Erreichbarkeit müssen auf dem Ziel-VPS separat geprüft werden. Eine HTTP-Adresse im Browser ist keine gültige Remote-Adresse.

## Voraussetzungen für den lokalen Adapter

- Laufendes edoku, eigene Anmeldung und erreichbare API.
- Eigener API-Schlüssel mit den erforderlichen Rechten; Projektbegrenzung empfohlen.
- Node.js 22 und die Paketabhängigkeiten aus dem Repository (`npm ci`).
- Für Dateiübergaben ein ausdrücklich freigegebener Eingangsordner. Für Webrecherche benötigt der Agent zusätzlich Zugriff auf Herstellerquellen.

## Verbindung konfigurieren

Unter **Einstellungen → API & MCP** sind Verbindung, Einrichten, Zugänge, Werkzeuge und erweiterte Serveroptionen getrennt. Der Einrichtungsassistent führt durch Betriebsart, Zugang und Konfiguration. Bestehende Schlüssel werden dabei nicht verändert. Berechtigungsprofile setzen nur die Auswahl im Formular für einen neuen Schlüssel; erst dessen ausdrückliches Anlegen erzeugt einen Zugang. Das vollständige Profil umfasst auch geschützte Lösch-/Resetfunktionen. Jede Datei bleibt manuell einzeln freizugeben.

Im MCP-Client einen lokalen STDIO-Server mit dem Programm `node` und dem Argument `/pfad/zu/edoku/scripts/edoku-mcp.js` einrichten. Den absoluten Pfad der eigenen Installation verwenden. Folgende Umgebungswerte privat im Client bereitstellen:

| Variable | Bedeutung |
| --- | --- |
| `EDOKU_API_URL` | API-Ursprung, lokal beispielsweise `http://127.0.0.1:3000` |
| `EDOKU_API_TOKEN` | Eigener geheimer API-Schlüssel |
| `EDOKU_MCP_ALLOW_WRITES` | `true` nur bei ausdrücklich gewünschtem Schreibzugriff; API-Rechte gelten zusätzlich |
| `EDOKU_MCP_DOCUMENT_ROOT` | Freigegebener absoluter Eingangsordner für lokale Dateien |

Für entfernte API-Ursprünge HTTPS verwenden. Keine Schlüssel in Programmargumente oder URLs eintragen. Server-/Schreibrechte in edoku und Clientfreigabe sind getrennte Schutzmechanismen. Container und Client müssen einen übergebenen Dateipfad im jeweils freigegebenen Bereich erreichen können; die API validiert Dateigrenzen und Quellen zusätzlich.

### Lokaler Docker-Starter

Alternativ erzeugt der Assistent eine Konfiguration für `python3` mit dem absoluten Pfad zu `scripts/edoku-mcp-docker.py` auf dem Client-Rechner. Dort sind Python 3 und Docker-Zugriff nötig; Node.js und der Adapter laufen im vorhandenen edoku-Container. Der Starter erstellt oder aktualisiert keine Container und keine Zugänge.

Die erzeugte Konfiguration setzt ausdrücklich `EDOKU_MCP_LAUNCH_MODE=environment`, `EDOKU_MCP_CONTAINER` und die übrigen obigen Verbindungswerte. Die API-Adresse gilt aus Sicht des Containers, bei lokaler edoku-Instanz normalerweise `http://127.0.0.1:3000`. Der optionale Dokumentordner muss im Container existieren und zuvor ausdrücklich schreibgeschützt eingebunden sein; der Assistent erstellt keine Datenanbindungen. Die Hersteller-PDF-Prüfung über die API benötigt diesen lokalen Uploadordner nicht.

Der bisherige Aufruf des Docker-Starters mit privater Verbindungsdatei bleibt kompatibel: ohne den neuen Modusschalter weiterhin die private Datei `~/.codex/edoku/connection.json`, alternativ ein ausdrücklich als Argument genannter Pfad. Besitzer- und Dateirechteprüfungen bleiben erhalten. Bestehende Host-Starter und Client-Einträge werden nicht automatisch umgestellt. Der neue Modus übernimmt den Schlüssel über die Umgebung; er erscheint nicht in Programmargumenten. Nach einem Container-Neustart muss eine dort laufende STDIO-Verbindung im Client neu gestartet werden.

Der Assistent zeigt eine generische MCP-Konfiguration im JSON-Format. Diese Werte im passenden Konfigurationsformat oder Einrichtungsformular des jeweiligen Clients übernehmen. Die Konfiguration enthält den Schlüssel; sie wird nur im Browser erstellt und nicht von edoku gespeichert. Bei Änderungen wird eine vorher erzeugte Konfiguration verworfen. „Geheimnisse ausblenden“ beziehungsweise das Verlassen der Seite entfernt die angezeigten Schlüsselwerte aus der Ansicht.

## Diagnose und Werkzeugübersicht

„Server & Rechte prüfen“ prüft ausschließlich lesend den geöffneten edoku-Server, seinen API-Schalter und optional den Status eines eigenen Schlüssels, das benötigte Profil und eine eigene Projektzuordnung. Es werden weder Schlüssel angelegt/erneuert noch Projekte geändert. Der Einrichtungsassistent kann den eingegebenen Schlüssel zusätzlich über die vorhandene API-Identitätsabfrage prüfen: ausschließlich auf dieser Instanz, ohne Weiterleitung an fremde Server. Bei fremder Zieladresse im Client oder auf dem Zielserver prüfen.

Ein erreichbarer Server oder aktiver Schlüssel bestätigt noch keine laufende externe MCP-Verbindung. Dafür nennt die GUI ausdrücklich den ungeprüften Clientstatus und bietet einen kopierbaren lesenden Prüfauftrag. Keine automatische Clientinstallation oder Hintergrund-Verbindung.

Die Werkzeugübersicht zeigt den generierten Serverkatalog, gruppiert und durchsuchbar, mit höchstens zwölf Einträgen pro Abruf. Sie unterscheidet Lesen, Ändern und Lösch-/Wiederherstellungsfunktionen. Die Anzeige führt keine Werkzeuge aus und ist keine neue Rechtevergabe: tatsächlich nutzbare Funktionen hängen zusätzlich von Client-Schreibfreigabe, API-Schlüssel, Servervorgaben, Projektgrenzen und fachlichen Schutzprüfungen ab.

## Arbeiten und Verbindung prüfen

Werkzeugkatalog laden und zunächst einen erlaubten Leseaufruf ausführen. Der Agent folgt anschließend `edoku_next_action`. Bei geändertem Werkzeugkatalog die edoku-MCP-Verbindung im Client neu verbinden. Bei vorübergehend nicht erreichbarem Backend schreibende Anfragen nicht blind wiederholen.

Materialliste und Zielprojekt im Agentenchat bereitstellen. Der Agent darf belegte Informationen ergänzen und Dateien vorschlagen. Jede neue Datei bleibt bis zur manuellen GUI-Einzelprüfung unübernommen. Kein Freigabewerkzeug und kein eingebauter KI-Agent. [Ablauf](API_MCP.md), [Dateiprüfung](DOKU_ASSISTENT.md).

Private Verbindungseinstellungen und Schlüssel nicht ins Repository übernehmen. Vor Softwareupdates eine [Vollsicherung mit Wiederherstellungsprobe](BETA_BETRIEB.md) durchführen; bestehende Konten und Dateien behalten. Remote-MCP/OAuth ist nicht Bestandteil des lokalen STDIO-Adapters.
