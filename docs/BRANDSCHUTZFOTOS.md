# Brandschutzfotos prüfen

Stand: 06.11.2026. Warnlogik ergänzt am 03.11.2026.

Die Anwendung prüft Dateiverweise aktiver Brandschottungen. Ein nicht leerer Fotoverweis muss auf eine vorhandene, zugreifbare Datei im erlaubten Projektbereich zeigen. Leere optionale Fotofelder erzeugen keine Dateiwarnung; inaktive Schottungen werden nicht berücksichtigt. Der Hinweis zählt betroffene Fotofelder: Zwei Verweise auf dieselbe fehlende Datei erscheinen als zwei betroffene Fotoverweise.

## Sichtbare Hinweise

- **Brandschutz:** Hinweis mit Schottungskennung, Geschoss/Raum und betroffenem Foto 1/2.
- **Dashboard und Export:** Hinweis, sobald der Brandschutzbereich gewählt oder die Bilddokumentation ausdrücklich für den Export aktiviert ist. Er bleibt auch sichtbar, wenn innerhalb eines gewählten Brandschutzbereichs die Bild-PDF abgewählt wurde.
- **PDF:** Ein eingetragener, aber fehlender Dateiverweis erhält den Text „Fotodatei fehlt - Dateiverweis prüfen“. Ein tatsächlich leeres optionales Feld bleibt „Kein Bild hinterlegt“.
- **Finaler Export:** Die Meldung zählt fehlende PDF-Dokumente und fehlerhafte Fotoverweise getrennt. Ein Export mit Fotowarnungen wird nicht als vollständig ausgewiesen, auch wenn alle geplanten Einzel-PDFs vorhanden sind.
- **ZIP:** `EXPORT_REIHENFOLGE.txt` enthält einen eigenen Abschnitt mit den betroffenen Schottungen, Fotofeldern und Dateiverweisen.

PDF-Dateianzahl und PDF-Seitenzahl bleiben eigene Zähler. Fotos werden nicht als zusätzliche Einzel-PDFs oder Seiten gezählt. Vor der finalen Paketbildung wird die Verfügbarkeit erneut geprüft. Lesende Seitenaufrufe aktualisieren die Warnanzeige ohne Speicherung der Projekt- oder Exportdateien.

## Fehlende Fotos zuordnen

Die betroffene Schottung öffnen, eine passende Bilddatei hochladen und Foto 1 bzw. Foto 2 zuordnen. Nach Neuladen wird der Dateiverweis erneut geprüft. Anschließend die Dokumentation erneut erzeugen, damit die tatsächlichen Bilder auch in den PDFs enthalten sind. Bereits erzeugte Pakete werden durch einen reinen Seitenaufruf nicht verändert.

Es werden keine Fotos gelöscht, Dateiverweise automatisch entfernt oder historische Ausgaben einem Projekt zugewiesen. Fremde Pfade und externe Symlinks bleiben gesperrt. Eine erreichbare Datei ist kein Nachweis, dass das Bild die richtige Schottung zeigt; Programmsymbole, Musterbilder und die fachliche Eignung prüft weiterhin die verantwortliche Person. Die Prüfung hier bewertet den Dateizugriff, nicht jedes denkbare Bildformat oder die Ausführung vor Ort.

## Prüfnachweise

`npm run test:photos` prüft aktive/inaktive Datensätze, leere Felder, unveränderte Quelldaten, Pfad-/Symlinkgrenzen, unveränderte PDF-Zähler, Exportstatus und ZIP-Hinweise, zwischenzeitlich verschwundene/wiederhergestellte Dateien sowie echte HTTP-Seiten und Exportmeldungen. Die HTML-Ausgabe maskiert freie Texte.


Automatisierte Prüfungen mit künstlichen Daten: `npm run test:photos`. Sie ersetzen keine fachliche Bewertung tatsächlicher Fotos oder Abschottungen. [Tests](TESTS.md).
