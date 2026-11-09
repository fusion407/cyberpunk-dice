import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../dist/', import.meta.url);
const source = await readFile(new URL('sw.js', root), 'utf8');

function worker(cache = {}, network = async () => { throw new Error('Offline'); }) {
  const handlers = {};
  const self = { addEventListener: (type, callback) => { handlers[type] = callback; }, location: { origin: 'https://example.com' }, skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(source, { self, caches: cache, fetch: network, URL, Response });
  return handlers;
}

test('all pre-cached offline resources exist, including home-screen icons', async () => {
  let precached;
  const handlers = worker({ open: async () => ({ addAll: async (urls) => { precached = urls; } }) });
  let pending;
  handlers.install({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.ok(precached.includes('./app.js'));
  assert.ok(precached.includes('./game.js'));
  assert.ok(precached.includes('./feedback.js'));
  assert.ok(precached.includes('./effects.css'));
  assert.ok(precached.includes('./install.js'));
  assert.ok(precached.includes('./install.css'));
  assert.ok(precached.includes('./roll-reveal.js'));
  assert.ok(precached.includes('./roll-reveal.css'));
  for (const file of ['short-circuit', 'katana-slash', 'quickhack', 'braindance', 'eddies', 'vs-button', 'dice-reveal', 'max-face']) assert.ok(precached.includes(`./audio/${file}.wav`));
  assert.ok(precached.includes('./icon-512.png'));
  for (const url of precached) await access(new URL(url === './' ? './index.html' : url, root));
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
  for (const icon of manifest.icons) await access(new URL(icon.src, root));
});

test('offline requests return cached content and navigation falls back to the app shell', async () => {
  const handlers = worker({ match: async (request) => {
    const key = typeof request === 'string' ? request : request.url;
    if (key === 'https://example.com/app.js') return new Response('cached javascript');
    if (key === './index.html') return new Response('<main>Gig Tracker</main>');
  } });
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.com/app.js', mode: 'cors' }, respondWith: (value) => { response = value; } });
  assert.equal(await (await response).text(), 'cached javascript');
  handlers.fetch({ request: { method: 'GET', url: 'https://example.com/return-to-match', mode: 'navigate' }, respondWith: (value) => { response = value; } });
  assert.match(await (await response).text(), /Gig Tracker/);
});

test('online responses refresh cached assets while external requests are untouched', async () => {
  let written;
  let pending;
  const handlers = worker({ open: async () => ({ put: async (request, response) => { written = await response.text(); } }) }, async () => new Response('fresh asset'));
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.com/app.js' }, respondWith: (value) => { response = value; }, waitUntil: (value) => { pending = value; } });
  assert.equal(await (await response).text(), 'fresh asset');
  await pending;
  assert.equal(written, 'fresh asset');
  let intercepted = false;
  handlers.fetch({ request: { method: 'GET', url: 'https://external.example/font' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
