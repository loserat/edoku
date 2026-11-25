# Dokumentation edoku

**Quellpaket 0.3.0-beta.2:** edoku mit integrierter API/MCP-Anbindung (3.9.0, 55 Werkzeuge). [MCP-Einstieg](../README.md#mit-einem-agenten-über-mcp-arbeiten) · [Docker/Codex](CODEX_DOCKER_MCP.md) · [Vertrag](API_MCP.md). Lokaler und Online-Betrieb bleiben getrennte Prüfstände.

Stand **25.11.2026**: lokal aktiv **App 0.3.0-beta.2 / HTTP-API und MCP 3.9.0**, **64 HTTP-Operationen und 55 MCP-Werkzeuge (22 Lesen / 33 Schreiben)**. Agentenvertrag 2.1, Produktprüfung V7. Die vereinfachte Oberfläche ist nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Neue Dateien weiterhin ausschließlich manuell einzeln in der GUI freigeben.

Änderungen, Tests und lokale Aktivierungen beider Tage: **[Entwicklungsupdate 23.–24.11.2026](ENTWICKLUNGSUPDATE_2026-11-23_24.md)**. Frühere Tagesabschlüsse und vorbereitete Nachweise beschreiben ihren damaligen Zeitpunkt; sie sind keine aktuellen Aktivierungsaufträge.

[Vereinfachter Doku-Assistent](GUI_ASSISTENT_VEREINFACHUNG.md) seit 25.11.2026 lokal aktiv: 43 gezielte Funktionstests und 46 Browserprüfungen, geprüfte Sicherung und Wiederherstellung. [Tagesabschluss 25.11.](TAGESABSCHLUSS_2026-11-25.md).

[GitHub-Übergabe 25.11.2026](GITHUB_STAND_2026-11-25.md) beschreibt den bereinigten Quellstand und die Grenze zum tatsächlichen Online-Deployment.

[Software-, MCP- und API-Version unter Einstellungen → System](SYSTEMVERSIONEN.md).

## Zentrale Einstiege

[Aktueller Stand](AKTUELLER_STAND.md) · [Tests](TESTS.md) · [Offene Punkte](OFFENE_PUNKTE.md) · [API/MCP](API_MCP.md) · [Architektur/Refactoring](API_MCP_REFACTORING.md).

Für die Änderungen vom 23./24.11.: [leere Projekte](LEERE_PROJEKTANLAGE.md), [Materialausschlüsse](MATERIALAUSSCHLUESSE.md), [Aufgabensteuerung](ZENTRALE_AUFGABENSTEUERUNG.md), [Prüflücken V6](PRUEFLUECKEN_ME01.md), [Herstellerprüfung V7](ME01_QUELLEN_UND_MASSE.md), [Dateivorschläge zurückziehen](DATEIVORSCHLAEGE_ZURUECKZIEHEN.md), [PDF-Prüfreihenfolge](PRUEFREIHENFOLGE.md).

[Agentenvertrag 2.1](AGENTENVERTRAG.md) und [Bearbeitungsrichtlinie](BEARBEITUNGSRICHTLINIE.md) sind verbindlich. [Release Notes](RELEASE_NOTES.md), [Versionierung](VERSIONIERUNG.md) und [Tagesabschluss 24.11.](TAGESABSCHLUSS_2026-11-24.md) ergänzen den aktuellen Stand. Veröffentlichung und Online-Stand bleiben getrennt.

## Historischer Abschluss vom 20.11.2026

Damals neuer, noch nicht aktivierter Quellstand: [Recherche- und Bearbeitungszustände](UNTERLAGENARBEIT.md), API 1.6.0 / MCP 1.7.0. Bestehende Installation unverändert.

[Tagesziel 20.11.2026](TAGESABSCHLUSS_2026-11-20.md): Datenblattablauf geprüft und lokal verbessert, fünf neue Dateivorschläge, kompakter MCP-Folgeplan, 202 Anwendungs-/Sicherungsprüfungen, Bestandsschutz und konkrete Benutzerprüfung.

[Tagesabschluss 19.11.2026](TAGESABSCHLUSS_2026-11-19.md) mit Agentenablauf, Recherche, Assistentenumbau, Gerätelisten, zunächst 191, nach der Datenblattprüfung 197 und nach der BALS-Korrektur 201 Prüfungen, Datenerhalt und konkreter Fortsetzung für Beispielprojekt A. Frühere Schritte: [18.11.](TAGESABSCHLUSS_2026-11-18.md), [17.11.](TAGESABSCHLUSS_2026-11-17.md), [Sicherheitskorrektur](SICHERHEITSUPDATE_2026-11-17.md).

## Für Anwender

| Du möchtest … | Hier anfangen |
| --- | --- |
| Den gesamten Ablauf Schritt für Schritt lernen | **[Bebilderte Bedienungsanleitung](BEDIENUNGSANLEITUNG.md)** |
| Funktionen und Oberfläche kennenlernen | [Haupt-README](../README.md) |
| Mit dem Agenten dokumentieren und Dateien einzeln prüfen | [Doku-Assistent](DOKU_ASSISTENT.md) · [Agentenablauf](AGENTENABLAUF.md) |
| Einheitliche Regeln für die Agentenarbeit verwenden | [Bearbeitungsrichtlinie](BEARBEITUNGSRICHTLINIE.md) |
| Exportzähler und unvollständige Ausgaben verstehen | [Gesamt-PDF und ZIP](BEDIENUNGSANLEITUNG.md#10-gesamt-pdf-und-zip-erstellen) |
| Fehlende Brandschutzfotos zuordnen | [Brandschutz bedienen](BEDIENUNGSANLEITUNG.md#8-brandschutz-dokumentieren), [Warnlogik](BRANDSCHUTZFOTOS.md) |
| Ein Projekt zur Weiterbearbeitung übertragen | [Projektpakete bedienen](BEDIENUNGSANLEITUNG.md#12-projektpakete-und-archiv-verwenden) |
| Darstellungsoptionen finden | [Darstellung und Einstellungen](BEDIENUNGSANLEITUNG.md#13-darstellung-und-einstellungen) |
| Ein Problem lösen | [Fragen und Fehlermeldungen](BEDIENUNGSANLEITUNG.md#15-häufige-fragen-und-fehlermeldungen) |

Die Bedienungsanleitung behandelt ausschließlich die App-Nutzung. Servereinrichtung, Datenbankbetrieb und Bereitstellung sind getrennte Themen für Betreiber.

## Für Betrieb und Administration

| Anliegen | Anleitung |
| --- | --- |
| Neu installieren, Docker und SQLite verstehen | [Installation](../INSTALL.md) |
| Lokales edoku als MCP in Codex verwenden | [Docker und Codex](CODEX_DOCKER_MCP.md) |
| Online-Testinstanz mit HTTPS und dauerhaften Datenordnern betreiben | [Coolify](COOLIFY.md) · [Online-Prüfung vom 18.11.2026](ONLINE_PRUEFSTAND.md#update-und-prüfung-vom-18112026) |
| Bestehende Installation aktualisieren | [Update und Datenerhalt](UPDATE.md) |
| Alle Daten einschließlich Konten und Altbestand sichern | [Lokaler Beta-Betrieb](BETA_BETRIEB.md) |
| Sicherung in einen neuen Ordner wiederherstellen | [Getrennte Wiederherstellung](BETA_BETRIEB.md#getrennte-wiederherstellung) |
| Konten, Rollen, Registrierung und Passwortreset verwalten | [Benutzerverwaltung](BENUTZERVERWALTUNG.md) |
| Projektpakete, Validierung und Importbereitstellung verstehen | [Projektarchive](PROJEKTARCHIVE.md) |
| SQLite-Stufen, Herkunftsdaten und Rückweg verstehen | [SQLite-Projektdaten](SQLITE_PROJEKTDATEN.md) |
| Rechte, Schreibschutz und Sicherheitsgrenzen beurteilen | [Sicherheit](SICHERHEIT.md) |
| Globale Gestaltung und Themes pflegen | [Gestaltung](GESTALTUNG.md), [Theme-System](THEME.md) |

Die fünf Laufzeitordner `data/`, `config/`, `storage/`, `output/` und `templates/` bilden zusammen den zu sichernden Bestand. Nach SQLite-Aktivierung sind alte Projekt-JSON-Dateien Ausgangskopien und kein aktueller Spiegel. Ein Projektpaket ersetzt keine Vollsicherung. Gemeinsam genutzte historische Ausgaben bleiben separat erhalten.

## Für Entwicklung und Abnahme

**API/MCP zentral:** [Übersicht und Arbeitsablauf](API_MCP.md) · [erzeugter Vertrag](api/README.md) · [Architektur und Refactoring](API_MCP_REFACTORING.md) · [Speicherpflege](SPEICHERPFLEGE.md).

- [Entwicklungsupdate 23.–24.11.2026](ENTWICKLUNGSUPDATE_2026-11-23_24.md)
- [Tagesabschluss 24.11.2026](TAGESABSCHLUSS_2026-11-24.md)
- [Aktueller Umfang und Prüfstatus](AKTUELLER_STAND.md)
- [Tatsächlich geprüfter Online-Stand und Grenzen](ONLINE_PRUEFSTAND.md)
- [Technik und gemeinsamer Exportplan](TECHNIK.md)
- [Automatisierte Tests und fachliche Abnahme](TESTS.md)
- [Integrations-API, API-Schlüssel und lokaler MCP-Adapter](API.md) – lokaler Quellstand, Bereitstellung gesondert prüfen
- [Doku-Assistent: Auftrag, Rückfragen, Dateisichtung und manuelle Einzelübernahme](DOKU_ASSISTENT.md)
- [Verbindliche Bearbeitungsrichtlinie für Agenten](BEARBEITUNGSRICHTLINIE.md)
- [API-/MCP-Ausbauplan: effizienterer Ablauf und weniger Tokenaufwand](MCP_API_OPTIMIERUNG.md) – Datenblattprüfung umgesetzt, weitere Optimierungen geplant
- [Priorisierte offene Punkte](OFFENE_PUNKTE.md)
- [Änderungsverlauf](../CHANGELOG.md), [Release Notes](RELEASE_NOTES.md), [Projektupdate](PROJEKTUPDATE.md)
- [Repository-Sicherheitscheck](REPO_SICHERHEITSCHECK.md)
- [Screenshots, Datum und Herkunft](screenshots/README.md)

## Aussagekraft der Nachweise

**201 automatisierte Prüfungen** bestanden im zuletzt aktivierten Node-22-Abbild. Die bestandsweite Datenblattprüfung ist lokal aktiviert; der ältere Tagesabschlussstand mit 191 Prüfungen ist historisch. Browserprüfungen verwenden künstliche Daten; zusätzliche Geräte-PDF-Prüfungen verwenden eine getrennte reale Projektkopie. Nach Aktivierung blieben acht geschützte Tabellen sowie Ports, Mounts und Benutzerkennung unverändert. Ältere Nachweise mit acht Projektkopien und 249 PDF-Seiten gehören zur damaligen SQLite-Aktivierung.

Zusätzlich wurden Online-Anmeldung, Speichern/Wiederladen, Erhalt über einen Containerwechsel und PDF-/ZIP-Erzeugung auf einem künstlichen Projekt geprüft. Das Beispiel bleibt wegen 15 fehlender PDF-Quellen unvollständig. Der konkrete Online-Download ist nicht unabhängig verifiziert.

Technische Prüfungen und Screenshots ersetzen keine fachliche Freigabe, Druckabnahme oder vollständige Sicherheits-/Betriebsabnahme. Private Sicherungen und Detailnachweise bleiben in den nicht veröffentlichten Bereichen `backups/` beziehungsweise `intern/`.

- [Automatische Datenblattprüfung: Bedienung, API, MCP und Grenzen](DATENBLATTPRUEFUNG.md)

- [Einzellöschung und Wiederherstellung über API/MCP](EINZELLOESCHUNG.md)
- [Hersteller-PDFs direkt per MCP vorschlagen](MCP_DATEIUEBERGABE.md)
- [Schnelle manuelle Dateiprüfung ohne vollständiges Neuladen](GUI_FREIGABEABLAUF.md)

- [Mehrere Hersteller und Systeme je Leistungsbereich](MEHRFACH_SYSTEMAUSWAHL.md)
- [Einheitliche Bildmarke in GUI und PDF](PDF_BRANDING.md)
