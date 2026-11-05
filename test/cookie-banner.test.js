/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
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

test('the explicit banner starts only the real CMP without synthesizing consent', () => {
  const calls = [];
  const doc = {};
  const win = { location: new URL('http://localhost:3000/home?cookiebanner=1&consent=accept') };
  const controller = {};
  const start = (...args) => { calls.push(args); return controller; };
  assert.equal(startCookieBanner(doc, win, start), controller);
  assert.deepEqual(calls, [[doc, win]]);
  assert.equal(doc.cookie, 'OptanonAlertBoxClosed=; Max-Age=0; Path=/');
  win.location = new URL('http://localhost:3000/home');
  assert.equal(startCookieBanner(doc, win, () => assert.fail('Not explicitly enabled')), null);
});
