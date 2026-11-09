const CACHE = 'gig-tracker-v12';
const ASSETS = ['./', './index.html', './styles.css', './table-view.css', './dice.css', './effects.css', './install.css', './app.js', './game.js', './feedback.js', './install.js', './roll-reveal.js', './roll-reveal.css', './audio/short-circuit.wav', './audio/katana-slash.wav', './audio/quickhack.wav', './audio/braindance.wav', './audio/eddies.wav', './audio/vs-button.wav', './audio/dice-reveal.wav', './audio/max-face.wav', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './manifest.webmanifest'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('gig-tracker-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request).then((response) => response || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
