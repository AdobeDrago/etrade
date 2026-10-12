/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function render(name, rows, variants = '') {
  const { document, window } = parseHTML(`<html><body><main><div class="section"><div class="${name} ${variants}">${rows}</div></div></main></body></html>`);
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return this.getAttribute('data-test-value') || '0'; },
    set(value) { this.setAttribute('data-test-value', value); },
  });
  Object.defineProperty(window.HTMLAnchorElement.prototype, 'relList', {
    configurable: true,
    get() { return (this.getAttribute('rel') || '').split(/\s+/).filter(Boolean); },
  });
  window.matchMedia = () => ({ matches: true });
  const context = vm.createContext({
    document,
    window,
    NodeFilter: { SHOW_TEXT: 4 },
    CustomEvent: window.CustomEvent,
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }

      observe(node) {
        Object.defineProperties(node, {
          clientWidth: { value: 200 },
          scrollWidth: { get: () => node.children.length * 200 },
        });
        [...node.children].forEach((card, i) => {
          Object.defineProperty(card, 'offsetLeft', { value: i * 200 });
        });
        node.scrollLeft = 0;
        node.scrollTo = ({ left }) => {
          node.scrollLeft = left;
          node.dispatchEvent(new window.Event('scroll'));
        };
        this.callback();
      }
    },
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), {
      context, identifier: url.href,
    });
    modules.set(url.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  const module = await moduleFor(new URL(`../blocks/${name}/${name}.js`, import.meta.url));
  await module.evaluate();
  const block = document.querySelector(`.${name}`);
  await module.namespace.default(block);
  return { block, window, document };
}
const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;
const image = '<p><picture><source srcset="/photo.webp 2x"><img src="/photo.jpg" alt="Authored alt"></picture></p>';
const copy = '<h3 id="title">Heading <em>emphasis</em></h3><p>Read our <a href="/inline?track=1">research</a>.<sup>offer</sup></p><p><a href="/learn?track=2">Learn more arrow_forward</a></p>';
function key(window, element, value) {
  const event = new window.Event('keydown', { bubbles: true, cancelable: true });
  event.key = value;
  element.dispatchEvent(event);
}

test('media cards preserve authored sources, inline links, disclosures and extra cells', async () => {
  const { block } = await render('cards-platform', row(`<a href="/media?track=3">${image}</a>`, copy, '<p>Extra copy.</p>') + row(''));
  assert.equal(block.querySelectorAll(':scope > ul > li').length, 1);
  assert.equal(block.querySelector('source').getAttribute('srcset'), '/photo.webp 2x');
  assert.equal(block.querySelector('img').alt, 'Authored alt');
  assert.equal(block.querySelector('.cards-platform-image a').getAttribute('href'), '/media?track=3');
  assert.equal(block.querySelector('h3').id, 'title');
  assert.equal(block.querySelector('.cards-platform-body a').getAttribute('href'), '/inline?track=1');
  assert.equal(block.querySelector('sup').textContent, 'offer');
  assert.equal(block.querySelector('.cards-platform-link').textContent, 'Learn more');
  assert.equal(block.querySelector('.cards-platform-link').getAttribute('href'), '/learn?track=2');
  assert.match(block.querySelector('.cards-platform-body').textContent, /Extra copy/);
  assert.equal(block.querySelector('li').hasAttribute('data-href'), false);
});

test('icons support named glyphs, icons inside paragraphs, and omitted media', async () => {
  const { block } = await render('cards-icon', row('<p>book</p>', copy) + row('<p><svg viewBox="0 0 10 10"></svg></p>', copy) + row('', copy));
  assert.equal(block.querySelectorAll('.cards-icon-card').length, 3);
  assert.equal(block.querySelector('.cards-icon-glyph-book').getAttribute('aria-hidden'), 'true');
  assert.equal(block.querySelector('.cards-icon-icon svg').tagName, 'SVG');
  assert.equal(block.querySelectorAll('.cards-icon-actions').length, 3);
});

test('numbered cards skip blank rows and use semantic contiguous ordering', async () => {
  const { block } = await render('cards-numbered', row('') + row(copy) + row('', copy));
  assert.equal(block.firstElementChild.tagName, 'OL');
  assert.deepEqual([...block.querySelectorAll('.cards-numbered-ordinal')].map((node) => node.textContent), ['1', '2']);
  assert.equal(block.querySelector('.cards-numbered-ordinal').getAttribute('aria-hidden'), 'true');
});

test('article cards preserve eyebrows and rich copy in promo and four-card layouts', async () => {
  const { block } = await render('cards-article', Array(4).fill(row(image, `<p>Research</p>${copy}`)).join(''), 'promo');
  assert.equal(block.querySelectorAll('.cards-article-eyebrow').length, 4);
  assert.equal(block.classList.contains('four-up'), true);
  assert.equal(block.querySelectorAll('.cards-article-actions').length, 4);
});

test('product hero accepts reordered named slots, inline links and an independent offer', async () => {
  const { block } = await render('hero-product', row('Offer', '<h3>Offer <sup>a</sup></h3><p>Terms <a href="/terms">apply</a>.</p><p><a href="/offer">Learn how</a></p>') + row('Image', image) + row('Content', '<p>Read <a href="/copy">details</a>.</p><p><a href="/open">Open account</a></p>', '<p>Extra.</p>') + row('Heading', '<h2 id="headline">Headline</h2>') + row('Eyebrow', '<h1>Brokerage</h1>'));
  assert.equal(block.querySelector('.hero-product-eyebrow').tagName, 'H1');
  assert.equal(block.querySelector('.hero-product-heading').id, 'headline');
  assert.equal(block.querySelector('.hero-product-content p a').getAttribute('href'), '/copy');
  assert.equal(block.querySelector('.hero-product-actions a').textContent, 'Open account');
  assert.equal(block.querySelector('.hero-product-offer-actions a').getAttribute('href'), '/offer');
  assert.equal(block.querySelector('.hero-product-media img').getAttribute('fetchpriority'), 'high');
  assert.equal(block.querySelector('source').getAttribute('srcset'), '/photo.webp 2x');
});

test('legacy product hero retains H1 eyebrow and H2 headline with optional missing image', async () => {
  const { block } = await render('hero-product', row('<h1>Brokerage</h1><h2>Easy investing</h2><p>Copy</p>'));
  assert.equal(block.querySelector('.hero-product-eyebrow').textContent, 'Brokerage');
  assert.equal(block.querySelector('.hero-product-heading').textContent, 'Easy investing');
  assert.equal(block.classList.contains('no-image'), true);
});

test('banner preserves inline terms, media, authored superscripts and standalone actions', async () => {
  const { block } = await render('banner-offer', row(image, '<h2>Offer <sup>a</sup></h2><p>Read <a href="/terms">terms</a>.</p><p><a href="/open">Open account</a></p><p><a href="/how">Learn how</a></p>'));
  assert.equal(block.querySelector('.banner-offer-media img').alt, 'Authored alt');
  assert.equal(block.querySelector('.banner-offer-copy a').getAttribute('href'), '/terms');
  assert.equal(block.querySelectorAll('.banner-offer-actions a').length, 2);
  assert.equal(block.querySelector('sup').textContent, 'a');
  const centered = await render('banner-offer', row('<h2>Offer</h2><p><a href="/open">Open</a></p>'));
  assert.equal(centered.block.classList.contains('centered'), true);
});

test('tabs skip malformed rows, merge extra cells, and synchronize keyboard and mobile selection', async () => {
  const { block, window } = await render('tabs-accounts', row('Incomplete') + row('<p>Brokerage</p>', '<h2>Accounts</h2><ul><li><h3>Account</h3><p>Description.</p><p><a href="/more">Learn more</a></p><p><a href="/open">Open account</a></p></li></ul>') + row('Brokerage', '<h2>Other</h2>', '<p>Extra content.</p>'));
  const tabs = [...block.querySelectorAll('[role="tab"]')];
  const panels = [...block.querySelectorAll('[role="tabpanel"]')];
  assert.equal(tabs.length, 2);
  assert.notEqual(tabs[0].id, tabs[1].id);
  assert.equal(tabs[0].getAttribute('aria-controls'), panels[0].id);
  assert.equal(panels[1].hidden, true);
  assert.equal(tabs[1].tabIndex, -1);
  assert.equal(block.querySelector('.tabs-accounts-card .etrade-action-outline').textContent, 'Open account');
  key(window, tabs[0], 'ArrowLeft');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(panels[0].hidden, true);
  assert.equal(block.querySelector('select').value, '1');
  assert.match(panels[1].textContent, /Extra content/);
  key(window, tabs[1], 'Home');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  const select = block.querySelector('select');
  select.value = '1';
  select.dispatchEvent(new window.Event('change'));
  assert.equal(panels[1].hidden, false);
});

test('carousel navigation, dots and keyboard track position and disable both boundaries', async () => {
  const { block, window } = await render('carousel-story', Array(3).fill(row(image, `<p>1982</p>${copy}`)).join(''));
  const previous = block.querySelector('.carousel-story-prev');
  const next = block.querySelector('.carousel-story-next');
  const slides = block.querySelector('.carousel-story-slides');
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
  next.click();
  assert.equal(slides.scrollLeft, 200);
  assert.equal(block.querySelector('.carousel-story-status').textContent, 'Stories 2 of 3');
  key(window, slides, 'End');
  assert.equal(slides.scrollLeft, 400);
  assert.equal(next.disabled, true);
  block.querySelector('.carousel-story-dots button').click();
  assert.equal(previous.disabled, true);
  assert.equal(slides.scrollLeft, 0);
});

test('tab panels retain the existing authored dynamic-rate settings mechanism', async () => {
  const { block } = await render('tabs-accounts', row('Bank', '<h2>Bank</h2><ul><li><h3>Savings</h3><p>Earn {{rate:apy}}% APY<sup>a</sup></p></li></ul>', '<p>Rate Settings</p><p>Name: apy</p><p>Product: 3100</p><p>Mode: manual</p><p>Override: 4.25</p>'));
  assert.equal(block.querySelector('[data-rate-name="apy"]').textContent, '4.25');
  assert.equal(block.querySelector('sup').textContent, 'a');
  assert.equal(block.textContent.includes('Rate Settings'), false);
});

test('all live-content authoring examples survive decoration', async () => {
  const examples = JSON.parse(await readFile(new URL('../docs/remaining-block-examples.json', import.meta.url), 'utf8'));
  await Promise.all(examples.map(async (example) => {
    const { document } = parseHTML(example.table);
    const rows = [...document.querySelectorAll('tbody > tr')].map((tr) => row(...[...tr.children].map((td) => td.innerHTML))).join('');
    const { block } = await render(example.name, rows, example.table.includes('(promo)') ? 'promo' : '');
    assert.equal(block.hidden, false, example.title);
    assert.equal(block.textContent.includes('arrow_forward'), false, example.title);
    if (example.name === 'cards-icon') assert.equal(block.querySelectorAll('.cards-icon-glyph').length, 6);
    if (example.name === 'hero-product') assert.ok(block.querySelector('.hero-product-offer'), 'brokerage offer survived import');
    if (example.name === 'tabs-accounts') assert.equal(block.querySelectorAll('[role="tab"]').length, 7);
  }));
});

test('importers preserve icon names, promo eyebrows, hero offers and unique banner links', async () => {
  const cases = [
    {
      name: 'cards-icon',
      html: '<div class="card-container super-card-one"><i class="card-icon et-icon-lg et-icon et-book"></i><h3>Investors</h3><div class="text-default">Rich <strong>copy</strong><sup>a</sup></div></div>',
      check: (block) => {
        assert.equal(block.firstElementChild.firstElementChild.textContent, 'book');
        assert.ok(block.querySelector('p strong'));
        assert.equal(block.querySelector('sup').textContent, 'a');
      },
    },
    {
      name: 'cards-article',
      html: '<div class="card-container promo-card"><img src="/image.jpg" alt=""><p class="eyebrow">Research</p><h3>Insights</h3></div>',
      check: (block) => {
        assert.equal(block.dataset.name, 'cards-article (promo)');
        assert.equal(block.querySelector('.eyebrow').textContent, 'Research');
      },
    },
    {
      name: 'hero-product',
      html: '<h1 class="eyebrow">Brokerage</h1><h2 class="header-3xl">Investing</h2><p class="text-default">Copy.</p><p><a class="btn-primary" href="/open">Open</a></p><img src="/hero.jpg"><div class="row-flex"><h2 class="subhead-medium">Offer</h2><p>Terms.</p><a href="/offer">Learn how &gt;</a></div>',
      check: (block) => {
        const offer = [...block.children].find((item) => item.firstElementChild.textContent === 'Offer');
        assert.ok(offer.querySelector('a[href="/offer"]'));
        assert.match(offer.textContent, /Terms/);
      },
    },
    {
      name: 'banner-offer',
      html: '<img src="/arrow.jpg"><h2>Offer</h2><p>Read <a href="/terms">terms</a>.</p><p><a class="btn-primary" href="/open">Open</a></p><a href="/more">Learn how</a>',
      check: (block) => {
        assert.ok(block.querySelector('img'));
        assert.equal(block.querySelectorAll('a').length, 3);
        assert.equal(block.querySelector('a[href="/terms"]').parentElement.tagName, 'P');
      },
    },
  ];
  await Promise.all(cases.map(async ({ name, html, check }) => {
    const { document } = parseHTML(`<html><body><div id="source">${html}</div></body></html>`);
    let block;
    const WebImporter = {
      Blocks: {
        createBlock(doc, { name: blockName, cells }) {
          block = doc.createElement('div');
          block.dataset.name = blockName;
          function append(parent, value) {
            if (Array.isArray(value)) value.forEach((node) => append(parent, node));
            else if (typeof value === 'string') parent.append(doc.createTextNode(value));
            else if (value) parent.append(value);
          }
          cells.forEach((values) => {
            const item = doc.createElement('div');
            values.forEach((value) => {
              const cell = doc.createElement('div');
              append(cell, value);
              item.append(cell);
            });
            block.append(item);
          });
          return block;
        },
      },
    };
    const module = new vm.SourceTextModule(await readFile(new URL(`../tools/importer/parsers/${name}.js`, import.meta.url), 'utf8'), { context: vm.createContext({ document, WebImporter }) });
    await module.link(() => {});
    await module.evaluate();
    module.namespace.default(document.querySelector('#source'), { document });
    check(block);
  }));
});
