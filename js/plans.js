// Plans: which routine to do on which day. A person picks a plan and the date
// of day 1; the cycle then repeats from that date, and the calendar shows it.
// The choice is saved as settings.plan = { id, start }.
import { state, activeWorkout } from './store.js';
import { ui, on, onSubmit, render, toast, confirmBox, openSheet, closeSheet, setSetting } from './core.js';
import { PLANS, STARTERS, AGE_SMART } from './lib.js';
import { esc, fmtDate, dayKey, startOfDay, addDays, plural } from './util.js';
import { startWorkout, routineFromTemplate } from './workout.js';

const KIND_NAME = { s: 'Strength', c: 'Cardio', y: 'Mobility', w: 'Walk', r: 'Rest' };
const tplById = (id) => [...STARTERS, ...AGE_SMART].find((t) => t.id === id);
const itemMins = (it) => { const t = it.tpl && tplById(it.tpl); return t && t.mins ? t.mins : it.mins || 0; };

export function activePlan() {
  const s = state.settings.plan;
  const plan = s && PLANS.find((p) => p.id === s.id);
  return plan ? { plan, start: s.start } : null;
}

// What the plan says for a given date (null before day 1)
export function itemOn(plan, start, ts) {
  const idx = Math.round((startOfDay(ts) - startOfDay(start)) / 864e5);
  if (idx < 0) return null;
  const n = plan.cycle.length;
  return { item: plan.cycle[idx % n], day: (idx % n) + 1, week: Math.floor(idx / n) + 1 };
}

// date → workouts logged that day
let logMemo = { rev: -1, map: new Map() };
function logged(ts) {
  if (logMemo.rev !== state.rev) {
    const map = new Map();
    for (const w of state.workouts) { const k = dayKey(w.start); if (!map.has(k)) map.set(k, []); map.get(k).push(w); }
    logMemo = { rev: state.rev, map };
  }
  return logMemo.map.get(dayKey(ts)) || [];
}

const summary = (plan) => {
  const count = (k) => plan.cycle.filter((d) => d.kind === k).length;
  const parts = [];
  if (count('s')) parts.push(plural(count('s'), 'strength day'));
  if (count('c')) parts.push(plural(count('c'), 'cardio day'));
  if (count('w')) parts.push(plural(count('w'), 'walk'));
  if (count('y')) parts.push(`${count('y')} mobility`);
  return `${parts.join(' · ')} · repeats every ${plan.cycle.length} days`;
};

// The cycle drawn as a flow: day 1 → day 2 → … → back to day 1
function flow(plan, todayNo) {
  const nodes = plan.cycle.map((d, i) => `
    <div class="fnode k-${d.kind}${todayNo === i + 1 ? ' now' : ''}">
      <small>Day ${i + 1}${todayNo === i + 1 ? ' · today' : ''}</small><b>${esc(d.label)}</b><span>${itemMins(d) ? `${itemMins(d)} min` : d.kind === 'r' ? 'Day off' : KIND_NAME[d.kind]}</span>
    </div>`).join('<i class="farrow" aria-hidden="true">→</i>');
  return `<div class="flow" role="img" aria-label="${esc(plan.cycle.map((d, i) => `Day ${i + 1}: ${d.label}`).join(', '))}, then repeat">${nodes}<i class="farrow" aria-hidden="true">→</i><div class="floop">↻ Back to day 1</div></div>`;
}

// Button for a plan day: start its routine, or log a walk
function goButton(item, cls = 'btn primary') {
  if (activeWorkout()) return '';
  if (item.tpl) return `<button class="${cls}" data-a="plan-go" data-tpl="${item.tpl}">Start →</button>`;
  if (item.kind === 'w') return `<button class="${cls}" data-a="plan-walk">Log a walk</button>`;
  return '';
}

// ── Home: today's line from the plan ──
export function planToday() {
  const ap = activePlan();
  if (!ap) return '';
  const now = Date.now();
  const t = itemOn(ap.plan, ap.start, now);
  const link = `<button class="more" data-a="go" data-tab="library" data-lib="plans">Calendar →</button>`;
  if (!t) {
    return `<section class="card plan-today"><div class="card-h"><span class="kicker">${esc(ap.plan.name)}</span>${link}</div>
      <div><h2>Starts ${fmtDate(ap.start, { weekday: true })}</h2><small class="muted">Day 1 is ${esc(ap.plan.cycle[0].label)}</small></div></section>`;
  }
  const done = logged(now).filter((w) => w.end);
  const next = itemOn(ap.plan, ap.start, addDays(now, 1));
  const m = itemMins(t.item);
  return `<section class="card plan-today k-${t.item.kind}">
    <div class="card-h"><span class="kicker">Today · week ${t.week}, day ${t.day}</span>${link}</div>
    <div class="row"><div class="grow"><h2>${esc(t.item.label)}</h2><small class="muted">${m ? `${m} min · ` : ''}${esc(ap.plan.name)}</small></div>${done.length ? '<span class="saved">✓ Done today</span>' : goButton(t.item)}</div>
    <small class="muted">Tomorrow: ${esc(next.item.label)}</small>
  </section>`;
}

// ── Calendar ──
const monthStart = (ts) => { const d = new Date(ts); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); };
function calendar(ap) {
  const today = startOfDay(Date.now());
  const first = ui.calMonth || monthStart(today);
  const sel = ui.calSel || today;
  const fd = new Date(first);
  const month = fd.getMonth();
  let h = `<div class="cal-head"><button class="icon-btn sm" data-a="cal-nav" data-d="-1" aria-label="Previous month">‹</button><b>${fd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><button class="icon-btn sm" data-a="cal-nav" data-d="1" aria-label="Next month">›</button></div>
    <div class="cal-grid"><span class="cal-dow">S</span><span class="cal-dow">M</span><span class="cal-dow">T</span><span class="cal-dow">W</span><span class="cal-dow">T</span><span class="cal-dow">F</span><span class="cal-dow">S</span>`;
  for (let i = 0; i < fd.getDay(); i++) h += '<span></span>';
  for (let d = new Date(first); d.getMonth() === month; d.setDate(d.getDate() + 1)) {
    const ts = d.getTime();
    const t = itemOn(ap.plan, ap.start, ts);
    const did = logged(ts).length > 0;
    const cls = ['cday', t ? 'k-' + t.item.kind : 'off', ts === today ? 'today' : '', ts === sel ? 'sel' : '', did ? 'did' : ''].filter(Boolean).join(' ');
    h += `<button class="${cls}" data-a="cal-day" data-ts="${ts}" aria-label="${fmtDate(ts, { weekday: true })}: ${t ? esc(t.item.label) : 'before the plan starts'}${did ? ', workout logged' : ''}" aria-pressed="${ts === sel}">
      <i>${d.getDate()}</i><span>${t ? esc(t.item.short) : ''}</span>${did ? '<em aria-hidden="true">✓</em>' : ''}</button>`;
  }
  h += '</div>';

  // The selected day, spelled out
  const t = itemOn(ap.plan, ap.start, sel);
  const logs = logged(sel);
  h += `<div class="cal-detail"><div class="row"><div class="grow"><small>${fmtDate(sel, { weekday: true })}${sel === today ? ' · today' : ''}${t ? ` · week ${t.week}, day ${t.day}` : ''}</small>
    <b>${t ? esc(t.item.label) : 'Before the plan starts'}</b>${t && itemMins(t.item) ? `<span class="muted"> · ${itemMins(t.item)} min</span>` : ''}</div>
    ${t && sel === today && !logs.some((w) => w.end) ? goButton(t.item, 'btn primary sm') : ''}</div>
    ${logs.map((w) => `<button class="link" data-a="open-workout" data-id="${w.id}">✓ Logged: ${esc(w.title)} →</button>`).join('')}</div>`;
  return h;
}

function following(ap) {
  const now = Date.now();
  const t = itemOn(ap.plan, ap.start, now);
  return `<section class="card following">
    <div><span class="kicker">You're following</span><h2>${esc(ap.plan.name)}</h2>
    <small class="muted">Day 1 ${t ? 'was' : 'is'} ${fmtDate(ap.start, { weekday: true, year: true })}${t ? ` · now in week ${t.week}` : ''}</small></div>
    ${calendar(ap)}
    <div class="legend">${['s', 'c', 'y', 'w', 'r'].filter((k) => ap.plan.cycle.some((d) => d.kind === k)).map((k) => `<span><i class="kdot k-${k}"></i>${KIND_NAME[k]}</span>`).join('')}<span><em class="kcheck">✓</em>Workout logged</span></div>
    <div class="row wrap"><button class="btn sm" data-a="plan-shift">Missed a day? Push back 1 day</button><button class="btn sm" data-a="plan-follow" data-id="${ap.plan.id}">Change start date</button><button class="btn sm danger-text" data-a="plan-stop">Stop</button></div>
  </section>`;
}

function planCard(plan, ap, open) {
  const mine = ap && ap.plan.id === plan.id;
  const t = mine ? itemOn(plan, ap.start, Date.now()) : null;
  return `<details class="group"${open || mine ? ' open' : ''}><summary><span><b>${esc(plan.name)}${plan.tag ? ` <i class="tag">${esc(plan.tag)}</i>` : ''}</b><small>${summary(plan)}</small></span></summary>
    <div class="card">
      <p class="muted">${esc(plan.desc)}</p>
      <div class="sub-h">The cycle</div>
      ${flow(plan, t ? t.day : 0)}
      <div class="sub-h">How to use it</div>
      <ul class="guide">${plan.how.map((x) => `<li>${esc(x)}</li>`).join('')}<li>Missed a day? Do it on your next free day and push the plan back. Don't double up.</li></ul>
      ${mine ? '<span class="saved">✓ You\'re following this plan</span>' : `<button class="btn primary big" data-a="plan-follow" data-id="${plan.id}">Follow this plan</button>`}
    </div>
  </details>`;
}

export function plansPanel() {
  const ap = activePlan();
  let h = ap ? following(ap) : `<p class="hint">A plan tells you which routine to do on which day, and how often. Pick one, choose the date of day 1, and a calendar fills in with what to do on each date.</p>`;
  h += PLANS.map((p, i) => planCard(p, ap, !ap && i === 0)).join('');
  h += `<p class="hint">The 55+ plans follow the same ACSM and CDC guidance as the 55+ routines. General fitness guidance, not medical advice.</p>`;
  return h;
}

// ── Actions ──
on('plan-follow', (el) => {
  const plan = PLANS.find((p) => p.id === el.dataset.id);
  const ap = activePlan();
  const start = ap && ap.plan.id === plan.id ? ap.start : Date.now();
  openSheet({
    cls: 'dialog',
    html: `<h3>${esc(plan.name)}</h3><p>Which date is day 1 (${esc(plan.cycle[0].label)})? The calendar fills in from there.</p>
      <form data-s="plan-start" data-id="${plan.id}"><label class="fld"><span>Day 1</span><input type="date" name="d" value="${dayKey(start)}" required></label>
      <div class="row end"><button type="button" class="btn" data-a="dlg-no">Cancel</button><button class="btn primary">${ap && ap.plan.id === plan.id ? 'Save' : 'Start plan'}</button></div></form>`,
  });
});
onSubmit('plan-start', (form) => {
  const [y, m, d] = form.d.value.split('-').map(Number);
  if (!y) return;
  setSetting('plan', { id: form.dataset.id, start: new Date(y, m - 1, d).getTime() });
  ui.calMonth = null; ui.calSel = null;
  closeSheet();
  render();
  window.scrollTo(0, 0);
  toast('Plan set. Today shows on Home.');
});
on('plan-shift', () => {
  const ap = activePlan();
  setSetting('plan', { id: ap.plan.id, start: addDays(ap.start, 1) });
  render();
  toast('Everything moved back one day');
});
on('plan-stop', async () => {
  const ap = activePlan();
  if (!(await confirmBox({ title: `Stop following “${ap.plan.name}”?`, body: 'Your logged workouts and saved routines stay as they are.', ok: 'Stop', cancel: 'Keep following', danger: true }))) return;
  setSetting('plan', null);
  render();
});
on('cal-nav', (el) => {
  const d = new Date(ui.calMonth || monthStart(Date.now()));
  d.setMonth(d.getMonth() + +el.dataset.d);
  ui.calMonth = d.getTime();
  render();
});
on('cal-day', (el) => { ui.calSel = +el.dataset.ts; render(); });
on('plan-go', (el) => { const r = routineFromTemplate(tplById(el.dataset.tpl)); startWorkout({ title: r.name, from: r }); });
on('plan-walk', () => startWorkout({ title: 'Walk', from: { exercises: [{ exId: 'walk', sets: [{}] }] } }));
