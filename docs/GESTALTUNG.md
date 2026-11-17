# Gestaltung der Anwendung

Stand: 06.11.2026; Gestaltung überarbeitet am 03.11.2026

Die Standardansichten verwenden eine ruhige technische Gestaltung: helle Grauflächen bzw. dunkles Schieferblau, einheitliche Rahmen, zurückhaltende Rundungen und Blau für Hauptaktionen. Grün, Gelb und Rot kennzeichnen weiterhin Erfolg, Hinweise und Fehler. Die wichtigsten Ansichten verwenden dieselben Abstände und Zustände.

## Gemeinsame Bausteine

- `public/css/components/technical.css` vereinheitlicht Navigation, Karten, Formulare, Tabellen, Meldungen, Dialoge und Anmeldung. Die vorhandenen fachlichen Komponenten und Abläufe bleiben erhalten.
- Die beiden bisherigen Standardvorlagen heißen im Editor **edoku Hell** und **edoku Dunkel**. Ihre internen Kennungen bleiben aus Kompatibilitätsgründen `github-light` und `github-dark`.
- `services/settingsService.js` löst unveränderte alte Standardgruppen beim Lesen auf die neuen Vorgaben auf. Gespeicherte Dateien werden dabei nicht umgeschrieben. Eine Gruppe mit individuellen Abweichungen bleibt erhalten; Kontrast- und Farbenblind-Vorlagen bleiben verfügbar.
- `views/partials/themeVariables.ejs` und die Livevorschau im Theme-Editor bestimmen die Beschriftung gefüllter Schaltflächen passend zur gewählten Farbe. Die Standardpaletten und geprüften individuellen Farben erreichen dabei mindestens 4,5:1 Kontrast, auch im Hoverzustand.
- Auf kleinen Bildschirmen scrollen Navigation und breite Tabellen innerhalb ihres Bereichs. Formulare und Auswahlkarten brechen um; die Seite selbst soll keine Überbreite erzeugen.

## Prüfen

`npm run test:theme` prüft die lesende Auflösung alter Standards, den Erhalt eigener Einstellungen und spezieller Vorlagen sowie Schaltflächenkontraste einschließlich Übereinstimmung mit der Livevorschau. Die vier Prüfungen gehören zu `npm test`.

Die Browserprüfung erfolgt mit synthetischen Projekten in einer getrennten Installation. Prüfraster: 320, 390, 768 und 1280 Pixel, heller und dunkler Modus, einschließlich Projektverwaltung, Stammdaten, Leistungsbereichen, Systemauswahl, Dokumentenmatrix, Gerätelisten, Brandschutz, Anhängen, Export, Einstellungen, Projektarchiv und Sicherheitsprotokoll. Zusätzliche Sichtprüfung der Anmeldung, Dialoge und Exportvorschau. Browsermessungen ersetzen keinen Test auf einem physischen Smartphone; eine vollständige Prüfung der Barrierefreiheit ist damit ebenfalls nicht verbunden.

Private Vorher-/Nachherbilder und Prüfnachweise liegen lokal unter `intern/`. Vor der Übernahme wird die laufende Installation vollständig gesichert und der Erhalt der Laufzeitdateien sowie der logischen Datenbankinhalte geprüft. Projekte und historischer Altbestand werden nicht für die Gestaltung bearbeitet.

Die überarbeitete Gestaltung ist in der normalen lokalen Anwendung enthalten. Änderungen wurden mit Testdaten bzw. Projektkopien geprüft und mit Datenerhalt übernommen. Der aktuelle Gesamtprüfstand und die noch offene fachliche bzw. physische Abnahme stehen unter [Tests](TESTS.md).
