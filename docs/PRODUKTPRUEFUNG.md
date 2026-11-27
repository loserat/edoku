# Herstellerunterlagen prüfen

## ZZ330-Handelsname in Prüfrichtlinie V9

Das technische Originaldatenblatt für ZAPP-ZIMMERMANN ZZ330 verwendet `Handelsname: ZZ® 330 Brandschutzschaum`. V9 akzeptiert dies bei fehlender bisheriger Identitätserkennung nur gemeinsam mit derselben Produktüberschrift und der Überschrift „Technisches Datenblatt“. Alle gefundenen Handelsnamen müssen übereinstimmen. Bestätigte Hersteller-Produktseite, veröffentlichte PDF-Verknüpfung und Herstellerbeleg im PDF bleiben erforderlich.

Die neue Regel gilt ausschließlich für ZZ330 ohne zusätzliche Variante. Zusätzliche Maße/Farben, andere Nummern, verschiedene Handelsnamen, Aliase oder ein Sicherheitsdatenblatt werden dadurch nicht bestätigt. Auch ein bestimmtes Schottsystem wird nicht daraus abgeleitet: Produktdatenblatt, Montageanleitung und Systemnachweis bleiben getrennte Unterlagen. Neue Dateien entstehen weiterhin nur als offene Vorschläge zur manuellen GUI-Einzelprüfung.

Der konkrete ZZ330-V8-Befund zur fehlgeschlagenen Produkterkennung wird nach dieser Korrektur gezielt wieder bearbeitbar. Andere gespeicherte Sperren werden nicht pauschal zurückgesetzt; ein neuer V9-Fehler benötigt neue Erkenntnisse oder eine weitere ausdrücklich beauftragte Korrektur.

Neue Datenblätter und Anleitungen werden ausschließlich als Vorschläge eingereicht. Ein technisch passendes PDF ist noch keine freigegebene Projektunterlage. Jede Datei benötigt die tatsächliche manuelle GUI-Einzelprüfung.

## Ablauf

1. Tatsächlich eingebauten Artikel anhand vorhandener Hersteller-, Typ-, Artikelnummern- und Variantenangaben zuordnen. Mehrdeutiges gezielt klären; Einbauangaben nicht erfinden.
2. Konkrete Hersteller-Produktseite einmal ermitteln. Mit `edoku_find_manufacturer_documents` gezielt höchstens drei dort veröffentlichte Original-PDF-Links abrufen.
3. `manufacturerPageUrl` und das dort verlinkte Original als `sourceUrl` übergeben. Standardmäßig in einem Aufruf prüfen und vorschlagen; `mode=check` nur bei konkretem Prüfbedarf.
4. edoku lädt und prüft Artikel-/Variantenpassung lokal. Nur ein eindeutiger Treffer wird zum offenen Vorschlag. Quellenfehler oder Konflikte offen dokumentieren und unabhängige Artikel weiterbearbeiten.

Keine routinemäßigen PDF-Volltexte oder Seitenbilder im Agentenchat. Bereits vorhandene passende freigegebene Projektdateien zuerst wiederverwenden. Ausgeschlossene Verbrauchsmaterialien nicht erneut recherchieren. Ein Nichtfund wird ohne neue Anhaltspunkte nicht wiederholt.

## Quellen und Varianten

Prüfrichtlinie V8 erkennt auch gültige HTML-Links ohne Anführungszeichen und den veröffentlichten, gleichursprünglichen Striebel-&-John-PDF.js-Viewer. Der Leser führt kein JavaScript aus und erfindet keine Downloadadresse. Darstellungscode und Navigation werden vor der bestehenden HTML-Nutzlastgrenze entfernt; Text, Produkt-/Variantentabellen und relevante Linkattribute bleiben erhalten. 4 MiB Transfer, 768 KiB HTML-Nutzlast und die bisherigen PDF-/Adressgrenzen bleiben bestehen. Rittals Schreibweisen `DK 7072.100` und `DK 7072100` werden nur bei bestätigtem Hersteller und eigener Artikelbindung zusammengeführt; die PDF muss weiterhin die Artikelnummer belegen.

BEGA, Sikora Notlicht und die deutsche Siteco-Domain sind als Herstellerquellen registriert. Das bestätigt weder eine Produktvariante noch ein PDF. Eine Weiterleitung auf die Startseite, fehlender Artikelnachweis oder HTTP-Sperren bleiben offen. Nur konkret durch V8 behobene V7-Prüfsperren werden einmal wieder zur Bearbeitung angeboten; ein erneuter V8-Fehler erzeugt keine Schleife.

Nur zulässige Herstellerquellen und tatsächliche Veröffentlichungen verwenden. Eine freigeschaltete Domain ersetzt keine Artikelbindung. Weiterleitungen, Adressen, Größen und Dateiformate werden zusätzlich geprüft. Keine fremden Quellen durch geänderte Gerätewerte oder erfundene URLs passend machen.

Familientabellen müssen zum eigenen Artikel gehören. Benachbarte Artikel, Verpackungsmaße und nicht belegte Achsen ersetzen keinen Nachweis. Reine Katalogmaße müssen nicht zusätzlich gepflegt werden, wenn sie aus dem eindeutig passenden Datenblatt hervorgehen. Bereits gespeicherte widersprechende Varianten bleiben Konflikte. Tatsächliche Einbaumaße und Brandschutzangaben bleiben unabhängig davon erforderlich.

## Pflichten und Freigabe

Artikel, Anleitung und erforderlicher Systemnachweis sind unterschiedliche Zuordnungen. Bei Brandschutz Systemart und Ausführung klären, Herstellerformular vor Eigenformular nutzen und keine unvollständige Vorlage als erfüllte Pflicht behandeln. Dokumente nur auf die tatsächlich bestätigten Geräte/Systeme beziehen.

Nach technischer Prüfung Quelle, Inhalt und Zuordnung im tatsächlichen Dokument manuell prüfen. Keine API-/MCP-Freigabe und keine vom Agenten bestätigte Benutzersichtung. [Dateiprüfung](DOKU_ASSISTENT.md), [Vertrag und Parameter](api/README.md).

## OBO-PLM-Maßtabelle (V10)

Bei OBO PLM D … FS kann der Stammdatenblock die Maßfolge B × H × L ohne unmittelbar folgende Einheit nennen. V10 ergänzt diesen Wert ausschließlich aus einer expliziten Millimetertabelle des gleichen Artikels. Herstellerseite/PDF-Verknüpfung, exaktes Modell, eindeutige Artikelnummer über die beteiligten Seiten, vollständige Texterfassung und widerspruchsfreie Maße bleiben erforderlich. Eine separate Maß-B-/Maß-H-Wiederholung muss ebenfalls passen. Fehlende Einheiten, zusätzliche unbekannte Spalten, fremde Nummern und abweichende Werte bleiben gesperrt.

Ein unlesbares Tabellenlayout wird als technische Lesesperre ausgegeben, ein abweichender Zahlenwert als Passungskonflikt. Die kompakte `resolution` nennt den zuständigen Bearbeiter und den nächsten Schritt. Die Prüfung darf nicht durch gelöschte Maße, fingierte Feldwerte oder eine Dateifreigabe umgangen werden. Nur ältere passende V9-Sperren werden gezielt wieder bearbeitbar. Produktprüfung ist keine Einbaubestätigung.

Bei gezielter Wiederaufnahme bleiben gespeicherte Originalquellen in der berechneten Sicht erhalten (`search.outcome=retry`). Der Arbeitsplan liefert `RETRY_DATASHEET_CHECK`, `reuseOriginal=true`, bis zu zwei kurze `priorSources` und den gezielten Detailabruf. Der Agent prüft das bereits gefundene Original erneut, statt dessen Suche zu wiederholen. Die gespeicherten Recherchebelege werden dabei nicht umgeschrieben.
