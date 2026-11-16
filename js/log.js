// The Workout tab: logging sets live, and reviewing a finished workout.
import { state, saveWorkout, deleteWorkout, activeWorkout, getWorkout, exOf } from './store.js';
import { ui, on, onChange, registerView, render, go, toast, confirmBox, promptBox, openPad, openSheet, closeSheet, startRest, primeAudio, badge, icons } from './core.js';
import { TYPES, FIELDS } from './lib.js';
import { prevSession, exSummary, wVol, wSets } from './stats.js';
import { spark } from './charts.js';
import { esc, num, clock, mins, fmtDate, fmtTime, fmtSet, fmtSets, plural } from './util.js';
import { startWorkout, addExercise, ghosts, newRecords, routineFromWorkout, typeKeys, blank } from './workout.js';
import { openPicker } from './exercises.js';
import { shareText, shareImage, workoutText } from './share.js';

const current = () => getWorkout(ui.openId) || activeWorkout();
const KIND_LABEL = { w: 'W', d: 'D', f: 'F' };
const KIND_NAME = { w: 'Warm-up set', d: 'Drop set', f: 'Set to failure' };

function cell(ei, si, f, s, g, live) {
  const def = FIELDS[f], sc = def.scale || 1;
  const v = s[def.key], gv = g[def.key];
  if (!live) return `<span class="cell ro">${v != null ? num(v / sc, 2) : '–'}</span>`;
  const txt = v != null ? num(v / sc, 2) : gv != null ? num(gv / sc, 2) : def.unit;
  const cls = v != null ? '' : gv != null ? ' ghost' : ' ph';
  return `<button class="cell${cls}" data-a="cell" data-ei="${ei}" data-si="${si}" data-f="${f}" aria-label="${def.label}, set ${si + 1}${v == null && gv != null ? ', suggested ' + txt : ''}">${txt}</button>`;
}

function exCard(w, we, ei, live) {
  const ex = exOf(we);
  const fields = (TYPES[ex.type] || TYPES.wr).fields;
  const prev = prevSession(we.exId, w);
  const sum = exSummary(we.exId);
  const g = live ? ghosts(w, we) : [];
  let hist = '';
  if (prev) {
    const bits = [`<span><b>Last</b> ${fmtDate(prev.at)}: ${esc(fmtSets(prev.sets))}</span>`];
    if (sum.best) bits.push(`<span><b>Best</b> ${num(sum.best.w)}${sum.best.r ? '×' + sum.best.r : ''} (${fmtDate(sum.best.at)})</span>`);
    else if (sum.longest) bits.push(`<span><b>Best</b> ${clock(sum.longest.t)} (${fmtDate(sum.longest.at)})</span>`);
    bits.push(`<span>${plural(sum.count, 'session')}</span>`);
    hist = `<div class="ex-hist">${bits.join('')}${sum.trend.filter(Boolean).length > 1 ? spark(sum.trend) : ''}</div>`;
  }
  const rows = we.sets.map((s, si) => {
    const p = prev && prev.sets[si];
    const kind = KIND_LABEL[s.kind];
    return `<div class="srow${s.done ? ' done' : ''}" style="--n:${fields.length}">
      ${live ? `<button class="snum${kind ? ' k' : ''}" data-a="set-kind" data-ei="${ei}" data-si="${si}" aria-label="Set ${si + 1}${kind ? ', ' + KIND_NAME[s.kind] : ''}. Tap to change set type">${kind || si + 1}</button>` : `<span class="snum${kind ? ' k' : ''}">${kind || si + 1}</span>`}
      <span class="sprev">${p ? esc(fmtSet(p)) : '–'}${si === 0 && prev && prev.sets.length !== we.sets.length ? `<small>${plural(prev.sets.length, 'set')} last time</small>` : ''}</span>
      ${fields.map((f) => cell(ei, si, f, s, g[si] || {}, live)).join('')}
      ${live ? `<button class="chk" data-a="set-done" data-ei="${ei}" data-si="${si}" aria-pressed="${!!s.done}" aria-label="Set ${si + 1} complete">${icons.check}</button>` : `<span class="chk ro${s.done ? ' on' : ''}">${s.done ? icons.check : ''}</span>`}
    </div>`;
  }).join('');
  return `<section class="card ex" id="ex-${ei}">
    <div class="ex-head">
      <button class="ex-name" data-a="ex-detail" data-id="${esc(we.exId)}">${esc(ex.name)}</button>
      ${live ? `<button class="icon-btn sm" data-a="ex-menu" data-ei="${ei}" aria-label="Options for ${esc(ex.name)}">${icons.dots}</button>` : ''}
    </div>
    <div class="ex-sub">${badge(ex.cat)}<span>${esc([ex.muscle, ex.equip].filter(Boolean).join(' · '))}</span></div>
    ${hist}
    <div class="sets">
      <div class="srow shead" style="--n:${fields.length}"><span>SET</span><span>PREVIOUS</span>${fields.map((f) => `<span>${FIELDS[f].head}</span>`).join('')}<span>${live ? '✓' : ''}</span></div>
      ${rows}
    </div>
    ${live ? `<div class="row set-btns"><button class="btn sm grow" data-a="set-add" data-ei="${ei}">+ Add set</button>${we.sets.length > 1 ? `<button class="btn sm" data-a="set-del" data-ei="${ei}">− Set</button>` : ''}</div>` : ''}
  </section>`;
}

registerView('log', () => {
  const w = current();
  if (!w) {
    const last = state.workouts[0];
    return `<div class="empty-box"><div class="empty-ic">${icons.log}</div><h2>No workout open</h2><p>Start one from Home, or open any past workout from History to review it here.</p>
      <div class="stack"><button class="btn primary big" data-a="go" data-tab="home">Start a workout</button>${last ? `<button class="btn big" data-a="open-workout" data-id="${last.id}">Open my last workout</button>` : ''}</div></div>`;
  }
  const live = !w.end;
  const vol = wVol(w), sets = wSets(w);
  const meta = [live ? `Started ${fmtTime(w.start)}` : `${fmtDate(w.start, { weekday: true })} · ${fmtTime(w.start)}`];
  meta.push(live ? `<span class="elapsed">Elapsed <b id="elapsed">${clock((Date.now() - w.start) / 1000)}</b></span>` : mins(w.end - w.start));
  meta.push(plural(sets, 'set'));
  if (vol) meta.push(`${num(vol, 0)} lb`);
  let h = `<section class="whead">
    <input class="wtitle" value="${esc(w.title)}" data-c="w-title" aria-label="Workout name" autocomplete="off" enterkeyhint="done">
    <div class="wmeta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
    ${live
    ? `<div class="row"><button class="btn primary grow" data-a="w-finish">Finish workout</button><button class="btn danger-text" data-a="w-discard">Discard</button></div>`
    : `<div class="row wrap"><button class="btn" data-a="w-share">${icons.share}Share</button><button class="btn" data-a="w-repeat">Repeat</button><button class="btn" data-a="w-routine">Save as routine</button><button class="btn" data-a="w-reopen">Reopen</button></div>`}
  </section>`;
  if (live) {
    h += `<div class="restrow"><span class="lbl">REST</span>${[60, 90, 120, 180].map((s) => `<button class="pill" data-a="rest" data-sec="${s}">${clock(s)}</button>`).join('')}</div>`;
    if (w.exercises.length) h += `<p class="hint">Tap a number to change it. Grey numbers are from last time: leave them and tap ✓ to log the same again.</p>`;
  } else {
    h += `<p class="hint">This workout is saved in History. Reopen it to add or change sets.</p>`;
  }
  h += w.exercises.map((we, ei) => exCard(w, we, ei, live)).join('');
  if (live) {
    h += `<button class="btn big add-ex" data-a="ex-add">${icons.plus}Add exercise</button>`;
    if (!w.exercises.length) h += `<p class="hint center">No exercises yet. Add your first one: machines, free weights, bodyweight, cardio or yoga.</p>`;
  }
  h += `<label class="fld notes"><span>Notes</span><textarea rows="2" data-c="w-notes" placeholder="How did it go?">${esc(w.notes || '')}</textarea></label>`;
  if (live && w.exercises.length) h += `<button class="link block" data-a="w-routine">Save these exercises as a routine</button>`;
  if (!live) h += `<button class="btn danger-text center-btn" data-a="w-delete">Delete this workout</button>`;
  return h;
});

const ctx = (el) => {
  const w = current();
  const we = w.exercises[+el.dataset.ei];
  return { w, we, s: we && el.dataset.si != null ? we.sets[+el.dataset.si] : null, ex: we && exOf(we) };
};

onChange('w-title', (el) => { const w = current(); const v = el.value.trim(); if (!w) return; if (!v) { el.value = w.title; return; } w.title = v; saveWorkout(w); });
onChange('w-notes', (el) => { const w = current(); if (w) { w.notes = el.value.trim(); saveWorkout(w); } });

on('open-workout', (el) => { ui.openId = el.dataset.id; go('log'); });

on('cell', (el) => {
  const { w, we, s, ex } = ctx(el);
  const f = el.dataset.f, def = FIELDS[f], sc = def.scale || 1;
  const si = +el.dataset.si;
  const g = ghosts(w, we)[si][def.key];
  const start = s[def.key] ?? g;
  openPad({
    title: `${ex.name} · Set ${si + 1}`, field: f, value: start == null ? null : start / sc,
    onDone: (v) => { s[def.key] = v == null ? null : Math.round(v * sc * 100) / 100; saveWorkout(w); render(); },
  });
});

on('set-done', (el) => {
  const { w, we, s, ex } = ctx(el);
  if (s.done) { s.done = false; saveWorkout(w); render(); return; }
  const g = ghosts(w, we)[+el.dataset.si];
  const keys = typeKeys(ex);
  for (const k of keys) if (s[k] == null && g[k] != null) s[k] = g[k];
  if (keys.every((k) => s[k] == null)) { toast('Enter a number for this set first'); el.parentElement.querySelector('.cell').click(); return; }
  s.done = true;
  saveWorkout(w);
  primeAudio();
  startRest(ex.cat === 'y' ? state.settings.restYoga : state.settings.rest);
  render();
});

on('set-kind', (el) => {
  const { w, s } = ctx(el);
  const order = [undefined, 'w', 'd', 'f'];
  const next = order[(order.indexOf(s.kind) + 1) % order.length];
  if (next) s.kind = next; else delete s.kind;
  saveWorkout(w); render();
  toast(next ? KIND_NAME[next] : 'Normal set');
});
on('set-add', (el) => { const { w, we } = ctx(el); we.sets.push(blank()); saveWorkout(w); render(); });
on('set-del', (el) => { const { w, we } = ctx(el); if (we.sets.length > 1) { we.sets.pop(); saveWorkout(w); render(); } });

on('ex-add', () => openPicker({
  onPick: (id) => {
    const w = current();
    addExercise(w, id);
    render();
    const card = document.getElementById('ex-' + (w.exercises.length - 1));
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
}));

on('ex-menu', (el) => {
  const { w, we, ex } = ctx(el);
  const ei = +el.dataset.ei;
  openSheet({
    cls: 'menu',
    html: `<h3>${esc(ex.name)}</h3>
      ${ei > 0 ? `<button class="menu-item" data-a="ex-move" data-ei="${ei}" data-d="-1">Move up</button>` : ''}
      ${ei < w.exercises.length - 1 ? `<button class="menu-item" data-a="ex-move" data-ei="${ei}" data-d="1">Move down</button>` : ''}
      <button class="menu-item" data-a="ex-detail-close" data-id="${esc(we.exId)}">Details and history</button>
      <button class="menu-item danger-text" data-a="ex-remove" data-ei="${ei}">Remove from this workout</button>
      <button class="btn big" data-a="sheet-close">Cancel</button>`,
  });
});
on('ex-move', (el) => {
  const w = current(), i = +el.dataset.ei, j = i + +el.dataset.d;
  [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]];
  saveWorkout(w); closeSheet(); render();
});
on('ex-remove', async (el) => {
  const { w, we, ex } = ctx(el);
  closeSheet();
  const n = we.sets.filter((s) => s.done).length;
  if (n && !(await confirmBox({ title: `Remove ${ex.name}?`, body: `${plural(n, 'completed set')} will be removed from this workout.`, ok: 'Remove', danger: true }))) return;
  w.exercises.splice(w.exercises.indexOf(we), 1);
  saveWorkout(w); render();
});

on('w-finish', async () => {
  const w = current();
  if (!wSets(w)) {
    const ok = await confirmBox({ title: 'Nothing to save yet', body: 'No sets are marked complete, so finishing now discards this workout. Nothing will be saved to History.', ok: 'Discard workout', cancel: 'Keep going', danger: true });
    if (!ok) return;
    await deleteWorkout(w.id);
    ui.openId = null; ui.rest = null;
    go('home');
    toast('Workout discarded — nothing was saved');
    return;
  }
  const open = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  if (open && !(await confirmBox({ title: 'Finish workout?', body: `${plural(open, 'set')} not marked complete will be left out.`, ok: 'Finish', cancel: 'Keep going' }))) return;
  for (const e of w.exercises) e.sets = e.sets.filter((s) => s.done);
  w.exercises = w.exercises.filter((e) => e.sets.length);
  w.end = Date.now();
  ui.rest = null;
  saveWorkout(w);
  render();
  window.scrollTo(0, 0);
  const prs = newRecords(w);
  const vol = wVol(w);
  openSheet({
    cls: 'dialog done-sheet',
    html: `<div class="done-ic">${icons.check}</div><h3>Workout saved</h3>
      <div class="figs"><div><b>${mins(w.end - w.start)}</b><span>Time</span></div><div><b>${wSets(w)}</b><span>Sets</span></div>${vol ? `<div><b>${num(vol, 0)}</b><span>Pounds</span></div>` : ''}</div>
      ${prs.length ? `<div class="pr-list"><div class="sub-h">New personal records</div>${prs.map((p) => `<div class="pr"><b>${esc(p.name)}</b><span>${num(p.w)} × ${p.r} <small>was ${num(p.before)}</small></span></div>`).join('')}</div>` : ''}
      <div class="stack"><button class="btn primary big" data-a="w-share">${icons.share}Share this workout</button><button class="btn big" data-a="sheet-close">Done</button></div>`,
  });
});

on('w-discard', async () => {
  const w = current();
  const n = wSets(w);
  const ok = await confirmBox({ title: 'Discard this workout?', body: n ? `${plural(n, 'completed set')} will be deleted. This can't be undone.` : 'Nothing has been logged yet.', ok: 'Discard', danger: true });
  if (!ok) return;
  await deleteWorkout(w.id);
  ui.openId = null; ui.rest = null;
  go('home');
  toast('Workout discarded');
});

on('w-reopen', () => {
  const w = current(), act = activeWorkout();
  if (act && act.id !== w.id) { toast('Finish your workout in progress first'); return; }
  w.end = null;
  saveWorkout(w); render();
});

on('w-repeat', (el) => {
  const w = el.dataset.id ? getWorkout(el.dataset.id) : current();
  startWorkout({ title: w.title.replace(/ \(repeat\)$/, '') + ' (repeat)', from: { exercises: w.exercises.map((we) => ({ exId: we.exId, sets: we.sets.map(() => ({})) })) } });
});

on('w-routine', async (el) => {
  const w = el.dataset.id ? getWorkout(el.dataset.id) : current();
  if (!w.exercises.length) { toast('Add an exercise first'); return; }
  const name = await promptBox({ title: 'Save as routine', label: 'Routine name', value: w.title, ok: 'Save routine' });
  if (!name) return;
  routineFromWorkout(w, name);
  toast('Routine saved');
  render();
});

on('w-delete', async (el) => {
  const w = el.dataset.id ? getWorkout(el.dataset.id) : current();
  const ok = await confirmBox({ title: 'Delete this workout?', body: `${w.title}, ${fmtDate(w.start, { year: true })}: ${plural(wSets(w), 'set')}${wVol(w) ? ` and ${num(wVol(w), 0)} lb` : ''}. This can't be undone.`, ok: 'Delete', danger: true });
  if (!ok) return;
  await deleteWorkout(w.id);
  if (ui.openId === w.id) ui.openId = null;
  if (ui.tab === 'log') go('history'); else render();
  toast('Workout deleted');
});

on('w-share', (el) => {
  const w = el.dataset.id ? getWorkout(el.dataset.id) : current();
  if (document.querySelector('.done-sheet')) closeSheet();
  openSheet({
    cls: 'menu',
    html: `<h3>Share “${esc(w.title)}”</h3>
      <button class="menu-item" data-a="share-img" data-id="${w.id}">As a picture</button>
      <button class="menu-item" data-a="share-txt" data-id="${w.id}">As text</button>
      <button class="btn big" data-a="sheet-close">Cancel</button>`,
  });
});
on('share-img', (el) => { const w = getWorkout(el.dataset.id); closeSheet(); shareImage(w); });
on('share-txt', (el) => { const w = getWorkout(el.dataset.id); closeSheet(); shareText(workoutText(w), w.title); });
