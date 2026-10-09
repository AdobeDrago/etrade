/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import {
  disclosureFragmentPath, disclosureSetEntries, disclosureSetRequest,
} from '../scripts/disclosure-sets.js';

const preview = 'https://et-dynamic--etrade--adobedrago.aem.page/home';
const endpoint = 'https://da-sc.adobeaem.workers.dev/preview/adobedrago/etrade/disclosures/sets/homepage';
const fragments = '/disclosures/fragments';

/** Run the real block, fragment loader and AEM helpers without loading the whole page. */
async function harness(routes = new Map(), body = '<p>References <sup>7,2</sup> <sup>8</sup></p>') {
  const { document, window } = parseHTML(`<!doctype html><html><head>
    <meta name="disclosures" content="/disclosures/sets/homepage">
    </head><body><main>${body}</main><footer></footer></body></html>`);
  window.location = new URL(preview);
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  const requests = [];
  const errors = [];
  const state = { decorated: 0 };
  const context = vm.createContext({
    window,
    document,
    URL,
    URLSearchParams,
    crypto: webcrypto,
    console: { error: (...args) => errors.push(args) },
    state,
    fetch: async (url) => {
      requests.push(url);
      const route = routes.get(url);
      if (route instanceof Error) throw route;
      if (!route) return new Response('', { status: 404 });
      const bodyText = typeof route === 'string' ? route : JSON.stringify(route);
      return new Response(bodyText);
    },
  });
  const modules = new Map();
  const repo = new URL('../', import.meta.url);
  const moduleFor = async (path) => {
    if (modules.has(path)) return modules.get(path);
    const source = path === '/scripts/scripts.js'
      ? 'export function decorateMain() { state.decorated += 1; }'
      : await readFile(new URL(path.slice(1), repo), 'utf8');
    const module = new vm.SourceTextModule(source, {
      context,
      identifier: `${window.origin}${path}`,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}${path}`; },
    });
    modules.set(path, module);
    await module.link((specifier) => moduleFor(new URL(specifier, module.identifier).pathname));
    return module;
  };
  const blockModule = await moduleFor('/blocks/disclosures/disclosures.js');
  await blockModule.evaluate();
  const aem = modules.get('/scripts/aem.js').namespace;
  const link = document.createElement('a');
  link.href = new URL(aem.getMetadata('disclosures'), preview).href;
  const block = aem.buildBlock('disclosures', { elems: [link] });
  const region = document.createElement('aside');
  region.append(block);
  document.querySelector('footer').after(region);
  return {
    document,
    block,
    requests,
    errors,
    state,
    decorate: blockModule.namespace.default,
    loadFragment: modules.get('/blocks/fragment/fragment.js').namespace.loadFragment,
  };
}

test('metadata paths select preview/live delivery, and explicit JSON paths load locally', () => {
  assert.equal(disclosureSetRequest('/disclosures/sets/homepage', preview), endpoint);
  assert.equal(disclosureSetRequest('/disclosures/sets/homepage.html', preview), endpoint);
  assert.equal(disclosureSetRequest('/disclosures/sets/homepage', 'http://localhost:3000/home'), endpoint);
  assert.equal(
    disclosureSetRequest('/disclosures/sets/homepage', 'https://us.etrade.com/home'),
    endpoint.replace('/preview/', '/live/'),
  );
  assert.equal(disclosureSetRequest(
    '/disclosures/sets/homepage',
    'https://main--etrade--adobedrago.aem.live/home',
  ), endpoint.replace('/preview/', '/live/'));
  assert.equal(
    disclosureSetRequest('/disclosures/sets/homepage.json', preview),
    'https://et-dynamic--etrade--adobedrago.aem.page/disclosures/sets/homepage.json',
  );
  assert.equal(disclosureSetRequest(endpoint, preview), endpoint);
  assert.equal(disclosureSetRequest('/homepage-disclosures', preview), null);
  assert.equal(disclosureSetRequest('https://example.com/set.json', preview), null);
});

test('incomplete entries and duplicate numbers never shift existing footnote numbers', () => {
  const payload = {
    introduction: [null, {}, { kind: 'notice', fragment: `${fragments}/notice.html` }],
    disclosures: [
      null, {}, { number: 2, fragment: 'https://example.com/legal' },
      { number: 7, fragment: `${fragments}/legal` },
      { number: 7, fragment: `${fragments}/duplicate` },
      { number: '2', fragment: `${fragments}/shared` },
      { number: 0, fragment: `${fragments}/zero` },
    ],
  };
  assert.deepEqual(disclosureSetEntries({ data: payload }), [
    { label: 'Notice', path: `${fragments}/notice` },
    { label: '7', path: `${fragments}/legal` },
    { label: '2', path: `${fragments}/shared` },
  ]);
  assert.throws(() => disclosureSetEntries({}), /Invalid disclosure set/);
  ['//example.com/legal', '/', 'relative', '/legal?other', '/legal#anchor', '/legal\\other']
    .forEach((path) => assert.equal(disclosureFragmentPath(path), null));
});

test('Metadata set renders rich text, media, accessible logos and authored footnote order', async () => {
  const data = {
    id: 'homepage',
    introduction: [
      { kind: 'introduction', fragment: `${fragments}/intro` },
      { kind: 'notice', fragment: `${fragments}/notice` },
      { kind: 'logo', fragment: `${fragments}/logo` },
    ],
    disclosures: [
      { number: 7, fragment: `${fragments}/legal` },
      { number: 2, fragment: `${fragments}/shared` },
      { number: 9, fragment: `${fragments}/shared` },
    ],
    closing: [{ fragment: `${fragments}/closing` }],
  };
  const routes = new Map([
    [endpoint, { metadata: { schemaName: 'disclosure-set' }, data }],
    [`${fragments}/intro.plain.html`, '<div><h2>Important disclosures</h2></div>'],
    [`${fragments}/notice.plain.html`, '<div><p><strong>May lose value</strong></p></div>'],
    [`${fragments}/logo.plain.html`, '<div><p><span class="icon icon-sipc-mark"></span>Member SIPC</p></div>'],
    [`${fragments}/legal.plain.html`, `<div><h3 id="conditions">Conditions</h3>
      <p><strong><a href="https://example.com/terms">Bold linked terms</a></strong>
      <em>Emphasized</em> <a href="#conditions">Conditions anchor</a></p>
      <picture><source srcset="./media_terms.webp"><img src="./media_terms.png" alt="Terms image"></picture>
      <ul><li>First condition</li></ul></div>`],
    [`${fragments}/shared.plain.html`, '<div><p>Shared disclosure</p></div>'],
    [`${fragments}/closing.plain.html`, '<div><p>Corporate closing</p></div>'],
  ]);
  const app = await harness(routes);
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.deepEqual(
    [...app.block.querySelectorAll('.disclosures-items > li')].map((li) => li.id),
    ['disclosure-7', 'disclosure-2', 'disclosure-9'],
  );
  assert.equal(app.block.querySelector('#disclosure-7').value, 7);
  assert.equal(app.block.querySelector('#disclosure-7 strong a').textContent, 'Bold linked terms');
  assert.equal(app.block.querySelector('#disclosure-7 em').textContent, 'Emphasized');
  assert.ok(app.block.querySelector('#conditions'));
  assert.equal(app.block.querySelector('a[href="#conditions"]').textContent, 'Conditions anchor');
  assert.equal(
    app.block.querySelector('picture img').getAttribute('src'),
    'https://et-dynamic--etrade--adobedrago.aem.page/disclosures/fragments/media_terms.png',
  );
  assert.equal(app.block.querySelector('picture img').getAttribute('alt'), 'Terms image');
  assert.ok(app.block.querySelector('#disclosure-7 ul li'));
  assert.equal(app.block.querySelector('.disclosures-notice strong').textContent, 'May lose value');
  assert.equal(app.block.querySelector('.disclosures-logo .icon').getAttribute('aria-label'), 'Member SIPC');
  assert.ok(app.block.querySelector('.disclosures-logo img[src="/icons/sipc-mark.svg"]'));
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Corporate closing');
  assert.deepEqual(
    [...app.document.querySelectorAll('main sup a')].map((a) => a.getAttribute('href')),
    ['#disclosure-7', '#disclosure-2'],
  );
  assert.equal(app.document.querySelector('main sup:last-child').textContent, '8');
  assert.equal(app.requests.filter((url) => url === `${fragments}/shared.plain.html`).length, 1);
  assert.equal(app.state.decorated, 0);
});

test('an explicit site JSON file uses the same renderer for an unwrapped set', async () => {
  const url = 'https://et-dynamic--etrade--adobedrago.aem.page/disclosures/sets/homepage.json';
  const app = await harness(new Map([
    [url, { id: 'homepage', disclosures: [{ number: 7, fragment: `${fragments}/legal` }] }],
    [`${fragments}/legal.plain.html`, '<div><p>Legal copy</p></div>'],
  ]));
  app.block.querySelector('a').href = url;
  await app.decorate(app.block);
  assert.ok(app.block.querySelector('#disclosure-7'));
  assert.equal(app.requests[0], url);
});

test('failed sets and failed fragments do not create a partial footer or dangling links', async () => {
  const cases = [
    new Map(),
    new Map([[endpoint, 'invalid json']]),
    new Map([[endpoint, { disclosures: [{ number: 7, fragment: `${fragments}/missing` }] }]]),
    new Map([[endpoint, new Error('Network unavailable')]]),
  ];
  await Promise.all(cases.map(async (routes) => {
    const app = await harness(routes);
    await app.decorate(app.block);
    assert.equal(app.block.hidden, true);
    assert.equal(app.block.children.length, 0);
    assert.equal(app.document.querySelectorAll('main sup a').length, 0);
    assert.equal(app.errors.length, 1);
  }));
});

test('inline Disclosures tables keep their existing labels, numbers and footnote behavior', async () => {
  const app = await harness();
  app.block.innerHTML = `<div><div>Notice</div><div><p><strong>Investment risk</strong></p></div></div>
    <div><div>7</div><div><p>Legacy <a href="https://example.com/terms">terms</a></p></div></div>
    <div><div>Closing</div><div><p>Legacy closing</p></div></div>`;
  await app.decorate(app.block);
  assert.ok(app.block.querySelector('.disclosures-notice strong'));
  assert.equal(app.block.querySelector('#disclosure-7').textContent, 'Legacy terms');
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Legacy closing');
  assert.equal(app.requests.length, 0);
});

test('legacy document references still load and fragment decoration remains the default', async () => {
  const app = await harness(new Map([
    ['/homepage-disclosures.plain.html', '<div><div class="disclosures"><ol class="disclosures-items"><li id="disclosure-7">Legacy document</li></ol></div></div>'],
  ]));
  app.block.querySelector('a').href = new URL('/homepage-disclosures', preview).href;
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.equal(app.block.querySelector('#disclosure-7').textContent, 'Legacy document');
  assert.equal(app.state.decorated, 1);
});
