# Doku-Assistent: vorbereiten, sichten, freigeben

Der strukturierte Agentenablauf mit Recherche, Chat-Rückfragen und edoku als Strukturvorgabe ist in [AGENTENABLAUF.md](AGENTENABLAUF.md) beschrieben.

Die [Bearbeitungsrichtlinie](BEARBEITUNGSRICHTLINIE.md) legt fest, wie der Agent fragt, recherchiert, Entscheidungen respektiert und unnötige Abfragen vermeidet. Technisch geplante Verbesserungen stehen getrennt im [API-/MCP-Optimierungsplan](MCP_API_OPTIMIERUNG.md).

Stand: 22.11.2026, App `0.2.0-beta.1`, API/MCP `3.3.0`. Aktuelle Arbeitslogik: [Fakten und Abhängigkeiten](FAKTEN_UND_ABHAENGIGKEITEN.md), [Brandschutz-Pflichtunterlagen](BRANDSCHUTZ_PFLICHTUNTERLAGEN.md), [schnelle Einzelprüfung](GUI_FREIGABEABLAUF.md). Der Assistent bleibt auf das geöffnete Projekt begrenzt. Technische Erzeugung, Dateifreigabe und fachliche Abnahme sind getrennte Schritte. Den Aktivierungs- und Testnachweis der lokalen Installation beschreibt `docs/MCP_MATERIALABLAUF.md`.

## Materialliste und Chat

Der Agent beginnt mit `edoku_next_action` im kompakten Modus und lädt anschließend nur benötigte Felder/Positionen oder gespeicherte Belege gezielt nach. Er bereinigt die Materialliste nach Benutzervorgaben, erfasst tatsächliche Geräte und recherchiert Produktangaben aus Herstellerquellen. Ein Produktdatenblatt allein belegt keinen Einbau. Reale Messungen, Einbauorte und Zuordnungen werden nicht erfunden.

`edoku_record_chat_decision` speichert tatsächliche Antworten, Faktenfragmente und Warteentscheidungen mit Originalbeleg gemeinsam. `edoku_knowledge` liefert kleine Fakten-/Abhängigkeitsseiten. Das ältere `edoku_record_user_answers` bleibt für bisherige Clients verfügbar. Die Oberfläche zeigt die Herkunft; vorherige Antworten bleiben in der Historie. Überholte Rückfragen werden mit Begründung gekennzeichnet und blockieren nicht weiter. Die `version` des zuletzt gelesenen Auftrags schützt gegen konkurrierende Änderungen (412). Eine echte offene Rückfrage bleibt offen.

`edoku_select_systems` kann mit `evidence` belegte Hersteller-/Systemergänzungen im einzelnen Projekt speichern. Der globale Katalog und andere Projekte bleiben unverändert. Änderungen am Hersteller entfernen keine Gerätepositionen oder freigegebenen Dateien.

`edoku_prepare_project_document` bereitet einen strukturierten Projekttext als Prüf-PDF vor. Vorschläge bleiben bis zur GUI-Einzelfreigabe im Assistenten. Standardmäßig gilt `scope: "internal"`; `documentId` ist dann optional. Die Freigabe speichert den Text unter `projekt.interneDokumente`; das Prüf-PDF wird kein Projektanhang und erscheint nicht im Kundenexport. Nur `scope: "documentation"` verlangt die Zuordnung zu einem aktiven exportierten Textkapitel und nimmt den Text ausdrücklich in die Kundendokumentation auf. Eine interne Anlagenbeschreibung bleibt deshalb intern, auch wenn sie im selben Projekt geführt wird.

Für einen bereits versehentlich als Anhang freigegebenen internen Projekttext gibt es `edoku_remove_internal_project_document`. Das MCP-Werkzeug entfernt nur solche internen Assistenten-Texte, verlangt aktuellen Projekt-ETag und `confirm: true` und verschiebt die Datei wiederherstellbar in den Papierkorb. Normale Anhänge und ausdrücklich für die Kundendokumentation freigegebene Dateien sind darüber nicht löschbar.

Mit `edoku_patch_attachment` lassen sich falsche Kategorien oder Titel vorhandener Projektanhänge per ETag korrigieren. Eine Änderung zu **Datenblätter** ordnet die PDF automatisch im Produktdatenblattkapitel ein. Geräteverknüpfte Dateien müssen dafür zuerst in der Geräteliste geklärt werden.

Änderungen sollen gesammelt werden. Offene alte Fassungen können durch `supersedes` beim Einreichen oder `edoku_replace_document_proposals` abgelöst werden. Sie bleiben unter „Ersetzte Entwürfe (Historie)“ lesbar und können nicht versehentlich übernommen werden. Eine Ablösung ist weder Freigabe noch Ablehnung. Freigegebene Originale dürfen auf diesem Weg nicht verändert werden.

Freigegebene PDF-Nachweise, allgemeine Projektunterlagen, Brandschutzunterlagen und Projektbeschreibungen gehören jetzt ebenfalls zur Exportplanung. Ausstehende Vorschläge werden weiterhin niemals automatisch übernommen.

## Ablauf

Du gibst einem verbundenen Agenten einen Auftrag, beispielsweise: Erstelle die Bestandsdokumentation, frage nach fehlenden Angaben und schlage passende Herstellerunterlagen vor. Der Agent liest freigegebene Projektinformationen, stellt Rückfragen und reicht vorbereitete Dateien ein. Du sichtest jeden Vorschlag und entscheidest einzeln.

Die Oberfläche **Doku-Assistent** (`/assistent`) umfasst:

Der Menüeinstieg zeigt sofort die offenen Dateivorschläge, Rückfragen und Dokumentationslücken aller eigenen aktiven Aufträge, nach Projekt getrennt. Rückfragen lassen sich direkt in der Liste beantworten; jede Datei führt weiterhin in die Einzelprüfung. Pro Auftrag sind **Angaben**, **Ausgabe** und **Verlauf** direkt erreichbar. **Dateien** bietet eine projektübergreifende Suche mit Statusfilter; **Aufträge** enthält auch abgeschlossene Aufträge. **Neue Dokumentation** öffnet das Formular, **MCP-Einstellungen** die Verbindungseinstellungen. Neue Stände werden auch in dieser Übersicht angekündigt, ohne laufende Eingaben neu zu laden.

1. Auftrag für ein ausdrücklich gewähltes eigenes Projekt anlegen.
2. Rückfragen des Agenten beantworten.
3. Dateivorschläge mit Quelle und Begründung ansehen.
4. Jede PDF oder Bilddatei öffnen und prüfen.
5. Titel, Kategorie, Stockwerk und Anlage korrigieren und die Sichtung bestätigen.
6. Die einzelne Datei übernehmen oder ablehnen.
7. Dokumentationslücken und Pflichtunterlagen prüfen; PDF und ZIP im Hintergrund beauftragen.
8. Nach vollständigem technischen Export PDF, ZIP und Prüfbericht herunterladen.

Es gibt keine Sammelfreigabe und keine automatische Projektübernahme. Das Zielprojekt ist am Auftrag festgehalten und wird nicht durch einen Browser-Projektwechsel geändert.

Dateivorschläge erscheinen nach ihrer vorgeschlagenen Kategorie gruppiert; innerhalb einer Kategorie stehen offene Sichtungen zuerst und die Titel werden natürlich alphabetisch sortiert. Die Kategorie ist in der Einzelprüfung bereits vorausgewählt und bleibt änderbar. Der Agent soll technische Produktdaten als **Datenblätter** und Bedienungs-/Montageanleitungen als **Bedienungsanleitungen** einreichen. Eine automatische Inhaltsklassifizierung durch die Anwendung gibt es nicht. **Datenblätter** ist auch für Pflichtanforderungen und im Anhangsbereich verfügbar; freigegebene PDFs werden im Produkt-Datenblattkapitel (Stammkapitel 7) in Inhaltsverzeichnis und Export aufgenommen. Für Pflichtanforderungen zählt die vom Benutzer bestätigte Kategorie des Anhangs.

## Geräte und Unterlagen verbinden

Der Agent kann die vorhandenen Gerätelisten samt Leistungsbereichen, Positionen und Feldbeschreibungen lesen. Mit `devices:write` kann er die vom Benutzer angegebenen eingebauten Geräte in der passenden aktiven Liste ergänzen; bei unklarer fachlicher Zuordnung soll er zuerst nachfragen. Die API weist Felder anderer Leistungsbereiche zurück. Eine Recherchequelle allein darf nicht als Beleg für ein eingebautes Gerät verwendet werden.

Über `deviceReferences` schlägt der Agent konkrete Gerätepositionen für eine Anleitung oder ein Datenblatt vor. Gerätebezüge aus Pflichtanforderungen werden automatisch ergänzt. Die Einzelprüfung zeigt die vorgeschlagenen Geräte vorausgewählt; du kannst die Auswahl korrigieren oder die Unterlage ohne Geräteauswahl projektbezogen übernehmen. Nach deiner Freigabe werden Anhang und Geräteverknüpfung in derselben Projektspeichertransaktion gespeichert. Hersteller und Typ müssen dann noch zum Projektstand passen. Bereits verknüpfte andere Unterlagen werden nicht ersetzt. Du kannst bestehende Zuordnungen in der Geräteliste prüfen und ändern.

Gerätelisten haben separate Auswahlfelder für **Bedienungsanleitung** und **Datenblatt**; ihre PDF-Ausgabe enthält die jeweiligen Kapitelverweise. Spätere Änderungen am Gerät oder an seiner Verknüpfung werden vor dem vollständigen Hintergrundexport gemeldet. Ein Pflichtnachweis für ein bestimmtes Gerät ist erst erfüllt, wenn auch diese Geräteverknüpfung passt.

**Spannung** und **Leistung** belegen keine Spalten mehr in Gerätelisten und deren PDF-Ausgabe. Bereits erfasste Werte bleiben gespeichert, auch beim Bearbeiten anderer Angaben in der GUI; API/MCP können sie weiterhin lesen. PDFs mit dem bisherigen Spaltenlayout werden für neue Exporte neu erzeugt. Vorhandene historische Ausgaben bleiben erhalten.

## Umgesetzt und noch offen

Aufträge lassen sich in der GUI und per MCP/API anlegen und abrufen. Agenten können Status und Rückfragen einstellen, PDF-, PNG-, JPEG- und WebP-Dateien getrennt vorbereiten und Benutzerantworten lesen. Die GUI zeigt PDFs mit Mozilla PDF.js 6.5.438 und Seitenwechsel, Bilder direkt. Vorschläge und Entscheidungen besitzen Prüfsumme, Entscheider und Zeitpunkt. Ein Hinweis auf neue Auftragsstände erscheint spätestens nach der nächsten 15-Sekunden-Abfrage; Eingaben werden nicht automatisch neu geladen.

Der Bildschirm startet selbst keinen KI-Dienst. Ein externer Agent muss die MCP-Werkzeuge aufrufen. Ein dauerhafter PDF-/ZIP-Hintergrundarbeiter ist vorhanden; er wartet auf konkrete Eingaben und Dateientscheidungen. Es gibt keinen eingebauten Modellanbieter oder Recherche-Dienst. Ein abgeschlossener Assistentenauftrag ist kein fachlicher Vollständigkeitsnachweis.

## Pflichtunterlagen und Hintergrundexport

Interne Arbeitsunterlagen und Anforderungen an die Kundendokumentation sind einzeln zugeordnet. Die Ablageentscheidung ist mit Benutzerbeleg und Versionsschutz nachvollziehbar; der ursprüngliche Anforderungskatalog bleibt erhalten. Ein interner Text wird erst nach manueller Sichtung und tatsächlicher interner Speicherung als intern vorhanden gewertet. Er ersetzt keinen benötigten Bestandsplan oder Prüfbericht. Details: [Interne Anforderungen](AGENTENABLAUF.md#interne-anforderungen-und-kundenpflichten).

Der Agent kann unveränderliche Anforderungen mit Titel, Kategorie sowie optional Hersteller, Modell, Geräteposition und Dokumentrevision anlegen. Dateivorschläge verweisen über `requirementIds` darauf. Nur eine freigegebene, unveränderte, zur Ausgabe gewählte Datei mit passender Kategorie/Revision erfüllt die Anforderung. Eine spätere Änderung des Geräts wird als Zuordnungskonflikt angezeigt. Die tatsächliche inhaltliche Eignung prüft weiterhin der Benutzer. Gleichartige Dateibytes mit geänderten Vorschlagsmetadaten werden als Konflikt abgewiesen, statt still umgebunden zu werden.

Die Auftragsseite zeigt konkrete Stammdaten-/Gerätelücken, unbeantwortete Pflichtfragen, fehlende Pflichtunterlagen und ausstehende Sichtungen. Mit **PDF und ZIP im Hintergrund** wird ein dauerhafter Auftrag vorgemerkt. Er beginnt erst nach Erfüllung der Voraussetzungen. Abbruch, Fehler und erneute Versuche bleiben sichtbar. Erfolgreiche Ausgaben enthalten PDF, ZIP und einen technischen JSON-Prüfbericht; die Ausgabe ist keine fachliche Endfreigabe. Details und Rechte: [API und MCP](API.md#hintergrundexport-und-prüfbericht).

## Getrennte Ablage

Vorbereitete Dateien liegen unter:

    storage/users/<Benutzer-ID>/assistant/<Auftrags-ID>/<Vorschlags-ID>.<Endung>

Sie liegen außerhalb des Projekt-Anhangsordners und sind weder Projektanhänge noch Exportquellen. Projektpakete nehmen sie nicht als Projektdateien mit. Vollständige Installationssicherungen umfassen sie zusammen mit dem übrigen Storage.

Aufträge und Entscheidungen liegen in `documentation_jobs`, `documentation_requirements`, `document_proposals` und `document_review_views`. Die Tabellen entstehen erst beim ausdrücklichen Anlegen des ersten Auftrags. Start und reine Seitenaufrufe legen keine Aufträge oder Dateien an.

Die Freigabe kopiert die exakt geprüften Bytes in den Anhangsordner des festgelegten Projekts. Erst die erfolgreiche SQLite-Transaktion ergänzt den führenden Anhangsindex und setzt den Vorschlag auf `approved`. Dazu muss der SQLite-Projektspeicher aktiviert sein.

Bei einem Fehler nach dem Kopieren, aber vor dem Datenbankabschluss kann eine noch nicht indexierte Zieldatei verbleiben. Sie ist dadurch kein freigegebener Anhang. Ein erneuter Versuch verwendet sie nur bei identischer Prüfsumme. Bestehende Dateien werden nicht überschrieben. Vorschläge und abgelehnte Dateien werden zunächst aufbewahrt; eine Bereinigungsoberfläche steht noch aus.

## Freigaberegeln

Die Freigabe erfolgt ausschließlich über die angemeldete GUI und verlangt:

- aktive Benutzersitzung; Lesekonten dürfen nicht übernehmen oder ablehnen,
- gültigen sitzungsgebundenen CSRF-Token,
- Abruf der konkreten vorbereiteten Datei über die Benutzeroberfläche,
- ausdrückliche Bestätigung der Sichtung,
- dieselbe SHA-256-Prüfsumme wie bei Vorschlag und Vorschauabruf,
- unveränderten Projektstand seit Öffnen der Prüfmaske,
- einen noch nicht entschiedenen Vorschlag.

API-Schlüssel ersetzen hier keine Browsersitzung. Es gibt weder einen API-Freigabe-Endpunkt noch ein MCP-Freigabewerkzeug. Die Agentenrechte erlauben keine direkten Änderungen an Projektanhängen.

Technisch prüft edoku Dateiabruf und ausdrückliche Erklärung, nicht das tatsächliche Lesen eines Menschen. Die Prüfung von Hersteller, Baureihe, Revision, Inhalt und Projektzuordnung bleibt beim bestätigenden Benutzer.

Dateien werden anhand ihres Inhalts erkannt. PDFs müssen lesbar und unverschlüsselt sein und eine bis 1.000 Seiten enthalten. Der Multipart-Anfragekörper ist auf 15 MiB begrenzt; der lokale MCP-Adapter begrenzt einzelne Dateien auf 14 MiB. Gleiche Dateien pro Auftrag werden anhand SHA-256 wiedererkannt. Grenzen: 100 Vorschläge pro Auftrag und 50 offene Aufträge pro Konto; zusätzlich gilt das vorhandene Speicherbudget.

Die PDF-Anzeige rendert Seiten als Canvas, führt keine PDF-Formularskripte aus und nutzt keine externen Anzeige-CDNs. Der separate Dateiaufruf setzt eine Sandbox-CSP. Das ist keine Malware- oder fachliche Zertifizierung.

## Agentenrechte und Einrichtung

Für einen Agenten mit manueller Dateifreigabe:

- `projects:read`, `devices:read`, `documents:read`: Projektinformationen lesen,
- `assistant:read`: Aufträge, Rückfragen, Antworten und Entscheidungen lesen,
- `assistant:write`: Aufträge, Rückfragen und Dateivorschläge vorbereiten.

`projects:write` und `devices:write` sind hierfür nicht nötig. Die Schlüsselvorlage **Einstellungen → API & MCP → Agent vorbereiten, Dateien nur manuell freigeben** wählt Leserechte und `assistant:write`, aber keine direkten fachlichen Schreibrechte. Projektfreigaben bleiben ausdrücklich zu wählen. Die zusätzliche Vorlage **Vollständiger Doku-Agent mit Pflicht-Dateifreigabe** ergänzt `projects:write`, `devices:write` und `exports:read`/`exports:write`. Damit kann der Agent Projekte vorbereiten und Hintergrundexporte starten; jede Dateientscheidung bleibt ausschließlich beim Benutzer.

Der lokale MCP-Prozess benötigt:

    EDOKU_API_URL=https://dein-edoku-server.example
    EDOKU_API_TOKEN=<eigener begrenzter Schlüssel>
    EDOKU_MCP_ALLOW_WRITES=true
    EDOKU_MCP_DOCUMENT_ROOT=/absoluter/ordner/mit/vorbereiteten/dateien

Der Dokumentordner liegt auf dem Rechner des MCP-Clients. Nur innerhalb dieses ausdrücklich freigegebenen Ordners kann der Adapter Dateien einreichen; symbolische Verweise auf Ziele außerhalb werden abgewiesen. Ohne Ordner ist kein Datei-Upload über MCP möglich. Die GUI-Konfigurationserstellung enthält ein Feld dafür.

Globale API-/Schreibschalter gelten auch für Vorbereitungszugriffe. Schlüsselsperren, Benutzergrenzen, Projektbeschränkungen und Ablaufdaten bleiben wirksam.

| MCP-Werkzeug | Funktion |
| --- | --- |
| `edoku_list_documentation_jobs` | Aufträge eines freigegebenen Projekts auflisten |
| `edoku_get_documentation_job` | Auftrag, Antworten und Entscheidungen lesen |
| `edoku_create_documentation_job` | Benutzerauftrag anlegen |
| `edoku_update_documentation_job` | Rückfragen und Fortschritt einstellen |
| `edoku_propose_document` | Lokale Datei mit Quelle und Begründung einreichen |

Die letzten drei Werkzeuge benötigen die explizite Freischaltung von Vorbereitungs-/Schreibwerkzeugen im MCP-Prozess und passende Schlüsselrechte. Der Agent darf bestehende Rückfragen nicht nachträglich umschreiben und keine Benutzerantworten erfinden. Tatsächlich erhaltene Chatantworten kann er ausschließlich über den belegten, versionierten Antwortweg speichern. Auftragsabschluss und Dateientscheidungen bleiben GUI-Aktionen.

| Methode | Pfad unter `/api/v1` |
| --- | --- |
| GET / POST | `/projects/{projectId}/assistant/jobs` |
| GET / PATCH | `/projects/{projectId}/assistant/jobs/{jobId}` |
| POST | `/projects/{projectId}/assistant/jobs/{jobId}/documents` |

Dateieinreichungen verwenden Multipart mit genau einer Datei im Feld `file` und JSON-Metadaten als Textfeld `metadata`. Quelle und Begründung sind Pflicht. Einreichen ist keine Übernahme. Rein vorbereitende Aufträge ändern die Projektversion nicht und brauchen keinen Projekt-ETag.

## Geprüfter Stand

Die Prüfungen laufen im isolierten Node-22-Container mit ausschließlich künstlichen Daten. Der vollständige Ablauf steht in `scripts/documentation-workflow.test.js`; das aktuelle Abnahmeprotokoll und die Prüfzahlen stehen in [ASSISTENT_GOAL_ABNAHME.md](ASSISTENT_GOAL_ABNAHME.md). Automatisierte GUI-Antworten und Einzelfreigaben sind Testsimulationen, keine menschliche Abnahme.

Im Browser mit künstlichen Unterlagen geprüft: Auftrag anlegen, Rückfrage beantworten, PDF tatsächlich darstellen, einzelne Datei übernehmen, zweite Datei ablehnen und Status getrennt anzeigen. Die PDF-Anzeige wurde bei 390 Pixeln Breite geprüft: gerendert, ohne horizontalen Seitenüberlauf. Lokale Screenshots: `output/assistant-review/datei-vor-freigabe.jpg` und `output/assistant-review/entscheidungen.jpg`.

Echter Recherche-Agent, reale Herstellerquellen, komplexe Fremd-PDFs, tatsächliche Client-Einrichtung, Mehrbenutzerbetrieb über mehrere Serverprozesse und fachliche Endabnahme sind damit nicht verifiziert. Der künstliche Gesamtfluss verifiziert technische Erzeugung, Wartezustände, Pflichtfreigabe und Fehlerbehandlung. Erfolgreiche Hintergrundrecherche in realen Herstellerquellen oder die fachliche Vollständigkeit realer Bestandsdokumentationen werden damit nicht behauptet.

Anzeigegrundlage: [Mozilla PDF.js – Browserbeispiel](https://mozilla.github.io/pdf.js/examples/). Die verwendete Version setzt Node.js ab 22.13 für Installation und Betrieb voraus; das Docker-Abbild verwendet Node.js 22.
