/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function render(name, rows, variants = '', hash = '', visibleCards = 1, theme = '') {
  const { document, window } = parseHTML(`<html><body><main><div class="section" data-section-theme="${theme}"><div class="${name} ${variants}">${rows}</div></div></main></body></html>`);
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
  window.location = { hash };
  const context = vm.createContext({
    document,
    window,
    NodeFilter: { SHOW_TEXT: 4 },
    CustomEvent: window.CustomEvent,
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }

      observe(node) {
        Object.defineProperties(node, {
          clientWidth: { value: 200 * visibleCards },
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

test('columns decorate imported bare formatted links without changing inline links', async () => {
  const { block } = await render('columns', row('<h2>Pricing</h2><p>Read <a href="/terms">terms</a>.</p>', '<strong><a href="/open?track=1">Open an account</a></strong><br><a href="/pricing?track=2">View pricing</a>'));
  assert.equal(block.querySelector('.etrade-action-primary').getAttribute('href'), '/open?track=1');
  assert.equal(block.querySelector('.etrade-action-secondary').getAttribute('href'), '/pricing?track=2');
  assert.equal(block.querySelectorAll('.etrade-action').length, 2);
  assert.equal(block.querySelector('p a').getAttribute('href'), '/terms');
  const empty = await render('columns', '');
  assert.equal(empty.block.classList.contains('columns-0-cols'), true);
});

test('feature columns honor authored section themes while explicit block themes keep precedence', async () => {
  const inherited = await render('columns-feature', row(image, copy), '', '', 1, 'dark');
  assert.equal(inherited.block.classList.contains('dark'), true);
  assert.equal(inherited.block.querySelector('h3').id, 'title');
  assert.equal(inherited.block.querySelector('p a').getAttribute('href'), '/inline?track=1');
  const explicit = await render('columns-feature', row(image, copy), 'light', '', 1, 'dark');
  assert.equal(explicit.block.classList.contains('light'), true);
  assert.equal(explicit.block.classList.contains('dark'), false);
});

test('last story selection stays selected when two desktop cards share the final scroll position', async () => {
  const { block } = await render('carousel-story', Array(3).fill(row(image, copy)).join(''), '', '', 2);
  const dots = [...block.querySelectorAll('.carousel-story-dots button')];
  const slides = block.querySelector('.carousel-story-slides');
  const { scrollTo } = slides;
  // Browsers emit no scroll event when the requested position is already reached.
  slides.scrollTo = (options) => {
    if (slides.scrollLeft !== options.left) scrollTo(options);
  };
  dots[1].click();
  assert.equal(dots[1].getAttribute('aria-current'), 'true');
  dots[2].click();
  assert.equal(dots[2].getAttribute('aria-current'), 'true');
  assert.equal(block.querySelector('.carousel-story-next').disabled, true);
  assert.equal(block.querySelector('.carousel-story-status').textContent, 'Stories 2–3 of 3');
  dots[1].click();
  assert.equal(dots[1].getAttribute('aria-current'), 'true');
});

test('carousel advances each rapid navigation request before smooth scrolling finishes', async () => {
  const { block, window } = await render('carousel-story', Array(5).fill(row(image, copy)).join(''));
  const slides = block.querySelector('.carousel-story-slides');
  const requests = [];
  window.matchMedia = () => ({ matches: false });
  slides.scrollTo = (options) => requests.push(options);
  const next = block.querySelector('.carousel-story-next');
  next.click();
  next.click();
  key(window, slides, 'ArrowRight');
  assert.deepEqual(requests.map(({ left }) => left), [200, 400, 600]);
  assert.ok(requests.every(({ behavior }) => behavior === 'smooth'));
  slides.scrollLeft = 600;
  slides.dispatchEvent(new window.Event('scroll'));
  assert.equal(block.querySelectorAll('.carousel-story-dots button')[3].getAttribute('aria-current'), 'true');
});

test('carousel reduced-motion navigation is instant and native scrolling clears pending navigation', async () => {
  const { block, window } = await render('carousel-story', Array(5).fill(row(image, copy)).join(''));
  const slides = block.querySelector('.carousel-story-slides');
  const requests = [];
  slides.scrollTo = (options) => requests.push(options);
  block.querySelector('.carousel-story-next').click();
  assert.equal(requests[0].behavior, 'instant');
  // A wheel gesture interrupts the request before it reaches its destination.
  slides.dispatchEvent(new window.Event('wheel'));
  block.querySelector('.carousel-story-next').click();
  assert.equal(requests[1].left, 200);
});

test('compact investment cards preserve native links with the text action treatment', async () => {
  const { block } = await render('cards-platform', row(image, copy), 'compact');
  const link = block.querySelector('.cards-platform-link');
  assert.equal(link.getAttribute('href'), '/learn?track=2');
  assert.equal(link.classList.contains('etrade-action-secondary'), true);
  assert.equal(block.querySelector('.cards-platform-body a').getAttribute('href'), '/inline?track=1');
});

test('pricing band recognizes cents and groups authored actions below the values', async () => {
  const { block } = await render('cards-pricing', row('<p>$0</p><h3>Stocks<sup>b</sup></h3><p><a href="/pricing?track=1">View all pricing</a></p>') + row('<p>65¢</p><h3>Options</h3>') + row('<p>$1.50</p><h3>Futures</h3>'), 'band');
  assert.deepEqual([...block.querySelectorAll('.cards-pricing-value')].map((p) => p.textContent), ['$0', '65¢', '$1.50']);
  assert.equal(block.querySelectorAll('li .cards-pricing-actions').length, 0);
  const link = block.querySelector(':scope > .cards-pricing-actions a');
  assert.equal(link.getAttribute('href'), '/pricing?track=1');
  assert.equal(link.classList.contains('etrade-action-primary'), true);
  assert.equal(link.classList.contains('etrade-action-outline'), false);
  assert.equal(block.querySelector('sup').textContent, 'b');
});

test('account application actions have outlines even without a Learn more link', async () => {
  const { block } = await render('tabs-accounts', row('Managed', '<ul><li><h3>Core Portfolios</h3><p><a href="/start?track=1">Get started</a></p></li></ul>'));
  assert.equal(block.querySelector('.etrade-action-outline').getAttribute('href'), '/start?track=1');
});

test('account tabs select a valid live-style deep link and safely ignore missing panels', async () => {
  const rows = ['Popular', 'Brokerage', 'Retirement', 'Managed', 'Small Business', 'Bank'].map((label) => row(label, `<h2>${label}</h2>`)).join('');
  const { block } = await render('tabs-accounts', rows, '', '#tab_5');
  assert.equal(block.querySelector('[aria-selected="true"]').textContent, 'Bank');
  assert.equal(block.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
  const fallback = await render('tabs-accounts', rows, '', '#tab_99');
  assert.equal(fallback.block.querySelector('[aria-selected="true"]').textContent, 'Popular');
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
  const examples = JSON.parse(await readFile(new URL('./fixtures/remaining-block-examples.json', import.meta.url), 'utf8'));
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

test('current Planning cards keep nine named icons, an independent offer, and tool actions', async () => {
  const pages = JSON.parse(await readFile(new URL('./fixtures/current-pages.json', import.meta.url), 'utf8'));
  const planning = pages.find((page) => page.id === 'planning');
  const icons = planning.sections.flatMap((section) => section.blocks).filter((item) => item.name.startsWith('Cards Icon'));
  const { block: events } = await render('cards-icon', icons[0].rows.map((cells) => row(...cells)).join(''), 'planning');
  assert.equal(events.querySelectorAll('.cards-icon-glyph').length, 5);
  assert.equal(events.querySelectorAll('.cards-icon-card').length, 6);
  const offer = events.querySelector('.cards-icon-offer');
  assert.match(offer.textContent, /RETIRE26/);
  assert.ok(offer.querySelector('a[href*="retirement"]'));
  assert.equal(offer.querySelector('.cards-icon-icon'), null);
  assert.equal(offer.textContent.includes('offer Get'), false);
  const { block: tools } = await render('cards-icon', icons[1].rows.map((cells) => row(...cells)).join(''), 'tools');
  assert.equal(tools.querySelectorAll('.cards-icon-glyph').length, 4);
  assert.equal(tools.querySelectorAll('.etrade-action-outline').length, 4);
  assert.equal(tools.querySelectorAll('a[href*="icid="]').length, 4);
});

test('current six-page pack has complete account panels, FAQs, and bound legal references', async () => {
  const pages = JSON.parse(await readFile(new URL('./fixtures/current-pages.json', import.meta.url), 'utf8'));
  const counts = {
    homepage: 6, 'our-accounts': 5, brokerage: 7, planning: 9,
  };
  pages.forEach((page) => {
    const blocks = page.sections.flatMap((section) => section.blocks);
    const faq = blocks.find((item) => item.name.startsWith('Accordion FAQ'));
    if (counts[page.id]) assert.equal(faq.rows.length, counts[page.id], page.id);
    const { document } = parseHTML(`<div>${page.sections.map((section) => section.html + section.blocks.flatMap((item) => item.rows.flat()).join('')).join('')}</div>`);
    const ids = new Set(page.legal.disclosures.map((item) => item.id));
    document.querySelectorAll('sup').forEach((sup) => {
      if (sup.textContent === 'TM') return;
      assert.ok(sup.textContent.split(',').every((id) => ids.has(id)), `${page.id}: ${sup.textContent}`);
    });
    assert.equal(document.querySelector('script,style,iframe'), null, page.id);
  });
  const accounts = pages.find((page) => page.id === 'our-accounts').sections[1].blocks[0];
  const { block } = await render('tabs-accounts', accounts.rows.map((cells) => row(...cells)).join(''), '', '#tab_6');
  assert.equal(block.querySelectorAll('[role="tab"]').length, 7);
  const panels = [...block.querySelectorAll('[role="tabpanel"]')];
  assert.deepEqual(panels.map((panel) => panel.querySelectorAll('.tabs-accounts-card').length), [6, 3, 6, 2, 4, 4, 1]);
  assert.match(panels[6].textContent, /zerohash/);
  assert.equal(panels[6].hidden, false);
});
