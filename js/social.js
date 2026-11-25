// Following: see friends' finished workouts, and let friends see yours.
//
// Nothing here runs unless the person has signed in (the same Google sign-in
// that sync uses). The rules, in plain terms:
//  - You follow someone by asking. They see the request and say yes or no.
//    Until they say yes you see nothing of theirs.
//  - What a follower sees is a separate, published copy of your recent
//    workouts ("the feed"): name, date, time taken, sets, pounds, and (unless you
//    chose "summaries only") the exercises with their sets. Never notes, never
//    routines or settings. Nothing is published until you have a follower.
//  - A workout in progress is published as "working out now" (no numbers).
//  - Followers can add a cheer to a workout, and nothing else.
//  - Accepting someone's request also lets them in (they can then sync their
//    own devices and be followed themselves).
//  - The last feed that was loaded is kept on the device, so the Friends screen
//    still opens with no signal.
import { state, onLocalChange, kvGet, kvSet, exOf } from './store.js';
import { syncUser, isMember, syncInfo, onSyncStatus, onSyncData, onSyncLeave } from './sync.js';
import * as cloud from './cloud.js';
import { wVol, wSets, doneSets } from './stats.js';
import { fmtSets, startOfWeek } from './util.js';

const FEED_N = 20; // how many recent workouts each person publishes
const LIVE_MAX = 6 * 3600000; // a "working out now" older than this is treated as forgotten
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
const INVITE_KEY = 'setlist-follow';

// What the Friends screen draws from. `feeds` = friend id → their published workouts.
const blank = () => ({ uid: null, me: null, following: [], followers: [], feeds: {}, mine: [] });
let soc = blank();
let run = null; // listeners for the signed-in person: { uid, member, unsubs: [], per: {} }
let broken = false;
let loaded = false;
const fns = { data: [], event: [] };
export const onSocial = (fn) => fns.data.push(fn);
export const onSocialEvent = (fn) => fns.event.push(fn); // (kind, text) for the little pop-up messages
const tell = (kind, text) => { for (const fn of fns.event) fn(kind, text); };

let emitT = 0, saveT = 0;
function changed() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { if (soc.uid) kvSet('social', soc); }, 800);
  if (emitT) return;
  emitT = setTimeout(() => { emitT = 0; for (const fn of fns.data) fn(); }, 80);
}

const myName = () => (soc.me && soc.me.name) || firstName((syncUser() || {}).name) || 'A friend';
const firstName = (n) => String(n || '').trim().split(/\s+/)[0].slice(0, 40);
const clean = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 40);

// ── What the screens ask for ──
export function socialInfo() {
  const y = syncInfo();
  const u = syncUser();
  return {
    available: y.available,
    signedIn: !!(y.on || y.wait), // on this device (even if the connection isn't up yet)
    connected: !!u,
    member: isMember() || (!u && !!y.on),
    waiting: !!y.wait,
    phase: y.phase, note: y.note,
    name: myName(), code: (soc.me && soc.me.code) || '',
    following: soc.following, followers: soc.followers,
    requests: soc.followers.filter((f) => f.st === 'req'),
    invite: pendingInvite(),
  };
}
const isLive = (d) => !d.e && Date.now() - d.t < LIVE_MAX;
const cheersOf = (d) => Object.entries((d && d.ch) || {}).map(([uid, name]) => ({ uid, name }));
const okFriends = () => soc.following.filter((f) => f.st === 'ok');

// Friends' workouts and your own recent ones, newest first.
export function feed({ mine = true } = {}) {
  const out = [];
  for (const f of okFriends()) {
    for (const d of soc.feeds[f.uid] || []) {
      if (!d.e && !isLive(d)) continue;
      out.push({ who: f.uid, name: f.name, id: d.id, t: d.t, e: d.e || null, live: !d.e, title: d.title, sets: d.sets || 0, vol: d.vol || 0, n: d.n || 0, full: d.lv === 'f', d: d.d || '', cheers: cheersOf(d) });
    }
  }
  if (mine) {
    const pub = new Map(soc.mine.map((d) => [d.id, d]));
    for (const w of state.workouts.slice(0, 10)) {
      if (!w.end) continue;
      out.push({ who: 'me', name: 'You', id: w.id, t: w.start, e: w.end, live: false, title: w.title || 'Workout', sets: wSets(w), vol: Math.round(wVol(w)), n: w.exercises.length, full: true, d: '', cheers: cheersOf(pub.get(w.id)) });
    }
  }
  return out.sort((a, b) => (b.e || b.t) - (a.e || a.t));
}
export const feedItem = (who, id) => feed().find((x) => x.who === who && x.id === id) || null;

// This week (from Monday): you and the people you follow.
export function board() {
  const from = startOfWeek(Date.now());
  const rows = [{ who: 'me', name: 'You', n: 0, vol: 0 }];
  for (const w of state.workouts) { if (w.end && w.start >= from) { rows[0].n++; rows[0].vol += wVol(w); } }
  for (const f of okFriends()) {
    const r = { who: f.uid, name: f.name, n: 0, vol: 0, live: false };
    for (const d of soc.feeds[f.uid] || []) {
      if (!d.e) { if (isLive(d)) r.live = true; continue; }
      if (d.t >= from) { r.n++; r.vol += d.vol || 0; }
    }
    rows.push(r);
  }
  return rows.sort((a, b) => b.n - a.n || b.vol - a.vol);
}

// ── The invite link: …/setlist/?f=ABC234 ──
export const validCode = (c) => /^[A-Z2-9]{6}$/.test(c);
export const tidyCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').slice(0, 6);
let invite = null; // { code, uid, name, err } once looked up
export function pendingInvite() {
  if (invite) return invite;
  let code = '';
  try { code = localStorage.getItem(INVITE_KEY) || ''; } catch (e) { /* private window */ }
  return validCode(code) ? (invite = { code }) : null;
}
export function setInvite(code) {
  invite = null;
  try { if (code) localStorage.setItem(INVITE_KEY, code); else localStorage.removeItem(INVITE_KEY); } catch (e) { /* private window */ }
  changed();
}
// Reads ?f=CODE from the address, remembers it, and tidies the address bar. True if there was one.
export function takeInviteFromAddress() {
  let code = '';
  try { code = tidyCode(new URLSearchParams(location.search).get('f')); } catch (e) { return false; }
  if (!validCode(code)) return false;
  setInvite(code);
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* fine */ }
  return true;
}

// ── Things the person does ──
const need = () => { const u = syncUser(); if (!u || navigator.onLine === false) throw new Error("No connection. Try again when you're back online."); return u.uid; };
const friendly = (e) => {
  const c = (e && e.code) || '';
  if (/permission-denied/.test(c)) return new Error("That isn't allowed for this account yet.");
  if (/unavailable|offline|network/.test(c + ' ' + ((e && e.message) || ''))) return new Error("No connection. Try again when you're back online.");
  return e instanceof Error ? e : new Error('Something went wrong. Try again.');
};
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

// Whose code is this? → { uid, name }
export const lookup = guard(async (code) => {
  const me = need();
  code = tidyCode(code);
  if (!validCode(code)) throw new Error('A code is 6 letters and numbers, like ABC234.');
  const c = await cloud.getOne('codes/' + code);
  if (!c || !c.uid) throw new Error("That code doesn't match anyone. Check it with your friend.");
  if (c.uid === me) throw new Error("That's your own code.");
  const p = await cloud.getOne('profiles/' + c.uid);
  return { uid: c.uid, name: (p && p.name) || 'Your friend' };
});

// Ask to follow someone. They have to say yes before anything shows.
export const follow = guard(async (uid, name) => {
  const me = need();
  if (uid === me) throw new Error("You can't follow yourself.");
  const path = `users/${uid}/followers/${me}`;
  if (!(await cloud.getOne(path))) await cloud.put(path, { name: myName(), st: 'req', at: Date.now() });
  await cloud.put(`users/${me}/following/${uid}`, { name: clean(name) || 'Friend', at: Date.now() });
});
export const unfollow = guard(async (uid) => {
  const me = need();
  await cloud.remove(`users/${uid}/followers/${me}`).catch(() => {});
  await cloud.remove(`users/${me}/following/${uid}`);
});
// Say yes to a follower. This also lets them in, so they can sync and be followed.
export const approve = guard(async (uid) => {
  const me = need();
  await cloud.patch(`users/${me}/followers/${uid}`, { st: 'ok' });
  if (run) run.vouched.add(uid);
  await cloud.put('members/' + uid, { by: me, at: Date.now() });
  queuePublish(300);
});
// Say no, or remove someone who follows you.
export const removeFollower = guard(async (uid) => { await cloud.remove(`users/${need()}/followers/${uid}`); });
export const cheer = guard(async (who, id, on) => {
  const me = need();
  await cloud.patchIn(`users/${who}/feed/${id}`, ['ch', me], on ? myName() : cloud.gone());
});
export const setName = guard(async (name) => {
  const me = need();
  name = clean(name);
  if (!name) throw new Error('Type a name.');
  soc.me = { ...(soc.me || {}), name };
  await saveCard(me);
  changed();
});
const saveCard = (me) => cloud.put('profiles/' + me, soc.me.code ? { name: soc.me.name, code: soc.me.code, u: Date.now() } : { name: soc.me.name, u: Date.now() });

// ── Publishing my own recent workouts for my followers ──
function feedDoc(w, lv) {
  const live = !w.end;
  const doc = { t: w.start, e: w.end || null, title: String(w.title || 'Workout').slice(0, 80), sets: live ? 0 : wSets(w), vol: live ? 0 : Math.round(wVol(w)), n: w.exercises.length, lv, u: w.u || 0, d: '' };
  if (lv === 'f' && !live) {
    const rows = [];
    for (const we of w.exercises.slice(0, 40)) {
      const sets = doneSets(we);
      if (!sets.length) continue;
      const ex = exOf(we);
      rows.push({ n: String(ex.name).slice(0, 60), c: ex.cat, s: fmtSets(sets).slice(0, 160) });
    }
    doc.d = JSON.stringify(rows);
  }
  return doc;
}
let pubT = 0, publishing = false;
function queuePublish(ms = 2500) { clearTimeout(pubT); pubT = setTimeout(publish, ms); }
// Make the published copy match the latest workouts on this device. Only when
// sync has fully caught up, so a device that is behind can't publish stale work
// or take down a workout it simply hasn't received yet.
async function publish() {
  clearTimeout(pubT);
  if (publishing || !run || !run.member || !run.mineReady || navigator.onLine === false) return;
  if (syncInfo().phase !== 'live' || !soc.followers.some((f) => f.st === 'ok')) return;
  const uid = run.uid;
  const lv = state.settings.shareLevel === 'summary' ? 's' : 'f';
  const have = new Map(soc.mine.map((d) => [d.id, d]));
  const jobs = [];
  for (const w of state.workouts.slice(0, FEED_N)) {
    const d = have.get(w.id);
    const same = d && d.lv === lv && (w.end ? d.e === w.end && d.u === (w.u || 0) : !d.e && d.title === String(w.title || 'Workout').slice(0, 80));
    if (!same) jobs.push(cloud.put(`users/${uid}/feed/${w.id}`, feedDoc(w, lv), true)); // "true" keeps the cheers already on it
  }
  const ids = new Set(state.workouts.map((w) => w.id));
  for (const d of soc.mine) if (!ids.has(d.id)) jobs.push(cloud.remove(`users/${uid}/feed/${d.id}`));
  if (!jobs.length) return;
  publishing = true;
  try { await Promise.all(jobs); } catch (e) { console.warn('Friends: publishing failed, will retry', e); setTimeout(() => queuePublish(0), 30000); }
  publishing = false;
}

// ── Listening ──
function stop() {
  if (!run) return;
  for (const u of run.unsubs) { try { u(); } catch (e) { /* already stopped */ } }
  for (const k of Object.keys(run.per)) dropFriend(k);
  run = null;
}
function dropFriend(uid) {
  const p = run && run.per[uid];
  if (!p) return;
  for (const u of [p.st, p.feed]) { if (u) { try { u(); } catch (e) { /* already stopped */ } } }
  delete run.per[uid];
}
// People can rename themselves, so use the name on their card (looked up once each time the app opens).
const names = {};
function freshNames(list) {
  for (const f of list) {
    if (names[f.uid]) { f.name = names[f.uid]; continue; }
    if (names[f.uid] === '') continue; // already asking
    names[f.uid] = '';
    const uid = f.uid;
    cloud.getOne('profiles/' + uid).then((p) => {
      if (!p || !p.name) return;
      names[uid] = p.name;
      for (const l of [soc.following, soc.followers]) for (const x of l) if (x.uid === uid) x.name = p.name;
      changed();
    }, () => { delete names[uid]; });
  }
}
const fail = (what) => (e) => { console.warn('Friends: ' + what + ' stopped', e); broken = true; };

function watchFriend(uid) {
  const me = run.uid;
  const p = run.per[uid] = { st: null, feed: null };
  p.st = cloud.watchOne(`users/${uid}/followers/${me}`, (d) => {
    const f = soc.following.find((x) => x.uid === uid);
    if (!f) return;
    const st = d ? d.st : 'none'; // none = they said no, or removed you
    if (st === 'ok' && f.st === 'req' && f.seen) tell('ok', `${f.name} accepted. You can see their workouts now.`);
    f.st = st; f.seen = true;
    if (st === 'ok' && !p.feed) {
      p.feed = cloud.watchAll(`users/${uid}/feed`, { order: 't', limit: FEED_N }, (docs) => { soc.feeds[uid] = docs; changed(); }, (e) => { p.feed = null; fail('a feed')(e); });
    } else if (st !== 'ok') {
      if (p.feed) { try { p.feed(); } catch (e) { /* already stopped */ } p.feed = null; }
      delete soc.feeds[uid];
    }
    changed();
  }, fail('a follow check'));
}

function start(u) {
  const me = u.uid;
  if (soc.uid !== me) soc = { ...blank(), uid: me };
  run = { uid: me, member: false, mineReady: false, unsubs: [], per: {}, vouched: new Set() };
  broken = false;
  // Who I follow, then each of them.
  run.unsubs.push(cloud.watchAll(`users/${me}/following`, {}, (docs) => {
    if (!run || run.uid !== me) return;
    const old = new Map(soc.following.map((f) => [f.uid, f]));
    soc.following = docs.map((d) => ({ uid: d.id, name: d.name || 'Friend', at: d.at || 0, st: (old.get(d.id) || {}).st || 'req', seen: (old.get(d.id) || {}).seen && !!run.per[d.id] })).sort((a, b) => a.name.localeCompare(b.name));
    freshNames(soc.following);
    const want = new Set(docs.map((d) => d.id));
    for (const k of Object.keys(run.per)) if (!want.has(k)) { dropFriend(k); delete soc.feeds[k]; }
    for (const k of want) if (!run.per[k]) watchFriend(k);
    changed();
  }, fail('your following list')));
  card(me, u).catch((e) => console.warn('Friends: name card', e));
  memberPart();
}
// My name card; made the first time, from the Google account's first name.
async function card(me, u) {
  const p = await cloud.getOne('profiles/' + me);
  if (!run || run.uid !== me) return;
  if (p && p.name) soc.me = { name: p.name, code: p.code || '' };
  else { soc.me = { name: firstName(u.name) || 'A friend', code: '' }; await saveCard(me); }
  changed();
  ensureCode();
}
// A short code friends can type or tap (members only).
async function ensureCode() {
  if (!run || !run.member || !soc.me || soc.me.code || run.coding) return;
  const me = run.uid;
  run.coding = true;
  for (let i = 0; i < 6; i++) {
    let code = '';
    const r = crypto.getRandomValues(new Uint8Array(6));
    for (const b of r) code += CODE_CHARS[b % 32];
    try { await cloud.put('codes/' + code, { uid: me }); } catch (e) { continue; } // taken: try another
    if (!run || run.uid !== me) return;
    soc.me.code = code;
    await saveCard(me).catch(() => {});
    changed();
    break;
  }
  if (run) run.coding = false;
}
// The parts only someone who has been let in can use: their followers, and their own published workouts.
function memberPart() {
  if (!run || run.member || !isMember()) return;
  const me = run.uid;
  run.member = true;
  let first = true;
  run.unsubs.push(cloud.watchAll(`users/${me}/followers`, {}, (docs) => {
    if (!run || run.uid !== me) return;
    const old = new Set(soc.followers.map((f) => f.uid));
    soc.followers = docs.map((d) => ({ uid: d.id, name: d.name || 'Someone', st: d.st === 'ok' ? 'ok' : 'req', at: d.at || 0 })).sort((a, b) => b.at - a.at);
    if (!first) for (const f of soc.followers) if (f.st === 'req' && !old.has(f.uid)) tell('req', `${f.name} wants to follow you`);
    first = false;
    freshNames(soc.followers);
    // Accepting has two steps (mark as accepted, then let them in). If the second was cut off
    // by a lost signal, finish it here, once each time the app opens.
    for (const f of soc.followers) {
      if (f.st !== 'ok' || run.vouched.has(f.uid)) continue;
      run.vouched.add(f.uid);
      cloud.put('members/' + f.uid, { by: me, at: Date.now() }).catch(() => run && run.vouched.delete(f.uid));
    }
    changed();
    watchMine();
    queuePublish(600);
  }, fail('your followers list')));
  ensureCode();
}
function watchMine() {
  if (!run || run.mine || !soc.followers.some((f) => f.st === 'ok')) return;
  const me = run.uid;
  let first = true;
  run.mine = true;
  run.unsubs.push(cloud.watchAll(`users/${me}/feed`, { order: 't', limit: FEED_N + 10 }, (docs) => {
    if (!run || run.uid !== me) return;
    if (!first) { // a new cheer while the app is open
      const before = new Map(soc.mine.map((d) => [d.id, d.ch || {}]));
      for (const d of docs) for (const [k, name] of Object.entries(d.ch || {})) if (before.has(d.id) && !(k in before.get(d.id))) tell('cheer', `${name} cheered your ${d.title}`);
    }
    first = false;
    soc.mine = docs;
    run.mineReady = true;
    changed();
    queuePublish(400);
  }, (e) => { run.mine = false; fail('your published workouts')(e); }));
}

// Called whenever sign-in or sync status changes.
function check() {
  if (!loaded) return;
  const u = syncUser();
  const y = syncInfo();
  if (!u) {
    stop();
    if (!y.on && !y.wait && y.phase !== 'starting' && soc.uid) { soc = blank(); kvSet('social', undefined); changed(); } // signed out: forget it all
    return;
  }
  if (run && run.uid !== u.uid) stop();
  if (!run) start(u); else memberPart();
  if (run.member) queuePublish();
}
function wake() {
  if (document.visibilityState === 'hidden') return;
  if (broken && syncUser()) { stop(); check(); } else if (run && run.member) queuePublish(1500);
}

export async function initSocial() {
  if (!cloud.configured()) return;
  const saved = await kvGet('social');
  if (saved && saved.uid && saved.uid === state.sync.uid) soc = { ...blank(), ...saved };
  loaded = true;
  onSyncStatus(check);
  onSyncLeave(stop); // stop watching before the sign-out, so nothing is left asking for what it can no longer see
  onSyncData(() => queuePublish());
  onLocalChange((list, id, del) => {
    if (!run || !run.member) return;
    if (list === 'workouts' || list === 'settings') queuePublish(del ? 300 : 2500);
  });
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  check();
  changed();
}
