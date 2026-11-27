# Theme-System

Stand: 06.11.2026. Diese Datei beschreibt die CSS-/Preset-Anbindung. Die aktuelle ruhige Standardgestaltung, der lesende Abgleich alter Vorgaben und das Browser-Prüfraster stehen unter [Gestaltung](THEME.md).

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

Die Live-Anwendung der Theme-Werte wird in `public/js/app.js` über `data-theme-editor` gesteuert.
Eingabefelder mit `data-theme-var` schreiben ihren Wert direkt auf `document.documentElement.style`.
Light- und Dark-Farben sind getrennt gespeichert, damit ein Preset sauber zwischen Tag und Nacht wechseln kann.

## Einstellungsnavigation

Die Docker-Vorschau vom 18.11.2026 verwendet eine gemeinsame Leiste für Einstellungen und Sicherheitsprotokoll in `views/partials/settingsTabs.ejs`. Ein Direktlink aktiviert den gewünschten Bereich vor der zuletzt im Browser gespeicherten Auswahl. Beim Tabwechsel aktualisiert die App die Adresse mit `history.replaceState`, sodass weder ein Scrollsprung noch ein weiterer Verlaufseintrag entsteht.

| Ziel | Direktlink und bisherige Aliase |
| --- | --- |
| Theme | `/einstellungen#theme`, auch `#theme-editor` |
| Projektordner | `/einstellungen#ordnerstruktur` |
| Leistungsbereiche und Formulare | `/einstellungen#leistungsbereiche`, auch `#leistungsbereiche-admin` und `#formulare` |
| Benutzerverwaltung | `/einstellungen#benutzer`, auch `#benutzerverwaltung` |
| Sicherheitsprotokoll | `/einstellungen/protokoll` |

Benutzerverwaltung und Sicherheitsprotokoll sind für Systemadmins vorgesehen. Die Protokollroute prüft die Rolle auch beim direkten Aufruf. [Browserprüfung und Bereitstellungsstand](TESTS.md)

## Presets erweitern

Presets werden in `services/settingsService.js` im Objekt `THEME_PRESETS` gepflegt.
Ein Preset sollte diese Gruppen enthalten:

- `colors`
- `shape`
- `shadow`
- `spacing`
- `typography`

Nach dem Ergänzen erscheint das Preset automatisch im Theme-Editor, weil die View `themePresets` aus dem Server-Kontext liest.

Damit Themewechsel keine Layoutsprünge erzeugen, verwenden die Default-Presets gemeinsame Werte für `shape`, `spacing` und `typography`. Das System orientiert sich farblich an GitHub-/VS-Code-Themes. Der Theme-Editor zeigt aktuell bewusst nur die wichtigsten Stellschrauben, damit die Oberfläche nicht überladen wirkt.

Aktuelle Presets:

- GitHub Light Default
- GitHub Light High Contrast
- GitHub Light Colorblind
- GitHub Dark Default
- GitHub Dark High Contrast
- GitHub Dark Colorblind
- GitHub Dark Dimmed

Weitere Presets sollten dieselben Layoutwerte nutzen und in Light/Dark visuell geprüft werden.

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

## Ruhige technische Oberfläche

Die Gestaltung verwendet feste Navigationsbezeichnungen, klare Linien-Icons,
reduzierte Schatten und eine Projektübersicht mit Erfassungsstand, nächstem
Arbeitsschritt und Detailkennzahlen. Der Erfassungsstand ersetzt keine fachliche
Prüfung. Gespeicherte Farben und Theme-Einstellungen bleiben erhalten.

`public/css/style.css` ist der zentrale Einstieg und importiert diese Bereiche
in festgelegter Reihenfolge:

| Datei unter `public/css/components/` | Aufgabe |
| --- | --- |
| `foundation.css` | Variablen, Grundlayout, Header, Anmeldung |
| `dashboard.css` | Bestehende Kennzahlen- und Workflow-Grundstile |
| `workspace.css` | Navigation im Arbeitsbereich, Formulare, Tabellen, Export |
| `modules.css` | Brandschutz, Anhänge, Einstellungen und Vorschau |
| `responsive.css` | Bestehende Anpassungen für kleine Bildschirme |
| `technical.css` | Gemeinsame technische Gestaltung, neue Übersicht und Anmeldung |

Die bestehenden Regeln wurden zunächst ohne Umordnung aufgeteilt, damit die
Reihenfolge und die fachlichen Ansichten stabil bleiben. Änderungen am neuen
Erscheinungsbild gehören in `technical.css`; Änderungen an fachlichen
Komponenten in den jeweiligen Bereich. Weitere Zusammenführungen sollten pro
Komponente mit Sichtprüfung erfolgen.

Wiederverwendbare Ansichten:

- `views/partials/head.ejs`: Metadaten, Seitentitel, Icons und Styles aller Seiten.
- `views/partials/header.ejs`: zentrale Navigation mit aktivem Bereich und Sprunglink.
- `views/partials/metricCard.ejs`: Kennzahlenkarten der Projektübersicht.
- `views/partials/authIntro.ejs`: gemeinsamer Einstieg für Anmeldung und Registrierung.

Die Navigation bleibt auf kleinen Bildschirmen horizontal scrollbar. Farben
und Status werden zusätzlich durch Text und Symbole vermittelt. Sichtbare
Tastaturfokusse und die Einstellung für reduzierte Bewegung werden berücksichtigt.

## Untermenüs für Export und Einstellungen

Die bereichsbezogene Navigation steht direkt unter dem gemeinsamen Header, als vollbreite Leiste mit dezenter Trennlinie. Automatische Außenränder zentrieren die Reitergruppe bei genügend Platz. Bei Überbreite bleiben alle Einträge über den eigenen horizontalen Scrollbereich erreichbar, ohne die ganze Seite zu verbreitern. Reiter verwenden Schriftstärke 400; aktive Auswahl und Tastaturfokus bleiben sichtbar. Die Einstellungen und das Sicherheitsprotokoll verwenden dieselbe rollenabhängige Teilvorlage. Export-, Einstellungs- und Direktlinkfunktionen bleiben erhalten.

Die kompakte Ausführung verwendet am Desktop 40 Pixel Leistenhöhe, 30 Pixel hohe Reiter und 12 Pixel Schrift. Einstellungsicons sind 14 Pixel groß. Bis 760 Pixel Bildschirmbreite bleiben 44 Pixel Leistenhöhe und 36 Pixel hohe Reiter für die Bedienung erhalten; alle Einträge sind weiterhin seitlich erreichbar.

## App-Icon

Das Hauptmotiv liegt in `public/img/icons/edoku-app-icon.svg`: ein Dokument mit
Prüfhaken auf einfarbig blauem Grund. Das Favicon in `public/favicon.svg` ist
für kleine Größen vereinfacht. `edoku-mask-icon.svg` ist die einfarbige Variante.

PNG-Ausgaben liegen in 180, 192 und 512 Pixeln vor. Apple-Touch-Icon und
maskierbare 512-Pixel-Variante haben einen vollständig deckenden Hintergrund.
Die Dateien sind über `headIcons.ejs` und `site.webmanifest` eingebunden.
Bei Änderungen an den SVG-Quellen müssen PNG-Ausgaben und Cache-Version
gemeinsam aktualisiert werden.

## Dezente Icon-Bewegungen

Interaktive Icons reagieren kurz auf Mauszeiger, Tastaturfokus und Betätigung: leichte Bewegung, dezente Drehung bei Einstellungen/Theme und ein einmaliger Impuls am Export-/Downloadpfeil. Es gibt keine Dauerschleifen. Deaktivierte Bedienelemente erhalten keine neue Bewegungsrückmeldung. Touchgeräte bekommen keine dauerhaft haftende Hover-Animation.

Die Systemeinstellung „Bewegung reduzieren“ wird respektiert: Die neuen Animationen und Transformationsübergänge sind ausschließlich bei `prefers-reduced-motion: no-preference` aktiv. Beschriftungen, Fokusmarkierungen und Bedienung bleiben erhalten.
