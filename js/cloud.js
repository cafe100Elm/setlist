// The only file that talks to the cloud (Google's Firebase): sign-in with a
// Google account, and reading/writing that person's own documents.
// It is loaded only when someone turns sync on, so people who never sign in
// download nothing extra and send nothing anywhere.
//
// Cloud layout, one small document per item:
//   users/{their id}/workouts/{id}   users/{their id}/routines/{id}
//   users/{their id}/custom/{id}     users/{their id}/settings/main
// Each document is { u, del, d, s }:
//   u = when it last changed on a device (newest wins), del = it was deleted,
//   d = the item itself as text, s = when the server received it.
import cfg from './firebase-config.js';

const V = '11.0.2';
const base = `https://www.gstatic.com/firebasejs/${V}/`;
let fa, fs, auth, db, loading;

export const configured = () => !!(cfg && cfg.apiKey);

// Downloads Google's sign-in and database code. Fails (and can be retried) with no connection.
export function init() {
  if (!loading) {
    loading = (async () => {
      const [a, au, st] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
      const app = a.initializeApp(cfg);
      fa = au; fs = st;
      auth = fa.getAuth(app);
      db = fs.getFirestore(app);
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

// Calls back with { uid, email } when signed in, or null when not.
export const onUser = (cb) => fa.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email || '' } : null));

// Opens Google's small sign-in window. If the browser can't or won't (and `mayLeave` allows it), goes to
// Google's page instead and comes back; a note is left so the app finishes the sign-in when it reopens.
const PENDING = 'setlist-sync-signin';
export async function signIn(mayLeave) {
  const provider = new fa.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await fa.signInWithPopup(auth, provider); } catch (e) {
    const code = (e && e.code) || '';
    if (/operation-not-supported|web-storage-unsupported/.test(code) || (mayLeave && /popup-blocked/.test(code))) {
      try { localStorage.setItem(PENDING, String(Date.now())); } catch (e2) { /* private window */ }
      await fa.signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}
// True once, right after coming back from Google's sign-in page.
export function returning() {
  try {
    const t = +localStorage.getItem(PENDING);
    localStorage.removeItem(PENDING);
    return !!t && Date.now() - t < 15 * 60000;
  } catch (e) { return false; }
}
export const signOut = () => fa.signOut(auth);

// Watches one list for anything the server received after `since` (0 = everything).
// onDocs(docs, fromServer): docs = [{ id, u, del, d, s }]; fromServer is false while
// offline, when the answer is only what this device already knew.
export function listen(uid, list, since, onDocs, onErr) {
  const col = fs.collection(db, 'users', uid, list);
  const q = since ? fs.query(col, fs.where('s', '>', fs.Timestamp.fromMillis(since))) : col;
  return fs.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const docs = [];
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue; // our own unsent change
      const x = ch.doc.data();
      docs.push({ id: ch.doc.id, u: x.u || 0, del: !!x.del, d: x.d || '', s: x.s && x.s.toMillis ? x.s.toMillis() : 0 });
    }
    onDocs(docs, !snap.metadata.fromCache);
  }, onErr);
}

// Sends a group of changes together. Resolves once the server has them
// (with no connection it simply waits until there is one).
export async function write(uid, items) {
  const batch = fs.writeBatch(db);
  for (const it of items) {
    batch.set(fs.doc(db, 'users', uid, it.list, it.id), { u: it.u, del: !!it.del, d: it.del ? '' : it.d, s: fs.serverTimestamp() });
  }
  await batch.commit();
}
