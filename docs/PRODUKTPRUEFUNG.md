# Verbindliche Hersteller-PDF-, Artikelnummern- und Variantenprüfung

Aktueller Quellstand API/MCP 3.8.1, Prüfrichtlinie v6: [Gezielte NIEDAX-/OBO-Prüfung, Blocker und Muster](PRUEFLUECKEN_ME01.md). Die folgenden datierten Richtlinien bleiben historische Nachweise.

Stand 21.11.2026. API/MCP **3.0.2**, weiterhin **49 MCP-Werkzeuge**, jetzt **58 HTTP-Operationen**. Lokal gesichert aktiviert und über eine frische Host-MCP-Verbindung geprüft; Nachweise siehe unten. Diese Prüfung ergänzt die [Datenblattabdeckung](DATENBLATTPRUEFUNG.md) und den [Agentenvertrag](AGENTENVERTRAG.md).

Korrektur vom selben Tag: [ESYLUX-/Gira-Erkennung und GTIN-Beleg](PRODUKTPRUEFUNG_KORREKTUR.md), Prüfrichtlinie `manufacturer_pdf_article_variant_v2`. Tabellenköpfe, gruppierte Artikelnummern und konkrete Artikelspalten werden erkannt. Bei grafischem Herstellerlogo ist ein exakt gebundener Artikel-/GTIN-Beleg möglich; eine fehlende Herstellerkennung wird nicht pauschal akzeptiert.

Frühere Erweiterung: [Quellen- und Layoutkorrekturen 3.0.2](PRODUKTPRUEFUNG_PRUEFLUECKEN.md), Richtlinie `manufacturer_pdf_article_variant_v3`. Die darunter dokumentierte v2-Korrektur und ihre Abschlussnachweise bleiben historisch erhalten. Für HTML gelten nun 4 MiB begrenzte Übertragung und weiterhin 768 KiB projizierte Nutzlast; PDF-Grenzen unverändert.

Aktuelle Richtlinie **`manufacturer_pdf_article_variant_v4`**: [Brandschutzmaterial und gebundene Systemanleitungen](BRANDSCHUTZ_PDF_VERKNUEPFUNG.md). Datenblätter bleiben produktbezogen; eine Systemanleitung ersetzt kein Datenblatt.

Aktuelle Ergänzung: **`manufacturer_pdf_article_variant_v5`** mit gezielter NIEDAX-KTUM-Auflagelängenprüfung und [kompakter Hersteller-Linkermittlung](KOMPAKTE_HERSTELLER_LINKS.md). Die darunter dokumentierten Versionen bleiben historische Nachweise.

## Verbindlicher, sparsamer Ablauf

1. `edoku_next_action` kompakt lesen. Vorhandene freigegebene Dateien und offene Vorschläge zuerst abgleichen; gleiche Artikel zusammen bearbeiten.
2. Die konkrete offizielle Hersteller-Produktseite und das dort verlinkte PDF ermitteln. Keine ähnlichen Artikel als Ersatz wählen. Beide URLs sowie die tatsächlichen Gerätebezüge an `edoku_propose_document` übergeben; ein lokaler Dateipfad ist für diesen Weg überflüssig.
3. Edoku lädt Produktseite und Original-PDF selbst. Es prüft die Herstellerquelle, den konkreten Downloadlink, die Artikelnummer und die tatsächlich gespeicherte Variante anhand begrenzter lokaler Textextraktion. Standard `mode=propose` erledigt Prüfung und Vorschlag in einem Aufruf. Optionales `mode=check` liefert nur den Befund und erzeugt keinen Vorschlag.
4. Nur `matched` erzeugt einen offenen Vorschlag. Bei `unclear` nennt die Antwort den konkreten Grund; nötige Rückfragen gehören in den Agentenchat. Unveränderte Fehlversuche nicht wiederholen. Keine routinemäßigen Volltextabrufe oder PDF-Seitenbilder für die Identitätsprüfung.
5. Jede neue Datei bleibt bis zur tatsächlichen Sichtung und manuellen Einzelbestätigung in der GUI unübernommen. Automatische Passungsprüfung ersetzt weder Benutzerentscheidung noch fachliche Abnahme.

## API und MCP

`POST /api/v1/projects/{projectId}/assistant/jobs/{jobId}/manufacturer-documents`

Rechte: `assistant:write`, `projects:read`, `devices:read`, `documents:read`; bestehende Benutzer-/Projektgrenzen und Schreibfreischaltung gelten weiter. Vorhandenen Auftrag verwenden. `metadata.expectedJobVersion` schützt optional den gelesenen Auftrag; für Ablösungen bleibt sie verpflichtend. Projektversion und Gerätebezüge werden bei der Übernahme des Vorschlags erneut geprüft.

```json
{
  "mode": "propose",
  "metadata": {
    "title": "Herstellerdatenblatt zum bestätigten Artikel",
    "category": "Datenblätter",
    "manufacturerPageUrl": "https://hersteller.example/produkt/ART-100",
    "sourceUrl": "https://hersteller.example/download/ART-100.pdf",
    "sourceLabel": "Offizielle Hersteller-Produktseite",
    "reason": "Passende Unterlage für die bestätigte Geräteposition.",
    "deviceReferences": [{
      "listId": "geraeteliste",
      "position": 1,
      "manufacturer": "Hersteller",
      "model": "ART-100"
    }]
  }
}
```

Das Beispiel enthält fiktive Kennungen und keine freigeschaltete Herstellerdomain. MCP verwendet dieselben `metadata` plus `projectId`, `jobId` und optional `mode`. Standard bleibt `propose`; `filePath` ist optional. Für eine lokale Datei bleibt der sichere Eingangsordner erforderlich; edoku gleicht zusätzlich ihren SHA-256 mit dem heruntergeladenen Original ab. Auch der bestehende Multipart-Endpunkt `/documents` erzwingt dieselbe Prüfung für **neue** Datenblätter und Anleitungen. Ein vom Client gesendeter `productVerification`-Befund wird durch das strikte Schema abgewiesen.

Bei `mode=check` antwortet die API mit HTTP 200, `state`, kompaktem `verification` und `proposalCreated:false`, auch bei fachlich unklarer Passung. `mode=propose` liefert HTTP 201 mit Kennung, Zustand, Hash, Zählern und bis zu drei Zuordnungen/Befunden. Alle tatsächlichen Bezüge werden gespeichert und bleiben gezielt am Vorschlag lesbar. Unklare Vorschläge werden mit HTTP 422 / `PRODUCT_DOCUMENT_UNCONFIRMED` und kompaktem `error.verification` abgewiesen. Die 8-KiB-MCP-Grenze bleibt wirksam.

## Was der Prüfbeleg aussagt

- **Quelle:** Die Produktseite muss zur freigegebenen Herstellerdomain gehören und exakt die PDF-Adresse verlinken. Weiterleitungen werden erneut geprüft. Die zentrale Liste liegt in `services/manufacturerSourcePolicy.js`; die Administration kann verifizierte Hersteller mit `config/manufacturerSources.json` ergänzen, z. B. `{"Hersteller":["hersteller.example"]}`. Agenten dürfen diesen Vertrauensbestand nicht zur Umgehung der Prüfung ändern. Unbekannte Domains bleiben unklar.
- **Artikel:** Eine als Artikel-/Bestellnummer, Typ oder Modell bezeichnete Kennung muss im PDF passen. Bloße Seitenzahlen, Teilnummern und ähnliche Artikel genügen nicht. Bei abweichender Hersteller-Katalogkennung ist zusätzlich ein zuvor belegter administrativer Artikelalias erforderlich (`config/manufacturerArticleAliases.json`, Format `{"Hersteller":{"Artikel":"PDF-Kennung"}}`; vorbelegt ist der bereits geprüfte BRUMBERG-Alias 00535500 → 5355). Die konkrete Produktseite muss außerdem den Download mit der angefragten Kennung im Dateipfad verlinken; die abweichende PDF-Kennung wird als `documentModel` und `manufacturer_link_alias` sichtbar. Die Geräteliste wird dadurch nicht umbenannt.
- **Variante:** Die Prüfung verwendet die aktuellen Gerätefelder `abmessung` und `farbe`, zusätzlich zur vollständigen Typ-/Artikelkennung. Farbübersetzungen und einfache Schreibweisen von Abmessungen werden normalisiert. Varianten anderer Artikel auf derselben Seite dürfen nicht als Beleg dienen. Fehlen die relevanten Angaben bereits im Projekt, wird keine zusätzliche Variante erfunden; `variantRequired:false` bleibt ausdrücklich sichtbar. Eine kundenspezifische Konfiguration, die nicht im Typ oder diesen Feldern steht, kann damit nicht automatisch bestätigt werden.
- **Anleitungen:** Eine Baureihenanleitung ohne exakte Artikelnummer im PDF ist nur zulässig, wenn die konkrete passende Hersteller-Produktseite sie ausdrücklich als Anleitung verlinkt, der PDF-Inhalt als Anleitung erkennbar ist und Hersteller/Variante passen. Dieser Belegweg heißt `manufacturer_product_manual_link`. Eine Herstellererklärung oder beliebige allgemeine PDF genügt nicht.
- **Grenzen:** Scan ohne lesbaren Text, widersprüchliche/uneindeutige Tabellen, nicht erkannte Layouts, fehlende Varianten oder nicht erreichbare Quellen bleiben offen. Diese konservative Textprüfung ist keine universelle OCR oder technische Zertifizierung. `matched` bestätigt nur die genannten automatischen Belege; die GUI-Sichtung bleibt erforderlich.

## Ressourcen, Sicherheit und Bestandsschutz

HTTPS, öffentliche geprüfte DNS-Adressen mit IP-Bindung, keine Zugangsdaten/Cookies, höchstens fünf Weiterleitungen, 20 Sekunden je Download. HTML höchstens 4 MiB begrenzte Übertragung und 768 KiB projizierte Nutzlast (Skripte/Styles/Kommentare entfernen, vorhandenen Hauptbereich verwenden), PDF unverändert höchstens 14 MiB. Ein statisch gebundenes Produktfragment derselben Herkunft ist zusätzlich zulässig. Der vorhandene PDF.js-Bestand extrahiert im getrennten Prozess höchstens zwölf Seiten, 12.000 Zeichen je Seite und insgesamt 90.000 Zeichen; zehn Sekunden Laufzeit, begrenzter Prozessspeicher und 400.000 Bytes Prozessausgabe. Keine Bilder, OCR oder Systemschriftensuche. PDF-Text bleibt intern; Antworten enthalten höchstens drei kurze Zielbefunde und keine Volltexte.

Der private Cache unter `storage/users/<user>/assistant/<job>/product-checks/` bindet Herstellerseite, PDF-Adresse, Kategorie, aktuelle Geräte und Variante sowie Prüfrichtlinie zusammen. Original und Hash werden abgeglichen; ein passender Befund wird höchstens eine Stunde wiederverwendet. Das reguläre Benutzerspeicherbudget gilt auch für diese Ablage. Sie gehört zu Sicherung und Auftragshistorie, nicht zum Kundenexport. Beschädigte Cache-Dateien werden nicht still überschrieben oder als passend akzeptiert.

Prüfung und neue Vorschläge ändern keine Gerätewerte und übernehmen keine Datei. Bereits vorhandene Vorschläge und Freigaben werden nicht rückwirkend umklassifiziert oder entzogen. Unveränderte Wiederholungen vorhandener Dateien bleiben dedupliziert. Neue Vorschläge erhalten eine interne Richtlinienbindung, technische Unterlagen zusätzlich einen serverseitigen Prüfbeleg. Auch eine spätere Einordnung eines neuen Vorschlags als Datenblatt/Anleitung erfordert die Prüfung; vor ihrer manuellen Übernahme wird die Passung zum dann aktuellen Gerät erneut geprüft. Es gibt weiterhin kein MCP-/API-Werkzeug zum Freigeben oder Simulieren einer Sichtung.

## Architektur und Nachweise

`productDocumentVerificationService` koordiniert Quellen, Cache und Versionsbindung; `productDocumentMatchingService` prüft Artikel/Variante; `manufacturerSourcePolicy` hält die Publisher-Zuordnung. `workers/pdfTextWorker.mjs` begrenzt die lokale Extraktion. API und GUI verwenden den gemeinsamen `documentAssistantService`; der MCP-Host übergibt URLs an die API und führt keine zweite Artikelprüfung ein. Vorhandene Download-Schutzregeln bleiben im `mcpDocumentSourceService`.

Automatisierte Gegenproben: `scripts/product-document-verification.test.js`, sichere Downloads zusätzlich `scripts/mcp-document-source.test.js`. Externe HTTP-Antworten werden nur im getrennten Test-Checkout durch künstliche Herstellerquellen ersetzt; die echte PDF-Extraktion und der verbindliche Prüfer bleiben aktiv. Ältere fachfremde Tests isolieren diese neue Abhängigkeit ausdrücklich. Die Produktivsoftware enthält keinen Testmodus zum Überspringen der Prüfung.

**Abschluss:** 226 Anwendungstests, acht Sicherungstests und zwei Vertragsprüfungen im endgültigen Docker-Abbild bestanden. Syntaxprüfung: 136 JavaScript-Dateien/44 EJS-Vorlagen; erzeugte Referenzen aktuell, Diff-Prüfung ohne Fehler. HTTP-Vertrag 3.0.0 mit 58 Operationen stimmt mit dem laufenden Server überein; keine alte Operation entfernt.

Vollsicherung `backups/product-verification-pre-20261121` mit 1.779 Manifestdateien und alter Laufzeitabbild-Sicherung erstellt, getrennt wiederhergestellt und mit dem neuen Abbild gestartet. Danach regulären Container `edoku_v1` aktualisiert, identische Datenpfade, Ports und Benutzer 501:20 geprüft. **1.150 geschützte Dateien und 16 Datenbanktabellen unverändert** nach Aktivierung. Nur dieser reguläre edoku-Container läuft; der Wiederherstellungscontainer wurde beendet.

Frischer Host-MCP 3.0.0: 49 Werkzeuge, neues Schema einschließlich `mode`/`manufacturerPageUrl`, kompakter Plan und gezielte bestehende Dateimetadaten gelesen. Ausschließlich `mode=check` auf dem bereits vorhandenen BALS-11962-Datenblatt ausgeführt: vier Seiten geprüft, `matched`, SHA-256 `c3865992124e31ee42c513939e669825847f6a6415f35cadcbce4242b707205f`, `proposalCreated:false`. Die bereits vom Benutzer erteilte Freigabe blieb erhalten. Danach alle bisherigen Dateien und 15 fachlichen Tabellen unverändert; nur zwei neue private Prüfcache-Dateien sowie erwartete Zugriffsnachweise/Schlüsselnutzungszeit. Keine neue reale Datei vorgeschlagen, gesichtet oder übernommen.

Codex-Starteintrag ausschließlich auf Katalogversion 3.0.0 aktualisiert, vorherige Einstellung privat gesichert. Nach vollständigem Codex-Neustart auch direkt in diesem Chat 49 Werkzeuge, das neue Schema mit `manufacturerPageUrl`/`mode` und den kompakten Plan bestätigt. Das bereits freigegebene BALS-Datenblatt erfolgreich mit `mode=check` geprüft (`matched`, Cache genutzt, kein Vorschlag). Sieben geschützte Projektdaten-/Auftrags-/Datei-/Sichtungstabellen vor und nach diesem Aufruf unverändert; Nachweise `native-restart-*.json`. Die tatsächliche Vorschlags- und Freigabeprüfung des neuen Wegs erfolgte mit künstlichen Daten, nicht als Produktionsentscheidung. Private Protokolle: `intern/product-verification-20261121/`. Keine neue reale Dateieinreichung oder Freigabe gehört zu diesem Entwicklungspaket.
