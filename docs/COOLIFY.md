# Coolify: reproduzierbarer Testbetrieb


Stand **18.11.2026**. Technische Anleitung für Betreiber. Die [Bedienungsanleitung](BEDIENUNGSANLEITUNG.md) richtet sich getrennt an Anwender. Die Containerkonfiguration ist lokal geprüft und auf der bezeichneten Online-Testinstanz verifiziert; andere Installationen benötigen eine eigene Zielprüfung.

## Dockerfile statt automatischer Erkennung

Das Projekt enthält einen mehrstufigen `Dockerfile`: Node.js 22 und native SQLite-Abhängigkeiten werden getrennt von der Laufzeit gebaut. Compiler bleiben außerhalb des fertigen Abbilds. Python bleibt für Sicherungs- und Wiederherstellungswerkzeuge enthalten. Node startet direkt als Hauptprozess und kann beim Stoppen sauber beenden.

In Coolify die Anwendung mit dem Build Pack **Dockerfile**, Basisverzeichnis `/`, Dockerfile `/Dockerfile` und internem Port `3000` betreiben. Den ausdrücklich geprüften veröffentlichten Git-Stand auswählen. Die Paketversionsnummer allein identifiziert einen Commit nicht.

Alternativ für eine neue Compose-Ressource `docker-compose.coolify.yml` verwenden. Diese Datei enthält fünf benannte Volumes, keinen festen Containernamen und keine Host-Portfreigabe. Coolify übernimmt das Routing. Die bestehende lokale `docker-compose.yml` mit ihren Mac-Datenpfaden bleibt unverändert.

## HTTPS und Domain

DNS muss auf den richtigen Coolify-Server zeigen. In der Dockerfile-Anwendung die Domain als `https://edoku.example.org` eintragen, intern Port 3000. Bei Compose muss Coolify dem Dienst `edoku` die Domain und den internen Port zuordnen; gemäß Coolify-Dokumentation kann die Domainangabe dafür `https://edoku.example.org:3000` lauten. Der öffentliche Aufruf verwendet weiterhin HTTPS auf Port 443.

Nach dem Deployment das tatsächlich ausgelieferte Zertifikat prüfen. Ein selbstsigniertes „TRAEFIK DEFAULT CERT“ ist kein gültiges Zertifikat für die App-Domain. Browserwarnungen nicht wegklicken, sondern Domain, DNS und Zertifikatsausstellung in Coolify korrigieren. HTTP sollte anschließend auf HTTPS umleiten.

## Laufzeitvariablen

| Variable | Wert / Zweck |
| --- | --- |
| `PORT` | `3000` (Standard) |
| `NODE_ENV` | `production` im Docker-Abbild |
| `APP_ORIGIN` | Öffentlicher HTTPS-Ursprung ohne Pfad, z. B. `https://edoku.example.org` |
| `TRUST_PROXY` | `true`, wenn Coolify direkt als vertrauenswürdiger Reverse Proxy vorgeschaltet ist |
| `COOKIE_SECURE` | `true` für die HTTPS-Instanz |
| `COOKIE_SAME_SITE` | `lax` (Standard) |
| `EDOKU_REQUIRE_SQLITE` | `true`: Bereitschaft nur mit aktiven SQLite-Stufen 1 und 2 |
| `EDOKU_INITIAL_ADMIN_LOGIN` | Eigene Kennung für eine echte Neuinstallation |
| `EDOKU_INITIAL_ADMIN_PASSWORD` | Eigenes Passwort mit 12–256 Zeichen; kein reines Leerzeichen-Passwort |

Diese Variablen gehören zur Laufzeit. Insbesondere das Passwort nicht als Build-Argument oder in Git speichern. In Coolify „Available at Runtime“ aktivieren, „Available at Buildtime“ für Zugangsdaten deaktivieren und bei Passwörtern „Is Literal?“ aktivieren, damit Sonderzeichen unverändert bleiben.

Sind beide Erstzugangsvariablen gesetzt und existiert noch keine Datenbank, entsteht genau ein eigener Systemadmin. Die bekannten lokalen Demo-Konten werden dann nicht angelegt. Unvollständige/ungültige Erstzugangsangaben brechen den Start vor Anlegen einer leeren Datenbank ab. Bei vorhandener Datenbank haben bestehende Konten Vorrang: Ein Neustart ersetzt kein Passwort und legt die Startkonten nicht erneut an. Eine vorhandene leere Datenbank wird nicht als Neuinstallation behandelt. Änderungen der Erstzugangsvariablen sind kein Passwortreset.

Ohne Erstzugangsvariablen bleibt das bisherige lokale Demo-Verhalten kompatibel. Für eine öffentlich erreichbare neue Testinstanz beide eigenen Angaben setzen. Selbstregistrierung bleibt standardmäßig geschlossen.

## Fünf dauerhafte Datenordner

Bei Dockerfile-Anwendungen je einen eigenen Volume Mount anlegen:

| Ziel im Container | Inhalt |
| --- | --- |
| `/app/data` | Globale Ausgangsdaten |
| `/app/config` | Einstellungen und Vorlagen |
| `/app/storage` | SQLite, Konten, Projekte, Uploads und neue Ausgaben |
| `/app/output` | Ältere/historische Ausgaben |
| `/app/templates` | Dokumentvorlagen |

In der Compose-Variante sind diese Volumes bereits deklariert. Ein Containerwechsel soll die gleichen Volumes wiederverwenden. Neue Volumes verschieben vorhandene Containerdaten nicht automatisch. Wenn eine eindeutig bezeichnete Online-Testinstanz bewusst frisch aufgebaut wird, darf sie nach entsprechender Freigabe mit leerem Bestand starten. Das ist keine Erlaubnis, lokale Projekte, Sicherungen oder andere Coolify-Anwendungen zu löschen. Persistenz ersetzt keine Vollsicherung.

## Echte Bereitschaft statt Demo-API

Der Docker-Healthcheck ruft `GET /ready` auf. Dieser prüft die echten Konten-/Projektregistertabellen, die fünf les-/schreibbaren Laufzeitordner, den SQLite-Modus, die Geräteprojektion und die Vollständigkeit erfasster Projektdatensätze. `EDOKU_REQUIRE_SQLITE=true` verlangt beide Stufen. Erfolgreich: HTTP 200 mit `status: ready`. Fehler: HTTP 503 mit einer knappen Meldung ohne Kontoinhalte. Dieser Check schreibt keine Projekte oder Sitzungen und ersetzt keine vollständige Integritäts-/Fachprüfung.

`/api/health` bleibt der kompatible Demo-API-Healthcheck. Er allein belegt nicht, dass die echte Datenbank funktioniert. Bei einer Dockerfile-Ressource den eingebauten Docker-Healthcheck nutzen; eine ausdrücklich in Coolify konfigurierte zusätzliche HTTP-Prüfung ebenfalls auf `/ready` richten. Für Compose wird der Check durch das Abbild mitgeliefert.

## Geprüfter Umfang und Online-Abnahme

109 automatische Prüfungen bestanden im neuen Abbild: bisherige Anwendungs-/Export-/Sicherheitsfälle plus sechs Deploymentfälle. Sie prüfen unter anderem eigenen Erstzugang, Anmeldung hinter HTTPS-Proxy, Secure-Cookie, Neustart ohne Passwortwechsel, korrigierbare ungültige Erstangaben, SQLite-/Ordnerfehler und fehlerhafte Healthcheck-Antworten.

Zusätzlich wurde die Compose-Ressource mit fünf frischen Testvolumes gestartet und durch einen neu erzeugten Container ersetzt. Ordnerinhalte, Tabellenzeilen und der eigene Adminzugang blieben erhalten; beide Starts wurden `healthy`.

Online separat prüfen: ausgewählter Git-Commit, gültiges HTTPS, HTTP-Umleitung, Docker-Status `healthy`, `/ready`, Anmeldung mit eigenem Konto, Projektanlage/-bearbeitung, PDF-/ZIP-Export und Wiederanlauf mit denselben Daten. Fehlende Fachunterlagen bleiben fachliche Lücken. Die Testdaten müssen klar von lokalen Originalprojekten getrennt sein.

## Tatsächlich aktivierter Teststand

Am 18.11.2026 wurde die Testressource auf `main` umgestellt und auf Commit [2993893](https://github.com/loserat/edoku/commit/299389312d31e91752834fef33d47c722e5dad4b) festgesetzt. Dockerfile, interner Port und die fünf vorhandenen Datenvolumes wurden weiterverwendet. Coolify meldete den neuen Container als `healthy`. Über HTTPS bestätigte `/ready` SQLite samt Geräteprojektion. Anmeldung, Testprojekt, Einstellungsleiste und Theme-Wechsel wurden danach im Browser geprüft. [Online-Prüfstand](TECHNIK.md)

Bei einem weiteren Update zuerst den gewünschten Commit und seine Prüfungen festlegen. In **Git Source** den Branch und den Commit SHA speichern, dann **Redeploy** auslösen. Nach dem Rollout den laufenden Commit, den Containerstatus und `/ready` abgleichen. Den zuvor laufenden, gesunden Commit vor dem Wechsel als Rückweg festhalten. Der festgesetzte Commit trennt die Bereitstellung von späteren Dokumentationsänderungen.

### Frühere Bereitstellung vom 17.11.2026

Der Programmcommit `a07104ba18c0cb1ea0d7958ebc32504c47bd002e` aus `gm/coolify-test-20261117` wurde am 17.11.2026 erfolgreich aktiviert. HTTPS, Weiterleitung, `/ready`, Anmeldung, Projekt-/Gerätespeicherung und PDF-/ZIP-Erzeugung wurden geprüft. Fünf persistente Volumes sind eingebunden; gespeicherte Testdaten blieben über den nachfolgenden Containerwechsel erhalten. Die normale lokale Installation wurde dabei nicht neu bereitgestellt.

Die Ressource verwendet den Dockerfile-Healthcheck. Wenn Coolify einen eigenen HTTP-Healthcheck aktiviert, kann dieser den Check des Abbilds ersetzen; nicht versehentlich einen abweichenden Demo-Endpunkt prüfen. Bei der geprüften Ressource war kein separater Coolify-HTTP-Check aktiv.

Der Online-Testbestand ist fachlich unvollständig: 33 vorhandene Einzel-PDFs mit 35 Seiten, 15 fehlende PDF-Quellen. Die erzeugten Dateien wurden als Teilstand angeboten. Ein konkreter Download wurde nicht unabhängig geprüft. Vollständiger [Online-Prüfstand](TECHNIK.md).

## Abhängigkeitsprüfung vom 17.11.2026

Die im ersten Build gemeldeten Lücken wurden innerhalb der kompatiblen Versionsbereiche geschlossen: unter anderem Express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8, qs 6.16.2 und brace-expansion 2.1.8. Die Sperrdatei legt diese geprüften Versionen fest. `npm audit --omit=dev` meldete anschließend 0 bekannte Lücken; alle 109 Prüfungen bestanden mit dem korrigierten Abbild erneut. Das ist ein datierter Paketprüfstand, keine allgemeine Sicherheitsfreigabe.

## Quellen

- [Coolify: Docker Compose](https://coolify.io/docs/applications/builds/docker-compose)
- [Coolify: Persistenter Speicher](https://coolify.io/docs/services/configuration/persistent-storage)
- [Coolify: Healthchecks](https://coolify.io/docs/applications/configuration/health-checks)
- [Docker: Mehrstufige Builds](https://docs.docker.com/build/building/multi-stage/)

Weitere Anleitungen: [Installation](../INSTALL.md), [SQLite](SQLITE_PROJEKTDATEN.md), [Sicherung](BETA_BETRIEB.md), [Tests](TESTS.md).
