// Everything a person logs lives here: in memory while the app is open, and in
// the phone's own database (IndexedDB) so it survives closing the app.
// Nothing is sent anywhere.
import { BUILTIN, norm } from './lib.js';

export const state = {
  workouts: [], // newest first
  routines: [],
  custom: [],
  settings: {},
  rev: 0, // bumped on every change so cached statistics know to recalculate
  storageOk: true,
};

const DEFAULTS = { rest: 90, restYoga: 30, sound: true, awake: true, lastBackup: 0, backupNudge: 0 };
const DB_NAME = 'setlist';
const STORES = ['workouts', 'routines', 'custom'];
let db = null;
let onError = () => {};
export const setErrorHandler = (fn) => { onError = fn; };

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
}

function run(stores, mode, fn) {
  if (!db) return Promise.resolve();
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode);
    let out;
    try { out = fn(t); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out && out.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  });
}
const safe = (p) => p.catch((e) => { console.error(e); onError(e); });

export async function load() {
  try {
    db = await open();
    const all = {};
    await run([...STORES, 'kv'], 'readonly', (t) => {
      for (const s of STORES) { const q = t.objectStore(s).getAll(); q.onsuccess = () => { all[s] = q.result; }; }
      const q = t.objectStore('kv').get('settings'); q.onsuccess = () => { all.settings = q.result; };
    });
    state.workouts = all.workouts || [];
    state.routines = all.routines || [];
    state.custom = all.custom || [];
    state.settings = { ...DEFAULTS, ...(all.settings || {}) };
  } catch (e) {
    console.error('Storage unavailable', e);
    state.storageOk = false;
    state.settings = { ...DEFAULTS };
  }
  sortAll();
  reindex();
  // Ask the phone not to clear this app's data when it is short on space.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
}

function sortAll() {
  state.workouts.sort((a, b) => b.start - a.start);
  state.routines.sort((a, b) => (a.created || 0) - (b.created || 0));
  state.custom.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Exercise lookup ──
let exMap = new Map();
let nameMap = new Map();
export function reindex() {
  exMap = new Map();
  nameMap = new Map();
  for (const e of BUILTIN) {
    exMap.set(e.id, e);
    nameMap.set(norm(e.name), e.id);
    for (const a of e.aka) nameMap.set(norm(a), e.id);
  }
  for (const e of state.custom) {
    exMap.set(e.id, e);
    if (!nameMap.has(norm(e.name))) nameMap.set(norm(e.name), e.id);
  }
}
export const getEx = (id) => exMap.get(id);
export const findExByName = (name) => nameMap.get(norm(name));
export const allExercises = () => [...BUILTIN, ...state.custom.filter((c) => !c.archived)];

// The library entry for an exercise inside a workout, with a sensible stand-in
// if the library entry has since been removed.
export function exOf(we) {
  const e = exMap.get(we.exId);
  if (e) return e;
  const s = we.sets || [];
  const has = (k) => s.some((x) => x[k]);
  const type = has('w') && has('d') && !has('r') ? 'wd' : has('w') ? 'wr' : has('d') ? 'c' : has('t') && !has('r') ? 't' : 'r';
  return { id: we.exId, name: we.name || 'Exercise', cat: type === 'c' ? 'c' : 'f', type, muscle: 'Other', equip: '', cue: '', missing: true };
}

// ── Saving ──
export function touch() { state.rev++; }

export function saveWorkout(w) {
  if (!state.workouts.includes(w)) { state.workouts.push(w); state.workouts.sort((a, b) => b.start - a.start); }
  touch();
  return safe(run(['workouts'], 'readwrite', (t) => t.objectStore('workouts').put(w)));
}
export function deleteWorkout(id) {
  state.workouts = state.workouts.filter((w) => w.id !== id);
  touch();
  return safe(run(['workouts'], 'readwrite', (t) => t.objectStore('workouts').delete(id)));
}
export function saveRoutine(r) {
  if (!state.routines.includes(r)) state.routines.push(r);
  touch();
  return safe(run(['routines'], 'readwrite', (t) => t.objectStore('routines').put(r)));
}
export function deleteRoutine(id) {
  state.routines = state.routines.filter((r) => r.id !== id);
  touch();
  return safe(run(['routines'], 'readwrite', (t) => t.objectStore('routines').delete(id)));
}
export function saveCustom(c) {
  if (!state.custom.includes(c)) state.custom.push(c);
  state.custom.sort((a, b) => a.name.localeCompare(b.name));
  reindex();
  touch();
  return safe(run(['custom'], 'readwrite', (t) => t.objectStore('custom').put(c)));
}
export function saveSettings() {
  return safe(run(['kv'], 'readwrite', (t) => t.objectStore('kv').put(state.settings, 'settings')));
}

// Add many records at once (used by imports).
export function bulkAdd({ workouts = [], routines = [], custom = [] }) {
  state.workouts.push(...workouts);
  state.routines.push(...routines);
  state.custom.push(...custom);
  sortAll();
  reindex();
  touch();
  return safe(run(STORES, 'readwrite', (t) => {
    for (const w of workouts) t.objectStore('workouts').put(w);
    for (const r of routines) t.objectStore('routines').put(r);
    for (const c of custom) t.objectStore('custom').put(c);
  }));
}

export function wipe() {
  state.workouts = []; state.routines = []; state.custom = [];
  state.settings = { ...DEFAULTS };
  reindex();
  touch();
  return safe(run([...STORES, 'kv'], 'readwrite', (t) => {
    for (const s of STORES) t.objectStore(s).clear();
    t.objectStore('kv').clear();
  }));
}

export const activeWorkout = () => state.workouts.find((w) => !w.end) || null;
export const getWorkout = (id) => state.workouts.find((w) => w.id === id) || null;
