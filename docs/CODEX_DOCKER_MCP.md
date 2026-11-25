# edoku in Docker mit Codex verbinden

Stand 22.11.2026: App `0.2.0-beta.1`, API/MCP `3.3.0`, 50 Werkzeuge. [Versionen](VERSIONIERUNG.md) · [aktueller Stand](AKTUELLER_STAND.md) · [Fakten und Abhängigkeiten](FAKTEN_UND_ABHAENGIGKEITEN.md). Datierte frühere Nachweise darunter behalten ihren damaligen Stand.

Aktualisierung vom 21.11.: Host-MCP **2.3.0**, weiterhin 49 Werkzeuge; HTTP-API 2.2.0 und Docker unverändert. `edoku_propose_document` kann direkte Hersteller-PDF-Adressen über `metadata.sourceUrl` selbst laden; `filePath` ist optional. Damit funktionieren Vorschläge auch aus einem Agenten mit Browser-Container statt gemeinsamem Mac-Dateisystem. [Ablauf und tatsächlicher Nachweis](MCP_DATEIUEBERGABE.md).

Stand 21.11.2026: [Agentenvertrag 2.0](AGENTENVERTRAG.md) lokal aktiviert. Bestehende MCP-Verbindung einmal neu starten, damit kompakte Defaults, gezielte Detailargumente und neue Entscheidungswerkzeuge geladen werden. Katalogseiten vollständig per `nextCursor` verfolgen. Keine Änderung der bestehenden Schlüssel, Datenpfade oder manuellen Dateifreigaben.

Die aktuelle lokale Einrichtung vom 19.11.2026 verwendet den vorhandenen edoku-Container und einen stdio-MCP-Adapter auf dem Mac. Codex startet einen Python-Starter, der den Node-MCP-Prozess außerhalb des Containers startet und die lokale API anspricht. Dadurch übersteht die Verbindung Containerupdates. Docker, edoku und passendes lokales Node.js müssen verfügbar sein; ein zusätzlicher MCP-Port ist nicht erforderlich. Der frühere Docker-Starter bleibt als Rückweg erhalten.

## Daten und Dateifreigabe

Die vorhandenen Verzeichnisse `data`, `config`, `storage`, `output` und `templates` bleiben an denselben Stellen eingebunden. Der API-Zugang gehört einem edoku-Konto und erreicht ausschließlich dessen eigene freigegebene Projekte. Er ist kein allgemeiner Datenbankzugang.

Der zusätzliche Ordner `mcp-documents/` ist eine Eingangsablage für recherchierte Dateien. Er ist in Git und im Docker-Build ausgeschlossen und wird im Container **nur lesbar unter demselben absoluten Pfad** eingebunden. Deshalb verwendet der Agent denselben absoluten `filePath` auf dem Mac und im MCP-Werkzeug. Diese Eingangsablage gehört nicht zu den fünf Installations-Datenordnern; benötigte Recherchequellen bis zur Einreichung separat aufbewahren.

Eine Datei in diesem Ordner ist noch kein Projektanhang. `edoku_propose_document` legt sie als getrennten Vorschlag vor. Erst die angemeldete GUI kann nach Vorschau, ausdrücklicher Sichtungsbestätigung, Prüfsumme und Projektversionsprüfung die einzelne Datei übernehmen. Der MCP-Adapter besitzt kein Freigabewerkzeug.

## Lokale Codex-Konfiguration

`scripts/edoku-mcp-host.py` ist der aktuelle Adapter; die eingerichtete Startdatei liegt unter `~/.codex/edoku/launch-mcp.py`. Der ältere Adapter `scripts/edoku-mcp-docker.py` ist weiterhin vorhanden. Die bestehende private Datei `~/.codex/edoku/connection.json` enthält Eingangsordner und API-Schlüssel sowie die für den Rückweg behaltenen Docker-Angaben. Der Host-Adapter verwendet `token` und `documentRoot`; die Serveradresse ist für diese lokale Einrichtung `http://127.0.0.1:3000`. Ordner privat (0700), Verbindungsdatei nur für den Benutzer lesbar (0600). Zugangsdaten erscheinen weder auf stdout noch in Kommandoargumenten; stdout bleibt dem MCP-Protokoll vorbehalten.

Struktur der privaten Verbindungsdatei, ausschließlich mit dem eigenen Schlüssel befüllen:

```json
{
  "docker": "/usr/local/bin/docker",
  "container": "edoku_v1",
  "documentRoot": "/ABSOLUTER/PROJEKTPFAD/mcp-documents",
  "token": "HIER_DEN_EIGENEN_EDOKU_API_SCHLUESSEL_EINTRAGEN"
}
```

Die Einrichtung ergänzt in `~/.codex/config.toml` nur den Abschnitt `mcp_servers.edoku`; alle bisherigen Einstellungen bleiben erhalten. Der Schlüssel steht in der separaten privaten Datei und nicht in der TOML-Konfiguration. Vorher wird die bisherige Konfiguration privat gesichert.

```toml
[mcp_servers.edoku]
command = "/ABSOLUTER/PFAD/ZU/python3"
args = ["/ABSOLUTER/BENUTZERPFAD/.codex/edoku/launch-mcp.py"]
startup_timeout_sec = 30
tool_timeout_sec = 60
enabled = true
```

Die absoluten Programm- und Benutzerpfade sind rechnerabhängig. `codex mcp get edoku` prüft den registrierten Eintrag. Nach erstmaliger Einrichtung oder einer Änderung des Werkzeugkatalogs die MCP-Verbindung neu laden. Eine frische Verbindung liefert aktuell **50 Werkzeuge** mit MCP **3.3.0**, einschließlich `edoku_knowledge` und der erweiterten Fakten-/Fragenfelder. Bestehende Sitzungen können den früheren Katalog behalten. Der Containerwechsel allein erneuert diesen Clientkatalog nicht. Kleine Seiten und vollständige MCP-Cursor-Paginierung bleiben verbindlich; Daten oder Chats dafür nicht löschen.

## Gültigkeit und Verwendung

Der ausdrücklich freigegebene lokale Zugang gilt 30 Tage und erlaubt den vollständigen Doku-Ablauf für eigene Projekte: lesen, Projekte/Stammdaten/Geräte/Auswahl bearbeiten, Aufträge und Dateivorschläge vorbereiten und Hintergrundexporte verwalten. Benutzerkonten, globale Einstellungen und Dateifreigaben werden dadurch nicht zu MCP-Werkzeugen.

Schlüssel lassen sich unter **Einstellungen → API & MCP** widerrufen. Nach Ablauf einen neuen eigenen Schlüssel anlegen und ausschließlich den Wert in der privaten Verbindungsdatei aktualisieren. Passwortwechsel, Kontosperre und entzogene Rechte wirken ebenfalls auf den Zugang. Die privaten Codex-Zugangsdaten sind nicht Bestandteil der edoku-Vollsicherung; nach einer Wiederherstellung bei Bedarf einen neuen Schlüssel anlegen.

Beispielauftrag:

> Verwende edoku, um für mein Projekt eine Dokumentation vorzubereiten. Lies zuerst den Bestand und frage fehlende Angaben ab. Lege recherchierte Unterlagen im freigegebenen Eingangsordner ab und reiche jede Datei mit Quelle und Gerätebezug als Vorschlag ein. Warte auf meine Einzelentscheidungen in edoku. Bereite danach PDF und ZIP vor und melde konkrete verbleibende Lücken.

Die API und der MCP-Adapter recherchieren selbst nicht im Web; das übernimmt der verbundene Agent. Bereits beauftragte Hintergrundexporte können nach erfüllten Voraussetzungen unabhängig vom geöffneten Codex-Fenster weiterlaufen.

## Sicherung und Rückweg

Vor der Aktivierung werden alle fünf bestehenden Datenordner und das vorherige Abbild vollständig gesichert. Der neue Stand wird zuerst mit künstlichen Daten und anschließend auf einer Wiederherstellungskopie geprüft. Nach der Aktivierung werden Datenbanktabellen, Quelldateien und Konten verglichen und eine weitere Vollsicherung erstellt. Technische Prüfungen ersetzen keine fachliche Endabnahme.

Ein Rückweg verwendet das gesicherte Abbild und einen geprüften zusammengehörigen Datenstand. Seitdem neu entstandene Projekte, Dateien und Freigaben zuerst zusätzlich sichern; keine alte Datenbank über einen neueren Bestand kopieren. Details: [Update und Datensicherung](UPDATE.md), [API und MCP](API.md).


## Lokaler Host-Adapter nach Containeraktualisierungen

Für die verwaltete lokale Installation startet `~/.codex/edoku/launch-mcp.py` jetzt den Adapter `scripts/edoku-mcp-host.py`. Dieser lädt den bestehenden privaten Schlüssel und denselben freigegebenen Dokumentordner und startet den vorhandenen JavaScript-MCP-Adapter mit lokalem Node.js. edoku selbst bleibt im einzigen Docker-Container; die API-Adresse ist lokal `http://127.0.0.1:3000`. Schlüsseldateien müssen reguläre benutzereigene Dateien mit privaten Dateirechten sein. Schlüssel werden weder in Argumenten noch in Ausgaben ausgegeben.

Der MCP-Prozess läuft damit unabhängig vom edoku-Container. Ein bereits laufender Host-MCP-Prozess hat einen tatsächlichen Docker-Neustart mit unverändertem Projektstand überstanden. Während edoku nicht erreichbar ist, dürfen Schreibanfragen weiterhin nicht blind wiederholt werden. Eine bereits geschlossene alte Codex-Verbindung muss nach der Umstellung einmal neu verbunden werden; neue Backend-Updates trennen den Host-Adapter nicht mehr. Änderungen am MCP-Werkzeugkatalog können weiterhin eine erneute MCP-Verbindung benötigen.

Der bisherige private Docker-Starter bleibt als `~/.codex/edoku/launch-mcp.before-host-20261119.py` erhalten. Die private lokale Sicherung `backups/edoku-mcp-host-20261119.tar.gz` enthält beide Starter, den Host-Adapter mit Test und die unveränderte Verbindungsdatei; sie hat Dateirechte 0600. Sie darf wie die übrigen privaten Sicherungen nicht veröffentlicht werden. Der Host-Adapter ist eine zusätzliche lokale Datei und gehört nicht zum aktivierten Docker-Abbild.

Separater Test: `python3 scripts/test_edoku_mcp_host.py` (vier Fälle). Der echte Wiederverbindungsnachweis steht in `intern/internal-scope-20261119/host-mcp-restart-proof.json`.
# Hinweis bei altem Werkzeugkatalog

Historischer Fehlerfall vor 3.3.0: Liefert eine frische edoku-Verbindung 49 Werkzeuge, der bestehende Codex-Chat aber weiterhin 41, den tatsächlich zugehörigen Adapter und dessen Startzeit prüfen. Startkorrektur und sichere Neuverbindung sind unter [MCP-Katalog aktualisieren](MCP_KATALOG_AKTUALISIERUNG.md) dokumentiert. Keine Projekt- oder Chatdaten zur Fehlerbehebung löschen.
