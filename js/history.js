// History tab: every logged workout, set by set.
import { state, exOf } from './store.js';
import { ui, on, onInput, registerView, render, icons } from './core.js';
import { totals, wVol, wSets, doneSets } from './stats.js';
import { norm } from './lib.js';
import { esc, num, abbr, mins, fmtDate, fmtTime, fmtMonth, fmtSets, plural } from './util.js';

function card(w) {
  const vol = wVol(w);
  return `<article class="card hist">
    <button class="hist-main" data-a="open-workout" data-id="${w.id}">
      <span class="hist-h"><b>${esc(w.title)}</b><span class="${w.end ? 'dur' : 'live-tag'}">${w.end ? mins(w.end - w.start) : 'LIVE'}</span></span>
      <small>${fmtDate(w.start, { weekday: true })} · ${fmtTime(w.start)} · ${plural(w.exercises.length, 'exercise')} · ${plural(wSets(w), 'set')}${vol ? ` · ${num(vol, 0)} lb` : ''}</small>
      <span class="hist-ex">${w.exercises.map((we) => `<span><b>${esc(exOf(we).name)}</b><i>${esc(fmtSets(doneSets(we)))}</i></span>`).join('')}</span>
    </button>
    <div class="row hist-btns"><button class="btn sm" data-a="w-repeat" data-id="${w.id}">Repeat</button><button class="btn sm" data-a="w-routine" data-id="${w.id}">Save routine</button><button class="btn sm" data-a="w-share" data-id="${w.id}">Share</button><span class="grow"></span><button class="btn sm danger-text" data-a="w-delete" data-id="${w.id}">Delete</button></div>
  </article>`;
}

function list() {
  const q = norm(ui.histQ);
  const all = q ? state.workouts.filter((w) => norm(w.title).includes(q) || w.exercises.some((we) => norm(exOf(we).name).includes(q))) : state.workouts;
  if (!all.length) return `<p class="empty">No workouts match “${esc(ui.histQ)}”.</p>`;
  let h = q ? `<div class="count">${plural(all.length, 'workout')} matching “${esc(ui.histQ)}”</div>` : '';
  let month = '';
  for (const w of all.slice(0, ui.histN)) {
    const m = fmtMonth(w.start);
    if (m !== month) { month = m; h += `<h3 class="month">${m}</h3>`; }
    h += card(w);
  }
  if (all.length > ui.histN) h += `<button class="btn big" data-a="hist-more">Show more (${all.length - ui.histN} older)</button>`;
  return h;
}

registerView('history', () => {
  if (!state.workouts.length) {
    return `<div class="empty-box"><div class="empty-ic">${icons.history}</div><h2>No workouts yet</h2><p>Each workout you finish shows up here with full set-by-set detail. Tracked somewhere else before? Bring it in.</p>
      <div class="stack"><button class="btn primary big" data-a="start-now">Start a workout</button><button class="btn big" data-a="import-pick">Import my history</button></div></div>`;
  }
  const t = totals();
  return `<div class="stats three"><div><b>${num(t.workouts, 0)}</b><span>Workouts</span></div><div><b>${num(t.sets, 0)}</b><span>Sets</span></div><div><b>${abbr(t.vol)}</b><span>Lb lifted</span></div></div>
    <label class="search">${icons.search}<input type="search" value="${esc(ui.histQ)}" placeholder="Search workouts or exercises" data-i="hist-q" autocomplete="off" autocapitalize="off" aria-label="Search history"></label>
    <div id="hist-list">${list()}</div>`;
});

onInput('hist-q', (el) => { ui.histQ = el.value; ui.histN = 20; document.getElementById('hist-list').innerHTML = list(); });
on('hist-more', () => { ui.histN += 30; document.getElementById('hist-list').innerHTML = list(); });
