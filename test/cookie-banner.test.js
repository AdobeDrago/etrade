/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import startCookieBanner, { cookieBannerRequested } from '../scripts/cookie-banner.js';

test('the cookie banner requires an explicit flag on this site’s preview or local host', () => {
  ['http://localhost:3000', 'https://fix-40-privacy-choices--etrade--adobedrago.aem.page'].forEach((origin) => {
    assert.equal(cookieBannerRequested(`${origin}/home?cookiebanner=true`), true);
    assert.equal(cookieBannerRequested(`${origin}/home?cookiebanner=1`), true);
    ['', '?cookiebanner=0', '?cookiebanner=false', '?cookiebanner=', '?cookiebanner=1&cookiebanner=0']
      .forEach((query) => assert.equal(cookieBannerRequested(`${origin}/home${query}`), false));
  });
  ['https://us.etrade.com', 'https://main--etrade--adobedrago.aem.live', 'https://evil.example',
    'https://demo--etrade--adobedrago.aem.page.evil.example']
    .forEach((origin) => assert.equal(cookieBannerRequested(`${origin}/home?cookiebanner=1`), false));
});

function browser() {
  const { document, window } = parseHTML('<html><head></head><body><main>Page content</main></body></html>');
  window.location = new URL('http://localhost:3000/home?cookiebanner=1&consent=accept');
  document.cookie = 'OptanonAlertBoxClosed=existing; OptanonConsent=existing';
  const subscribers = new Set();
  let state = { canOpenPreferences: false, sdkStatus: 'loading', timedOut: false };
  let requests = 0;
  const controller = {
    snapshot: () => ({ ...state }),
    openPreferences: () => { requests += 1; },
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
  return {
    document,
    window,
    controller,
    requests: () => requests,
    update: (next) => { state = { ...state, ...next }; subscribers.forEach((fn) => fn(state)); },
  };
}

test('the flag shows a labeled demo banner immediately and leaves stored choices unchanged', () => {
  const context = browser();
  const calls = [];
  const start = (...args) => { calls.push(args); return context.controller; };
  const { cookie } = context.document;
  assert.equal(startCookieBanner(context.document, context.window, start), context.controller);
  const banner = context.document.querySelector('.cookie-banner-demo');
  assert.ok(banner, 'The flag must create a visible banner even while OneTrust is loading');
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent, /Demo cookie banner/);
  assert.equal(context.document.cookie, cookie);
  assert.equal(context.requests(), 0);
  startCookieBanner(context.document, context.window, start);
  assert.equal(context.document.querySelectorAll('.cookie-banner-demo').length, 1);
  assert.equal(context.document.querySelectorAll('link[rel="stylesheet"]').length, 1);
  assert.equal(calls.length, 1);
});

test('the preferences button queues the real center and keeps feedback visible until ready', () => {
  const context = browser();
  startCookieBanner(context.document, context.window, () => context.controller);
  const banner = context.document.querySelector('.cookie-banner-demo');
  assert.ok(banner);
  banner.querySelector('[data-cookie-preferences]').click();
  assert.equal(context.requests(), 1);
  assert.match(banner.querySelector('[role="status"]').textContent, /Opening/);
  assert.equal(banner.isConnected, true);
  context.update({ canOpenPreferences: true, sdkStatus: 'loaded' });
  assert.equal(banner.isConnected, false);
});

test('dismissing the demo does not open preferences or change cookie choices', () => {
  const context = browser();
  const { cookie } = context.document;
  startCookieBanner(context.document, context.window, () => context.controller);
  const banner = context.document.querySelector('.cookie-banner-demo');
  assert.ok(banner);
  banner.querySelector('[data-cookie-dismiss]').click();
  assert.equal(banner.isConnected, false);
  assert.equal(context.requests(), 0);
  assert.equal(context.document.cookie, cookie);
});

test('a failed real CMP keeps the demo visible and explains how to retry', () => {
  const context = browser();
  startCookieBanner(context.document, context.window, () => context.controller);
  const banner = context.document.querySelector('.cookie-banner-demo');
  assert.ok(banner);
  banner.querySelector('[data-cookie-preferences]').click();
  context.update({ sdkStatus: 'error' });
  assert.equal(banner.isConnected, true);
  assert.match(banner.querySelector('[role="status"]').textContent, /Reload/);
});

test('a late preference center restores the button after the SDK timed out', () => {
  const context = browser();
  startCookieBanner(context.document, context.window, () => context.controller);
  const button = context.document.querySelector('[data-cookie-preferences]');
  context.update({ timedOut: true });
  assert.equal(button.disabled, true);
  context.update({ canOpenPreferences: true, sdkStatus: 'loaded' });
  assert.equal(button.disabled, false);
  assert.equal(context.document.querySelector('[role="status"]').textContent, '');
});

test('without the preview flag there is no banner, stylesheet or real SDK startup', () => {
  const context = browser();
  context.window.location = new URL('http://localhost:3000/home');
  assert.equal(startCookieBanner(context.document, context.window, () => assert.fail('Not explicitly enabled')), null);
  assert.equal(context.document.querySelector('.cookie-banner-demo'), null);
  assert.equal(context.document.querySelector('link[rel="stylesheet"]'), null);
});
