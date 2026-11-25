// The exercise picker, the exercise detail pop-up, and the custom exercise form.
import { state, uid, getEx, findExByName, allExercises, saveCustom, activeWorkout } from './store.js';
import { ui, on, onInput, onChange, onSubmit, openSheet, closeSheet, render, go, toast, confirmBox, badge, catIcon, icons } from './core.js';
import { CATS, CAT_ORDER, TYPES, norm } from './lib.js';
import { exSummary, progress, sessions } from './stats.js';
import { lineChart } from './charts.js';
import { esc, num, clock, mins, fmtDate, fmtShort, fmtSets, plural } from './util.js';
import { addExercise } from './workout.js';
import { coach } from './coach.js';

const DEFAULT_TYPE = { m: 'wr', f: 'wr', b: 'r', c: 'c', y: 't' };

// Search by name, muscle or equipment; most-used first
export function filterExercises(q, cat) {
  const words = norm(q).split(' ').filter(Boolean);
  return allExercises()
    .filter((e) => (cat === 'all' || e.cat === cat) && words.every((wd) => norm(`${e.name} ${e.muscle} ${e.equip} ${(e.aka || []).join(' ')}`).includes(wd)))
    .map((e) => ({ e, n: sessions(e.id).length, first: words.length && norm(e.name).startsWith(words[0]) ? 1 : 0 }))
    // names that start with what was typed come first, then most-used
    .sort((a, b) => b.first - a.first || b.n - a.n || a.e.name.localeCompare(b.e.name));
}

export const catPills = (active, action) => `<div class="pills">
  <button class="pill${active === 'all' ? ' on' : ''}" data-a="${action}" data-cat="all" aria-pressed="${active === 'all'}">All</button>
  ${CAT_ORDER.map((c) => `<button class="pill${active === c ? ' on' : ''}" data-a="${action}" data-cat="${c}" aria-pressed="${active === c}">${catIcon(c)}${CATS[c].short}</button>`).join('')}
</div>`;

export const exRow = ({ e, n }, action, extra = '') => `
  <div class="ex-row">
    <button class="ex-row-main" data-a="${action}" data-id="${esc(e.id)}">
      <span class="ex-row-t"><b>${esc(e.name)}</b><small>${esc([e.muscle, e.equip].filter(Boolean).join(' · '))}${n ? ` · ${plural(n, 'session')}` : ''}</small></span>
      ${badge(e.cat)}
    </button>${extra}
  </div>`;

// ── Picker ──
let P = null;
export function openPicker({ title = 'Add exercise', onPick }) {
  P = { q: '', cat: 'all', onPick };
  P.sheet = openSheet({
    cls: 'tall picker',
    html: `
      <div class="sheet-top">
        <div class="sheet-head"><h3>${esc(title)}</h3><button class="btn sm" data-a="sheet-close">Close</button></div>
        <label class="search">${icons.search}<input type="search" placeholder="Search name, muscle or equipment" data-i="pick-q" autocomplete="off" autocapitalize="off" enterkeyhint="search" aria-label="Search exercises"></label>
        <div id="pick-cats"></div>
        <div class="count" id="pick-count" aria-live="polite"></div>
      </div>
      <div class="sheet-scroll" id="pick-list"></div>`,
    onClose: () => { P = null; },
  });
  fillPicker();
}
function fillPicker() {
  if (!P) return;
  const list = filterExercises(P.q, P.cat);
  document.getElementById('pick-cats').innerHTML = catPills(P.cat, 'pick-cat');
  document.getElementById('pick-count').textContent = `${plural(list.length, 'exercise')}${P.q ? ` matching “${P.q}”` : ''}`;
  const hit = P.q && findExByName(P.q);
  const exact = hit && !getEx(hit).archived;
  let h = list.map((x) => exRow(x, 'pick')).join('');
  if (P.q.trim() && !exact) h += `<button class="ex-create" data-a="pick-create">${icons.plus}<span>Create “${esc(P.q.trim())}” as a custom exercise</span></button>`;
  if (!list.length && !P.q.trim()) h = '<p class="empty">Nothing in this category yet.</p>';
  document.getElementById('pick-list').innerHTML = h;
}
onInput('pick-q', (el) => { P.q = el.value; fillPicker(); });
on('pick-cat', (el) => { P.cat = el.dataset.cat; fillPicker(); });
on('pick', (el) => { const cb = P.onPick; closeSheet(P.sheet); cb(el.dataset.id); });
on('pick-create', () => {
  const cb = P.onPick, sheet = P.sheet, name = P.q.trim();
  openCustomForm({ name, onSave: (ex) => { closeSheet(sheet); cb(ex.id); } });
});

// ── Custom exercise form ──
let F = null;
export function openCustomForm({ ex = null, name = '', onSave } = {}) {
  F = { ex, onSave };
  const v = ex || { name, cat: 'm', type: 'wr', muscle: '', equip: '', cue: '' };
  openSheet({
    cls: 'tall',
    html: `
      <div class="sheet-top"><div class="sheet-head"><h3>${ex ? 'Edit exercise' : 'New custom exercise'}</h3><button class="btn sm" data-a="sheet-close">Cancel</button></div></div>
      <form class="sheet-scroll form" data-s="custom">
        <label class="fld"><span>Name</span><input name="name" value="${esc(v.name)}" placeholder="e.g. Landmine Press" required autocomplete="off"></label>
        <label class="fld"><span>Category</span><select name="cat" data-c="custom-cat">${CAT_ORDER.map((c) => `<option value="${c}"${v.cat === c ? ' selected' : ''}>${CATS[c].name}</option>`).join('')}</select></label>
        <label class="fld"><span>How it's logged</span><select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}"${v.type === k ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label>
        <label class="fld"><span>Muscle group <i>optional</i></span><input name="muscle" value="${esc(v.muscle || '')}" placeholder="e.g. Shoulders" autocomplete="off"></label>
        <label class="fld"><span>Equipment <i>optional</i></span><input name="equip" value="${esc(v.equip || '')}" placeholder="e.g. Barbell" autocomplete="off"></label>
        <label class="fld"><span>Instructions <i>optional</i></span><textarea name="cue" rows="2" placeholder="A form cue to remember">${esc(v.cue || '')}</textarea></label>
        <button class="btn primary big">${ex ? 'Save changes' : 'Save custom exercise'}</button>
      </form>`,
    onClose: () => { F = null; },
  });
}
onChange('custom-cat', (el) => { if (!F.ex) el.form.type.value = DEFAULT_TYPE[el.value]; });
onSubmit('custom', (form) => {
  const name = form.name.value.trim();
  if (!name) return;
  const clash = findExByName(name);
  if (clash && (!F.ex || clash !== F.ex.id)) {
    const old = getEx(clash);
    // Re-creating one that was removed earlier brings the old one back, history and all
    if (old.archived && !F.ex) { F.ex = old; old.archived = false; } else { toast('An exercise with that name already exists'); return; }
  }
  const ex = F.ex || { id: 'c-' + uid(), created: Date.now() };
  Object.assign(ex, { name, cat: form.cat.value, type: form.type.value, muscle: form.muscle.value.trim(), equip: form.equip.value.trim(), cue: form.cue.value.trim() });
  const cb = F.onSave;
  saveCustom(ex);
  closeSheet();
  toast('Exercise saved');
  if (cb) cb(ex); else render();
});
on('custom-new', () => openCustomForm({ onSave: (ex) => { render(); openExercise(ex.id); } }));

// ── Exercise detail ──
export function openExercise(id) {
  const ex = getEx(id);
  if (!ex) { toast('That exercise is no longer in the library'); return; }
  const sum = exSummary(id);
  const prog = progress(id);
  const ss = sessions(id).slice(0, 20);
  const act = activeWorkout();
  const next = coach(ex, null);
  let chart = '';
  if (prog.length >= 2) {
    const d = prog[prog.length - 1].e - prog[0].e;
    chart = `<div class="sub-h">Strength progress <span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${num(Math.abs(d))} lb est. 1RM</span></div>
      ${lineChart({
        series: [{ cls: 'green', pts: prog.map((p) => p.e) }, { cls: 'blue dash', pts: prog.map((p) => p.top) }],
        tips: prog.map((p) => `${fmtDate(p.at)} · top ${num(p.top)}×${p.topR} · est. 1RM ${num(p.e)}`),
        labels: prog.map((p) => fmtShort(p.at)), yFmt: (v) => num(v, 0),
      })}
      <div class="legend"><span><i class="lg green"></i>Estimated 1RM</span><span><i class="lg blue dash"></i>Top set weight</span></div>`;
  }
  const figs = [];
  figs.push(['Sessions', num(sum.count, 0)]);
  if (sum.best) figs.push(['Best', `${num(sum.best.w)}${sum.best.r ? ' × ' + sum.best.r : ''}`]);
  else if (sum.longest) { figs.push(['Longest', clock(sum.longest.t)]); figs.push(['Total time', mins(sum.totalT * 1000)]); }
  if (sum.farthest && !sum.best) figs.push(['Farthest', `${num(sum.farthest.d, 2)} mi`]);
  figs.push(['Last done', sum.last ? fmtDate(sum.last.at) : 'Never']);
  openSheet({
    cls: 'tall',
    html: `
      <div class="sheet-top"><div class="sheet-head"><h3>${esc(ex.name)}</h3><button class="btn sm" data-a="sheet-close">Close</button></div>
        <div class="ex-sub">${badge(ex.cat)}<span>${esc([ex.muscle, ex.equip].filter(Boolean).join(' · '))}</span>${ex.builtin ? '' : '<span class="tag">Custom</span>'}</div></div>
      <div class="sheet-scroll">
        ${ex.cue ? `<p class="cue">${esc(ex.cue)}</p>` : ''}
        <div class="figs${figs.length > 3 ? ' four' : ''}">${figs.map(([l, v]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>
        ${next ? `<div class="coach"><div class="coach-t"><span><b>Next time, aim for</b> ${esc(next.text)}</span><small>${esc(next.note)}</small></div></div>` : ''}
        ${chart}
        <div class="sub-h">History</div>
        ${ss.length ? `<ul class="hist-mini">${ss.map((s) => `<li><div><b>${esc(s.w.title)}</b><span>${fmtDate(s.at, { year: true })}</span></div><p>${esc(fmtSets(s.sets))}</p></li>`).join('')}</ul>` : '<p class="empty">Not logged yet. It will show up here after your first set.</p>'}
        <div class="stack">
          ${act ? `<button class="btn primary big" data-a="ex-add-live" data-id="${esc(id)}">Add to workout in progress</button>` : ''}
          ${ex.builtin ? '' : `<div class="row"><button class="btn grow" data-a="custom-edit" data-id="${esc(id)}">Edit</button><button class="btn grow danger-text" data-a="custom-del" data-id="${esc(id)}">Remove from library</button></div>`}
        </div>
      </div>`,
  });
}
on('ex-detail', (el) => openExercise(el.dataset.id));
on('ex-detail-close', (el) => { closeSheet(); openExercise(el.dataset.id); });
on('ex-add-live', (el) => {
  const act = activeWorkout();
  if (!act) return;
  addExercise(act, el.dataset.id);
  closeSheet();
  ui.openId = act.id;
  go('log');
  toast('Added to your workout');
});
on('custom-edit', (el) => { const ex = getEx(el.dataset.id); closeSheet(); openCustomForm({ ex, onSave: () => { render(); openExercise(ex.id); } }); });
on('custom-del', async (el) => {
  const ex = getEx(el.dataset.id);
  const n = sessions(ex.id).length;
  const ok = await confirmBox({ title: `Remove “${ex.name}”?`, body: n ? `It stays in the ${plural(n, 'workout')} where you logged it, but won't be offered when adding exercises.` : 'It will no longer be offered when adding exercises.', ok: 'Remove', danger: true });
  if (!ok) return;
  ex.archived = true;
  saveCustom(ex);
  closeSheet();
  render();
  toast('Removed from library');
});

// ── Exercises list (Library tab) ──
export function exercisesPanel() {
  return `
    <div class="row">
      <label class="search grow">${icons.search}<input type="search" value="${esc(ui.q)}" placeholder="Search name, muscle or equipment" data-i="ex-q" autocomplete="off" autocapitalize="off" aria-label="Search exercises"></label>
      <button class="btn" data-a="custom-new">${icons.plus}Custom</button>
    </div>
    <div id="ex-cats">${catPills(ui.cat, 'ex-cat')}</div>
    <div id="ex-list">${exList()}</div>`;
}
function exList() {
  const list = filterExercises(ui.q, ui.cat);
  if (!list.length) return '<p class="empty">No exercises match. Try a different search or category, or add a custom exercise.</p>';
  return `<div class="count">${plural(list.length, 'exercise')}</div><div class="card list">${list.map((x) => exRow(x, 'ex-detail')).join('')}</div>`;
}
onInput('ex-q', (el) => { ui.q = el.value; document.getElementById('ex-list').innerHTML = exList(); });
on('ex-cat', (el) => { ui.cat = el.dataset.cat; document.getElementById('ex-cats').innerHTML = catPills(ui.cat, 'ex-cat'); document.getElementById('ex-list').innerHTML = exList(); });
