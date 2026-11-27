# API und MCP

edoku bietet eine geschützte HTTP-API und einen lokalen MCP-Adapter. Beide verwenden dieselben Projektdienste, API-Schlüssel und Rechte. Die GUI nutzt dieselben Fachregeln. edoku berechnet den nächsten Arbeitsschritt; ein externer Agent führt ihn aus. Ein eingebautes Sprachmodell oder automatischer Recherche-Agent wird nicht gestartet.

API/MCP **3.15.0**: **69 HTTP-Operationen, 58 MCP-Werkzeuge (22 Lesen / 36 Schreiben)**. Maßgeblich für Eingaben, Rechte und Grenzen ist die [erzeugte Referenz](api/README.md), nicht ein Chatverlauf.

## Einstieg

1. edoku mit dauerhaften Datenordnern starten.
2. In Einstellungen → API & MCP einen eigenen Schlüssel mit benötigten Rechten und möglichst passender Projektbegrenzung erstellen.
3. [MCP-Client verbinden](CODEX_DOCKER_MCP.md) oder die [HTTP-API](API.md) verwenden. Schlüssel ausschließlich privat speichern.

## Aufgabensteuerung für einen Agenten

Der Agent beginnt mit `edoku_next_action` im standardmäßig kompakten Modus. edoku liefert vorhandene Informationen, offene Aufgaben und die Ausführungsentscheidung. Bei `continue` unabhängig lösbare Aufgaben weiterbearbeiten; offene Dateifreigaben blockieren andere Artikel nicht. Verbleibende notwendige Rückfragen thematisch bündeln. Benutzerstopp und vereinbarte Budgets bleiben verbindlich.

Materialquelle und Artikelzuordnung getrennt belegen. Zuerst gespeicherte Fakten, vorhandene Geräte und freigegebene Unterlagen nutzen. Neue Chatentscheidungen über `edoku_record_chat_decision` mit tatsächlichem Benutzerbeleg speichern; Vermutungen, Einbaudaten oder Freigaben nicht erfinden. Details nur gezielt nach Abschnitt/Ziel und in kleinen Seiten abrufen. Unveränderte große Antworten nicht wiederholt laden.

Projektbezogene Materialausschlüsse vor Übernahme und Recherche berücksichtigen. Quellenfehler und bekannte Blocker ohne neue Anhaltspunkte nicht wiederholt prüfen. Mehrdeutige Artikel offenlassen und unabhängige Aufgaben fortsetzen.

## Materialausnahmen mit Benutzerbeleg

`edoku_record_material_import` ergänzt bei `operation=resolve` drei manuelle Abschlussarten:

| disposition | Bedeutung |
| --- | --- |
| `not_used` | Artikel laut Benutzer nicht verwendet |
| `out_of_scope` | ausdrücklich vom Dokumentationsumfang ausgenommen, etwa Verbrauchsteile oder anlagenfremde Prüfmittel |
| `material_only` | Quellposition behalten, ohne Geräte-/Unterlagenpflicht in dieser Dokumentation, etwa separat dokumentierte Laufkarten |

`excluded` bleibt ausschließlich den automatischen projektbezogenen Materialregeln vorbehalten. Eine manuelle Ausnahme ändert diese Regeln nicht und entfernt weder Geräte noch Dokumente.

Vorher die tatsächliche Chatantwort über den regulären Entscheidungsvorgang speichern. Der Abschluss benötigt zusätzlich `assistant:read`, `userDecision={jobId,jobVersion,questionId}`, pro Zeile einen konkreten `reason` und den unveränderten Originalbeleg in `evidence.sourceQuote`. Die beantwortete Frage muss genau das Materialziel `(importId,rowId,field=assignment)` enthalten. Ein Batch umfasst höchstens 20 Zeilen derselben beantworteten Frage; Fehler brechen das gesamte Paket ab. Der kompakte Folgeplan nennt `userDecision` und einen gezielten Frageabruf.

edoku prüft Projekt, Auftragsversion, aktuellen Fragebeleg und Zeilenziel. Zurückgestellte Antworten und bekannte Unbekannt-/Nachreichungsantworten schließen nichts ab; eine neuere Antwort kann nicht mit einem alten Beleg überschrieben werden. Die fachliche Auslegung einer frei formulierten Antwort bleibt Aufgabe des Agenten; die technische Belegprüfung ersetzt diese Auslegung nicht. Passende aktive Geräte verhindern den manuellen Ausnahmeabschluss. Deren tatsächliche Entfernung hat einen eigenen gesonderten Löschablauf.

Quelltext, Artikelangaben und Historie bleiben erhalten. Ein veralteter Quell-Gerätezeiger wird beim Abschluss archiviert; das reale Gerät bleibt unverändert. Identische Wiederholungen erzeugen keine neue Revision. Ein gespeicherter Ausnahmeabschluss kann nur mit einem neuen tatsächlichen Benutzerbeleg separat über `resolve`/`resume` wiederaufgenommen werden. Die gezielte Belegabfrage `edoku_material_import` mit `section=decision`, `rowId` und optional `importId` benötigt ebenfalls `assistant:read`. Ausgabe bleibt begrenzt. Abgeschlossene Zeilen erzeugen keine erneute Zuordnungsfrage; alte Frage-/Wartehistorien bleiben gespeichert und erscheinen nach erledigtem Ziel nicht mehr als aktuelle Sperre.

Bestehende Antworten werden beim Update nicht automatisch in Abschlüsse umgedeutet. Bestehende Materialausnahmen lassen sich anschließend belegt und gezielt anwenden. Neue Dateien bleiben ausschließlich manuell einzeln freizugeben.

## Stabile Gerätebezüge und Reparatur

Ein Gerät wird weiterhin durch `listId` und die unveränderliche positive `position` identifiziert. Die Array-Reihenfolge ist keine Gerätekennung. GUI-Speichern und Sortieren nummerieren bestehende Zeilen nicht neu. Neue Zeilen erhalten eine Kennung oberhalb der gespeicherten Nummernreserve; Löschen, Wiederherstellen und Vorlagenanwendung setzen diese Reserve nicht zurück. Produktänderungen bleiben prüfpflichtig. Bestehende Projekte werden beim Start nicht umgeschrieben.

`edoku_repair_document_references` bietet zuerst `mode=preview`: Der Server sucht ausschließlich eindeutige aktuelle Gerätepositionen, die das bereits freigegebene Original tatsächlich verknüpfen und in Hersteller, Typ und vorhandener Variante übereinstimmen. Gleiche Artikel allein reichen nicht als Beweis einer physischen Geräteinstanz. Eine Vorschau umfasst höchstens drei Reparaturen und nennt verbleibende Änderungen bzw. Blocker.

Die Vorschau benennt jede Aktion: `rebind` korrigiert eine eindeutige Altposition, `remove_duplicate` entfernt nur einen redundanten Bezug und nennt den bereits gültigen `keepIndex`. Ein fehlender oder widersprüchlicher Anker, mehrere mögliche Geräte oder mehrere verschiedene alte Instanzen mit demselben Ziel bleiben gesperrt. Auch ein an der alten Position noch vorhandenes gleichartiges Gerät wird nicht mit einer anderen Instanz zusammengeführt. Die Mehrdeutigkeitsprüfung erfolgt vor der Begrenzung auf drei Aktionen; kleine Folgepakete umgehen keine Sperren.

`mode=apply` benötigt den aktuellen ETag, `input.previewToken` und einen tatsächlichen Beleg in `input.evidence`. Vor der atomaren Korrektur werden Originalfreigabe, Dateigröße und SHA-256 erneut geprüft. Nur die ausgewählten aktuellen Anhangsbezüge ändern sich; vollständige vorherige/nachherige Bezüge, ausgewählte Aktionen und Begründung bleiben im Projektprotokoll, die ursprüngliche Dateientscheidung unverändert. Kein neuer Dateieingang und keine Freigabe. Neue oder geänderte PDF-Bytes benötigen weiterhin einen neuen manuellen Vorschlag. Mehrdeutige oder unbelegte Zuordnungen bleiben gesperrt.

## Blocker und kompakte Folgeaufgaben

API/MCP 3.13.0 unterscheidet konkrete HTTP-, PDF-Link- und Vorschlagskonflikte vor alten generischen Variantenhinweisen. Eine technische Sperre ist keine Aufforderung, Maße oder Einbaudaten zu erfinden. Bei einer ausdrücklich vom Benutzer ausgenommenen Position kann `edoku_patch_device_position` die interne `kategorie` auf **Verbrauchsmaterial (nicht dokumentieren)** setzen; die tatsächliche Benutzerentscheidung zuvor speichern. Ein solcher Einzelverzicht wirkt auf Recherche, Anforderungen und neu erzeugte Listen, erhält jedoch Originalposition, Dateien und Freigaben. Keine globale Ausnahme für alle Sicherungen und keine neue Dateiübernahme.

Bei einem zurückgezogenen Original bleibt eine unveränderte Wiederholung zurückgezogen. Ein tatsächlich anderer, gültiger Gerätebezug kann mit `metadata.expectedJobVersion` einen neuen offenen Vorschlag mit eigener Kennung erzeugen. Alte Metadaten, Rückziehbeleg und Sichtungsnachweise bleiben erhalten; sie gelten nicht für den neuen Vorschlag. Nur eine andere Beschriftung reicht nicht. Bestehende Installationen benötigen dafür den ausdrücklich auszuführenden [Vorschlagsspeicher-Upgrade](UPDATE.md#vorschlagsspeicher-für-zurückgezogene-originale); ohne diesen Schritt bleibt der Vorgang mit `PROPOSAL_STORAGE_UPGRADE_REQUIRED` gesperrt. Freigegebene/abgelehnte und weiterhin offene Originale behalten den bisherigen Konfliktschutz.

`edoku_datasheet_coverage` liefert bei technischen Sperren und Nichtfunden einen `blocker` mit `code`, `kind`, `owner`, `resumeWhen` und `repeatWithoutNewEvidence=false`. Eine fehlende Herstellerfreischaltung oder Dateigrößengrenze ist kein fachlicher Nichtfund. Der kompakte Plan fasst Ursachen unter `blockers` zusammen; unabhängige Aufgaben bleiben bearbeitbar. Reine Produktmaße werden nicht zur Umgehung einer Prüfung geändert.

Ein Artikel lässt sich mit `articleId`, eine Listenposition mit `position` gezielt lesen. Aufgaben liefern passende `contextRead`-Aufrufe; vollständig bekannte nächste Werkzeugaufrufe stehen unter `call`. Für externe Recherche fehlen Herstellerseite und PDF-Link weiterhin bewusst, bis der Agent sie tatsächlich ermittelt hat.

HTTP-Clients können bei Projektänderungen `Prefer: return=next-action` senden. Bei ausreichenden Leserechten enthält die erfolgreiche Antwort zusätzlich eine größenbegrenzte `continuation` mit aktuellen Versionen, Checkpoint, Ausführungsentscheidung und nächster Aufgabe. Der MCP-Adapter fordert dies standardmäßig an. Den Folgeplan direkt nutzen; keinen identischen Statusabruf anschließen. Reine Fortschrittsmeldungen benötigen keinen neuen Plan. Bei zu großer Antwort oder fehlgeschlagener Planberechnung bleibt der erfolgreiche Änderungsbeleg erhalten und ein gezielter `refresh_required`-Aufruf wird geliefert. Fehlende Leserechte liefern keine zusätzlichen Projektdetails. Keine serverseitige Tokenabrechnung oder garantierte Tokenersparnis.

## Tatsächliche Schotts erfassen

`edoku_add_firestop` legt im bereits aktivierten Leistungsbereich **Brandschutzabschottungen** einen eigenen Einbau an. Vorher vorhandene Schotts über `edoku_get_section(section=firestops)` klein paginiert abgleichen; einzelne Einträge mit `entryId` lesen. Materialposition und tatsächliches Schott sind getrennte Datensätze. Aus einem verwendeten Artikel entstehen weder automatisch Schotts noch bestätigte System- oder Einbaudaten.

Anlage benötigt `projectId`, aktuellen starken `etag`, stabilen `requestId`, `values` und tatsächlichen `evidence={sourceLabel,sourceQuote}`. Derselbe Schlüssel mit identischem Inhalt liefert die ursprüngliche Kennung; andere Inhalte ergeben Konflikt. Eine technische `id` wird erzeugt und ist keine am Bau vorhandene Schottkennung. Nicht blind nach Verbindungsfehlern mit einem neuen Schlüssel wiederholen. Teiländerungen über `edoku_patch_firestop(projectId,entryId,etag,values,evidence)`; identische Werte erzeugen keine neue Projektrevision oder Fachhistorie.

Bestandsfelder heißen wie in der GUI: `geschoss`, `raum`, `bauteil`, `abschottungssystem`, `hersteller`, `system`, `zulassung`, `feuerwiderstand`, `medium`, `anzahl_kabel`, `durchmesser`, `ausfuehrungsdatum`, `monteur`, `bemerkung`. Exakte Systembezeichnung separat von Produkten führen; beispielsweise ZZ330 als `components` erfassen, ohne dadurch ein bestimmtes Abschottungssystem zu bestätigen. Zusätzliche strukturierte Angaben: `wallType`, `wallThicknessMm`, `openingWidthMm`, `openingHeightMm`, `sealDepthMm`, `fireResistanceMinutes`, `components`. Maße sind positive Zahlen in Millimetern; unbekannte Angaben auslassen bzw. bei einer belegten Korrektur nullable Zahlen auf `null` setzen. Datum leer oder tatsächlich bestätigtes ISO-Datum `YYYY-MM-DD`.

HTTP: `POST /projects/{projectId}/firestops` mit `If-Match` und `Idempotency-Key`, `PATCH /projects/{projectId}/firestops/{entryId}` mit `If-Match`, `GET` derselben Einzeladresse. Schreibrecht `projects:write`, Lesen `documents:read`; Benutzer- und Projektgrenzen gelten weiter. Schreibantworten liefern nur technische Kennung und Änderungsstatus, optional die kompakte Folgeaufgabe. Unbekannte Legacy-Felder, Fotos und andere Schotts werden nicht ersetzt. Beleg und vorherige/geänderte Werte bleiben intern in der Projekthistorie `firestopChanges` erhalten; keine Quellenbemerkungen werden dafür in das Schott-PDF geschrieben.

Die GUI erhält zusätzliche strukturierte API-Felder beim regulären Speichern; sie bietet dafür noch keine eigenen Eingabespalten. Fotozuordnung, Aktivierung/Inaktivierung und Löschen bleiben außerhalb dieser beiden Schreibwerkzeuge. Keine Datei wird dadurch vorgeschlagen, übernommen oder freigegeben; eine vollständige Übereinstimmungsbestätigung und fachliche Anlagenprüfung sind getrennte Aufgaben.

## Herstellerunterlagen und Dateivorschläge

Hersteller-Produktseite ermitteln, dort verlinktes Original-PDF verwenden und durch edoku auf Artikel-/Variantenpassung prüfen lassen. Linkermittlung und Produktprüfung ersetzen keine manuelle Übernahme. [Prüfablauf](PRODUKTPRUEFUNG.md).

Dateien werden ausschließlich vorgeschlagen. Erst tatsächliche Sichtung und manuelle Einzelbestätigung in der GUI übernehmen sie. API und MCP haben kein Freigabewerkzeug. Ein Agent kann gegenstandslose offene Vorschläge mit Begründung und Beleg zurückziehen; das ist weder eine Benutzerablehnung noch eine Freigabe. Bereits getroffene Dateientscheidungen bleiben geschützt.

## Versionen, Konflikte und Grenzen

Schreibaufrufe benötigen die im Vertrag genannten Projekt-/Auftragsversionen; geeignete Operationen zusätzlich Wiederholungsschlüssel. Ein Versionskonflikt erfordert einen frischen gezielten Stand, kein blindes Wiederholen. Gezieltes Löschen/Wiederherstellen und vollständiger Projektreset haben eigene Vorschau-, Bestätigungs- und Sicherungsbedingungen und benötigen einen ausdrücklichen Auftrag.

Die tatsächlichen Software-, API- und MCP-Versionen stehen unter Einstellungen → System. OpenAPI 3.1.0 bezeichnet das Format und ist keine API-Version. Lokaler Adapter und Online-API sind unterschiedliche Verbindungen; entfernte API-Verbindungen benötigen HTTPS. Remote-MCP/OAuth ist nicht Bestandteil dieses lokalen Adapters.

[HTTP-Handbuch](API.md) · [Architektur](TECHNIK.md) · [Tests](TESTS.md) · [Sicherheit](SICHERHEIT.md).

## Automatische Brandschutzpflichten

Ab API/MCP 3.14.0 berechnet edoku die Pflichtunterlagen selbst (Aufgabenvertrag 2.4, Regel `firestop_documents_v2`). Ein aktiver Leistungsbereich Brandschutzabschottungen benötigt eine ausgefüllte Übereinstimmungsbestätigung sowie je tatsächlichem System Montageanleitung und Zulassungs-/Prüfnachweis. Bei bestätigten Brandschutzkanälen oder elektrischem Funktionserhalt gelten getrennte Systemgruppen mit passender Errichter-/Übereinstimmungsbestätigung, Anleitung und Systemnachweis. Die Produktregel ist herstellerunabhängig; die fachlich passende Nachweisart richtet sich weiter nach dem tatsächlichen System.

Für Kanäle/Funktionserhalt müssen `fireProtectionKind` und `installationStatus=confirmed` als belegte aktuelle Gerätefakten im Auftrag vorliegen. Materialtexte, Testannahmen oder Herstellerklassifizierung bestätigen keinen Einbau. System-, Montage- und Einbaudaten werden gezielt über die Faktensteuerung geklärt; Wandmaße einer Abschottung werden nicht für einen Kanal abgefragt.

`edoku_next_action`, Auftragsabruf und Dokumentationsstatus verwenden dieselben automatisch ergänzten Anforderungen. Der Agent muss keinen `DEFINE_FIRESTOP_REQUIREMENTS`-Schritt mehr ausführen. Unbekannte Systeme sperren die davon abhängigen Unterlagen; unabhängige Datenblätter und andere Aufgaben bleiben bearbeitbar. Die bereits geltende System-PDF-Prüfung bleibt verbindlich.

Abrufe schreiben keine Daten. Neue Aufträge, ausdrückliche Auftragsänderungen und neue verknüpfte Dateivorschläge halten die berechneten Kennungen innerhalb ihrer Transaktion fest. Systemwechsel oder Bereichsdeaktivierung löschen keine alten Anforderungen oder Dateientscheidungen: alte Systempflichten sind im Status nicht anwendbar, die neuen gelten separat. Geschlossene Aufträge werden beim Lesen nicht nachträglich erweitert. Geänderte Pflichtidentität verändert die Auftragsversion; widersprüchliche Kennungen und mehr als 100 Anforderungen werden mit Konflikt abgewiesen, statt Bestandsdaten zu überschreiben.

Vorlagen und unvollständige Entwürfe erfüllen keine Pflicht. Auch automatisch abgeleitete Anforderungen erzeugen keine Dateien, Sichtung oder Freigabe: neue Dateien bleiben ausschließlich Vorschläge zur manuellen GUI-Einzelprüfung.

## Fehlende Angaben und technische Blocker

Ab API/MCP 3.15.0 und Aufgabenvertrag 2.5 benennt eine Faktenaufgabe `missingInformation` mit konkretem `key`, `subject`, aktuellem `state`, `owner` und `source`. Quelle ist je nach Beleglage `stored_answers`, `manufacturer_research` oder `user_answer`. Agenten nutzen diese Ziele und vorhandene Belege statt fehlende Felder aus Chatkontext zu erraten. Abhängige Aufgaben warten; unabhängige laufen weiter. Bestätigte Fakten werden nicht erneut erfragt.

Kompakte Produktprüfungen liefern zusätzlich `verification.resolution`: Zuständigkeit, Befundart, nächster Schritt, `askUser` und `missingFields`. Eine nicht unterstützte Maßtabelle ist ein technischer Befund (`PDF_DIMENSION_LAYOUT_UNSUPPORTED`, maintainer, askUser=false, missingFields=[]), keine Aufforderung, belegte Produktmaße erneut zu erfragen. `dimension_mismatch`/`dimension_table_conflict` bleiben ein Passungskonflikt; eine fremde Artikelseite bleibt unzulässig. Aktive technische Blocker werden vor unspezifischen Schlüsselworttreffern klassifiziert. Alle anderen Quellen- und Versionsschutzregeln bleiben verbindlich.

OBO-PLM-Datenblätter mit getrennten Beschriftungs-/Wertespalten werden nur bei bestätigter Herstellerverknüpfung und Artikelbindung geprüft. Die ausdrücklichen Millimeterwerte der identischen Artikelnummer müssen zur gespeicherten B/H/L-Folge und zum Stammdatenwert passen. Keine willkürliche Vertauschung, Toleranzannahme oder Datenänderung zur Umgehung. Die V10-Regel öffnet ausschließlich den passenden älteren V9-Maßbefund erneut; aktuelle oder fremde Sperren bleiben bestehen. Testpositionen erzeugen keine bestätigten Einbaudaten. Neue Dateien benötigen weiterhin manuelle GUI-Einzelfreigabe.

Bei gezielter Wiederaufnahme bleiben gespeicherte Originalquellen in der berechneten Sicht erhalten (`search.outcome=retry`). Der Arbeitsplan liefert `RETRY_DATASHEET_CHECK`, `reuseOriginal=true`, bis zu zwei kurze `priorSources` und den gezielten Detailabruf. Der Agent prüft das bereits gefundene Original erneut, statt dessen Suche zu wiederholen. Die gespeicherten Recherchebelege werden dabei nicht umgeschrieben.
