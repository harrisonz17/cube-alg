// Offline support: every file the app needs is cached on first visit.
// Bump VERSION whenever you change a file so installed copies pick up the update.
const VERSION = 'cube-algs-v3';
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'js/cube.js',
  'js/render.js',
  'js/algs.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from the cache straight away (works with no connection),
// and refresh the cached copy in the background when online.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    })
  );
});
