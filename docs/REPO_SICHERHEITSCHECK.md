# Repo-Sicherheitscheck

Stand: 2026-10-30

Diese Notiz dokumentiert den aktuellen Check, ob versehentlich sensible oder lokale Laufzeitdaten im Git-Repository landen.

## Ergebnis

Die Veröffentlichung umfasst Quellcode, neutrale Grafiken, Tests und Dokumentation.
Die beiden lokalen Änderungen an `config/systemEinstellungen.json` und
`config/geraetelistenVorlagen.json` bleiben außerhalb des Commits. Private
Sicherungen, Datenbanken, Sitzungen, Projektdateien und vorhandene Exporte werden
nicht hinzugefügt. Die Prüfung des Commit-Inhalts ist kein vollständiger
historischer Secret-Scan und keine Sicherheitsfreigabe der Anwendung.

## Geprüfte Risikobereiche

- Secrets und Tokens
- private Schlüssel
- `.env`-Dateien
- Runtime-Speicher unter `storage/`
- Exportausgaben unter `output/`
- interne Tagesupdates unter `intern/`
- lokale Systemkonfigurationen unter `config/`
- echte Namen beziehungsweise nicht neutrale Demo-Daten

## Auffälligkeiten

### Lokale Demo-Zugänge

`INSTALL.md` enthält bewusst lokale Demo-Zugänge für Entwicklung und Beta-Tests. Diese Daten sind keine produktiven Passwörter, dürfen aber bei öffentlich erreichbaren Installationen nicht aktiv bleiben.

Empfehlung:

- Nach dem ersten Serverstart eigene Konten anlegen.
- Demo-Zugänge ändern, sperren oder entfernen.
- Installation nie mit unveränderten Demo-Zugängen öffentlich betreiben.

### Getrackte Konfigurationsdateien

Folgende Dateien sind aktuell versioniert:

- `config/systemEinstellungen.json`
- `config/geraetelistenVorlagen.json`

Diese Dateien enthalten derzeit keine erkannten Secrets. Sie können aber lokale UI-, Logo- oder Vorlagenwerte aufnehmen. Lokale Änderungen daran sollten vor einem Push immer geprüft werden.

Empfehlung:

- Für echte Installationen bevorzugt neutrale `.example.json`-Dateien als Vorlage verwenden.
- Lokale Runtime-Anpassungen nicht ungeprüft committen.
- Bei späterer Produktivisierung entscheiden, ob diese Dateien weiter versioniert bleiben oder als lokale Runtime-Konfiguration behandelt werden.

## Gitignore-Stand

Aktuell ausgeschlossen:

- `node_modules/`
- `.env`
- `.env.*`
- `output/`
- `storage/*` mit Ausnahme von `storage/README.md`
- `intern/`
- `backups/` (auch vom Docker-Build ausgeschlossen)
- Logs und temporäre Dateien

## Vor Push prüfen

Empfohlene Kurzprüfung:

```bash
git status --short
git ls-files | rg '^(storage/|intern/|output/|\\.env)'
rg -n "(PRIVATE KEY|BEGIN RSA|github_pat_|ghp_|sk-|API_KEY|SECRET|DATABASE_URL)" --glob '!node_modules/**' --glob '!storage/**' --glob '!output/**' --glob '!intern/**' --glob '!backups/**'
```
