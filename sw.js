// Offline helper. Keeps a copy of the app's own files on the device so Setlist
// opens with no signal. It never stores or sends anyone's workouts.
//
// How updates reach people: the app always opens from the saved copy. A few
// seconds after it opens with a connection, every file is checked in the
// background. Only if ALL of them download does the saved copy get replaced,
// in one go, so a dropped signal can never leave a half-old, half-new app.
// The new version shows the next time the app is opened.
const CACHE = 'setlist-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/store.js', 'js/lib.js', 'js/util.js', 'js/stats.js', 'js/io.js', 'js/charts.js',
  'js/workout.js', 'js/exercises.js', 'js/share.js', 'js/log.js', 'js/home.js', 'js/library.js', 'js/insights.js', 'js/history.js', 'js/settings.js', 'js/plans.js', 'js/coach.js', 'js/tour.js', 'js/sync.js', 'js/cloud.js', 'js/firebase-config.js', 'js/social.js', 'js/friends.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // addAll is all-or-nothing: if any file fails, nothing is saved
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

let told = false;
async function announceUpdate() {
  if (told) return;
  told = true;
  for (const c of await self.clients.matchAll()) c.postMessage({ type: 'update' });
}

const stamp = (res) => res.headers.get('etag') || res.headers.get('last-modified');
let lastCheck = 0;
async function refreshAll() {
  if (Date.now() - lastCheck < 60000) return;
  lastCheck = Date.now();
  // let the page that just opened finish loading from the saved copy first
  await new Promise((r) => setTimeout(r, 4000));
  // download everything; any failure throws and leaves the saved copy untouched
  const fresh = await Promise.all(SHELL.map(async (u) => {
    const res = await fetch(new Request(u, { cache: 'no-cache' }));
    if (!res.ok) throw new Error('could not fetch ' + u);
    return { u, body: await res.blob(), headers: res.headers, stamp: stamp(res) };
  }));
  const cache = await caches.open(CACHE);
  let changed = false;
  for (const f of fresh) {
    const old = await cache.match(f.u);
    const same = old && (f.stamp && stamp(old) ? stamp(old) === f.stamp : (await old.clone().blob()).size === f.body.size);
    if (!same) { changed = true; break; }
  }
  if (!changed) return;
  // everything is already in memory, so this swap is instant and needs no network
  await Promise.all(fresh.map((f) => cache.put(f.u, new Response(f.body, { headers: f.headers }))));
  announceUpdate();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/reference/')) return;
  if (req.mode === 'navigate') e.waitUntil(refreshAll().catch(() => { lastCheck = 0; }));
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); } catch (err) { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
  })());
});
