# Storage

Dieser Ordner ist der lokale Runtime-Speicher der Anwendung.

Hier werden beim Betrieb erzeugt:

- `app.db`
- Benutzer-Sessions
- Projekt-Metadaten
- benutzerbezogene Projektdateien
- Importe
- Exporte
- erzeugte Projektarchive

Für lokale Tests werden Benutzer automatisch in `app.db` angelegt. Die Passwörter liegen nicht im Klartext in dieser Datei, sondern als Hash/Salt-Kombination.

Diese Inhalte sollen nicht ins GitHub-Repository. Die `.gitignore` erlaubt nur diese README.
