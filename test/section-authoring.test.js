/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;
const metadata = (...rows) => `<div class="section-metadata">${rows.join('')}</div>`;
const content = '<h2 id="authored-heading">Authored heading</h2><p>Read <a href="/details?track=1#terms">details</a>.<sup>offer</sup></p>';
const card = '<div class="cards"><div><div><h3>Card title</h3><p>Card copy.</p></div></div></div>';

async function harness(markup) {
  const { document, window } = parseHTML(`<html data-block-review><head></head><body><main>${markup}</main></body></html>`);
  window.location = new URL('http://localhost:3000/review');
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  // Linkedom omits indexed token access used by the EDS runtime.
  Object.defineProperty(Object.getPrototypeOf(document.documentElement.classList), '0', {
    configurable: true,
    get() { return [...this][0]; },
  });
  window.CSS = {
    supports: (property, value) => (property === 'color' && value === '#123456')
      || (property === 'background-image' && value === 'linear-gradient(90deg, #121213, #5627d8)'),
  };
  const context = vm.createContext({
    document, window, URL, URLSearchParams, crypto: webcrypto, CustomEvent: window.CustomEvent,
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
  const aem = await moduleFor(new URL('../scripts/aem.js', import.meta.url));
  const authoring = await moduleFor(new URL('../scripts/section-authoring.js', import.meta.url));
  const layout = await moduleFor(new URL('../scripts/section-layout.js', import.meta.url));
  await aem.evaluate();
  await authoring.evaluate();
  await layout.evaluate();
  const main = document.querySelector('main');
  aem.namespace.decorateSections(main);
  return {
    document,
    main,
    decorate: () => authoring.namespace.default(main),
    boundaries: () => layout.namespace.default(main),
    blocks: () => aem.namespace.decorateBlocks(main),
    pipeline: async () => {
      const scripts = await moduleFor(new URL('../scripts/scripts.js', import.meta.url));
      await scripts.evaluate();
      return scripts.namespace;
    },
  };
}

test('sections without authoring options keep their existing markup, classes and styles', async () => {
  const page = await harness(`<div class="dark" id="existing">${content}${card}</div>`);
  const before = page.main.innerHTML;
  page.decorate();
  assert.equal(page.main.innerHTML, before);
});

test('section options preserve authored content and direct block wrappers', async () => {
  const page = await harness(`<div>${content}${card}${card}${metadata(
    row('Container', 'narrow'),
    row('Grid', '3'),
    row('Gap', 'L'),
    row('Spacing', 'XL'),
    row('Color Scheme', 'Dark'),
    row('Align', 'center'),
    row('Anchor', '#review'),
  )}</div>`);
  page.decorate();
  page.blocks();
  const section = page.main.firstElementChild;
  assert.equal(section.id, 'review');
  assert.equal(section.dataset.sectionContainer, 'narrow');
  assert.equal(section.dataset.sectionGrid, '3');
  assert.equal(section.dataset.sectionGap, 'l');
  assert.equal(section.dataset.sectionSpacing, 'xl');
  assert.equal(section.dataset.sectionTheme, 'dark');
  assert.equal(section.dataset.sectionAlign, 'center');
  assert.equal(section.querySelectorAll(':scope > .cards-wrapper > .cards.block').length, 2);
  assert.equal(section.querySelector('h2').id, 'authored-heading');
  assert.equal(section.querySelector('a').getAttribute('href'), '/details?track=1#terms');
  assert.equal(section.querySelector('sup').textContent, 'offer');
  assert.equal(section.querySelector('.section-metadata'), null);
  const before = page.main.innerHTML;
  page.decorate();
  assert.equal(page.main.innerHTML, before);
});

test('delivery-pipeline section attributes apply without a remaining metadata block', async () => {
  const page = await harness(`<div data-container="narrow" data-grid="3" data-gap="l" data-spacing="xl" data-color-scheme="dark" data-align="center" id="delivered-section">${content}${card}${card}</div>`);
  page.decorate();
  page.blocks();
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionContainer, 'narrow');
  assert.equal(section.dataset.sectionGrid, '3');
  assert.equal(section.dataset.sectionGap, 'l');
  assert.equal(section.dataset.sectionSpacing, 'xl');
  assert.equal(section.dataset.sectionTheme, 'dark');
  assert.equal(section.dataset.sectionAlign, 'center');
  assert.equal(section.dataset.sectionLayout, 'authored');
  assert.equal(section.id, 'delivered-section');
  assert.equal(section.querySelectorAll(':scope > .cards-wrapper > .cards.block').length, 2);
  const before = page.main.innerHTML;
  page.decorate();
  assert.equal(page.main.innerHTML, before);
});

test('delivered backgrounds and styles retain their scheme and section identity', async () => {
  const page = await harness(`<div class="campaign-special" id="offer" data-container="STANDARD" data-background="inverse" data-spacing="none">${content}${card}</div>`);
  page.decorate();
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionContainer, 'standard');
  assert.equal(section.dataset.sectionSpacing, 'none');
  assert.equal(section.dataset.sectionTheme, 'dark');
  assert.equal(section.style.backgroundColor, 'var(--color-surface-inverse)');
  assert.equal(section.id, 'offer');
  assert.ok(section.classList.contains('campaign-special'));
});

test('an unconsumed metadata block overrides delivered defaults and invalid attributes stay inert', async () => {
  const page = await harness(`<div data-container="narrow" data-grid="8" data-gap="huge" data-color-scheme="invalid">${card}${metadata(row('Container', 'full'), row('Grid', '2'))}</div>`);
  page.decorate();
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionContainer, 'full');
  assert.equal(section.dataset.sectionGrid, '2');
  assert.equal(section.dataset.sectionGap, undefined);
  assert.equal(section.dataset.sectionTheme, undefined);
  assert.equal(section.querySelector('.section-metadata'), null);
});

test('all six grid counts and named gap and spacing options are accepted', async () => {
  await Promise.all(['1', '2', '3', '4', '5', '6'].map(async (grid) => {
    const page = await harness(`<div>${card}${metadata(row('Grid', grid))}</div>`);
    page.decorate();
    assert.equal(page.main.firstElementChild.dataset.sectionGrid, grid);
  }));
  await Promise.all(['none', 'xs', 's', 'm', 'l', 'xl', 'xxl'].map(async (size) => {
    const page = await harness(`<div>${content}${metadata(row('Gap', size), row('Spacing', size))}</div>`);
    page.decorate();
    assert.equal(page.main.firstElementChild.dataset.sectionGap, size);
    assert.equal(page.main.firstElementChild.dataset.sectionSpacing, size);
  }));
});

test('style aliases work while legacy style classes retain their behavior', async () => {
  const page = await harness(`<div>${content}${metadata(row('Style', 'grid-4, gap-m, spacing-l, container-narrow, dark-scheme, center, campaign-special'))}</div><div>${content}${metadata(row('Style', 'dark, legacy-campaign'))}</div>`);
  page.decorate();
  const [modern, legacy] = page.main.children;
  assert.equal(modern.dataset.sectionGrid, '4');
  assert.equal(modern.dataset.sectionContainer, 'narrow');
  assert.equal(modern.dataset.sectionTheme, 'dark');
  assert.ok(modern.classList.contains('campaign-special'));
  assert.ok(legacy.classList.contains('dark'));
  assert.ok(legacy.classList.contains('legacy-campaign'));
  assert.equal(legacy.hasAttribute('data-section-layout'), false);
});

test('explicit schemes override legacy scheme classes and background defaults', async () => {
  const page = await harness(`<div class="dark">${content}${metadata(row('Background', 'inverse'), row('Color Scheme', 'light'))}</div>`);
  page.decorate();
  const section = page.main.firstElementChild;
  assert.equal(section.classList.contains('dark'), false);
  assert.equal(section.dataset.sectionTheme, 'light');
  assert.equal(section.style.backgroundColor, 'var(--color-surface-inverse)');
});

test('surface tokens choose matching schemes and custom tokens and CSS backgrounds are retained', async () => {
  const values = ['highlight', 'inverse', '--color-surface-subtle', '#123456', 'linear-gradient(90deg, #121213, #5627d8)'];
  const page = await harness(values.map((value) => `<div>${content}${metadata(row('Background', value))}</div>`).join(''));
  page.decorate();
  const [highlight, inverse, custom, color, gradient] = page.main.children;
  assert.equal(highlight.style.backgroundColor, 'var(--color-surface-highlight)');
  assert.equal(highlight.dataset.sectionTheme, 'light');
  assert.equal(inverse.dataset.sectionTheme, 'dark');
  assert.equal(custom.style.backgroundColor, 'var(--color-surface-subtle)');
  assert.equal(color.style.backgroundColor, '#123456');
  assert.equal(gradient.style.backgroundImage, values[4]);
});

test('decorative backgrounds preserve picture sources, load priority and content order', async () => {
  const image = '<picture><source media="(min-width: 768px)" srcset="/wide.webp"><img src="/image.jpg" alt="Decorative scenery"></picture>';
  const page = await harness(`<div>${content}${metadata(row('Background Image', image), row('Color Scheme', 'dark'))}</div><div>${content}${metadata(row('Background', image))}</div>`);
  page.decorate();
  page.blocks();
  const [first, second] = page.main.children;
  const picture = first.querySelector(':scope > picture.section-background');
  assert.equal(picture.getAttribute('aria-hidden'), 'true');
  assert.equal(picture.querySelector('source').getAttribute('srcset'), '/wide.webp');
  assert.equal(picture.querySelector('img').getAttribute('src'), '/image.jpg');
  assert.equal(picture.querySelector('img').alt, '');
  assert.equal(picture.querySelector('img').loading, 'eager');
  assert.equal(second.querySelector('img').loading, 'lazy');
  assert.equal(first.querySelectorAll('.block').length, 0);
  assert.equal(first.querySelector('.default-content-wrapper h2').id, 'authored-heading');
  const before = page.main.innerHTML;
  page.decorate();
  assert.equal(page.main.innerHTML, before);
});

test('missing and extra metadata cells and unknown options never become visible content', async () => {
  const page = await harness(`<div>${content}${metadata(row('Grid'), row('Grid', '2', ''), row('Container', 'unrecognized'), row('Gap', 'huge'), row('Spacing', '-4px'), row('Theme', 'invalid'), row('Background', 'invalid css'), row('Unknown', 'value'))}</div>`);
  page.decorate();
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionGrid, '2');
  assert.equal(section.dataset.sectionContainer, undefined);
  assert.equal(section.dataset.sectionGap, undefined);
  assert.equal(section.dataset.sectionSpacing, undefined);
  assert.equal(section.dataset.sectionTheme, undefined);
  assert.equal(section.dataset.sectionBackground, undefined);
  assert.equal(section.textContent.includes('invalid'), false);
  await Promise.all(['0', '7', '2.5'].map(async (grid) => {
    const invalid = await harness(`<div>${content}${metadata(row('Grid', grid))}</div>`);
    invalid.decorate();
    assert.equal(invalid.main.firstElementChild.dataset.sectionGrid, undefined);
  }));
});

test('authored empty sections and deep-link targets survive section boundary cleanup', async () => {
  const page = await harness(`<div>${metadata(row('Background', 'highlight'), row('Spacing', 'xxl'))}</div><div>${metadata(row('Anchor', 'deep-link'))}</div><div></div>`);
  page.decorate();
  page.boundaries();
  assert.equal(page.main.children.length, 2);
  assert.equal(page.main.firstElementChild.dataset.sectionSpacing, 'xxl');
  assert.equal(page.main.lastElementChild.id, 'deep-link');
});

test('the real page pipeline applies section options before blocks are initialized', async () => {
  const page = await harness('');
  page.main.innerHTML = `<div>${content}${card}${metadata(row('Grid', '2'), row('Container', 'full'), row('Spacing', 'none'))}</div>`;
  const scripts = await page.pipeline();
  scripts.decorateMain(page.main);
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionContainer, 'full');
  assert.equal(section.dataset.sectionSpacing, 'none');
  assert.equal(section.querySelector('.cards').dataset.blockName, 'cards');
  assert.equal(section.querySelector('[data-block-name="section-metadata"]'), null);
  assert.equal(section.querySelectorAll(':scope > .cards-wrapper').length, 1);
});

test('the real page pipeline applies metadata already consumed by delivery', async () => {
  const page = await harness('');
  page.main.innerHTML = `<div data-grid="3" data-container="narrow" data-spacing="l" data-color-scheme="dark">${content}${card}${card}${card}</div>`;
  const scripts = await page.pipeline();
  scripts.decorateMain(page.main);
  const section = page.main.firstElementChild;
  assert.equal(section.dataset.sectionGrid, '3');
  assert.equal(section.dataset.sectionContainer, 'narrow');
  assert.equal(section.dataset.sectionSpacing, 'l');
  assert.equal(section.dataset.sectionTheme, 'dark');
  assert.equal(section.querySelectorAll(':scope > .cards-wrapper > .cards.block').length, 3);
});
