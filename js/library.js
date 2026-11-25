// Library tab: saved routines, the routine editor, ready-made templates, and
// the exercise list.
import { state, uid, getEx, saveRoutine, deleteRoutine } from './store.js';
import { ui, on, onInput, registerView, render, toast, confirmBox, openPad, badge, icons } from './core.js';
import { STARTERS, AGE_SMART, TYPES, FIELDS } from './lib.js';
import { esc, clock, plural } from './util.js';
import { startWorkout, routineFromTemplate } from './workout.js';
import { openPicker, exercisesPanel } from './exercises.js';
import { plansPanel } from './plans.js';

const exName = (e) => (getEx(e.exId) || { name: e.name || 'Exercise' }).name;

// "3×10", "2×45 sec", "15 min"
function prescription(e) {
  const ex = getEx(e.exId);
  const s = e.sets[0] || {};
  const n = e.sets.length;
  if (ex && (ex.type === 'c' || ex.type === 'tm')) return s.t ? `${Math.round(s.t / 60)} min` : s.d ? `${s.d} mi` : `${n} set${n > 1 ? 's' : ''}`;
  if (s.r) return `${n}×${s.r}`;
  if (s.t) return s.t >= 120 && n === 1 ? `${Math.round(s.t / 60)} min` : `${n}×${s.t} sec`;
  return `${n} set${n > 1 ? 's' : ''}`;
}

const savedAs = (tpl) => state.routines.find((r) => r.name === tpl.name);

function tplCard(tpl, rich) {
  const saved = savedAs(tpl);
  return `<div class="card rt">
    ${tpl.tag ? `<i class="tag">${esc(tpl.tag)}</i>` : ''}
    <h3>${esc(tpl.name)}</h3><p class="muted">${esc(tpl.desc)}</p>
    ${rich ? `<div class="chips">${[`${tpl.mins} min`, tpl.level, tpl.when, tpl.gear].map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div><p class="why">${esc(tpl.why)}</p>` : ''}
    <ul class="rx">${tpl.exercises.map((e) => { const ex = getEx(e.exId); return `<li>${badge(ex.cat)}<span>${esc(ex.name)}</span><b>${prescription(e)}</b></li>`; }).join('')}</ul>
    <div class="row">
      <button class="btn primary grow" data-a="tpl-go" data-id="${tpl.id}">${saved ? 'Start now →' : 'Add & start →'}</button>
      ${saved ? '<span class="saved">✓ Saved</span>' : `<button class="btn" data-a="tpl-save" data-id="${tpl.id}">Save only</button>`}
    </div>
  </div>`;
}

function editor() {
  const d = ui.draft;
  return `<section class="card form">
    <h2>${d.id ? 'Edit routine' : 'New routine'}</h2>
    <label class="fld"><span>Routine name</span><input value="${esc(d.name)}" data-i="draft-name" placeholder="e.g. Upper body A" autocomplete="off"></label>
    <label class="fld"><span>Description <i>optional</i></span><input value="${esc(d.desc)}" data-i="draft-desc" placeholder="e.g. Tuesday and Friday" autocomplete="off"></label>
    <div class="sub-h">Exercises in this routine <span class="muted">${d.exercises.length}</span></div>
    ${d.exercises.length ? `<div class="draft-list">${d.exercises.map((e, i) => {
    const ex = getEx(e.exId);
    const type = ex ? ex.type : 'wr';
    const f = type === 'c' || type === 'tm' ? 'm' : type === 't' ? 't' : type === 'wd' ? null : 'r';
    const def = f && FIELDS[f];
    const v = def ? e.sets[0][def.key] : null;
    return `<div class="draft-ex">
        <div class="draft-t"><b>${esc(exName(e))}</b>${ex ? badge(ex.cat) : ''}</div>
        <div class="draft-c">
          <div class="stepper"><button data-a="draft-sets" data-i="${i}" data-d="-1" aria-label="One less set">−</button><span>${plural(e.sets.length, 'set')}</span><button data-a="draft-sets" data-i="${i}" data-d="1" aria-label="One more set">+</button></div>
          ${def ? `<button class="btn sm" data-a="draft-target" data-i="${i}" data-f="${f}">${v ? `${v / (def.scale || 1)} ${def.unit}` : `Set ${def.unit}`}</button>` : ''}
          <span class="grow"></span>
          ${i > 0 ? `<button class="icon-btn sm" data-a="draft-up" data-i="${i}" aria-label="Move up">↑</button>` : ''}
          <button class="icon-btn sm" data-a="draft-rm" data-i="${i}" aria-label="Remove ${esc(exName(e))}">${icons.x}</button>
        </div></div>`;
  }).join('')}</div>` : '<p class="empty">No exercises yet.</p>'}
    <button class="btn big" data-a="draft-add">${icons.plus}Add exercise</button>
    <div class="row"><button class="btn primary grow" data-a="draft-save">${d.id ? 'Save changes' : 'Create routine'}</button><button class="btn" data-a="draft-cancel">Cancel</button></div>
  </section>`;
}

function routinesPanel() {
  if (ui.draft) return editor();
  let h = `<button class="btn primary big" data-a="draft-new">${icons.plus}New routine</button>`;
  if (state.routines.length) {
    h += state.routines.map((r) => `<div class="card rt">
      <h3>${esc(r.name)}</h3>${r.desc ? `<p class="muted">${esc(r.desc)}</p>` : ''}
      <ul class="rx">${r.exercises.map((e) => { const ex = getEx(e.exId); return `<li>${ex ? badge(ex.cat) : ''}<span>${esc(exName(e))}</span><b>${prescription(e)}</b></li>`; }).join('')}</ul>
      <div class="row"><button class="btn primary grow" data-a="routine-start" data-id="${r.id}">Start this routine →</button><button class="btn" data-a="draft-edit" data-id="${r.id}">Edit</button><button class="btn danger-text" data-a="routine-del" data-id="${r.id}">Delete</button></div>
    </div>`).join('');
  } else {
    h += `<p class="hint center">No saved routines yet. Build your own, or save one of the templates below.</p>`;
  }
  h += `<details class="group"${state.routines.length ? '' : ' open'}><summary><span><b>Starter templates</b><small>Six general routines to start from</small></span></summary>${STARTERS.map((t) => tplCard(t, false)).join('')}</details>`;
  h += `<details class="group"><summary><span><b>55+ Age-Smart collection</b><small>Joint-friendly strength, cardio, balance and mobility</small></span></summary>
    <div class="card">
      <div class="sub-h">How to use these</div>
      <button class="btn big" data-a="lib" data-v="plans">When to do each: see Plans →</button>
      <ul class="guide">
        <li>Strength on nonconsecutive days: at least 48 hours before working the same muscles again.</li>
        <li>Stop each set with about 2 clean reps left. Rest 60–90 seconds.</li>
        <li>Add a little weight only when every set reaches the top of its rep range with good form.</li>
        <li>Pain is a stop sign. Swap the exercise rather than pushing through it.</li>
      </ul>
    </div>
    ${AGE_SMART.map((t) => tplCard(t, true)).join('')}
    <p class="hint">Based on the <a href="https://pubmed.ncbi.nlm.nih.gov/21694556/" target="_blank" rel="noopener">ACSM position stand on exercise quantity and quality</a> and the <a href="https://www.cdc.gov/physical-activity-basics/guidelines/older-adults.html" target="_blank" rel="noopener">CDC's activity guidance for older adults</a> (150 minutes of aerobic activity a week, muscle strengthening on 2 days, plus balance work). General fitness guidance, not medical advice.</p>
  </details>`;
  return h;
}

registerView('library', () => `
  <div class="seg" role="tablist">
    <button class="${ui.lib === 'routines' ? 'on' : ''}" data-a="lib" data-v="routines" role="tab" aria-selected="${ui.lib === 'routines'}">Routines</button>
    <button class="${ui.lib === 'plans' ? 'on' : ''}" data-a="lib" data-v="plans" role="tab" aria-selected="${ui.lib === 'plans'}">Plans</button>
    <button class="${ui.lib === 'exercises' ? 'on' : ''}" data-a="lib" data-v="exercises" role="tab" aria-selected="${ui.lib === 'exercises'}">Exercises</button>
  </div>
  ${ui.lib === 'routines' ? routinesPanel() : ui.lib === 'plans' ? plansPanel() : exercisesPanel()}`);

on('lib', (el) => { ui.lib = el.dataset.v; render(); window.scrollTo(0, 0); });

const allTemplates = () => [...STARTERS, ...AGE_SMART];
on('tpl-go', (el) => { const r = routineFromTemplate(allTemplates().find((t) => t.id === el.dataset.id)); startWorkout({ title: r.name, from: r }); });
on('tpl-save', (el) => { routineFromTemplate(allTemplates().find((t) => t.id === el.dataset.id)); toast('Saved to your routines'); render(); });

on('routine-del', async (el) => {
  const r = state.routines.find((x) => x.id === el.dataset.id);
  if (!(await confirmBox({ title: `Delete “${r.name}”?`, body: 'Workouts you already logged from it stay in History.', ok: 'Delete', danger: true }))) return;
  await deleteRoutine(r.id);
  render();
  toast('Routine deleted');
});

// ── Editor ──
const defaultSets = (ex) => (ex.type === 'c' ? [{ t: 1200, d: 1 }] : ex.type === 'tm' ? [{ t: 1200 }] : ex.type === 't' ? [{ t: 60 }] : ex.type === 'wd' ? [{}, {}] : [{ r: 10 }, { r: 10 }, { r: 10 }]);
on('draft-new', () => { ui.draft = { id: null, name: '', desc: '', exercises: [] }; render(); window.scrollTo(0, 0); });
on('draft-edit', (el) => {
  const r = state.routines.find((x) => x.id === el.dataset.id);
  ui.draft = { id: r.id, name: r.name, desc: r.desc || '', exercises: r.exercises.map((e) => ({ exId: e.exId, name: e.name, sets: e.sets.length ? e.sets.map((s) => ({ ...s })) : [{}] })) };
  render(); window.scrollTo(0, 0);
});
onInput('draft-name', (el) => { ui.draft.name = el.value; });
onInput('draft-desc', (el) => { ui.draft.desc = el.value; });
on('draft-add', () => openPicker({
  title: 'Add to routine',
  onPick: (id) => {
    if (ui.draft.exercises.some((e) => e.exId === id)) { toast('Already in this routine'); return; }
    const ex = getEx(id);
    ui.draft.exercises.push({ exId: id, name: ex.name, sets: defaultSets(ex) });
    render();
  },
}));
on('draft-sets', (el) => {
  const e = ui.draft.exercises[+el.dataset.i];
  if (el.dataset.d === '1') { if (e.sets.length < 10) e.sets.push({ ...e.sets[e.sets.length - 1] }); } else if (e.sets.length > 1) e.sets.pop();
  render();
});
on('draft-target', (el) => {
  const e = ui.draft.exercises[+el.dataset.i];
  const f = el.dataset.f, def = FIELDS[f], sc = def.scale || 1;
  const cur = e.sets[0][def.key];
  openPad({
    title: exName(e), sub: `Target ${def.label.toLowerCase()} per set`, field: f, value: cur ? cur / sc : null,
    onDone: (v) => { for (const s of e.sets) s[def.key] = v ? Math.round(v * sc) : null; render(); },
  });
});
on('draft-up', (el) => { const a = ui.draft.exercises, i = +el.dataset.i; [a[i - 1], a[i]] = [a[i], a[i - 1]]; render(); });
on('draft-rm', (el) => { ui.draft.exercises.splice(+el.dataset.i, 1); render(); });
on('draft-cancel', () => { ui.draft = null; render(); });
on('draft-save', () => {
  const d = ui.draft;
  if (!d.name.trim()) { toast('Give the routine a name'); return; }
  if (!d.exercises.length) { toast('Add at least one exercise'); return; }
  const r = (d.id && state.routines.find((x) => x.id === d.id)) || { id: uid(), created: Date.now() };
  Object.assign(r, { name: d.name.trim(), desc: d.desc.trim(), exercises: d.exercises });
  saveRoutine(r);
  ui.draft = null;
  render();
  toast('Routine saved');
});
