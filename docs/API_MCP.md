# API und MCP

edoku bietet eine geschützte HTTP-API und einen lokalen MCP-Adapter. Beide verwenden dieselben Projektdienste, API-Schlüssel und Rechte. Die GUI nutzt dieselben Fachregeln. edoku berechnet den nächsten Arbeitsschritt; ein externer Agent führt ihn aus. Ein eingebautes Sprachmodell oder automatischer Recherche-Agent wird nicht gestartet.

API/MCP **3.9.0**: **64 HTTP-Operationen, 55 MCP-Werkzeuge (22 Lesen / 33 Schreiben)**. Maßgeblich für Eingaben, Rechte und Grenzen ist die [erzeugte Referenz](api/README.md), nicht ein Chatverlauf.

## Einstieg

1. edoku mit dauerhaften Datenordnern starten.
2. In Einstellungen → API & MCP einen eigenen Schlüssel mit benötigten Rechten und möglichst passender Projektbegrenzung erstellen.
3. [MCP-Client verbinden](CODEX_DOCKER_MCP.md) oder die [HTTP-API](API.md) verwenden. Schlüssel ausschließlich privat speichern.

## Aufgabensteuerung für einen Agenten

Der Agent beginnt mit `edoku_next_action` im standardmäßig kompakten Modus. edoku liefert vorhandene Informationen, offene Aufgaben und die Ausführungsentscheidung. Bei `continue` unabhängig lösbare Aufgaben weiterbearbeiten; offene Dateifreigaben blockieren andere Artikel nicht. Verbleibende notwendige Rückfragen thematisch bündeln. Benutzerstopp und vereinbarte Budgets bleiben verbindlich.

Materialquelle und Artikelzuordnung getrennt belegen. Zuerst gespeicherte Fakten, vorhandene Geräte und freigegebene Unterlagen nutzen. Neue Chatentscheidungen über `edoku_record_chat_decision` mit tatsächlichem Benutzerbeleg speichern; Vermutungen, Einbaudaten oder Freigaben nicht erfinden. Details nur gezielt nach Abschnitt/Ziel und in kleinen Seiten abrufen. Unveränderte große Antworten nicht wiederholt laden.

Projektbezogene Materialausschlüsse vor Übernahme und Recherche berücksichtigen. Quellenfehler und bekannte Blocker ohne neue Anhaltspunkte nicht wiederholt prüfen. Mehrdeutige Artikel offenlassen und unabhängige Aufgaben fortsetzen.

## Herstellerunterlagen und Dateivorschläge

Hersteller-Produktseite ermitteln, dort verlinktes Original-PDF verwenden und durch edoku auf Artikel-/Variantenpassung prüfen lassen. Linkermittlung und Produktprüfung ersetzen keine manuelle Übernahme. [Prüfablauf](PRODUKTPRUEFUNG.md).

Dateien werden ausschließlich vorgeschlagen. Erst tatsächliche Sichtung und manuelle Einzelbestätigung in der GUI übernehmen sie. API und MCP haben kein Freigabewerkzeug. Ein Agent kann gegenstandslose offene Vorschläge mit Begründung und Beleg zurückziehen; das ist weder eine Benutzerablehnung noch eine Freigabe. Bereits getroffene Dateientscheidungen bleiben geschützt.

## Versionen, Konflikte und Grenzen

Schreibaufrufe benötigen die im Vertrag genannten Projekt-/Auftragsversionen; geeignete Operationen zusätzlich Wiederholungsschlüssel. Ein Versionskonflikt erfordert einen frischen gezielten Stand, kein blindes Wiederholen. Gezieltes Löschen/Wiederherstellen und vollständiger Projektreset haben eigene Vorschau-, Bestätigungs- und Sicherungsbedingungen und benötigen einen ausdrücklichen Auftrag.

Die tatsächlichen Software-, API- und MCP-Versionen stehen unter Einstellungen → System. OpenAPI 3.1.0 bezeichnet das Format und ist keine API-Version. Lokaler Adapter und Online-API sind unterschiedliche Verbindungen; entfernte API-Verbindungen benötigen HTTPS. Remote-MCP/OAuth ist nicht Bestandteil dieses lokalen Adapters.

[HTTP-Handbuch](API.md) · [Architektur](TECHNIK.md) · [Tests](TESTS.md) · [Sicherheit](SICHERHEIT.md).
