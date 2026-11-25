// The Friends screen: who you follow, who follows you, their recent workouts,
// cheers, this week's scoreboard, and your invite link. Opens from the people
// button in the header. The workings are in js/social.js.
import { state } from './store.js';
import { ui, on, onSubmit, openSheet, closeSheet, topSheet, render, go, toast, confirmBox, promptBox, icons, badge } from './core.js';
import { socialInfo, feed, feedItem, board, onSocial, onSocialEvent, lookup, follow, unfollow, approve, removeFollower, cheer, setName, setInvite, takeInviteFromAddress, initSocial, tidyCode } from './social.js';
import { syncUser } from './sync.js';
import { appUrl, copyText } from './share.js';
import { esc, num, mins, fmtDate, fmtTime, plural, isIOS, isStandalone } from './util.js';

const CLAP = '👏';
// A friend's published workout is their data, not ours: only ever use a known one-letter category from it.
const safeCat = (c) => (typeof c === 'string' && /^[a-z]$/.test(c) ? c : 'f');
let sheet = null; // the Friends sheet while it is open
let busy = ''; // which button is working, so it can't be tapped twice
let codeErr = '';

const when = (x) => `${fmtDate(x.t, { weekday: true })}${x.live ? '' : ` · ${mins(x.e - x.t)}`}`;
const line = (x) => (x.live ? `Working out now · started ${fmtTime(x.t)}` : `${when(x)} · ${plural(x.sets, 'set')}${x.vol ? ` · ${num(x.vol, 0)} lb` : ''}`);
const cheerTag = (x) => (x.cheers.length ? `<span class="cheer-n">${CLAP} ${x.cheers.length}</span>` : '');

function feedRow(x) {
  const mine = x.who === 'me';
  return `<button class="wrow" data-a="${mine ? 'fr-mine' : 'fr-open'}" data-u="${esc(x.who)}" data-id="${esc(x.id)}">
    <span class="wrow-t"><b>${esc(x.name)} · ${esc(x.title)}${x.live ? ' <i class="live-tag">LIVE</i>' : ''}</b><small>${line(x)}</small>${mine && x.cheers.length ? `<small class="cheer-by">${CLAP} ${esc(x.cheers.map((c) => c.name).join(', '))}</small>` : ''}</span>${mine ? '' : cheerTag(x)}
  </button>`;
}

// ── Home card ──
export function friendsCard() {
  const s = socialInfo();
  if (!s.available || !s.signedIn) return '';
  const items = feed({ mine: false }).slice(0, 3);
  const n = s.requests.length;
  if (!items.length && !n && !s.invite) return '';
  let h = `<section class="card"><div class="card-h"><h2>Friends</h2><button class="more" data-a="friends">All →</button></div>`;
  if (n) h += `<button class="sync-note fr-note" data-a="friends">${n === 1 ? `${esc(s.requests[0].name)} wants to follow you` : `${n} people want to follow you`} →</button>`;
  if (s.invite && !n) h += `<button class="sync-note fr-note" data-a="friends">You have an invite to follow a friend →</button>`;
  if (items.length) h += `<div class="list">${items.map(feedRow).join('')}</div>`;
  return h + `</section>`;
}
export const friendsDot = () => socialInfo().requests.length > 0;
if (socialInfo().available) ui.friendsDot = friendsDot; // shows the Friends button in the header

// ── The sheet ──
function signInBlock(s) {
  const again = s.phase === 'signin';
  const wait = s.phase === 'starting';
  return `<section><h4>Train with friends</h4>
    <p class="muted">Follow friends who use Setlist to see their finished workouts, cheer them on and compare your week. It works by approval: you only see people who said yes to you, and only people you said yes to see yours.</p>
    ${s.invite ? `<p class="sync-note">A friend invited you to follow them (code ${esc(s.invite.code)}). Sign in to ask.</p>` : ''}
    ${s.invite && isIOS() && !isStandalone() ? `<p class="muted small">Planning to add Setlist to your home screen? Do that first, then open Friends there and type the code ${esc(s.invite.code)}: the home-screen app signs in separately from this browser page.</p>` : ''}
    ${s.note ? `<p class="sync-note">${esc(s.note)}</p>` : ''}
    <button class="btn primary big" data-a="sync-in"${wait ? ' disabled' : ''}>${wait ? 'Connecting…' : again ? 'Sign in again' : s.phase === 'tap' ? 'Continue with Google' : 'Sign in with Google'}</button>
    <p class="muted small">Signing in keeps a private copy of your log under your Google account. That is what keeps your own devices in step, and what lets followers you approve see your recent workouts. Your notes are never shared.</p>
  </section>`;
}

function inviteBlock(s) {
  const v = s.invite;
  if (!v) return '';
  if (v.err) return `<section><h4>Invite</h4><p class="sync-note">${esc(v.err)}</p><div class="row"><button class="btn grow" data-a="fr-invite-retry">Try again</button><button class="btn" data-a="fr-invite-no">Dismiss</button></div></section>`;
  if (!v.uid) return `<section><h4>Invite</h4><p class="muted">Looking up code ${esc(v.code)}…</p></section>`;
  return `<section><h4>Follow ${esc(v.name)}?</h4>
    <p class="muted">${esc(v.name)} invited you. They'll get your request and choose whether to accept. Once they do, their workouts show up here.</p>
    <div class="row"><button class="btn primary grow" data-a="fr-invite-yes"${busy === 'invite' ? ' disabled' : ''}>Ask to follow ${esc(v.name)}</button><button class="btn" data-a="fr-invite-no">Not now</button></div></section>`;
}

function body() {
  const s = socialInfo();
  let h = `<div class="sheet-top"><div class="sheet-head"><h3>Friends</h3><button class="btn sm" data-a="sheet-close">Done</button></div></div><div class="sheet-scroll friends">`;
  if (!s.signedIn || s.phase === 'signin') return h + signInBlock(s) + `</div>`;

  const ok = s.following.filter((f) => f.st === 'ok');
  h += inviteBlock(s);

  if (s.requests.length) {
    h += `<section><h4>Requests</h4><p class="muted">Say yes and they can see your recent workouts. It also lets them use sync and invite their own friends.</p><div class="list">
      ${s.requests.map((f) => `<div class="lrow"><span><b>${esc(f.name)}</b><small>wants to follow you</small></span><button class="btn sm primary" data-a="fr-approve" data-u="${esc(f.uid)}"${busy === 'ok' + f.uid ? ' disabled' : ''}>Accept</button><button class="btn sm" data-a="fr-decline" data-u="${esc(f.uid)}">Decline</button></div>`).join('')}
    </div></section>`;
  }

  if (s.waiting) h += `<section><p class="sync-note">You're signed in. As soon as a friend accepts your request, their workouts appear here and you can invite friends of your own.</p></section>`;

  if (ok.length) {
    const rows = board();
    h += `<section><h4>This week</h4><div class="board">
      <div class="brow bhead"><span></span><span>Workouts</span><span>Lb lifted</span></div>
      ${rows.map((r, i) => `<div class="brow${r.who === 'me' ? ' me' : ''}"><span><i>${i + 1}</i>${esc(r.name)}${r.live ? ' <i class="live-tag">LIVE</i>' : ''}</span><span>${r.n}</span><span>${num(r.vol, 0)}</span></div>`).join('')}
    </div><p class="muted small">Since Monday. Friends who share summaries only still count here.</p></section>`;
  }

  const items = feed();
  if (ok.length || items.some((x) => x.cheers.length)) {
    h += `<section><h4>Recent workouts</h4>${items.length ? `<div class="list">${items.slice(0, 30).map(feedRow).join('')}</div>` : `<p class="muted">Nothing yet. Workouts appear here as your friends finish them.</p>`}</section>`;
  }

  h += `<section><h4>Follow a friend</h4>
    <p class="muted">${s.following.length ? 'Got another code?' : "You're not following anyone yet."} Ask a friend who uses Setlist for their invite link, or type their 6-character code.</p>
    <form class="row" data-s="fr-code"><input name="code" placeholder="ABC234" autocomplete="off" autocapitalize="characters" maxlength="8" aria-label="Friend's code" enterkeyhint="go"><button class="btn primary"${busy === 'code' ? ' disabled' : ''}>Find</button></form>
    ${codeErr ? `<p class="sync-note">${esc(codeErr)}</p>` : ''}</section>`;

  if (s.following.length) {
    const label = { ok: 'Following', req: 'Waiting for them to accept', none: "Not accepted, or you were removed" };
    h += `<section><h4>You follow</h4><div class="list">
      ${s.following.map((f) => `<div class="lrow"><span><b>${esc(f.name)}</b><small>${label[f.st] || label.req}</small></span><button class="btn sm" data-a="fr-unfollow" data-u="${esc(f.uid)}">${f.st === 'ok' ? 'Unfollow' : f.st === 'req' ? 'Cancel' : 'Remove'}</button></div>`).join('')}
    </div></section>`;
  }

  if (s.member) {
    const mine = s.followers.filter((f) => f.st === 'ok');
    const iFollow = new Set(s.following.map((f) => f.uid));
    h += `<section><h4>Your followers</h4>${mine.length ? `<div class="list">
      ${mine.map((f) => `<div class="lrow"><span><b>${esc(f.name)}</b><small>sees your recent workouts</small></span>${iFollow.has(f.uid) ? '' : `<button class="btn sm primary" data-a="fr-back" data-u="${esc(f.uid)}"${busy === 'back' + f.uid ? ' disabled' : ''}>Follow back</button>`}<button class="btn sm" data-a="fr-remove" data-u="${esc(f.uid)}">Remove</button></div>`).join('')}
    </div>` : `<p class="muted">No one follows you yet. Send a friend your invite below.</p>`}</section>`;

    h += `<section><h4>Invite a friend to follow you</h4>
      ${s.code ? `<p class="muted">Send your link. They open it, sign in with Google and tap <b>Ask to follow</b>; you then accept them here. Your code is <b class="code">${esc(s.code)}</b>.</p>
      <div class="row"><button class="btn primary grow" data-a="fr-share">${icons.share}Send my invite</button><button class="btn" data-a="fr-copy">Copy link</button></div>` : `<p class="muted">Setting up your invite code…</p>`}</section>`;
  }

  h += `<section><h4>You</h4>
    <div class="lrow"><span><b>${esc(s.name)}</b><small>the name your friends see</small></span><button class="btn sm" data-a="fr-name">Change</button></div>
    ${s.member ? `<label class="fld inline"><span>Followers see</span><select data-c="set-str" data-k="shareLevel"><option value="full"${state.settings.shareLevel === 'summary' ? '' : ' selected'}>Full workouts</option><option value="summary"${state.settings.shareLevel === 'summary' ? ' selected' : ''}>Summaries only</option></select></label>
    <p class="muted small">Full: each exercise with its sets and weights. Summary: just the workout's name, date, time taken, sets and total pounds. Either way your notes, routines and settings are never shared, and a workout in progress shows only as "working out now".</p>` : ''}
    <p class="muted small">To sign out, go to the gear → Sync across devices.</p></section>`;
  return h + `</div>`;
}

export function openFriends() {
  if (sheet) return;
  while (topSheet()) closeSheet();
  codeErr = '';
  sheet = openSheet({ cls: 'tall', html: body(), onClose: () => { sheet = null; render(); } });
  resolveInvite();
}
export function refreshFriends() {
  resolveInvite();
  if (!sheet || topSheet() !== sheet) return;
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT' && sheet.body.contains(a) && !busy) return; // don't redraw under someone typing
  const sc = sheet.body.querySelector('.sheet-scroll');
  const y = sc ? sc.scrollTop : 0;
  sheet.set(body());
  const sc2 = sheet.body.querySelector('.sheet-scroll');
  if (sc2) sc2.scrollTop = y;
}

// Once signed in, find out whose code the invite link carried.
async function resolveInvite() {
  const v = socialInfo().invite;
  if (!v || v.uid || v.err || v.busy || !syncUser()) return;
  v.busy = true;
  try { const r = await lookup(v.code); v.uid = r.uid; v.name = r.name; } catch (e) { v.err = e.message; }
  v.busy = false;
  if (v.uid && socialInfo().following.some((f) => f.uid === v.uid)) { setInvite(''); return; } // already asked
  refreshFriends();
}

async function act(key, fn, done) {
  if (busy) return;
  busy = key;
  refreshFriends();
  try { await fn(); if (done) toast(done); } catch (e) { toast(e.message || 'Something went wrong'); }
  busy = '';
  refreshFriends();
}

on('friends', () => openFriends());
on('fr-invite-yes', () => { const v = socialInfo().invite; if (v && v.uid) act('invite', async () => { await follow(v.uid, v.name); setInvite(''); }, `Asked to follow ${v.name}`); });
on('fr-invite-no', () => { setInvite(''); refreshFriends(); });
on('fr-invite-retry', () => { const v = socialInfo().invite; if (v) { delete v.err; resolveInvite(); refreshFriends(); } });
onSubmit('fr-code', (form) => {
  const code = tidyCode(form.code.value);
  codeErr = '';
  if (busy) return;
  busy = 'code';
  refreshFriends();
  lookup(code).then(async (r) => {
    busy = '';
    if (socialInfo().following.some((f) => f.uid === r.uid)) { codeErr = `You already asked to follow ${r.name}.`; refreshFriends(); return; }
    refreshFriends();
    if (await confirmBox({ title: `Follow ${r.name}?`, body: `${r.name} will get your request and choose whether to accept.`, ok: 'Ask to follow', cancel: 'Cancel' })) act('code', () => follow(r.uid, r.name), `Asked to follow ${r.name}`);
  }, (e) => { busy = ''; codeErr = e.message; refreshFriends(); });
});
on('fr-approve', (el) => { const f = socialInfo().requests.find((x) => x.uid === el.dataset.u); if (f) act('ok' + f.uid, () => approve(f.uid), `${f.name} now follows you`); });
on('fr-decline', (el) => act('no', () => removeFollower(el.dataset.u)));
on('fr-remove', async (el) => {
  const f = socialInfo().followers.find((x) => x.uid === el.dataset.u);
  if (!f || !(await confirmBox({ title: `Remove ${f.name}?`, body: `${f.name} will stop seeing your workouts. They aren't told.`, ok: 'Remove', danger: true }))) return;
  act('rm', () => removeFollower(f.uid), `${f.name} removed`);
});
on('fr-back', (el) => { const f = socialInfo().followers.find((x) => x.uid === el.dataset.u); if (f) act('back' + f.uid, () => follow(f.uid, f.name), `Asked to follow ${f.name}`); });
on('fr-unfollow', async (el) => {
  const f = socialInfo().following.find((x) => x.uid === el.dataset.u);
  if (!f) return;
  if (f.st === 'ok' && !(await confirmBox({ title: `Unfollow ${f.name}?`, body: `You'll stop seeing ${f.name}'s workouts. To follow again you'd need to ask again.`, ok: 'Unfollow', danger: true }))) return;
  act('un', () => unfollow(f.uid));
});
on('fr-name', async () => {
  const v = await promptBox({ title: 'Your name', label: 'What your friends see', value: socialInfo().name });
  if (v) act('name', () => setName(v), 'Name saved');
});

const inviteLink = () => appUrl() + '?f=' + socialInfo().code;
on('fr-copy', () => copyText(inviteLink(), 'Invite link copied'));
on('fr-share', async () => {
  const s = socialInfo();
  const text = `Follow my workouts on Setlist. Open the link, sign in with Google and tap "Ask to follow". If it asks for a code, mine is ${s.code}.`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Setlist', text, url: inviteLink() }); } catch (e) { if (e.name !== 'AbortError') copyText(inviteLink(), 'Invite link copied'); }
  } else copyText(`${text} ${inviteLink()}`, 'Invite copied');
});

// ── One friend's workout ──
let detail = null;
function detailHtml(x) {
  const me = (syncUser() || {}).uid;
  const mine = x.cheers.some((c) => c.uid === me);
  const others = x.cheers.filter((c) => c.uid !== me).map((c) => c.name);
  let rows = [];
  try { rows = x.d ? JSON.parse(x.d) : []; } catch (e) { rows = []; }
  if (!Array.isArray(rows)) rows = [];
  rows = rows.filter((r) => r && typeof r === 'object').slice(0, 40);
  const who = [mine ? 'you' : '', ...others].filter(Boolean);
  return `<div class="sheet-top"><div class="sheet-head"><h3>${esc(x.name)}</h3><button class="btn sm" data-a="sheet-close">Done</button></div></div>
    <div class="sheet-scroll fr-detail">
      <div><h2>${esc(x.title)}${x.live ? ' <i class="live-tag">LIVE</i>' : ''}</h2><p class="muted">${fmtDate(x.t, { weekday: true, year: true })} · ${fmtTime(x.t)}</p></div>
      ${x.live ? `<p class="sync-note">${esc(x.name)} is working out right now. The details appear when they finish.</p>` : `
      <div class="figs"><div><b>${mins(x.e - x.t)}</b><span>Time</span></div><div><b>${num(x.sets, 0)}</b><span>Sets</span></div><div><b>${x.vol ? num(x.vol, 0) : '–'}</b><span>Lb lifted</span></div></div>
      ${rows.length ? `<div class="list">${rows.map((r) => `<div class="lrow"><span><b>${esc(r.n)}</b><small>${esc(r.s)}</small></span>${badge(safeCat(r.c))}</div>`).join('')}</div>` : `<p class="muted">${x.full ? 'No sets were ticked off in this one.' : `${esc(x.name)} shares summaries only, so the exercises aren't shown.`}</p>`}`}
      <button class="btn big${mine ? '' : ' primary'}" data-a="fr-cheer" data-u="${esc(x.who)}" data-id="${esc(x.id)}" data-on="${mine ? '' : '1'}">${CLAP} ${mine ? 'Cheered. Tap to undo' : 'Cheer'}</button>
      ${who.length ? `<p class="muted center">Cheered by ${esc(who.join(', '))}</p>` : ''}
    </div>`;
}
on('fr-open', (el) => {
  const x = feedItem(el.dataset.u, el.dataset.id);
  if (!x) return;
  detail = { who: x.who, id: x.id, sheet: openSheet({ cls: 'tall', html: detailHtml(x), onClose: () => { detail = null; refreshFriends(); } }) };
});
on('fr-mine', (el) => { while (topSheet()) closeSheet(); ui.openId = el.dataset.id; go('log'); });
on('fr-cheer', async (el) => {
  if (busy) return;
  busy = 'cheer';
  try { await cheer(el.dataset.u, el.dataset.id, !!el.dataset.on); } catch (e) { toast(e.message || 'Something went wrong'); }
  busy = '';
  refreshDetail();
});
function refreshDetail() {
  if (!detail || topSheet() !== detail.sheet) return;
  const x = feedItem(detail.who, detail.id);
  if (!x) { closeSheet(detail.sheet); return; } // it was deleted, or you no longer follow them
  detail.sheet.set(detailHtml(x));
}

// ── Keeping the screens current ──
function redraw() {
  refreshFriends();
  refreshDetail();
  const btn = document.querySelector('.icon-btn[data-a="friends"]');
  if (btn) btn.classList.toggle('has-dot', friendsDot());
  const a = document.activeElement;
  if (ui.tab === 'home' && !topSheet() && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
}

export async function initFriends() {
  onSocial(redraw);
  onSocialEvent((kind, text) => toast(text));
  const invited = takeInviteFromAddress();
  await initSocial();
  if (invited) openFriends();
}
