# Doku-Assistent

Der Doku-Assistent zeigt die offenen Aufgaben des aktuell geöffneten Projekts. Es gibt im Assistenten keine Projektwahl. Material ergänzen, notwendige Angaben beantworten und vorgeschlagene Dateien einzeln prüfen stehen im Vordergrund. Ein externer Agent kann über [MCP](API_MCP.md) mitarbeiten; edoku startet selbst keinen KI-Dienst.

## Arbeitsliste

Die Kopfzeile zeigt das Projekt, die Navigation die offenen Punkte und Dateiprüfungen. Suche und Filter trennen direkt bearbeitbare Aufgaben, Dateien, Angaben und wartende Punkte. Details erscheinen erst beim Öffnen einer Aufgabe. Einstellungen enthalten Materialausschlüsse und die MCP-Verbindung; Brandschutzhinweise sind aufklappbar.

Verbindungsklemmen, Kabel/Leitungen und Befestigungsmaterial lassen sich projektbezogen ausnehmen. Das steuert neue Materialübernahme, Recherche und erzeugte Gerätelisten; gespeicherte Positionen und frühere Dateientscheidungen bleiben erhalten. Technische Systemteile nicht pauschal als Verbrauchsmaterial behandeln.

Eine Materialliste im Agentenchat bereitstellen. „Material hinzufügen“ beziehungsweise „Auftrag formulieren“ ergänzt Text im bestehenden Auftrag; dies startet keinen eigenen Hintergrundagenten. Tatsächliche Einbauangaben belegen, fehlende Angaben offenlassen. Antworten werden im Auftrag gespeichert und beeinflussen den nächsten Plan.

## Dateien einzeln prüfen

1. Einen Vorschlag öffnen und das tatsächliche PDF oder Bild lesen.
2. Quelle, Artikel-/Variantenpassung, Kategorie und Zuordnung prüfen und bei Bedarf korrigieren.
3. Die Sichtung ausdrücklich bestätigen und genau diese Datei übernehmen oder begründet ablehnen.

Keine Sammelfreigabe und keine vorausgewählte Sichtungsbestätigung. API und MCP können keine Datei freigeben. Ein Vorschlag ist noch kein Projektanhang und erfüllt noch keine Dokumentpflicht.

Nach einer Entscheidung folgt die nächste offene Datei hinter der aktuellen Position, ohne automatischen Rücksprung zum Anfang. Frühere übersprungene Dateien bleiben offen und sind über die Dateiliste erreichbar. Jede nächste Datei benötigt eine neue Sichtung und Einzelbestätigung. Der Wechsel ohne vollständiges Neuladen ändert diese Bedingungen nicht.

Gegenstandslose offene Vorschläge lassen sich mit Begründung zurückziehen. Das ist keine Ablehnung wegen des Inhalts und keine Freigabe. Originale und Verlauf bleiben erhalten; bereits entschiedene Vorschläge sind geschützt.

## Angaben, Wartezustände und Ausgabe

Notwendige Angaben im Seitenbereich beantworten. Zurückstellen benötigt Grund und gegebenenfalls eine Wiederaufnahmebedingung; es erfüllt keine Pflichtunterlage. Ein neuer passender Beleg kann die Bearbeitung wieder ermöglichen. Einzelne Blocker und offene Freigaben sperren keine unabhängigen Artikelrecherchen.

Dateien, Datenblätter, Ausgabe und Verlauf haben eigene Ansichten. Geräte besitzen getrennte Zuordnungen für Anleitung und Datenblatt. Vor Hintergrundexport werden Pflichtangaben, Dateifreigaben und passende Gerätebeziehungen geprüft. Projekttexte können intern bleiben; unvollständige Entwürfe erfüllen keine Pflicht. Ein technisch erzeugter Export ersetzt keine fachliche Abnahme.

Für Brandschutzabschottungen werden ausgefüllte Übereinstimmungsbestätigung, passende Montageanleitung und Zulassungs-/Prüfnachweis systembezogen betrachtet. Herstellerformular vor Eigenformular; System, Einbau und tatsächliche Abmessungen nicht erfinden. Anforderungen anderer Brandschutzarten nicht pauschal übertragen.

[Produktprüfung](PRODUKTPRUEFUNG.md) · [Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) · [API/MCP](API_MCP.md).
