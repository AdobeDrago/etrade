/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import mountDemoHelper, { isDemoHelperHost, saveDemoBalance, rateConnection } from '../scripts/demo-helper.js';
import applyDemoBalance from '../scripts/demo-balance.js';
import { normalizeBankRates, selectBankRate } from '../scripts/bank-rates.js';

function browser(hostname = 'demo--etrade--adobedrago.aem.page') {
  const storage = new Map();
  const session = new Map();
  let reloads = 0;
  const store = (map) => ({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  });
  const win = {
    location: { hostname, href: `https://${hostname}/home`, reload: () => { reloads += 1; } },
    localStorage: store(storage),
    sessionStorage: store(session),
    innerHeight: 900,
    addEventListener: () => {},
    setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
    clearTimeout,
    MutationObserver: class { observe() { return this; } },
  };
  return {
    win, storage, session, reloads: () => reloads,
  };
}

function page(markup = '', head = '') {
  const { document, window } = parseHTML(`<html><head>${head}</head><body><main>${markup}</main></body></html>`);
  const context = browser();
  const root = mountDemoHelper(document, context.win);
  let focused;
  Object.defineProperty(document, 'activeElement', { get: () => focused });
  root.querySelectorAll('button, input, select').forEach((element) => {
    element.focus = () => { focused = element; };
  });
  const input = root.querySelector('input');
  input.setCustomValidity = () => {};
  input.reportValidity = () => {};
  return {
    ...context, document, window, root,
  };
}

test('helper guard accepts only local hosts and the exact demo preview host', () => {
  ['localhost', '127.0.0.1', '[::1]', 'DEMO--ETRADE--ADOBEDRAGO.AEM.PAGE'].forEach((host) => assert.equal(isDemoHelperHost(host), true));
  ['', 'us.etrade.com', 'demo--etrade--adobedrago.aem.live', 'main--etrade--adobedrago.aem.page', 'et-hero-2--etrade--adobedrago.aem.page', 'demo--etrade--adobedrago.aem.page.example.com'].forEach((host) => assert.equal(isDemoHelperHost(host), false));
});

test('balance save persists zero and reload state; reset removes only the balance', () => {
  const context = browser();
  context.storage.set('unrelated', 'keep');
  assert.deepEqual(saveDemoBalance(' 0 ', context.win), { balance: '0' });
  assert.equal(context.storage.get('userBalance'), '0');
  assert.equal(context.session.get('etrade:demo-helper-open'), 'true');
  assert.equal(context.reloads(), 1);
  saveDemoBalance(null, context.win);
  assert.equal(context.storage.has('userBalance'), false);
  assert.equal(context.storage.get('unrelated'), 'keep');
  assert.equal(context.reloads(), 2);
});

test('invalid balances, blocked storage and non-demo hosts never save or reload', () => {
  const context = browser();
  ['', '-1', '100,000', '$1000', '1e5', 'NaN', 'Infinity'].forEach((value) => assert.ok(saveDemoBalance(value, context.win).error));
  assert.equal(context.reloads(), 0);
  context.win.localStorage.setItem = () => { throw new Error('Denied'); };
  assert.ok(saveDemoBalance('1000', context.win).error);
  assert.equal(context.reloads(), 0);
  const production = browser('us.etrade.com');
  assert.ok(saveDemoBalance('1000', production.win).error);
  assert.equal(production.storage.size, 0);
  assert.equal(production.reloads(), 0);
});

test('saved helper balance selects the sample tier and reset restores author settings', async () => {
  const context = browser();
  const data = normalizeBankRates(JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url))));
  const settings = {
    valid: true, mode: 'api', product: '3100', field: 'advertisedAPY', balance: '0',
  };
  saveDemoBalance('100000', context.win);
  assert.equal(selectBankRate(data, applyDemoBalance(settings, context.win)), '4.15');
  const manual = { ...settings, mode: 'manual', override: '6.50' };
  assert.equal(applyDemoBalance(manual, context.win), manual);
  saveDemoBalance(null, context.win);
  assert.equal(selectBankRate(data, applyDemoBalance(settings, context.win)), '3.75');
});

test('expand and Escape maintain disclosure semantics and return focus to the trigger', () => {
  const { document, window, root } = page();
  const toggle = root.querySelector('.demo-helper-toggle');
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  assert.equal(panel.hidden, true);
  toggle.dispatchEvent(new window.Event('click'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);
  assert.equal(document.activeElement.id, 'demo-helper-balance');
  const escape = new window.Event('keydown', { bubbles: true, cancelable: true });
  escape.key = 'Escape';
  document.activeElement.dispatchEvent(escape);
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, toggle);
});

test('insights distinguish sample responses, authored overrides, failures and market state', async () => {
  const { document, window, root } = page('<div class="cards-product block"><li><h3>Savings</h3><span data-rate-name="rate" data-rate-source="api" data-rate-balance="100000" data-rate-balance-source="demo">4.15</span></li><li><h3>Manual</h3><span data-rate-name="rate" data-rate-source="override">6.50</span></li><li><h3>Failed rate</h3><span data-rate-name="rate" data-rate-source="fallback" data-rate-error="http-status">1.11</span></li></div><div class="market-ticker block" data-market-state="loading"></div>', '<meta name="bank-rates-endpoint" content="/phx/pros/apicontent/init/bankRates.json">');
  assert.ok(root.textContent.includes('Sample response'));
  assert.ok(root.textContent.includes('$100,000 · demo balance'));
  assert.ok(root.textContent.includes('Author override'));
  assert.ok(root.textContent.includes('Fallback · Reason: http-status'));
  assert.ok(root.textContent.includes('Loading data'));
  document.querySelector('.market-ticker').dataset.marketState = 'unavailable';
  document.dispatchEvent(new window.CustomEvent('bank-rates:updated'));
  await new Promise((resolve) => { setTimeout(resolve, 130); });
  assert.ok(root.textContent.includes('Data unavailable'));
});

test('locate scrolls to real content and collapses the helper without changing content', () => {
  const { document, window, root } = page('<div class="hero-dark split balanced block"><h1>Authored title</h1></div>');
  const target = document.querySelector('.block');
  let scrolled = false;
  target.scrollIntoView = () => { scrolled = true; };
  target.getBoundingClientRect = () => ({
    top: 100, left: 20, width: 700, height: 300,
  });
  root.querySelector('.demo-helper-toggle').dispatchEvent(new window.Event('click'));
  root.querySelector('.demo-helper-locate').dispatchEvent(new window.Event('click'));
  assert.equal(scrolled, true);
  assert.equal(root.querySelector('.demo-helper-panel').hidden, true);
  assert.equal(root.querySelector('.demo-helper-highlight').hidden, false);
  assert.equal(target.textContent, 'Authored title');
  assert.equal(mountDemoHelper(document, browser().win), null);
  assert.equal(mountDemoHelper(document, browser('main--etrade--adobedrago.aem.page').win), null);
});

test('invalid connections are reported without issuing requests', () => {
  const { document } = parseHTML('<html><head><meta name="bank-rates-endpoint" content="https://unapproved.example/rates"></head></html>');
  assert.equal(rateConnection(document, browser().win).label, 'Invalid rate connection');
});
