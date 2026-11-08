import test from 'node:test';
import assert from 'node:assert/strict';
import { setupInstall, installHelp } from '../dist/install.js';

function harness({ mobile = true, standalone = false, nav = {}, secure = true } = {}) {
  function media(matches) {
    const target = new EventTarget(); target.matches = matches;
    target.change = value => { target.matches = value; target.dispatchEvent(new Event('change')); };
    return target;
  }
  const viewport = media(mobile), display = media(standalone);
  const win = Object.assign(new EventTarget(), { isSecureContext: secure, matchMedia: query => query.includes('display-mode') ? display : viewport });
  const promotion = { hidden: true }, attrs = {}, callbacks = {}, notifications = [];
  const button = { disabled: false, setAttribute: (key, value) => { attrs[key] = value; }, addEventListener: (type, callback) => { callbacks[type] = callback; } };
  let help = 0, installed = 0;
  setupInstall({ win, nav, promotion, button, onHelp: () => { help++; }, onInstalled: () => { installed++; }, notify: text => notifications.push(text) });
  function offer(outcome = 'accepted', prompt = async () => {}) {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = prompt; event.userChoice = Promise.resolve({ outcome });
    win.dispatchEvent(event); return event;
  }
  return { win, viewport, display, promotion, button, attrs, notifications, offer, click: () => callbacks.click(), get help() { return help; }, get installed() { return installed; } };
}

test('the native prompt is requested only by a click; accepting hides the install offer', async () => {
  const h = harness(); let prompts = 0;
  assert.equal(h.promotion.hidden, false);
  const event = h.offer('accepted', async () => { prompts++; });
  assert.equal(event.defaultPrevented, true); assert.equal(prompts, 0);
  await h.click();
  assert.equal(prompts, 1); assert.equal(h.promotion.hidden, true);
  assert.match(h.notifications[0], /requested/);
  h.win.dispatchEvent(new Event('appinstalled'));
  assert.equal(h.installed, 1); assert.match(h.notifications.at(-1), /installed/);
  await h.click(); assert.equal(prompts, 1);
});

test('dismissed prompts are not reused, and a later fresh prompt can be requested', async () => {
  const h = harness(); let prompts = 0;
  h.offer('dismissed', async () => { prompts++; }); await h.click();
  assert.equal(h.promotion.hidden, false); assert.equal(h.help, 0);
  await h.click(); assert.equal(prompts, 1); assert.equal(h.help, 1);
  h.offer('accepted', async () => { prompts++; }); await h.click();
  assert.equal(prompts, 2); assert.equal(h.promotion.hidden, true);
});

test('double taps cannot open duplicate prompts, and errors fall back to instructions', async () => {
  const h = harness(); let finish, prompts = 0;
  h.offer('dismissed', () => { prompts++; return new Promise(resolve => { finish = resolve; }); });
  const first = h.click(); await h.click();
  assert.equal(prompts, 1); assert.equal(h.button.disabled, true); assert.equal(h.attrs['aria-busy'], 'true');
  finish(); await first; assert.equal(h.button.disabled, false);
  h.offer('accepted', async () => { throw new Error('Prompt unavailable'); }); await h.click();
  assert.equal(h.help, 1); assert.equal(h.promotion.hidden, false); assert.equal(h.button.disabled, false);
});

test('without a native prompt, the button shows help without claiming an installation', async () => {
  const h = harness(); await h.click();
  assert.equal(h.help, 1); assert.equal(h.promotion.hidden, false); assert.deepEqual(h.notifications, []);
});

test('installed display modes, iOS home-screen mode, desktop, and insecure pages hide the offer', () => {
  for (const settings of [{ standalone: true }, { nav: { standalone: true } }, { mobile: false }, { secure: false }]) {
    const h = harness(settings); assert.equal(h.promotion.hidden, true);
  }
  const h = harness(); h.display.change(true); assert.equal(h.promotion.hidden, true);
  h.display.change(false); assert.equal(h.promotion.hidden, false);
  h.viewport.change(false); assert.equal(h.promotion.hidden, true);
  h.viewport.change(true); assert.equal(h.promotion.hidden, false);
  h.win.dispatchEvent(new Event('appinstalled')); assert.equal(h.promotion.hidden, true);
});

test('desktop browsers keep their normal install prompt behavior', () => {
  const h = harness({ mobile: false });
  assert.equal(h.offer().defaultPrevented, false);
});

test('installation help covers iPhone, desktop-identifying iPads, and Android', () => {
  for (const nav of [{ userAgent: 'iPhone', platform: 'iPhone' }, { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }]) {
    const help = installHelp(nav); assert.match(help.title, /iPhone or iPad/);
    assert.match(help.steps.join(' '), /Share.*Add to Home Screen.*Open as Web App/);
  }
  const android = installHelp({ userAgent: 'Mozilla/5.0 Android' });
  assert.match(android.title, /Android/); assert.match(android.steps.join(' '), /Install app or Add to Home screen/);
});
