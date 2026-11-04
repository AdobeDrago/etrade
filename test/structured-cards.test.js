/* eslint-env node */
/* eslint-disable no-restricted-syntax -- Sequential rendering avoids VM module linking races. */
/* eslint-disable no-script-url -- Malformed destinations are deliberate security test inputs. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const families = ['cards', 'cards-account', 'cards-product', 'cards-pricing', 'cards-article', 'cards-platform', 'cards-icon', 'cards-award', 'cards-numbered', 'carousel-story'];
const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;
const reference = (path = '/cards/product/savings') => row(`<p><a href="${path}">Shared card</a></p>`);
const card = (extra = {}) => ({
  id: 'savings', title: 'Shared savings', description: 'Shared description', actions: [{ label: 'Learn more', href: '/learn?campaign=cards#details' }], ...extra,
});
const response = (payload) => ({ ok: true, json: async () => payload, text: async () => payload });

async function harness(respond = () => response(card()), base = 'http://localhost:3000/home') {
  const { document, window } = parseHTML('<html><head></head><body><main><div class="section"></div></main></body></html>');
  window.location = new URL(base);
  window.origin = window.location.origin;
  window.hlx = { codeBasePath: '' };
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  window.matchMedia = () => ({ matches: true });
  Object.defineProperty(window.HTMLAnchorElement.prototype, 'relList', {
    configurable: true,
    get() { return (this.getAttribute('rel') || '').split(/\s+/).filter(Boolean); },
  });
  const requests = [];
  const errors = [];
  const context = vm.createContext({
    document,
    window,
    URL,
    URLSearchParams,
    crypto: webcrypto,
    CustomEvent: window.CustomEvent,
    NodeFilter: { SHOW_TEXT: 4 },
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error: (...args) => errors.push(args) },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }

      observe(list) {
        Object.defineProperties(list, {
          clientWidth: { value: 200 }, scrollWidth: { get: () => list.children.length * 200 },
        });
        [...list.children].forEach((item, index) => Object.defineProperty(item, 'offsetLeft', { value: index * 200 }));
        list.scrollLeft = 0;
        list.scrollTo = ({ left }) => { list.scrollLeft = left; };
        this.callback();
      }
    },
    fetch: async (url, init) => {
      requests.push({ url: String(url), init });
      return respond(String(url), init);
    },
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), {
      context,
      identifier: url.href,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}/scripts/aem.js`; },
      importModuleDynamically: async (specifier, source) => {
        const dependency = await moduleFor(new URL(specifier, source.identifier));
        if (dependency.status !== 'evaluated') await dependency.evaluate();
        return dependency;
      },
    });
    modules.set(url.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  async function render(name, rows, variant = '', prepareLinks = false) {
    const block = document.createElement('div');
    block.className = `${name} ${variant}`.trim();
    block.innerHTML = rows;
    document.querySelector('.section').append(block);
    if (prepareLinks) {
      const tracking = await moduleFor(new URL('../scripts/tracking.js', import.meta.url));
      if (tracking.status !== 'evaluated') await tracking.evaluate();
      tracking.namespace.decorateTrackingLinks(block, base);
    }
    const module = await moduleFor(new URL(`../blocks/${name}/${name}.js`, import.meta.url));
    if (module.status !== 'evaluated') await module.evaluate();
    await module.namespace.default(block);
    return block;
  }
  return {
    render, document, requests, errors,
  };
}

test('all ten components mix structured references and ordinary authored rows in page order', async () => {
  for (const name of families) {
    // eslint-disable-next-line no-await-in-loop
    const page = await harness(() => response({ data: card() }));
    // eslint-disable-next-line no-await-in-loop
    const block = await page.render(name, row('<h3>Authored first</h3><p>Keep <em>rich copy</em>.</p>') + reference() + row('<h3>Authored last</h3>'));
    const list = block.querySelector(':scope > ul, :scope > ol');
    assert.deepEqual([...list.children].map((item) => item.querySelector('h3').textContent), ['Authored first', 'Shared savings', 'Authored last'], name);
    assert.equal(block.querySelector('em').textContent, 'rich copy', name);
    assert.ok(block.querySelector('a[href="/learn?campaign=cards#details"]'), name);
    assert.equal(page.requests.length, 1, name);
    assert.equal(page.requests[0].url, 'https://da-sc.adobeaem.workers.dev/preview/adobedrago/etrade/cards/product/savings', name);
  }
});

test('ordinary links, inline references and authored rows make no structured requests', async () => {
  const page = await harness(() => assert.fail('Ordinary cards must not fetch content'));
  const block = await page.render('cards-product', row('<h3>Ordinary</h3><p>Read <a href="/cards/product/savings">this card</a> for details.</p>') + row('<p><a href="/open">Open account</a></p>') + row('<p><a href="#disclosure-offer">Read disclosure</a></p>'));
  assert.equal(block.querySelectorAll(':scope > ul > li').length, 3);
  assert.ok(block.querySelector('.etrade-action[href="#disclosure-offer"]'));
  assert.equal(page.requests.length, 0);
});

test('source links accept site URLs, text paths and blank cells, and select live on production', async () => {
  const page = await harness(() => response(card()), 'https://us.etrade.com/home');
  const block = await page.render('cards-product', row('', '<p>/cards/product/savings.html</p>') + reference('https://et-structured-cards--etrade--AdobeDrago.aem.page/cards/product/savings.plain.html'));
  assert.equal(block.querySelectorAll('h3').length, 2);
  assert.equal(page.requests.length, 1);
  assert.match(page.requests[0].url, /^https:\/\/da-sc\.adobeaem\.workers\.dev\/live\//);
});

test('repeated references share requests across blocks but get independent DOM nodes', async () => {
  const page = await harness();
  const first = await page.render('cards-product', reference() + reference());
  const second = await page.render('cards-account', reference());
  assert.equal(page.requests.length, 1);
  assert.equal(first.querySelectorAll('h3').length, 2);
  assert.equal(second.querySelectorAll('h3').length, 1);
  assert.equal(page.document.querySelectorAll('[id="savings"]').length, 0);
});

test('failures and malformed payloads omit only the referenced card', async () => {
  for (const payload of [null, [], {}, { id: 'bad', title: '' }, { id: 'INVALID ID', title: 'Bad' }]) {
    // eslint-disable-next-line no-await-in-loop
    const page = await harness(() => response(payload));
    // eslint-disable-next-line no-await-in-loop
    const block = await page.render('cards-product', reference() + row('<h3>Keep this card</h3>'));
    assert.equal(block.querySelectorAll('li').length, 1);
    assert.equal(block.querySelector('h3').textContent, 'Keep this card');
    assert.equal(page.errors.length, 1);
  }
  const page = await harness(() => ({ ok: false, status: 404 }));
  const block = await page.render('cards-product', reference());
  assert.equal(block.hidden, true);
  assert.equal(block.querySelector('a'), null);
});

test('request completion order cannot reorder cards', async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const page = await harness(async (url) => {
    if (url.endsWith('/slow')) { await slow; return response(card({ title: 'First' })); }
    release();
    return response(card({ title: 'Second' }));
  });
  const block = await page.render('cards-product', reference('/cards/product/slow') + reference('/cards/product/fast'));
  assert.deepEqual([...block.querySelectorAll('h3')].map((heading) => heading.textContent), ['First', 'Second']);
});

test('media, glyphs, offer kind, attribution and story labels adapt to their existing renderers', async () => {
  const page = await harness(() => response(card({ image: { src: '/photo.jpg', alt: 'Product screen' }, eyebrow: '1982', attribution: 'Award publisher' })));
  for (const name of ['cards', 'cards-article', 'cards-platform', 'cards-award', 'carousel-story']) {
    // eslint-disable-next-line no-await-in-loop
    const block = await page.render(name, reference());
    assert.equal(block.querySelector('img').alt, 'Product screen', name);
    if (['cards-article', 'carousel-story'].includes(name)) assert.equal(block.querySelector(`.${name}-eyebrow`).textContent, '1982');
    if (name === 'cards-award') assert.match(block.textContent, /Award publisher/);
  }
  const icons = await harness((url) => response(card(url.endsWith('/offer') ? { kind: 'offer' } : { icon: 'book' })));
  const block = await icons.render('cards-icon', reference('/cards/icon/book') + reference('/cards/icon/offer'));
  assert.ok(block.querySelector('.cards-icon-glyph-book'));
  assert.equal(block.querySelectorAll('.cards-icon-offer').length, 1);
  const decorative = await harness(() => response(card({ image: { src: '/trophy.svg', decorative: true } })));
  const award = await decorative.render('cards-award', reference());
  assert.equal(award.querySelector('img').alt, '');
});

test('rich bodies preserve formatting and local media, and override the plain description', async () => {
  const page = await harness((url) => (url.endsWith('.plain.html')
    ? response('<div><p id="benefits">Read <strong>benefits</strong> and <a href="#benefits">jump</a>.<sup>offer</sup></p><ul><li>Benefit</li></ul><p><img src="./media_photo.jpg" alt="Detail"></p></div>')
    : response(card({ bodyFragment: '/card-copy/benefits', description: 'Do not render this alternative' }))));
  const block = await page.render('cards-product', reference() + reference());
  assert.equal(page.requests.length, 2);
  assert.equal(block.querySelectorAll('strong').length, 2);
  assert.equal(block.querySelectorAll('ul ul li').length, 2);
  assert.equal(block.textContent.includes('Do not render this alternative'), false);
  assert.equal(block.querySelector('img').getAttribute('src'), 'http://localhost:3000/card-copy/media_photo.jpg');
  const anchors = [...block.querySelectorAll('p[id]')];
  assert.notEqual(anchors[0].id, anchors[1].id);
  anchors.forEach((paragraph) => assert.equal(paragraph.querySelector('a').getAttribute('href'), `#${paragraph.id}`));
});

test('an unavailable body never substitutes the alternate description', async () => {
  const page = await harness((url) => (url.endsWith('.plain.html') ? { ok: false, status: 503 } : response(card({ bodyFragment: '/card-copy/missing', description: 'Alternate copy' }))));
  const block = await page.render('cards-article', reference() + row('<h3>Keep authored</h3>'));
  assert.equal(block.querySelectorAll(':scope > ul > li').length, 1);
  assert.equal(block.textContent.includes('Alternate copy'), false);
});

test('structured links and rich markup reject executable URLs and event handlers', async () => {
  const page = await harness((url) => (url.endsWith('.plain.html')
    ? response('<div><p onclick="bad()">Safe <a href="javascript:bad()">word</a></p><script>bad()</script><img src="x" onerror="bad()"><iframe src="/bad"></iframe></div>')
    : response(card({
      bodyFragment: '/card-copy/safe',
      actions: [{ label: 'Bad', href: 'javascript:bad()' }, {
        label: 'Good', href: '/safe', target: '_blank', ariaLabel: 'Open safe page',
      }],
    }))));
  const block = await page.render('cards-account', reference());
  assert.equal(block.querySelector('script, iframe, [onclick], [onerror], [href^="javascript:"]'), null);
  const link = block.querySelector('a[href="/safe"]');
  assert.equal(link.getAttribute('aria-label'), 'Open safe page');
  assert.match(link.rel, /noopener/);
  assert.equal(link.target, '_blank');
  const foreign = await harness(() => assert.fail('External card sources must not be fetched'));
  await foreign.render('cards-product', reference('https://evil.example/cards/product/savings'));
  assert.equal(foreign.requests.length, 0);
});

test('structured rate bindings preserve numeric zero, claim markers and failure placeholders', async () => {
  for (const name of ['cards-account', 'cards-product', 'cards-pricing']) {
    // eslint-disable-next-line no-await-in-loop
    const page = await harness(() => response(card({ rateText: '{{rate:base}}% APY', rateDisclosureIds: ['apy'], rates: [{ name: 'base', mode: 'manual', override: 0 }] })));
    // eslint-disable-next-line no-await-in-loop
    const block = await page.render(name, reference());
    assert.equal(block.querySelector('[data-rate-name="base"]').textContent, '0.00', name);
    assert.equal(block.querySelector('h4 sup').textContent, 'apy', name);
    assert.equal(page.requests.length, 1, name);
  }
  const failed = await harness(() => response(card({ rateText: '{{rate}}% APY', rates: [{ name: 'rate', mode: 'manual', fallback: '-.--' }] })));
  const block = await failed.render('cards-product', reference());
  assert.equal(block.querySelector('[data-rate-name]').textContent, '-.--');
  assert.equal(failed.requests.length, 1);
});

test('pricing values keep their treatment with disclosure IDs and page variants stay selected', async () => {
  const page = await harness(() => response(card({ value: '$0', valueDisclosureIds: ['fees'] })));
  const block = await page.render('cards-pricing', reference(), 'band');
  assert.equal(block.querySelector('.cards-pricing-value').textContent, '$0fees');
  assert.equal(block.querySelector('.cards-pricing-value sup').textContent, 'fees');
  assert.equal(block.querySelectorAll(':scope > .cards-pricing-actions').length, 1);
  assert.equal(block.classList.contains('band'), true);
});

test('late structured content links existing disclosures after the footer has loaded', async () => {
  const page = await harness(() => response(card({ disclosureIds: ['offer'] })));
  const footer = page.document.createElement('div');
  footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-offer" data-disclosure-id="offer">Offer terms</li></ol>';
  page.document.body.append(footer);
  const block = await page.render('cards-product', reference());
  assert.equal(block.querySelector('sup a').getAttribute('href'), '#disclosure-offer');
  assert.equal(block.querySelector('sup a').textContent, '1');
});

test('rich-body disclosure markers stay in the body instead of becoming actions', async () => {
  const page = await harness((url) => (url.endsWith('.plain.html')
    ? response('<div id="benefits"><p>Benefits</p><p><a href="#benefits">Jump to benefits</a></p></div>')
    : response(card({ bodyFragment: '/card-copy/benefits', disclosureIds: ['offer'] }))));
  const footer = page.document.createElement('div');
  footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-offer" data-disclosure-id="offer">Terms</li></ol>';
  page.document.body.append(footer);
  const block = await page.render('cards-product', reference());
  assert.ok(block.querySelector('.cards-product-body sup a[href="#disclosure-offer"]'));
  assert.equal(block.querySelector('.cards-product-actions a[href="#disclosure-offer"]'), null);
  const anchor = block.querySelector('a[href^="#card-body-"]');
  assert.ok(block.querySelector(`[id="${anchor.getAttribute('href').slice(1)}"]`));
});

test('structured actions receive tracking metadata and keep ordinary query parameters', async () => {
  const page = await harness(() => response(card({ actions: [{ label: 'Open', href: '/open?campaign=cards&@tracking=card-open&@tracking-category=C0002#start' }] })));
  const block = await page.render('cards-account', reference());
  const link = block.querySelector('a');
  assert.equal(link.getAttribute('href'), '/open?campaign=cards#start');
  assert.equal(link.dataset.trackingKey, 'card-open');
  assert.equal(link.dataset.trackingCategory, 'C0002');
});

test('API bindings use the existing shared rate service and invalid CD settings never request it', async () => {
  const rates = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url), 'utf8'));
  const page = await harness((url) => response(url.includes('da-sc.') ? card({
    rateText: '{{rate}}% APY',
    rates: [{
      name: 'rate', mode: 'api', product: '3100', field: 'advertisedAPY', balance: 0,
    }],
  }) : rates));
  const product = await page.render('cards-product', reference());
  const account = await page.render('cards-account', reference());
  assert.equal(product.querySelector('[data-rate-name]').textContent, '3.75');
  assert.equal(account.querySelector('[data-rate-name]').textContent, '3.75');
  assert.equal(page.requests.length, 2);
  const invalid = await harness(() => response(card({
    rateText: '{{rate}}% APY',
    rates: [{
      name: 'rate', mode: 'api', product: '3500', field: 'advertisedAPY', term: '12M', fallback: '-.--',
    }],
  })));
  const block = await invalid.render('cards-product', reference());
  assert.equal(block.querySelector('[data-rate-name]').textContent, '-.--');
  assert.equal(block.querySelector('[data-rate-name]').dataset.rateError, 'invalid-settings');
  assert.equal(invalid.requests.length, 1);
});

test('informative images require alt text and plain strings cannot inject HTML', async () => {
  const page = await harness(() => response(card({ image: { src: '/photo.jpg' } })));
  const empty = await page.render('cards-article', reference());
  assert.equal(empty.hidden, true);
  const literal = await harness(() => response(card({ title: '<img src=x onerror=bad()>', description: '<strong>Literal text</strong>' })));
  const block = await literal.render('cards-product', reference());
  assert.equal(block.querySelector('h3').textContent, '<img src=x onerror=bad()>');
  assert.equal(block.querySelector('img, strong'), null);
});

test('structured actions can target scoped rich-body anchors and unsupported icons stay absent', async () => {
  const page = await harness((url) => (url.endsWith('.plain.html')
    ? response('<div><p id="benefits">Benefits</p></div>')
    : response(card({ bodyFragment: '/card-copy/benefits', actions: [{ label: 'Read benefits', href: '#benefits' }] }))));
  const block = await page.render('cards-product', reference());
  const target = block.querySelector('p[id]');
  assert.equal(block.querySelector('.cards-product-actions a').getAttribute('href'), `#${target.id}`);
  const icons = await harness(() => response(card({ icon: 'unsupported-icon' })));
  const iconBlock = await icons.render('cards-icon', reference());
  assert.equal(iconBlock.textContent.includes('unsupported-icon'), false);
});

test('tracking and route cleanup cannot turn ordinary action rows into structured references', async () => {
  const values = [
    '/cards/product/savings?@tracking=card-details',
    '/cards/product/savings?@link-paths=%2Fother&@link-label=Other&@link-url=%2Fother',
    '/ordinary?@link-paths=%2Fhome&@link-label=Updated&@link-url=%2Fcards%2Fproduct%2Fsavings',
  ];
  for (const value of values) {
    // eslint-disable-next-line no-await-in-loop
    const page = await harness();
    // eslint-disable-next-line no-await-in-loop
    const block = await page.render('cards-product', reference(value), '', true);
    assert.equal(page.requests.length, 0, value);
    assert.equal(block.querySelectorAll('li').length, 1, value);
    assert.equal(block.querySelector('h3'), null, value);
    assert.ok(block.querySelector('a'), value);
  }
});
