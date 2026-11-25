// Home tab: totals, starting a workout, records and recent workouts.
import { state, activeWorkout, getEx, exOf } from './store.js';
import { ui, on, onSubmit, registerView, render, go, badge, icons, setSetting } from './core.js';
import { STARTERS } from './lib.js';
import { totals, series, prs, cardio, wVol, wSets, estimate } from './stats.js';
import { barChart } from './charts.js';
import { esc, num, abbr, clock, fmtDate, plural, isStandalone, isIOS, isAndroid } from './util.js';
import { startWorkout, routineFromTemplate } from './workout.js';
import { planToday } from './plans.js';
import { approxMin } from './coach.js';
import { friendsCard } from './friends.js';

export const workoutRow = (w) => {
  const cats = [...new Set(w.exercises.map((e) => exOf(e).cat))].slice(0, 4);
  const vol = wVol(w);
  return `<button class="wrow" data-a="open-workout" data-id="${w.id}">
    <span class="wrow-t"><b>${esc(w.title)}${w.end ? '' : ' <i class="live-tag">LIVE</i>'}</b>
    <small>${fmtDate(w.start, { weekday: true })} · ${plural(w.exercises.length, 'exercise')} · ${plural(wSets(w), 'set')}${vol ? ` · ${num(vol, 0)} lb` : ''}</small></span>
    <span class="wrow-b">${cats.map(badge).join('')}</span>
  </button>`;
};

registerView('home', () => {
  const t = totals();
  const act = activeWorkout();
  const empty = !state.workouts.length;
  let h = '';
  if (!state.storageOk) h += `<div class="card warn"><b>Workouts can't be saved in this browser window.</b><p>Private browsing blocks storage. Open Setlist in a normal window or install it to your home screen.</p></div>`;

  h += `<div class="stats">
    <div><b>${num(t.workouts, 0)}</b><span>Workouts</span></div>
    <div><b>${t.week}</b><span>This week</span></div>
    <div><b>${t.streak}<small>d</small></b><span>Streak</span></div>
    <div><b>${abbr(t.vol)}</b><span>Lb lifted</span></div>
  </div>`;

  // Offer the walkthrough once (new installs, and once after the tour was added)
  if (!state.settings.tourSeen) {
    h += `<section class="card install"><div><b>See how Setlist works</b><p>A two-minute tour: logging, the coach, time targets, plans and backups.</p></div>
      <div class="row"><button class="btn primary sm" data-a="tour">Take the tour</button><button class="btn sm" data-a="tour-skip">Not now</button></div></section>`;
  }
  h += planToday();
  h += friendsCard();

  // Start
  h += `<section class="card start">`;
  if (act) {
    h += `<button class="resume" data-a="resume"><span class="live-tag">LIVE</span><span class="resume-t"><b>${esc(act.title)}</b><small>${plural(act.exercises.length, 'exercise')} · <span id="resume-time">${clock((Date.now() - act.start) / 1000)}</span></small></span><span class="resume-go">Resume →</span></button>`;
  } else {
    h += `<h2>Start a workout</h2>
      <form class="row" data-s="start"><input name="title" placeholder="Name it (optional)" autocomplete="off" enterkeyhint="go" aria-label="Workout name"><button class="btn primary">Start →</button></form>`;
    const mine = state.routines.slice(0, 4);
    if (mine.length) {
      h += `<div class="tiles">${mine.map((r) => `<button class="tile" data-a="routine-start" data-id="${r.id}"><b>${esc(r.name)}</b><small>${plural(r.exercises.length, 'exercise')} · ≈ ${approxMin(estimate(r.exercises).sec)} min${r.desc ? ' · ' + esc(r.desc) : ''}</small></button>`).join('')}</div>`;
      if (state.routines.length > 4) h += `<button class="link block" data-a="go" data-tab="library" data-lib="routines">All ${state.routines.length} routines →</button>`;
    } else {
      h += `<div class="tiles">${STARTERS.slice(0, 4).map((r) => `<button class="tile" data-a="tpl-start" data-id="${r.id}"><i class="tag">STARTER</i><b>${esc(r.name)}</b><small>${plural(r.exercises.length, 'exercise')} · ≈ ${approxMin(estimate(r.exercises).sec)} min · ${esc(r.desc)}</small></button>`).join('')}</div>
        <button class="link block" data-a="go" data-tab="library" data-lib="routines">Browse all routines →</button>`;
    }
  }
  h += `</section>`;

  if (empty) {
    h += `<section class="card welcome">
      <h2>New here?</h2>
      <p>Everything you log is saved on this device. If you've tracked workouts before, bring them with you.</p>
      <button class="btn big" data-a="import-pick">Import my history</button>
      <small>Works with a Setlist backup, a Hevy export, or a Health Dashboard export.</small>
    </section>`;
  }

  if (!isStandalone() && (isIOS() || isAndroid()) && !state.settings.hideInstall) {
    h += `<section class="card install"><div><b>Put Setlist on your home screen</b><p>It opens like any other app and works without a signal.</p></div>
      <div class="row"><button class="btn primary sm" data-a="settings" data-sec="install">Show me how</button><button class="btn sm" data-a="hide-install">Not now</button></div></section>`;
  }

  if (!empty) {
    // Last 8 weeks
    const wk = series('12w').buckets.slice(-8);
    const c = cardio();
    h += `<div class="card tap" role="button" tabindex="0" data-a="go" data-tab="insights">
      <div class="card-h"><h2>Your last 8 weeks</h2><span class="more">Insights →</span></div>
      ${barChart({ data: wk.map((b) => ({ label: b.label, v: b.vol })), h: 120, hiLast: true })}
      <div class="trio"><div><b>${t.bestStreak}d</b><span>Best streak</span></div><div><b>${num(t.perWeek12, 1)}</b><span>Per week</span></div>${c.mi ? `<div><b>${num(c.mi, 1)}</b><span>Cardio mi</span></div>` : ''}</div>
    </div>`;

    const pr = prs().slice(0, 5);
    if (pr.length) {
      h += `<section class="card"><div class="card-h"><h2>Personal records</h2></div><div class="list">
        ${pr.map((p) => `<button class="lrow" data-a="ex-detail" data-id="${esc(p.exId)}"><span><b>${esc(p.name)}</b><small>${fmtDate(p.best.at, { year: true })}</small></span><span class="big-n">${num(p.best.w)} <small>lb × ${p.best.r}</small></span></button>`).join('')}
      </div></section>`;
    }

    h += `<section class="card"><div class="card-h"><h2>Recent workouts</h2><button class="more" data-a="go" data-tab="history">All →</button></div>
      <div class="list">${state.workouts.slice(0, 5).map(workoutRow).join('')}</div></section>`;

    // Backup reminder: on-device data deserves a copy somewhere else (sync already keeps one)
    const last = state.settings.lastBackup || 0;
    const since = state.workouts.filter((w) => w.start > last).length;
    if (!state.sync.on && since >= 5 && Date.now() - last > 30 * 864e5 && Date.now() - (state.settings.backupNudge || 0) > 14 * 864e5) {
      h += `<section class="card install"><div><b>Back up your log</b><p>${last ? `${plural(since, 'workout')} since your last backup.` : 'Your workouts live only on this device.'} A backup file keeps them safe if the phone is lost or replaced.</p></div>
        <div class="row"><button class="btn primary sm" data-a="backup">Save a backup</button><button class="btn sm" data-a="backup-later">Later</button></div></section>`;
    }
  }
  return h;
});

onSubmit('start', (form) => startWorkout({ title: form.title.value }));
on('routine-start', (el) => { const r = state.routines.find((x) => x.id === el.dataset.id); if (r) startWorkout({ title: r.name, from: r }); });
on('tpl-start', (el) => {
  const tpl = STARTERS.find((x) => x.id === el.dataset.id);
  const r = routineFromTemplate(tpl);
  startWorkout({ title: r.name, from: r });
});
on('hide-install', () => { setSetting('hideInstall', true); render(); });
on('backup-later', () => { setSetting('backupNudge', Date.now()); render(); });
