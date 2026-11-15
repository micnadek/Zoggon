const CACHE = 'zoggon2026-v3'; // podbij przy każdej nowej wersji
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './js/main.js', './js/audio.js', './js/render.js', './js/particles.js', './js/input.js', './js/state.js',
  './js/storage.js', './js/entities.js', './js/collide.js', './js/terrain.js', './js/sectors.js', './js/rng.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
