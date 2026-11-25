// Two helpers that work from the person's own log, on the phone, with no AI:
//   1. Time: how long a routine or the rest of a workout will take at their pace.
//   2. Coach: what to aim for next time on each exercise.
import { state, getEx } from './store.js';
import { sessions, estimate, pace } from './stats.js';
import { fmtSets, plural } from './util.js';

// ── Time ──
export const approxMin = (sec) => Math.max(1, Math.round(sec / 60));

// "≈ 38 min · fits your 45" for a routine's exercise list
export function timeChip(exercises) {
  const m = approxMin(estimate(exercises).sec);
  const b = state.settings.budget;
  const over = b && m > b;
  return `<span class="chip time${over ? ' over' : b ? ' fits' : ''}">≈ ${m} min${b ? (over ? ` · ${m - b} over your ${b}` : ` · fits your ${b}`) : ''}</span>`;
}

// "About 14 min left · on track for 43 of your 45" while logging
export function etaText(w) {
  const left = estimate(w.exercises, { undone: true }).sec;
  if (!left) return { text: '', over: false };
  const total = approxMin((Date.now() - w.start) / 1000 + left);
  const b = state.settings.budget;
  const over = !!b && total > b;
  return { text: `About ${approxMin(left)} min left · on track for ${total} min${b ? (over ? `, ${total - b} over your ${b}` : ` of your ${b}`) : ''}`, over };
}

export const paceNote = () => {
  const p = pace();
  const per = (p.sec / 60).toFixed(1).replace(/\.0$/, '');
  return p.n ? `Estimates use your own pace: about ${per} min a set, rest included, from your last ${plural(p.n, 'workout')}.`
    : `Estimates assume about ${per} min a set, rest included. After five workouts they switch to your own pace.`;
};

// ── Coach ──
// The rule (double progression): reach your usual reps on a set, then add one
// step of weight. Fall short, and keep the weight and add a rep.
//   steady: go up after hitting the reps two sessions running (the default)
//   fast:   go up after hitting them once
// Two or more reps over the target counts as clearly ready either way.
// The next weight up: the next heavier weight this person has already used on
// this exercise (so it matches their machine or dumbbell rack), unless that is
// a big jump, in which case a standard small step.
function nextWeight(exId, w) {
  const step = w < 30 ? 2.5 : w < 150 ? 5 : 10;
  let next = Infinity;
  for (const s of sessions(exId)) for (const x of s.sets) if (x.w > w && x.w < next) next = x.w;
  return next - w <= Math.max(10, w * 0.12) ? next : w + step;
}

// The rep count this person works at: the most common count in each of the
// last three sessions, taking the highest (one off day doesn't lower the bar).
function usualReps(ss) {
  let best = 0;
  for (const s of ss.slice(0, 3)) {
    const n = new Map();
    for (const x of s.sets) if (x.r && x.kind !== 'w') n.set(x.r, (n.get(x.r) || 0) + 1);
    const top = [...n].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (top && top[0] > best) best = top[0];
  }
  return best || 10;
}

// What to aim for on each set of an exercise.
//   before: the workout being logged (its own sets are ignored), or null for "next time"
//   planned: rep targets already set for this workout's sets (from a routine), if any
// → { sets:[{w,r,t,kind}|null], text, note, changed } or null when there's nothing to say
export function coach(ex, before = null, planned = []) {
  const mode = state.settings.coach || 'steady';
  if (mode === 'off' || !ex) return null;
  let ss = sessions(ex.id);
  if (before) ss = ss.filter((s) => s.w.id !== before.id && s.at < before.start);
  if (!ss.length) return null;
  // while logging, only as many sets as this workout has
  const last = planned.length ? ss[0].sets.slice(0, planned.length) : ss[0].sets;
  const prev = ss[1] ? ss[1].sets : [];
  const usual = usualReps(ss);
  let sets;
  if (ex.type === 'wr') {
    sets = last.map((x, i) => {
      if (!x.r) return null;
      if (x.kind === 'w') return { w: x.w, r: x.r, kind: 'same' }; // warm-ups stay as they are
      if (!x.w) return { r: x.r + 1, kind: 'rep' };
      const target = planned[i] || usual;
      if (x.r < target) return { w: x.w, r: x.r + 1, kind: 'rep' };
      const p = prev[i];
      const ready = mode === 'fast' || x.r >= target + 2 || (p && p.w >= x.w && p.r >= target);
      return ready ? { w: nextWeight(ex.id, x.w), r: target, kind: 'up' } : { w: x.w, r: target, kind: 'again' };
    });
  } else if (ex.type === 'r') {
    sets = last.map((x) => (x.r ? { r: x.r + 1, kind: 'rep' } : null));
  } else if (ex.type === 't' && ex.cat !== 'y') {
    sets = last.map((x) => (x.t ? { t: x.t + 5, kind: 'rep' } : null));
  } else return null;
  const real = sets.filter(Boolean);
  if (!real.length) return null;
  const has = (k) => real.some((s) => s.kind === k);
  const when = mode === 'fast' ? 'last time' : 'two sessions running';
  const reps = planned.some(Boolean) ? 'your reps' : `${usual} reps`;
  let note;
  if (ex.type === 'r') note = 'One more rep per set than last time.';
  else if (ex.type === 't') note = 'Five seconds longer than last time.';
  else if (has('up') && !has('rep') && !has('again')) note = `You hit ${reps} ${when}, so go up a step.`;
  else if (has('up')) note = `Up a step where you hit your reps ${when}. Otherwise same weight.`;
  else if (has('again')) note = has('rep') ? 'Same weights. Add a rep where you fell short.' : `You hit ${reps} last time. Match it once more and the weight goes up.`;
  else note = `Same weight, one more rep per set, until you reach ${usual}.`;
  return { sets, text: fmtSets(real), note, up: has('up'), changed: real.some((s) => s.kind === 'up' || s.kind === 'rep') };
}

export const coachFor = (exId, before, planned) => coach(getEx(exId), before, planned);
