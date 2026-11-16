// The rules for building and changing a workout (no screen code here).
import { state, uid, saveWorkout, activeWorkout, getEx, saveRoutine } from './store.js';
import { ui, go, toast, primeAudio } from './core.js';
import { TYPES, FIELDS } from './lib.js';
import { prevSession, sessions } from './stats.js';
import { fmtDate } from './util.js';

const KEYS = ['w', 'r', 't', 'd'];
export const blank = () => ({ w: null, r: null, t: null, d: null, done: false });
export const typeKeys = (ex) => (TYPES[ex.type] || TYPES.wr).fields.map((f) => FIELDS[f].key);

// Sets for an exercise that was just added: mirror last time if there is one
function freshSets(ex, w) {
  const prev = prevSession(ex.id, w);
  if (prev) return prev.sets.map(blank);
  if (ex.type === 'wr' || ex.type === 'r') return [0, 1, 2].map(() => ({ ...blank(), r: 10 }));
  if (ex.type === 't') return [{ ...blank(), t: 60 }];
  return [blank()];
}

export function startWorkout({ title, from } = {}) {
  const act = activeWorkout();
  if (act) {
    ui.openId = act.id;
    go('log');
    toast('Finish your workout in progress first');
    return null;
  }
  const now = Date.now();
  const w = { id: uid(), title: (title || '').trim() || `Workout — ${fmtDate(now)}`, notes: '', start: now, end: null, exercises: [] };
  if (from) {
    for (const re of from.exercises) {
      const ex = getEx(re.exId);
      if (!ex) continue;
      const hasHistory = sessions(ex.id).length > 0;
      const sets = (re.sets && re.sets.length ? re.sets : [{}]).map((t) => ({
        // With history, leave the weight blank so last time's weight shows as the greyed suggestion
        w: hasHistory ? null : t.w ?? null, r: t.r ?? null, t: t.t ?? null, d: t.d ?? null, done: false,
      }));
      w.exercises.push({ exId: ex.id, name: ex.name, sets });
    }
  }
  saveWorkout(w);
  ui.openId = w.id;
  primeAudio();
  go('log');
  return w;
}

export function addExercise(w, exId) {
  const ex = getEx(exId);
  if (!ex) return;
  w.exercises.push({ exId: ex.id, name: ex.name, sets: freshSets(ex, w) });
  saveWorkout(w);
}

// The greyed suggestion for every set: the same set number last time, else
// whatever the set above it holds.
export function ghosts(w, we) {
  const prev = prevSession(we.exId, w);
  const out = [];
  let above = {};
  we.sets.forEach((s, i) => {
    const p = prev && prev.sets[i];
    const g = {};
    for (const k of KEYS) g[k] = (p && p[k]) || above[k] || null;
    out.push(g);
    above = {};
    for (const k of KEYS) above[k] = s[k] ?? g[k];
  });
  return out;
}

// Records set this workout: heavier than anything logged before it
export function newRecords(w) {
  const out = [];
  for (const we of w.exercises) {
    let top = null;
    for (const s of we.sets) if (s.done && s.w && s.r && (!top || s.w > top.w)) top = s;
    if (!top) continue;
    let before = 0;
    for (const ses of sessions(we.exId)) if (ses.w.id !== w.id && ses.at < w.start) for (const x of ses.sets) if (x.w > before) before = x.w;
    if (before && top.w > before && !out.some((o) => o.exId === we.exId)) out.push({ exId: we.exId, name: (getEx(we.exId) || we).name, w: top.w, r: top.r, before });
  }
  return out;
}

export function routineFromWorkout(w, name) {
  const r = {
    id: uid(), name, desc: '', created: Date.now(),
    exercises: w.exercises.map((we) => {
      const done = we.sets.filter((s) => s.done);
      return { exId: we.exId, name: we.name, sets: (done.length ? done : we.sets).map((s) => ({ w: s.w ?? null, r: s.r ?? null, t: s.t ?? null, d: s.d ?? null })) };
    }),
  };
  saveRoutine(r);
  return r;
}

export function routineFromTemplate(tpl) {
  const existing = state.routines.find((r) => r.name === tpl.name);
  if (existing) return existing;
  const r = { id: uid(), name: tpl.name, desc: tpl.desc || '', created: Date.now(), exercises: tpl.exercises.map((e) => ({ exId: e.exId, name: getEx(e.exId).name, sets: e.sets.map((s) => ({ ...s })) })) };
  saveRoutine(r);
  return r;
}
