# Benutzerverwaltung

Stand: 06.11.2026

## Konten und Rechte

Systemadmins legen Konten unter **Einstellungen → Benutzer** an und verwalten dort Rolle, Passwort und Sperrstatus. Die drei auswählbaren Rollen sind:

| Rolle | Rechte |
| --- | --- |
| Nur lesen | Eigene Projekte und vorhandene Dateien ansehen, keine Änderungen speichern |
| Benutzer | Eigene Projekte bearbeiten, Dokumentationen und Projektpakete erzeugen/importieren |
| Systemadmin | Zusätzlich Konten, globale Einstellungen und Vorlagen verwalten |

Die alte interne Rolle `admin` bleibt für bestehende Konten unverändert erhalten. Sie heißt in der Oberfläche **Benutzer (bisher Admin)** und hat dieselben Rechte wie Benutzer. Neue Konten erhalten eine der drei klar abgegrenzten Rollen. Die alten Kennungen `viewer`, `user`, `admin` und `systemadmin` bleiben kompatibel. Systemadmins erhalten dadurch keinen direkten Zugriff auf fremde Projektdateien.

Das eigene Systemadmin-Konto kann sich weder sperren noch selbst herabstufen. Zusätzlich schützt die Datenbankschicht den letzten aktiven Systemadmin. Konten werden gesperrt, ihre Projekte bleiben erhalten. Eine dauerhafte Kontolöschung ist nicht vorgesehen.

## Neue Passwörter

Anlage, Selbstregistrierung und Admin-Passwortreset verwenden dieselbe serverseitige Prüfung: **12 bis 256 Zeichen**, keine reinen Leerzeichen. Leerzeichen in einer Passphrase bleiben Teil des Passworts und werden nicht entfernt. Die Eingabefelder zeigen die Mindestlänge an.

Die Regel gilt ausschließlich für neu gesetzte Passwörter. Vorhandene Passwörter, Hashes, Salts und Sitzungen werden beim Update nicht geändert. Bestehende kurze Passwörter funktionieren weiter. Ein ungültiger Reset erhält Passwort und Sitzung; ein erfolgreicher Reset beendet alle Sitzungen des betroffenen Kontos. Nach einer Kontosperre funktionieren weder vorhandene Anmeldungen noch eine neue Anmeldung. Reaktivieren stellt das bisherige Passwort wieder zur Verfügung.

Es gibt weiterhin keinen eigenständigen Passwortwechsel für normale Benutzer oder verpflichtenden Wechsel nach einem Admin-Reset. Vorhandene Startkonten werden nicht automatisch geändert; ein verantwortlicher Systemadmin muss bekannte Startpasswörter bewusst ändern. Das Update legt in einer vorhandenen Datenbank keine Startkonten erneut an.

## Selbstregistrierung

Die Selbstregistrierung ist standardmäßig **geschlossen**. Das gilt auch für vorhandene Einstellungen ohne den neuen Schlüssel. Anmeldung mit vorhandenen Konten bleibt möglich. `/register` erklärt den geschlossenen Zustand; direkte Registrierungsanfragen werden ebenfalls abgewiesen.

Ein Systemadmin kann unter **Einstellungen → Benutzer → Selbstregistrierung erlauben** die öffentliche Anlage neuer Benutzerkonten aktivieren und wieder schließen. Bei Freigabe kann jede Person mit Zugriff auf die Anwendung ein aktives Konto mit der Rolle Benutzer erstellen. Es erfolgt keine zusätzliche manuelle Einzelgenehmigung. Eine übergebene höhere Rolle wird bei der Registrierung nicht übernommen.

Die Einstellung heißt `selfRegistrationEnabled`. Nur der boolesche Wert `true` öffnet die Registrierung; fehlende Werte und Zeichenketten tun dies nicht. Beim Start/Update werden dafür keine Konfigurationsdateien umgeschrieben. Erst das bewusste Speichern des Schalters verändert diese eine Einstellung. Die Freigabe ist eine Betriebsentscheidung; in einer internen Installation sollte sie normalerweise geschlossen bleiben.

## Bedienung und Rückmeldungen

Unbekannte Benutzerkennungen liefern bei Rollen-, Status- und Passwortänderungen eine Fehlermeldung statt einer Erfolgsmeldung. Ungültige Rollen oder Statuswerte werden abgewiesen. Die vorhandenen serverseitigen Rollen- und CSRF-Prüfungen bleiben wirksam; Kennungen und Passwörter werden nicht allein durch Browserfelder abgesichert.

Die Benutzerbearbeitung zeigt klare Eingabefelder, hält Tab/Shift+Tab im Dialog und schließt über Escape, den Schließen-Knopf oder den Hintergrund. Nach dem Schließen kehrt der Fokus zum Öffnen-Knopf zurück. Lange Dialoge scrollen intern; kleine Bildschirme erhalten einspaltige Formulare.

## Prüfen

```bash
npm run test:users
npm run check
npm test
```

Die Benutzerprüfungen verwenden temporäre Verzeichnisse, künstliche Konten und normale HTTP-Anmeldungen. Sie greifen nicht auf Originalkonten zu. Prüffälle: schwache/zu lange Passwörter, Erhalt alter Passwörter, geschlossene und freigegebene Registrierung, fehlende Konten, ungültige Rollen/Statuswerte, Sitzungsentzug, Sperren/Reaktivieren, Viewer-Schreibschutz, Systemadmin-Grenzen, letzte Adminrolle und Erhalt anderer Einstellungen.

13 Benutzerprüfungen; beim damaligen Benutzerverwaltungs-Teilstand bestanden insgesamt 75 Prüfungen. Die aktuelle Gesamtsuite umfasst 103 Prüfungen (95 Node.js, acht Python), siehe [Tests](TESTS.md). Für die Browserprüfung wurden Benutzerliste und Dialog bei 320, 390, 768 und 1280 Pixeln in beiden Modi geprüft, zusätzlich Fokusführung, Escape, Feldrahmen und geschlossene Registrierung. Das ist keine vollständige Sicherheits- oder Barrierefreiheitsabnahme.
