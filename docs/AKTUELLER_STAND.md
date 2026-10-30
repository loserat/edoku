# Aktueller Stand edoku

Stand: 2026-10-30

Diese Datei fasst zusammen, wo das Projekt gerade steht und wo wir sinnvoll weiterarbeiten sollten.

## Lokaler Beta-Betrieb

Sicherheitsprotokoll mit Systemadmin-Ansicht, Vollsicherung einschließlich Docker-Abbild, getrennte Wiederherstellung und GitHub-Prüfungen sind ergänzt. Alle 52 automatisierten Prüfungen bestehen im Node-22-Abbild. Eine vollständige Sicherung einschließlich Abbild wurde getrennt wiederhergestellt; alte und neue Anwendung öffneten jeweils sechs öffentliche und zwölf angemeldete Seiten, ohne Projektdateien oder Datenbankinhalte zu ändern. Anleitungen und Grenzen: [BETA_BETRIEB.md](BETA_BETRIEB.md).

Die normale lokale Anwendung auf Port 3000 wurde nach geprüfter Vollsicherung auf diesen Stand umgestellt. Alle 761 vorhandenen Dateien einschließlich operativer SQLite-Dateien sind in der Sicherung enthalten; beim Vergleich nach der Übernahme blieben die 758 übrigen Dateien sowie Datenbankschema und alle Tabelleninhalte unverändert. 129 Programmdateien entsprachen dem vorbereiteten Abbild. Acht öffentliche Prüfungen, 13 angemeldete Seiten einschließlich Sicherheitsprotokoll und der API-Smoke-Test waren erfolgreich. Die [GitHub-Prüfung des Programmstands](https://github.com/loserat/edoku/actions/runs/41108350058) war erfolgreich. Private Sicherungen und Nachweise bleiben ausschließlich lokal.

## Sicherheits- und Archivkorrekturen vom 30.10.2026

- Nach vollständiger geprüfter Sicherung in die normale lokale Anwendung auf Port 3000 übernommen; vorhandene Projektdateien, Einstellungen und Datenbankinhalte unverändert.
- Begrenzte Archiv-/Anhangsdownloads, Prüfung tatsächlicher Dateitypen und Abweisung von Symlink-Umgehungen.
- Neue Ausgabeablage nach Benutzer-/Projektkennung; alte gemeinsame Ausgaben bleiben auf ausdrücklichen Benutzerwunsch separat historisch erhalten.
- Signierter CSRF-Schutz, Login-/Registrierungsbegrenzung und serverseitige Rollenprüfung für globale Änderungen.
- Atomare JSON-Speicherung, Fehlerweitergabe und Erhalt vorheriger PDFs/finaler Exporte.
- Echte Projekt-ZIPs, Prüfsummen, sichere Rückimporte mit umgesetzten Pfaden und Kennungsschutz.
- 38 automatisierte Prüfungen erfolgreich. In einer konsistenten echten Datenkopie: alle acht nicht gelöschten Projekte erfolgreich exportiert und rückimportiert, ohne ursprüngliche Projektdateien oder bestehende Datenbankzeilen zu verändern.
- Start, sechs öffentliche und zwölf angemeldete Seiten mit Datenkopie geprüft; Dateien und Datenbank unverändert. Private Nachweise und Vollsicherungen bleiben lokal unter `backups/`.
- Bereits fehlende Logos/Fotos werden als Quelllücken dokumentiert; keine erfundenen Dateien und keine automatische Änderung bestehender Projekteinträge.

Details: [Zugriffsschutz](SICHERHEIT.md), [Projektarchive](PROJEKTARCHIVE.md), [Tests](TESTS.md).

## Zuvor übernommene Gestaltung und Exportzählung

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
- Die anschließenden Sicherheits-/Archivkorrekturen stehen im oberen Abschnitt; die lokale Übernahme ist keine Freigabe für öffentlichen Serverbetrieb.

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

1. Externe Sicherung und regelmäßige Proben einrichten; lokales Sicherheitsprotokoll sowie Vollsicherung und getrennte Wiederherstellung sind umgesetzt. Historische Dateibestände bleiben unverändert erhalten.
2. Neue Kapitel-/Seitenzählung und Inhaltsverzeichnis mit echten Anhängen fachlich und visuell abnehmen; ZIP-Inhalte und Druckvorlagen praktisch prüfen.
3. Browser-/Proxy- und Fachtestabdeckung über die umgesetzten Rechte-, CSRF- und Login-Kernfälle hinaus erweitern.
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
