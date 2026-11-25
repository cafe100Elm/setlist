// Settings & data: installing, sharing the app, backups, imports, preferences.
import { state, wipe, saveSettings } from './store.js';
import { ui, on, onChange, openSheet, closeSheet, topSheet, render, go, toast, confirmBox, setSetting, syncWake, icons } from './core.js';
import { importFile, makeBackup, makeCSV } from './io.js';
import { paceNote } from './coach.js';
import { openTour } from './tour.js';
import { saveFile, shareApp, copyText, appUrl } from './share.js';
import { syncInfo, signIn, signOutSync, syncNow } from './sync.js';
import { esc, num, fmtDate, plural, isIOS, isAndroid, isStandalone, clock } from './util.js';

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => { installEvent = null; toast('Setlist is installed'); });

const stamp = () => new Date().toISOString().slice(0, 10);

function installHelp() {
  if (isStandalone()) return `<p class="ok">✓ Setlist is installed on this device.</p>`;
  const ios = `<ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button ${icons.share} (bottom of the screen on iPhone).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>`;
  const android = `<ol class="steps"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu (top right).</li><li>Tap <b>Add to Home screen</b> or <b>Install app</b>, then <b>Install</b>.</li></ol>`;
  let h = '';
  if (installEvent) h += `<button class="btn primary big" data-a="install">Install Setlist</button>`;
  if (isIOS()) h += ios;
  else if (isAndroid()) h += installEvent ? '' : android;
  else h += `${installEvent ? '' : '<p class="muted">On a computer, look for the install icon at the right of the address bar (Chrome or Edge).</p>'}<div class="sub-h">iPhone or iPad</div>${ios}<div class="sub-h">Android</div>${android}`;
  h += `<p class="muted">No app store, no account and no fee. Once installed it opens full screen and works without a signal.</p>`;
  return h;
}

// "today at 9:41 AM", "yesterday at …", or a date
function when(ts) {
  const d = new Date(ts), t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
  return days === 0 ? `today at ${t}` : days === 1 ? `yesterday at ${t}` : `${fmtDate(ts, { year: true })} at ${t}`;
}

// Sync across devices: optional, and nothing here runs until someone taps Sign in.
function syncSection() {
  const y = syncInfo();
  if (!y.available) return '';
  const msg = y.note ? `<p class="sync-note">${esc(y.note)}</p>` : '';
  let h = `<section id="sec-sync"><h4>Sync across devices</h4>`;
  if (!y.on && !y.wait) {
    const busy = y.phase === 'starting';
    h += `<p class="muted">Optional. Sign in with Google on each of your devices and your log, routines and settings stay the same on all of them. Skip it and nothing leaves this device.</p>
      ${msg}
      <button class="btn big" data-a="sync-in"${busy ? ' disabled' : ''}>${busy ? 'Connecting…' : y.phase === 'tap' ? 'Continue with Google' : 'Sign in with Google'}</button>
      <p class="muted small">A private copy of your log is kept in the cloud under your Google account. Only you can open it, apart from the recent workouts you let approved followers see (Friends). Sync starts once a friend who already uses it accepts your request to follow them.</p>`;
  } else if (y.wait) {
    h += `<p class="muted">Signed in as <b>${esc(y.email || 'your Google account')}</b>.</p>
      <p class="sync-note">${y.phase === 'signin' ? 'This device needs you to sign in again.' : 'Sync starts by itself as soon as a friend who uses Setlist accepts your request to follow them. Until then your log stays only on this device.'}</p>${msg}
      <div class="row">${y.phase === 'signin' ? '<button class="btn primary grow" data-a="sync-in">Sign in again</button>' : '<button class="btn primary grow" data-a="friends">Open Friends</button>'}<button class="btn" data-a="sync-out">Sign out</button></div>`;
  } else {
    const n = y.pending;
    let line;
    if (y.phase === 'signin') line = `<p class="sync-note">This device needs you to sign in again to keep syncing.</p>`;
    else if (!y.online || y.phase === 'offline') line = `<p class="muted"><b>No connection.</b> ${n ? `${plural(n, 'change')} will be sent when you're back online.` : "It will catch up when you're back online."}</p>`;
    else if (y.phase === 'error') line = '';
    else if (y.phase !== 'live') line = `<p class="muted">Checking for changes…</p>`;
    else if (n) line = `<p class="muted">Sending ${plural(n, 'change')}…</p>`;
    else line = `<p class="ok">✓ Up to date</p>`;
    h += `<p class="muted">On for <b>${esc(y.email || 'your Google account')}</b>. Changes made here appear on your other devices within a minute, and theirs appear here.</p>
      ${line}${msg}
      <p class="muted">${y.last ? `Last synced ${when(y.last)}.` : 'Not synced yet.'}</p>
      <div class="row">${y.phase === 'signin' ? '<button class="btn primary grow" data-a="sync-in">Sign in again</button>' : '<button class="btn grow" data-a="sync-now">Sync now</button>'}<button class="btn" data-a="sync-out">Sign out</button></div>`;
  }
  return h + `</section>`;
}

function body() {
  const s = state.settings;
  const n = state.workouts.length;
  const sel = (key, opts) => `<select data-c="set" data-k="${key}">${opts.map(([v, l]) => `<option value="${v}"${String(s[key]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const tog = (key, label, sub) => `<label class="toggle"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-c="tog" data-k="${key}"${s[key] ? ' checked' : ''}><i></i></label>`;
  return `
    <div class="sheet-top"><div class="sheet-head"><h3>Settings &amp; data</h3><button class="btn sm" data-a="sheet-close">Done</button></div></div>
    <div class="sheet-scroll settings">
      <section><h4>How to use Setlist</h4><p class="muted">A two-minute walkthrough of logging, the coach, time targets, plans and backups.</p><button class="btn primary big" data-a="tour-open">Take the tour</button></section>

      <section id="sec-install"><h4>Install on your phone</h4>${installHelp()}</section>

      <section><h4>Share Setlist with a friend</h4>
        <p class="muted">Send them the link. They install it the same way and get their own empty log: nothing of yours goes with it.</p>
        <div class="row"><button class="btn primary grow" data-a="share-app">${icons.share}Share the link</button><button class="btn" data-a="copy-link">Copy link</button></div>
        ${syncInfo().available ? `<p class="muted">Want to see each other's workouts? Open <b>Friends</b> (the people button at the top) to send an invite to follow you.</p><button class="btn big" data-a="friends">${icons.people}Friends</button>` : ''}
      </section>

      ${syncSection()}

      <section><h4>Your data</h4>
        <p class="muted">${n ? `${plural(n, 'workout')} saved on this device.` : 'Nothing logged yet.'} ${state.sync.on ? 'Sync keeps your devices the same; a backup file is still worth saving now and then as a spare copy.' : 'Your log stays on this phone and is never uploaded. A backup file is how you keep a copy or move to a new phone.'}</p>
        <p class="muted">${s.lastBackup ? `Last backup: ${fmtDate(s.lastBackup, { year: true })}.` : 'No backup saved yet.'}</p>
        <div class="stack">
          <button class="btn primary big" data-a="backup"${n ? '' : ' disabled'}>Save a backup file</button>
          <button class="btn big" data-a="export-csv"${n ? '' : ' disabled'}>Export as a spreadsheet (CSV)</button>
          <button class="btn big" data-a="import-pick">Import workouts…</button>
        </div>
        <p class="muted small">Import accepts a Setlist backup, a Hevy export (CSV), or a Health Dashboard export (JSON). Workouts already in your log are skipped, so importing the same file twice is safe.</p>
      </section>

      <section><h4>Preferences</h4>
        <label class="fld inline"><span>Rest after a set</span>${sel('rest', [[0, 'Off'], [30, '0:30'], [45, '0:45'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']])}</label>
        <label class="fld inline"><span>Rest after yoga / mobility</span>${sel('restYoga', [[0, 'Off'], [15, '0:15'], [30, '0:30'], [60, '1:00']])}</label>
        <label class="fld inline"><span>Session time target</span>${sel('budget', [[0, 'None'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '60 min'], [75, '75 min'], [90, '90 min']])}</label>
        <p class="muted small">Routines show whether they fit, and a workout in progress shows whether you're on track. ${paceNote()}</p>
        <label class="fld inline"><span>Coach</span><select data-c="set-str" data-k="coach">${[['steady', 'Steady'], ['fast', 'Faster'], ['off', 'Off']].map(([v, l]) => `<option value="${v}"${(s.coach || 'steady') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <p class="muted small">The coach suggests what to aim for on each set. Steady raises the weight after you hit your reps two sessions running; Faster after one.</p>
        ${tog('sound', 'Sound when rest ends', 'Three short beeps (and a buzz on Android)')}
        ${tog('awake', 'Keep the screen on', 'While a workout is in progress')}
      </section>

      <section><h4>Start over</h4>
        <p class="muted">Erases every workout, routine and custom exercise from this device.</p>
        <button class="btn danger-text" data-a="wipe">Erase everything on this device</button>
      </section>
      <p class="muted small center">Setlist · weights in pounds, distances in miles</p>
    </div>`;
}

export function openSettings(section) {
  openSheet({ cls: 'tall', html: body() });
  if (section) setTimeout(() => { const el = document.getElementById('sec-' + section); if (el) el.scrollIntoView(); }, 60);
}
export const refreshSettings = () => refresh();
const refresh = () => { const s = topSheet(); if (s && s.body.querySelector('.settings')) { const y = s.body.querySelector('.sheet-scroll').scrollTop; s.set(body()); s.body.querySelector('.sheet-scroll').scrollTop = y; } };

on('settings', (el) => openSettings(el.dataset.sec));
on('tour-open', () => { closeSheet(); openTour(); });
on('install', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  refresh();
});
on('sync-in', () => { signIn(); });
on('sync-now', () => { syncNow(); toast('Checking for changes…'); });
on('sync-out', async () => {
  const y = syncInfo();
  const body = `${y.pending ? `${plural(y.pending, 'change')} from this device ${y.pending === 1 ? "hasn't" : "haven't"} been sent yet and won't be. ` : ''}Your log stays on this device, and the copy in the cloud stays as it is. Friends won't show on this device until you sign in again; who you follow and who follows you is kept. Sign in again any time to pick up where you left off.`;
  if (!(await confirmBox({ title: 'Sign out on this device?', body, ok: 'Sign out', cancel: 'Stay signed in' }))) return;
  await signOutSync();
  refresh();
  render();
  toast('Signed out');
});
on('share-app', () => shareApp());
on('copy-link', () => copyText(appUrl(), 'Link copied'));

onChange('set', (el) => { setSetting(el.dataset.k, +el.value); render(); });
onChange('set-str', (el) => { setSetting(el.dataset.k, el.value); render(); });
onChange('tog', (el) => { setSetting(el.dataset.k, el.checked); syncWake(); });

on('backup', async () => {
  const ok = await saveFile(`setlist-backup-${stamp()}.json`, 'application/json', makeBackup());
  if (!ok) return;
  state.settings.lastBackup = Date.now();
  saveSettings();
  toast('Backup saved');
  refresh();
  render();
});
on('export-csv', async () => { if (await saveFile(`setlist-workouts-${stamp()}.csv`, 'text/csv', makeCSV())) toast('Spreadsheet exported'); });

// ── Import ──
on('import-pick', () => document.getElementById('file').click());
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'file') return;
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const busy = openSheet({ cls: 'dialog', html: `<h3>Importing…</h3><p>${esc(file.name)}</p>` });
  let res;
  try { res = await importFile(file); } catch (err) {
    closeSheet(busy);
    openSheet({ cls: 'dialog', html: `<h3>Couldn't import that file</h3><p>${esc(err.message || 'Something went wrong reading it.')}</p><div class="row end"><button class="btn primary" data-a="sheet-close">OK</button></div>` });
    return;
  }
  closeSheet(busy);
  showImportResult(res, file.name);
});

export function showImportResult(r, name) {
  refresh();
  render();
  const none = r.workouts === 0;
  openSheet({
    cls: 'dialog',
    html: `<h3>${none ? (r.inFile ? "Already imported — you're up to date" : 'No workouts found in that file') : 'Import complete'}</h3>
      <p>${esc(name)}</p>
      ${none ? `<p>${r.inFile ? `All ${plural(r.inFile, 'workout')} in this file were already in your log, so nothing new was added.` : ''}</p>` : `
      <div class="figs"><div><b>${num(r.workouts, 0)}</b><span>Workouts added</span></div><div><b>${num(r.sets, 0)}</b><span>Sets</span></div><div><b>${num(r.exercises, 0)}</b><span>Exercises</span></div></div>
      <ul class="plain">
        <li>${fmtDate(r.first, { year: true })} to ${fmtDate(r.last, { year: true })}</li>
        ${r.newExercises ? `<li>${plural(r.newExercises, 'new exercise')} added to your library</li>` : ''}
        ${r.routines ? `<li>${plural(r.routines, 'routine')} added</li>` : ''}
        ${r.dupes ? `<li>${plural(r.dupes, 'workout')} skipped (already in your log)</li>` : ''}
        ${r.skippedDaily ? `<li>Daily calorie logs in the file were left out: Setlist tracks workouts only</li>` : ''}
        <li>${plural(r.totalWorkouts, 'workout')} now in History</li>
      </ul>`}
      <div class="row end">${none ? '' : '<button class="btn" data-a="import-view">View in History</button>'}<button class="btn primary" data-a="sheet-close">Done</button></div>`,
  });
}
on('import-view', () => { closeSheet(); while (topSheet()) closeSheet(); go('history'); });

on('wipe', async () => {
  const n = state.workouts.length;
  const synced = state.sync.on || state.sync.wait;
  if (!(await confirmBox({ title: 'Erase everything?', body: `${plural(n, 'workout')}, your routines and custom exercises will be permanently deleted from this device. ${synced ? 'This device will also be signed out of sync; the copy in the cloud and your other devices are not touched, and signing in again brings it all back.' : 'Save a backup first if you might want them back.'}`, ok: 'Erase everything', danger: true }))) return;
  if (!(await confirmBox({ title: 'Are you sure?', body: synced ? 'This device will be emptied and signed out of sync.' : "This can't be undone.", ok: 'Yes, erase', danger: true }))) return;
  if (synced) await signOutSync(); // first, so the erase isn't sent to the other devices
  await wipe();
  ui.openId = null; ui.rest = null; ui.draft = null;
  while (topSheet()) closeSheet();
  go('home');
  toast('Everything erased');
});
