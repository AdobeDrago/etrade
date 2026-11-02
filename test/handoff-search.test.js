/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness(mobile = false) {
  const html = await readFile(new URL('../docs/site-handoff.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../docs/site-handoff.js', import.meta.url), 'utf8');
  const { document, window } = parseHTML(html);
  window.matchMedia = () => ({ matches: mobile, addEventListener() {} });
  window.requestAnimationFrame = () => {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem() {}, removeItem() {} },
  });
  window.getComputedStyle = () => ({ getPropertyValue: () => '252px' });
  window.location = new URL('https://example.com/docs/site-handoff.html');
  Object.defineProperty(window.HTMLAnchorElement.prototype, 'hash', {
    configurable: true,
    get() { return new URL(this.getAttribute('href'), window.location).hash; },
  });
  window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 252, height: 72, top: 0 });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    this.setAttribute('data-scrolled', 'true');
  };
  document.querySelectorAll('select').forEach((select) => {
    Object.defineProperty(select, 'value', { writable: true, value: '' });
  });
  const context = vm.createContext({ document, window, URL });
  vm.runInContext(source, context);
  const dialog = document.querySelector('#guide-search-dialog');
  if (dialog) {
    dialog.showModal = () => { dialog.setAttribute('open', ''); };
    dialog.close = () => { dialog.removeAttribute('open'); };
  }
  const change = (selector, value, event = 'input') => {
    const input = document.querySelector(selector);
    assert.ok(input, `${selector} must be available`);
    input.value = value;
    input.dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  const results = () => [...document.querySelectorAll('#guide-search-results a')];
  return {
    document, window, change, results,
  };
}

test('guide search finds content outside the catalog and prioritizes matching headings', async () => {
  const { document, change, results } = await harness();
  assert.ok(document.querySelector('#guide-search-open'), 'header search button must exist');
  change('#guide-search-input', 'new page checklist');
  assert.equal(results()[0].getAttribute('href'), '#new-page-checklist');
  change('#guide-search-input', 'Background Color');
  assert.ok(results().some((link) => /metadata/i.test(link.textContent)));
});

test('whole-guide queries include hidden blocks without changing the catalog filter', async () => {
  const { document, change, results } = await harness();
  change('#block-filter', 'Hero Dark');
  change('#block-family', 'heroes', 'change');
  const hiddenBefore = [...document.querySelectorAll('.block-entry')].map((entry) => entry.hidden);
  const countBefore = document.querySelector('#block-count').textContent;
  change('#guide-search-input', 'Cards Article');
  assert.ok(results().some((link) => link.getAttribute('href') === '#block-cards-article'));
  assert.equal(document.querySelector('#block-filter').value, 'Hero Dark');
  assert.equal(document.querySelector('#block-family').value, 'heroes');
  assert.equal(results()[0].querySelector('strong').textContent, 'Cards Article');
  assert.equal(document.querySelector('#block-count').textContent, countBefore);
  assert.deepEqual([...document.querySelectorAll('.block-entry')].map((entry) => entry.hidden), hiddenBefore);
});

test('opening a hidden block result reveals that block through existing navigation', async () => {
  const {
    document, window, change, results,
  } = await harness();
  change('#block-filter', 'Hero Dark');
  change('#guide-search-input', 'Cards Article');
  document.querySelector('#guide-search-dialog').setAttribute('open', '');
  const link = results().find((result) => result.getAttribute('href') === '#block-cards-article');
  assert.ok(link);
  const click = new window.Event('click', { bubbles: true });
  click.button = 0;
  link.dispatchEvent(click);
  assert.equal(document.querySelector('#block-cards-article').hidden, false);
  assert.equal(document.querySelector('#guide-search-dialog').hasAttribute('open'), false);
  assert.equal(document.querySelector('#block-filter').value, '');
});

test('empty and literal markup queries are handled without injecting content', async () => {
  const { document, change, results } = await harness();
  change('#guide-search-input', ' ');
  assert.equal(results().length, 0);
  assert.match(document.querySelector('#guide-search-status').textContent, /at least 2/i);
  change('#guide-search-input', '<img src=x onerror=alert(1)>');
  assert.equal(results().length, 0);
  assert.match(document.querySelector('#guide-search-status').textContent, /no results/i);
  assert.equal(document.querySelector('#guide-search-dialog img'), null);
});

test('guide search caps broad results and updates when the query changes', async () => {
  const { document, change, results } = await harness();
  change('#guide-search-input', 'content');
  assert.equal(results().length, 20);
  assert.match(document.querySelector('#guide-search-status').textContent, /first 20/i);
  change('#guide-search-input', 'zzzz-no-guide-match');
  assert.equal(results().length, 0);
  assert.match(document.querySelector('#guide-search-status').textContent, /no results/i);
});

test('Escape closes a populated search without the search input consuming it', async () => {
  const { document, window, change } = await harness();
  change('#guide-search-input', 'metadata');
  const dialog = document.querySelector('#guide-search-dialog');
  dialog.setAttribute('open', '');
  const escape = new window.Event('keydown', { bubbles: true, cancelable: true });
  escape.key = 'Escape';
  document.querySelector('#guide-search-input').dispatchEvent(escape);
  assert.equal(dialog.hasAttribute('open'), false);
  assert.equal(escape.defaultPrevented, true);
});

test('opening a search result closes expanded phone navigation', async () => {
  const {
    document, window, change, results,
  } = await harness(true);
  const navigation = document.querySelector('.guide-navigation');
  navigation.open = true;
  change('#guide-search-input', 'new page checklist');
  const click = new window.Event('click', { bubbles: true });
  click.button = 0;
  results()[0].dispatchEvent(click);
  assert.equal(navigation.open, false);
});
