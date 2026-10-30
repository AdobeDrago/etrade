/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const families = ['cards', 'cards-account', 'cards-article', 'cards-award', 'cards-icon', 'cards-numbered', 'cards-platform', 'cards-pricing', 'cards-product'];
const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;
const copy = '<h3 id="authored-title">Authored title</h3><p>Read <a href="/terms?track=1#details">inline terms</a>.<sup>legal-id</sup></p><ul><li>Authored nested item</li></ul><p><a href="/learn?track=2">Learn more</a></p>';
const image = '<picture><source srcset="/wide.webp" media="(min-width: 900px)"><img src="/image.jpg" alt="Authored image"></picture>';
const settings = (mode) => `<p>Rate settings</p><p>Mode: ${mode}</p><p>Product: 3100</p><p>Field: advertisedAPY</p><p>Balance: 0</p><p>Override: 0</p><p>Fallback: -.--</p>`;

async function render(name, rows, respond = () => ({ ok: false, status: 503 })) {
  const { document, window } = parseHTML(`<html><head><meta name="bank-rates-endpoint" content="/phx/pros/apicontent/init/bankRates.json"></head><body><main><div class="section"><div class="${name}">${rows}</div></div></main></body></html>`);
  window.location = new URL('http://localhost:3000/home');
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  Object.defineProperty(window.HTMLAnchorElement.prototype, 'relList', {
    configurable: true,
    get() { return (this.getAttribute('rel') || '').split(/\s+/).filter(Boolean); },
  });
  const requests = [];
  const context = vm.createContext({
    document,
    window,
    URL,
    URLSearchParams,
    crypto: webcrypto,
    CustomEvent: window.CustomEvent,
    location: window.location,
    NodeFilter: { SHOW_TEXT: 4 },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, init) => { requests.push({ url, init }); return respond(); },
  });
  const modules = new Map();
  async function moduleFor(path) {
    if (modules.has(path.href)) return modules.get(path.href);
    const module = new vm.SourceTextModule(await readFile(path, 'utf8'), {
      context,
      identifier: path.href,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}/scripts/aem.js`; },
    });
    modules.set(path.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  const module = await moduleFor(new URL(`../blocks/${name}/${name}.js`, import.meta.url));
  await module.evaluate();
  const block = document.querySelector(`.${name}`);
  await module.namespace.default(block);
  return { block, requests };
}

test('all card families skip blank rows and preserve rich copy, extra cells, nested lists and legal references', async () => {
  await Promise.all(families.map(async (name) => {
    const media = ['cards', 'cards-article', 'cards-award', 'cards-platform'].includes(name);
    let cells = [copy];
    if (media) cells = [image, copy];
    if (name === 'cards-icon') cells = ['book', copy];
    const { block } = await render(name, row('') + row(...cells, '<p>Extra authored copy.</p>'));
    assert.equal(block.querySelectorAll(':scope > ul > li, :scope > ol > li').length, 1, name);
    assert.equal(block.querySelector('#authored-title').textContent, 'Authored title', name);
    assert.equal(block.querySelector('a[href="/terms?track=1#details"]').textContent, 'inline terms', name);
    assert.equal(block.querySelector('sup').textContent, 'legal-id', name);
    assert.match(block.textContent, /Authored nested item/, name);
    assert.match(block.textContent, /Extra authored copy/, name);
    assert.ok(block.querySelector('a[href="/learn?track=2"]'), name);
    if (media) assert.equal(block.querySelector('img').alt, 'Authored image', name);
    if (['cards-article', 'cards-award', 'cards-platform'].includes(name)) assert.equal(block.querySelector('source').getAttribute('srcset'), '/wide.webp', name);
    const empty = await render(name, row(''));
    assert.equal(empty.block.hidden, true, name);
  }));
});

test('account actions use shared native controls without moving inline or legal links', async () => {
  const { block } = await render('cards-account', row('<h3>Account</h3><p>Read <a href="/terms">terms</a>.<sup>a</sup></p><p><strong><a href="/open?track=1" target="_blank">Open account</a></strong></p><p><a href="/learn?track=2">Learn more</a></p>'));
  const actions = block.querySelector(':scope > ul > li > .cards-account-actions.etrade-actions');
  assert.equal(actions.querySelectorAll('a').length, 2);
  assert.equal(actions.querySelector('.etrade-action-outline').getAttribute('href'), '/open?track=1');
  assert.equal(actions.querySelector('.etrade-action-secondary').getAttribute('href'), '/learn?track=2');
  assert.match(actions.querySelector('a').getAttribute('rel'), /noopener/);
  assert.match(actions.querySelector('a').getAttribute('rel'), /noreferrer/);
  assert.equal(block.querySelector('.cards-account-body a').getAttribute('href'), '/terms');
  assert.equal(block.querySelector('sup').textContent, 'a');
});

test('account, product and pricing card moves preserve manual zero rates and failure placeholders', async () => {
  await Promise.all(['cards-account', 'cards-product', 'cards-pricing'].map(async (name) => {
    const manual = await render(name, row('<h3>Bank product</h3><h4>{{rate}}% APY<sup>rate-id</sup></h4><p><a href="/open">Open account</a></p>', settings('manual')));
    assert.equal(manual.block.querySelector('[data-rate-name]').textContent, '0.00', name);
    assert.equal(manual.block.querySelector('[data-rate-name]').dataset.rateSource, 'manual', name);
    assert.equal(manual.block.querySelector('sup').textContent, 'rate-id', name);
    assert.equal(manual.requests.length, 0, name);
    const failed = await render(name, row('<h3>Bank product</h3><h4>{{rate}}% APY<sup>rate-id</sup></h4><p><a href="/open">Open account</a></p>', settings('api')));
    const marker = failed.block.querySelector('[data-rate-name]');
    assert.equal(marker.textContent, '-.--', name);
    assert.equal(marker.getAttribute('aria-label'), 'Rate currently unavailable', name);
    assert.equal(failed.block.querySelector('sup').textContent, 'rate-id', name);
    assert.equal(failed.requests.length, 1, name);
    assert.equal(failed.block.textContent.includes('Rate settings'), false, name);
    assert.equal(failed.block.textContent.includes('{{'), false, name);
    assert.ok(failed.block.querySelector('a[href="/open"]'), name);
  }));
});
