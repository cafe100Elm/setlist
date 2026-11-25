// The app's frame: tabs, header, pop-up sheets, the number pad, the rest timer,
// light/dark theme, and the plumbing that connects taps to actions.
import { state, activeWorkout, saveSettings } from './store.js';
import { CATS, FIELDS } from './lib.js';
import { esc, clock, num } from './util.js';

export const $ = (s, r = document) => r.querySelector(s);

// What the person is currently looking at
export const ui = {
  tab: 'home',
  openId: null, // workout shown on the Log tab
  lib: 'routines',
  q: '', cat: 'all', // exercise list filters
  range: '12w', progEx: null, prAll: false,
  histN: 20, histQ: '',
  draft: null, // routine being created or edited
  friendsDot: null, // set by js/friends.js: () => true when someone is waiting to be accepted
  rest: null, // { end, total }
};

const views = {};
const actions = {}, inputs = {}, changes = {}, submits = {};
export const registerView = (name, fn) => { views[name] = fn; };
export const on = (name, fn) => { actions[name] = fn; };
export const onInput = (name, fn) => { inputs[name] = fn; };
export const onChange = (name, fn) => { changes[name] = fn; };
export const onSubmit = (name, fn) => { submits[name] = fn; };

// ── Icons ──
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icons = {
  home: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>'),
  log: I('<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>'),
  library: I('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  insights: I('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  history: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  screen: I('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  dots: I('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  share: I('<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  people: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>'),
};

const SHAPES = {
  m: '<path d="M6 .6 11.4 6 6 11.4.6 6z"/>',
  f: '<rect x="1.4" y="1.4" width="9.2" height="9.2" rx="1.6"/>',
  b: '<circle cx="6" cy="6" r="5"/>',
  c: '<path d="M6 1.2 11.4 10.8H.6z"/>',
  y: '<path d="M6 .7 10.6 3.35v5.3L6 11.3 1.4 8.65v-5.3z"/>',
};
export const catIcon = (cat) => `<svg class="ci ci-${cat}" viewBox="0 0 12 12" aria-hidden="true">${SHAPES[cat] || SHAPES.f}</svg>`;
export const badge = (cat) => `<span class="badge b-${cat}">${catIcon(cat)}${esc((CATS[cat] || CATS.f).short)}</span>`;

// ── Frame ──
const TABS = [['home', 'Home'], ['log', 'Workout'], ['library', 'Library'], ['insights', 'Insights'], ['history', 'History']];
const TITLES = {
  home: () => [new Date().toLocaleDateString('en-US', { weekday: 'long', month: cloudBtn() ? 'short' : 'long', day: 'numeric' }), 'Setlist'], // short month leaves room for the Friends button
  log: () => ['Training', 'Workout'],
  library: () => ['Routines & exercises', 'Library'],
  insights: () => ['Your numbers', 'Insights'],
  history: () => ['Every workout', 'History'],
};

const cloudBtn = () => !!ui.friendsDot; // the Friends button shows only where sign-in is set up
export function render() {
  const act = activeWorkout();
  const cloudOn = cloudBtn();
  const [kicker, title] = TITLES[ui.tab]();
  const pref = themePref();
  $('#hdr').innerHTML = `
    <div class="hdr-text"><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1></div>
    <div class="hdr-btns">
      ${cloudOn ? `<button class="icon-btn${ui.friendsDot && ui.friendsDot() ? ' has-dot' : ''}" data-a="friends" aria-label="Friends">${icons.people}</button>` : ''}
      <button class="icon-btn" data-a="settings" aria-label="Settings and data">${icons.gear}</button>
      <button class="icon-btn" data-a="theme" title="${THEME_LABEL[pref]}" aria-label="${THEME_LABEL[pref]}">${icons[THEME_ICON[pref]]}</button>
    </div>`;
  $('#view').innerHTML = views[ui.tab]();
  $('#tabs').innerHTML = TABS.map(([id, label]) => `
    <button class="tab${ui.tab === id ? ' on' : ''}" data-a="go" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>
      ${icons[id]}<span>${label}${id === 'log' && act ? '<i class="live-dot" aria-label="workout in progress"></i>' : ''}</span>
    </button>`).join('');
  const showPill = act && ui.tab !== 'home' && !(ui.tab === 'log' && (!ui.openId || ui.openId === act.id));
  $('#livepill').innerHTML = showPill ? `<button class="pill-live" data-a="resume"><b>LIVE</b><span id="pill-time">${clock((Date.now() - act.start) / 1000)}</span><span class="pill-name">${esc(act.title)}</span></button>` : '';
  syncWake();
  tick();
}

export function go(tab) {
  ui.tab = tab;
  render();
  window.scrollTo(0, 0);
}
on('go', (el) => { if (el.dataset.lib) ui.lib = el.dataset.lib; go(el.dataset.tab); });
on('resume', () => { const a = activeWorkout(); if (a) { ui.openId = a.id; go('log'); } });

// ── Toast ──
let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Sheets (pop-ups that slide up from the bottom) ──
const stack = [];
export function openSheet({ html, cls = '', onClose }) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="scrim" data-a="sheet-close"></div><div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  $('#sheets').appendChild(el);
  const s = { el, body: el.querySelector('.sheet'), onClose, set(h) { this.body.innerHTML = h; } };
  stack.push(s);
  document.body.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('in'));
  return s;
}
export function closeSheet(s = stack[stack.length - 1], result) {
  if (!s) return;
  const i = stack.indexOf(s);
  if (i < 0) return;
  stack.splice(i, 1);
  s.el.remove();
  if (!stack.length) document.body.classList.remove('locked');
  if (s.onClose) s.onClose(result);
}
export const topSheet = () => stack[stack.length - 1];
on('sheet-close', () => closeSheet());

// A yes/no question in an in-page box (never the browser's own pop-up)
export function confirmBox({ title, body = '', ok = 'OK', cancel = 'Keep it', danger = false }) {
  return new Promise((res) => {
    const s = openSheet({
      cls: 'dialog',
      html: `<h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}
        <div class="row end"><button class="btn" data-a="dlg-no">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="dlg-yes">${esc(ok)}</button></div>`,
      onClose: (r) => res(r === true),
    });
    s.dlg = true;
  });
}
on('dlg-yes', () => closeSheet(undefined, true));
on('dlg-no', () => closeSheet(undefined, false));

// Ask for one line of text
export function promptBox({ title, label = '', value = '', ok = 'Save', placeholder = '' }) {
  return new Promise((res) => {
    openSheet({
      cls: 'dialog',
      html: `<h3>${esc(title)}</h3>
        <form data-s="prompt"><label class="fld"><span>${esc(label)}</span><input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></label>
        <div class="row end"><button type="button" class="btn" data-a="dlg-no">Cancel</button><button class="btn primary">${esc(ok)}</button></div></form>`,
      onClose: (r) => res(typeof r === 'string' ? r : null),
    });
    setTimeout(() => { const i = $('#sheets input[name=v]'); if (i) { i.focus(); i.select(); } }, 50);
  });
}
onSubmit('prompt', (form) => { const v = form.v.value.trim(); if (v) closeSheet(undefined, v); });

// ── Number pad ──
let pad = null;
const padRead = () => {
  const v = $('#pad-val');
  if (!v) return;
  v.textContent = pad.buf === '' ? '–' : pad.buf;
  v.classList.toggle('empty', pad.buf === '');
  $('#pad-clear').hidden = pad.buf === '';
};
export function openPad({ title, sub, field, value, onDone, extra = [] }) {
  const def = FIELDS[field];
  pad = { def, buf: value == null ? '' : String(num(value, 2)).replace(/,/g, ''), fresh: true, onDone };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', def.dec ? '.' : '', '0', '⌫'];
  openSheet({
    cls: 'pad',
    html: `
      <div class="pad-head"><div><b>${esc(title)}</b><span>${esc(sub || def.label)}</span></div><button class="btn sm" data-a="sheet-close">Cancel</button></div>
      <div class="pad-read"><span id="pad-val"></span><small>${def.unit}</small><button class="link" id="pad-clear" data-a="pad-clear">Clear</button></div>
      ${extra.length ? `<div class="pad-chips">${extra.map((c) => `<button data-a="pad-chip" data-v="${c.v}">${esc(c.label)}</button>`).join('')}</div>` : ''}
      ${def.chips.length ? `<div class="pad-chips">${def.chips.map((c) => `<button data-a="pad-chip" data-v="${c}">${c}</button>`).join('')}</div>` : ''}
      <div class="pad-step"><button data-a="pad-step" data-d="-1">− ${def.step}</button><button data-a="pad-step" data-d="1">+ ${def.step}</button></div>
      <div class="pad-keys">${keys.map((k) => (k ? `<button data-a="pad-key" data-k="${k}"${k === '⌫' ? ' aria-label="Backspace"' : ''}>${k}</button>` : '<span></span>')).join('')}</div>
      <button class="btn primary big" data-a="pad-done">Done</button>`,
    onClose: (r) => { const p = pad; pad = null; if (r === 'done') p.onDone(p.buf === '' || p.buf === '.' ? null : parseFloat(p.buf)); },
  });
  padRead();
}
function padKey(k) {
  if (!pad) return;
  if (k === '⌫') { pad.buf = pad.fresh ? '' : pad.buf.slice(0, -1); pad.fresh = false; return padRead(); }
  if (pad.fresh) { pad.buf = ''; pad.fresh = false; }
  if (k === '.') { if (!pad.def.dec || pad.buf.includes('.')) return; pad.buf = (pad.buf || '0') + '.'; return padRead(); }
  if (pad.buf.replace('.', '').length >= 6) return;
  pad.buf = pad.buf === '0' ? k : pad.buf + k;
  padRead();
}
on('pad-key', (el) => padKey(el.dataset.k));
on('pad-clear', () => { pad.buf = ''; pad.fresh = false; padRead(); });
on('pad-chip', (el) => { pad.buf = el.dataset.v; pad.fresh = true; padRead(); });
on('pad-step', (el) => {
  if (pad.buf === '' && el.dataset.d === '-1') return;
  const v = Math.max(0, Math.round(((parseFloat(pad.buf) || 0) + +el.dataset.d * pad.def.step) * 100) / 100);
  pad.buf = String(v); pad.fresh = true; padRead();
});
on('pad-done', () => closeSheet(undefined, 'done'));

// ── Rest timer + live clock ──
let actx = null;
export function primeAudio() {
  if (!state.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* sound is optional */ }
}
function beep() {
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  if (!actx || !state.settings.sound) return;
  const t = actx.currentTime;
  [0, 0.2, 0.4].forEach((o, i) => {
    const osc = actx.createOscillator(), g = actx.createGain();
    osc.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t + o);
    g.gain.exponentialRampToValueAtTime(0.3, t + o + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.16);
    osc.connect(g); g.connect(actx.destination);
    osc.start(t + o); osc.stop(t + o + 0.18);
  });
}
export function startRest(sec) {
  if (!sec) return;
  primeAudio();
  ui.rest = { end: Date.now() + sec * 1000, total: sec };
  tick();
}
on('rest', (el) => startRest(+el.dataset.sec));
on('rest-add', () => { if (ui.rest) { ui.rest.end += 15000; ui.rest.total += 15; tick(); } });
on('rest-skip', () => { ui.rest = null; tick(); });

export const tickHooks = []; // extra once-a-tick updates registered by screens
export function tick() {
  for (const f of tickHooks) f();
  const bar = $('#restbar');
  if (ui.rest) {
    const left = (ui.rest.end - Date.now()) / 1000;
    if (left <= 0) {
      const late = left < -5; // app was in the background when it ran out
      ui.rest = null;
      if (!late) beep();
    } else {
      const pct = Math.max(0, Math.min(100, (left / ui.rest.total) * 100));
      if (bar.hidden || !bar.firstChild) {
        bar.hidden = false;
        bar.innerHTML = `<div class="rest-fill" id="rest-fill"></div><div class="rest-in"><span class="rest-l">REST</span><b id="rest-left"></b><span id="rest-total"></span><span class="grow"></span><button data-a="rest-add">+15s</button><button data-a="rest-skip">Skip</button></div>`;
      }
      $('#rest-left').textContent = clock(Math.ceil(left));
      $('#rest-total').textContent = '/ ' + clock(ui.rest.total);
      $('#rest-fill').style.width = pct + '%';
    }
  }
  if (!ui.rest && !bar.hidden) { bar.hidden = true; bar.innerHTML = ''; }
  document.body.classList.toggle('resting', !!ui.rest);
  const act = activeWorkout();
  if (act) {
    const txt = clock((Date.now() - act.start) / 1000);
    for (const id of ['elapsed', 'pill-time', 'resume-time']) { const e = document.getElementById(id); if (e) e.textContent = txt; }
  }
}
setInterval(tick, 500);

// Keep the screen on while a workout is in progress
let wake = null;
export async function syncWake() {
  const want = !!activeWorkout() && state.settings.awake && document.visibilityState === 'visible';
  try {
    if (want && !wake && navigator.wakeLock) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!want && wake) { const w = wake; wake = null; await w.release(); }
  } catch (e) { wake = null; }
}
document.addEventListener('visibilitychange', () => { syncWake(); tick(); });

// ── Theme ──
// Light → Dark → System (follows the phone's setting, live). Light unless chosen otherwise.
// Saved as setlist-theme = light | dark | system; index.html sets it before the page draws.
const THEME_KEY = 'setlist-theme';
const THEME_NEXT = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON = { light: 'sun', dark: 'moon', system: 'screen' };
const THEME_NAME = { light: 'Light', dark: 'Dark', system: 'System (follows your device)' };
const THEME_LABEL = Object.fromEntries(Object.keys(THEME_NEXT).map((k) => [k, `Theme: ${THEME_NAME[k]}. Tap for ${THEME_NAME[THEME_NEXT[k]]}.`]));
const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function themePref() {
  try { const v = localStorage.getItem(THEME_KEY); if (v === 'dark' || v === 'system') return v; } catch (e) { /* private mode */ }
  return 'light';
}
function applyTheme() {
  const p = themePref();
  if (p === 'dark' || (p === 'system' && darkMQ && darkMQ.matches)) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  applyThemeColor();
}
export function applyThemeColor() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const m = $('meta[name=theme-color]');
  if (m) m.content = dark ? '#0e0f11' : '#f3f0e8';
}
if (darkMQ) {
  const onDevice = () => { if (themePref() === 'system') applyTheme(); };
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', onDevice); else if (darkMQ.addListener) darkMQ.addListener(onDevice);
}
on('theme', () => {
  try { localStorage.setItem(THEME_KEY, THEME_NEXT[themePref()]); } catch (e) { /* private mode */ }
  applyTheme();
  render();
});

// ── Chart tooltips ──
function showTip(el) {
  const tip = $('#tip');
  if (!el) { tip.classList.remove('show'); return; }
  tip.textContent = el.dataset.tip;
  tip.classList.add('show');
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
  let y = r.top - th - 8;
  if (el.classList.contains('hit')) y = Math.max(8, r.top + 4);
  if (y < 8) y = r.bottom + 8;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
window.addEventListener('scroll', () => showTip(null), { passive: true });

// ── Wiring taps and typing to actions ──
document.addEventListener('click', (e) => {
  showTip(e.target.closest('[data-tip]'));
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.a];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => { const el = e.target.closest('[data-i]'); if (el && inputs[el.dataset.i]) inputs[el.dataset.i](el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && changes[el.dataset.c]) changes[el.dataset.c](el, e); });
document.addEventListener('submit', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  e.preventDefault();
  if (submits[el.dataset.s]) submits[el.dataset.s](el, e);
});
document.addEventListener('keydown', (e) => {
  if (pad) {
    if (/^[0-9.]$/.test(e.key)) { padKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { padKey('⌫'); e.preventDefault(); }
    else if (e.key === 'Enter') { closeSheet(undefined, 'done'); e.preventDefault(); }
  }
  if (e.key === 'Escape' && stack.length) closeSheet();
});

// Keep sheets above the on-screen keyboard
const vv = window.visualViewport;
function syncViewport() {
  const r = document.documentElement.style;
  r.setProperty('--vvh', (vv ? vv.height : window.innerHeight) + 'px');
  r.setProperty('--vvtop', (vv ? vv.offsetTop : 0) + 'px');
}
if (vv) { vv.addEventListener('resize', syncViewport); vv.addEventListener('scroll', syncViewport); }
window.addEventListener('resize', syncViewport);
syncViewport();

export const setSetting = (k, v) => { state.settings[k] = v; saveSettings(); };
