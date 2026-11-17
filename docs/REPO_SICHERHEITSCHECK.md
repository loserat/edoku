# Repository und private Daten

Stand: 17.11.2026. Diese Anleitung beschreibt die Veröffentlichungskontrolle. Der geprüfte Programmstand liegt auf `gm/coolify-test-20261117`. Neue Dokumentationsdateien und Screenshots werden gesondert geprüft; eine Veröffentlichung ist kein neuer Release und kein vollständiger historischer Secret-Scan.

## Was veröffentlicht werden darf

Quellcode, Tests, neutrale Grafiken, Beispielvorlagen und allgemeine Dokumentation. Die aktuellen Screenshots vom 17.11.2026 stammen ausschließlich aus einem künstlichen Projekt der getrennten Online-Testinstanz. Ältere Aufnahmen stammen aus einer getrennten lokalen Demo-Installation. Keine echten Projekte, Anmeldewerte oder Verwaltungsoberflächen veröffentlichen. Den tatsächlichen Stand vor jedem Commit prüfen; Dateinamen und Ignore-Regeln allein sind kein Inhaltsnachweis.

Private Datenbanken, Passwortdaten, Sitzungen, echte Projektdateien, vorhandene Exporte, Sicherungen und detaillierte Prüfnachweise bleiben lokal. Das gilt auch für komprimierte Testkopien, Sicherungsmanifeste, Containerkonfigurationen und Programmabbilder. Sie können vertrauliche Inhalte enthalten.

## Versionierte Konfiguration

`config/systemEinstellungen.json` und `config/geraetelistenVorlagen.json` sind bereits versioniert und lokal geändert. Sie gehören deshalb nicht automatisch in einen Commit. Für öffentliche Ausgangswerte die neutralen Beispielvorlagen verwenden; lokale UI-, Logo-, Pfad- oder Vorlagenwerte vor Veröffentlichung gesondert prüfen. Ein Ignore-Eintrag entfernt bereits versionierte Dateien nicht.

## Startkonten

[INSTALL.md](../INSTALL.md) beschreibt die Einrichtung eines eigenen Erstzugangs. Klartext-Zugangslisten werden in der neuen Dokumentation nicht veröffentlicht. Das bisherige Demo-Verhalten bleibt im Programm kompatibel; die reine Dokumentationsänderung entfernt keine vorhandenen Konten. Bei öffentlich erreichbaren Installationen bekannte Startpasswörter ändern und nicht benötigte Konten sperren. Bestehende Konten werden beim Update weder zurückgesetzt noch automatisch entfernt. Die Selbstregistrierung ist standardmäßig geschlossen; sie ersetzt keine Prüfung der Startkonten.

## Ausgeschlossene Bereiche

Git schließt insbesondere `node_modules/`, private Inhalte von `storage/`, `output/`, `intern/`, `backups/`, `.env` und Logs aus. `storage/README.md` ist die vorgesehene Ausnahme. Docker schließt Datenbanken, Laufzeitablagen, `intern/`, `backups/` und Umgebungsdateien vom Build-Kontext aus.

Bereits versionierte `data/`, `config/` und `templates/` können trotzdem Teil eines Docker-Builds werden. Öffentliche Abbild- und Testbauten deshalb aus einem sauberen Checkout mit neutralen Ausgangsdaten erstellen; keine lokale Installation mit privaten Vorlagen blind als veröffentlichbares Abbild bauen.

## Vor einem Commit oder Push

```bash
git status --short
git diff --cached --name-only
git ls-files | rg '^(storage/|intern/|output/|backups/|\.env)'
```

Die erwartete Ausnahme `storage/README.md` ist zulässig. Alle tatsächlich ausgewählten Dateien auf Inhalt prüfen. Eine ergänzende Suche kann zunächst nur Dateinamen ausgeben, ohne mögliche Geheimnisse in Logs zu drucken:

```bash
rg -l '(PRIVATE KEY|github_pat_|ghp_|sk-proj-|API_KEY|SECRET|DATABASE_URL)' --glob '!node_modules/**' --glob '!storage/**' --glob '!output/**' --glob '!intern/**' --glob '!backups/**' --glob '!config/**'
```

Treffer können Dokumentationsbeispiele oder Codebezeichner sein und müssen bewertet werden. Keine ungeprüfte automatische Löschung. Eine heuristische Suche ersetzt keinen vollständigen Secret-Scan. Nach einer Veröffentlichung den konkreten Commit, CI-Lauf und gegebenenfalls Release separat prüfen; ein lokal bestandener Test belegt keinen GitHub-Push.
