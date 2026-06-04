# GitHub-Checkliste Beta

## Vor dem ersten Beta-Commit prüfen

- `docker compose up --build` startet ohne Fehler.
- Registrierung und Login funktionieren.
- Geschützte Seiten leiten ohne Login zu `/login`.
- Projektseiten sind nach Login erreichbar.
- Keine lokalen Datenbanken werden committet.
- Keine Exportordner werden committet.
- Keine internen Tagesnotizen werden committet.
- Keine `.env`-Dateien werden committet.
- `README.md` beschreibt den Beta-Status klar.
- `docs/TECHNIK.md` ist vorhanden.

## Dateien, die ins Repository gehören

- `server.js`
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.gitignore`
- `README.md`
- `services/`
- `views/`
- `public/`
- `config/`
- `data/` als Version-1-Startdaten und Konfiguration
- `templates/`
- `docs/`
- `intern/tagesupdates/README.md`

## Dateien und Ordner, die nicht ins Repository gehören

- `node_modules/`
- `output/`
- `storage/app.db`
- `storage/app.db-*`
- `storage/exports/`
- `storage/imports/`
- `storage/users/`
- `intern/tagesupdates/*.md`
- `.env`
- `.DS_Store`

## Empfohlener Ablauf

```bash
git init
git remote add origin https://github.com/loserat/edoku.git
git status
git add .
git status
git commit -m "Beta-Version edoku"
git branch -M main
git push -u origin main
```

Wenn das Remote-Repository bereits Dateien enthält, zuerst `git pull origin main --allow-unrelated-histories` prüfen und Konflikte bewusst lösen.
