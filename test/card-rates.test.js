/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { parseHTML } from 'linkedom';

const bankRow = await readFile(new URL('./fixtures/our-accounts-bank.html', import.meta.url), 'utf8');
const sample = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url)));
const endpoint = '/phx/pros/apicontent/init/bankRates.json';
const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;
const settings = (...lines) => ['Rate settings', ...lines].map((line) => `<p>${line}</p>`).join('');

async function render(rows, respond = () => ({ ok: true, json: async () => sample })) {
  const { document, window } = parseHTML(`<html><head>
    <meta name="bank-rates-source" content="direct">
    <meta name="bank-rates-endpoint" content="${endpoint}">
    </head><body><div class="tabs-accounts">${rows}</div></body></html>`);
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return this.getAttribute('data-test-value') || '0'; },
    set(value) { this.setAttribute('data-test-value', value); },
  });
  window.location = { href: 'http://localhost:3000/what-we-offer/our-accounts', hostname: 'localhost' };
  const requests = [];
  const context = vm.createContext({
    document,
    window,
    location: window.location,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    NodeFilter: { SHOW_TEXT: 4 },
    CustomEvent: window.CustomEvent,
    fetch: async (url, init) => {
      requests.push({ url, init });
      return respond();
    },
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
    modules.set(url.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  const module = await moduleFor(new URL('../blocks/tabs-accounts/tabs-accounts.js', import.meta.url));
  await module.evaluate();
  const block = document.querySelector('.tabs-accounts');
  await module.namespace.default(block);
  return { block, requests };
}

test('Our Accounts preview markup fetches all named rates once and preserves cards and legal markers', async () => {
  const { block, requests } = await render(bankRow);
  const markers = [...block.querySelectorAll('[data-rate-name]')];
  assert.deepEqual(markers.map((marker) => marker.textContent), ['3.75', '3.75', '2.00', '4.40']);
  assert.ok(markers.every((marker) => marker.dataset.rateSource === 'api' && marker.dataset.rateFetchedAt));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `http://localhost:3000${endpoint}`);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.credentials, 'omit');
  assert.equal(block.querySelectorAll('.tabs-accounts-card').length, 4);
  assert.equal(block.querySelectorAll('.tabs-accounts-actions a').length, 8);
  assert.equal(block.querySelector('h4 sup').textContent, 'b');
  assert.equal(block.textContent.includes('Rate settings'), false);
  assert.equal(block.textContent.includes('{{'), false);
});

test('the preview uses changed API values instead of baking sample values into the cards', async () => {
  const changed = structuredClone(sample);
  const products = changed.campaign.offer.productList;
  products.find((p) => p.productType === '3100').rates[0].advertisedAPY = '1.23';
  products.find((p) => p.productType === '4240').rates[1].advertisedAPY = '2.34';
  products.find((p) => p.productType === '3500').rates.find((rate) => rate.durationCode === '12M').disclosureAPY = '3.45';
  const { block } = await render(bankRow, () => ({ ok: true, json: async () => changed }));
  assert.deepEqual([...block.querySelectorAll('[data-rate-name]')].map((m) => m.textContent), ['1.23', '1.23', '2.34', '3.45']);
});

test('canonical and configured shorthand share a binding while other placeholders stay authored', async () => {
  const rows = row('Bank', '<p><strong>{{PSA-RATE}}</strong>% and {{rate:psa-rate}}%. {{campaign}} <code>{{psa-rate}}</code></p>', settings('Name: psa-rate', 'Mode: manual', 'Override: 0'))
    + row('Other', '<p>{{psa-rate}} and {{rate:missing}}</p>');
  const { block, requests } = await render(rows);
  const panels = [...block.querySelectorAll('[role="tabpanel"]')];
  assert.deepEqual([...panels[0].querySelectorAll('[data-rate-name]')].map((m) => m.textContent), ['0.00', '0.00']);
  assert.equal(panels[0].querySelector('strong').textContent, '0.00');
  assert.match(panels[0].textContent, /\{\{campaign\}\}/);
  assert.equal(panels[0].querySelector('code').textContent, '{{psa-rate}}');
  assert.match(panels[1].textContent, /\{\{psa-rate\}\}/);
  assert.equal(panels[1].querySelector('[data-rate-name="missing"]').dataset.rateError, 'invalid-settings');
  assert.equal(requests.length, 0);
});

test('configured shorthand honors hybrid overrides and rejects duplicate settings without fetching', async () => {
  const override = settings('Name: apy', 'Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 0');
  const { block, requests } = await render(row('Override', '<p>{{apy}}%</p>', override)
    + row('Duplicate', '<p>{{apy}}%</p>', override, override));
  const markers = [...block.querySelectorAll('[data-rate-name]')];
  assert.equal(markers[0].textContent, '0.00');
  assert.equal(markers[0].dataset.rateSource, 'override');
  assert.equal(markers[1].dataset.rateError, 'invalid-settings');
  assert.equal(requests.length, 0);
});

test('an unavailable API removes raw placeholders and shares the request failure across rates', async () => {
  const { block, requests } = await render(bankRow, () => ({ ok: false, status: 503 }));
  const markers = [...block.querySelectorAll('[data-rate-name]')];
  assert.equal(markers.length, 4);
  assert.ok(markers.every((marker) => marker.textContent === '-.--'
    && marker.dataset.rateSource === 'fallback' && marker.dataset.rateError === 'http-status'
    && marker.getAttribute('aria-label') === 'Rate currently unavailable'));
  assert.equal(requests.length, 1);
  assert.equal(block.textContent.includes('{{'), false);
});

test('corrected authoring binds the variable checking APY and keeps fixed promotions independent', async () => {
  const pages = JSON.parse(await readFile(new URL('../docs/current-pages.json', import.meta.url)));
  const page = pages.find((entry) => entry.id === 'our-accounts');
  const tabs = page.sections.flatMap((section) => section.blocks).find((block) => block.name === 'Tabs Accounts');
  const { block, requests } = await render(tabs.rows.map((cells) => row(...cells)).join(''));
  const markers = [...block.querySelectorAll('[data-rate-name]')];
  assert.equal(markers.length, 1);
  assert.equal(markers[0].dataset.rateName, 'checking-rate');
  assert.equal(markers[0].textContent, '2.00');
  assert.equal(markers[0].closest('p').querySelector('sup').textContent, 'checkingrate');
  const bank = [...block.querySelectorAll('[role="tabpanel"]')][5];
  assert.match(bank.querySelectorAll('li')[0].textContent, /guaranteed 4\.25% Annual Percentage Yield for 6 months/);
  const coverage = [...bank.querySelectorAll('li')[0].querySelectorAll('p')].find((p) => p.textContent.includes('FDIC-insured'));
  assert.equal(coverage.querySelectorAll('sup')[1].textContent, 'depositcoverage');
  assert.equal(bank.querySelector(':scope > h3 sup').textContent, 'savingsboost');
  assert.match(bank.querySelectorAll('li')[1].textContent, /Lock in 4\.75% Annual Percentage Yield/);
  assert.equal(requests.length, 1);
  assert.equal(page.metadata.some(([name]) => name.toLowerCase() === 'bank rates endpoint'), false);
  const { document } = parseHTML(await readFile(new URL('../docs/our-accounts-current-authoring.html', import.meta.url), 'utf8'));
  const tables = [...document.querySelectorAll('table')];
  const metadata = tables.find((table) => table.querySelector('th').textContent === 'Metadata');
  assert.equal(metadata.textContent.includes('bankRates.json'), false);
  assert.equal(tables.find((table) => table.querySelector('th').textContent === 'Tabs Accounts').textContent.match(/\{\{rate:checking-rate\}\}/g).length, 1);
});
