# Setlist — workout log (personal, shared with friends)

An installable web app (PWA): plain HTML/CSS/JS, **no build step, no server, no accounts**. It replaces the
Workouts half of the old Health Dashboard that ran inside Muse. Folder: `~/Projects/personal/workout-health`.

## The rules that matter
- **No one's workout history goes in the code.** Each person's log lives only in their own phone's browser
  storage (IndexedDB, database name `setlist`). `js/lib.js` holds only the generic exercise list and routine
  templates. Jeremy's history arrives by importing his export file inside the app.
- **`reference/` is private and gitignored**: Jeremy's exports (`workout-tracker-data-export.json`,
  `workout-tracker-hevy-export.csv`) and the old app's guide. Never commit or publish it. `.gitignore` also
  blocks `*.csv`, `*-export.json` and `setlist-backup-*.json` anywhere in the folder.
- Friends-only, no $99 Apple fee: that is why it is a PWA (Add to Home Screen) and not an App Store app.
  A real iOS app without the fee can't be shared (7-day personal installs only). Don't propose it again.
- Not published yet (2026-11-15). Publishing = public GitHub repo + GitHub Pages under `cafe100Elm`.
  Show Jeremy what will go up and get his OK first.

## How it's put together
- `index.html` — shell. `css/app.css` — all styling. `sw.js` — offline copy of the app files. `manifest.webmanifest` + `icons/` — install info.
- `js/store.js` storage · `js/lib.js` exercises, templates, name-guessing · `js/stats.js` every calculation ·
  `js/io.js` import/export · `js/core.js` frame, sheets, number pad, rest timer, theme · `js/workout.js` workout rules ·
  one file per screen: `home`, `log`, `library` (+ `exercises`), `insights`, `history`, `settings` · `js/share.js` · `js/charts.js`.
- All paths are relative, so it works from a sub-folder URL (GitHub Pages) as well as a domain root.
- A workout = `{id, title, notes, start, end, exercises:[{exId, name, sets:[{w, r, t, d, done, kind}]}]}`.
  `w` lb, `r` reps, `t` seconds (cardio shows minutes but stores seconds), `d` miles, `end: null` = in progress.
- Exercise "type" decides the set columns: `wr` weight+reps, `r` reps, `t` seconds, `c` miles+minutes, `wd` weight+distance.

## Gotchas
- **Adding a JS/CSS/icon file? Add it to the `SHELL` list in `sw.js`** or it won't work offline.
- Updates reach phones automatically: each open re-checks files in the background; the new version shows on
  the *next* open. No version number to bump. (Bump `CACHE` in `sw.js` only to force-clear everything.)
- Imports only add. Duplicates are matched on title + start minute, so re-importing is safe.
- Imported exercises match built-ins by exact name or a listed alias (`aka` in `js/lib.js`); anything else
  becomes a custom exercise. Similar-but-different machines are deliberately *not* merged
  (e.g. "Lat Pulldown (Machine)" stays separate from "Lat Pulldown").
- The rest timer sits at the bottom on purpose: at the top it pushed the page down right after tapping ✓.
- iPhone: no vibration, and the timer can't beep while the phone is locked (web-app limits). Data is erased
  if the home-screen icon is deleted, hence the backup reminder on Home.
- Service workers don't register in the Claude desktop preview pane; test offline in real Chrome.
- Dark mode follows the house standard (`data-theme="dark"`, key `setlist-theme`, light by default). The rest
  of the design is deliberately its own (Jeremy: "don't constrain yourself to my other app designs").

## Run / test
- Preview: `.claude/launch.json` → "setlist" (python static server). Or `python3 -m http.server 8791` and open http://localhost:8791.
- To load Jeremy's history in a test browser: Settings (gear) → Import workouts → pick the JSON in `reference/`.
  Expected: 220 workouts, 4,245 sets. Wipe it afterwards (Settings → Erase everything).

## Not built (ideas, only if asked)
- Daily calorie/weight half of the old Health Dashboard (left out on purpose; the import skips those rows).
- Sync between devices (would need accounts + a database; today it's backup file out, import in).
- kg / km display.
