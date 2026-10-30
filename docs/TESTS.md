# Tests und Beta-Abnahme

Stand: 2026-10-30. Benötigt Node.js 20 oder neuer und installierte Abhängigkeiten.

## Automatisierte Prüfungen

```bash
npm run test:exports
npm run test:preservation
```

Die Tests verwenden temporäre Verzeichnisse, synthetische Konten und
Prüfprojekte. Sie überschreiben keine vorhandenen Projekte und starten
Testserver auf freien Ports. Die Exporttests schreiben zusätzlich feste
Nachweisdateien unter `output/pdf/` und `output/counting-review/` im
Testcheckout. Tests deshalb in einem getrennten Checkout oder Container
ausführen und keine realen Laufzeitordner einbinden.
Für einen Containerlauf zuerst ein Prüfabbild in einem
sauberen Checkout mit neutralen Startdaten bauen:

```bash
docker build -t edoku:pruefung .
docker run --rm --network none --entrypoint node edoku:pruefung --test scripts/export-counting.test.js scripts/update-preservation.test.js
```

Der Testcontainer benötigt keine eingebundenen Laufzeitordner. Bei lokalem
`npm install` müssen die nativen Abhängigkeiten zu Node-Version und Plattform
passen; die Prüfung im Node-20-Container vermeidet einen Plattformwechsel.

### Kapitel und Export: 18 Prüfungen

- Eindeutige Kapitel trotz gleicher Originalnummern, fehlender Eltern und abgewählter Dokumente.
- Zusätzliche Gerätelisten und importierte PDFs folgen derselben Struktur.
- Natürliche Stockwerksreihenfolge und im Projekt festgelegte Sortierung.
- Unterscheidung von Gliederung, Einzel-PDFs und tatsächlichen Seiten; keine Doppelzählung von Sammelausgaben.
- Mehrseitige Anhänge, beschädigte oder nicht zuordenbare PDFs und veraltete generierte PDFs.
- Inhaltsverzeichnis mit gemessenen Linkflächen, mehrzeiligen Titeln und Seitenumbrüchen.
- Finale Dateinummern ohne Lücken; Kapitelordner und ZIP-Zuordnung.

Das kleine Prüfprojekt erzeugt zwölf Einzel-PDFs mit zusammen 20 Seiten.
Das lange Prüfprojekt hat 61 Seiten einschließlich eines dreiseitigen
Inhaltsverzeichnisses; 56 interne Sprunglinks werden geprüft. Diese Werte
beschreiben ausschließlich synthetische Prüffälle.

### Datenerhalt: drei Prüfungen

1. Bestehende Kontonamen, Passwort-Hashes, Rollen, Sperren, Sitzungen und Projekte bleiben bei Start, zwölf angemeldeten Seitenaufrufen und erneutem Start erhalten. Projektdateien und altes Register werden verglichen.
2. Eine vorhandene leere Datenbank wird nicht mit Testkonten befüllt.
3. Eine echte Erstinstallation ohne Datenbank legt die vorgesehenen Startkonten weiterhin an.

### API-Smoke-Test

Bei laufender Anwendung:

```bash
npm run smoke:api
```

Im normalen Container alternativ:

```bash
docker exec edoku_v1 node scripts/smoke-api.js
```

Die zwölf lesenden API-Prüfungen kontrollieren HTTP-Status, JSON-Hülle und
Fehlerantworten. Das API-Grundgerüst nutzt teilweise Demo-Daten. Ein
erfolgreicher API-Test ist keine Prüfung der tatsächlichen Benutzerprojekte.

## Zusätzlicher Nachweis der lokalen Übernahme

Am 30.10.2026 wurden vorab sechs öffentliche und zwölf angemeldete Seiten
mit einer konsistenten Kopie der tatsächlichen Daten aufgerufen. Dateiinhalte
und Datenbankinhalte blieben unverändert. Für die Umstellung wurde die normale
Anwendung gestoppt und alle fünf Laufzeitordner vollständig gesichert.
Anschließend wurden die Dateien, das Datenbankschema und alle Tabellenzeilen
verglichen. Die eingesetzten 105 Programmdateien stimmten mit dem getesteten
Abbild überein; Erreichbarkeit und API-Smoke-Test auf Port 3000 waren erfolgreich.

Die privaten Nachweise liegen in der lokalen Sicherung unter `backups/`.
Datenbanken, Projektdateien, Sitzungen und private Prüfprotokolle werden nicht
nach GitHub übertragen.

## Manuelle Beta-Abnahme

Neue Exporte zunächst in einer getrennten Testinstallation erzeugen. Dafür
ein neutrales Prüfprojekt oder eine konsistente Kopie verwenden; einen Export
mit echtem Projektbestand nur bewusst in der normalen Anwendung starten.

1. Login, Projektwechsel und Anzeige des aktuellen Projekts prüfen; Rollen und gesperrte Konten gesondert prüfen.
2. Leistungsbereiche, mehrere Gerätelisten und ein mehrseitiges PDF auswählen. Matrix, Vorschau und Dashboard auf dieselben Kapitel und Zähleinheiten vergleichen.
3. Finalen Export starten, Gesamt-PDF öffnen und Einträge des Inhaltsverzeichnisses einschließlich langer Titel und letzter Kapitel anklicken. Sichtbare Überschriften und gedruckte Seitenzahlen vergleichen.
4. ZIP entpacken; Reihenfolge, Kapitelordner und Einzeldateien mit der Gesamt-PDF abgleichen. Warnungen zu fehlenden oder beschädigten PDFs gezielt prüfen.
5. Oberfläche mit Tastatur sowie schmalem und breitem Fenster prüfen; Tabellen, Popups und helle/dunkle Themes berücksichtigen.
6. Trennstreifen und Ordnerrücken auf echten Bögen ausdrucken und Maß, Ausrichtung und Lesbarkeit prüfen.

Offen bleiben die fachliche Abnahme der Norm-/Formulartexte, vollständige
Rechte- und Archivtests, beliebige reale PDFs und physische Druckabnahme.
Automatisierte Prüfergebnisse ersetzen diese Abnahmen nicht.
