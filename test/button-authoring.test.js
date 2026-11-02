/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function render(markup) {
  const { document, window } = parseHTML(`<html data-block-review><head></head><body><main><div>${markup}</div></main></body></html>`);
  window.location = new URL('https://demo--etrade--adobedrago.aem.page/review');
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
  const scripts = await moduleFor(new URL('../scripts/scripts.js', import.meta.url));
  await scripts.evaluate();
  const main = document.querySelector('main');
  scripts.namespace.decorateMain(main);
  const actions = await moduleFor(new URL('../scripts/actions.js', import.meta.url));
  await actions.evaluate();
  return {
    main,
    decorate: () => scripts.namespace.decorateMain(main),
    group: () => actions.namespace.groupActions(main.querySelector('.default-content-wrapper'), 'homepage'),
  };
}

const link = '<a href="/home">Open account</a>';
const cases = [
  ['bold before link', `<strong>${link}</strong>`, 'primary'],
  ['bold after link', '<a href="/home"><strong>Open account</strong></a>', 'primary'],
  ['italic before link', `<em>${link}</em>`, 'secondary'],
  ['italic after link', '<a href="/home"><em>Open account</em></a>', 'secondary'],
  ['both before link', `<strong><em>${link}</em></strong>`, 'accent'],
  ['both after link', '<a href="/home"><strong><em>Open account</em></strong></a>', 'accent'],
  ['bold outside and italic inside', '<strong><a href="/home"><em>Open account</em></a></strong>', 'accent'],
  ['italic outside and bold inside', '<em><a href="/home"><strong>Open account</strong></a></em>', 'accent'],
  ['pasted b and i tags', '<a href="/home"><b><i>Open account</i></b></a>', 'accent'],
  ['split formatting spans', '<a href="/home"><strong>Open</strong> <strong>account</strong></a>', 'primary'],
];

cases.forEach(([name, markup, kind]) => {
  test(`standalone ${name} creates a ${kind} button`, async () => {
    const page = await render(`<p>${markup}</p>`);
    const button = page.main.querySelector('a');
    assert.ok(button.classList.contains('button'));
    assert.ok(button.classList.contains(kind));
    assert.equal(button.textContent, 'Open account');
    assert.equal(button.getAttribute('href'), '/home');
    assert.equal(page.main.querySelector('strong, b, em, i'), null);
    assert.ok(button.closest('p').classList.contains('button-wrapper'));
  });
});

test('inline, partially formatted, image, empty, URL-display and multiple links stay links', async () => {
  const markup = [
    `<p>Read <strong>${link}</strong> for details.</p>`,
    '<p><a href="/home"><strong>Open</strong> account</a></p>',
    '<p><strong><a href="/home"><img src="/image.png" alt="Open account"></a></strong></p>',
    '<p><strong><a href="/home"> </a></strong></p>',
    '<p><strong><a href="https://example.com/">https://example.com/</a></strong></p>',
    `<p><strong>${link}${link}</strong></p>`,
  ].join('');
  const page = await render(markup);
  assert.equal(page.main.querySelectorAll('a.button').length, 0);
  assert.equal(page.main.querySelectorAll('a').length, 7);
  assert.equal(page.main.querySelector('img').getAttribute('alt'), 'Open account');
  assert.equal(page.main.querySelector('p').textContent, 'Read Open account for details.');
});

test('button decoration preserves authored attributes, classes and unrelated empty elements', async () => {
  const page = await render('<p class="campaign"><span id="anchor"></span><strong><a class="conversion" id="cta" title="Apply now" aria-label="Open a brokerage account" href="/home?campaign=spring&amp;@tracking=home-cta#apply" target="_blank" rel="noopener">Open account</a></strong></p>');
  const button = page.main.querySelector('#cta');
  assert.ok(button.classList.contains('conversion'));
  assert.ok(button.closest('p').classList.contains('campaign'));
  assert.equal(button.title, 'Apply now');
  assert.equal(button.getAttribute('aria-label'), 'Open a brokerage account');
  assert.equal(button.getAttribute('href'), '/home?campaign=spring#apply');
  assert.equal(button.dataset.trackingKey, 'home-cta');
  assert.equal(button.target, '_blank');
  assert.equal(button.rel, 'noopener');
  assert.ok(page.main.querySelector('#anchor'));
  const before = button.closest('p').outerHTML;
  page.decorate();
  assert.equal(button.closest('p').outerHTML, before);
});

test('homepage action grouping retains authored filled and outlined buttons in either order', async () => {
  const page = await render('<p><a href="/first"><em>First outlined</em></a></p><p><strong><a href="/second">Second filled</a></strong></p><p><a href="/third">Default action</a></p>');
  page.group();
  const links = [...page.main.querySelectorAll('a')];
  assert.ok(links[0].classList.contains('etrade-action-outline'));
  assert.ok(links[1].classList.contains('etrade-action-primary'));
  assert.ok(links[2].classList.contains('etrade-action-secondary'));
  assert.equal(links[0].querySelector('.etrade-action-icon'), null);
  assert.ok(links[2].querySelector('.etrade-action-icon'));
});
