/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function browser(href = 'https://www.morganstanley.com/privacy-pledge?@action=privacy-preferences', icon = '') {
  const { document, window: domWindow } = parseHTML(`<html><head></head><body><footer class="footer">
    <a href="${href}" target="_blank">Your Privacy Choices${icon}</a>
    <a href="https://www.morganstanley.com/privacy-pledge">Privacy &amp; Cookies</a>
  </footer></body></html>`);
  const events = new domWindow.EventTarget();
  const window = {
    CustomEvent: domWindow.CustomEvent,
    performance: { now: () => 0 },
    setTimeout: () => 1,
    clearTimeout: () => {},
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  const context = vm.createContext({
    document, window, URL, URLSearchParams, CustomEvent: domWindow.CustomEvent,
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const dependency = new vm.SourceTextModule(await readFile(url, 'utf8'), {
      context, identifier: url.href,
    });
    modules.set(url.href, dependency);
    await dependency.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return dependency;
  }
  const module = await moduleFor(new URL('../scripts/privacy.js', import.meta.url));
  await module.evaluate();
  const root = document.querySelector('.footer');
  const bind = () => module.namespace.default(root);
  bind();
  const link = root.querySelector('a');
  const click = (element = link) => {
    const event = new domWindow.Event('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
  };
  return {
    document, window, root, link, click, bind,
  };
}

test('the footer loads ETRADE OneTrust on demand and opens its center after initialization', async () => {
  const context = await browser();
  assert.equal(context.document.querySelector('script'), null);
  assert.equal(context.click().defaultPrevented, true);
  assert.equal(context.click().defaultPrevented, true);
  const scripts = context.document.querySelectorAll('script');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://cdn2.etrade.net/1/1d/aempros/content/dam/onetrust/etpros/scripttemplates/otSDKStub.js');
  assert.equal(scripts[0].getAttribute('data-domain-script'), '01953914-53cc-7833-b8d6-c9c9d7301ff9');
  let opened = 0;
  context.window.OneTrust = { ToggleInfoDisplay: () => { opened += 1; } };
  context.window.OnetrustActiveGroups = ',C0001,';
  const center = context.document.createElement('div');
  center.id = 'onetrust-pc-sdk';
  context.document.body.append(center);
  context.window.OptanonWrapper();
  assert.equal(opened, 1);
  assert.equal(context.window.etradeOneTrust.hasConsent(), false);
  assert.equal(context.document.querySelector('dialog'), null);
  assert.equal(context.link.getAttribute('href'), 'https://www.morganstanley.com/privacy-pledge');
});

test('an installed OneTrust API opens once without injecting another script', async () => {
  const context = await browser();
  let opened = 0;
  context.window.OneTrust = { ToggleInfoDisplay: () => { opened += 1; } };
  context.bind();
  assert.equal(context.click().defaultPrevented, true);
  assert.equal(opened, 1);
  assert.equal(context.document.querySelector('script'), null);
});

test('another consent manager may handle privacy:open; ordinary privacy links stay unchanged', async () => {
  const context = await browser();
  context.root.addEventListener('privacy:open', (event) => event.preventDefault());
  assert.equal(context.click().defaultPrevented, true);
  assert.equal(context.click(context.root.querySelectorAll('a')[1]).defaultPrevented, false);
  assert.equal(context.document.querySelector('script'), null);
});

test('an icon alone never turns an ordinary link into a OneTrust action', async () => {
  const context = await browser('https://www.morganstanley.com/privacy-pledge', '<span class="icon icon-privacy-options"></span>');
  assert.equal(context.click().defaultPrevented, false);
  assert.equal(context.document.querySelector('script'), null);
});

test('encoded action markers retain the fallback query bytes and fragment without relying on wording', async () => {
  const context = await browser('/privacy?sig=a%20b%2f&%40action=privacy-preferences#cookies');
  context.link.textContent = 'Manage cookies';
  assert.equal(context.click().defaultPrevented, true);
  assert.equal(context.link.getAttribute('href'), '/privacy?sig=a%20b%2f#cookies');
  assert.equal(context.link.dataset.linkAction, 'privacy-preferences');
  assert.equal(context.link.getAttribute('aria-haspopup'), 'dialog');
});

test('unsupported and duplicate query actions and markers in fragments do not open OneTrust', async () => {
  await Promise.all([
    ['/privacy?@action=unknown#cookies', '/privacy#cookies'],
    ['/privacy?@action=privacy-preferences&@action=unknown', '/privacy'],
    ['/privacy?@action=', '/privacy'],
    ['/privacy#cookies?@action=privacy-preferences', '/privacy#cookies?@action=privacy-preferences'],
  ].map(async ([href, clean]) => {
    const context = await browser(href);
    assert.equal(context.click().defaultPrevented, false, href);
    assert.equal(context.link.getAttribute('href'), clean);
    assert.equal(context.document.querySelector('script'), null);
  }));
});
