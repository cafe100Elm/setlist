// The built-in walkthrough: a short tour of the app, one idea per step, each
// with a small picture drawn from the app's own pieces (sample numbers only).
// Opens from Home (first time) and from Settings → How to use Setlist.
import { on, openSheet, closeSheet, go, setSetting, render, ui, icons, badge } from './core.js';
import { barChart } from './charts.js';

const row = (n, prev, cells, done) => `<div class="srow${done ? ' done' : ''}" style="--n:${cells.length}"><span class="snum">${n}</span><span class="sprev">${prev}</span>${cells.map(([v, ghost]) => `<span class="cell${ghost ? ' ghost' : ''}">${v}</span>`).join('')}<span class="chk">${icons.check}</span></div>`;
const head = (cols) => `<div class="srow shead" style="--n:${cols.length}"><span>SET</span><span>PREVIOUS</span>${cols.map((c) => `<span>${c}</span>`).join('')}<span>✓</span></div>`;

const STEPS = [
  {
    title: 'Welcome to Setlist',
    body: ['A workout log that lives on your phone. No account needed, and nothing you log leaves this device unless you turn on sync.', 'Five tabs run along the bottom: Home, Workout, Library, Insights and History. This tour takes about two minutes.'],
    art: () => `<div class="stats"><div><b>220</b><span>Workouts</span></div><div><b>3</b><span>This week</span></div><div><b>2<small>d</small></b><span>Streak</span></div><div><b>2.7M</b><span>Lb lifted</span></div></div>
      <div class="t-tabs">${[['home', 'Home'], ['log', 'Workout'], ['library', 'Library'], ['insights', 'Insights'], ['history', 'History']].map(([k, l], i) => `<span class="tab${i === 0 ? ' on' : ''}">${icons[k]}<span>${l}</span></span>`).join('')}</div>`,
  },
  {
    title: 'Start a workout',
    body: ['Three ways to begin: an empty workout, one of your routines, or today\'s item from a plan.', 'Inside a workout, tap + Add exercise and search by name, muscle or equipment. Your most-used exercises come first.'],
    go: { tab: 'home', label: 'Go to Home' },
    art: () => `<div class="card start"><h2>Start a workout</h2><div class="row"><span class="t-input">Name it (optional)</span><span class="btn primary">Start →</span></div>
      <div class="tiles"><span class="tile"><b>Upper</b><small>8 exercises · ≈ 31 min</small></span><span class="tile"><b>Legs</b><small>7 exercises · ≈ 27 min</small></span></div></div>`,
  },
  {
    title: 'Log a set with one tap',
    body: ['Grey numbers are what you did last time. Did the same again? Just tap ✓.', 'Did something different? Tap the number and a big number pad opens. No keyboard needed.'],
    art: () => `<div class="card ex"><div class="ex-head"><span class="ex-name">Leg Press</span></div><div class="ex-sub">${badge('m')}<span>Quads · Machine</span></div>
      <div class="sets">${head(['LB', 'REPS'])}${row(1, '100×12', [['100'], ['12']], true)}${row(2, '120×12', [['120', 1], ['12', 1]], false)}</div></div>`,
  },
  {
    title: 'The coach tells you what to aim for',
    body: ['For each exercise the coach looks at your last sessions. Hit your usual reps two sessions running and it raises the weight one step. Fall short and it keeps the weight and asks for one more rep.', 'Tap Use to put the targets into your sets. When you finish, it lists what to aim for next time.'],
    art: () => `<div class="card ex"><div class="ex-head"><span class="ex-name">Leg Press</span></div>
      <div class="coach"><div class="coach-t"><span><b>Aim</b> 105×12 · 125×12</span><small>You hit your reps two sessions running, so go up a step.</small></div><span class="btn sm">Use</span></div>
      <div class="sets">${head(['LB', 'REPS'])}${row(1, '100×12', [['105'], ['12']], false)}${row(2, '120×12', [['125'], ['12']], false)}</div></div>`,
  },
  {
    title: 'Rest timer and staying on time',
    body: ['A rest timer starts each time you tap ✓. It sits at the bottom so nothing moves under your thumb.', 'Set a session time target in Settings, say 45 minutes, and the workout tells you whether you\'re on track.'],
    art: () => `<div class="t-rest"><span class="rest-l">REST</span><b>1:12</b><span>/ 1:30</span><span class="grow"></span><span class="t-pill">+15s</span><span class="t-pill">Skip</span></div>
      <div class="whead"><div class="wmeta"><span>Started 6:32 AM</span><span>Elapsed <b>29:10</b></span><span>11 sets</span></div><div class="eta">About 14 min left · on track for 43 min of your 45</div></div>`,
  },
  {
    title: 'Routines know how long they take',
    body: ['Library → Routines. Build your own, save any workout as a routine, or start from a template.', 'Each routine shows its length at your own pace, measured from your past workouts, and whether it fits your time target.'],
    go: { tab: 'library', lib: 'routines', label: 'Go to Routines' },
    art: () => `<div class="card rt"><h3>Upper</h3><div class="chips"><span class="chip time fits">≈ 38 min · fits your 45</span></div>
      <ul class="rx"><li>${badge('m')}<span>Chest Press Machine</span><b>2×12</b></li><li>${badge('m')}<span>Lat Pulldown</span><b>2×12</b></li><li>${badge('c')}<span>Stationary Bike</span><b>12 min</b></li></ul></div>`,
  },
  {
    title: 'Plans say what to do on which day',
    body: ['Library → Plans. Pick a plan and the date of day 1, and a calendar fills in with what to do on each date.', 'Home then shows today\'s item with a Start button. Missed a day? Push the whole plan back so you never double up.'],
    go: { tab: 'library', lib: 'plans', label: 'Go to Plans' },
    art: () => `<div class="flow"><div class="fnode k-s now"><small>Day 1 · today</small><b>Foundation A</b><span>≈ 19 min</span></div><i class="farrow">→</i><div class="fnode k-w"><small>Day 2</small><b>Easy walk</b><span>≈ 25 min</span></div><i class="farrow">→</i><div class="fnode k-s"><small>Day 3</small><b>Foundation B</b><span>≈ 21 min</span></div></div>
      <div class="cal-grid">${[['23', 'A', 's', 1], ['24', 'Walk', 'w', 1], ['25', 'B', 's'], ['26', 'Walk', 'w'], ['27', 'Mob', 'y'], ['28', 'Walk', 'w'], ['29', 'Rest', 'r']].map(([d, l, k, did]) => `<span class="cday k-${k}${d === '25' ? ' today' : ''}"><i>${d}</i><span>${l}</span>${did ? '<em>✓</em>' : ''}</span>`).join('')}</div>`,
  },
  {
    title: 'Some things are just time',
    body: ['Your mat routine (Matt), a dog walk, the bike: these are logged in minutes.', 'Tap the minutes box and choose "Time since I started" to record how long you\'ve been going.'],
    art: () => `<div class="card ex"><div class="ex-head"><span class="ex-name">Matt</span></div><div class="ex-sub">${badge('y')}<span>Full body · Mat</span></div>
      <div class="sets">${head(['MIN'])}${row(1, '30:00', [['32']], true)}</div></div>
      <div class="pad-chips"><span class="t-chip">Time since I started: 32 min</span></div>`,
  },
  {
    title: 'See your progress',
    body: ['Insights shows volume by week, a consistency calendar, strength progress for every lift, and your personal records.', 'History keeps every workout, set by set. Search it, repeat a workout, or share one as a picture.'],
    go: { tab: 'insights', label: 'Go to Insights' },
    art: () => `<div class="card">${barChart({ data: [8, 11, 6, 13, 9, 15, 12, 17].map((v, i) => ({ label: `W${i + 1}`, v: v * 1000 })), h: 110, hiLast: true })}
      <div class="lrow"><span><b>Leg Press</b><small>New record</small></span><span class="pr-badge">322 <small>est. 1RM</small></span></div></div>`,
  },
  {
    title: 'Train with friends',
    body: ['Tap the people button at the top to open Friends. Send a friend your invite link: they sign in with Google and ask to follow you, and you accept. Nobody sees anything of yours until you say yes.',
      'You see each other\'s finished workouts, can cheer them, and get a this-week scoreboard. You choose whether followers see full workouts or only summaries. Notes are never shared.'],
    art: () => `<div class="t-feed"><div class="wrow"><span class="wrow-t"><b>Sam · Legs <i class="live-tag">LIVE</i></b><small>Working out now · started 6:32 AM</small></span></div><div class="wrow"><span class="wrow-t"><b>Alex · Upper</b><small>Tue, Nov 24 · 41 min · 16 sets</small></span><span class="cheer-n">👏 2</span></div></div>
      <div class="board"><div class="brow bhead"><span></span><span>Workouts</span><span>Lb lifted</span></div><div class="brow"><span><i>1</i>Alex</span><span>3</span><span>31,200</span></div><div class="brow me"><span><i>2</i>You</span><span>2</span><span>24,600</span></div></div>`,
  },
  {
    title: 'Keep it safe, sync it, share it',
    body: ['Your log lives on this phone. About once a month, tap the gear → Save a backup file and put it in iCloud or Drive. The app reminds you.',
      'Use more than one device? Gear → Sync across devices → Sign in with Google on each one, and a workout logged on your phone shows up on your tablet within a minute. It is optional.',
      'To give a friend the app, tap the gear → Share the link. They install it the same way and get their own empty log.'],
    art: () => `<div class="t-sync"><span class="t-dev"><b>Phone</b><small>Legs · 7:10 AM</small></span><i class="farrow">⇄</i><span class="t-dev"><b>Tablet</b><small>Legs · 7:10 AM</small></span></div>
      <div class="stack"><span class="btn primary big">Save a backup file</span><span class="btn big">${icons.share}Share the link</span></div>`,
  },
];

let sheet = null;
function html(i) {
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return `
    <div class="sheet-top"><div class="sheet-head"><h3>How Setlist works</h3><button class="btn sm" data-a="tour-close">${last ? 'Done' : 'Close'}</button></div></div>
    <div class="sheet-scroll tour-body">
      <div class="t-art" aria-hidden="true">${s.art()}</div>
      <div class="t-text"><small>Step ${i + 1} of ${STEPS.length}</small><h2>${s.title}</h2>${s.body.map((p) => `<p>${p}</p>`).join('')}
        ${s.go ? `<button class="link" data-a="tour-go">${s.go.label} →</button>` : ''}</div>
    </div>
    <div class="tour-nav">
      <button class="btn" data-a="tour-step" data-d="-1"${i === 0 ? ' disabled' : ''}>Back</button>
      <div class="t-dots" role="img" aria-label="Step ${i + 1} of ${STEPS.length}">${STEPS.map((_, j) => `<i${j === i ? ' class="on"' : ''}></i>`).join('')}</div>
      <button class="btn primary" data-a="${last ? 'tour-close' : 'tour-step'}" data-d="1">${last ? 'Done' : 'Next'}</button>
    </div>`;
}

export function openTour() {
  ui.tour = 0;
  if (!ui.tourSeenSet) { setSetting('tourSeen', true); ui.tourSeenSet = true; }
  sheet = openSheet({ cls: 'tall tour', html: html(0), onClose: () => { sheet = null; render(); } });
  // swipe left / right to move between steps
  let x0 = null;
  sheet.body.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  sheet.body.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  }, { passive: true });
}
function step(d) {
  if (!sheet) return;
  const i = Math.max(0, Math.min(STEPS.length - 1, ui.tour + d));
  if (i === ui.tour) return;
  ui.tour = i;
  sheet.set(html(i));
}
on('tour', () => openTour());
on('tour-step', (el) => step(+el.dataset.d));
on('tour-close', () => closeSheet(sheet));
on('tour-go', () => {
  const g = STEPS[ui.tour].go;
  closeSheet(sheet);
  if (g.lib) ui.lib = g.lib;
  go(g.tab);
});
on('tour-skip', () => { setSetting('tourSeen', true); render(); });
document.addEventListener('keydown', (e) => { if (sheet && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) step(e.key === 'ArrowRight' ? 1 : -1); });
