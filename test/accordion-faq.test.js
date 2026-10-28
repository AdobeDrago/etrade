/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;

async function render(rows, variant = '', adjacent = '', sectionAttributes = '', theme = '', respond = undefined, beforeRates = undefined) {
  const { document, window } = parseHTML(`<html><body><main><div class="section" ${sectionAttributes}>${adjacent}<div class="accordion-faq-wrapper"><div class="accordion-faq ${variant}">${rows}</div></div></div></main></body></html>`);
  window.location = new URL('http://localhost:3000/review');
  if (theme) document.documentElement.dataset.pageTheme = theme;
  const requests = [];
  const context = vm.createContext({
    document,
    window,
    Node: window.Node,
    MutationObserver: window.MutationObserver,
    NodeFilter: { SHOW_TEXT: 4 },
    CustomEvent: window.CustomEvent,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url) => {
      requests.push(url);
      if (!respond) throw new Error('Unexpected rate request');
      return respond();
    },
  });
  const modules = new Map();
  async function moduleFor(url) {
    if (modules.has(url.href)) return modules.get(url.href);
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
    modules.set(url.href, module);
    await module.link((specifier, source) => moduleFor(new URL(specifier, source.identifier)));
    return module;
  }
  const module = await moduleFor(new URL('../blocks/accordion-faq/accordion-faq.js', import.meta.url));
  await module.evaluate();
  const block = document.querySelector('.accordion-faq');
  const ready = module.namespace.default(block);
  beforeRates?.({ block, document });
  await ready;
  return {
    block, document, requests, decorate: module.namespace.default,
  };
}

const fees = '<table><thead><tr><th scope="col">Pricing</th><th scope="col">0–29 trades</th><th scope="col">30+ trades</th></tr></thead><tbody><tr><th scope="row">Options contract</th><td>$0.65</td><td>$0.50</td></tr><tr><th scope="row">Dime buyback</th><td colspan="2">$0 contract fee</td></tr></tbody></table><p>Read <a href="/terms?track=1">terms</a>.<sup>b</sup></p>';

test('Rate settings remains ordinary text in question and primary answer cells', async () => {
  const answer = '<p>Rate settings</p><p>Keep <strong>approved terms</strong> and <a href="/terms">details</a>.<sup>c</sup></p>';
  const { block, requests } = await render(row('Rate settings', '<p>Authors can change account settings.</p>')
    + row('How are rates configured?', answer));
  assert.equal(block.querySelectorAll('.accordion-faq-item').length, 2);
  const [first, second] = [...block.querySelectorAll('.accordion-faq-item')];
  assert.equal(first.querySelector('button').textContent, 'Rate settings');
  assert.equal(first.querySelector('.accordion-faq-item-content').textContent, 'Authors can change account settings.');
  assert.equal(second.querySelector('.accordion-faq-item-content').innerHTML, answer);
  assert.equal(block.hidden, false);
  assert.equal(requests.length, 0);
});

test('FAQ rates bind only answers while settings cells after the primary answer are consumed', async () => {
  const { block } = await render(row(
    'Explain {{rate}} notation',
    '<p>Rate settings</p><p>Current rate: <strong>{{rate}}% APY</strong></p>',
    '<p>Extra answer.</p>',
    '<p>Rate settings</p><p>Mode: manual</p><p>Override: 0</p>',
  ));
  assert.equal(block.querySelector('button.accordion-faq-item-label').textContent, 'Explain {{rate}} notation');
  assert.equal(block.querySelector('.accordion-faq-item-content > p').textContent, 'Rate settings');
  assert.equal(block.querySelector('strong [data-rate-name]').textContent, '0.00');
  assert.match(block.textContent, /Extra answer/);
  assert.doesNotMatch(block.textContent, /Mode: manual|Override:/);
});

test('unconfigured FAQ rate markers show an accessible unavailable state without a request', async () => {
  const { block, requests } = await render(row('Savings', '<p>Current rate: <strong>{{rate}}% APY</strong><sup>c</sup></p><p>See <a href="/rates">rates</a>.</p>'));
  const marker = block.querySelector('[data-rate-name="rate"]');
  assert.equal(marker.textContent, '—');
  assert.equal(marker.getAttribute('aria-label'), 'Rate currently unavailable');
  assert.equal(marker.dataset.rateError, 'invalid-settings');
  assert.equal(block.querySelector('sup').textContent, 'c');
  assert.equal(block.querySelector('a').getAttribute('href'), '/rates');
  assert.equal(requests.length, 0);
  assert.doesNotMatch(block.textContent, /\{\{rate\}\}/);
});

test('FAQ rate settings are consumed and manual zero rates retain rich answer content', async () => {
  const { block, requests } = await render(row('Savings', '<p><strong>{{rate}}% APY</strong></p>', '<p>Rate settings</p><p>Mode: manual</p><p>Override: 0</p>', '<p>Extra answer.</p>'));
  assert.equal(block.querySelector('strong [data-rate-name]').textContent, '0.00');
  assert.doesNotMatch(block.textContent, /Rate settings|Override:/);
  assert.match(block.textContent, /Extra answer/);
  assert.equal(requests.length, 0);
});

test('asynchronous API results update markers in the rendered FAQ answers', async () => {
  const sample = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url), 'utf8'));
  const { block, requests } = await render(row('Savings', '<p>{{rate}}% APY<sup>c</sup></p>', '<p>Rate settings</p><p>Mode: api</p><p>Product: 3100</p><p>Field: advertisedAPY</p><p>Balance: 0</p>'), '', '', '', '', async () => ({ ok: true, json: async () => sample }));
  const marker = block.querySelector('[data-rate-name]');
  assert.equal(marker.textContent, '3.75');
  assert.equal(marker.dataset.rateSource, 'api');
  assert.equal(block.querySelector('sup').textContent, 'c');
  assert.equal(requests.length, 1);
});

test('a delayed FAQ rate updates the same marker without resetting an open answer', async () => {
  const sample = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url), 'utf8'));
  let release;
  let originalMarker;
  const response = new Promise((resolve) => { release = resolve; });
  const { block } = await render(
    row(
      'Savings',
      '<p>{{rate}}% APY<sup>c</sup></p>',
      '<p>Rate settings</p><p>Mode: api</p><p>Product: 3100</p><p>Field: advertisedAPY</p><p>Balance: 0</p>',
    ),
    '',
    '',
    '',
    '',
    () => response,
    ({ block: rendered }) => {
      originalMarker = rendered.querySelector('[data-rate-name]');
      assert.equal(originalMarker.dataset.rateSource, 'loading');
      rendered.querySelector('.accordion-faq-item-label').click();
      release({ ok: true, json: async () => sample });
    },
  );
  assert.equal(block.querySelector('[data-rate-name]'), originalMarker);
  assert.equal(originalMarker.textContent, '3.75');
  assert.equal(block.querySelector('.accordion-faq-item-label').getAttribute('aria-expanded'), 'true');
  assert.equal(block.querySelector('.accordion-faq-item-body').inert, false);
});

test('a failed FAQ rate request retains its authored fallback and working answer controls', async () => {
  const { block, requests } = await render(
    row(
      'Savings',
      '<p>{{rate}}% APY</p>',
      '<p>Rate settings</p><p>Mode: api</p><p>Product: 3100</p><p>Field: advertisedAPY</p><p>Balance: 0</p><p>Fallback: -.--</p>',
    ),
    '',
    '',
    '',
    '',
    async () => ({ ok: false, status: 503 }),
  );
  const marker = block.querySelector('[data-rate-name]');
  assert.equal(marker.textContent, '-.--');
  assert.equal(marker.dataset.rateError, 'http-status');
  assert.equal(marker.getAttribute('aria-label'), 'Rate currently unavailable');
  assert.equal(requests.length, 1);
  block.querySelector('.accordion-faq-item-label').click();
  assert.equal(block.querySelector('.accordion-faq-item-body').inert, false);
});

['flat', 'pricing'].forEach((variant) => {
  test(`${variant} answers preserve semantic headers, merged cells, disclosures and extra answer cells`, async () => {
    const { block } = await render(row('Stock and options trades', fees, '<p>Additional fee explanation.</p>'), variant);
    assert.ok(block.classList.contains('flat'));
    assert.ok(block.querySelector('.accordion-faq-icon-vertical'));
    assert.equal(block.querySelectorAll('table').length, 1);
    assert.equal(block.querySelector('thead th').getAttribute('scope'), 'col');
    assert.equal(block.querySelector('tbody th').getAttribute('scope'), 'row');
    assert.equal(block.querySelector('td[colspan]').getAttribute('colspan'), '2');
    assert.equal(block.querySelector('a').getAttribute('href'), '/terms?track=1');
    assert.equal(block.querySelector('sup').textContent, 'b');
    assert.match(block.textContent, /Additional fee explanation/);
    const region = block.querySelector('.accordion-faq-table');
    assert.equal(region.getAttribute('role'), 'region');
    assert.equal(region.getAttribute('aria-label'), 'Stock and options trades table');
    assert.equal(region.getAttribute('tabindex'), '0');
  });
});

test('opening a category closes other panels and updates all-toggle and accessibility states', async () => {
  const { block } = await render(row('Stock trades', fees) + row('Futures', '<p>Fees</p>'), 'flat');
  const buttons = [...block.querySelectorAll('.accordion-faq-item-label')];
  const panels = [...block.querySelectorAll('.accordion-faq-item-body')];
  const all = block.querySelector('.accordion-faq-expand-all');
  assert.deepEqual(panels.map((p) => p.inert), [true, true]);
  buttons[0].click();
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
  assert.equal(panels[0].inert, false);
  buttons[1].click();
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false');
  assert.equal(panels[0].getAttribute('aria-hidden'), 'true');
  assert.equal(panels[0].inert, true);
  assert.equal(all.textContent, 'Expand all');
  all.click();
  assert.deepEqual(buttons.map((b) => b.getAttribute('aria-expanded')), ['true', 'true']);
  assert.equal(all.textContent, 'Collapse all');
  buttons[0].click();
  assert.equal(all.textContent, 'Expand all');
  all.click();
  all.click();
  assert.deepEqual(panels.map((p) => p.inert), [true, true]);
  assert.equal(all.getAttribute('aria-expanded'), 'false');
});

test('flat variant moves its authored adjacent heading with its deep-link ID and correct label level', async () => {
  const { block } = await render(row('Futures', '<p>Fee</p>'), 'flat', '<div class="default-content-wrapper"><h2 id="detailed-pricing">Detailed pricing</h2></div>');
  assert.equal(block.querySelector('.accordion-faq-heading').id, 'detailed-pricing');
  assert.equal(block.querySelector('.accordion-faq-item-heading').tagName, 'H3');
  const button = block.querySelector('.accordion-faq-item-label');
  const panel = block.querySelector('.accordion-faq-item-body');
  assert.equal(button.getAttribute('aria-controls'), panel.id);
  assert.equal(panel.getAttribute('aria-labelledby'), button.id);
});

test('omitted and empty cells are skipped while multiple native tables survive in an answer', async () => {
  const { block } = await render(row('') + row('No answer') + row('', '<p>Copy</p>') + row('Empty', '') + row('Other fees', fees + fees), 'flat');
  assert.equal(block.querySelectorAll('.accordion-faq-item').length, 1);
  assert.equal(block.querySelectorAll('.accordion-faq-table table').length, 2);
});

test('FAQ preserves heading and introductory copy before the table and moves a standalone action below answers', async () => {
  const { block, document } = await render(row('Question', '<p>Answer.</p>'), '', '<div class="default-content-wrapper"><h2 id="faq-title">FAQs</h2><p><a href="/all?track=1">See all FAQs</a></p></div>');
  assert.equal(block.querySelector('.accordion-faq-heading').id, 'faq-title');
  assert.equal(block.lastElementChild.className, 'accordion-faq-action');
  assert.equal(block.lastElementChild.querySelector('a').getAttribute('href'), '/all?track=1');
  assert.equal(document.querySelector('.default-content-wrapper'), null);
  const intro = await render(row('Question', '<p>Answer.</p>'), 'flat', '<div class="default-content-wrapper"><h2>FAQs</h2><p>Read our <a href="/fees">fee details</a>.</p></div>');
  assert.equal(intro.block.firstElementChild.textContent, 'FAQs');
  assert.equal(intro.block.children[1].textContent, 'Read our fee details.');
  assert.equal(intro.block.querySelector('.accordion-faq-action'), null);
});

test('default FAQ retains its existing chevron and semantic answer tables', async () => {
  const { block } = await render(row('Question', fees));
  assert.equal(block.querySelector('.accordion-faq-icon-vertical'), null);
  assert.equal(block.querySelector('.accordion-faq-item-icon path').getAttribute('d'), 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z');
  assert.equal(block.querySelector('.accordion-faq-table').getAttribute('role'), 'region');
  assert.equal(block.querySelectorAll('table').length, 1);
});

test('page family switches between reference layouts without resetting answers or authored variants', async () => {
  const adjacent = '<div class="default-content-wrapper"><h2 id="accounts-faq">Account FAQs</h2><p><a href="/faqs">See all FAQs</a></p></div>';
  const { block, document } = await render(row('Question', fees), '', adjacent, '', 'charcoal');
  const button = block.querySelector('.accordion-faq-item-label');
  const answer = block.querySelector('.accordion-faq-item-body');
  const link = answer.querySelector('a');
  const action = block.querySelector('.accordion-faq-action');
  button.click();
  assert.equal(block.dataset.faqLayout, 'cards');
  assert.equal(block.lastElementChild, action);
  document.documentElement.dataset.pageTheme = 'purple';
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(block.dataset.faqLayout, 'flat');
  assert.equal(block.classList.contains('flat'), false, 'the authored block variant stays unchanged');
  assert.equal(block.querySelector('.accordion-faq-item-body'), answer);
  assert.equal(answer.querySelector('a'), link);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.ok(block.querySelector('.accordion-faq-icon-vertical'));
  assert.equal(action.nextElementSibling.className, 'accordion-faq-expand-all');
  document.documentElement.dataset.pageTheme = 'charcoal';
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(block.dataset.faqLayout, 'cards');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(block.querySelector('.accordion-faq-icon-vertical'), null);
  assert.equal(block.lastElementChild, action);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('Purple initializes the reference layout and explicit Flat retains precedence in Charcoal', async () => {
  const themed = await render(row('Question', '<p>Answer.</p>'), '', '', '', 'purple');
  assert.equal(themed.block.dataset.faqLayout, 'flat');
  assert.ok(themed.block.querySelector('.accordion-faq-icon-vertical'));
  const explicit = await render(row('Question', '<p>Answer.</p>'), 'flat', '', '', 'purple');
  explicit.document.documentElement.dataset.pageTheme = 'charcoal';
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(explicit.block.dataset.faqLayout, 'flat');
  assert.ok(explicit.block.querySelector('.accordion-faq-icon-vertical'));
});

test('section families override the page presentation while preserving open answers and explicit Flat', async () => {
  const { block, document } = await render(row('Question', fees), '', '', 'data-section-family="purple"', 'charcoal');
  const section = block.closest('.section');
  const button = block.querySelector('.accordion-faq-item-label');
  const answer = block.querySelector('.accordion-faq-item-body');
  assert.equal(block.dataset.faqLayout, 'flat');
  button.click();
  document.documentElement.dataset.pageTheme = 'purple';
  section.dataset.sectionFamily = 'charcoal';
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(block.dataset.faqLayout, 'cards');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(block.querySelector('.accordion-faq-item-body'), answer);
  assert.equal(block.querySelector('.accordion-faq-icon-vertical'), null);
  section.removeAttribute('data-section-family');
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(block.dataset.faqLayout, 'flat', 'removing the override restores the page family');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const explicit = await render(row('Question', fees), 'flat', '', 'data-section-family="charcoal"', 'purple');
  assert.equal(explicit.block.dataset.faqLayout, 'flat');
});

test('grid accordions retain shared section content and use its heading level for every block', async () => {
  const adjacent = '<div class="default-content-wrapper"><h3 id="shared-faq">Shared heading</h3><p>Shared introduction with <a href="/details?track=1">details</a>.</p></div>';
  const { block, document, decorate } = await render(row('First question', '<p>Answer.</p>'), '', adjacent, 'data-section-layout="authored" data-section-grid="2"');
  const second = document.createElement('div');
  second.className = 'accordion-faq-wrapper';
  second.innerHTML = `<div class="accordion-faq flat">${row('Second question', fees)}</div>`;
  block.parentElement.after(second);
  const action = document.createElement('div');
  action.className = 'default-content-wrapper';
  action.innerHTML = '<p><a href="/all?track=2">See all FAQs</a></p>';
  second.after(action);
  decorate(second.firstElementChild);
  assert.equal(document.querySelector('.default-content-wrapper > h3').id, 'shared-faq');
  assert.equal(block.querySelector('.accordion-faq-heading'), null);
  assert.equal(second.querySelector('.accordion-faq-heading'), null);
  assert.equal(block.querySelector('.accordion-faq-item-heading').tagName, 'H4');
  assert.equal(second.querySelector('.accordion-faq-item-heading').tagName, 'H4');
  assert.equal(document.querySelectorAll('.default-content-wrapper a').length, 2);
  assert.equal(action.querySelector('a').getAttribute('href'), '/all?track=2');
  assert.equal(second.querySelector('.accordion-faq-table table th').getAttribute('scope'), 'col');
  second.querySelector('.accordion-faq-item-label').click();
  assert.equal(second.querySelector('.accordion-faq-item-label').getAttribute('aria-expanded'), 'true');
  assert.equal(block.querySelector('.accordion-faq-item-label').getAttribute('aria-expanded'), 'false');
});
