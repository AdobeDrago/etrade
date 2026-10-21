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
async function harness(routes = new Map(), body = '<p>References <sup>offer,apy</sup> <sup>missing</sup></p>') {
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
    decorateReferences: modules.get('/scripts/disclosure-references.js').namespace.default,
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

test('previously previewed sets retain their explicit numbers during migration', () => {
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

test('letter superscripts resolve to explicit legacy numbers on the demo homepage', async () => {
  const numbers = [12, 2, 1, 13, 11, 7];
  const routes = new Map([
    [endpoint, { disclosures: numbers.map((number) => ({ number, fragment: `${fragments}/terms${number}` })) }],
    ...numbers.map((number) => [`${fragments}/terms${number}.plain.html`, `<div><p>Terms ${number}</p></div>`]),
  ]);
  const app = await harness(routes, `<h2>Offer <sup>a</sup></h2>
    <p>Fees <sup>b</sup>, awards <sup>l,m,k</sup>, CD <sup>g</sup>, again <sup>a</sup>.</p>
    <p><sup>2</sup> <sup>c</sup> <sup>a,c</sup> <sup>aa</sup> <sup>™</sup>
    <sup><a href="https://example.com/source">a</a></sup>
    <a href="#disclosure-a"><sup>a</sup></a></p>`);
  const main = app.document.querySelector('main');
  app.decorateReferences(main);
  assert.equal(main.querySelector('sup').textContent, 'a');
  await app.decorate(app.block);
  assert.deepEqual(
    [...main.querySelectorAll('sup')].map((sup) => sup.textContent),
    ['1', '2', '12,13,11', '7', '1', '2', 'c', 'a,c', 'aa', '™', 'a', '1'],
  );
  assert.deepEqual([...main.querySelectorAll('.disclosures-reference a')]
    .map((link) => [link.getAttribute('href'), link.getAttribute('aria-label')]), [
    ['#disclosure-1', 'Disclosure 1'], ['#disclosure-2', 'Disclosure 2'],
    ['#disclosure-12', 'Disclosure 12'], ['#disclosure-13', 'Disclosure 13'],
    ['#disclosure-11', 'Disclosure 11'], ['#disclosure-7', 'Disclosure 7'],
    ['#disclosure-1', 'Disclosure 1'], ['#disclosure-2', 'Disclosure 2'],
    ['#disclosure-1', 'Disclosure 1'],
  ]);
  assert.equal(main.querySelector('sup').dataset.disclosureIds, 'a');
  assert.equal(main.querySelectorAll('a a').length, 0);
  const link = main.querySelector('sup a');
  app.decorateReferences(main);
  assert.equal(main.querySelector('sup a'), link);
  const late = app.document.createElement('p');
  late.innerHTML = 'Later claim <sup>b</sup>';
  main.append(late);
  app.decorateReferences(late);
  assert.equal(late.querySelector('sup a').getAttribute('href'), '#disclosure-2');
});

test('single-letter IDs use set order without legacy letter aliases', async () => {
  const app = await harness(new Map([
    [endpoint, {
      disclosures: [
        { disclosureId: 'g', fragment: `${fragments}/cd` },
        { disclosureId: 'a', fragment: `${fragments}/offer` },
      ],
    }],
    [`${fragments}/cd.plain.html`, '<div><p>CD terms</p></div>'],
    [`${fragments}/offer.plain.html`, '<div><p>Offer terms</p></div>'],
  ]), '<p><sup>a,g</sup> <sup>b</sup> <sup>1</sup></p>');
  await app.decorate(app.block);
  assert.equal(app.document.querySelector('sup').textContent, '2,1');
  assert.deepEqual(
    [...app.document.querySelectorAll('sup a')].map((link) => link.getAttribute('href')),
    ['#disclosure-a', '#disclosure-g'],
  );
  assert.equal(app.document.querySelector('sup:nth-child(2)').textContent, 'b');
  assert.equal(app.document.querySelector('sup:last-child').textContent, '1');
});

test('IDs follow the schema and unique valid items are numbered in array order', () => {
  const disclosures = [
    null, {}, { disclosureId: 'offer', fragment: 'https://example.com/legal' },
    { disclosureId: 'apy', fragment: `${fragments}/rate` },
    { disclosureId: 'apy', fragment: `${fragments}/duplicate` },
    { disclosureId: 'offer', fragment: `${fragments}/offer` },
    { disclosureId: 'disc1', fragment: `${fragments}/terms` },
    ...['A', 'a-b', '1a', 'a_b', 'a b', '', 1].map((disclosureId) => (
      { disclosureId, fragment: `${fragments}/invalid` }
    )),
    { number: 9, fragment: `${fragments}/old` },
  ];
  assert.deepEqual(disclosureSetEntries({ disclosures }), [
    { label: '1', disclosureId: 'apy', path: `${fragments}/rate` },
    { label: '2', disclosureId: 'offer', path: `${fragments}/offer` },
    { label: '3', disclosureId: 'disc1', path: `${fragments}/terms` },
  ]);
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
      { disclosureId: 'offer', fragment: `${fragments}/legal` },
      { disclosureId: 'apy', fragment: `${fragments}/shared` },
      { disclosureId: 'disc1', fragment: `${fragments}/shared` },
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
    ['disclosure-offer', 'disclosure-apy', 'disclosure-disc1'],
  );
  assert.equal(app.block.querySelector('#disclosure-offer').getAttribute('value'), '1');
  assert.equal(app.block.querySelector('#disclosure-offer').dataset.disclosureId, 'offer');
  assert.equal(app.block.querySelector('#disclosure-offer strong a').textContent, 'Bold linked terms');
  assert.equal(app.block.querySelector('#disclosure-offer em').textContent, 'Emphasized');
  assert.ok(app.block.querySelector('#conditions'));
  assert.equal(app.block.querySelector('a[href="#conditions"]').textContent, 'Conditions anchor');
  assert.equal(
    app.block.querySelector('picture img').getAttribute('src'),
    'https://et-dynamic--etrade--adobedrago.aem.page/disclosures/fragments/media_terms.png',
  );
  assert.equal(app.block.querySelector('picture img').getAttribute('alt'), 'Terms image');
  assert.ok(app.block.querySelector('#disclosure-offer ul li'));
  assert.equal(app.block.querySelector('.disclosures-notice strong').textContent, 'May lose value');
  assert.equal(app.block.querySelector('.disclosures-logo .icon').getAttribute('aria-label'), 'Member SIPC');
  assert.ok(app.block.querySelector('.disclosures-logo img[src="/icons/sipc-mark.svg"]'));
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Corporate closing');
  assert.deepEqual(
    [...app.document.querySelectorAll('main sup a')].map((a) => a.getAttribute('href')),
    ['#disclosure-offer', '#disclosure-apy'],
  );
  assert.equal(app.document.querySelector('main sup').textContent, '1,2');
  assert.equal(app.document.querySelector('main sup:last-child').textContent, 'missing');
  assert.equal(app.requests.filter((url) => url === `${fragments}/shared.plain.html`).length, 1);
  assert.equal(app.state.decorated, 0);
});

test('an explicit site JSON file uses the same renderer for an unwrapped set', async () => {
  const url = 'https://et-dynamic--etrade--adobedrago.aem.page/disclosures/sets/homepage.json';
  const app = await harness(new Map([
    [url, { id: 'homepage', disclosures: [{ disclosureId: 'offer', fragment: `${fragments}/legal` }] }],
    [`${fragments}/legal.plain.html`, '<div><p>Legal copy</p></div>'],
  ]));
  app.block.querySelector('a').href = url;
  await app.decorate(app.block);
  assert.ok(app.block.querySelector('#disclosure-offer'));
  assert.equal(app.requests[0], url);
});

test('failed sets and failed fragments do not create a partial footer or dangling links', async () => {
  const cases = [
    new Map(),
    new Map([[endpoint, 'invalid json']]),
    new Map([[endpoint, { disclosures: [{ disclosureId: 'offer', fragment: `${fragments}/missing` }] }]]),
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
  const app = await harness(new Map(), '<p><sup>7</sup> <sup>8</sup></p>');
  app.block.innerHTML = `<div><div>Notice</div><div><p><strong>Investment risk</strong></p></div></div>
    <div><div>7</div><div><p>Legacy <a href="https://example.com/terms">terms</a></p></div></div>
    <div><div>Closing</div><div><p>Legacy closing</p></div></div>`;
  await app.decorate(app.block);
  assert.ok(app.block.querySelector('.disclosures-notice strong'));
  assert.equal(app.block.querySelector('#disclosure-7').textContent, 'Legacy terms');
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Legacy closing');
  assert.equal(app.requests.length, 0);
  assert.equal(app.document.querySelector('sup a').getAttribute('href'), '#disclosure-7');
  assert.equal(app.document.querySelector('sup:last-child').textContent, '8');
});

test('legacy rendered documents still load without page transformations', async () => {
  const app = await harness(new Map([
    ['/homepage-disclosures.plain.html', '<div><div class="disclosures"><ol class="disclosures-items"><li id="disclosure-7">Legacy document</li></ol></div></div>'],
  ]), '<p><sup>7</sup></p>');
  app.block.querySelector('a').href = new URL('/homepage-disclosures', preview).href;
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.equal(app.block.querySelector('#disclosure-7').textContent, 'Legacy document');
  assert.equal(app.state.decorated, 0);
  assert.equal(app.document.querySelector('sup a').getAttribute('href'), '#disclosure-7');
});

test('linked authored Disclosures tables render their rows and ignore surrounding page copy', async () => {
  const app = await harness(new Map([
    ['/homepage-disclosures.plain.html', `<div><h1>Document title</h1>
      <div class="disclosures">
        <div><div>Introduction</div><div><p>Authored introduction</p></div></div>
        <div><div>Notice</div><div><p>Investment risk</p></div></div>
        <div><div>7</div><div><p><strong>Legacy terms</strong></p></div></div>
        <div><div>Closing</div><div><p>Authored closing</p></div></div>
        <div><div>Incomplete row</div></div>
      </div><p>Other page copy</p></div>`],
  ]), '<p><sup>g</sup></p>');
  app.block.querySelector('a').href = new URL('/homepage-disclosures.html', preview).href;
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.equal(app.block.querySelector('#disclosure-7 strong').textContent, 'Legacy terms');
  assert.equal(app.block.querySelector('.disclosures-notice').textContent, 'Investment risk');
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Authored closing');
  assert.doesNotMatch(app.block.textContent, /Document title|Other page copy|Incomplete row/);
  assert.equal(app.document.querySelector('sup a').textContent, '7');
  assert.equal(app.requests.length, 1);
  assert.equal(app.state.decorated, 0);
});

test('rich-text disclosure pages preserve legal copy and link the homepage letter markers', async () => {
  const path = '/disclosures/docs/homepage';
  const app = await harness(new Map([
    [`${path}.plain.html`, `<div>
      <h1 id="homepage-disclosures">Homepage Disclosures</h1>
      <h2>Please read all the important disclosures below.</h2>
      <p>Investing: <strong>Investment risk</strong></p>
      <table><tbody><tr><td>Not FDIC insured</td></tr></tbody></table>
      <picture><source srcset="./media_sipc.webp"><img src="./media_sipc.png" alt="Member SIPC"></picture>
      <ol>${Array.from({ length: 13 }, (_, index) => `<li>
        <p id="terms-${index + 1}"><strong>Terms ${index + 1}</strong></p>
        <ul><li>Nested condition</li></ul>
        <ol><li>Nested numbered condition</li></ol>
        <p><a href="/disclosures/fragments/conditions" class="button primary">Full conditions</a>
          <a href="#terms-${index + 1}">Terms anchor</a> <em>Emphasis</em></p>
      </li>`).join('')}</ol>
      <p>Corporate closing</p>
    </div><div></div><div></div>`],
  ]), '<p>Offer <sup>a</sup>, fees <sup>b</sup>, awards <sup>l,m,k</sup>, missing <sup>n</sup>.</p>');
  app.block.querySelector('a').href = new URL(`${path}.plain.html`, preview).href;
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.equal(app.block.querySelectorAll('.disclosures-items > li').length, 13);
  assert.equal(app.block.querySelector('.disclosures-intro h1').id, 'homepage-disclosures');
  assert.ok(app.block.querySelector('.disclosures-intro table'));
  assert.equal(app.block.querySelector('img').src, new URL('/disclosures/docs/media_sipc.png', preview).href);
  assert.equal(app.block.querySelector('source').getAttribute('srcset'), new URL('/disclosures/docs/media_sipc.webp', preview).href);
  assert.equal(app.block.querySelector('#disclosure-1').tabIndex, -1);
  assert.equal(app.block.querySelector('#disclosure-1 #terms-1 strong').textContent, 'Terms 1');
  assert.equal(app.block.querySelector('#disclosure-1 ul > li').id, '');
  assert.equal(app.block.querySelector('#disclosure-1 ol > li').id, '');
  assert.equal(app.block.querySelector('a[href="/disclosures/fragments/conditions"]').className, '');
  assert.ok(app.block.querySelector('a[href="#terms-1"]'));
  assert.ok(app.block.querySelector('#disclosure-1 em'));
  assert.equal(app.block.querySelector('.disclosures-closing').textContent, 'Corporate closing');
  assert.deepEqual([...app.document.querySelectorAll('main sup')].map((sup) => sup.textContent), ['1', '2', '12,13,11', 'n']);
  assert.equal(app.document.querySelector('sup a').getAttribute('href'), '#disclosure-1');
  assert.deepEqual(app.requests, [`${path}.plain.html`]);
  assert.equal(app.state.decorated, 0);
  assert.equal(app.errors.length, 0);
});

test('page list numbering, authored anchors and content order survive across sections', async () => {
  const app = await harness(new Map([
    ['/legal.plain.html', `<div><p>Introduction</p><ol start="5">
      <li id="authored-terms"><p>Five</p></li><li value="9"><p>Nine</p></li><li><p>Ten</p></li>
      </ol><p>Between lists</p></div>
      <div><ol reversed start="3"><li>Three</li><li>Two</li></ol><p>Closing</p></div>`],
  ]), '<p><sup>e,i,j</sup> <sup>c,b</sup></p>');
  app.block.querySelector('a').href = new URL('/legal', preview).href;
  await app.decorate(app.block);
  assert.deepEqual([...app.block.querySelectorAll('.disclosures-items > li')]
    .map((item) => [item.id, item.getAttribute('value')]), [
    ['authored-terms', '5'], ['disclosure-9', '9'], ['disclosure-10', '10'],
    ['disclosure-3', '3'], ['disclosure-2', '2'],
  ]);
  assert.deepEqual([...app.block.children].map((node) => node.textContent.replace(/\s/g, '')), [
    'Introduction', 'FiveNineTen', 'Betweenlists', 'ThreeTwo', 'Closing',
  ]);
  assert.equal(app.document.querySelector('sup a').getAttribute('href'), '#authored-terms');
  assert.deepEqual([...app.document.querySelectorAll('main sup')].map((sup) => sup.textContent), ['5,9,10', '3,2']);
  const link = app.document.querySelector('sup a');
  app.decorateReferences(app.document.querySelector('main'));
  assert.equal(app.document.querySelector('sup a'), link);
});

test('disclosure pages without numbered lists still render their authored content', async () => {
  const app = await harness(new Map([
    ['/legal.plain.html', '<div><h2>Important disclosures</h2><p>Unnumbered legal copy.</p></div>'],
  ]), '<p><sup>a</sup></p>');
  app.block.querySelector('a').href = new URL('/legal', preview).href;
  await app.decorate(app.block);
  assert.equal(app.block.hidden, false);
  assert.equal(app.block.querySelector('p').textContent, 'Unnumbered legal copy.');
  assert.equal(app.block.querySelectorAll('.disclosures-items').length, 0);
  assert.equal(app.document.querySelectorAll('main sup a').length, 0);
});

test('missing or empty disclosure documents stay hidden without dangling references', async () => {
  const cases = [undefined, new Error('Network unavailable'), '<div><p> </p></div>'];
  await Promise.all(cases.map(async (body) => {
    const app = await harness(new Map([['/legal.plain.html', body]]), '<p><sup>a</sup></p>');
    app.block.querySelector('a').href = new URL('/legal', preview).href;
    await app.decorate(app.block);
    assert.equal(app.block.hidden, true);
    assert.equal(app.document.querySelectorAll('main sup a').length, 0);
    assert.equal(app.errors.length, typeof body === 'string' ? 0 : 1);
  }));
});

test('ordinary fragment loading still decorates the page by default', async () => {
  const app = await harness(new Map([['/fragment.plain.html', '<div><p>Fragment copy</p></div>']]));
  await app.loadFragment('/fragment');
  assert.equal(app.state.decorated, 1);
});

test('reordering the set renumbers repeated references while retaining ID anchors', async () => {
  const disclosures = [
    { disclosureId: 'apy', fragment: `${fragments}/rate` },
    { disclosureId: 'offer', fragment: `${fragments}/offer` },
    { disclosureId: 'disc1', fragment: `${fragments}/terms` },
  ];
  const routes = new Map([
    [endpoint, { disclosures }],
    [`${fragments}/rate.plain.html`, '<div><p>Rate terms</p></div>'],
    [`${fragments}/offer.plain.html`, '<div><p>Offer terms</p></div>'],
    [`${fragments}/terms.plain.html`, '<div><p>More terms</p></div>'],
  ]);
  // The first citation is to the second item; citation order must not assign numbers.
  const app = await harness(routes, '<p><sup>offer</sup> <sup>apy,disc1</sup> <sup>offer</sup></p>');
  const main = app.document.querySelector('main');
  app.decorateReferences(main);
  assert.equal(main.querySelector('sup').textContent, 'offer');
  assert.equal(main.querySelectorAll('a').length, 0);
  await app.decorate(app.block);
  assert.deepEqual([...main.querySelectorAll('sup')].map((sup) => sup.textContent), ['2', '1,3', '2']);
  assert.equal(main.querySelector('sup a').getAttribute('aria-label'), 'Disclosure 2');
  const originalLink = main.querySelector('sup a');
  app.decorateReferences(main);
  assert.equal(main.querySelector('sup a'), originalLink);
  disclosures.push(disclosures.shift());
  app.block.innerHTML = `<div><div><a href="${endpoint}">${endpoint}</a></div></div>`;
  await app.decorate(app.block);
  app.decorateReferences(main);
  assert.deepEqual([...main.querySelectorAll('sup')].map((sup) => sup.textContent), ['1', '3,2', '1']);
  assert.deepEqual([...app.block.querySelectorAll('.disclosures-items > li')]
    .map((item) => [item.dataset.disclosureId, item.getAttribute('value')]), [
    ['offer', '1'], ['disc1', '2'], ['apy', '3'],
  ]);
  assert.equal(main.querySelector('sup a').getAttribute('href'), '#disclosure-offer');
  assert.equal(main.querySelector('sup a').getAttribute('aria-label'), 'Disclosure 1');
  // Content decorated after the footer has loaded is also linked by the auto-block helper.
  const late = app.document.createElement('div');
  late.innerHTML = '<p><sup>apy</sup></p>';
  main.append(late);
  app.decorateReferences(late);
  assert.equal(late.querySelector('sup a').textContent, '3');
});

test('only matching markers are converted, with no nested anchors or external link changes', async () => {
  const app = await harness(new Map([
    [endpoint, { disclosures: [{ disclosureId: 'offer', fragment: `${fragments}/offer` }] }],
    [`${fragments}/offer.plain.html`, '<div><p>Terms with authored <sup>offer</sup></p></div>'],
  ]), `<p><sup>offer</sup> <a href="#disclosure-offer"><sup>offer</sup></a>
    <sup><a href="#disclosure-offer">offer</a></sup>
    <sup>missing</sup> <sup>offer,missing</sup> <sup>1</sup> <sup>™</sup>
    <sup><a href="https://example.com/source">offer</a></sup>
    <a href="/claim">Claim <sup>offer</sup></a></p>`);
  await app.decorate(app.block);
  const main = app.document.querySelector('main');
  assert.equal(main.querySelectorAll('.disclosures-reference').length, 3);
  assert.equal(main.querySelectorAll('a a').length, 0);
  assert.deepEqual(
    [...main.querySelectorAll('sup')].map((sup) => sup.textContent),
    ['1', '1', '1', 'missing', 'offer,missing', '1', '™', 'offer', 'offer'],
  );
  assert.equal(main.querySelector('a[href="https://example.com/source"]').textContent, 'offer');
  assert.equal(app.block.querySelector('sup').textContent, 'offer');
});

test('empty fragment bodies create neither numbered gaps nor reference targets', async () => {
  const app = await harness(new Map([
    [endpoint, {
      disclosures: [
        { disclosureId: 'empty', fragment: `${fragments}/empty` },
        { disclosureId: 'offer', fragment: `${fragments}/offer` },
      ],
    }],
    [`${fragments}/empty.plain.html`, '<div><p> </p></div>'],
    [`${fragments}/offer.plain.html`, '<div><p>Offer terms</p></div>'],
  ]), '<p><sup>empty</sup> <sup>offer</sup></p>');
  await app.decorate(app.block);
  assert.equal(app.block.querySelectorAll('.disclosures-items > li').length, 1);
  assert.equal(app.block.querySelector('#disclosure-offer').getAttribute('value'), '1');
  assert.equal(app.document.querySelector('sup').textContent, 'empty');
  assert.equal(app.document.querySelector('sup:last-child a').textContent, '1');
});
