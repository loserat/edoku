# Docker und MCP-Client verbinden

edoku läuft als Webanwendung im Docker-Container. Ein lokaler Node.js-Prozess stellt die Werkzeuge für einen MCP-Client wie Codex bereit und spricht über die geschützte HTTP-API mit edoku. Der Client benötigt dafür keine direkte Datenbankverbindung.

## Voraussetzungen

- Laufendes edoku, eigene Anmeldung und erreichbare API.
- Eigener API-Schlüssel mit den erforderlichen Rechten; Projektbegrenzung empfohlen.
- Node.js 22 und die Paketabhängigkeiten aus dem Repository (`npm ci`).
- Für Dateiübergaben ein ausdrücklich freigegebener Eingangsordner. Für Webrecherche benötigt der Agent zusätzlich Zugriff auf Herstellerquellen.

## Verbindung konfigurieren

Im MCP-Client einen lokalen STDIO-Server mit dem Programm `node` und dem Argument `/pfad/zu/edoku/scripts/edoku-mcp.js` einrichten. Den absoluten Pfad der eigenen Installation verwenden. Folgende Umgebungswerte privat im Client bereitstellen:

| Variable | Bedeutung |
| --- | --- |
| `EDOKU_API_URL` | API-Ursprung, lokal beispielsweise `http://127.0.0.1:3000` |
| `EDOKU_API_TOKEN` | Eigener geheimer API-Schlüssel |
| `EDOKU_MCP_ALLOW_WRITES` | `true` nur bei ausdrücklich gewünschtem Schreibzugriff; API-Rechte gelten zusätzlich |
| `EDOKU_MCP_DOCUMENT_ROOT` | Freigegebener absoluter Eingangsordner für lokale Dateien |

Für entfernte API-Ursprünge HTTPS verwenden. Keine Schlüssel in Programmargumente oder URLs eintragen. Server-/Schreibrechte in edoku und Clientfreigabe sind getrennte Schutzmechanismen. Container und Client müssen einen übergebenen Dateipfad im jeweils freigegebenen Bereich erreichen können; die API validiert Dateigrenzen und Quellen zusätzlich.

## Arbeiten und Verbindung prüfen

Werkzeugkatalog laden und zunächst einen erlaubten Leseaufruf ausführen. Der Agent folgt anschließend `edoku_next_action`. Bei geändertem Werkzeugkatalog die edoku-MCP-Verbindung im Client neu verbinden. Bei vorübergehend nicht erreichbarem Backend schreibende Anfragen nicht blind wiederholen.

Materialliste und Zielprojekt im Agentenchat bereitstellen. Der Agent darf belegte Informationen ergänzen und Dateien vorschlagen. Jede neue Datei bleibt bis zur manuellen GUI-Einzelprüfung unübernommen. Kein Freigabewerkzeug und kein eingebauter KI-Agent. [Ablauf](API_MCP.md), [Dateiprüfung](DOKU_ASSISTENT.md).

Private Verbindungseinstellungen und Schlüssel nicht ins Repository übernehmen. Vor Softwareupdates eine [Vollsicherung mit Wiederherstellungsprobe](BETA_BETRIEB.md) durchführen; bestehende Konten und Dateien behalten. Remote-MCP/OAuth ist nicht Bestandteil des lokalen STDIO-Adapters.
