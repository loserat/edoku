# Theme-System

Das Theme-System steuert die zentrale Optik von edoku über CSS-Variablen.
Die Werte werden in `config/systemEinstellungen.json` im Objekt `theme` gespeichert.

## Laden des aktiven Themes

Beim Rendern der Seiten wird `systemSettings.theme` global an die Views übergeben.
`views/partials/themeVariables.ejs` schreibt daraus ein `<style>`-Element mit CSS-Variablen.
Diese Variablen gelten für Header, Navigation, Karten, Formulare, Buttons, Tabellen und Hinweise.

Der Browser speichert den zuletzt gewählten Modus zusätzlich in `localStorage` unter `dm-theme`.
Wenn kein Browserwert vorhanden ist, wird der Theme-Modus aus den Systemeinstellungen verwendet.

## Zentrale Variablen

Neue Komponenten sollten bevorzugt diese Variablen nutzen:

- `--color-bg`
- `--color-bg-light`
- `--color-bg-dark`
- `--color-surface`
- `--color-surface-muted`
- `--color-surface-dark`
- `--color-surface-muted-dark`
- `--color-text`
- `--color-text-muted`
- `--color-text-dark`
- `--color-text-muted-dark`
- `--color-border`
- `--color-border-dark`
- `--color-primary`
- `--color-primary-hover`
- `--color-button-primary`
- `--color-button-secondary`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--on-primary`
- `--on-danger`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`
- `--radius-button`
- `--border-width`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--spacing-xs`
- `--spacing-sm`
- `--spacing-md`
- `--spacing-lg`
- `--spacing-xl`
- `--page-spacing`
- `--card-spacing`
- `--form-spacing`
- `--table-row-height`
- `--font-size-base`
- `--font-size-sm`
- `--font-size-lg`
- `--font-size-heading`
- `--font-size-label`
- `--font-size-button`
- `--line-height-base`

Bestehende Variablen wie `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--primary`, `--accent` bleiben als Alias bestehen.

## Theme-Editor

Der Editor liegt unter `System` beziehungsweise `/einstellungen` im Tab `Theme`.
Er speichert über `POST /einstellungen/theme` und setzt über `POST /einstellungen/theme/defaults` auf das Standard-Theme zurück.

Die Tabs der Einstellungsseite werden clientseitig über `data-settings-tab` und `data-settings-panel` geschaltet.
Dabei wird kein URL-Hash gesetzt, damit die Seite nicht scrollt und kein Verlaufseintrag entsteht.

Die Live-Anwendung der Theme-Werte wird in `public/js/app.js` über `data-theme-editor` gesteuert.
Eingabefelder mit `data-theme-var` schreiben ihren Wert direkt auf `document.documentElement.style`.
Light- und Dark-Farben sind getrennt gespeichert, damit ein Preset sauber zwischen Tag und Nacht wechseln kann.

## Presets erweitern

Presets werden in `services/settingsService.js` im Objekt `THEME_PRESETS` gepflegt.
Ein Preset sollte diese Gruppen enthalten:

- `colors`
- `shape`
- `shadow`
- `spacing`
- `typography`

Nach dem Ergänzen erscheint das Preset automatisch im Theme-Editor, weil die View `themePresets` aus dem Server-Kontext liest.

Damit Themewechsel keine Layoutsprünge erzeugen, verwenden die Default-Presets gemeinsame Werte für `shape`, `spacing` und `typography`. Aktuell wird das System bewusst auf Light/Dark beschränkt und orientiert sich farblich an GitHub-/VS-Code-Themes. Anpassungen an Radien, Abständen oder Schriftgrößen sind weiterhin im Theme-Editor möglich, sollten aber bewusst erfolgen.

Aktuelle Presets:

- GitHub Light
- GitHub Dark

Weitere Presets sollten erst wieder ergänzt werden, wenn sie dieselben Layoutwerte nutzen und in Light/Dark visuell geprüft sind.

## Neue Komponenten anbinden

Neue UI-Komponenten sollten keine festen Farben oder Radien verwenden.
Stattdessen:

```css
.neue-komponente {
  background: var(--panel);
  border: var(--border-width) solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  color: var(--text);
  padding: var(--card-spacing);
}
```

Damit reagieren Komponenten automatisch auf Presets, Light/Dark Mode und spätere Theme-Änderungen.
