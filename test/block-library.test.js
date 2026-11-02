/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function examples(name) {
  const source = await readFile(new URL(`./fixtures/block-library/${name}.html`, import.meta.url), 'utf8');
  const { document } = parseHTML(source);
  return [...document.querySelectorAll('main > div')].map((section) => {
    const table = section.querySelector('table');
    const [header, ...rows] = table.querySelectorAll('tr');
    const authored = header.textContent.trim();
    const [, title, variants = ''] = authored.match(/^(.+?)(?:\s*\(([^)]+)\))?$/);
    assert.equal(title.toLowerCase().replaceAll(' ', '-'), name);
    assert.equal(section.querySelectorAll('table').length, 2, 'example and library description');
    assert.equal(section.querySelector('table:last-child tr:first-child').textContent.trim(), 'Library Metadata');
    return {
      name,
      title: authored,
      variants: variants.toLowerCase().split(',').map((value) => value.trim()).filter(Boolean),
      rows: rows.map((row) => [...row.children].map((cell) => cell.innerHTML)),
    };
  });
}

async function render(example, edit = () => {}) {
  const rows = example.rows.map((cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`).join('');
  const { document, window } = parseHTML(`<html data-block-review><head></head><body><main><div><div class="${example.name} ${example.variants.join(' ')}">${rows}</div></div></main></body></html>`);
  window.location = new URL('https://demo--etrade--adobedrago.aem.page/library-pilot-check');
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
  Object.defineProperty(Object.getPrototypeOf(document.documentElement.classList), '0', {
    configurable: true,
    get() { return [...this][0]; },
  });
  const context = vm.createContext({
    document, window, URL, URLSearchParams, crypto: webcrypto, CustomEvent: window.CustomEvent,
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), {
      context,
      identifier: url.href,
      initializeImportMeta: (meta) => { meta.url = `${window.origin}/scripts/aem.js`; },
    });
    modules.set(url.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  const block = document.querySelector(`.${example.name}`);
  edit(block);
  const tracked = [...block.querySelectorAll('a')].find((a) => a.closest('p').textContent.trim() === a.textContent.trim());
  tracked.setAttribute('href', `${tracked.getAttribute('href')}?campaign=library&@tracking=library-${example.name}#details`);
  const main = document.querySelector('main');
  const scripts = await moduleFor(new URL('../scripts/scripts.js', import.meta.url));
  await scripts.evaluate();
  const layout = await moduleFor(new URL('../scripts/page-layout.js', import.meta.url));
  await layout.evaluate();
  layout.namespace.default();
  scripts.namespace.decorateMain(main);
  const module = await moduleFor(new URL(`../blocks/${example.name}/${example.name}.js`, import.meta.url));
  await module.evaluate();
  await module.namespace.default(block);
  assert.equal(document.body.className, '', 'example uses a fresh path without homepage classes');
  assert.equal(tracked.dataset.trackingKey, `library-${example.name}`);
  assert.equal(tracked.dataset.trackingCategory, 'C0004');
  assert.match(tracked.getAttribute('href'), /\?campaign=library#details$/);
  return block;
}

const heroes = await examples('hero-dark');
const cards = await examples('cards-article');

heroes.forEach((example) => {
  test(`${example.title} library table preserves headings, copy, media and CTA destinations`, async () => {
    const block = await render(example);
    assert.equal(block.querySelector('.hero-dark-heading').textContent, 'A flexible starting point');
    assert.equal(block.querySelectorAll('img').length, 1);
    assert.equal(block.querySelector('img').alt, 'Person reviewing financial plan and investing charts on a desktop monitor');
    assert.equal(block.querySelector('img').getAttribute('fetchpriority'), 'high');
    assert.ok(block.querySelector('.hero-dark-copy > p a[href="/planning"]'), 'inline link remains in copy');
    assert.equal(block.querySelectorAll('.hero-dark-actions a').length, 2);
    assert.equal(block.querySelector('.hero-dark-secondary').getAttribute('href'), '/planning');
  });

  test(`${example.title} library table remains usable after removing its image`, async () => {
    const block = await render(example, (raw) => raw.querySelector('img').remove());
    assert.ok(block.classList.contains('no-image'));
    assert.equal(block.querySelector('.hero-dark-heading').textContent, 'A flexible starting point');
    assert.equal(block.querySelectorAll('.hero-dark-actions a').length, 2);
  });
});

cards.forEach((example) => {
  test(`${example.title} library table creates one complete card per row`, async () => {
    assert.ok(example.rows.every((row) => row.length === 2));
    const block = await render(example);
    assert.equal(block.querySelectorAll(':scope > ul > li').length, 3);
    assert.equal(block.querySelectorAll('.cards-article-heading').length, 3);
    assert.equal(block.querySelectorAll('.cards-article-image img').length, 3);
    assert.equal(block.querySelectorAll('.cards-article-actions a').length, 3);
    assert.ok(block.querySelector('.cards-article-body > p a[href="/planning"]'));
    if (example.variants.includes('promo')) assert.equal(block.querySelectorAll('.cards-article-content').length, 3);
  });

  test(`${example.title} supports adding a card row and removing an optional image cell`, async () => {
    const block = await render(example, (raw) => {
      raw.append(raw.lastElementChild.cloneNode(true));
      raw.firstElementChild.firstElementChild.remove();
    });
    assert.equal(block.querySelectorAll(':scope > ul > li').length, 4);
    assert.equal(block.querySelectorAll('.cards-article-image img').length, 3);
    assert.equal(block.querySelectorAll('.cards-article-heading').length, 4);
    assert.ok(block.classList.contains('four-up'));
  });
});
