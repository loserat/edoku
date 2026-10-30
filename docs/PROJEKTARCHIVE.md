# Projektarchive: Paketformat und Wiederherstellung

Stand: 30.10.2026. Projektpakete sichern ein Benutzerprojekt. Für die gesamte
Installation einschließlich Konten, Sitzungen, Einstellungen und historischer
gemeinsamer Ausgaben bleibt die [Vollsicherung](UPDATE.md) erforderlich.

## Paket erzeugen

Unter **Projekte → Projektarchiv → Exportieren** festlegen, ob Anhänge,
generierte Ausgaben und finale Dateien enthalten sein sollen. Das Paket wird
in einem Arbeitsordner vorbereitet, auf Vollständigkeit und Prüfsummen geprüft
und erst danach in der Historie sichtbar. Die ZIP-Datei wird tatsächlich
erzeugt und kann neben dem Manifest heruntergeladen werden.

| Paketbereich | Inhalt |
| --- | --- |
| `data/` | Projektangaben und Fachdateien; der aktive Exportindex wird beim Import neu aufgebaut |
| `uploads/` | Zugehörige Anhänge, Uploads und Projektlogos aus der tatsächlichen Projektablage |
| `documents/` | Eindeutig zugehörige manuell abgelegte Dokumente |
| `generated/` | Generierte PDFs und ihre Begleitdateien |
| `final/` | Aktuelle finale Ausgabe |
| `metadata/` | Originaler Exportindex und passive Begleitmetadaten vorheriger Importe |
| `manifest.json` | Formatversion, Auswahl, Dateiinventar, Größen und SHA-256-Prüfsummen |

Abgewählte Bereiche werden nicht als enthalten ausgewiesen. Bereits fehlende
Quelldateien werden in `missingFiles` und `FEHLENDE_QUELLDATEIEN.txt`
dokumentiert; vorhandene Projektdateien werden trotzdem gesichert. Das Paket
erhält dann ausdrücklich keinen vollständigen Status.

Gemeinsam verwendete alte Ausgaben bleiben als separater historischer Bestand
auf dem Quellsystem und in dessen Vollsicherung erhalten. Sie werden nicht
ungeprüft in das Paket eines einzelnen Benutzers kopiert. Das Manifest enthält
`separateHistoricalOutputs`, zusätzlich gibt es einen Hinweis im Paket. Der
alte Exportindex bleibt unter `metadata/exportliste-original.json` erhalten
und wird nicht als Dateifreigabe auf dem Zielsystem aktiviert.

## Importieren

1. Das ZIP lokal entpacken und den Ordner `projekt_export` in den Importbereich des Zielkontos kopieren: `storage/imports/<Benutzer-ID>/<Paketname>/`.
2. Im Projektarchiv den Paketnamen eingeben und **Validieren** auswählen. Andere Benutzerverzeichnisse und beliebige Serverpfade sind nicht zulässig.
3. Hinweise auf fehlende Dateien, abgewählte Bereiche oder separaten Altbestand lesen. Strukturprüfungen und vollständiger historischer Dateibestand werden getrennt angezeigt.
4. **Projekt importieren** erstellt eine neue Projektkennung, falls die ursprüngliche bereits existiert. Bestehende Projekte werden nicht überschrieben.
5. Das importierte Projekt öffnen und Anhänge, Brandschutzbilder und Ausgaben prüfen. Der Exportindex wird aus den Zielpfaden neu ermittelt.

Der Server entpackt keine hochgeladenen ZIP-Dateien. Der lokale entpackte
Importordner wird vor dem Kopieren geprüft. Symbolische Verknüpfungen,
Spezialdateien, absolute Pfade und Verweise außerhalb des Pakets werden
abgewiesen. Die tatsächlich kopierten Dateiinhalte werden erneut mit dem
geprüften Stand verglichen. Erst danach wird das neue Projekt registriert.
Schlägt der Import fehl, wird nur sein neu angelegter Arbeitsbereich entfernt.

Dateiverweise auf Anhänge, Logos, Brandschutzbilder und Ausgaben werden für
das Zielkonto und die neue Projektkennung umgesetzt. Passive Metadaten bleiben
unter `archive-metadata/` erhalten; sie erteilen keine zusätzlichen Dateirechte.

## Kompatibilität und Grenzen

- Neue Pakete nutzen Format `2.0`. Format `1.0` wird nur akzeptiert, wenn seine Dateien und relativen Verweise tatsächlich vollständig und zulässig sind. Frühere unvollständige Pakete werden nicht blind als gültig übernommen.
- SHA-256-Prüfsummen erkennen Abweichungen vom Manifest. Sie sind keine digitale Signatur und kein Nachweis des Absenders.
- ZIP-Ausgaben werden speicherschonend geschrieben. ZIP64 wird nicht unterstützt; Größen-/Dateigrenzen führen zu einer klaren Fehlermeldung statt einer angeblich fertigen ZIP-Datei.
- Projektpakete ersetzen keine komplette Installation: globale Konfiguration, Konten, Sitzungen und nicht zugeordneter gemeinsamer Altbestand bleiben Teil der Vollsicherung.
- Physische Druckabnahme, fachliche PDF-Abnahme und ein automatisiertes externes Wiederherstellungsverfahren bleiben gesonderte Aufgaben.
