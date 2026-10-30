/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness({
  theme = '', metadata = '', storage = new Map(), url,
  brief = `<h1>Hero Dark block brief</h1><p>Authoring notes.</p>
    <h2>Table structure</h2><p>Use two columns.</p>
    <h2>Authoring properties</h2><ul><li data-prose-index="4">Heading: use a real heading.</li></ul>
    <h2>Supported options</h2><p>Split and balanced.</p>
    <h2>Authoring notes</h2><p>Keep each CTA in its own paragraph.</p>
    <h2>Examples</h2><p>Choose a starting point below.</p>`,
} = {}) {
  const { document, window } = parseHTML(`<html><body><header></header><main>
    <div>${brief}</div>
    <div><h2>Split hero</h2><div class="hero-dark split"><div><div>Heading</div><div><h2>Campaign</h2></div></div></div>
    <div class="library-metadata"><div><div>description</div><div>Split layout.</div></div></div></div>
    ${metadata}</main><footer></footer></body></html>`);
  if (theme) document.documentElement.dataset.pageTheme = theme;
  window.location = new URL(url || 'https://demo--etrade--adobedrago.preview.da.live/library/blocks/hero-dark');
  window.sessionStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const context = vm.createContext({ document, window });
  const module = new vm.SourceTextModule(await readFile(new URL('../scripts/library-preview.js', import.meta.url), 'utf8'), { context });
  await module.link(() => new vm.SyntheticModule(['getPageTheme'], function define() {
    this.setExport('getPageTheme', (value = '') => String(value).split(',')
      .map((part) => part.trim().toLowerCase().replace(/^theme-/, ''))
      .find((part) => ['purple', 'charcoal'].includes(part)) || '');
  }, { context }));
  await module.evaluate();
  return {
    document, window, storage, preview: module.namespace,
  };
}

test('theme controls are limited to individual library pages on preview hosts', async () => {
  const { preview } = await harness();
  [
    'http://localhost:3000/library/blocks/hero-dark',
    'https://demo--etrade--adobedrago.aem.page/library/blocks/cards-article',
    'https://main--etrade--adobedrago.preview.da.live/library/blocks/columns',
  ].forEach((url) => assert.equal(preview.isLibraryPreview(new URL(url)), true, url));
  [
    'https://demo--etrade--adobedrago.aem.live/library/blocks/hero-dark',
    'https://us.etrade.com/library/blocks/hero-dark',
    'https://example.aem.page.evil.test/library/blocks/hero-dark',
    'https://demo--etrade--adobedrago.aem.page/home',
    'https://demo--etrade--adobedrago.aem.page/library/blocks',
    'https://demo--etrade--adobedrago.aem.page/library/blocks/nested/hero-dark',
  ].forEach((url) => assert.equal(preview.isLibraryPreview(new URL(url)), false, url));
});

test('mounting keeps controls outside main and preserves the insertable example', async () => {
  const page = await harness({ metadata: '<div><div class="metadata"><div><div>Theme</div><div>Purple</div></div></div></div>' });
  const block = page.document.querySelector('.hero-dark').outerHTML;
  assert.equal(page.preview.default(), true);
  assert.equal(page.document.querySelector('.hero-dark').outerHTML, block);
  assert.equal(page.document.querySelector('main .library-preview'), null);
  assert.equal(page.document.querySelector('main h1').textContent, 'Hero Dark block brief');
  assert.equal(page.document.querySelector('.library-metadata, .metadata'), null);
  assert.equal(page.document.documentElement.dataset.pageTheme, 'purple');
  assert.equal(page.preview.default(), false);
  assert.equal(page.document.querySelectorAll('.library-preview').length, 1);
});

test('theme preview leaves authored brief markup untouched', async () => {
  const page = await harness();
  const intro = page.document.querySelector('main > div');
  const before = intro.innerHTML;
  page.preview.default();
  assert.equal(intro.innerHTML, before);
});

test('guide metadata renders as a brief while example metadata stays out of the gallery', async () => {
  const html = await readFile(new URL('./fixtures/block-library/library-brief.html', import.meta.url), 'utf8');
  const { document } = parseHTML(html);
  const [header, ...rows] = document.querySelectorAll('table tr');
  assert.equal(header.textContent.trim(), 'Library Metadata (Guide)');
  const raw = rows.map((row) => `<div>${[...row.children].map((cell) => `<div>${cell.innerHTML}</div>`).join('')}</div>`).join('');
  const page = await harness({
    brief: `<h1>Hero Dark</h1><p>Introduction.</p>
      <div class="library-metadata guide" data-aue-resource="guide">${raw}</div><h2>Examples</h2>`,
  });
  const guide = page.document.querySelector('.library-metadata.guide');
  const notes = guide.querySelector('ul');
  const example = page.document.querySelector('.hero-dark').outerHTML;
  page.preview.default();
  assert.equal(page.document.querySelector('.library-brief'), guide);
  assert.equal(guide.className, 'library-brief');
  assert.equal(guide.dataset.aueResource, 'guide');
  assert.equal(guide.querySelector('ul'), notes);
  assert.equal(guide.previousElementSibling.textContent, 'Introduction.');
  assert.equal(guide.nextElementSibling.textContent, 'Examples');
  assert.equal(page.document.querySelector('.library-metadata'), null);
  assert.equal(page.document.querySelector('.hero-dark').outerHTML, example);

  const renderer = new vm.SourceTextModule(await readFile(new URL('../blocks/library-brief/library-brief.js', import.meta.url), 'utf8'));
  await renderer.link(() => { throw new Error('Unexpected import'); });
  await renderer.evaluate();
  renderer.namespace.default(guide);
  assert.equal(guide.querySelector('.library-brief-title').textContent, 'Authoring guide');
  assert.equal(guide.querySelector('details').hasAttribute('open'), false);
  assert.equal(guide.querySelectorAll('.library-brief-section').length, 4);
  assert.equal(guide.querySelector('ul'), notes);
  page.document.querySelector('[data-theme="purple"]').click();
  assert.equal(guide.querySelector('ul'), notes);
});

test('switching themes changes preview state, retains block options, and persists across library pages', async () => {
  const page = await harness({ theme: 'charcoal' });
  page.preview.default();
  page.document.querySelector('[data-theme="purple"]').click();
  assert.equal(page.document.documentElement.dataset.pageTheme, 'purple');
  assert.equal(page.document.querySelector('[data-theme="purple"]').getAttribute('aria-pressed'), 'true');
  assert.equal(page.document.querySelector('[data-theme="charcoal"]').getAttribute('aria-pressed'), 'false');
  assert.equal(page.document.querySelector('.hero-dark').className, 'hero-dark split');
  const next = await harness({ theme: 'charcoal', storage: page.storage });
  next.preview.default();
  assert.equal(next.document.documentElement.dataset.pageTheme, 'purple');
  next.document.querySelector('.library-preview-reset').click();
  assert.equal(next.document.documentElement.dataset.pageTheme, 'charcoal');
  assert.equal(next.storage.size, 0);
});

test('floating controls start collapsed, keep theme selections open, and close with Escape', async () => {
  const page = await harness();
  page.preview.default();
  const toggle = page.document.querySelector('.library-preview-toggle');
  const tray = page.document.getElementById(toggle.getAttribute('aria-controls'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(tray.hidden, true);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(tray.hidden, false);
  page.document.querySelector('[data-theme="purple"]').click();
  assert.equal(tray.hidden, false);
  let focused = false;
  toggle.focus = () => { focused = true; };
  const escape = new page.window.Event('keydown', { bubbles: true, cancelable: true });
  escape.key = 'Escape';
  page.document.querySelector('[data-theme="purple"]').dispatchEvent(escape);
  assert.equal(tray.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(focused, true);
  assert.equal(page.document.documentElement.dataset.pageTheme, 'purple');
  toggle.click();
  toggle.click();
  assert.equal(tray.hidden, true);
});

test('resetting an unthemed page restores its original mixed treatment', async () => {
  const page = await harness();
  page.preview.default();
  page.document.querySelector('[data-theme="purple"]').click();
  page.document.querySelector('.library-preview-reset').click();
  assert.equal(page.document.documentElement.hasAttribute('data-page-theme'), false);
  assert.match(page.document.querySelector('[role="status"]').textContent, /no page family selected/);
});

test('unavailable storage does not prevent theme switching', async () => {
  const storage = {
    get() { throw new Error('Storage blocked'); },
    set() { throw new Error('Storage blocked'); },
    delete() { throw new Error('Storage blocked'); },
  };
  const page = await harness({ storage });
  page.preview.default();
  page.document.querySelector('[data-theme="charcoal"]').click();
  assert.equal(page.document.documentElement.dataset.pageTheme, 'charcoal');
  page.document.querySelector('.library-preview-reset').click();
  assert.equal(page.document.documentElement.hasAttribute('data-page-theme'), false);
});

test('live pages retain their theme, metadata and markup', async () => {
  const page = await harness({
    theme: 'purple',
    url: 'https://us.etrade.com/library/blocks/hero-dark',
    brief: '<div class="library-metadata guide"><div><div>Title</div><div>Authoring guide</div></div></div>',
  });
  const html = page.document.documentElement.outerHTML;
  assert.equal(page.preview.default(), false);
  assert.equal(page.document.documentElement.outerHTML, html);
});
