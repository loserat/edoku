# Doku-Assistent

Ein Agent kann tatsächlich ausgeführte Schotts mit `edoku_add_firestop` erfassen und über `edoku_patch_firestop` gezielt ergänzen. Vorher Bestand abgleichen, Benutzerbeleg speichern und den Leistungsbereich Brandschutzabschottungen aktivieren. Die Materialposition des Schaums bzw. Steins ersetzt keinen physischen Schotteintrag. Nicht bekannte Systemwahl, Wandaufbau, Feuerwiderstand oder Einbaudaten bleiben offen. [Felder, Versionsschutz und Ablauf](API_MCP.md#tatsächliche-schotts-erfassen).

Der Doku-Assistent zeigt die offenen Aufgaben des aktuell geöffneten Projekts. Es gibt im Assistenten keine Projektwahl. Material ergänzen, notwendige Angaben beantworten und vorgeschlagene Dateien einzeln prüfen stehen im Vordergrund. Ein externer Agent kann über [MCP](API_MCP.md) mitarbeiten; edoku startet selbst keinen KI-Dienst.

## Arbeitsliste

Die Kopfzeile zeigt das aktuelle Projekt. Oben ist die nächste verfügbare Aktion direkt erreichbar: zuerst eine Datei einzeln prüfen, danach fehlende Angaben ergänzen oder Unterlagen und Zuordnungen ansehen. Diese Anzeige ordnet vorhandene GUI-Aktionen; die fachlichen Abhängigkeiten und der Agentenablauf werden weiterhin von edoku berechnet.

Die Arbeitsliste trennt **Dateien prüfen**, **Angaben ergänzen**, **Unterlagen & Zuordnungen** und **Wartet**. Suche und Filter mit Zählern helfen bei längeren Listen. „Aktiv“ blendet wartende Punkte aus; „Alle“ zeigt auch diese. Filter verändern keinen Aufgabenstatus. Sind nur wartende Punkte übrig, nennt die Übersicht dies ausdrücklich; eine leere Ansicht bestätigt keine vollständige Dokumentation. Details erscheinen erst beim Öffnen einer Aufgabe. Einstellungen enthalten Materialausschlüsse und die MCP-Verbindung; Brandschutzhinweise sind aufklappbar.

Verbindungsklemmen, Kabel/Leitungen und Befestigungsmaterial lassen sich projektbezogen ausnehmen. Das steuert neue Materialübernahme, Recherche und erzeugte Gerätelisten; gespeicherte Positionen und frühere Dateientscheidungen bleiben erhalten. Technische Systemteile nicht pauschal als Verbrauchsmaterial behandeln.

Eine Materialliste im Agentenchat bereitstellen. „Material hinzufügen“ beziehungsweise „Auftrag formulieren“ ergänzt Text im bestehenden Auftrag; dies startet keinen eigenen Hintergrundagenten. Tatsächliche Einbauangaben belegen, fehlende Angaben offenlassen. Antworten werden im Auftrag gespeichert und beeinflussen den nächsten Plan.

Gerätekennungen bleiben beim Sortieren und Speichern erhalten. Lücken nach einer Löschung sind beabsichtigt; vorhandene Dokumentzuordnungen dürfen dadurch nicht auf andere Geräte wechseln. Bereits veraltete Bezüge können über MCP nach einer gezielten Vorschau und Originalprüfung repariert werden. Mehrdeutige Zuordnungen bleiben offen, bestehende Dateifreigaben unverändert.

## Dateien einzeln prüfen

1. Einen Vorschlag öffnen und das tatsächliche PDF oder Bild lesen.
2. Quelle, Artikel-/Variantenpassung, Kategorie und Zuordnung prüfen und bei Bedarf korrigieren.
3. Die Sichtung ausdrücklich bestätigen und genau diese Datei übernehmen oder begründet ablehnen.

Keine Sammelfreigabe und keine vorausgewählte Sichtungsbestätigung. API und MCP können keine Datei freigeben. Ein Vorschlag ist noch kein Projektanhang und erfüllt noch keine Dokumentpflicht.

Nach einer Entscheidung folgt die nächste offene Datei hinter der aktuellen Position, ohne automatischen Rücksprung zum Anfang. Frühere übersprungene Dateien bleiben offen und sind über die Dateiliste erreichbar. Jede nächste Datei benötigt eine neue Sichtung und Einzelbestätigung. Der Wechsel ohne vollständiges Neuladen ändert diese Bedingungen nicht.

Die Dateiansicht zeigt die Anzahl wartender Einzelprüfungen und einen direkten Einstieg. Die Arbeitsliste und die nächste Aktion aktualisieren sich nach einer Entscheidung. Quelle und Zuordnung sind in der Einzelprüfung erreichbar; die begründete Ablehnung lässt sich bei Bedarf aufklappen.

Gegenstandslose offene Vorschläge lassen sich mit Begründung zurückziehen. Das ist keine Ablehnung wegen des Inhalts und keine Freigabe. Originale und Verlauf bleiben erhalten; bereits entschiedene Vorschläge sind geschützt.

## Angaben, Wartezustände und Ausgabe

Notwendige Angaben im Seitenbereich beantworten. Zurückstellen benötigt Grund und gegebenenfalls eine Wiederaufnahmebedingung; es erfüllt keine Pflichtunterlage. Ein neuer passender Beleg kann die Bearbeitung wieder ermöglichen. Einzelne Blocker und offene Freigaben sperren keine unabhängigen Artikelrecherchen.

Dateien, Datenblätter, Ausgabe und Verlauf haben eigene Ansichten. Geräte besitzen getrennte Zuordnungen für Anleitung und Datenblatt. Vor Hintergrundexport werden Pflichtangaben, Dateifreigaben und passende Gerätebeziehungen geprüft. Projekttexte können intern bleiben; unvollständige Entwürfe erfüllen keine Pflicht. Ein technisch erzeugter Export ersetzt keine fachliche Abnahme.

Für Brandschutzabschottungen werden ausgefüllte Übereinstimmungsbestätigung, passende Montageanleitung und Zulassungs-/Prüfnachweis systembezogen betrachtet. Herstellerformular vor Eigenformular; System, Einbau und tatsächliche Abmessungen nicht erfinden. Anforderungen anderer Brandschutzarten nicht pauschal übertragen.

[Produktprüfung](PRODUKTPRUEFUNG.md) · [Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) · [API/MCP](API_MCP.md).

Beantwortete Materialausnahmen können über API/MCP gezielt abgeschlossen werden: nicht verwendet, ausdrücklich ausgenommen oder nur Materialnachweis. Nicht bekannte Angaben bleiben offen. Alte doppelte Gerätebezüge lassen sich nur nach eindeutiger Vorschau und Prüfung des freigegebenen Originals bereinigen. Vorherige Entscheidungen bleiben nachvollziehbar; jede neue Datei benötigt weiterhin deine manuelle Einzelprüfung. [Ablauf](API_MCP.md).

### Brandschutz automatisch vervollständigen

Mit aktivem Bereich Brandschutzabschottungen erscheinen die notwendigen Unterlagen automatisch im Auftrag: ausgefüllte Übereinstimmungsbestätigung, Montageanleitung und passender Zulassungs-/Prüfnachweis. Hersteller und System bestimmen die konkreten Dokumente, nicht die grundsätzliche Aufgabenliste. Für bestätigte Brandschutzkanäle und Funktionserhalt führt edoku getrennte Pflichten.

Fehlt die Systemangabe, bleibt die Aufgabe sichtbar und edoku fragt gezielt danach; andere Artikel werden weiterbearbeitet. Bereits gespeicherte Antworten und Zurückstellungen bleiben gültig. Systemwechsel löschen keine alten Unterlagen oder Freigaben. Ein Entwurf oder eine leere Herstellervorlage gilt nicht als fertige Bestätigung. Jede neue Datei muss weiterhin einzeln vom Benutzer gesichtet und freigegeben werden.

### Fehlende Angabe oder technischer Fehler?

Der Assistent gibt dem Agenten ein konkretes Feldziel, den bekannten Stand und die passende Quelle vor. Bestehende Antworten zuerst nutzen, Herstellerdaten nachschlagen, verbleibende Benutzerfragen bündeln. Eine nicht lesbare PDF-Maßtabelle ist eine technische Sperre; belegte Maße müssen deshalb nicht erneut eingegeben werden. Abweichende Originalangaben bleiben dagegen zu klären. Testpositionen bestätigen keinen Einbau. Jede Datei weiterhin einzeln sichten und freigeben.
