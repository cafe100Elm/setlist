// Offline helper. Keeps a copy of the app's own files on the device so Setlist
// opens with no signal. It never stores or sends anyone's workouts.
//
// How updates reach people: every time the app opens with a connection, each
// file is re-checked in the background and the saved copy replaced if it
// changed. The new version shows the next time the app is opened.
const CACHE = 'setlist-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/store.js', 'js/lib.js', 'js/util.js', 'js/stats.js', 'js/io.js', 'js/charts.js',
  'js/workout.js', 'js/exercises.js', 'js/share.js', 'js/log.js', 'js/home.js', 'js/library.js', 'js/insights.js', 'js/history.js', 'js/settings.js', 'js/plans.js', 'js/coach.js', 'js/tour.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/reference/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req, { cache: 'no-cache' }).then(async (res) => {
      if (res.ok && res.type === 'basic') {
        if (cached) {
          const a = cached.headers.get('etag') || cached.headers.get('last-modified');
          const b = res.headers.get('etag') || res.headers.get('last-modified');
          if (a && b && a !== b) announceUpdate();
        }
        await cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
