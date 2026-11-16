// Every number the app shows is calculated here from the logged workouts.
// Results are cached until something changes (state.rev).
import { state, exOf, getEx } from './store.js';
import { dayKey, startOfDay, startOfWeek, addDays } from './util.js';

let memo = { rev: -1 };
const M = (key, fn) => {
  if (memo.rev !== state.rev) memo = { rev: state.rev };
  return key in memo ? memo[key] : (memo[key] = fn());
};

export const setVol = (s) => (s.done && s.w && s.r ? s.w * s.r : 0);
export const wVol = (w) => { let v = 0; for (const e of w.exercises) for (const s of e.sets) v += setVol(s); return v; };
export const wSets = (w) => { let n = 0; for (const e of w.exercises) for (const s of e.sets) if (s.done) n++; return n; };
export const doneSets = (we) => we.sets.filter((s) => s.done);
// Estimated one-rep max (Epley), reps capped at 15
export const e1rm = (w, r) => Math.round(w * (1 + Math.min(r, 15) / 30) * 10) / 10;

// exercise id → every time it was done, newest first
function sessionIndex() {
  return M('sessions', () => {
    const map = new Map();
    for (const w of state.workouts) {
      for (const we of w.exercises) {
        const sets = doneSets(we);
        if (!sets.length) continue;
        if (!map.has(we.exId)) map.set(we.exId, []);
        map.get(we.exId).push({ w, we, at: w.start, sets });
      }
    }
    return map;
  });
}
export const sessions = (exId) => sessionIndex().get(exId) || [];
// The most recent time this exercise was done before the given workout
export const prevSession = (exId, w) => sessions(exId).find((s) => s.w.id !== w.id && s.at < w.start) || null;

export function exSummary(exId) {
  return M('sum:' + exId, () => {
    const ss = sessions(exId);
    let best = null, longest = null, farthest = null;
    for (const s of ss) for (const x of s.sets) {
      if (x.w && (!best || x.w > best.w || (x.w === best.w && (x.r || 0) > (best.r || 0)))) best = { w: x.w, r: x.r, at: s.at };
      if (x.t && (!longest || x.t > longest.t)) longest = { t: x.t, at: s.at };
      if (x.d && (!farthest || x.d > farthest.d)) farthest = { d: x.d, at: s.at };
    }
    const trend = ss.slice(0, 8).reverse().map((s) => Math.max(0, ...s.sets.map((x) => x.w || 0)));
    return { count: ss.length, last: ss[0] || null, best, longest, farthest, trend };
  });
}

function daySet() {
  return M('days', () => {
    const m = new Map(); // dayKey → { vol, count }
    for (const w of state.workouts) {
      const k = dayKey(w.start);
      const d = m.get(k) || { vol: 0, count: 0, ts: startOfDay(w.start) };
      d.vol += wVol(w); d.count++;
      m.set(k, d);
    }
    return m;
  });
}

export function totals() {
  return M('totals', () => {
    const days = daySet();
    const now = Date.now();
    let vol = 0, sets = 0, reps = 0, dur = 0, timed = 0, week = 0;
    for (const w of state.workouts) {
      vol += wVol(w);
      for (const e of w.exercises) for (const s of e.sets) if (s.done) { sets++; reps += s.r || 0; }
      if (w.end) { dur += w.end - w.start; timed++; }
      if (now - w.start < 7 * 864e5) week++;
    }
    // current streak: consecutive days back from today (today not yet done doesn't break it)
    let streak = 0, d = startOfDay(now);
    if (!days.has(dayKey(d))) d = addDays(d, -1);
    while (days.has(dayKey(d))) { streak++; d = addDays(d, -1); }
    // longest streak
    const sorted = [...days.values()].map((x) => x.ts).sort((a, b) => a - b);
    let best = 0, run = 0, prev = null;
    for (const t of sorted) {
      run = prev != null && dayKey(addDays(prev, 1)) === dayKey(t) ? run + 1 : 1;
      if (run > best) best = run;
      prev = t;
    }
    // workouts per week over the last 12 weeks
    const since = addDays(startOfDay(now), -84);
    const recent = state.workouts.filter((w) => w.start >= since).length;
    return {
      workouts: state.workouts.length, week, streak, bestStreak: best, vol, sets, reps,
      activeDays: days.size, dur, avgDur: timed ? dur / timed : 0, perWeek12: recent / 12,
    };
  });
}

// Volume and workout count in buckets: weeks for 12w / 6m, months for 1y / all
export function series(range) {
  return M('series:' + range, () => {
    const now = Date.now();
    const buckets = [];
    const byWeek = range === '12w' || range === '6m';
    if (byWeek) {
      const n = range === '12w' ? 12 : 26;
      const first = addDays(startOfWeek(now), -7 * (n - 1));
      for (let i = 0; i < n; i++) {
        const s = addDays(first, i * 7);
        buckets.push({ s, e: addDays(s, 7), label: new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), vol: 0, count: 0, sets: 0 });
      }
    } else {
      const last = state.workouts[state.workouts.length - 1];
      let d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0);
      let n = 12;
      if (range === 'all' && last) {
        const f = new Date(last.start);
        n = Math.max(1, (d.getFullYear() - f.getFullYear()) * 12 + d.getMonth() - f.getMonth() + 1);
      }
      d.setMonth(d.getMonth() - (n - 1));
      for (let i = 0; i < n; i++) {
        const s = d.getTime();
        const nx = new Date(d); nx.setMonth(nx.getMonth() + 1);
        buckets.push({ s, e: nx.getTime(), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), vol: 0, count: 0, sets: 0 });
        d = nx;
      }
    }
    const from = buckets[0].s;
    let workouts = 0, vol = 0, sets = 0;
    for (const w of state.workouts) {
      if (w.start < from) continue;
      const b = buckets.find((x) => w.start >= x.s && w.start < x.e);
      if (!b) continue;
      const v = wVol(w), n = wSets(w);
      b.vol += v; b.count++; b.sets += n;
      workouts++; vol += v; sets += n;
    }
    const span = byWeek ? buckets.length : buckets.length;
    return { buckets, workouts, vol, sets, rate: workouts / span, unit: byWeek ? 'week' : 'month' };
  });
}

// Most volume in any 7-day stretch
export function bestWeek() {
  return M('bestWeek', () => {
    const days = [...daySet().values()].sort((a, b) => a.ts - b.ts);
    let best = 0, bestStart = null, sum = 0, i = 0;
    for (let j = 0; j < days.length; j++) {
      sum += days[j].vol;
      while (days[j].ts - days[i].ts >= 7 * 864e5 - 36e5) { sum -= days[i].vol; i++; }
      if (sum > best) { best = sum; bestStart = days[i].ts; }
    }
    return { vol: best, start: bestStart };
  });
}

// Last 26 weeks, one cell per day
export function heat() {
  return M('heat', () => {
    const days = daySet();
    const now = Date.now();
    const first = addDays(startOfWeek(now), -7 * 25);
    const weeks = [];
    let max = 0, active = 0;
    for (let wk = 0; wk < 26; wk++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const ts = addDays(first, wk * 7 + i);
        const d = days.get(dayKey(ts));
        const cell = { ts, vol: d ? d.vol : 0, count: d ? d.count : 0, future: ts > now };
        if (cell.count) active++;
        if (cell.vol > max) max = cell.vol;
        col.push(cell);
      }
      weeks.push(col);
    }
    return { weeks, max, active };
  });
}

// Completed sets by category
export function mix() {
  return M('mix', () => {
    const out = {};
    for (const w of state.workouts) {
      const seen = new Set();
      for (const we of w.exercises) {
        const cat = exOf(we).cat;
        const o = out[cat] || (out[cat] = { sets: 0, sessions: 0, lbs: 0, mi: 0, sec: 0, reps: 0 });
        let any = false;
        for (const s of we.sets) {
          if (!s.done) continue;
          any = true; o.sets++; o.lbs += setVol(s); o.mi += s.d || 0; o.sec += s.t || 0; o.reps += s.r || 0;
        }
        if (any && !seen.has(cat)) { seen.add(cat); o.sessions++; }
      }
    }
    return out;
  });
}

// Per-exercise all-time totals
function exTotals() {
  return M('exTotals', () => {
    const list = [];
    for (const [exId, ss] of sessionIndex()) {
      let vol = 0, sets = 0, best = null, bestE = null;
      for (const s of ss) for (const x of s.sets) {
        sets++; vol += setVol(x);
        if (x.w && x.r) {
          if (!best || x.w > best.w) best = { w: x.w, r: x.r, at: s.at };
          const e = e1rm(x.w, x.r);
          if (!bestE || e > bestE.e) bestE = { e, w: x.w, r: x.r, at: s.at };
        }
      }
      const ex = getEx(exId) || exOf(ss[0].we);
      list.push({ exId, name: ex.name, cat: ex.cat, muscle: ex.muscle || 'Other', sessions: ss.length, sets, vol, best, bestE });
    }
    return list;
  });
}

export const mostTrained = () => M('most', () => exTotals().filter((x) => x.vol > 0).sort((a, b) => b.vol - a.vol).slice(0, 10));
export const topWeighted = () => M('topW', () => exTotals().filter((x) => x.best).sort((a, b) => b.sessions - a.sessions).slice(0, 20));

export function muscles() {
  return M('muscles', () => {
    const m = new Map();
    for (const x of exTotals()) {
      if (!x.vol) continue;
      const o = m.get(x.muscle) || { muscle: x.muscle, vol: 0, sessions: 0, top: null };
      o.vol += x.vol; o.sessions += x.sessions;
      if (!o.top || x.vol > o.top.vol) o.top = { name: x.name, vol: x.vol };
      m.set(x.muscle, o);
    }
    return [...m.values()].sort((a, b) => b.vol - a.vol);
  });
}

// Personal records: heaviest completed set per exercise, most recent first
export const prs = () => M('prs', () => exTotals().filter((x) => x.best).sort((a, b) => b.best.at - a.best.at));

// One point per session for an exercise, oldest first
export function progress(exId) {
  return M('prog:' + exId, () => sessions(exId).map((s) => {
    let top = 0, topR = 0, e = 0, vol = 0;
    for (const x of s.sets) {
      vol += setVol(x);
      if (x.w && x.r) {
        if (x.w > top) { top = x.w; topR = x.r; }
        e = Math.max(e, e1rm(x.w, x.r));
      }
    }
    return { at: s.at, title: s.w.title, top, topR, e, vol };
  }).filter((p) => p.top > 0).reverse());
}

export function cardio() {
  return M('cardio', () => {
    let mi = 0, sec = 0, n = 0;
    const months = new Map();
    for (const w of state.workouts) for (const we of w.exercises) {
      if (exOf(we).cat !== 'c') continue;
      const sets = doneSets(we);
      if (!sets.length) continue;
      n++;
      const d = new Date(w.start);
      const k = d.getFullYear() * 12 + d.getMonth();
      for (const s of sets) { mi += s.d || 0; sec += s.t || 0; months.set(k, (months.get(k) || 0) + (s.d || 0)); }
    }
    const keys = [...months.keys()].sort((a, b) => a - b);
    const out = [];
    if (keys.length) {
      const end = new Date().getFullYear() * 12 + new Date().getMonth();
      for (let k = Math.max(keys[0], end - 11); k <= end; k++) {
        out.push({ label: new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString('en-US', { month: 'short' }), mi: months.get(k) || 0 });
      }
    }
    return { mi, sec, sessions: n, months: out };
  });
}

export function records() {
  return M('records', () => {
    const all = exTotals();
    const heaviest = all.filter((x) => x.best).sort((a, b) => b.best.w - a.best.w)[0] || null;
    const strongest = all.filter((x) => x.bestE).sort((a, b) => b.bestE.e - a.bestE.e)[0] || null;
    return { heaviest, strongest, bestWeek: bestWeek(), totals: totals() };
  });
}

// Every time an exercise's estimated 1RM record was beaten, newest first
export function prTimeline() {
  return M('prTimeline', () => {
    const out = [];
    for (const [exId, ss] of sessionIndex()) {
      let best = 0, first = true;
      const ex = getEx(exId) || exOf(ss[0].we);
      for (let i = ss.length - 1; i >= 0; i--) {
        let top = null;
        for (const x of ss[i].sets) if (x.w && x.r) { const e = e1rm(x.w, x.r); if (!top || e > top.e) top = { e, w: x.w, r: x.r }; }
        if (!top) continue;
        if (top.e > best) {
          if (!first) out.push({ exId, name: ex.name, at: ss[i].at, ...top, prev: best });
          best = top.e;
        }
        first = false;
      }
    }
    return out.sort((a, b) => b.at - a.at);
  });
}
