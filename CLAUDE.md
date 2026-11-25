# Setlist — workout log (personal, shared with friends)

An installable web app (PWA): plain HTML/CSS/JS, **no build step, no server, no account needed** (optional sync,
below, is the one exception and is off unless someone signs in). It replaces the
Workouts half of the old Health Dashboard that ran inside Muse. Folder: `~/Projects/personal/workout-health`.

## The rules that matter
- **No one's workout history goes in the code.** Each person's log lives only in their own phone's browser
  storage (IndexedDB, database name `setlist`), plus their own private cloud space if they turned on sync. `js/lib.js` holds only the generic exercise list and routine
  templates. Jeremy's history arrives by importing his export file inside the app.
- **`reference/` is private and gitignored**: Jeremy's exports (`workout-tracker-data-export.json`,
  `workout-tracker-hevy-export.csv`) and the old app's guide. Never commit or publish it. `.gitignore` also
  blocks `*.csv`, `*-export.json` and `setlist-backup-*.json` anywhere in the folder.
- Friends-only, no $99 Apple fee: that is why it is a PWA (Add to Home Screen) and not an App Store app.
  A real iOS app without the fee can't be shared (7-day personal installs only). Don't propose it again.
- **Live at https://cafe100elm.github.io/setlist/** (published 2026-11-15). Repo: https://github.com/cafe100Elm/setlist
  (public; GitHub Pages serves the `main` branch root, no build). **A push to `main` goes live to Jeremy's and his
  friends' phones within a minute or two**, so show Jeremy the change and get his OK before pushing.
- The repo is public: keep personal details out of every committed file. Commits in this folder use the GitHub
  no-reply address (set in this repo's git config), not Jeremy's email.

## How it's put together
- `index.html` — shell. `css/app.css` — all styling. `sw.js` — offline copy of the app files. `manifest.webmanifest` + `icons/` — install info.
- `js/store.js` storage · `js/lib.js` exercises, templates, name-guessing · `js/stats.js` every calculation ·
  `js/io.js` import/export · `js/core.js` frame, sheets, number pad, rest timer, theme · `js/workout.js` workout rules ·
  one file per screen: `home`, `log`, `library` (+ `exercises`, `plans`), `insights`, `history`, `settings` · `js/share.js` · `js/charts.js` ·
  `js/coach.js` (time estimates + what-to-aim-for) · `js/tour.js` (the built-in walkthrough) ·
  `js/sync.js` (optional sync: what to send, what to accept, merging) · `js/cloud.js` (the only file that talks to
  Firebase) · `js/firebase-config.js` · `firebase/` (database rules; not part of the app).
- All paths are relative, so it works from a sub-folder URL (GitHub Pages) as well as a domain root.
- A workout = `{id, title, notes, start, end, exercises:[{exId, name, sets:[{w, r, t, d, done, kind}]}]}`.
  `w` lb, `r` reps, `t` seconds (cardio shows minutes but stores seconds), `d` miles, `end: null` = in progress.
- Exercise "type" decides the set columns: `wr` weight+reps, `r` reps, `t` seconds, `c` miles+minutes, `wd` weight+distance,
  `tm` minutes only (added for "Matt", Jeremy's name for his mat routine: he only wants time spent).
- **Plans** (Library → Plans, added 2026-11-25): `PLANS` in `js/lib.js` are repeating day cycles built from the routine
  templates. Following one saves `settings.plan = { id, start }`; `js/plans.js` draws the flow diagram, the month
  calendar (✓ = a workout was logged that day) and Home's "Today" card. Dates come from day 1, not weekdays.
  "Push back 1 day" just moves `start`. Plans from a person's own routines are not built yet.

## Coach, time estimates, tour (added 2026-11-25)
- **No AI, on purpose.** Jeremy asked for coaching "with AI if it needs it"; it doesn't. Everything is worked out on
  the phone from the person's own log, so it works offline, costs nothing and no data leaves the device. A static
  site also can't hold an API key safely. Only revisit if he asks for free-form advice (the pattern would be Pip's relay).
- **Time** (`stats.js` `pace()` / `estimate()`): a person's pace = median seconds per ordinary set across their last 40
  finished workouts (rest and changeovers included; Jeremy's is ~100 s). Timed sets (cardio, Matt, holds) count as the
  time they say. Under 5 workouts it falls back to rest setting + 50 s. `settings.budget` = session time target in
  minutes (Jeremy trains M/W/F 6:30 am and wants to finish in 45 including cardio). Routine cards show "≈ N min · fits
  your 45"; a live workout shows "About N min left · on track for …".
- **Coach** (`coach.js` `coach()`), per set: reached the usual reps → next weight up; fell short → same weight, one
  more rep. `settings.coach`: `steady` (default: go up after hitting the reps two sessions running), `fast` (after
  one), `off`. "Next weight up" = the next heavier weight the person has already used on that exercise (matches their
  machine), else +2.5 / 5 / 10 by size. Shown as the "Aim" strip in a live workout (Use fills the sets; nothing is
  changed silently), on the finish sheet ("What to aim for next time") and in exercise details.
- **Tour** (`tour.js`): ten steps, pictures built from the app's own CSS classes with sample numbers. Opens from
  Settings → How to use Setlist, and once from a Home card (`settings.tourSeen`). **When a feature changes how the
  app is used, update the matching tour step in the same change.** Jeremy preferred this over a YouTube video.

## Sync across devices (added 2026-11-25, optional, invite-only)
- Jeremy wanted his Android phone and iPad to hold the same log. Settings → Sync across devices → Sign in with
  Google on each device. Never signed in = exactly the old app: Google's code isn't even downloaded.
- Firebase project **`setlist-log-sync`** on Jeremy's personal Google account (free plan): Google sign-in + Firestore.
  Layout: `users/{uid}/workouts|routines|custom/{id}` and `users/{uid}/settings/main`, each `{u, del, d, s}`
  (`u` = when it changed on a device, `del` = deleted marker, `d` = the item as JSON text, `s` = server time).
- **Who may sync** is the email list in the Firestore document `config/access` → `emails` (only Jeremy today; he chose
  "just me" on 2026-11-25). To let a friend sync, add their Google email there in the Firebase console; no code
  change. The list lives in the database so no address is in this public repo. Anyone else who signs in is told
  sync is by invitation and nothing changes for them.
- The phone's own database stays the one the screens read. `store.js` stamps every save with `u` and tells
  `sync.js`, which keeps a saved "to send" list (`state.sync.out`), so offline changes go up later. Newest `u` wins.
  It always listens before it sends. Deletes are remembered (`state.sync.dead`) so an offline device can't bring
  one back. Sync bookkeeping is in IndexedDB `kv` → `sync`.
- **Twins:** two devices that each imported the same history have the same workouts under different ids. On sync
  they are matched (workouts: title + start minute; routines: name + exercise names; custom exercises: name) and
  merged, and workouts are re-pointed at the exercise that was kept. Don't remove this: without it a second
  device doubles the log.
- Not synced on purpose: backup date and reminder, theme. A workout in progress does sync (it appears as live on
  the other device).
- "Erase everything" signs the device out first and leaves the cloud copy alone. There is no in-app way to delete
  the cloud copy; do it in the Firebase console if ever needed.
- Sign-in opens Google's small window; if the browser blocks it the button turns into "Continue with Google"
  (second tap works). Going to Google's page and back is only a last resort: it is unreliable on Safari because the
  app (github.io) and the sign-in address (firebaseapp.com) are different sites.
- Rules: edit `firebase/firestore.rules`, then `cd firebase && npx -y firebase-tools@latest deploy --only firestore:rules`
  (`firebase login:list` must show Jeremy's personal account). Allowed sign-in addresses (Firebase console →
  Authentication → Settings): `cafe100elm.github.io`, `localhost`, `127.0.0.1`.
- "Newest wins" is per whole item: if the same workout is edited on both devices before they sync, the later
  edit replaces the earlier one entirely (it does not blend the two).
- `js/sync.js`, `js/cloud.js` and `js/firebase-config.js` **must be in `sw.js` `SHELL`**: `app.js` imports them at
  start-up, so if they aren't saved for offline the whole app fails to open without a signal.
- Verified 2026-11-25 with two signed-in browser tabs against the real project: new workout, ticked sets, finish,
  edit and delete carried over in seconds; changes made with no connection were sent after reopening; 220 made-up
  workouts imported on both under different ids merged to one set. Test data was then removed from the cloud.
- Testing without two real devices: `localhost:8817` and `127.0.0.1:8817` are separate "devices" to the browser
  (separate storage and sign-in), so two tabs give a two-device test.

## Gotchas
- **Adding a JS/CSS/icon file? Add it to the `SHELL` list in `sw.js`** or it won't work offline (files not in the
  list are never saved on the device).
- Updates reach phones automatically and are **all-or-nothing**: the app opens from its saved copy; a few seconds
  later the helper downloads every `SHELL` file and swaps them in together only if all arrive. The new version shows
  on the *next* open. No version number to bump. (Before 2026-11-25 files refreshed one by one, and an interrupted
  refresh could leave a half-old, half-new app that opened blank once. Don't go back to that.)
- To rehearse an update: serve a `git archive` of the old commit from a scratch folder, open it in headless Chrome,
  swap the new files in, reopen twice, then reopen offline. The helper re-checks at most once a minute.
- Imports only add. Duplicates are matched on title + start minute, so re-importing is safe.
- Imported exercises match built-ins by exact name or a listed alias (`aka` in `js/lib.js`); anything else
  becomes a custom exercise. Similar-but-different machines are deliberately *not* merged
  (e.g. "Lat Pulldown (Machine)" stays separate from "Lat Pulldown").
- The rest timer sits at the bottom on purpose: at the top it pushed the page down right after tapping ✓.
- iPhone: no vibration, and the timer can't beep while the phone is locked (web-app limits). Data is erased
  if the home-screen icon is deleted, hence the backup reminder on Home.
- The preview pane now runs the service worker, so after an edit the **first reload still shows the old files**;
  reload twice. Offline behaviour is still best checked in real Chrome.
- The local preview uses port 8817 (8791 collided with another project's cached page in the pane).
- Theme follows the house standard: one header button cycles Light → Dark → System (sun / moon / screen icon = the
  current setting); System follows the phone live. `data-theme="dark"` on `<html>`, key `setlist-theme` = light | dark |
  system, light by default. `index.html`'s head script paints it first; `js/core.js` (Theme) owns the cycle and the live
  device listener (added 2026-11-20). The button stays 42px to match the gear beside it. The rest
  of the design is deliberately its own (Jeremy: "don't constrain yourself to my other app designs").

## Deploy
- `git push` to `main`. That's all. Check https://cafe100elm.github.io/setlist/ a minute later.
- Before any commit: `git status` must not list anything from `reference/`.

## Run / test
- Preview: `.claude/launch.json` → "setlist" (python static server). Or `python3 -m http.server 8817` and open http://localhost:8817.
- To load Jeremy's history in a test browser: Settings (gear) → Import workouts → pick the JSON in `reference/`.
  Expected: 220 workouts, 4,245 sets. Wipe it afterwards (Settings → Erase everything).

## Not built (ideas, only if asked)
- Daily calorie/weight half of the old Health Dashboard (left out on purpose; the import skips those rows).
- Sync for friends (add their email to `config/access`; see Sync above) and deleting the cloud copy from inside the app.
- kg / km display.
- Build-your-own plans (a weekly schedule from saved routines).
