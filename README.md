# edoku

**Elektro-Bestandsdokumentationen strukturiert erfassen, prüfen und als PDF oder ZIP ausgeben.**

edoku verbindet Projektstammdaten, Gerätelisten, Brandschutzfotos und technische Unterlagen zu einer geordneten Dokumentation. Die Weboberfläche läuft lokal mit Docker oder als eigene Serverinstallation mit Coolify. SQLite ist bereits eingebaut; ein zusätzlicher Datenbankserver ist nicht erforderlich.

**Für Anwender:** [Bedienungsanleitung](docs/BEDIENUNGSANLEITUNG.md) · [Funktionsüberblick](#funktionen)

**Für Betrieb und Entwicklung:** [Installation](INSTALL.md) · [Coolify](docs/COOLIFY.md) · [Aktueller Stand](docs/AKTUELLER_STAND.md) · [Dokumentationsübersicht](docs/README.md)

> **Beta · Stand 17.11.2026 · `0.1.0-beta.1`**
>
> Der geprüfte Programmstand und diese Dokumentation sind in `main` übernommen. Der ursprüngliche Prüfbranch bleibt als Verlauf erhalten. Die Online-Testinstanz verwendet den Programmcommit [`a07104b`](https://github.com/loserat/edoku/commit/a07104ba18c0cb1ea0d7958ebc32504c47bd002e). Das ist kein neuer Release und keine fachliche Freigabe. Einschränkungen stehen unter [Offene Punkte](docs/OFFENE_PUNKTE.md).

## Einblick

| Projekt und nächster Arbeitsschritt | Export prüfen, bevor er versendet wird |
| --- | --- |
| [![Projektübersicht mit Erfassungsstand und Arbeitsschritten](docs/screenshots/2026-11-17/02-uebersicht.jpg)](docs/screenshots/2026-11-17/02-uebersicht.jpg) | [![Exportprüfung mit getrennten Datei- und Seitenzählern sowie fehlenden Unterlagen](docs/screenshots/2026-11-17/09b-exportpruefung.jpg)](docs/screenshots/2026-11-17/09b-exportpruefung.jpg) |

Echte Aufnahmen der Anwendung vom 17.11.2026, ausschließlich mit künstlichen Testdaten. Das Beispiel enthält bewusst fehlende Unterlagen: **33 vorhandene von 48 geplanten Einzel-PDFs, 35 tatsächliche Seiten**. Ein erstellter Export ersetzt keine Vollständigkeitsprüfung. [Screenshots und Herkunft](docs/screenshots/README.md).

## Vom Projekt zur Dokumentation

1. **Projekt auswählen oder anlegen:** Stammdaten, Auftraggeber und Objektstruktur erfassen.
2. **Leistungsbereiche festlegen:** Passende Gerätelisten und Dokumentvorgaben auswählen.
3. **Inhalte ergänzen:** Geräte erfassen, Pläne und Nachweise importieren, Brandschutzfotos zuordnen.
4. **Matrix und PDFs prüfen:** Ausgabeumfang, Kapitel, Pflichtunterlagen und Vorschau kontrollieren.
5. **Export erstellen und freigeben:** Gesamt-PDF, Kapitel-ZIP und Reihenfolgeprotokoll prüfen; fehlende Quellen ergänzen und erneut erzeugen.

Die [bebilderte Bedienungsanleitung](docs/BEDIENUNGSANLEITUNG.md) erklärt jeden Schritt, die Zähler, häufige Fehler und den Unterschied zwischen Dokumentations-ZIP, Projektpaket und Vollsicherung.

## Funktionen

| Bereich | Was edoku unterstützt |
| --- | --- |
| Projekte | Mehrere eigene Projekte, Arbeitskontext, Stammdaten, Stockwerke und Archivstatus |
| Dokumentenmatrix | Ausgabeauswahl, Pflichtkennzeichnung und gemeinsame Kapitelstruktur |
| Gerätelisten | Positionen je Leistungsbereich, Hersteller/System/Typ, Vorlagen und Zuordnung von Bedienungsanleitungen |
| Anhänge | Pläne, Messprotokolle, Nachweise, PDFs und Bilder nach Kategorien |
| Brandschutz | Schottungen, Foto-1-/Foto-2-Zuordnung und Warnungen bei fehlenden referenzierten Dateien |
| PDF und ZIP | Inhaltsverzeichnis, Deckblätter, Formulare, Listen, Gesamt-PDF, Kapitelordner und Reihenfolgeprotokoll |
| Druckhilfen | Separate Trennstreifen sowie Ordnerrücken für `61x192-R` und `38x192-R` |
| Konten | Eigene Projektbereiche, Rollen, Kontosperre und standardmäßig geschlossene Registrierung |
| Oberfläche | Helle/dunkle Darstellung, gemeinsame Navigation und konfigurierbare Themes |
| Betrieb | Eingebettetes SQLite, fünf dauerhafte Datenordner, Sicherheitsprotokoll und geprüfte Sicherungswerkzeuge |

## Lokal mit Docker starten

Für eine **neue lokale Testinstallation in einem neuen Verzeichnis**. Vor dem ersten Start bei Bedarf den [eigenen Erstzugang](INSTALL.md#eigener-erstzugang-und-bestehende-konten) einrichten; der einfache Standardstart verwendet sonst das lokale Demo-Verhalten:

```bash
git clone --branch main https://github.com/loserat/edoku.git edoku-test
cd edoku-test
docker compose up -d --build
```

Danach [http://localhost:3000](http://localhost:3000) öffnen. Der Port muss frei sein. Die Einrichtung eines eigenen Erstkontos und die Alternative ohne Docker stehen in [INSTALL.md](INSTALL.md). Öffentlich erreichbare Neuinstallationen mit einem eigenen Erstkonto einrichten; Anleitung: [Coolify](docs/COOLIFY.md).

**Vorhandene Installation?** Zuerst [Update und Datenerhalt](docs/UPDATE.md) lesen und vollständig sichern. Ein neuer Checkout darf die bestehende Datenablage nicht ersetzen. Keine Volumes oder Datenbankdateien zum Zurücksetzen löschen.

## Coolify und Datenbank

Der mehrstufige Docker-Build enthält Node.js 22, die SQLite-Anbindung und Python für Sicherungswerkzeuge. Beim ersten Start einer echten Neuinstallation entsteht `storage/app.db`. Beide SQLite-Stufen werden für neue Installationen aktiviert; bestehende Installationen wechseln nach geprüfter Sicherung ausdrücklich.

Für Coolify **Dockerfile** mit internem Port `3000` oder die separate `docker-compose.coolify.yml` verwenden. HTTPS, eigene Erstzugangsvariablen und dauerhafte Volumes einrichten. Der Healthcheck `/ready` prüft die tatsächliche SQLite-Bereitschaft. Das additive `/api/*`-Grundgerüst ist noch keine vollständige API für Benutzerprojekte.

[Coolify einrichten](docs/COOLIFY.md) · [SQLite verstehen](docs/SQLITE_PROJEKTDATEN.md) · [API-Grenzen](docs/API.md)

## Daten erhalten und sichern

Strukturierte Projektdaten, Konten und Sitzungen liegen in SQLite. Fotos, Anhänge und Ausgabedateien bleiben Dateien; globale Vorgaben und Vorlagen bleiben dateibasiert. Zusammen gehören **`data/`, `config/`, `storage/`, `output/` und `templates/`** zur Sicherung. Historische gemeinsame Ausgaben bleiben separat erhalten. Alte Projekt-JSON-Dateien sind nach SQLite-Aktivierung kein aktueller Spiegel.

| Zweck | Richtiger Weg |
| --- | --- |
| Fertige Unterlagen weitergeben | [Gesamt-PDF und Dokumentations-ZIP](docs/BEDIENUNGSANLEITUNG.md#10-gesamt-pdf-und-zip-erstellen) |
| Ein Projekt zur Weiterbearbeitung übertragen | [Projektpaket mit Manifest und Prüfsummen](docs/PROJEKTARCHIVE.md) |
| Ganze Installation einschließlich Konten und Altbestand absichern | [Vollsicherung und getrennte Wiederherstellung](docs/BETA_BETRIEB.md) |

Eine Kopie auf einem weiteren Datenträger und regelmäßige Wiederherstellungsproben bleiben erforderlich. Private Projekte, Kontodaten, Sicherungen und Laufzeitdateien gehören nicht ins Repository.

## Geprüft und noch offen

- **Automatisiert:** 109 Prüfungen im Node-22-Testabbild bestanden: 101 Node.js- und acht Python-Prüfungen. Paketprüfung am 17.11.2026: keine bekannten npm-Lücken im geprüften Stand.
- **Mit Projektkopien:** Acht bestehende Projekte vor/nach SQLite-Stufe 2 technisch verglichen, einschließlich 249 tatsächlicher PDF-Seiten, Projektpaketen und Rückimporten. Originalbestand erhalten.
- **Online:** HTTPS, Anmeldung, Speichern/Wiederladen, Erhalt über einen Containerwechsel sowie PDF-/ZIP-Erzeugung auf der Testinstanz geprüft. Das künstliche Projekt meldet 15 fehlende PDF-Quellen; der Export ist fachlich unvollständig. Der Download wurde in dieser Runde nicht unabhängig geprüft.
- **Offen:** Fachliche Abnahme, externe Sicherungsorganisation, physische Druckprüfung, weitere Browser-/Barrierefreiheitsfälle, eigener Benutzer-Passwortwechsel und eine vollständige Betriebs-/Sicherheitsabnahme.

Die Nachweise sind datiert. Ein lokaler Testlauf ist kein GitHub-CI-Lauf. [Prüfumfang](docs/TESTS.md) · [Online-Prüfstand](docs/ONLINE_PRUEFSTAND.md) · [Offene Punkte](docs/OFFENE_PUNKTE.md)

## Entwickeln und mitmachen

Node.js/Express, EJS, Vanilla JavaScript und CSS bilden die Anwendung. Details stehen in [Technik](docs/TECHNIK.md). Tests in einer getrennten Umgebung mit neutralen Startdaten ausführen, da Exporttests Dateien erzeugen:

```bash
npm run check
npm test
```

Tester und Mitentwickler sind willkommen. Bei Fehlern bitte Schritte, erwartetes Ergebnis, tatsächliche Meldung und Programmstand in einem [Issue](https://github.com/loserat/edoku/issues) angeben. Screenshots vorher auf private Daten prüfen; keine Passwörter oder echten Projektarchive hochladen.

## Weiterführende Dokumentation

[Bedienung](docs/BEDIENUNGSANLEITUNG.md) · [Dokumentationsübersicht](docs/README.md) · [Benutzerverwaltung](docs/BENUTZERVERWALTUNG.md) · [Sicherheit](docs/SICHERHEIT.md) · [Brandschutzfotos](docs/BRANDSCHUTZFOTOS.md) · [Changelog](CHANGELOG.md)

**Lizenz:** Noch nicht festgelegt.
