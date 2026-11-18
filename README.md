# edoku

**Elektro-Bestandsdokumentation für die Projektübergabe.**

Mit edoku sammeln Elektrofachbetriebe und Projektteams Gerätelisten, Pläne, Messprotokolle und Brandschutzfotos zu einem Projekt. Die Anwendung ordnet die Unterlagen nach Kapiteln, zeigt fehlende Dateien und erstellt ein **Gesamt-PDF** sowie ein **ZIP mit einzelnen Dateien nach Kapiteln**.

[**Beispiel-PDF ansehen (7 Seiten)**](docs/beispiele/edoku-beispieldokumentation.pdf) · [**Bedienung mit Screenshots ansehen**](docs/BEDIENUNGSANLEITUNG.md) · [**Lokal ausprobieren**](#lokal-mit-docker-starten) · [**Projektstand ansehen**](docs/AKTUELLER_STAND.md)

## Vom Projekt zur Dokumentation

**Beispiel:** Du bereitest die Übergabe der Elektroinstallation im fiktiven Bürohaus Lindenbogen vor. Im Beispiel-PDF siehst du das klickbare Inhaltsverzeichnis, die Anlagenbeschreibung, eine Geräteliste und ein importiertes Muster-Messprotokoll.

1. **Projekt anlegen.** Objekt und Auftrag erfassen und die benötigten Leistungsbereiche auswählen.
2. **Unterlagen zusammenstellen.** Geräte eintragen, Stromlaufpläne und Messprotokolle hochladen und bei Bedarf Fotos den Brandschutzschottungen zuordnen.
3. **Ausgabe prüfen und erstellen.** In der Dokumentenmatrix festlegen, welche Unterlagen in welches Kapitel gehören. In der Exportprüfung fehlende Dateien erkennen und anschließend Gesamt-PDF und ZIP erzeugen.

Das Gesamt-PDF bündelt die Unterlagen mit Inhaltsverzeichnis. Das ZIP enthält die Kapitel mit den einzelnen PDFs, damit der Empfänger gezielt auf Pläne, Protokolle und Listen zugreifen kann. [Export Schritt für Schritt](docs/BEDIENUNGSANLEITUNG.md#10-gesamt-pdf-und-zip-erstellen)

## Einblick

| Projektübersicht | Exportprüfung |
| --- | --- |
| [![Projektübersicht mit Erfassungsstand und nächsten Arbeitsschritten](docs/screenshots/2026-11-17/02-uebersicht.jpg)](docs/screenshots/2026-11-17/02-uebersicht.jpg) | [![Exportprüfung mit geplanten, vorhandenen und fehlenden PDF-Dateien](docs/screenshots/2026-11-17/09b-exportpruefung.jpg)](docs/screenshots/2026-11-17/09b-exportpruefung.jpg) |
| Hier siehst du den Erfassungsstand und die nächsten Arbeitsschritte. | Hier siehst du vor der Übergabe, welche PDFs vorliegen und welche fehlen. |

Die Aufnahmen zeigen ein Beispielprojekt mit fiktiven Daten. Klicke ein Bild an, um es zu vergrößern. [Weitere Ansichten](docs/screenshots/README.md)

## Lokal mit Docker starten

Voraussetzung ist ein laufendes Docker mit Compose und ein freier Port 3000. Für den ersten Test einen neuen Ordner und Beispieldaten verwenden.

```bash
git clone --branch main https://github.com/loserat/edoku.git edoku-test
cd edoku-test
docker compose up -d --build
```

Öffne danach [localhost:3000](http://localhost:3000) im Browser. Die Anwendung bringt SQLite mit. In der Installationsanleitung steht, wie du einen [eigenen Erstzugang](INSTALL.md#eigener-erstzugang-und-bestehende-konten) einrichtest. Für eine bestehende Installation gilt die [Update-Anleitung](docs/UPDATE.md).

## Funktionen und Anleitungen

| Aufgabe | Anleitung |
| --- | --- |
| Projekte und Stammdaten erfassen | [Projekte anlegen und wechseln](docs/BEDIENUNGSANLEITUNG.md#2-projekt-auswählen-oder-anlegen) |
| Geräte, Pläne und Messprotokolle erfassen | [Gerätelisten](docs/BEDIENUNGSANLEITUNG.md#6-gerätelisten-bearbeiten) · [Anhänge](docs/BEDIENUNGSANLEITUNG.md#7-anhänge-und-nachweise-verwalten) |
| Brandschutzschottungen mit Fotos dokumentieren | [Brandschutz](docs/BEDIENUNGSANLEITUNG.md#8-brandschutz-dokumentieren) |
| Kapitel, PDFs und Übergabe prüfen | [Dokumentenmatrix](docs/BEDIENUNGSANLEITUNG.md#5-dokumentenmatrix-prüfen) · [PDF und ZIP](docs/BEDIENUNGSANLEITUNG.md#10-gesamt-pdf-und-zip-erstellen) |
| Trennstreifen und Ordnerrücken drucken | [Druckhilfen](docs/BEDIENUNGSANLEITUNG.md#11-trennstreifen-und-ordnerrücken-drucken) |
| Ein Projekt zur Weiterbearbeitung übertragen | [Projektpaket und Archiv](docs/BEDIENUNGSANLEITUNG.md#12-projektpakete-und-archiv-verwenden) |

## Projektstand und Betrieb

edoku befindet sich in der **Beta**. Vor der Übergabe prüfst du den Export fachlich, insbesondere fehlende Unterlagen und die korrekte Zuordnung der Kapitel. [Aktueller Stand](docs/AKTUELLER_STAND.md) · [Offene Punkte](docs/OFFENE_PUNKTE.md)

- **Installation und Betrieb** · [Installationsanleitung](INSTALL.md) · [Coolify](docs/COOLIFY.md) · [Benutzerverwaltung](docs/BENUTZERVERWALTUNG.md)
- **Daten und Sicherungen** · [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md) · [Vollsicherung und Wiederherstellung](docs/BETA_BETRIEB.md)
- **Entwicklung und Tests** · [Technik](docs/TECHNIK.md) · [Prüfumfang](docs/TESTS.md) · [Changelog](CHANGELOG.md)

Feedback und Fehlerberichte sind willkommen. Beschreibe bei einem Fehler die Schritte, das erwartete Ergebnis und deinen Programmstand. Verwende für Screenshots und Anhänge Beispieldaten. [Fehler melden](https://github.com/loserat/edoku/issues)

**Lizenz:** Noch nicht festgelegt.
