/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function render(name, rows, variants = '', firstSection = true, preceding = '') {
  const { document, window } = parseHTML(`<html><body><main><div class="section">${preceding}<div class="${name}-wrapper"><div class="${name} ${variants}">${rows}</div></div></div></main></body></html>`);
  if (!firstSection) {
    const previous = document.createElement('div');
    previous.className = 'section';
    document.querySelector('main').prepend(previous);
  }
  const context = vm.createContext({ document, window });
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
  module.namespace.default(block);
  return block;
}

const row = (key, value, extra = '') => `<div><div>${key}</div><div>${value}</div>${extra}</div>`;
const image = '<picture><source srcset="/hero.webp 2x"><img src="/hero.jpg" alt="Authored media" width="680" height="420" loading="lazy"></picture>';

test('default homepage keeps headline/copy/media order, inline links, tracking and captions', async () => {
  const block = await render('hero-dark', `<div><div>${image}<p>Illustrative image</p></div></div><div><div><h1 id="campaign">A <em>campaign</em></h1><p>Read our <a href="/research">research</a>.</p><p><a href="/open?icid=campaign">Open an account</a></p><p><a href="/more">Learn more arrow_forward</a></p></div></div>`);
  assert.deepEqual([...block.children].map((node) => node.className), ['hero-dark-heading', 'hero-dark-copy', 'hero-dark-media']);
  assert.equal(block.querySelector('h1').id, 'campaign');
  assert.equal(block.querySelector('.hero-dark-copy > p a').getAttribute('href'), '/research');
  assert.equal(block.querySelector('.hero-dark-primary').getAttribute('href'), '/open?icid=campaign');
  assert.equal(block.querySelector('.hero-dark-secondary').textContent, 'Learn more');
  assert.equal(block.querySelector('.hero-dark-media p').textContent, 'Illustrative image');
  assert.equal(block.querySelector('source').getAttribute('srcset'), '/hero.webp 2x');
  assert.equal(block.querySelector('img').getAttribute('fetchpriority'), 'high');
});

test('split named rows keep eyebrow semantics, rich heading and offer separate from primary actions', async () => {
  const block = await render('hero-dark', [
    row('Image', image), row('Eyebrow', '<h1 id="account">Brokerage account</h1>'),
    row('Heading', '<h2 id="investing">Investing <em>made easy</em></h2>'),
    row('Content', '<p>Copy with <a href="/details">inline details</a>.</p><p><a href="/open?icid=hero">Open an account</a></p>'),
    row('Offer', '<h3>Get <s>$1,000</s> $1,500<sup>1</sup></h3><p>Terms apply. <a href="/terms">Offer details</a>.</p><p><a href="/offer">Learn how arrow_forward</a></p>'),
  ].join(''), 'split inset');
  assert.deepEqual([...block.children].map((node) => node.className), ['hero-dark-content', 'hero-dark-media']);
  assert.equal(block.querySelector('.hero-dark-eyebrow h1').id, 'account');
  assert.equal(block.querySelector('.hero-dark-heading').id, 'investing');
  assert.ok(block.querySelector('.hero-dark-heading em'));
  assert.equal(block.querySelectorAll('.hero-dark-primary').length, 1);
  assert.ok(block.querySelector('.hero-dark-copy > p a[href="/details"]'));
  assert.ok(block.querySelector('.hero-dark-offer p a[href="/terms"]'));
  assert.ok(block.querySelector('.hero-dark-offer s'));
  assert.ok(block.querySelector('.hero-dark-offer sup'));
  assert.equal(block.querySelector('.hero-dark-offer-actions a').getAttribute('href'), '/offer');
  assert.equal(block.querySelector('.hero-dark-offer-actions a').textContent, 'Learn how');
});

test('split combines extra cells and repeated rows without depending on row order', async () => {
  const block = await render('hero-dark', [
    row('Content', '<p>First paragraph.</p>', '<div><p>Second paragraph.</p></div>'),
    row('Heading', '<h1>Main title</h1>'), row('Content', '<p>Third paragraph.</p>'),
  ].join(''), 'split');
  assert.deepEqual([...block.querySelectorAll('.hero-dark-copy p')].map((p) => p.textContent), ['First paragraph.', 'Second paragraph.', 'Third paragraph.']);
  assert.equal(block.querySelector('.hero-dark-heading').tagName, 'H1');
  assert.ok(block.classList.contains('no-image'));
});

test('split accepts imported H1/H2 and image/copy cells without losing their IDs', async () => {
  const block = await render('hero-dark', `<div><div><h1 id="product">Product name</h1><h2 id="headline">Main headline</h2><p>Supporting copy.</p><p><a href="/open">Open</a></p><p>${image}</p></div></div>`, 'split');
  assert.equal(block.querySelector('.hero-dark-eyebrow h1').id, 'product');
  assert.equal(block.querySelector('.hero-dark-heading').id, 'headline');
  assert.equal(block.querySelectorAll('.hero-dark-media img').length, 1);
  assert.equal(block.querySelectorAll('.hero-dark-copy > p').length, 1);
});

test('empty, image-only, missing-heading and partial-offer split heroes remain usable', async () => {
  const empty = await render('hero-dark', '<div></div><div><div>Image</div><div> </div></div>', 'split');
  assert.equal(empty.children.length, 0);
  const imageOnly = await render('hero-dark', row('Image', image), 'split');
  assert.ok(imageOnly.classList.contains('no-content'));
  assert.ok(imageOnly.querySelector('img'));
  const partial = await render('hero-dark', row('Content', '<p>Copy without a heading.</p>') + row('Offer', '<p><a href="/offer">Offer details</a></p>'), 'split');
  assert.ok(partial.classList.contains('no-heading'));
  assert.ok(partial.querySelector('.hero-dark-copy p'));
  assert.ok(partial.querySelector('.hero-dark-offer-actions a'));
});

test('later split images keep their lazy loading behavior', async () => {
  const rows = row('Heading', '<h1>Title</h1>') + row('Image', image);
  const block = await render('hero-dark', rows, 'split', false);
  assert.equal(block.querySelector('img').getAttribute('loading'), 'lazy');
  assert.equal(block.querySelector('img').getAttribute('fetchpriority'), null);
});

test('light intro groups only standalone links and keeps rich copy and tracking', async () => {
  const block = await render('hero-light', '<div><div><h1 id="accounts">Our Accounts</h1><p>Copy with <a href="/research">inline research</a> and <sup>1</sup>.</p></div><div><p><a href="/pricing?icid=accounts">See all pricing</a></p><p><a href="/more">Learn more arrow_forward</a></p></div></div>');
  assert.equal(block.querySelector('h1').id, 'accounts');
  assert.ok(block.querySelector('.hero-light-content > p a[href="/research"]'));
  assert.ok(block.querySelector('.hero-light-content > p sup'));
  assert.equal(block.querySelector('.hero-light-outline').getAttribute('href'), '/pricing?icid=accounts');
  assert.equal(block.querySelector('.hero-light-secondary').textContent, 'Learn more');
});

test('light intro permits empty and CTA-free tables', async () => {
  const empty = await render('hero-light', '<div></div>');
  assert.equal(empty.textContent, '');
  const copyOnly = await render('hero-light', '<div><div><p>Introduction.</p></div></div>');
  assert.equal(copyOnly.textContent, 'Introduction.');
  assert.equal(copyOnly.querySelector('.hero-light-actions'), null);
});

test('light hides only the isolated imported duplicate title, preserving breadcrumb links', async () => {
  const rows = '<div><div><h1>Our Accounts</h1></div></div>';
  const duplicate = await render('hero-light', rows, '', true, '<div class="default-content-wrapper"><p>Our Accounts</p></div>');
  assert.ok(duplicate.parentElement.previousElementSibling.classList.contains('hero-light-breadcrumb'));
  const linked = await render('hero-light', rows, '', true, '<div class="default-content-wrapper"><p><a href="/accounts">Our Accounts</a></p></div>');
  assert.equal(linked.parentElement.previousElementSibling.classList.contains('hero-light-breadcrumb'), false);
});
