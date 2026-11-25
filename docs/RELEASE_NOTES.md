# Release Notes

## 0.3.0-beta.1 – 25.11.2026

Gebündelter Ausbau für die nächste öffentliche Beta: integrierte HTTP-API und lokaler MCP-Adapter mit 55 Werkzeugen (22 Lesen/33 Schreiben), zentral berechnete Agentenaufgaben, Materialimport und Artikelzuordnung, Hersteller-PDF-/Variantenprüfung, dauerhafte Fakten und gebündelte Rückfragen. Vereinfachter Doku-Assistent, direkte Einzelprüfung und nächster Dateiwechsel, begründetes Zurückziehen sowie geschützte Lösch-/Wiederherstellungsfunktionen.

API/MCP bleiben **3.9.0**; der App-Versionssprung bündelt die neuen Funktionen und ändert weder Rechte noch Datenbankschema. Alle neuen Dateien weiterhin ausschließlich manuell einzeln in der GUI freigeben. README um klaren MCP-Einstieg erweitert. Private Daten, Schlüssel und lokale Einstellungen gehören nicht zur Veröffentlichung. GitHub-Stand, lokale Installation und tatsächliches Online-Deployment werden getrennt nachgewiesen.

## 0.2.0-beta.13 – 25.11.2026

Schlichter Doku-Assistent: kompakte Projektkopfzeile und Zähler in der Navigation, einfache Arbeitsliste ohne wiederholte Projektspalte. Materialregeln, MCP-Verbindung und Brandschutzhinweise bei Bedarf aufklappen. Suche, Filter, Antworten und manuelle Datei-Einzelprüfung mit direktem Weiterwechsel erhalten. Die Sichtungscheckbox der nächsten Datei bleibt leer; kein automatisches Freigeben.

43 gezielte Funktionstests und 46 Browserprüfungen mit künstlichen Daten bestanden; Desktop und Mobil bis 320 Pixel geprüft. Vorschauhilfe repariert, echte Herstellerprüfung unverändert. API/MCP weiterhin 3.9.0, 64 Operationen/55 Werkzeuge; keine Datenbankschema-Migration oder neuen Abhängigkeiten. Am 25.11.2026 nach geprüfter Sicherung und Wiederherstellungsprobe lokal aktiviert; 2.000 Dateien/16 Tabellen im Aktivierungsvergleich unverändert. Keine Veröffentlichung. [Bedienung und Prüfgrenzen](GUI_ASSISTENT_VEREINFACHUNG.md).

## 0.2.0-beta.12 – 24.11.2026

Nach PDF-Freigabe, Ablehnung oder Zurückziehen folgt der nächste offene Vorschlag hinter der aktuellen Datei. Gemeinsame sichtbare Reihenfolge, kein automatischer Umlauf zum Anfang; am Ende Hinweis auf früher übersprungene Dateien. JSON-Wechsel und Formularweg ohne JavaScript erhalten, jede Datei weiterhin einzeln manuell freigeben. Enthält beta.11-Rückziehfunktion; API/MCP unverändert 3.9.0 (64 Operationen/55 Werkzeuge). [Ablauf](PRUEFREIHENFOLGE.md). Am 24.11.2026 nach ausdrücklicher Freigabe und geprüfter Sicherung/Wiederherstellung lokal aktiviert. Bestand und Dateientscheidungen unverändert; keine Veröffentlichung.

## 0.2.0-beta.11 – 24.11.2026

API/MCP 3.9.0: bis zu zehn offene Dateivorschläge mit Begründung und Beleg atomar zurückziehen. Eigener Status, Originale/Verlauf erhalten, GUI mit direktem Wechsel zur nächsten Datei; zurückgezogene Vorschläge entsperren die gezielte Gerätelöschung, andere fachliche Bezüge bleiben geschützt. 64 Operationen/55 Werkzeuge, keine Datenbankschema-Migration oder Dateifreigabe über MCP. [Ablauf und Grenzen](DATEIVORSCHLAEGE_ZURUECKZIEHEN.md). Noch nicht lokal aktiviert.

## 0.2.0-beta.10 – 24.11.2026

API/MCP 3.8.2, Produktprüfung V7: belegte Hersteller-/Markenzuordnungen ergänzen, veröffentlichte PDF-Endpunkte ohne Dateiendung erkennen, FRÄNKISCHE-Familienartikel an eigene Typ-/SKU-/GTIN-Zeile binden und beschriftete NIEDAX-/OBO-Varianten exakt prüfen. Reine Katalogmaße sind optional; tatsächliche Ausführungsangaben bleiben notwendig. Konkrete Blocker erzeugen keine zusätzliche allgemeine Reparaturschleife. Bestehende Daten/Freigaben erhalten, neue Dateien nur manuell einzeln freigeben. 63 Operationen/54 Werkzeuge unverändert. [Regeln und Grenzen](ME01_QUELLEN_UND_MASSE.md). Am 24.11.2026 nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Bestand und Dateientscheidungen unverändert; keine Veröffentlichung.

## 0.2.0-beta.9 – 23.11.2026

Nach ausdrücklicher Freigabe am 23.11.2026 gesichert lokal aktiviert; Wiederherstellung/Start alt und neu getrennt geprüft. 1.557 geschützte Dateien/16 Tabellen unverändert. [Betriebsnachweis](AKTUELLER_STAND.md).

API/MCP 3.8.1, PDF-Prüfrichtlinie v6: exakte NIEDAX-RAW-Innen-/Gesamtbreite und bestätigter OBO-Artikelalias mit beschrifteten Längen-/Breitenfeldern. Aktuelle Blocker stellen Zuordnungskonflikte zurück; nur passende neue Prüfmöglichkeiten öffnen alte Blocker. Explizite Muster im Bemerkungsfeld erzeugen keine Recherche-/Gerätefeldfragen. Bestehende Positionen, Quellen und Freigaben erhalten; jede neue Datei weiterhin manuell einzeln prüfen. 63 Operationen/54 Werkzeuge unverändert. [Details](PRUEFLUECKEN_ME01.md).

## 0.2.0-beta.8 – 23.11.2026

Nach ausdrücklicher Aktivierungsfreigabe gesichert lokal aktiviert. Frische Vollsicherung und getrennter Restore/Start erfolgreich, 1.556 geschützte Dateien/16 Tabellen unverändert. App/API/MCP und 54 Werkzeuge lesend bestätigt. Kein veröffentlichter Release. [Nachweis](AKTUELLER_STAND.md).

API/MCP 3.8.0, Agentenvertrag 2.1: zentrale Materialquellerfassung und belegte Gerätezuordnung mit eigener Vollständigkeitsprüfung, unabhängige Aufgaben vor Rückfragen, thematische Fragepakete bis zu drei Fragen und unveränderte Größen-/Freigabegrenzen. 63 Operationen/54 Werkzeuge. Bestehende Daten/Dateientscheidungen bleiben erhalten; keine stille Materialmigration. [Ablauf und Grenzen](ZENTRALE_AUFGABENSTEUERUNG.md).

## 0.2.0-beta.7 – 23.11.2026

Lokal nach Importende mit aktueller geprüfter Sicherung und getrennter Wiederherstellung aktiviert. 1.529 geschützte Dateien/16 Tabellen unverändert; keine Veröffentlichung. [Betriebsnachweis](AKTUELLER_STAND.md).

API/MCP 3.7.0: drei projektbezogene Ausschlüsse für Verbindungsklemmen, Kabel/Leitungen und Befestigungsmaterial im Doku-Assistenten. Steuern kompakte Agentenanweisungen, neue Materialübernahme, Artikelrecherche und erzeugte Gerätelisten. Daten, Originalpositionen, Dateien und Freigaben bleiben erhalten; explizite Auswahl mit Verlauf und Versionsschutz. Neue Projekte mit drei aktiven Regeln, alte Kabeldokumentation bleibt bis zur Änderung erhalten. 61 Operationen/52 Werkzeuge unverändert. [Ablauf und Aktivierungsstand](MATERIALAUSSCHLUESSE.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.6 – 23.11.2026

API/MCP 3.6.1: normale Neuanlage übernimmt ausschließlich eingegebene Stammdaten und Struktur. Keine Beispielgeräte, Schotts, Systeme, Dokumente oder Projekthinweise. Leistungsbereichsauswahl startet leer, neue Listen ohne Platzhalterposition. Bestehende Projekte, Vorlagen, Importe und Freigaben erhalten. 61 Operationen/52 Werkzeuge, keine neuen Rechte/Argumente. [Ablauf und Aktivierungsstand](LEERE_PROJEKTANLAGE.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.5 – 22.11.2026

API/MCP **3.6.0**: ein lesendes Werkzeug für höchstens drei PDF-Kandidaten aus offizieller Produktseite und einer eingebundenen Fragmentstufe, ohne HTML-/PDF-Volltext. Produktprüfung **v5** bestätigt die gezielte NIEDAX-KTUM-Auflagelängenzuordnung und lässt andere Maße/Varianten gesperrt. 61 Operationen/52 Werkzeuge (21 lesend, 31 schreibend). Keine Datenmigration; bestehende Daten und manuelle Einzelprüfung erhalten. [Ablauf und Grenzen](KOMPAKTE_HERSTELLER_LINKS.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.4 – 22.11.2026

API/MCP **3.5.0**: kompakte Brandschutz-Recherchehilfe mit Systemarten, Herstellerquellen, Formularreihenfolge und gezielten Faktenchecklisten. Testannahmen bleiben vom tatsächlichen Einbau getrennt. Vorlagen und unvollständige Erklärungsentwürfe erfüllen keine Pflicht, auch nach manueller Übernahme/Umbenennung. GUI zeigt den Status; bestehende Dateien und Freigaben erhalten. 60 HTTP-Operationen/51 MCP-Werkzeuge (20 lesend, 31 schreibend), keine Datenmigration oder neuen Berechtigungsarten. [Ablauf und Grenzen](BRANDSCHUTZ_AGENTENABLAUF.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.3 – 22.11.2026

API/MCP **3.4.0**: kompakte Statusübersicht ohne vollständige Listen, kleine Abschnittsseiten und direkte Anforderungs-/Warteziele in den bestehenden Werkzeugen. Filter vor Seitenauswahl, größenabhängige Seiten mit nextOffset, gezielte Originalbelege und unveränderte HTTP-Defaults. 59 HTTP-Operationen/50 Werkzeuge; keine zusätzlichen Rechte oder Datenmigration. Dateien weiterhin ausschließlich manuell einzeln freigeben. [Vertrag und Prüfstand](KOMPAKTE_STATUSABFRAGEN.md).

Die folgenden Abschnitte sind historische Stände.

## 0.2.0-beta.2 – 22.11.2026

Brandschutz-PDF-Verknüpfung und Herstellerprüfung korrigiert; API/MCP **3.3.1**, weiterhin 59 HTTP-Operationen und 50 Werkzeuge. Aktive Materialpositionen, erhaltene GUI-Zuordnung, Kapitelverweise und Datenblattabdeckung zusammengeführt. Offizielle ZAPP-ZIMMERMANN-Quelle und exakter System-/Komponentenabgleich für Montageanleitungen. Datenmodell und Abhängigkeiten unverändert; Dateien ausschließlich einzeln manuell freigeben. [Prüfablauf und Bereitstellung](BRANDSCHUTZ_PDF_VERKNUEPFUNG.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.1 – 22.11.2026

Lokales Versionspaket mit API/MCP **3.3.0**, **59 HTTP-Operationen und 50 MCP-Werkzeugen**. Die Anwendung bleibt Beta. Version und lokale Bereitstellung sind von GitHub-/Online-Veröffentlichung und fachlicher Abnahme getrennt.

- **Geführte Agentenarbeit:** belegte Informationsfragmente, Widersprüche, Abhängigkeiten und priorisierte Einzelrückfragen. Vorhandene Antworten zuerst strukturieren; Herstellerrecherche bleibt vor Bestätigung eine Vermutung. Neuer kompakter Leseweg `edoku_knowledge`.
- **Brandschutz-Pflichtunterlagen:** ausgefüllte Übereinstimmungsbestätigung aller Schotts sowie passende Montageanleitung und Zulassungs-/Prüfnachweis je System. Keine Hersteller-Leistungserklärung als Ersatz.
- **Herstellerunterlagen:** bestandsweite Datenblattabdeckung, verlinkte Original-PDFs und gezielte Artikel-/Variantenprüfung; Quellen und Rechercheblocker nachvollziehbar erhalten.
- **Einfacher prüfen:** Assistent auf das geöffnete Projekt begrenzt, einzelne Dateientscheidungen ohne komplette Neuladung und direkter Wechsel zur nächsten Datei. Mehrere Hersteller/Systeme je Leistungsbereich; einheitliches GUI-/PDF-Fußlogo.
- **Bestand schützen:** gezielte Löschung mit Vorschau, Wiederherstellung und Protokoll; gesonderter gesicherter Projektreset. Neue Abhängigkeiten berücksichtigen den vorhandenen Löschschutz.
- **Freigaben bleiben manuell:** jede neue Datei einzeln in der GUI sichten und bestätigen. Keine automatische fachliche Abnahme, Unterschrift oder Änderung vorhandener Daten durch dieses Versionspaket.

Funktionaler Prüfstand: 258 Anwendungstests, acht Sicherungstests und sieben Wartungsprüfungen. Das Versionsabbild wurde erneut vollständig getestet, gesichert lokal aktiviert und über die laufende Versionsauskunft geprüft. Bestandsvergleich: 1.334 Dateien und 16 Tabellen unverändert. [Bereitstellungsnachweis](AKTUELLER_STAND.md). Paketabhängigkeiten, API/MCP-Vertrag und Datenmodell werden mit diesem Paket nicht geändert.

**Weiter offen:** technische Brandschutz-PDF-Verknüpfung/Herstellerquellen-Freischaltung, ein zu großer unpaginierter Bereitschaftsabruf sowie echte fehlende Einbaudaten und fachliche Abnahme. Einzelheiten: [offene Punkte](OFFENE_PUNKTE.md). [Tagesabschluss](TAGESABSCHLUSS_2026-11-22.md) · [Versionsschema](VERSIONIERUNG.md).

Die folgenden datierten Abschnitte dokumentieren frühere Stände mit ihren damaligen Versions- und Testzahlen.

## Lokaler Arbeitsstand 19.11.2026 – kein neuer Release-Tag

API/MCP und Codex-Verbindung lokal aktiv, 34 Werkzeuge, Host-Adapter unabhängig vom edoku-Container. Kompakter Doku-Assistent mit direkter Prüfliste und manueller Dateifreigabe. Projekttexte intern; Quellenbemerkungen sowie Spannungs-/Leistungsspalten entfallen in neuen Geräte-PDFs. Bestehende Werte bleiben gespeichert.

191 Prüfungen erfolgreich, Browser und Geräte-PDFs auf getrennten Testdaten/Kopien geprüft. Lokale Updates mit Sicherung, separatem Restore und Bestandsvergleich aktiviert. Paketversion bleibt `0.1.0-beta.1`; kein heutiger GitHub-/Online-Release. Beispielprojekt A bleibt fachlich unvollständig. [Tagesabschluss](TAGESABSCHLUSS_2026-11-19.md).

## Übernahme des geprüften Stands in main – 17.11.2026

Programmstand, Tests, Docker-Konfiguration, Bedienungsanleitung und 16 Screenshots gemeinsam in `main` übernommen. README und Installation zeigen auf den Hauptbranch. Paketversion bleibt `0.1.0-beta.1`; kein neuer Release-Tag und keine automatische Aktivierung in bestehenden Installationen. Konten, Projekte, Daten, Sicherungen und historischer Altbestand bleiben unverändert. Die fachlichen Exportlücken und Betriebsgrenzen bleiben dokumentiert.

## Dokumentierter Stand 17.11.2026 – Online-Testbetrieb und Bedienung

Paketversion weiterhin `0.1.0-beta.1`, kein neuer Release-Tag. Geprüfter Programmcommit `a07104ba18c0cb1ea0d7958ebc32504c47bd002e` auf `gm/coolify-test-20261117`. Mehrstufiger Docker-Build, echte Bereitschaftsprüfung, eigenes Erstkonto und fünf dauerhafte Laufzeitordner. Kompatible Paketkorrekturen; 109 automatisierte Prüfungen bestanden und null bekannte npm-Lücken zum Prüfzeitpunkt.

HTTPS, Anmeldung, Projekt-/Gerätespeicherung und PDF-/ZIP-Erzeugung zusätzlich online geprüft. Das Testprojekt meldet 15 fehlende PDF-Quellen; angebotene Dateien sind ein Teilstand, keine fachliche Freigabe. Der Online-Download wurde nicht unabhängig geprüft. Lokale Originaldaten bleiben unverändert. [Online-Nachweis](ONLINE_PRUEFSTAND.md).

README und Dokumentationsübersicht überarbeitet; [Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) mit echten Aufnahmen eines künstlichen Projekts ergänzt. Servereinrichtung und Installation bleiben außerhalb der Anwenderanleitung.

## Arbeitsstand 06.11.2026 – lokal aktiviert, kein neuer Release-Tag

Paketversion bleibt `0.1.0-beta.1`. Diese Hinweise beschreiben den aktuellen Arbeitsstand; Veröffentlichung und CI-Status sind am konkreten GitHub-Commit zu prüfen.

- **SQLite-Stufe 1:** neun vollständige Projektdatensätze in SQLite, gemeinsame Speichertransaktionen, Erhalt individueller Daten und alter JSON-Ausgangskopien. Projektversionen erkennen veraltete Seiten und parallele Änderungen mit HTTP 409.
- **SQLite-Stufe 2:** eigene Tabellen für Gerätelisten und Positionen. SQLite-Trigger synchronisieren die zusätzliche Projektion in derselben Transaktion. Der vollständige Datensatz bleibt führend; bestehende Konten, Passwörter und Projektinhalte werden bei der Übernahme nicht umgeschrieben.
- **Installation und Rückweg:** kein zusätzlicher Datenbankserver. Neuinstallationen nutzen beide Stufen, vorhandene Installationen aktivieren sie ausdrücklich nach Vollsicherung und Kopientests. Projektpakete enthalten aktuelle SQLite-Inhalte; Rückweg zu JSON ausschließlich in einer neuen Wiederherstellungskopie.
- **Benutzerverwaltung:** einheitliche Prüfung neuer Passwörter, Selbstregistrierung standardmäßig geschlossen, klare Rollen, korrekte Kontofehler und Schutz des letzten aktiven Systemadmins. Dialogbedienung und Tastaturführung verbessert.
- **Gestaltung und Fotowarnungen:** ruhige technische Oberfläche in Hell/Dunkel; eigene Themes bleiben erhalten. Fehlende aktive Brandschutzfotos werden in Oberfläche und Export sichtbar und verhindern einen vollständigen Exportstatus.
- **Prüfstand:** 103 automatische Prüfungen erfolgreich. Zusätzlich acht bestehende Projektkopien vor/nach Geräteumstellung verglichen: gleiche Kapitel und Exportpositionen, 249 tatsächliche PDF-Seiten, ZIPs und Rückimporte geprüft. Fachliche Abnahme und physische Druckprüfung bleiben offen.
- **Lokale Aktivierung:** nach ausdrücklicher Freigabe exakt das geprüfte Abbild übernommen, unveränderte bisherige Daten/Dateien, Lesbarkeit, Datenbankintegrität und Erreichbarkeit nachgewiesen. Vollsicherungen vor und nach Aktivierung geprüft. Private Originaldaten und Nachweise bleiben lokal.

Anleitungen: [Dokumentationsübersicht](README.md), [SQLite](SQLITE_PROJEKTDATEN.md), [Update](UPDATE.md), [Tests](TESTS.md), [offene Punkte](OFFENE_PUNKTE.md).

Die folgenden datierten Abschnitte beschreiben frühere Entwicklungsstände. Dort genannte Testzahlen und damalige Einschränkungen sind keine aktuelle Gesamtaussage.

## Lokaler Beta-Betrieb – 30.10.2026

- Sicherheitsprotokoll für kritische Verwaltungsaktionen mit Versuchs-/Ergebnisdatensätzen, Hash-Verkettung und Systemadmin-Ansicht; keine Formularinhalte oder Zugangsdaten.
- Vollsicherung aller fünf Laufzeitordner einschließlich SQLite, Einstellungen, Medien, Ausgaben und historischem Bestand; Docker-Abbild inklusive. Wiederherstellung ausschließlich in einen neuen Ordner und mit Prüfsummenprüfung.
- Formular-Sicherheitstoken werden nach der Prüfung entfernt, bevor allgemeine Projektformulare gespeichert werden. Bestehende Dateien werden nicht migriert.
- Reproduzierbares Node-22-Abbild mit `npm ci`; GitHub-Prüfung und 52 automatische Tests einschließlich vollständigem PDF-/ZIP-/Archiv-Ablauf.
- Betriebsanleitung: [BETA_BETRIEB.md](BETA_BETRIEB.md).

## Entwicklungsstand 2026-10-30 (noch kein neuer Release-Tag)

### Sicherheits- und Archivnachtrag

- Stabile Ausgabeablagen je Benutzer/Projekt und begrenzte Dateifreigaben einschließlich Symlink-Prüfung und Erkennung tatsächlicher Vorschautypen.
- CSRF-Schutz, Login-/Registrierungsbegrenzung und Systemadmin-Grenzen für globale Änderungen.
- Zuverlässige JSON-Speicherfehler sowie Erhalt vorheriger PDFs und fertiger Exporte bei Abbrüchen.
- Geprüfte Projekt-ZIPs mit tatsächlichen Anhängen, Prüfsummen und Rückimport unter neuer Kennung; fehlende Quellen werden sichtbar dokumentiert.
- Gemeinsame Alt-Ausgaben bleiben auf Benutzerwunsch separat historisch erhalten. Originale Exportindizes bleiben passiv erhalten und erteilen nach einem Import keine alten Dateirechte.
- 38 automatisierte Prüfungen erfolgreich, zusätzlich Export/Rückimport aller acht nicht gelöschten Projekte ausschließlich in einer Datenkopie ohne Änderung der ursprünglichen Projektdateien.
- Details: [Zugriffsschutz](SICHERHEIT.md), [Projektarchive](PROJEKTARCHIVE.md).

### Oberfläche und Wartbarkeit

- Ruhige technische Gestaltung für Navigation, Tabellen, Formulare und Projektübersicht.
- Gemeinsame EJS-Bausteine für Seitenkopf, Kennzahlen und Anmeldung; CSS in sechs Fachdateien aufgeteilt.
- Dokument mit Prüfhaken als App-Icon, vereinfachtes Favicon, Safari-Maske und PNG-Varianten für Startbildschirme.
- Sichtbarer Tastaturfokus, Sprunglink zum Inhalt und reduzierte Bewegung berücksichtigt.

### Kapitel und Exporte

- Ein Kapitelplan verbindet Matrix, Gerätelisten, Anhänge, Dateinamen, Vorschau und finale Ausgabe.
- Doppelte Originalkapitel, ergänzte Elternkapitel und zusätzliche Listen erzeugen eindeutige Ausgabenummern.
- PDF-Dateien, Gliederungsüberschriften und tatsächliche Seiten werden getrennt gezählt; Sammel-PDF und Druckhilfen zählen nicht doppelt.
- Gesamt-PDF mit tatsächlichen Startseiten und klickbarem, auch mehrseitigem Inhaltsverzeichnis.
- Generierte PDFs tragen Dokumentkennungen; veraltete oder nicht zuordenbare Dateien werden erkennbar.
- Fortlaufende finale Dateinummern und ZIP-Ordner mit den passenden Kapiteltiteln.
- Automatische Ordneranzahl aus vorhandenen PDF-Seiten und einstellbarer Kapazität statt aus der Dateianzahl.

### Datenerhalt und Prüfungen

- Neustarts überschreiben keine bestehenden Konten, Passwörter, Rollen oder Sperren.
- Keine erneute Altdatenmigration bei vorhandener Datenbank; reine Seitenaufrufe aktualisieren keine vorhandenen Projektzeitstempel und speichern keine Systemauswahl.
- 18 Exportprüfungen und drei Datenerhalt-Prüfungen erfolgreich im eingesetzten Node-20-Abbild.
- Lokale Hauptanwendung nach Sicherung aktualisiert; Vorher/Nachher-Vergleich von Dateien, Datenbankschema und Tabelleninhalten ohne Inhaltsänderung. Angemeldete Seiten zusätzlich in einer Kopie tatsächlicher Daten geprüft.
- [Tests](TESTS.md), [Update-Anleitung](UPDATE.md) und [offene Punkte](OFFENE_PUNKTE.md) dokumentieren Umfang und Grenzen.

Vorhandene PDFs bleiben beim Update erhalten. Ein neu gestarteter Export
verwendet die neue Struktur. Die fachliche und visuelle Abnahme mit echten
Projekten, physische Ausdrucke sowie Sicherheits- und Archivhärtung bleiben
offen. Der Versionswert bleibt `0.1.0-beta.1`; dieser Stand erhält durch den
GitHub-Push allein keinen neuen Release-Tag.

## 0.1.0-beta.1 - 2026-06-07

Erste öffentliche Beta-Vorbereitung für `edoku`.

### Enthalten

- Login und lokale Benutzerverwaltung mit SQLite
- projektbezogene JSON-Datenhaltung
- Projektverwaltung mit aktuellem Arbeitsprojekt
- Dashboard mit Fortschritts- und Statusdaten
- Leistungsbereiche mit Formularvorgaben
- Dokumentenmatrix und logische Kapitelnummerierung
- Gerätelisten und Brandschutzlisten mit sortierbaren Tabellen
- Anhangsverwaltung für Pläne, Messprotokolle, Nachweise und Bilder
- PDF-Erzeugung für Inhaltsverzeichnis, Anlagenbeschreibung, Formulare, Listen und Brandschutzseiten
- Theme-Editor mit Presets und globalen CSS-Variablen
- Docker-Start über `docker compose up --build`

### Geändert

- Projektname und Branding auf `edoku` bereinigt
- Default-Demozugang auf ein lokales Admin-Konto umgestellt; konkrete lokale Defaults stehen in `INSTALL.md`
- Anhänge werden nach Kategorie und Stockwerk für Inhaltsverzeichnis und Export sortiert
- UI-Schalter für Aktiv-/Export-Optionen vereinheitlicht
- interne Tagesupdates und lokale Arbeitsnotizen bleiben per `.gitignore` außerhalb des Repositories
- Finaler Export erzeugt jetzt zusätzlich eine Gesamt-PDF und ein ZIP mit flacher Kapitelstruktur
- PDF-Zuordnung in der Exportliste nutzt logische Kapitelnummern und Titelabgleich, damit gleich nummerierte Dokumente nicht verwechselt werden
- Separate Trennstreifen können für Unterkategorien erzeugt werden
- Trennstreifen wurden auf tintensparenden Schwarz-Weiß-Druck ohne GitHub-Branding umgestellt
- Statusmeldungen erscheinen als schwebende Toasts und verschieben die Oberfläche nicht mehr

### Nachtrag 2026-06-08

- Zusätzliche lokale Testbenutzer ergänzt; konkrete lokale Defaults stehen in `INSTALL.md`
- Theme-Presets verwenden gemeinsame Radius-, Spacing- und Typografiewerte, damit beim Themewechsel keine Layoutsprünge entstehen
- GitHub-/VS-Code-orientierte Presets konsolidiert: GitHub Light und GitHub Dark
- Aktive Buttons, Tabs und Badges nutzen Theme-Kontrastvariablen statt festem Weiß
- Einzelne Preset-Farbwerte für bessere Lesbarkeit nachgeschärft

### Nachtrag 2026-06-09

- Rollenmodell ergänzt: `viewer`, `user`, `admin`, `systemadmin`
- Systemadmin-Benutzerverwaltung in den Einstellungen ergänzt
- Viewer-Schreibzugriffe werden serverseitig blockiert
- Benutzerkonten können gesperrt und wieder aktiviert werden
- Passwort-Reset durch Systemadmins beendet vorhandene Sessions des betroffenen Kontos
- Projektmanager links erweitert: aktive Projekte, Archiv und Import/Pakete sind dort gebündelt
- Projektübersicht zeigt nur noch das aktuell geöffnete Projekt mit Mini-Status
- Leistungsbereiche fragen beim Abwählen eine Bestätigung ab
- Login-Maske und Auth-Meldungen optisch zentriert
- Installationshinweise und lokale Demo-Defaults nach `INSTALL.md` ausgelagert

### Nachtrag 2026-06-12

- Hauptnavigation und Header weiter bereinigt; links oben steht jetzt nur noch das aktuelle Projekt.
- Menüpunkt `Dokumentation` wurde zu `Anhänge`; die Dokumentenmatrix liegt jetzt im Exportbereich.
- Matrix-Tabellen sind horizontal scrollbar, ohne Zeilenumbrüche und mit lokal speicherbaren Spaltenbreiten.
- Matrix-Auswahl fokussiert auf Erzeugen/Exportieren vorhandener Dokumente.
- Anhangsverwaltung auf kategoriebezogene Kachelansicht umgestellt.
- Upload erfolgt direkt in der gewählten Kategorie; Mehrfachupload ist vorbereitet.
- Anhangsdetails werden in einem Popup bearbeitet, das nur über `Abbrechen` verlassen wird.
- Bildanhänge zeigen eine kleine Vorschau im Popup; PDF-Anhänge erhalten einen eigenen Vorschau-Button.
- Aktionen im Anhangs-Popup wurden unten gebündelt: Download, Vorschau, Löschen, Abbrechen, Speichern.
- Brandschutz-Fotozuordnung wird beim Speichern des Anhangs übernommen; der separate Zuordnen-Button entfällt.
- Kategorie `Bedienungsanleitungen` ergänzt.
- Gerätelisten können optional Bedienungsanleitungen je Geräteposition verknüpfen; Brandschutzlisten sind ausgenommen.
- PDF-/Exportlogik referenziert verknüpfte Bedienungsanleitungen mit Kapitelbezug.
- Exportunterbereiche weiter geordnet: PDF-Dokumentation, PDF-Trennstreifen, ZIP-Export, Matrix und Exporteinstellungen.
- Systembereich zeigt jetzt App-Version, lokale Release Notes und eine sichere GitHub-Update-Prüfung ohne automatische Installation.
- Updates sind als eigener System-Unterpunkt erreichbar.
- Systemzugang wurde aus der mittleren Hauptnavigation entfernt und ganz rechts als Icon platziert.
- Benutzername und Abmeldung sind in ein kompaktes Benutzer-Icon-Menü gewandert.
- Alte Systemauswahl-Verweise wurden aus Startseite, Dashboard-Workflow und sichtbarer Exportliste entfernt.

### Nachtrag 2026-06-13

- Footer-Branding von GitHub auf ein neutrales Labor-Icon mit Link zu `https://nickgm.de` umgestellt.
- PDF-Footer verwenden das neue Branding; Trennstreifen bleiben ohne Footer-Branding.
- Systemadmins können das UI- und PDF-Branding als Vollversions-/Lizenzoption deaktivieren.
- Brandschutz-Hauptnavigation wird nur angezeigt, wenn der passende Leistungsbereich aktiv ist.
- Anhangsdateien werden bei Titeländerung logisch umbenannt und Download/Vorschau nutzen den neuen Dateinamen.
- Anhangskacheln zeigen das Dateiformat als Badge.
- Brandschutz-Fotozuordnung ersetzt vorhandene Foto-1-/Foto-2-Slots eindeutig.
- Anhangs-Popup wurde größer und mit dauerhaft sichtbarer Aktionsleiste verbessert.
- Benutzerverwaltung wurde kompakter gestaltet und nutzt Bearbeiten-Popups für Rolle, Passwort und Status.

### Nachtrag 2026-06-14

- Gerätelisten lassen sich als systemweite Vorlagen speichern.
- Gespeicherte Gerätelisten-Vorlagen können unter `System > Gerätelisten` verwaltet werden.
- Passende Vorlagen können über das Drei-Punkte-Menü einer Geräteliste geladen werden.
- Export-Unterbereich `Ordnerrücken` ergänzt.
- Ordnerrücken können als separate PDF für Avery-Zweckform-Formate `61x192-R` und `38x192-R` generiert werden.
- Ordnerrücken-Optionen werden gespeichert und nach dem Generieren wieder angezeigt.
- Die spätere Umsetzung klickbarer Inhaltsverzeichnis-Einträge ist für die finale Gesamt-PDF vorgemerkt.

### Nachtrag 2026-06-15

- Ordnerrücken nutzen jetzt die A4-Anordnung der Avery-Kalibrierungsbögen.
- `61x192-R` erzeugt 4 Rücken je A4-Seite, `38x192-R` erzeugt 7 Rücken je A4-Seite.
- Der Ordnerrücken-Text wird gedreht und zentriert angeordnet.
- Projektkenndaten werden kompakt auf dem Rücken ausgegeben und bleiben über Optionen steuerbar.
- Ordnerrücken bleiben ohne Footer-Branding.
- Neue zentrale Arbeitsliste `docs/OFFENE_PUNKTE.md` ergänzt und in der README verlinkt.
- Anhangszuordnung für Brandschutzbilder zeigt nur noch freie Foto-Slots an.
- Belegte Brandschutz-Foto-Slots werden zusätzlich serverseitig geschützt.
- Zentrale Button-Styles wurden beruhigt, damit Light/Dark-Mode weniger metallisch wirkt.
- PDF-Exportaktionen wurden kompakter gestaltet und der PDF-Inhaltsbaum nutzt mehr Bildschirmhöhe.
- Theme-Presets um GitHub Light/Dark Default, High Contrast, Colorblind und Dark Dimmed erweitert.
- Theme-Editor auf die wichtigsten Stellschrauben reduziert, damit die Einstellungen übersichtlicher bleiben.

### Nachtrag 2026-07-25

- API-/Backend-Grundgerüst in den Hauptstand übernommen und dokumentiert.
- API-Fehlerantworten und 404-Verhalten vereinheitlicht.
- Session-Cookie-Erkennung für lokalen Betrieb und Reverse Proxy gehärtet.
- Kapitelnummerierung im Export korrigiert, damit doppelte Original-Kapitelnummern keine doppelten Anzeige-Kapitel mehr erzeugen.
- Importierte PDF-Anhänge erzwingen ihre Elternkapitel im Inhaltsverzeichnisbaum.
- `CHANGELOG.md`, `docs/AKTUELLER_STAND.md` und `docs/REPO_SICHERHEITSCHECK.md` ergänzt.

### Bekannte Grenzen

- Noch keine produktive Server-Härtung
- Rollen- und Rechteverwaltung ist Beta und muss vor produktiver Nutzung weiter geprüft werden
- Zum damaligen Stand noch keine automatisierte Test-Suite; heute 109 Prüfungen, siehe [Tests](TESTS.md).
- Gesamt-PDF, ZIP-Export und Trennstreifen müssen im Praxiseinsatz weiter visuell geprüft werden
- Zum damaligen Stand grobe Ordnerrücken-Schätzung; inzwischen seitenbasierte Ablageschätzung umgesetzt, physische Kapazitätsprüfung bleibt offen.
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden
