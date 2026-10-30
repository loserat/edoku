# Aktueller Stand edoku

Stand: 2026-10-30

Diese Datei fasst zusammen, wo das Projekt gerade steht und wo wir sinnvoll weiterarbeiten sollten.

## Aktuelle lokale Weiterentwicklung

- Design, App-Icon und gemeinsame Ansichtsbausteine überarbeitet.
- Kapitel- und Exportzählung vereinheitlicht; Details in `docs/TECHNIK.md`.
- 18 gezielte Exporttests, ein 20-seitiges Prüfprojekt und 56 interne Links eines dreiseitigen Inhaltsverzeichnisses geprüft.
- Am 30.10.2026 in die normale lokale Docker-Anwendung auf Port 3000 übernommen, nach vollständiger geprüfter Sicherung.
- Vorher/Nachher: 761 Laufzeitdateien gesichert; Projektdateien, Einstellungen, Anhänge und vorhandene Exporte unverändert. Datenbankinhalt und Schema mit neun Projekten, fünf Konten und zwei Sitzungen unverändert.
- 21 automatisierte Prüfungen bestanden: 18 Kapitel-/Exportprüfungen und drei Prüfungen zum Datenerhalt. Zusätzlich zwölf angemeldete Seiten mit einer konsistenten Kopie der echten Daten geprüft.
- 105 Programmdateien der laufenden Hauptinstanz stimmen mit dem getesteten Abbild überein. Erreichbarkeit auf Port 3000 und API-Smoke-Test erfolgreich.
- Bestehende Konten werden beim Neustart nicht zurückgesetzt; reine Seitenaufrufe ändern keine Projektzeitstempel und speichern keine Systemauswahl.
- Sicherung und lokale Nachweise: `backups/2026-10-30_uebernahme-edoku-6hmt5og/UEBERNAHME.md` (von Git und Docker-Builds ausgeschlossen).
- Paketversion bleibt `0.1.0-beta.1`; die Weiterentwicklung ist kein neuer getaggter Release.
- Weitere Sicherheits- und Projektarchivprobleme bleiben offen; die lokale Übernahme ist keine Freigabe für öffentlichen Serverbetrieb.

## Kurzstatus

edoku ist aktuell eine lauffähige Beta-Anwendung für lokale und Docker-basierte Tests. Die Grundmodule für Projektverwaltung, Leistungsbereiche, Anhänge, Gerätelisten, Brandschutz, PDF-Erzeugung, Exportvorbereitung, Benutzerrollen, Themes und ein erstes API-Grundgerüst sind vorhanden.

Der aktuelle Stand ist noch nicht als final gehärtete Produktivversion zu bewerten. Für einen bezahlten Webserverbetrieb fehlen vor allem Sicherheits-, Rollen-, Backup-, Deployment- und Testhärtung.

## Bestehende technische Grundlage

- Das API-/Backend-Grundgerüst wurde in `main` übernommen.
- Die API liefert einheitliche JSON-Antworten für Healthcheck, Projekte, Leistungsbereiche, Gerätelisten, Dokumente und Exportstatus.
- Session-Cookies wurden für lokalen Betrieb und Reverse-Proxy-/HTTPS-Betrieb gehärtet.
- `config/geraetelistenVorlagen.json` und `config/systemEinstellungen.json` sind lokale Laufzeit-Konfigurationen und sollten nicht ungeprüft committed werden.

## Aktuell vorhandene Hauptbereiche

- Projekte
- Übersicht / Dashboard
- Anhänge
- Brandschutz
- Gerätelisten
- Export
- System

## Wichtige vorhandene Funktionen

- Login, Registrierung und Session-Verwaltung
- Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin`
- projektbezogene Datenablage je Benutzer
- Projektmanager mit aktuellem Projekt
- Projektstammdaten inklusive Objektstruktur und Stockwerken
- Leistungsbereiche mit Formularvorgaben
- Dokumentenmatrix im Exportbereich
- Gerätelisten mit Vorlagenfunktion
- Brandschutzabschottungen mit Foto-1-/Foto-2-Zuordnung
- Anhänge als kategoriebezogene Kacheln
- Bedienungsanleitungen als vorbereitete Anhangskategorie mit Gerätebezug
- PDF-Erzeugung inklusive Deckblättern, Listen, Brandschutzseiten, Trennstreifen und Ordnerrücken
- Theme-System mit GitHub-/VS-Code-orientierten Presets
- Systembereich mit Version und GitHub-Update-Prüfung
- API-Grundgerüst unter `/api/*`

## Nächste Arbeitspakete

1. Archivdownloads, Benutzertrennung der Ausgaben und zuverlässige Fehlermeldungen beim Speichern absichern. Projektpakete auf Vollständigkeit prüfen.
2. Neue Kapitel-/Seitenzählung und Inhaltsverzeichnis mit echten Anhängen fachlich und visuell abnehmen; ZIP-Inhalte und Druckvorlagen praktisch prüfen.
3. Rechte-/Rollenmodell systematisch testen, CSRF-/Login-Schutz und ein wiederholbares Backup-/Restore-Verfahren ergänzen.
4. Liegenschaften und Gebäude additiv einführen. Die spätere Objektstruktur vorbereiten, ohne bestehende Projektdaten automatisch umzubauen.

Klickbare Inhaltsverzeichnisse und das Einrechnen externer PDF-Seiten sind
bereits umgesetzt und automatisiert geprüft. Die offene Aufgabe ist deren
Abnahme mit realen Dokumentationen.

## Einstieg in die Dokumentation

- [Technik und gemeinsame Exportstruktur](TECHNIK.md)
- [Gestaltung, CSS-Aufteilung und Icons](THEME.md)
- [Automatisierte Prüfungen und manuelle Beta-Abnahme](TESTS.md)
- [Lokales Update, Sicherung und Wiederherstellung](UPDATE.md)
- [Priorisierte offene Punkte](OFFENE_PUNKTE.md)
- [Release Notes](RELEASE_NOTES.md)
