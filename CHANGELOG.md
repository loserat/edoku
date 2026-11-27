# Changelog

## Noch nicht veröffentlicht

- Export- und Einstellungsuntermenüs kompakter: 40 Pixel Höhe am Desktop, kleinere Abstände und Einstellungsicons. Zentrierung und normale Schrift bleiben erhalten; auf schmalen Bildschirmen 44 Pixel hohe, seitlich scrollbare Leisten.

## 0.3.2 – 27.11.2026

Kleiner Versions- und Dokumentationsstand für die bestehende Update-Erkennung. Funktionsumfang, Abhängigkeiten, Datenbankschema und API/MCP **3.15.0** mit **58 Werkzeugen** sind gegenüber 0.3.1 unverändert.

Unter **Einstellungen → Updates → Updates prüfen** vergleicht edoku die installierte Version mit dem neuesten stabilen GitHub-Release. Eine lokale 0.3.1 soll den veröffentlichten Release v0.3.2 als neuere Version melden. Ein main-Push allein reicht dafür nicht; die Prüfung lädt und installiert keine Software. Bestehende Daten und Freigaben bleiben erhalten, Dateien weiterhin manuell einzeln freigeben. Eine spätere Installation erfolgt gesondert nach Sicherung und Wiederherstellungsprobe.

## 0.3.1 – 27.11.2026

Export und Einstellungen erhalten eine flache, mittig ausgerichtete Untermenüleiste direkt unter der Hauptnavigation, mit normaler Schriftstärke und seitlich erreichbaren Reitern auf kleinen Bildschirmen. Die Einstellungen verwenden dieselbe Navigation auch im Sicherheitsprotokoll; Rollen und Direktlinks bleiben erhalten. Dezente Icon-Bewegungen respektieren reduzierte Bewegung. Unter Anhänge → Messprotokolle führt ein optionaler Link zu MessPilot, ohne automatische Datenübertragung.

Diese Version bündelt die Verbesserungen der vorbereiteten 0.3.0-beta.9 und beta.10:

- **Automatische Brandschutzpflichten:** edoku leitet herstellerunabhängig passende Unterlagenaufgaben ab; Abschottung, bestätigter Brandschutzkanal und bestätigter elektrischer Funktionserhalt bleiben getrennt.
- **Konkrete nächste Schritte:** fehlende Fakten haben eindeutige Ziele, bekannte Belege werden zuerst genutzt, verbleibende Rückfragen gebündelt. Technische Prüfsperren werden von fehlenden Angaben und Passungskonflikten unterschieden.
- **OBO-PLM-Maßprüfung:** artikelgebundene Millimetertabellen ergänzen den Stammdatenwert. Hersteller-/Artikelbindung, Achsen, Einheiten und widerspruchsfreie Werte bleiben prüfpflichtig.
- **Originalquellen wiederverwenden:** nach passenden Prüfreparaturen das vorhandene Datenblatt erneut prüfen, statt dieselbe Suche zu wiederholen.
- **Datenerhalt und manuelle Einzelprüfung:** keine automatische Dateiübernahme, Unterschrift oder Einbaubestätigung; gespeicherte Originale, Anforderungen und Entscheidungen bleiben erhalten.

Software **0.3.1**, API/MCP unverändert **3.15.0**, Aufgabenvertrag **2.5**, Produktprüfung **manufacturer_pdf_article_variant_v10**, Brandschutzregel **firestop_documents_v2**. Weiterhin **69 HTTP-Operationen / 58 MCP-Werkzeuge** (22 Lesen / 36 Schreiben). Die Versionsanhebung ändert keine Programmlogik oder Abhängigkeiten. Gegenüber beta.8/beta.9/beta.10 keine neue Datenmigration; bei älteren Installationen die weiterhin erforderlichen Schritte der Update-Anleitung beachten.

Der funktional identische beta.10-Stand wurde mit 365 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen geprüft, einschließlich des unveränderten OBO-Original-PDFs. Für 0.3.1 sind Paket-/Lock-Konsistenz, unveränderte Fachlogik/Abhängigkeiten, Syntax (190 JS/48 EJS), aktueller Vertrag und acht gezielte Vertrags-/Start-/Betriebsprüfungen nachgewiesen; historische Nachweise werden nicht auf 0.3.1 umetikettiert. Softwaretests ersetzen keine fachliche Anlagenabnahme und keine manuelle Dateiprüfung. Lokale Aktivierung, GitHub-Veröffentlichung und Online-Deployment bleiben gesonderte Schritte.

## 0.3.0-beta.10 – 27.11.2026

Die OBO-PLM-Maßprüfung verbindet den einheitenlosen Stammdatenwert mit der expliziten Millimetertabelle desselben Artikels. Herstellerverknüpfung, Modell, Artikelnummer, Maßachsen und sämtliche Werte bleiben prüfpflichtig. Fremde oder widersprüchliche Tabellen, fehlende Einheiten und abweichende Maße werden weiterhin gesperrt. Nur passende ältere V9-Maßsperren werden gezielt neu geprüft.

edoku benennt fehlende Fakten als konkrete `missingInformation`-Ziele und technische Prüfbefunde als `verification.resolution`. Eine nicht unterstützte Maßtabelle löst keine erneute Benutzerfrage nach bereits belegten Produktmaßen aus. Echte Abweichungen bleiben ein Passungskonflikt. Keine erfundenen Einbaudaten für Testpositionen.

App **0.3.0-beta.10**, API/MCP **3.15.0**, Aufgabenvertrag **2.5**, Produktprüfung **manufacturer_pdf_article_variant_v10**. Weiterhin **69 HTTP-Operationen / 58 MCP-Werkzeuge**. Bestehende Daten, Originale und Freigaben bleiben erhalten; Dateien weiterhin nur manuell einzeln freigeben. Keine Datenmigration, lokale Aktivierung und Veröffentlichung getrennt behandeln.

## 0.3.0-beta.9 – 27.11.2026

Brandschutzpflichten werden herstellerunabhängig automatisch im Auftrag berechnet. Abschottung, bestätigter Brandschutzkanal und bestätigter elektrischer Funktionserhalt erhalten passende, getrennte Unterlagenaufgaben. Der zusätzliche manuelle Anforderungsschritt im MCP entfällt. Systemfragen und Einbauvoraussetzungen bleiben gezielt; unabhängige Datenblattarbeit läuft weiter.

Abrufe bleiben schreibfrei; ausdrückliche Änderungen halten berechnete Kennungen atomar fest. Bestehende Anforderungen, Originale und Freigaben bleiben erhalten. Veraltete Systempflichten werden nicht mehr als aktuell gefordert. Widersprüchliche Kennungen und Anforderungslimits führen zum Konflikt statt zu Teiländerungen. Vorlagen/Entwürfe erfüllen keine Pflicht; neue Dateien weiterhin nur manuell einzeln freigeben.

App **0.3.0-beta.9**, API/MCP **3.14.0**, Aufgabenvertrag **2.4**, Brandschutzregel **firestop_documents_v2**. Weiterhin **69 HTTP-Operationen / 58 MCP-Werkzeuge**. Keine Datenbankmigration. Quellstand und Tests sind von lokaler Aktivierung und Veröffentlichung getrennt.

## 0.3.0-beta.8 – 27.11.2026

Die Hersteller-PDF-Prüfung V9 erkennt das technische ZZ330-Datenblatt über die eindeutige Kombination aus Handelsname, Produktüberschrift und Dokumentart. Die Regel gilt ausschließlich für ZAPP-ZIMMERMANN / ZZ330 ohne zusätzliche Variantenangabe und benötigt weiterhin die bestätigte Produktseite, den dort verlinkten Originaldownload und den Hersteller im PDF. Ähnliche Nummern, widersprüchliche Handelsnamen und Sicherheitsdatenblätter werden darüber nicht akzeptiert. Keine Systemzuordnung oder Freigabe daraus ableiten.

Nur der passende ältere V8-Prüfbefund für ZZ330 wird gezielt wieder bearbeitbar. Neue V9-Sperren, andere Produkte und Quellen-/Variantenfehler bleiben ohne neue Belege gesperrt. API/MCP unverändert **3.13.0**, **69 Operationen / 58 Werkzeuge**. Keine Datenmigration; Dateien weiterhin manuell einzeln prüfen und freigeben. Quellstand, Testvorschlag und lokale Aktivierung getrennt behandeln.

## 0.3.0-beta.7 – 27.11.2026

Einzelne tatsächliche Schotts lassen sich über API/MCP mit Benutzerbeleg anlegen, gezielt lesen und ergänzen. Starke Projektversion, erforderlicher Wiederholungsschlüssel bei Anlage und atomarer Änderungsbeleg schützen den Bestand. Technische Kennung ist keine erfundene Kennzeichnung am Bau. Fotos, unbekannte Bestandsfelder und nicht bearbeitete Einbaudaten bleiben erhalten; keine Lösch- oder Freigabefunktion.

Öffnungsmaße, Bauteildicke, Schotttiefe, Komponenten und Feuerwiderstandsminuten werden strukturiert erfasst; unbekannte Werte bleiben offen. Faktensteuerung nutzt bestätigte Schottangaben und den Einbauort, GUI-Speichern erhält zusätzliche API-Felder. Keine automatische Übertragung alter Chatdaten oder Erfindung physischer Schotts aus Gerätezeilen.

API/MCP **3.13.0**, **69 HTTP-Operationen / 58 Werkzeuge** (22 Lesen / 36 Schreiben). Keine neue Datenbankmigration durch diese Erfassung; der ausdrücklich auszuführende Vorschlagsspeicher-Upgrade aus beta.6 bleibt bei einem Update von beta.5 erforderlich. Dateien weiterhin ausschließlich manuell einzeln freigeben. Quellstand, Tests, lokale Aktivierung und Veröffentlichung getrennt behandeln.

## 0.3.0-beta.6 – 27.11.2026

Herstellerprüfung V8 erkennt veröffentlichte Links ohne Anführungszeichen und den beobachteten, gleichursprünglichen Striebel-&-John-PDF.js-Download. Rittal-Katalogschreibweisen werden gezielt an dieselbe Artikelnummer gebunden. Produktseiten werden vor der bestehenden Größenprüfung auf relevante Struktur, Texte und Links reduziert; Transfer-, PDF-, Adress- und Antwortgrenzen bleiben unverändert. BEGA, Sikora und die deutsche Siteco-Quelle ergänzt. Technische Link-, HTTP- und Vorschlagsfehler erzeugen keine falschen Variantenrückfragen.

Zurückgezogene Originale bleiben unverändert. Ein abweichender gültiger Gerätebezug kann mit aktueller Auftragsversion einen getrennten neuen Dateivorschlag erzeugen, der erneut vollständig manuell zu prüfen ist. Dafür den Vorschlagsspeicher ausschließlich nach Sicherung und Wiederherstellungsprobe ausdrücklich aktualisieren; keine automatische Tabellenmigration beim Start. Manuelle Kategorie **Verbrauchsmaterial (nicht dokumentieren)** nimmt nur ausdrücklich markierte Positionen aus Recherche und erzeugten Listen, ohne Bestand oder Freigaben zu löschen; keine pauschale Sicherungsausschlussregel.

API/MCP **3.12.0**, unverändert **66 HTTP-Operationen / 56 Werkzeuge**. Gezielte Wiederaufnahme konkret behobener V7-Sperren; neue V8-Sperren bleiben ohne neue Erkenntnisse geschlossen. Lokale Aktivierung und Veröffentlichung getrennt prüfen.

## 0.3.0-beta.5 – 27.11.2026

Die bisherige Gerätelisten-Übersicht „Dashboard“ heißt **Summenansicht**. Ihr Zähler in der Seitenauswahl addiert die Gerätepositionen der angezeigten Listen.

Die Kopfzeile reserviert den Scrollleistenplatz auf kurzen und langen Bildschirmseiten gleichmäßig. Moderne Browser gleichen beide Ränder aus; ältere Browser erhalten einen dauerhaften rechten Scrollbereich. Breite Seiten orientieren sich an der verfügbaren Breite, damit kein horizontaler Überlauf entsteht.

Im Werkzeugmenü der Gerätelisten lässt sich die optionale LV-Position ausschließlich in der Bildschirmtabelle ausblenden. Die Auswahl bleibt pro Konto, Projekt und Liste in diesem Browser erhalten; gespeicherte LV-Werte und die erzeugten PDF-Gerätelisten ändern sich dadurch nicht. Umschalten löst kein Auto-Save aus und ist auch für Lesekonten möglich.

Das Menü öffnet per Klick oder Tastatur, schließt mit Escape oder Klick außerhalb und passt auch in schmale Ansichten. Nicht verfügbare Export-/Vorlagenschaltflächen entfallen. API/MCP unverändert **3.11.0**, **66 HTTP-Operationen / 56 Werkzeuge**. Keine Datenmigration oder Änderung der manuellen Einzelprüfung. Quellstand und lokale Aktivierung getrennt prüfen.

## 0.3.0-beta.4 – 26.11.2026

Belegte Materialausnahmen können gezielt als nicht verwendet, vom Dokumentationsumfang ausgenommen oder reiner Materialnachweis abgeschlossen werden. Gespeicherte Benutzerantwort, genaues Zeilenziel, Rechte und Versionen werden geprüft; Nachreichungen bleiben offen. Wiederaufnahme benötigt einen neuen Beleg, frühere Entscheidungen bleiben protokolliert. Bestehende aktive Geräte werden dadurch nicht umgangen.

Die Reparaturvorschau unterscheidet eindeutige Umverknüpfung und Entfernung alter Doppelbezüge neben einem bestätigten aktuellen Anker. Mehrere reale Geräteinstanzen bleiben gesperrt; Originaldatei, Freigabe und vollständiger Vorher-/Nachher-Beleg bleiben erhalten. API/MCP **3.11.0**, unverändert **66 HTTP-Operationen / 56 Werkzeuge**, Agentenvertrag 2.3. Keine automatische Bestandsbereinigung, Migration oder Dateifreigabe. Quellstand, lokale Aktivierung und Veröffentlichung getrennt prüfen.

## 0.3.0-beta.3 – 26.11.2026

Stabile Gerätekennungen beim GUI-Speichern, Sortieren und Entfernen; monotone Nummernreserve verhindert versehentliche Wiederverwendung. Herstelleroriginale behalten ihre manuellen Freigaben. Gezielte Reparatur veralteter Gerätebezüge mit Vorschau, Versionsschutz, Hashprüfung und Protokoll; mehrdeutige Instanzen bleiben offen.

API/MCP **3.10.0**, **66 HTTP-Operationen / 56 Werkzeuge** (22 Lesen / 34 Schreiben), Agentenvertrag 2.2. Blocker nennen Ursache, Zuständigkeit und Wiederaufnahmebedingung. Schreibantworten können kompakte Folgeaufgaben liefern; gezielte Artikel-/Positionsfilter und kürzere gemeinsame MCP-Anweisungen reduzieren Kontextabrufe. Keine automatische Dateifreigabe oder Datenmigration beim Start. Quellstand und lokale Aktivierung getrennt prüfen. [Ablauf und Schutzregeln](docs/API_MCP.md).

## Dokumentation – 25.11.2026

Öffentliche Dokumentation auf Produktanleitungen begrenzt und API-/MCP-Hilfe gebündelt. Persönliche Agentenregeln, Tagesberichte, interne Planungen und konkrete Betriebs-/Fehlerberichte werden nicht mehr mit veröffentlicht. Verweise und generierte Referenz korrigiert; Git-/Docker-Freigabelisten verhindern unbeabsichtigte neue interne Dokumente. Keine Programm-, Versions- oder Datenänderung.

## 0.3.0-beta.2 – 25.11.2026

Einstellungen → System zeigt Software-, MCP- und API-Version kompakt an. Die Softwareversion stammt aus dem installierten Paket; gemeinsame Schnittstellenkonstanten werden von Anzeige, OpenAPI und tatsächlichem MCP-Handshake verwendet. Keine editierbaren Versionsfelder oder zusätzliche Updateabfrage. API/MCP bleiben 3.9.0 mit 64 Operationen/55 Werkzeugen. Bestehende Daten und Freigaben erhalten, Dateien weiterhin ausschließlich manuell einzeln freigeben.

Die Anzeige wurde mit 39 gezielten Integrations-/Vertrags-/Theme-/Startprüfungen und auf Desktop sowie Mobil bis 320 Pixel geprüft. Lokale Aktivierung, GitHub-Prüfung und Online-Deployment bleiben getrennte Nachweise. [Versionsanzeige](docs/SYSTEMVERSIONEN.md).

## 0.3.0-beta.1 – 25.11.2026

Gebündelter Ausbau für die nächste öffentliche Beta: integrierte HTTP-API und lokaler MCP-Adapter mit 55 Werkzeugen (22 Lesen/33 Schreiben), zentral berechnete Agentenaufgaben, Materialimport und Artikelzuordnung, Hersteller-PDF-/Variantenprüfung, dauerhafte Fakten und gebündelte Rückfragen. Vereinfachter Doku-Assistent, direkte Einzelprüfung und nächster Dateiwechsel, begründetes Zurückziehen sowie geschützte Lösch-/Wiederherstellungsfunktionen.

API/MCP bleiben **3.9.0**; der App-Versionssprung bündelt die neuen Funktionen und ändert weder Rechte noch Datenbankschema. Alle neuen Dateien weiterhin ausschließlich manuell einzeln in der GUI freigeben. README um klaren MCP-Einstieg erweitert. Private Daten, Schlüssel und lokale Einstellungen gehören nicht zur Veröffentlichung. GitHub-Stand, lokale Installation und tatsächliches Online-Deployment werden getrennt nachgewiesen.

## 0.2.0-beta.13 – 25.11.2026

Kompakte Projektkopfzeile, Zähler direkt in der Navigation und einfache Arbeitsliste ohne wiederholte Projektspalte. Materialregeln, MCP-Verbindung und Brandschutzhinweise bei Bedarf aufklappen. Vorschauhilfe an den bestehenden isolierten Testprüfer angepasst; echte Herstellerprüfung unverändert. 43 gezielte Funktionstests und 46 Browserprüfungen bestanden. Am 25.11.2026 als App 0.2.0-beta.13 nach geprüfter Vor-/Nachsicherung und getrennter Wiederherstellungs-/Startprobe lokal aktiviert. 2.000 geschützte Dateien/16 Tabellen unverändert, API/MCP unverändert 3.9.0. Keine Veröffentlichung. [Umfang und Prüfgrenzen](docs/DOKU_ASSISTENT.md).

## 0.2.0-beta.12 – 24.11.2026

Nach PDF-Freigabe, Ablehnung oder Zurückziehen folgt der nächste offene Vorschlag hinter der aktuellen Datei. Gemeinsame sichtbare Reihenfolge, kein automatischer Umlauf zum Anfang; am Ende Hinweis auf früher übersprungene Dateien. JSON-Wechsel und Formularweg ohne JavaScript erhalten, jede Datei weiterhin einzeln manuell freigeben. Enthält beta.11-Rückziehfunktion; API/MCP unverändert 3.9.0 (64 Operationen/55 Werkzeuge). [Ablauf](docs/DOKU_ASSISTENT.md). Am 24.11.2026 nach ausdrücklicher Freigabe und geprüfter Sicherung/Wiederherstellung lokal aktiviert. Bestand und Dateientscheidungen unverändert; keine Veröffentlichung.

## 0.2.0-beta.11 – 24.11.2026

API/MCP 3.9.0: bis zu zehn offene Dateivorschläge mit Begründung und Beleg atomar zurückziehen. Eigener Status, Originale/Verlauf erhalten, GUI mit direktem Wechsel zur nächsten Datei; zurückgezogene Vorschläge entsperren die gezielte Gerätelöschung, andere fachliche Bezüge bleiben geschützt. 64 Operationen/55 Werkzeuge, keine Datenbankschema-Migration oder Dateifreigabe über MCP. [Ablauf und Grenzen](docs/DOKU_ASSISTENT.md). Als Einzelversion nicht separat aktiviert; seit beta.12 enthalten.

## 0.2.0-beta.10 – 24.11.2026

API/MCP 3.8.2, Produktprüfung V7: belegte Hersteller-/Markenzuordnungen ergänzen, veröffentlichte PDF-Endpunkte ohne Dateiendung erkennen, FRÄNKISCHE-Familienartikel an eigene Typ-/SKU-/GTIN-Zeile binden und beschriftete NIEDAX-/OBO-Varianten exakt prüfen. Reine Katalogmaße sind optional; tatsächliche Ausführungsangaben bleiben notwendig. Konkrete Blocker erzeugen keine zusätzliche allgemeine Reparaturschleife. Bestehende Daten/Freigaben erhalten, neue Dateien nur manuell einzeln freigeben. 63 Operationen/54 Werkzeuge unverändert. [Regeln und Grenzen](docs/PRODUKTPRUEFUNG.md). Am 24.11.2026 nach geprüfter Vollsicherung und getrennter Wiederherstellungsprobe lokal aktiviert. Bestand und Dateientscheidungen unverändert; keine Veröffentlichung.

## 0.2.0-beta.9 – 23.11.2026

API/MCP 3.8.1, PDF-Prüfrichtlinie v6: exakte NIEDAX-RAW-Innen-/Gesamtbreite und bestätigter OBO-Artikelalias mit beschrifteten Längen-/Breitenfeldern. Aktuelle Blocker stellen Zuordnungskonflikte zurück; nur passende neue Prüfmöglichkeiten öffnen alte Blocker. Explizite Muster im Bemerkungsfeld erzeugen keine Recherche-/Gerätefeldfragen. Bestehende Positionen, Quellen und Freigaben erhalten; jede neue Datei weiterhin manuell einzeln prüfen. 63 Operationen/54 Werkzeuge unverändert. [Details](docs/PRODUKTPRUEFUNG.md).

## 0.2.0-beta.8 – 23.11.2026

API/MCP 3.8.0, Agentenvertrag 2.1: zentrale Materialquellerfassung und belegte Gerätezuordnung mit eigener Vollständigkeitsprüfung, unabhängige Aufgaben vor Rückfragen, thematische Fragepakete bis zu drei Fragen und unveränderte Größen-/Freigabegrenzen. 63 Operationen/54 Werkzeuge. Bestehende Daten/Dateientscheidungen bleiben erhalten; keine stille Materialmigration. [Ablauf und Grenzen](docs/API_MCP.md).

## 0.2.0-beta.7 – 23.11.2026

API/MCP 3.7.0: drei projektbezogene Ausschlüsse für Verbindungsklemmen, Kabel/Leitungen und Befestigungsmaterial im Doku-Assistenten. Steuern kompakte Agentenanweisungen, neue Materialübernahme, Artikelrecherche und erzeugte Gerätelisten. Daten, Originalpositionen, Dateien und Freigaben bleiben erhalten; explizite Auswahl mit Verlauf und Versionsschutz. Neue Projekte mit drei aktiven Regeln, alte Kabeldokumentation bleibt bis zur Änderung erhalten. 61 Operationen/52 Werkzeuge unverändert. [Ablauf und Aktivierungsstand](docs/DOKU_ASSISTENT.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.6 – 23.11.2026

API/MCP 3.6.1: normale Neuanlage übernimmt ausschließlich eingegebene Stammdaten und Struktur. Keine Beispielgeräte, Schotts, Systeme, Dokumente oder Projekthinweise. Leistungsbereichsauswahl startet leer, neue Listen ohne Platzhalterposition. Bestehende Projekte, Vorlagen, Importe und Freigaben erhalten. 61 Operationen/52 Werkzeuge, keine neuen Rechte/Argumente. [Ablauf und Aktivierungsstand](docs/DOKU_ASSISTENT.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.5 – 22.11.2026

API/MCP **3.6.0**: ein lesendes Werkzeug für höchstens drei PDF-Kandidaten aus offizieller Produktseite und einer eingebundenen Fragmentstufe, ohne HTML-/PDF-Volltext. Produktprüfung **v5** bestätigt die gezielte NIEDAX-KTUM-Auflagelängenzuordnung und lässt andere Maße/Varianten gesperrt. 61 Operationen/52 Werkzeuge (21 lesend, 31 schreibend). Keine Datenmigration; bestehende Daten und manuelle Einzelprüfung erhalten. [Ablauf und Grenzen](docs/API_MCP.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.4 – 22.11.2026

API/MCP **3.5.0**: kompakte Brandschutz-Recherchehilfe mit Systemarten, Herstellerquellen, Formularreihenfolge und gezielten Faktenchecklisten. Testannahmen bleiben vom tatsächlichen Einbau getrennt. Vorlagen und unvollständige Erklärungsentwürfe erfüllen keine Pflicht, auch nach manueller Übernahme/Umbenennung. GUI zeigt den Status; bestehende Dateien und Freigaben erhalten. 60 HTTP-Operationen/51 MCP-Werkzeuge (20 lesend, 31 schreibend), keine Datenmigration oder neuen Berechtigungsarten. [Ablauf und Grenzen](docs/DOKU_ASSISTENT.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.3 – 22.11.2026

API/MCP **3.4.0**: kompakte Statusübersicht ohne vollständige Listen, kleine Abschnittsseiten und direkte Anforderungs-/Warteziele in den bestehenden Werkzeugen. Filter vor Seitenauswahl, größenabhängige Seiten mit nextOffset, gezielte Originalbelege und unveränderte HTTP-Defaults. 59 HTTP-Operationen/50 Werkzeuge; keine zusätzlichen Rechte oder Datenmigration. Dateien weiterhin ausschließlich manuell einzeln freigeben. [Vertrag und Prüfstand](docs/API_MCP.md).

Die folgenden Abschnitte sind historische Stände.

## 0.2.0-beta.2 – 22.11.2026

Brandschutz-PDF-Verknüpfung und Herstellerprüfung korrigiert; API/MCP **3.3.1**, weiterhin 59 HTTP-Operationen und 50 Werkzeuge. Aktive Materialpositionen, erhaltene GUI-Zuordnung, Kapitelverweise und Datenblattabdeckung zusammengeführt. Offizielle ZAPP-ZIMMERMANN-Quelle und exakter System-/Komponentenabgleich für Montageanleitungen. Datenmodell und Abhängigkeiten unverändert; Dateien ausschließlich einzeln manuell freigeben. [Prüfablauf und Bereitstellung](docs/DOKU_ASSISTENT.md).

Die folgenden Versionen sind historische Stände.

## 0.2.0-beta.1 – 22.11.2026

- App-Version für das neue Funktionspaket erhöht; API/MCP bleiben 3.3.0 mit 59 HTTP-Operationen und 50 Werkzeugen. Abhängigkeiten und Datenmodell unverändert.
- Informationsfragmente mit Originalbelegen, Kontextbindung, Widersprüchen und Korrekturen führen; Aufgaben nach Voraussetzungen und Nutzen gezielter Rückfragen auswählen. Neuer kleiner Wissensleser, keine automatische Primärfeldänderung oder Dateifreigabe. [Fakten und Abhängigkeiten](docs/API_MCP.md).
- Brandschutz fordert eine ausgefüllte Übereinstimmungsbestätigung sowie Montageanleitung und Systemnachweis je verwendetem System; vorhandene Anforderungen und Entscheidungen erhalten. [Pflichtunterlagen](docs/DOKU_ASSISTENT.md).
- Release Notes, Einstieg, Bedienung, API-/MCP-Anleitungen, Versionsschema, offene Punkte und Tagesabschluss abgeglichen. Historische Nachweise behalten ihren damaligen Stand.
- Funktionaler Stand mit 258 Anwendungstests geprüft; endgültige Versionsprüfung, Sicherung und lokale Aktivierung im [aktuellen Stand](docs/TESTS.md). [Releaseumfang und Grenzen](docs/RELEASE_NOTES.md). Keine automatische Veröffentlichung.

## 21.11.2026 – Einheitliches GUI-/PDF-Fußlogo

- PDF-Fußlogo aus derselben Globus-SVG wie die GUI abgeleitet; bisheriges Laborsymbol ersetzt. Transparenz, Website-Link, Branding-Schalter und Kunden-/Erstellerlogos erhalten.
- Quelle und PNG über Prüfsummen aneinander gebunden. 245 Anwendungstests und acht Sicherungstests bestanden; vierseitiger künstlicher Export visuell geprüft. Gesichert lokal aktiviert, bestehende Daten und Dateifreigaben unverändert. [Nachweis und Pflege](docs/TECHNIK.md).

## 21.11.2026 – Mehrere Hersteller und Systeme (API/MCP 3.1.0)

- Mehrere einzeln adressierbare Zuordnungen je Leistungsbereich in API, MCP und kompakter GUI; Deaktivierung mit Erhalt und Wiederaktivierung. Alte Einzelzuordnungen ohne Startmigration erhalten.
- Gemeinsame Prüfung für GUI/API, kein Überschreiben mehrdeutiger Ziele, Bestandsfelder erhalten und Zusammenfassung aller verwendeten Systeme in PDF-/Exportmetadaten. Kleine dreistufige Katalogseiten und kompakte Schreibbelege bei unveränderten Antwortgrenzen.
- 244 Anwendungstests, acht Sicherungstests, sieben Wartungsprüfungen und künstliche Browserprüfung bestanden. Gesichert lokal aktiviert; 1.329 Dateien/16 Tabellen unverändert. Keine neue Dateifreigabe. [Vertrag, Bedienung und Betriebsnachweis](docs/DOKU_ASSISTENT.md).

## 21.11.2026 – Schneller manueller Freigabeablauf

- Einzelentscheidungen ohne vollständiges Neuladen, direkter Wechsel zur nächsten offenen Datei desselben Auftrags und Aktualisierung der Übersicht im Hintergrund.
- Schlanke Einzelansicht ohne projektweite Bereitschaftsprüfung; bisherige PDF-Darstellung beim Wechsel beenden. Folgefreigabe erfordert weiterhin eigene Sichtung und neue manuelle Bestätigung.
- 237 Anwendungstests, acht Sicherungstests, sieben Wartungsprüfungen und künstliche Browserprüfung bestanden. Gesichert lokal aktiviert; Daten und Freigaben unverändert, API/MCP unverändert. [Nachweis](docs/DOKU_ASSISTENT.md).

## 21.11.2026 – ESYLUX-/Gira-Prüflücken (API/MCP 3.0.1)

- Deutsche ESYLUX-Domain und belastbarer Artikel-/GTIN-Beleg bei grafischem Herstellerlogo; Gira-Tabellenköpfe, gruppierte Artikelnummern und zeilenweise PDF-Artikelprüfung korrigiert.
- Neue Richtlinie v2 verwendet ältere Cache-Befunde nicht weiter; Originale, Daten und Freigaben erhalten. Keine neuen Werkzeuge oder Rechte.
- 229 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen bestanden; lokal gesichert aktiviert. Zwei Herstellerdatenblätter im bestehenden Auftrag als offene Vorschläge, weiterhin ausschließlich manuell freizugeben. [Nachweise](docs/PRODUKTPRUEFUNG.md).


## 21.11.2026 – Verbindliche Hersteller-PDF-Prüfung (API/MCP 3.0)

- Hersteller-Produktseite und verlinkte PDF serverseitig prüfen; gezielte Artikel-/Variantenbelege, konservative Ablehnung unklarer Treffer und begrenzte lokale Textextraktion.
- Bestehendes MCP-Werkzeug um beide Quellen und `mode=check` ergänzt; neuer HTTP-Endpunkt, kompakte Befunde und privater gebundener Cache. Technische Multipart-Dateien und spätere Kategorieänderungen ebenfalls geschützt.
- Bestehende Dateien/Freigaben erhalten, neue Dateien weiterhin ausschließlich manuell einzeln übernehmen. Neue GUI zeigt den Prüfbeleg kurz an.
- Lokal gesichert aktiviert; 226 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen bestanden. [Details und Prüfgrenzen](docs/PRODUKTPRUEFUNG.md).


## 21.11.2026 – MCP-Dateiübergabe zwischen Browser-Container und Mac repariert

- Host-MCP 2.3.0: Hersteller-PDFs direkt über `metadata.sourceUrl` vorschlagen, lokaler `filePath` optional. Bekannte Browser-Containerpfade verwenden die Quellenadresse als Ersatz. Konkrete Quellfehler statt pauschalem Ordnerfehler; HTTPS-/DNS-/Redirect-/Größen-/Zeitgrenzen und privater Dateierhalt.
- HTTP-API/Docker unverändert 2.2.0, weiterhin 49 Werkzeuge. 216 Anwendungstests und acht Sicherungstests bestanden. Vorhandener Test-Auftrag erhalten, genau ein BRUMBERG-Datenblatt als offener Vorschlag eingereicht; keine Freigabe. Nach Neustart direkt im Codex-Chat verifiziert. [Ablauf und Nachweise](docs/API_MCP.md).

## 21.11.2026 – Einzellöschung und Wiederherstellung lokal aktiviert

- API/MCP 2.2.0: Gerätepositionen, Projekt-Dokumente und Assistentenaufträge gezielt entfernen, privaten Papierkorb und unveränderliches Lösch-/Wiederherstellungsprotokoll führen, gespeicherten Zustand ohne Überschreiben wiederherstellen. Vorschau, Benutzerbeleg, Version und Wiederholungsschlüssel verpflichtend.
- Dokumentbezüge werden gezielt entfernt; offene Anforderungen/Exporte und veränderte Wiederherstellungsziele werden geschützt. Übernommene Dokumente behalten nach Auftragslöschung ihre Freigabeherkunft. Keine neue Dateifreigabe über API/MCP.
- 209 Anwendungstests, acht Sicherungstests und sieben Wartungsprüfungen bestanden. Nach geprüfter Sicherung lokal aktiviert; 1.143 Dateien/16 Tabellen unverändert, keine realen Einträge gelöscht. [Ablauf und Nachweise](docs/TECHNIK.md).

## 21.11.2026 – gesicherter Projektreset über API/MCP lokal aktiviert

- API/MCP 2.1.0: Resetvorschau und ausdrücklich bestätigter Reset mit Versionsschutz, geprüfter Projektsicherung, atomarem Datenbankabschluss und sicher wiederholbarer Dateibereinigung. Alte Wiederholungsschlüssel können gelöschte Inhalte nicht wieder einspielen; gemeinsame Alt-Ausgaben bleiben geschützt.
- Leere Gerätelisten bleiben leer. Arbeitsplan verlangt nach Reset ausschließlich neu bereitgestelltes Material; manuelle Dateifreigabe unverändert.
- Nach geprüfter Vollsicherung ausschließlich Test · 0815-3 über MCP zurückgesetzt: 88 Gerätezeilen, 58 Dokumenteinträge und alter Auftrag samt Vorschlägen entfernt. Andere Projekte/Konten unverändert nachgewiesen. 203 Anwendungstests, acht Sicherungstests und sieben Wartungsprüfungen bestanden. [Umfang und Nachweise](docs/TECHNIK.md).

## 21.11.2026 – API-/MCP-Agentenvertrag 2.0 lokal aktiviert

- Kompakte Defaults, gezielte Detailansichten und kleine Seiten; API-Leseantworten begrenzt, MCP-Standardantworten höchstens 8 KiB und ausdrücklich angeforderte Vollansichten höchstens 32 KiB. Auch Werkzeugkataloge werden paginiert. Serveranweisung verkürzt, keine vollständige JSON-Doppelausgabe mehr.
- Chatantworten und Arbeitsentscheidungen gemeinsam mit Beleg, Versionen und Idempotenz speichern; automatische Zurückstellung/Wiederaufnahme und aktueller Folgeplan. Dauerhafte Historie gezielt lesbar.
- 208 Anwendungs-/Sicherungsprüfungen plus sieben Wartungsprüfungen bestanden; Sicherung getrennt wiederhergestellt/gestartet, Bestandsvergleich unverändert. [Vertrag und Umstellung](docs/API_MCP.md).

## 21.11.2026 – Assistent an geöffnetes Projekt gebunden

- Projektwahl entfernt; Übersicht, Zähler, Auftragsanlage und Status nur für das geöffnete Projekt. Direkte Links, Exporte und alte Formulare anderer Projekte gesperrt. Wechsel in anderem Fenster wird beim Statusabruf erkannt.
- API/MCP und Dateifreigaben unverändert. 205 Anwendungs-/Sicherungsprüfungen bestanden, gesicherte lokale Aktivierung und Bestandsvergleich unverändert. [Details](docs/DOKU_ASSISTENT.md).

## 21.11.2026 – Doku-Arbeitsplatz lokal aktiviert

- Genehmigte gemeinsame Arbeitsliste mit Projektwahl, Filtern, Statuszählern und Detailbereich auf bestehende Daten übertragen. Material-/Benutzeraufträge versioniert ergänzen, Rückfragen direkt beantworten, Punkte begründet zurückstellen/wieder aufnehmen.
- Echte geschützte PDF-Einzelprüfung erhalten; Ablehnungsgrund dauerhaft und für den Agenten lesbar. Keine Dateifreigabe über API/MCP.
- Vorherige veraltete MCP-Zählerprüfungen korrigiert. API 1.6.0/MCP 1.7.0 einschließlich allgemeiner Bearbeitungszustände gesichert aktiviert. 204 Anwendungs-/Sicherungsprüfungen und sieben Wartungsprüfungen bestanden; Bestandsvergleich unverändert. [Nachweise](docs/DOKU_ASSISTENT.md).

## 20.11.2026 – Unterlagenarbeit im Quellstand ergänzt, noch nicht aktiviert

- API 1.6.0 / MCP 1.7.0: Recherche-/Wartezustände für Anforderungen aller Kategorien und Rückfragen mit Quellen, Benutzerbelegen und unveränderter Historie. Zwei neue Werkzeuge; 47 HTTP-Operationen / 39 MCP-Werkzeuge.
- Arbeitsplan berücksichtigt Nichtfunde, Zurückstellungen und unpassenden abgelehnten Inhalt; neue Antworten/Zieländerungen entwerten alte Zurückstellungen. Kundenpflichten bleiben unerfüllt und manuelle Dateiprüfungen erreichbar.
- Keine Produktionstabellen, Quellen, Freigaben oder Dateientscheidungen geändert. [Vertrag und Aktivierungsgrenzen](docs/DOKU_ASSISTENT.md).

## 20.11.2026 – Datenblattablauf geprüft und lokal verbessert

- API 1.5.0 / MCP 1.6.0: optionaler kompakter Folgeplan mit unverändertem Standard und erhaltenen Rechten/Versionen; 94,3 % weniger gemessene serialisierte Ergebniszeichen, keine behauptete Tokenabrechnung.
- Abgelehnte interne Entwürfe werden nicht erneut automatisch vorbereitet; Wartegründe bleiben sichtbar und Kundenpflichtquellen offen. Artikelliste zeigt Suchdatum und Quellen.
- Vier Datenblätter und eine Montageanleitung für Test 0815-3 nur vorgeschlagen. Drei unbekannte R&M-Varianten ausdrücklich offen; bestehende Entscheidungen erhalten.
- 202 Anwendungs-/Sicherungsprüfungen, sieben Wartungsprüfungen, künstliche Browserprüfung, Vollsicherung/getrennter Wiederherstellungsstart und unveränderter Bestand nach lokaler Aktivierung. [Nachweise und Grenzen](docs/TESTS.md).

## 19.11.2026 – API-/MCP-Dokumentation und verlustfreie Speicherpflege

- Zentrale Übersicht, Architektur-/Refactoring-Karte und automatisch erzeugte Referenz für 45 HTTP-Operationen / 37 MCP-Werkzeuge. Neue Befehle `docs:api`, `docs:check` und passende CI-Prüfung verhindern unbemerkte Dokumentationsabweichungen. Rechte, Versionsschutz, manuelle Dateifreigabe und bekannte Ausbaupunkte klar getrennt.
- `storage:compact` plant und prüft unabhängige APFS-Klone identischer Sicherungs-/Nachweiskopien auf dem Mac. Keine Hardlinks, entfernten Dateipfade, geänderten Inhalte oder pauschale Docker-Bereinigung. Rund 10 GB mehr freier Mac-Speicher gemessen; 30 Sicherungen erneut validiert und aktiver Bestand unverändert.
- Sieben Wartungstests bestanden. Laufender API-Vertrag stimmt mit der erzeugten Referenz überein. Keine neue App-Aktivierung oder Online-Veröffentlichung; vorheriger 201-Test-Appnachweis bleibt getrennt.

## 19.11.2026 – BALS-Anforderung auf die beiden realen UV korrigiert

- Expliziter, versionierter API-/MCP-Korrekturweg für bestehende Geräteanforderungen mit vollständiger Vorher-/Nachher-Historie und Benutzerbeleg. Einzelbezüge bleiben kompatibel; eine Anforderung kann mehrere reale Geräte gemeinsam erfassen.
- Auf Benutzerauftrag genau die bestehende BALS-Datenblattanforderung von der historischen Typreferenz auf UV 01/UV 02 umgestellt und korrekt als Datenblatt eingeordnet. Dasselbe freigegebene Original erfüllt beide Geräte; keine neue Verteilung, Datei oder Freigabe.
- Typreferenzen, fremde Artikel, doppelte Ziele, veraltete Versionen und unerlaubte Änderungen werden abgewiesen. GUI zeigt mehrere Gerätebezüge. 201 Prüfungen bestanden; Sicherung und getrennte Wiederherstellung geprüft. Nach Korrektur alle 65 Vorschläge, 61 Sichtungen, Geräte-/Anhangsdaten und 740 vorhandene PDF-Dateien unverändert; 30/33 Kundenanforderungen erfüllt.

## 19.11.2026 – automatische Datenblattprüfung lokal aktiviert

- Gemeinsame Artikelabdeckung aus allen aktiven Gerätepositionen für API, MCP und minimalistische GUI; unabhängig von Einzelanforderungen. Instanzen gebündelt, Verbrauchsteile/Altmuster begründet ausgenommen.
- Neue lesende Abdeckungsroute und versionierte Recherchebelege für Nichtfunde/unklare Varianten; MCP 1.4.0 mit 36 Werkzeugen, OpenAPI 1.3.0. Datenblätter bleiben bis zur GUI-Einzelprüfung Vorschläge.
- Vorhandene Originale wiederverwendet, Typ-/Variantenwechsel und manipulierte Dateien erkannt. Historisch falsch kategorisierte Datenblattpflichten behalten eng begrenzt ihre explizite Bindung an dasselbe freigegebene Original; Anforderungen und Entscheidungen unverändert.
- Test 0815-3: 60 Artikel geprüft, 23 neue Original-PDFs vorgeschlagen und anschließend vom Benutzer über die GUI freigegeben. Aktuell 46 Artikel abgedeckt, elf belegte Nichtfunde, drei R&M-Varianten offen. Alte BALS-Typreferenz bleibt getrennt von den beiden realen UV.
- 197 Prüfungen erfolgreich, Desktop-/Mobilprüfung, Sicherung, getrennte Wiederherstellung und unveränderte Bestandsdaten beim lokalen Containerwechsel nachgewiesen. Keine automatisch erteilte Freigabe und keine Online-Veröffentlichung.

## 19.11.2026 – Bearbeitungsrichtlinie und Effizienzauswertung

- Verbindliche Regeln für reale Dokumentationsarbeit, Recherche, Rückfragen, Zurückstellungen, Ablehnungen, Bestandsschutz und manuelle Dateientscheidungen festgelegt; über `AGENTS.md` im Projekt verankert.
- Richtlinie 1.1 priorisiert Datenblätter für alle bestätigten dokumentationsrelevanten Artikel. Bestandsweite Abdeckung, gebündelte Recherche pro Artikel/Variante und gemeinsame Statusanzeige in edokus Struktur als höchste fachliche Ausbaustufe festgelegt; automatische Ermittlung noch nicht implementiert.
- Große Planantwort und doppelte MCP-Ergebnisdarstellung vermessen. Priorisierter Ausbauplan mit kompakten Antworten, Änderungsabruf, sicheren Sammeloperationen und messbaren Abnahmekriterien dokumentiert.
- Reine Richtlinien-/Planungsänderung; neue API-Parameter und MCP-Funktionen noch nicht implementiert oder aktiviert. Keine behauptete gemessene Tokenersparnis.

## 19.11.2026 – lokaler Tagesabschluss, Assistenteneinstieg und Gerätelisten

- Menüpunkt **Doku-Assistent** zeigt direkt offene Punkte eigener aktiver Aufträge. Antworten in der Liste, Dateisuche/-filter und direkter Zugang zu Angaben, Ausgabe, Verlauf, neuen Aufträgen und MCP-Einstellungen.
- edoku-Aktionsplan mit Herstellerrecherche und belegten Chatantworten; native Codex-Verbindung mit 34 Werkzeugen und Host-Adapter über Containerupdates hinweg geprüft.
- Projekttexte und zugehörige Anforderungen intern von Kundenunterlagen getrennt. Bemerkungen/Quellenhinweise aus Geräte-PDFs ausgeschlossen.
- Spannung und Leistung aus sichtbaren Gerätespalten und neuen Geräte-PDFs entfernt. Gespeicherte Werte auch beim GUI-Speichern erhalten; PDF-Ausgabeversion 3 schützt vor erneutem Export alter Layouts.
- 191 automatisierte Prüfungen, Browserprüfungen und sechs Geräte-PDFs mit sieben Seiten einer separaten Projektkopie. Sicherungen mit Abbild, getrennte Wiederherstellung und unveränderter Bestand nach lokaler Aktivierung geprüft.
- Reale Herstellerunterlagen für Test 0815-3 weiter recherchiert. Projekt bleibt wegen fehlender Pflichtquellen/Ausgaben fachlich offen. Keine automatische Dateiübernahme und keine Online-Veröffentlichung im Abschluss.
- [Tagesabschluss mit verbindlichen Entscheidungen und nächstem Einstieg](docs/TESTS.md).

## 19.11.2026 – kompakte Doku-Assistenten-Übersicht

- Übersicht mit nächster Aktion, offenen Dateien und getrennten Rückfragen; Auftragstext, Quellenbelege und Historie in eigenen Ansichten.
- Kurze Dateizeilen mit Statusfiltern und Suche statt langer Textkarten; übernommene und ersetzte Fassungen stehen nicht in der offenen Prüfliste.
- Eigene Dateiprüfung mit PDF-Vorschau, optionaler Ganzseitenansicht und eingeklappter Zuordnung. Nach manueller Einzelbestätigung direkt zur nächsten offenen Datei.
- Unverändert: Sichtung, Checkbox, Prüfsumme, Projektversion und GUI-Einzelfreigabe sind Voraussetzung jeder Übernahme.

## 19.11.2026 – MCP-Materialablauf

- Chatantworten mit Quellenbeleg und Versionsprüfung in den Dokumentationsauftrag übernehmen; überholte Fragen mit Historie kennzeichnen.
- Projektbezogene Hersteller-/Systemtypen ergänzen, ohne globale Kataloge oder vorhandene Geräte zu ersetzen.
- Projekttexte als edoku-Kapitelentwürfe vorbereiten; Text und PDF erst nach manueller GUI-Einzelprüfung übernehmen.
- Alte offene Dateifassungen ohne Löschung ablösen; freigegebene Originale bleiben erhalten.
- Nachweise und weitere PDF-Projektunterlagen in Exportplanung, Inhaltsverzeichnis und Gesamt-PDF berücksichtigen.
- Ablauf, Rechte und Prüfungen: [MCP-Materialablauf](docs/API_MCP.md).

## 18.11.2026 – Einstellungsleiste und Projektmanager

- Lokal aktiviert und auf der Online-Testinstanz geprüft: gerundete Einstellungsleiste und Farbwechsel nach Auswahl einer Theme-Vorlage.
- Auf GitHub veröffentlicht: überarbeitetes README mit siebenseitigem Beispiel-Export und technischer Online-Prüfstand.
- Mit künstlichen Daten in der Docker-Vorschau geprüft: zentriertes Plus für neue Projekte, originales nickgm-Globus-Logo und Direktnavigation zu Projektordnern, Benutzerverwaltung und Sicherheitsprotokoll.
- [Tagesabschluss mit Prüfungen und Bereitstellungsständen](docs/TESTS.md)

## 17.11.2026 – Sicherheitskorrekturen für die lokale Anwendung

- Eingeschleustes JavaScript in eingebetteten Projektdaten verhindert; CSP und weitere Antwortheader ergänzt.
- Routenprüfung vereinheitlicht; frühe Anfrage-, Schreib-, Export- und Speichergrenzen eingeführt.
- Auditprotokoll inkrementell und mit durchgehender, überprüfter Rotation; keine historischen Einträge gelöscht.
- Eigener Erstzugang bei Produktions-Neuinstallation erforderlich; Docker ohne Root-Rechte, Wiederherstellung mit passender Benutzerkennung.
- 118 automatisierte Prüfungen und acht Projektkopien (80 Vergleiche, 249 PDF-Seiten, acht Rückimporte) bestanden. Lokale Aktivierung getrennt vom unveränderten Online-Stand.
- Details: [Sicherheitsupdate](docs/SICHERHEIT.md).

## Tagesabschluss dokumentiert – 17.11.2026

- [Tagesabschluss](docs/TESTS.md) mit getrenntem Quell-, Online- und lokalem Installationsstand ergänzt.
- Erfolgreiche GitHub-Prüfungen des Pull Requests und tatsächlichen main-Merge-Commits mit 109 bestandenen Tests verlinkt.
- Handbuchprüfung mit 16 vollständig geladenen Bildern und gültigen Kapitelzielen sowie Bestandsschutz und offene Exportlücken festgehalten.
- Reine Dokumentationspflege; Anwendungscode, Konten und Projektdaten bleiben unverändert.

## Geprüften Stand in main übernommen – 17.11.2026

- Geprüften Programmstand aus `gm/coolify-test-20261117` einschließlich Tests, Grafiken und Anwenderdokumentation zusammengeführt.
- README, Installationshinweise und Projektstatus auf `main` aktualisiert; historische Prüfstände erhalten.
- Keine privaten Laufzeitdateien oder lokalen Konfigurationsänderungen veröffentlicht. Bestehende Installationen, Konten, Projekte und historischer Altbestand bleiben erhalten.
- Die Repository-Übernahme ist keine Datenmigration und keine fachliche Freigabe unvollständiger Dokumentationen.

## Dokumentation und Online-Nachweis – 17.11.2026

- README auf einen schnellen Produktüberblick mit klar getrennten Anwender- und Betreiber-Einstiegen umgestellt.
- Bebilderte [Bedienungsanleitung](docs/BEDIENUNGSANLEITUNG.md) für den vollständigen Nutzerablauf ergänzt; keine Servereinrichtung in der Anwenderanleitung.
- Neue Aufnahmen ausschließlich mit künstlichen Testdaten; frühere Screenshots erhalten und datiert abgegrenzt.
- [Tatsächlichen Online-Prüfstand](docs/TECHNIK.md) dokumentiert: HTTPS, SQLite, Anmeldung, Speichern/Wiederladen und PDF-/ZIP-Erzeugung; 15 fehlende PDF-Quellen im Testbestand ausdrücklich als unvollständigen Export abgegrenzt.
- Aktuelle Gesamttestzahlen und Bereitstellungsangaben in den technischen Anleitungen abgeglichen; historische Prüfstände erhalten.
- Reine Dokumentationspflege: keine Änderung von Anwendungscode, Konten, Projekten oder historischem Altbestand, keine neue Bereitstellung.

## Coolify-Testbetrieb – 17.11.2026

- Mehrstufiges Node-22-Abbild ohne Compiler in der Laufzeit; Python für Sicherungswerkzeuge erhalten. Direkter Node-Start und echter Healthcheck.
- Öffentliche Bereitschaftsprüfung `/ready` liest tatsächliche Datenbanktabellen und prüft Laufzeitordner und SQLite-Stufen.
- Optionaler eigener Erstzugang statt bekannter Demo-Konten bei Neuinstallation; bestehende Konten/Passwörter bleiben bei Neustart führend.
- Separate Coolify-Compose-Datei mit fünf Volumes, ohne feste Containernamen und öffentliche Host-Ports.
- Kompatible Sicherheitsaktualisierungen der gesperrten Abhängigkeiten; nach Korrektur 0 bekannte Paketlücken und erneut alle 109 Prüfungen erfolgreich.
- Sechs neue Deploymentfälle; 109 Prüfungen erfolgreich. Isolierte Container-Neuerstellung mit gleichen Datenbankzeilen und allen fünf Datenordnern geprüft.
- Einrichtung und Grenzen: [Coolify-Testbetrieb](docs/COOLIFY.md). Online-Abnahme ist vom lokalen Nachweis zu unterscheiden.

Dokumentierter Arbeitsstand: 06.11.2026, Paketversion `0.1.0-beta.1`. Datierte Einträge bewahren den jeweiligen damaligen Prüfstand; die aktuelle Gesamtsuite umfasst 109 Prüfungen. Lokale Aktivierung ist kein neuer Release-Tag.

## SQLite-Gerätetabellen – 06.11.2026

Nach Kopientests und ausdrücklicher Freigabe in der normalen lokalen Anwendung aktiviert; vollständige Sicherungen vor und nach Übernahme geprüft. Bestehende Konten, Passwortdaten, Projektinhalte und historische Dateien erhalten. 103 automatische Prüfungen, acht technische Projektkopienvergleiche mit 249 PDF-Seiten sowie lesende Prüfungen nach Aktivierung erfolgreich.

Gerätelisten und Positionen als projektgebundene Tabellen ergänzt. SQLite-Trigger halten die relationale Projektion und den vollständigen Datensatz atomar synchron; individuelle Felder und Reihenfolgen bleiben erhalten. Bestehende Installationen aktivieren die Stufe ausdrücklich nach Kopientests. Neue Installationen nutzen beide Stufen. Details: [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md).

## SQLite-Projektdaten – 06.11.2026

Projektbezogene strukturierte Daten schrittweise auf eine versionierte SQLite-Ablage umgestellt; vollständiger Erhalt der bisherigen Strukturen und JSON-Ausgangskopien. Transaktionales Speichern, Konflikterkennung, aktuelle Projektpakete und geprüfter Rückweg ergänzt. Details: [SQLite-Projektdaten](docs/SQLITE_PROJEKTDATEN.md).

## Benutzerverwaltung – 06.11.2026

- Einheitliche Prüfung neuer Passwörter; bestehende Konten und Passwörter bleiben erhalten.
- Selbstregistrierung standardmäßig geschlossen und für Systemadmins steuerbar.
- Fehlende Konten und ungültige Rollen/Statuswerte melden Fehler; letzter aktiver Systemadmin geschützt.
- Verständliche Rollen ohne Berechtigungsänderung bestehender Konten; klare Dialogfelder, Escape und Tastaturfokus.
- 13 neue Prüfungen, insgesamt 75 erfolgreich. Details: [Benutzerverwaltung](docs/BENUTZERVERWALTUNG.md).

## Einheitliche Gestaltung – 03.11.2026

- Ruhige Standardfarben in Hell und Dunkel, einheitliche Navigation, Flächen, Formulare und Tabellen.
- Mobile Auswahlkarten und Archivformulare umbrechend; breite Tabellen scrollen im eigenen Bereich.
- Bestehende Standardthemes ohne Dateimigration lesend verfeinert; individuelle Werte bleiben erhalten. Dynamisch lesbare Schaltflächenbeschriftung auch bei eigenen Farben.
- Vier Theme-Prüfungen ergänzt. Beschreibung: [Gestaltung](docs/THEME.md).

## Fehlende Brandschutzfotos – 03.11.2026

- Sichtbare Warnung mit Schottung und Fotofeld in Brandschutz, Dashboard und Export.
- Fehlende Dateiverweise stehen im PDF und im ZIP-Protokoll; sie verhindern einen vollständigen Exportstatus, ohne PDF-Datei-/Seitenzähler zu verändern.
- Optionale leere Felder und inaktive Schottungen erzeugen keine Fehlwarnung; vorhandene Daten werden nicht migriert.
- Sechs Regressionstests ergänzt, insgesamt 58 Prüfungen. Anleitung: [Brandschutzfotos](docs/BRANDSCHUTZFOTOS.md).

## Lokaler Beta-Betrieb – 30.10.2026

- Sicherheitsprotokoll für kritische Verwaltungsaktionen mit Versuchs-/Ergebnisdatensätzen, Hash-Verkettung und Systemadmin-Ansicht; keine Formularinhalte oder Zugangsdaten.
- Vollsicherung aller fünf Laufzeitordner einschließlich SQLite, Einstellungen, Medien, Ausgaben und historischem Bestand; Docker-Abbild inklusive. Wiederherstellung ausschließlich in einen neuen Ordner und mit Prüfsummenprüfung.
- Formular-Sicherheitstoken werden nach der Prüfung entfernt, bevor allgemeine Projektformulare gespeichert werden. Bestehende Dateien werden nicht migriert.
- Reproduzierbares Node-22-Abbild mit `npm ci`; GitHub-Prüfung und 52 automatische Tests einschließlich vollständigem PDF-/ZIP-/Archiv-Ablauf.
- Betriebsanleitung: [BETA_BETRIEB.md](docs/BETA_BETRIEB.md).

Alle relevanten Änderungen an `edoku` werden hier dokumentiert.

Das Format orientiert sich an Keep a Changelog. Die Versionierung folgt semantischen Versionen mit Beta-Suffix, solange die Anwendung noch nicht produktionsreif freigegeben ist.

## Unreleased

### Sicherheit und Projektarchive

- Archivdownloads auf eigene Manifest-/ZIP-Dateien begrenzt; Datei- und Symlinkgrenzen für Vorschauen, Anhänge und Pakete ergänzt.
- Ausgabeablage von sichtbaren Namen auf stabile Benutzer-/Projektkennungen umgestellt; Altbestände bleiben unverändert und eindeutig zuordenbare Dateien lesbar. Gemeinsame Alt-Ausgaben bleiben auf Benutzerwunsch separat historisch erhalten.
- Signierte CSRF-Tokens für Formulare, Auto-Save und Uploads; Login-/Registrierungsbegrenzung und Systemadmin-Grenzen für globale Änderungen.
- Atomare JSON-Speicherung und Fehlerweitergabe; vorherige PDFs/fertige Exporte sowie entfernte Anhänge bleiben in privaten Rückfallebenen erhalten.
- Echte Streaming-ZIPs und Paketformat 2.0 mit Prüfsummen, tatsächlichen Anhängen und sicheren Rückimporten ohne Überschreiben vorhandener Projekte.
- Alte Exportindizes bleiben als passive Begleitmetadaten erhalten; fehlende ursprüngliche Quellen werden ausdrücklich dokumentiert.
- 17 zusätzliche Sicherheits-/Archivprüfungen; insgesamt 38 erfolgreich. Alle acht nicht gelöschten Projekte in einer echten Datenkopie erfolgreich exportiert und rückimportiert, ursprüngliche Dateien und bestehende Datenbankzeilen unverändert.
- Anleitungen zu Zugriffsschutz, Archivformat und Wiederherstellung ergänzt.

### Geändert

- README mit fünf Screenshots aus einer getrennten Demo-Installation ergänzt; Release Notes, Installation, Arbeitsstand und offene Punkte aktualisiert.
- Reproduzierbare Test-/Abnahmeanleitung und Vorgehen für lokale Updates, Sicherung und Wiederherstellung dokumentiert.

- Bestehende Konten werden beim Start nicht mehr durch Startkonten überschrieben; eine vorhandene Datenbank wird nicht erneut aus dem alten Projektregister migriert.
- Projektaufrufe aktualisieren keine vorhandenen Projektzeitstempel; GET-Systemauswahl speichert keine automatisch abgeglichene Auswahl.
- Lokale Sicherungen von Git und Docker-Build-Kontext ausgeschlossen.

- Kapitelnummern, Gerätelisten und importierte PDFs nutzen eine gemeinsame Exportstruktur; Nummernkollisionen und falsche Dateistatus-Zuordnungen behoben.
- PDF-Dateien, Strukturüberschriften und tatsächliche Seiten werden getrennt gezählt; Dashboard und Export verwenden denselben aktuellen Stand.
- Gesamt-PDF mit tatsächlichen Startseiten und gemessenen Inhaltsverzeichnis-Sprungflächen; mehrseitige Anhänge und lange Titel berücksichtigt.
- Eindeutige Dokumentkennungen für generierte PDFs, lückenlose finale Dateinummern und passende ZIP-Kapiteltitel ergänzt.
- Ordneranzahl folgt PDF-Seiten und einstellbarer Kapazität; fehlende, veraltete und unlesbare Dateien werden ausdrücklich ausgewiesen.

- App-Icon auf Dokument mit Prüfhaken reduziert; Favicon, Safari-Maske und PNG-Startbildschirmvarianten vereinheitlicht.

- Ruhige technische Oberfläche mit klarer Navigation, flacheren Bedienelementen und vereinheitlichten Abständen.
- Projektübersicht mit Erfassungsstand, hervorgehobenem nächsten Schritt und einheitlichen Kennzahlenkarten überarbeitet.
- Anmeldung und Registrierung mit gemeinsamer technischer Dokumentengrafik gestaltet.
- Seitenkopf und Navigationsdefinition zentralisiert; CSS bei unveränderter Reihenfolge in Fachbereiche aufgeteilt.
- Tastaturfokus, Sprunglink zum Inhalt und reduzierte Bewegung berücksichtigt.

- Browser-Tab-Icons und kompaktes App-Icon fuer Header, Login und Register ergaenzt.
- Kapitelnummerierung im Export korrigiert.
- Doppelte Original-Kapitelnummern in der Dokumentenmatrix erzeugen jetzt keine doppelten Anzeige-Kapitel mehr.
- Importierte PDF-Anhänge erzwingen ihre Elternkapitel im Inhaltsverzeichnis, damit Unterkapitel wie `12.1.1` nicht ohne `12.1` erscheinen.
- Aktueller Projektstand in `docs/AKTUELLER_STAND.md` ergänzt.

### Geprüft

- Übernahme in die lokale Hauptanwendung auf Port 3000 mit vollständiger Sicherung und unverändertem Datenbankinhalt sowie unveränderten Projekt-, Anhangs-, Einstellungs- und Exportdateien.
- Drei zusätzliche Datenerhalt-Prüfungen: bestehende Konten und Projekte über Seitenaufrufe/Neustarts, vorhandene leere Datenbank und echte Erstinstallation. Zusammen mit den Exportprüfungen: 21 erfolgreich.

- 18 automatisierte Kapitel-/Exportprüfungen sowie HTTP-Abgleich von Dashboard, Export und Gesamt-PDF in einer getrennten Testkopie.

- Docker-Container neu gebaut und gestartet.
- API-Smoke-Test im Container erfolgreich ausgeführt.
- Inhaltsverzeichnisbaum im Container geprüft: keine doppelten Kapitelnummern.

## 0.1.0-beta.1 - 2026-06-07

### Hinzugefügt

- Login und lokale Benutzerverwaltung mit SQLite.
- Rollenmodell mit `viewer`, `user`, `admin` und `systemadmin`.
- Benutzerbezogene Projektverwaltung mit aktuellem Projektkontext.
- Dashboard mit Fortschritts- und Statusdaten.
- Projektstammdaten inklusive Objektstruktur und Stockwerken.
- Leistungsbereiche mit Formularvorgaben.
- Dokumentenmatrix mit logischer Kapitelnummerierung.
- Gerätelisten je Leistungsbereich.
- Systemweite Gerätelisten-Vorlagen.
- Brandschutzabschottungen mit Foto-Zuordnung.
- Kategoriebezogene Anhangsverwaltung mit Kachelansicht.
- Bedienungsanleitungen als vorbereitete Anhangskategorie mit Gerätebezug.
- PDF-Erzeugung für Inhaltsverzeichnis, Anlagenbeschreibung, Formulare, Gerätelisten und Brandschutzseiten.
- Separate PDF-Trennstreifen.
- Separate Ordnerrücken für Avery-Zweckform `61x192-R` und `38x192-R`.
- Finaler Exportordner und ZIP-Ausgabe als Beta-Funktion.
- Theme-Editor mit GitHub-/VS-Code-orientierten Presets.
- Versionsanzeige und GitHub-Update-Prüfung im Systembereich.
- API-Grundgerüst unter `/api/*` mit Demo-Daten.
- Docker-Setup.

### Geändert

- Branding und UI-Texte auf `edoku` bereinigt.
- Hauptnavigation verdichtet.
- Dokumentationsbereich in `Anhänge` umbenannt.
- Dokumentenmatrix in den Exportbereich verschoben.
- Matrix-Tabellen horizontal scrollbar und mit anpassbaren Spaltenbreiten vorbereitet.
- Anhangsbearbeitung in Popup-Fenster verlagert.
- Brandschutz-Fotozuordnung auf eindeutige Foto-1-/Foto-2-Slots begrenzt.
- Systemzugang nach rechts in die Header-Leiste verschoben.
- Session-Cookie-Erkennung für lokalen HTTP-Betrieb und HTTPS hinter Reverse Proxy verbessert.

### Bekannte Grenzen

- Noch keine produktive Server-Härtung.
- Rollen- und Rechteverwaltung ist Beta und muss weiter systematisch getestet werden.
- Noch keine vollständige automatisierte Test-Suite.
- Gesamt-PDF, ZIP-Export, Trennstreifen und Ordnerrücken müssen weiter im Praxiseinsatz geprüft werden.
- Klickbare Inhaltsverzeichnis-Einträge im finalen Gesamt-PDF sind noch offen.
- Normtexte und erzeugte Formulartexte müssen fachlich weiter geprüft werden.


## 21.11.2026 – Produktprüfung / API-MCP 3.0.2

Hersteller-Linkauflösung, gebundene Produktfragmente, ausgewählte Varianten und PDF-Artikel-/Spaltenlayouts korrigiert. Technische Rechercheblocker gesondert speicherbar, Fortschrittsantwort im MCP kompakt. Vorhandene Dateien und Freigaben erhalten; neue Dateien nur nach GUI-Einzelsichtung. Einzelheiten und Grenzen: `docs/PRODUKTPRUEFUNG_PRUEFLUECKEN.md`.
