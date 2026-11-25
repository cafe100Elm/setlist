// Checks firestore.rules against a pretend cloud on this computer: what each kind of
// person (owner, newcomer, accepted follower, stranger, signed out) can and cannot do.
// Made-up accounts only; it never touches the real project.
//
// To run (needs Java for the pretend database; see CLAUDE.md → "Testing following"):
//   cd firebase && npx -y firebase-tools@latest emulators:start --only auth,firestore --project demo-setlist
//   node firebase/test/rules-test.mjs        (in a second terminal; wipes the pretend database first)
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-setlist/databases/(default)/documents';
const val = (v) => v === null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
const fields = (o) => val(o).mapValue.fields;
async function who(sub, email, verified = true, name = sub) {
  const r = await fetch(`${AUTH}/accounts:signInWithIdp?key=demo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postBody: 'providerId=google.com&id_token=' + encodeURIComponent(JSON.stringify({ sub, email, email_verified: verified, name })), requestUri: 'http://localhost', returnIdpCredential: true, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.idToken) throw new Error('sign-in failed ' + JSON.stringify(j));
  return { uid: j.localId, tok: j.idToken, name };
}
const H = (u) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + (u === 'admin' ? 'owner' : u.tok) });
// A refusal must be a real "not allowed" (403); anything else means the check itself is wrong.
const ok = async (r) => { if (r.status >= 300 && r.status !== 403) console.log('  note: refused with status', r.status, r.url.slice(60)); return r.status >= 200 && r.status < 300; };
const set = (u, path, data) => fetch(`${FS}/${path}`, { method: 'PATCH', headers: H(u), body: JSON.stringify({ fields: fields(data) }) }).then(ok);
const upd = (u, path, mask, data) => fetch(`${FS}/${path}?currentDocument.exists=true&${mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&')}`, { method: 'PATCH', headers: H(u), body: JSON.stringify({ fields: fields(data) }) }).then(ok);
const get = (u, path) => fetch(`${FS}/${path}`, { headers: H(u) }).then(ok);
const del = (u, path) => fetch(`${FS}/${path}`, { method: 'DELETE', headers: H(u) }).then(ok);
const list = get;
let pass = 0, fail = 0;
async function expect(label, p, want) { const got = await p; if (got === want) pass++; else { fail++; console.log(`FAIL: ${label} (expected ${want ? 'allowed' : 'refused'})`); } }
const yes = (l, p) => expect(l, p, true), no = (l, p) => expect(l, p, false);

await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-setlist/databases/(default)/documents', { method: 'DELETE' });
await set('admin', 'config/access', { emails: ['owner@example.com'] });
const owner = await who('owner1', 'owner@example.com'), sam = await who('sam1', 'sam@example.com'), eve = await who('eve1', 'eve@example.com'), unv = await who('unv1', 'unv@example.com', false);
const O = owner.uid, S = sam.uid, E = eve.uid;
const now = Date.now();

// The owner (on the list) keeps what he had.
await yes('owner writes own workout', set(owner, `users/${O}/workouts/w1`, { u: 1, del: false, d: '{}' }));
await yes('owner reads own workout', get(owner, `users/${O}/workouts/w1`));
await no('nobody reads the invite list', get(owner, 'config/access'));
await no('nobody writes the invite list', set(owner, 'config/access', { emails: ['eve@example.com'] }));
// A newcomer who signed in but hasn't been accepted by anyone.
await no('newcomer cannot write a log', set(sam, `users/${S}/workouts/w1`, { u: 1, del: false, d: '{}' }));
await no('newcomer cannot read the owner log', get(sam, `users/${O}/workouts/w1`));
await no('newcomer cannot list the owner log', list(sam, `users/${O}/workouts`));
await yes('newcomer makes own name card', set(sam, `profiles/${S}`, { name: 'Sam', u: now }));
await no('name card: someone else\'s', set(sam, `profiles/${O}`, { name: 'Sam', u: now }));
await no('name card: name too long', set(sam, `profiles/${S}`, { name: 'x'.repeat(41), u: now }));
await no('name card: extra field', set(sam, `profiles/${S}`, { name: 'Sam', u: now, admin: true }));
await yes('anyone signed in reads a name card', get(eve, `profiles/${S}`));
await no('name cards cannot be listed', list(eve, 'profiles'));
await no('unverified account: name card', set(unv, `profiles/${unv.uid}`, { name: 'U', u: now }));
await no('newcomer cannot make a code', set(sam, 'codes/SAM234', { uid: S }));
await yes('member makes a code', set(owner, 'codes/ABC234', { uid: O }));
await no('code cannot be overwritten', set(owner, 'codes/ABC234', { uid: O }));
await no('code for someone else', set(owner, 'codes/ABD234', { uid: S }));
await no('code in a bad shape', set(owner, 'codes/abc', { uid: O }));
await yes('newcomer looks up a code', get(sam, 'codes/ABC234'));
await no('codes cannot be listed', list(sam, 'codes'));
await no('newcomer cannot let self in', set(sam, `members/${S}`, { by: S, at: now }));
// Asking to follow.
await yes('newcomer remembers who they asked', set(sam, `users/${S}/following/${O}`, { name: 'Owner', at: now }));
await no('others cannot read who I follow', list(eve, `users/${S}/following`));
await no('ask: cannot start as accepted', set(sam, `users/${O}/followers/${S}`, { name: 'Sam', st: 'ok', at: now }));
await no('ask: cannot ask as someone else', set(eve, `users/${O}/followers/${S}`, { name: 'Sam', st: 'req', at: now }));
await yes('ask to follow', set(sam, `users/${O}/followers/${S}`, { name: 'Sam', st: 'req', at: now }));
await no('asker cannot accept own request', upd(sam, `users/${O}/followers/${S}`, ['st'], { st: 'ok' }));
await no('asker cannot overwrite request as accepted', set(sam, `users/${O}/followers/${S}`, { name: 'Sam', st: 'ok', at: now }));
await yes('asker sees own request', get(sam, `users/${O}/followers/${S}`));
await no('stranger cannot see the request', get(eve, `users/${O}/followers/${S}`));
await no('asker cannot list followers', list(sam, `users/${O}/followers`));
await yes('owner lists followers', list(owner, `users/${O}/followers`));
// Before being accepted: nothing of the owner's is visible.
await yes('owner publishes a workout', set(owner, `users/${O}/feed/w1`, { t: now, e: now + 1, title: 'Legs', sets: 3, vol: 100, n: 1, lv: 'f', u: 1, d: '[]' }));
await no('not accepted yet: cannot read feed', get(sam, `users/${O}/feed/w1`));
await no('not accepted yet: cannot list feed', list(sam, `users/${O}/feed`));
await no('not accepted yet: cannot cheer', upd(sam, `users/${O}/feed/w1`, ['ch.`' + S + '`'], { ch: { [S]: 'Sam' } }));
// Accepted.
await yes('owner accepts', upd(owner, `users/${O}/followers/${S}`, ['st'], { st: 'ok' }));
await no('letting in: cannot sign as someone else', set(owner, `members/${S}`, { by: S, at: now }));
await yes('owner lets the follower in', set(owner, `members/${S}`, { by: O, at: now }));
await yes('follower sees they are in', get(sam, `members/${S}`));
await no('stranger cannot see who is in', get(eve, `members/${S}`));
await yes('follower reads feed', get(sam, `users/${O}/feed/w1`));
await yes('follower lists feed', list(sam, `users/${O}/feed`));
await no('stranger cannot read feed', get(eve, `users/${O}/feed/w1`));
await no('stranger cannot list feed', list(eve, `users/${O}/feed`));
await no('follower still cannot read the full log', get(sam, `users/${O}/workouts/w1`));
await no('follower still cannot list the full log', list(sam, `users/${O}/workouts`));
await no('follower cannot read settings', get(sam, `users/${O}/settings/main`));
await no('follower cannot read routines', list(sam, `users/${O}/routines`));
await no('follower cannot list other followers', list(sam, `users/${O}/followers`));
// Cheers.
await yes('follower cheers', upd(sam, `users/${O}/feed/w1`, ['ch.`' + S + '`'], { ch: { [S]: 'Sam' } }));
await no('cannot cheer as someone else', upd(sam, `users/${O}/feed/w1`, ['ch.`' + E + '`'], { ch: { [E]: 'Eve' } }));
await no('cannot change the workout', upd(sam, `users/${O}/feed/w1`, ['title'], { title: 'Hacked' }));
await no('cannot change workout and cheer together', upd(sam, `users/${O}/feed/w1`, ['title', 'ch.`' + S + '`'], { title: 'Hacked', ch: { [S]: 'Sam' } }));
await no('cheer name too long', upd(sam, `users/${O}/feed/w1`, ['ch.`' + S + '`'], { ch: { [S]: 'x'.repeat(41) } }));
await no('follower cannot delete the workout', del(sam, `users/${O}/feed/w1`));
await no('follower cannot publish into the owner feed', set(sam, `users/${O}/feed/w2`, { t: now, title: 'Fake' }));
await no('stranger cannot cheer', upd(eve, `users/${O}/feed/w1`, ['ch.`' + E + '`'], { ch: { [E]: 'Eve' } }));
await yes('follower takes cheer back', upd(sam, `users/${O}/feed/w1`, ['ch.`' + S + '`'], { ch: {} }));
// The follower is now a member: own log, own code, can let a friend in.
await yes('new member writes own log', set(sam, `users/${S}/workouts/w1`, { u: 1, del: false, d: '{}' }));
await yes('new member makes a code', set(sam, 'codes/SAM234', { uid: S }));
await no('owner cannot read the new member log', get(owner, `users/${S}/workouts/w1`));
await no('owner cannot read the new member feed unasked', list(owner, `users/${S}/feed`));
await no('stranger cannot let self in', set(eve, `members/${E}`, { by: E, at: now }));
await yes('stranger asks the new member', set(eve, `users/${S}/followers/${E}`, { name: 'Eve', st: 'req', at: now }));
await yes('new member accepts', upd(sam, `users/${S}/followers/${E}`, ['st'], { st: 'ok' }));
await yes('new member lets a friend in', set(sam, `members/${E}`, { by: S, at: now }));
await no('friend of a friend still cannot read the owner feed', list(eve, `users/${O}/feed`));
// Removing a follower, and withdrawing.
await yes('owner removes the follower', del(owner, `users/${O}/followers/${S}`));
await no('removed follower cannot read feed', get(sam, `users/${O}/feed/w1`));
await no('removed follower cannot list feed', list(sam, `users/${O}/feed`));
await yes('ask again', set(sam, `users/${O}/followers/${S}`, { name: 'Sam', st: 'req', at: now }));
await yes('withdraw own request', del(sam, `users/${O}/followers/${S}`));
// Signed out entirely.
await no('signed out: feed', fetch(`${FS}/users/${O}/feed/w1`).then(ok));
await no('signed out: name card', fetch(`${FS}/profiles/${S}`).then(ok));
await no('signed out: code', fetch(`${FS}/codes/ABC234`).then(ok));
console.log(`${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
