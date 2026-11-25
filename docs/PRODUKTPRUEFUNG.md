# Herstellerunterlagen prüfen

Neue Datenblätter und Anleitungen werden ausschließlich als Vorschläge eingereicht. Ein technisch passendes PDF ist noch keine freigegebene Projektunterlage. Jede Datei benötigt die tatsächliche manuelle GUI-Einzelprüfung.

## Ablauf

1. Tatsächlich eingebauten Artikel anhand vorhandener Hersteller-, Typ-, Artikelnummern- und Variantenangaben zuordnen. Mehrdeutiges gezielt klären; Einbauangaben nicht erfinden.
2. Konkrete Hersteller-Produktseite einmal ermitteln. Mit `edoku_find_manufacturer_documents` gezielt höchstens drei dort veröffentlichte Original-PDF-Links abrufen.
3. `manufacturerPageUrl` und das dort verlinkte Original als `sourceUrl` übergeben. Standardmäßig in einem Aufruf prüfen und vorschlagen; `mode=check` nur bei konkretem Prüfbedarf.
4. edoku lädt und prüft Artikel-/Variantenpassung lokal. Nur ein eindeutiger Treffer wird zum offenen Vorschlag. Quellenfehler oder Konflikte offen dokumentieren und unabhängige Artikel weiterbearbeiten.

Keine routinemäßigen PDF-Volltexte oder Seitenbilder im Agentenchat. Bereits vorhandene passende freigegebene Projektdateien zuerst wiederverwenden. Ausgeschlossene Verbrauchsmaterialien nicht erneut recherchieren. Ein Nichtfund wird ohne neue Anhaltspunkte nicht wiederholt.

## Quellen und Varianten

Nur zulässige Herstellerquellen und tatsächliche Veröffentlichungen verwenden. Eine freigeschaltete Domain ersetzt keine Artikelbindung. Weiterleitungen, Adressen, Größen und Dateiformate werden zusätzlich geprüft. Keine fremden Quellen durch geänderte Gerätewerte oder erfundene URLs passend machen.

Familientabellen müssen zum eigenen Artikel gehören. Benachbarte Artikel, Verpackungsmaße und nicht belegte Achsen ersetzen keinen Nachweis. Reine Katalogmaße müssen nicht zusätzlich gepflegt werden, wenn sie aus dem eindeutig passenden Datenblatt hervorgehen. Bereits gespeicherte widersprechende Varianten bleiben Konflikte. Tatsächliche Einbaumaße und Brandschutzangaben bleiben unabhängig davon erforderlich.

## Pflichten und Freigabe

Artikel, Anleitung und erforderlicher Systemnachweis sind unterschiedliche Zuordnungen. Bei Brandschutz Systemart und Ausführung klären, Herstellerformular vor Eigenformular nutzen und keine unvollständige Vorlage als erfüllte Pflicht behandeln. Dokumente nur auf die tatsächlich bestätigten Geräte/Systeme beziehen.

Nach technischer Prüfung Quelle, Inhalt und Zuordnung im tatsächlichen Dokument manuell prüfen. Keine API-/MCP-Freigabe und keine vom Agenten bestätigte Benutzersichtung. [Dateiprüfung](DOKU_ASSISTENT.md), [Vertrag und Parameter](api/README.md).
