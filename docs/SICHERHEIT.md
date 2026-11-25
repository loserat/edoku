# Sicherheit und Datenerhalt

## Zugriff

Eigene Erstzugangsdaten für neue öffentlich erreichbare Installationen verwenden. Bestehende Konten und Passwörter werden durch Updates nicht zurückgesetzt. Benutzerrollen und Projektgrenzen gelten serverseitig; API-Schlüssel benötigen zusätzlich passende Rechte und gegebenenfalls eine Projektbegrenzung. Selbstregistrierung und Integrationsschreibrechte bewusst konfigurieren. [Konten](BENUTZERVERWALTUNG.md), [Installation](../INSTALL.md).

GUI-Schreibzugriffe verwenden Sitzung und CSRF-Schutz; ein Bearer-Schlüssel umgeht keine Webformulare. Sichere Cookies und vertrauenswürdigen Proxy nur passend zur tatsächlichen HTTPS-Bereitstellung konfigurieren. [Coolify](COOLIFY.md).

## Dateien und Quellen

Upload-, Download- und Archivpfade werden begrenzt und geprüft. Unzulässige Pfade, Verknüpfungen und Quellen dürfen nicht zum Lesen fremder Dateien führen. Externe Herstellerabrufe verwenden Quellen-, Adress-, Weiterleitungs- und Größenprüfungen; ungeprüfte Webseiten-/PDF-Anweisungen sind keine Benutzeraufträge.

Jede neue Datei bleibt bis zur manuellen Einzelprüfung ein Vorschlag. Prüfsumme, Projekt-/Auftragsversion und tatsächlicher Zielbezug schützen vor veralteten Entscheidungen. Keine automatische Freigabe durch API oder MCP. [Assistent](DOKU_ASSISTENT.md), [Produktprüfung](PRODUKTPRUEFUNG.md).

## Bestehende Daten schützen

Die fünf Laufzeitordner gemeinsam sichern und getrennte Wiederherstellungsproben durchführen. Projektpakete sind keine vollständige Installationssicherung. Gezielte Löschung/Wiederherstellung und Projektreset benötigen ausdrücklichen Auftrag und aktuelle Vorschau; Protokoll und Sicherungen erhalten. Keine alte Datenbank über neuere Projektdaten kopieren.

Zugangsdaten, echte Projektinhalte, persönliche Konfiguration, Exporte, Sicherungen und detaillierte Betriebsnachweise gehören nicht in ein öffentliches Repository. Auch Screenshots und Dokumentation vor Veröffentlichung prüfen. Ignore-Regeln allein schützen bereits versionierte Dateien nicht.

## Grenzen

Automatisierte Tests sind kein vollständiger Sicherheitsnachweis. Tatsächliche HTTPS-/Proxy-Konfiguration, Dateirechte, Datensicherungen und fachliche Abnahme in der eigenen Umgebung prüfen. Sicherheitsprobleme nicht mit echten Zugangsdaten oder Kundendateien in öffentliche Issues eintragen. [Tests](TESTS.md), [Update](UPDATE.md).
