// Bringing workouts in (backup file, Health Dashboard export, Hevy CSV) and
// sending them out (backup file, spreadsheet). Imports only ever add: a workout
// already in the log (same title and start minute) is skipped.
import { state, uid, findExByName, getEx, exOf, bulkAdd } from './store.js';
import { guessMuscle, guessEquip, guessCat, norm } from './lib.js';

const KG = 2.2046226218, KM = 0.6213711922;
const dupKey = (title, start) => norm(title) + '|' + Math.floor(start / 60000);
const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const val = (x) => (x === '' || x == null || isNaN(+x) || +x === 0 ? null : +x);

// ── CSV ──
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csvCell = (v) => (v == null || v === '' ? '""' : typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Hevy writes "15 Nov 2026, 16:44" in the phone's own time
function parseHevyDate(s) {
  const m = /^\s*(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})/.exec(s || '');
  if (m) {
    const mo = MONTHS.indexOf(m[2].toLowerCase());
    if (mo >= 0) return new Date(+m[3], mo, +m[1], +m[4], +m[5]).getTime();
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}
function hevyDate(ts) {
  const d = new Date(ts);
  const mo = MONTHS[d.getMonth()];
  return `${d.getDate()} ${mo[0].toUpperCase() + mo.slice(1)} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Working out what an incoming exercise is ──
// Looks at how its sets were actually recorded to decide how it should be logged.
class Resolver {
  constructor() { this.seen = new Map(); this.newCustom = []; this.pattern = new Map(); }
  note(name, set) {
    const k = norm(name);
    const p = this.pattern.get(k) || { w: 0, r: 0, t: 0, d: 0 };
    for (const f of ['w', 'r', 't', 'd']) if (set[f]) p[f]++;
    this.pattern.set(k, p);
  }
  resolve(name, hint = {}) {
    const k = norm(name);
    if (this.seen.has(k)) return this.seen.get(k);
    let id = findExByName(name);
    if (!id) {
      const p = this.pattern.get(k) || { w: 0, r: 0, t: 0, d: 0 };
      let cat = hint.cat || guessCat(name) || 'f';
      let type;
      if (p.w && p.d && !p.r) { type = 'wd'; if (cat === 'c') cat = 'f'; }
      else if (p.w) type = 'wr';
      else if (cat === 'c' || p.d) { type = 'c'; cat = 'c'; }
      else if (p.t && !p.r) type = 't';
      else if (p.r) type = 'r';
      else type = cat === 'y' ? 't' : cat === 'b' ? 'r' : 'wr';
      // No weight ever recorded and nothing in the name says otherwise: it's a bodyweight move
      if ((type === 'r' || type === 't') && cat === 'f' && !guessCat(name)) cat = 'b';
      if (cat === 'y' && type !== 't') cat = 'b';
      const c = {
        id: 'c-' + uid(), name: String(name).trim(), cat, type,
        muscle: hint.muscle || guessMuscle(name, cat), equip: hint.equip || guessEquip(name), cue: hint.cue || '', created: Date.now(),
      };
      this.newCustom.push(c);
      id = c.id;
    }
    this.seen.set(k, id);
    return id;
  }
}

function summarize(workouts, extra = {}) {
  let sets = 0, first = null, last = null;
  const names = new Set();
  for (const w of workouts) {
    for (const e of w.exercises) { sets += e.sets.length; names.add(e.exId); }
    if (first == null || w.start < first) first = w.start;
    if (last == null || w.start > last) last = w.start;
  }
  return { workouts: workouts.length, sets, exercises: names.size, first, last, ...extra };
}

async function commit(kind, workouts, routines, resolver, counts) {
  const existing = new Set(state.workouts.map((w) => dupKey(w.title, w.start)));
  const fresh = [];
  for (const w of workouts) {
    const k = dupKey(w.title, w.start);
    if (existing.has(k)) continue;
    existing.add(k);
    fresh.push(w);
  }
  const names = new Set(state.routines.map((r) => norm(r.name)));
  const newRoutines = [];
  for (const r of routines) { if (names.has(norm(r.name))) continue; names.add(norm(r.name)); newRoutines.push(r); }
  await bulkAdd({ workouts: fresh, routines: newRoutines, custom: resolver.newCustom });
  return {
    kind, ...summarize(fresh),
    inFile: workouts.length, dupes: workouts.length - fresh.length,
    newExercises: resolver.newCustom.length, routines: newRoutines.length,
    totalWorkouts: state.workouts.length, ...counts,
  };
}

// ── Hevy CSV ──
const KIND = { warmup: 'w', dropset: 'd', drop: 'd', failure: 'f' };
export async function importHevy(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('That file is empty.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  if (col('exercise_title') < 0 || col('start_time') < 0) {
    throw new Error("That doesn't look like a Hevy workout export. In Hevy: Profile → Settings → Export & Import Data → Export Workouts.");
  }
  const iw = col('weight_lbs') >= 0 ? col('weight_lbs') : col('weight_kg');
  const kg = col('weight_lbs') < 0 && col('weight_kg') >= 0;
  const idist = col('distance_miles') >= 0 ? col('distance_miles') : col('distance_km');
  const km = col('distance_miles') < 0 && col('distance_km') >= 0;
  const c = { title: col('title'), start: col('start_time'), end: col('end_time'), desc: col('description'), ex: col('exercise_title'), type: col('set_type'), reps: col('reps'), dur: col('duration_seconds') };

  const res = new Resolver();
  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const start = parseHevyDate(r[c.start]);
    if (start == null || !r[c.ex]) continue;
    const key = r[c.title] + '|' + r[c.start];
    let w = map.get(key);
    if (!w) {
      w = { id: uid(), title: r[c.title] || 'Workout', notes: (c.desc >= 0 && r[c.desc]) || '', start, end: parseHevyDate(r[c.end]) || start, exercises: [] };
      map.set(key, w);
    }
    let we = w.exercises[w.exercises.length - 1];
    if (!we || we.name !== r[c.ex]) { we = { name: r[c.ex], sets: [] }; w.exercises.push(we); }
    let wt = iw >= 0 ? val(r[iw]) : null, dist = idist >= 0 ? val(r[idist]) : null;
    if (wt && kg) wt = round(wt * KG, 1);
    if (dist && km) dist = round(dist * KM, 2);
    const set = { w: wt, r: val(r[c.reps]), t: c.dur >= 0 ? val(r[c.dur]) : null, d: dist, done: true };
    const kind = KIND[(r[c.type] || '').toLowerCase()];
    if (kind) set.kind = kind;
    we.sets.push(set);
    res.note(we.name, set);
  }
  const workouts = [...map.values()];
  for (const w of workouts) for (const we of w.exercises) we.exId = res.resolve(we.name);
  return commit('hevy', workouts, [], res, { rows: rows.length - 1 });
}

// ── Health Dashboard export (JSON) ──
const DASH_CAT = { machine: 'm', freeweight: 'f', 'free-weight': 'f', bodyweight: 'b', cardio: 'c', yoga: 'y', mobility: 'y' };
export async function importDashboard(data) {
  const res = new Resolver();
  const ts = (x) => (x && typeof x === 'object' ? x.epoch_ms : typeof x === 'number' ? x : x ? Date.parse(x) : null);
  const hints = new Map();
  for (const c of data.custom_exercises || []) hints.set(norm(c.name), { cat: DASH_CAT[c.category], muscle: c.muscle_group || '', equip: c.equipment || '', cue: c.instructions || '' });

  const workouts = [];
  for (const w of data.workouts || []) {
    const start = ts(w.started_at);
    if (start == null) continue;
    const out = { id: uid(), title: w.title || 'Workout', notes: w.notes || '', start, end: ts(w.ended_at) || start, exercises: [] };
    const exs = [...(w.exercises || [])].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    for (const e of exs) {
      const we = { name: e.exercise_name, _cat: DASH_CAT[e.category], _muscle: e.muscle_group || '', sets: [] };
      for (const s of [...(e.sets || [])].sort((a, b) => (a.set_number || 0) - (b.set_number || 0))) {
        const set = { w: val(s.weight_lbs), r: val(s.reps), t: val(s.duration_sec), d: val(s.distance_mi), done: s.completed !== false };
        const kind = KIND[s.set_type];
        if (kind) set.kind = kind;
        we.sets.push(set);
        res.note(we.name, set);
      }
      out.exercises.push(we);
    }
    workouts.push(out);
  }
  for (const w of workouts) for (const we of w.exercises) {
    const h = hints.get(norm(we.name)) || {};
    we.exId = res.resolve(we.name, { cat: h.cat || we._cat, muscle: h.muscle || we._muscle, equip: h.equip, cue: h.cue });
    delete we._cat; delete we._muscle;
  }
  // Custom exercises that were never used in a workout still belong in the library
  for (const c of data.custom_exercises || []) res.resolve(c.name, hints.get(norm(c.name)));

  const routines = [];
  for (const r of data.routines || []) {
    routines.push({
      id: uid(), name: r.name, desc: r.description || '', created: ts(r.created_at) || Date.now(),
      exercises: [...(r.exercises || [])].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map((e) => ({
        exId: res.resolve(e.exercise_name, { cat: DASH_CAT[e.category] }), name: e.exercise_name,
        sets: (e.target_sets || []).map((t) => ({ r: val(t.reps), w: val(t.weightLbs ?? t.weight_lbs ?? t.weight), t: val(t.durationSec ?? t.duration_sec), d: val(t.distanceMi ?? t.distance_mi) })),
      })),
    });
  }
  const skipped = (data.daily_logs || []).length + (data.calorie_entries || []).length;
  return commit('dashboard', workouts, routines, res, { skippedDaily: skipped });
}

// ── This app's own backup ──
export function makeBackup() {
  return JSON.stringify({
    app: 'setlist', version: 1, exported: new Date().toISOString(),
    workouts: state.workouts, routines: state.routines, custom: state.custom, settings: state.settings,
  });
}
export async function importBackup(data) {
  const res = new Resolver();
  const remap = new Map();
  for (const c of data.custom || []) {
    if (getEx(c.id)) continue;
    const same = findExByName(c.name);
    if (same) remap.set(c.id, same);
    else { res.newCustom.push({ ...c }); }
  }
  const fix = (id) => remap.get(id) || id;
  const ids = new Set(state.workouts.map((w) => w.id));
  const workouts = (data.workouts || []).filter((w) => !ids.has(w.id)).map((w) => ({
    ...w, exercises: (w.exercises || []).map((e) => ({ ...e, exId: fix(e.exId), sets: (e.sets || []).map((s) => ({ ...s })) })),
  }));
  const rids = new Set(state.routines.map((r) => r.id));
  const routines = (data.routines || []).filter((r) => !rids.has(r.id)).map((r) => ({ ...r, exercises: (r.exercises || []).map((e) => ({ ...e, exId: fix(e.exId) })) }));
  const already = (data.workouts || []).length - workouts.length;
  const out = await commit('backup', workouts, routines, res, {});
  out.inFile += already; out.dupes += already;
  return out;
}

// Reads any supported file and routes it to the right importer.
export async function importFile(file) {
  const text = await file.text();
  const t = text.trimStart();
  if (t[0] === '{' || t[0] === '[') {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error("That file couldn't be read. It may be damaged or cut short."); }
    if (data.app === 'setlist') return importBackup(data);
    if (data.export_info || (Array.isArray(data.workouts) && data.workouts[0] && data.workouts[0].started_at)) return importDashboard(data);
    throw new Error("That file isn't a Setlist backup or a Health Dashboard export.");
  }
  return importHevy(text);
}

// ── Spreadsheet export (same columns Hevy uses, so it opens anywhere) ──
export function makeCSV() {
  const head = ['title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id', 'exercise_notes', 'set_index', 'set_type', 'weight_lbs', 'reps', 'distance_miles', 'duration_seconds', 'rpe'];
  const KINDS = { w: 'warmup', d: 'dropset', f: 'failure' };
  const lines = [head.map(csvCell).join(',')];
  for (const w of state.workouts) {
    for (const we of w.exercises) {
      let i = 0;
      for (const s of we.sets) {
        if (!s.done) continue;
        lines.push([w.title, hevyDate(w.start), hevyDate(w.end || w.start), w.notes || '', exOf(we).name, '', '', i++, KINDS[s.kind] || 'normal', s.w ?? '', s.r ?? '', s.d ?? '', s.t ?? '', ''].map(csvCell).join(','));
      }
    }
  }
  return lines.join('\n') + '\n';
}
