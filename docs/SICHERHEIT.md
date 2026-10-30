# Zugriffsschutz und Datenerhalt

Stand: 30.10.2026. Diese Maßnahmen sichern die lokale Beta ab. Sie sind keine
Freigabe für einen öffentlichen Mehrbenutzer- oder SaaS-Betrieb.

## Umgesetzte Grenzen

| Aktion | Viewer | User / Admin | Systemadmin |
| --- | --- | --- | --- |
| Eigene Projekte und vorhandene Dateien lesen | Ja | Ja | Ja |
| Eigene Projekte bearbeiten und Pakete erzeugen/importieren | Nein | Ja | Ja |
| Fremde Projektdateien direkt herunterladen | Nein | Nein | Nein |
| Globale Einstellungen, Vorlagen und Konten verwalten | Nein | Nein | Ja |
| Abmelden | Ja | Ja | Ja |

Die Systemadmin-Kontoverwaltung bleibt eine privilegierte Funktion. Alle
projektbezogenen Dateirouten prüfen unabhängig davon die Projektzuordnung.
Sichtbare Schaltflächen allein erteilen keine Schreibberechtigung.

### Projektdateien und Ausgaben

Neue Ausgaben liegen unter
`storage/users/<Benutzer-ID>/projects/<Projekt-ID>/output/`.
Projektnummern und sichtbare Namen bestimmen die Zugriffsgrenze nicht mehr.
Identische Namen verschiedener Benutzer oder Projekte teilen keine neue Ablage.
Die Zuordnung wird nur im laufenden Programm gehalten; bestehende JSON-Dateien
werden dafür nicht umgeschrieben.

Vorschauen und Downloads prüfen erlaubte Ordner, Dateitypen und tatsächliche
Dateisystemkomponenten. Symbolische Verknüpfungen dürfen die Grenzen nicht
umgehen. Anhangsvorschauen erkennen PDF-/Bildtypen anhand des Dateiinhalts;
eine manipulierte MIME-Angabe kann keine HTML-Seite im App-Ursprung freigeben.
Alte projekt-relative Bildpfade werden ausschließlich im eigenen Projekt gesucht.

Alte Ordner unter `output/projekte/` bleiben unverändert. Eindeutig zuordenbare
Bestände bleiben lesbar. Gemeinsam verwendete Bestände bleiben entsprechend der
Benutzerentscheidung separat historisch erhalten und werden nicht automatisch
einem Projekt zugewiesen. Neue Archive dokumentieren diese Trennung.

### Schreibende Anfragen und Anmeldung

- Serverseitige Formulare erhalten einen signierten, an die Sitzung gebundenen CSRF-Token. Auto-Save sendet ihn ebenfalls. So werden ungewollte Schreibanfragen von fremden Webseiten abgewehrt.
- Fremde `Origin`-/Fetch-Metadata-Angaben werden abgewiesen. Für abweichende Reverse-Proxy-Ursprünge kann `APP_ORIGIN` als vollständiger externer Ursprung konfiguriert werden, zum Beispiel `https://edoku.example.org`.
- CSRF-Geheimnisse liegen nur im Prozess. Nach einem Neustart müssen bereits geöffnete Formulare neu geladen werden; bestehende Login-Sitzungen werden dadurch nicht gelöscht.
- Zehn fehlgeschlagene Anmeldungen pro Kennung beziehungsweise dreißig pro IP-Adresse innerhalb von 15 Minuten führen vorübergehend zu HTTP 429. Registrierung ist auf zehn Versuche pro IP und Stunde begrenzt. Die Grenzen gelten pro laufendem Prozess.
- `X-Forwarded-Proto` wird nur über Express und die ausdrücklich konfigurierte Proxy-Vertrauensregel berücksichtigt. Eine beliebige Client-Angabe allein erzwingt keine HTTPS-Annahme.
- Gesperrte Konten werden abgewiesen. Passwortänderungen und Kontosperren beenden bestehende Sitzungen des betroffenen Kontos.

Der CSRF-Ansatz orientiert sich an den
[OWASP-Empfehlungen](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### Zuverlässiges Schreiben

JSON-Dateien werden über eine temporäre Datei im selben Ordner geschrieben,
vor dem Austausch synchronisiert und anschließend ersetzt. Schreibfehler
werden bis zur HTML-/Auto-Save-Antwort weitergereicht. Eine beschädigte
vorhandene JSON-Datei wird beim Lesen nicht still durch einen leeren Standard
ersetzt. Asynchrone Routenfehler gelangen zum zentralen Fehlerhandler.

Neue PDF-Dateien werden zunächst separat fertiggestellt. Frühere generierte
PDFs bleiben unter `.previous/` erhalten. Ein finaler Export wird vollständig
in einem Arbeitsordner vorbereitet; die letzte fertige Ausgabe bleibt bei
Fehlern erhalten und erfolgreiche Vorgänger liegen in `07_Vorherige_Exporte/`.
Gelöschte Anhänge werden im eigenen Projekt unter `.trash/` aufbewahrt.
Diese Rückfallebenen ersetzen keine vollständige externe Sicherung.

Das Verfahren verwendet die Dateioperationen der
[Node.js-Dateisystem-API](https://nodejs.org/docs/latest-v20.x/api/fs.html).
Es ist keine gemeinsame Transaktion über sämtliche JSON-Dateien, SQLite und
Dateien. Speicherplatz und Aufbewahrung der Historien müssen weiterhin überwacht werden.

## Nachweise und verbleibende Grenzen

Die automatisierten [Tests](TESTS.md) prüfen unter anderem Kontentrennung,
gleiche Projektnamen, Symlinks, manipulierte Archive, HTTP-Rechte, CSRF,
Sitzungsentzug, Speicherfehler und Exportabbrüche. Änderungen an bestehenden
Projekten werden zusätzlich in einer getrennten Datenkopie geprüft.

Noch offen bleiben insbesondere zentrale Audit-Protokollierung, verteilte
Rate-Limits, systematische Prüfung aller Browser-/Uploadvarianten, ein
automatisiertes externes Backup-/Restore-System und die vollständige Härtung
eines öffentlichen Serverbetriebs. Vorhandene lokale Demo-Zugänge wurden
nicht automatisch verändert oder entfernt.
