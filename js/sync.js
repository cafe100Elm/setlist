// Optional sync between a person's own devices.
//
// Off unless they sign in (Settings → Sync across devices). The log on this
// device stays the one every screen reads; this file copies changes out to the
// person's private cloud space and brings the other device's changes back.
//
// The rules, in plain terms:
//  - Every item (a workout, a routine, a custom exercise, the settings) carries
//    the time it last changed. When two devices disagree, the newer one wins.
//  - Changes made here wait in a "to send" list (state.sync.out) that is saved on
//    the device, so anything done with no signal goes up the next time there is one.
//  - A delete is sent as a small "this was deleted" marker, so the other device
//    removes its copy instead of sending it back. Each device also remembers what
//    was deleted and when (state.sync.dead), so a device that was offline can't
//    bring an item back by sending an older copy of it.
//  - Always listen first, send second: a device that has been away takes in what
//    it missed before it sends anything, so it can't overwrite newer work.
//  - Two devices that each imported the same history have the same workouts under
//    different ids. Those are recognised as twins (same title and start minute)
//    and merged, so signing in a second device doesn't double the log.
import { state, DEFAULTS, onLocalChange, putRaw, dropRaw, afterSync, saveSync, saveSettings, getEx } from './store.js';
import { norm } from './lib.js';
import * as cloud from './cloud.js';

const LISTS = ['custom', 'routines', 'workouts'];
const ALL = [...LISTS, 'settings'];
const LOCAL_ONLY = ['lastBackup', 'backupNudge']; // about this device, not the person
const OVERLAP = 5 * 60000; // re-check the last few minutes on every start, to be safe
const BATCH = 200;

// off | starting | live | offline | signin (was on, needs signing in again) | tap (sign-in window was blocked) | denied | error
let phase = 'off';
let note = '';
let user = null; // { uid, email } while signed in
let authWatch = null, firstAuth = null;
let unsubs = [];
let ready = {}; // list → the server has answered
let seen = {}; // list → ids the server has, while checking everything
let flushing = false, flushTimer = 0, saveTimer = 0, retryTimer = 0, emitTimer = 0;
const listeners = { status: [], data: [] };

export const onSyncStatus = (fn) => listeners.status.push(fn);
export const onSyncData = (fn) => listeners.data.push(fn);

function meta() {
  const m = state.sync;
  m.out = m.out || {}; m.cur = m.cur || {}; m.alias = m.alias || {}; m.dead = m.dead || {};
  return m;
}
// Record a delete: remember it, and put the marker on the "to send" list.
function bury(m, k, u) { m.dead[k] = Math.max(m.dead[k] || 0, u); m.out[k] = { u: m.dead[k], del: true }; }
function emit() {
  if (emitTimer) return;
  emitTimer = setTimeout(() => { emitTimer = 0; for (const fn of listeners.status) fn(); }, 60);
}
function setPhase(p, msg = '') { phase = p; note = msg; emit(); }
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSync, 250); }
function queueFlush(ms = 2500) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }

export function syncInfo() {
  const m = state.sync || {};
  return {
    available: cloud.configured(), on: !!m.on, phase, note, email: m.email || '',
    pending: Object.keys(m.out || {}).length, last: m.last || 0, online: navigator.onLine !== false,
  };
}

// The settings that travel between devices, as text (keys in a fixed order so two copies compare equal).
function settingsDoc() {
  const o = {};
  for (const k of Object.keys(state.settings).sort()) if (!LOCAL_ONLY.includes(k) && state.settings[k] !== undefined) o[k] = state.settings[k];
  return JSON.stringify(o);
}
const find = (list, id) => state[list].find((x) => x.id === id);

// ── Something changed on this device ──
function localChange(list, id, del) {
  if (!state.sync.on) return;
  const m = meta();
  if (list === 'settings') {
    const snap = settingsDoc();
    if (snap === m.setSnap) return; // e.g. only the backup date moved
    m.setSnap = snap;
    m.setU = Date.now();
    m.out['settings/main'] = { u: m.setU };
  } else if (del) bury(m, list + '/' + id, Date.now());
  else { const rec = find(list, id); m.out[list + '/' + id] = { u: (rec && rec.u) || 0 }; delete m.dead[list + '/' + id]; }
  queueSave();
  queueFlush();
  emit();
}

// ── Twins: the same thing created separately on two devices ──
const twinKey = {
  workouts: (w) => norm(w.title) + '|' + Math.floor((w.start || 0) / 60000),
  routines: (r) => norm(r.name) + '|' + (r.exercises || []).map((e) => norm(e.name || (getEx(e.exId) || {}).name || e.exId)).join(','),
  custom: (c) => norm(c.name),
};
const resolve = (id, alias) => { let n = 0; while (alias[id] && n++ < 20) id = alias[id]; return id; };
// Point every workout and routine that used one exercise id at another.
function remapAll(from, to) {
  const m = meta();
  for (const list of ['workouts', 'routines']) {
    for (const rec of state[list]) {
      let hit = false;
      for (const e of rec.exercises || []) if (e.exId === from) { e.exId = to; hit = true; }
      if (!hit) continue;
      rec.u = Date.now();
      putRaw(list, rec);
      m.out[list + '/' + rec.id] = { u: rec.u };
    }
  }
}

// ── Something arrived from the cloud ──
function applyBatch(list, docs) {
  if (list === 'settings') { let ch = false; for (const d of docs) if (d.id === 'main') ch = applySettings(d) || ch; return ch; }
  const m = meta();
  const byId = new Map(state[list].map((x) => [x.id, x]));
  const key = twinKey[list];
  const twins = new Map(state[list].map((x) => [key(x), x]));
  let changed = false;
  for (const d of docs) {
    const k = list + '/' + d.id;
    const pend = m.out[k];
    const local = byId.get(d.id);
    if (pend || local) {
      const localU = pend ? pend.u : local.u || 0;
      if (d.u === localU) { if (pend && !!pend.del === d.del) delete m.out[k]; continue; } // same version
      if (d.u < localU) { m.out[k] = pend || { u: localU }; continue; } // ours is newer: send it (again)
      delete m.out[k]; // theirs is newer
      if (d.del) {
        m.dead[k] = Math.max(m.dead[k] || 0, d.u);
        if (local) { dropRaw(list, d.id); byId.delete(d.id); if (twins.get(key(local)) === local) twins.delete(key(local)); changed = true; }
        continue;
      }
    } else if (d.del) { m.dead[k] = Math.max(m.dead[k] || 0, d.u); continue; } // deleted elsewhere, not here any more
    else if (m.dead[k] >= d.u) { bury(m, k, m.dead[k]); continue; } // an older copy of something deleted since: delete it again
    if (!d.del) delete m.dead[k];
    let rec;
    try { rec = JSON.parse(d.d); } catch (e) { continue; }
    if (!rec || rec.id !== d.id) continue;
    rec.u = d.u;
    if (list !== 'custom') { // an exercise that was merged into its twin: use the one that was kept
      let hit = false;
      for (const e of rec.exercises || []) { const to = resolve(e.exId, m.alias); if (to !== e.exId) { e.exId = to; hit = true; } }
      if (hit) { rec.u = Date.now(); m.out[k] = { u: rec.u }; }
    }
    if (!local) {
      const twin = twins.get(key(rec));
      if (twin && twin.id !== rec.id) {
        // Keep the more recently edited of the two; if neither was edited, the same one on every device.
        const theirs = d.u > (twin.u || 0) || (d.u === (twin.u || 0) && rec.id < twin.id);
        const lose = theirs ? twin : rec, win = theirs ? rec : twin;
        bury(m, list + '/' + lose.id, Date.now());
        if (list === 'custom') { m.alias[lose.id] = win.id; remapAll(lose.id, win.id); }
        changed = true;
        if (!theirs) { if (!m.out[list + '/' + twin.id]) m.out[list + '/' + twin.id] = { u: twin.u || 0 }; continue; }
        dropRaw(list, twin.id);
        byId.delete(twin.id);
      }
    }
    putRaw(list, rec);
    const now = local || rec;
    byId.set(d.id, now);
    twins.set(key(now), now);
    changed = true;
  }
  return changed;
}

function applySettings(d) {
  const m = meta();
  const localU = m.setU || 0;
  if (d.u === localU) { delete m.out['settings/main']; return false; }
  if (d.u < localU) { m.out['settings/main'] = { u: localU }; return false; }
  let o;
  try { o = JSON.parse(d.d); } catch (e) { return false; }
  if (!o || typeof o !== 'object') return false;
  for (const k of Object.keys(state.settings)) {
    if (LOCAL_ONLY.includes(k) || k in o) continue;
    if (k in DEFAULTS) state.settings[k] = DEFAULTS[k]; else delete state.settings[k];
  }
  for (const k of Object.keys(o)) if (!LOCAL_ONLY.includes(k)) state.settings[k] = o[k];
  m.setU = d.u;
  m.setSnap = settingsDoc();
  delete m.out['settings/main'];
  saveSettings();
  return true;
}

function onDocs(uid, list, docs, fromServer) {
  if (!user || user.uid !== uid || !state.sync.on) return;
  const m = meta();
  const changed = docs.length ? applyBatch(list, docs) : false;
  if (seen[list]) for (const d of docs) seen[list].add(d.id);
  if (!fromServer && ready[list]) { // lost the connection: stop sending until we've listened again
    ready[list] = false;
    if (phase === 'live') setPhase('offline');
  }
  if (fromServer) {
    for (const d of docs) if (d.s > (m.cur[list] || 0)) m.cur[list] = d.s;
    if (!ready[list]) {
      ready[list] = true;
      if (seen[list]) { queueMissing(list, seen[list]); delete seen[list]; }
      if (ALL.every((l) => ready[l]) && phase !== 'live') setPhase('live');
    }
    m.last = Date.now();
    queueFlush(docs.length ? 400 : 0);
  }
  if (changed) { afterSync(); for (const fn of listeners.data) fn(); }
  queueSave();
  emit();
}

// After checking everything the cloud has: send whatever is here but not there.
function queueMissing(list, have) {
  const m = meta();
  if (list === 'settings') {
    if (!have.has('main')) { m.setU = m.setU || Date.now(); m.out['settings/main'] = { u: m.setU }; }
    return;
  }
  for (const rec of state[list]) {
    const k = list + '/' + rec.id;
    if (!have.has(rec.id) && !m.out[k]) m.out[k] = { u: rec.u || 0 };
  }
}

// ── Sending ──
async function flush() {
  clearTimeout(flushTimer);
  if (flushing || phase !== 'live' || !user || navigator.onLine === false) return;
  const m = meta();
  const uid = user.uid;
  const items = [];
  for (const k of Object.keys(m.out)) {
    if (items.length >= BATCH) break;
    const i = k.indexOf('/'), list = k.slice(0, i), id = k.slice(i + 1), e = m.out[k];
    if (list === 'settings') { e.u = m.setU || 0; items.push({ k, list, id, u: e.u, d: settingsDoc() }); }
    else if (e.del) items.push({ k, list, id, u: e.u, del: true });
    else {
      const rec = find(list, id);
      if (!rec) { delete m.out[k]; continue; }
      e.u = rec.u || 0;
      items.push({ k, list, id, u: e.u, d: JSON.stringify(rec) });
    }
  }
  if (!items.length) { queueSave(); emit(); return; }
  flushing = true;
  emit();
  try {
    await cloud.write(uid, items);
  } catch (err) {
    flushing = false;
    if (err && err.code === 'permission-denied') { denied(); return; }
    console.warn('Sync: sending failed, will retry', err);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, 30000);
    emit();
    return;
  }
  flushing = false;
  if (!user || user.uid !== uid || !state.sync.on) return; // signed out while sending
  const now = meta();
  for (const it of items) { const e = now.out[it.k]; if (e && e.u === it.u && !!e.del === !!it.del) delete now.out[it.k]; }
  now.last = Date.now();
  saveSync();
  emit();
  if (Object.keys(now.out).length) queueFlush(0);
}

// ── Connecting ──
function stopListening() {
  for (const u of unsubs) { try { u(); } catch (e) { /* already stopped */ } }
  unsubs = []; ready = {}; seen = {};
}
function startListening() {
  stopListening();
  const m = meta();
  const uid = user.uid;
  setPhase('starting');
  for (const list of ALL) {
    const since = m.cur[list] ? Math.max(1, m.cur[list] - OVERLAP) : 0;
    if (!since) seen[list] = new Set(); // first time (or "Sync now"): compare everything
    unsubs.push(cloud.listen(uid, list, since, (docs, fromServer) => onDocs(uid, list, docs, fromServer), listenFailed));
  }
}
function listenFailed(err) {
  if (err && err.code === 'permission-denied') { denied(); return; }
  console.warn('Sync: listening failed, will retry', err);
  stopListening();
  setPhase('error', "Sync hit a problem and will try again shortly.");
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (user && state.sync.on) startListening(); }, 30000);
}
// Signed in with an account that isn't on the invite list.
function denied() {
  stopListening();
  state.sync = { on: false };
  saveSync();
  user = null;
  cloud.signOut().catch(() => {});
  setPhase('denied', "That Google account isn't set up for sync. Sync is by invitation for now; everything still works on this device.");
}

function onUser(u) {
  stopListening();
  user = u;
  if (!u) {
    if (phase !== 'denied' && phase !== 'tap') setPhase(state.sync.on ? 'signin' : 'off');
    return;
  }
  const m = meta();
  if (m.uid !== u.uid) state.sync = { on: true, uid: u.uid, email: u.email, out: {}, cur: {}, alias: {}, dead: {}, setU: 0, setSnap: settingsDoc(), last: 0 };
  else { m.on = true; m.email = u.email; }
  saveSync();
  startListening();
}
function watch() {
  if (!firstAuth) firstAuth = new Promise((res) => { authWatch = cloud.onUser((u) => { onUser(u); res(); }); });
  return firstAuth;
}
async function connect() {
  if (user || phase === 'starting') return;
  setPhase('starting');
  try { await cloud.init(); } catch (e) {
    setPhase('offline');
    clearTimeout(retryTimer);
    retryTimer = setTimeout(wake, 60000);
    return;
  }
  await watch();
  if (!user && phase === 'starting') setPhase(state.sync.on ? 'signin' : 'off');
}
function wake() {
  if (!state.sync.on) return;
  if (!user) { if (phase !== 'starting') connect(); } else flush();
}

// Opens Google's sign-in window. Must run straight from the tap, or browsers block the window.
function popup() {
  const again = phase === 'tap'; // second try: allowed to go to Google's page instead of a window
  setPhase('starting');
  return cloud.signIn(again).then(() => { if (!user) setPhase('off'); }, (e) => {
    const code = (e && e.code) || '';
    if (/popup-blocked/.test(code)) setPhase('tap', 'Your browser held back the sign-in window. Tap the button once more.');
    else if (/popup-closed|cancelled/.test(code)) setPhase('off');
    else if (/network/.test(code)) setPhase('off', "Couldn't reach Google. Check your connection and try again.");
    else if (/unauthorized-domain/.test(code)) setPhase('off', "Sign-in isn't set up for this web address yet.");
    else { console.warn('Sync: sign-in failed', e); setPhase('off', "Sign-in didn't finish. Try again."); }
  });
}

export function signIn() {
  if (!cloud.configured()) return Promise.resolve();
  if (authWatch) return user ? Promise.resolve() : popup(); // already loaded: open the window right away
  setPhase('starting');
  return cloud.init().then(watch).then(() => (user ? null : popup()), () => setPhase('off', "Couldn't reach Google. Check your connection and try again."));
}

// Stops syncing on this device. The log stays here, and the cloud copy is left as it is.
export async function signOutSync() {
  stopListening();
  clearTimeout(flushTimer); clearTimeout(retryTimer);
  state.sync = { on: false };
  user = null;
  await saveSync();
  try { if (authWatch) await cloud.signOut(); } catch (e) { /* offline: the device is off sync anyway */ }
  setPhase('off');
}

// Compare everything on this device with everything in the cloud, both ways.
export function syncNow() {
  if (!state.sync.on) return;
  if (!user) { connect(); return; }
  meta().cur = {};
  startListening();
}

export function initSync() {
  onLocalChange(localChange);
  if (!cloud.configured()) return;
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); else if (user) flush(); });
  if (state.sync.on || cloud.returning()) connect();
}
