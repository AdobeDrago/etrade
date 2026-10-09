/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const fixture = JSON.parse(await readFile(new URL('./fixtures/market-data.json', import.meta.url), 'utf8'));
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

async function harness(name, markup = '', route = null) {
  const { document, window } = parseHTML(`<html><head></head><body><main><div class="${name}">${markup}</div></main></body></html>`);
  window.location = new URL('https://et-dynamic--etrade--adobedrago.aem.page/home/welcome-back');
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  // linkedom exposes select.value as a getter; browsers also expose its setter.
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return this.querySelector('option[selected]')?.value || this.querySelector('option')?.value; },
    set(value) {
      this.querySelectorAll('option').forEach((option) => {
        if (option.value === value) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      });
    },
  });
  const requests = [];
  const context = vm.createContext({
    window,
    document,
    location: window.location,
    URL,
    Intl,
    AbortController,
    setTimeout,
    clearTimeout,
    crypto: webcrypto,
    CustomEvent: window.CustomEvent,
    sessionStorage: { getItem: () => null, setItem: () => {} },
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (route) return route(url, init);
      let data;
      const path = new URL(url).pathname.split('/').pop();
      if (path === 'quote') data = fixture.quote;
      if (path === 'chart') data = fixture.charts[JSON.parse(init.body).indexes];
      if (fixture.topFive[path]) data = fixture.topFive[path];
      return new Response(JSON.stringify(data || {}));
    },
  });
  const modules = new Map();
  const repo = new URL('../', import.meta.url);
  const moduleFor = async (path) => {
    if (modules.has(path)) return modules.get(path);
    const module = new vm.SourceTextModule(await readFile(new URL(path.slice(1), repo), 'utf8'), {
      context,
      identifier: `${window.origin}${path}`,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}${path}`; },
    });
    modules.set(path, module);
    await module.link((specifier) => moduleFor(new URL(specifier, module.identifier).pathname));
    return module;
  };
  const module = await moduleFor(`/blocks/${name}/${name}.js`);
  await module.evaluate();
  const block = document.querySelector(`.${name}`);
  await module.namespace.default(block);
  await flush();
  return {
    document, window, block, requests,
  };
}

test('welcome hero preserves rich copy, inline recovery links and extra value cells', async () => {
  const { block } = await harness('welcome-hero', '<div><div>Login</div><div><h1>Welcome</h1><p><a href="https://us.etrade.com/etx/pxy/login">Log on</a></p><p>Forgot <a href="/recover">User ID</a>?</p></div><div><p>Extra copy</p></div></div><div><div>Campaign</div><div><h2>Campaign</h2><p>Keep <strong>rich text</strong></p></div></div><div><div>Image</div></div>');
  assert.equal(block.querySelector('.welcome-hero-primary').textContent, 'Log on');
  assert.equal(block.querySelector('.welcome-hero-primary').closest('p').className, 'etrade-actions');
  assert.equal(block.querySelector('a[href="/recover"]').className, '');
  assert.ok(block.textContent.includes('Extra copy'));
  assert.equal(block.querySelector('strong').textContent, 'rich text');
  assert.equal(block.querySelector('[data-login-slot]').querySelectorAll('input').length, 0);
});

test('empty authored tables and missing cells remain usable', async () => {
  const hero = await harness('welcome-hero', '<div><div>Image</div></div>');
  assert.equal(hero.block.children.length, 0);
  const ticker = await harness('market-ticker', '<div></div>');
  assert.equal(ticker.block.querySelectorAll('li').length, 4);
  const top = await harness('market-top-five', '<div><div>Default</div></div>');
  assert.equal(top.block.querySelectorAll('.market-top-five-card').length, 5);
  assert.equal(top.block.dataset.disclaimerState, 'missing');
  assert.equal(top.block.querySelector('details').hidden, true);
});

test('a failed ticker clears values and Refresh can recover', async () => {
  let failure = true;
  const { block, window } = await harness('market-ticker', '', () => (failure
    ? new Response('{}', { status: 503 }) : new Response(JSON.stringify(fixture.quote))));
  assert.equal(block.dataset.marketState, 'unavailable');
  assert.equal(block.querySelectorAll('li').length, 0);
  failure = false;
  block.querySelector('button').dispatchEvent(new window.Event('click'));
  await flush();
  assert.equal(block.dataset.marketState, 'loaded');
  assert.equal(block.querySelectorAll('li').length, 4);
});

test('late Top Five responses cannot override a newer category or its disclosure', async () => {
  let resolveFunds;
  let resolveETFs;
  const route = (url) => {
    if (url.endsWith('/MostSearchedMFs')) return new Promise((resolve) => { resolveFunds = resolve; });
    if (url.endsWith('/TopETFs')) return new Promise((resolve) => { resolveETFs = resolve; });
    return new Response(JSON.stringify(fixture.topFive.TopDivYieldStocks));
  };
  const legal = '<div><div>MostSearchedMFs disclaimer</div><div><p>Fund legal</p></div></div><div><div>TopETFs disclaimer</div><div><p>ETF legal</p></div></div>';
  const { block, window } = await harness('market-top-five', legal, route);
  const select = block.querySelector('select');
  select.value = 'MostSearchedMFs';
  select.dispatchEvent(new window.Event('change'));
  await flush();
  select.value = 'TopETFs';
  select.dispatchEvent(new window.Event('change'));
  await flush();
  resolveETFs(new Response(JSON.stringify(fixture.topFive.TopETFs)));
  await flush();
  resolveFunds(new Response(JSON.stringify(fixture.topFive.MostSearchedMFs)));
  await flush();
  assert.equal(block.querySelector('.market-top-five-symbol').textContent, 'VOO');
  assert.equal(block.querySelector('details').textContent, 'DisclaimerETF legal');
  assert.equal(block.getAttribute('aria-busy'), 'false');
});

test('late chart responses cannot override a newer index selection', async () => {
  let resolveNasdaq;
  const route = (url, init) => {
    const index = JSON.parse(init.body).indexes;
    if (index === 'COMPIDX') return new Promise((resolve) => { resolveNasdaq = resolve; });
    return new Response(JSON.stringify(fixture.charts[index]));
  };
  const { block, window } = await harness('market-overview', '', route);
  const tabs = block.querySelectorAll('[role="tab"]');
  tabs[1].dispatchEvent(new window.Event('click'));
  await flush();
  tabs[2].dispatchEvent(new window.Event('click'));
  await flush();
  resolveNasdaq(new Response(JSON.stringify(fixture.charts.COMPIDX)));
  await flush();
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  assert.ok(block.querySelector('svg').getAttribute('aria-label').startsWith('S&P:'));
  assert.equal(block.querySelector('tbody').children.length, 12);
});
