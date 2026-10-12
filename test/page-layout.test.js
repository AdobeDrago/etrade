/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness(path, markup = '') {
  const { document, window } = parseHTML(`<html><body><main>${markup}</main></body></html>`);
  window.location = new URL(`https://demo--etrade--adobedrago.aem.page${path}`);
  window.origin = window.location.origin;
  window.SAMPLE_PAGEVIEWS_AT_RATE = 'off';
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
  const layout = await moduleFor(new URL('../scripts/page-layout.js', import.meta.url));
  const sections = await moduleFor(new URL('../scripts/section-layout.js', import.meta.url));
  await layout.evaluate();
  await sections.evaluate();
  return { document, layout: layout.namespace, sections: sections.namespace.default };
}

test('demo navigation preserves tracking and anchors while application and external links stay authored', async () => {
  const { document, layout } = await harness('/home', `
    <a href="https://us.etrade.com/what-we-offer/our-accounts/brokerage-account.html?icid=home#fees">Brokerage</a>
    <a href="https://express.etrade.com/etx/rtao/ma/account-types/brokerage">Apply</a>
    <a href="https://us.etrade.com/what-we-offer/pricing-and-rates">Pricing</a>
    <a href="https://us.etrade.com.example.com/planning">External</a>
    <a href="mailto:hello@example.com">Email</a>
    <a href="http://[">Malformed</a>`);
  layout.default();
  layout.localizePageLinks(document);
  const links = [...document.querySelectorAll('a')];
  assert.equal(links[0].getAttribute('href'), '/what-we-offer/our-accounts/brokerage-account?icid=home#fees');
  assert.equal(links[1].getAttribute('href'), 'https://express.etrade.com/etx/rtao/ma/account-types/brokerage');
  assert.equal(links[2].getAttribute('href'), 'https://us.etrade.com/what-we-offer/pricing-and-rates');
  assert.equal(links[3].getAttribute('href'), 'https://us.etrade.com.example.com/planning');
  assert.equal(links[4].getAttribute('href'), 'mailto:hello@example.com');
  assert.equal(links[5].getAttribute('href'), 'http://[');
});

test('older pages get their layout without removing authored theme classes; unrelated routes stay untouched', async () => {
  const planning = await harness('/planning.html');
  planning.document.body.classList.add('dark');
  planning.layout.default();
  assert.equal(planning.document.body.className, 'dark etrade-page planning');
  const other = await harness('/bank');
  other.layout.default();
  assert.equal(other.document.body.className, '');
});

test('missing hero and audience transitions render once, while authored separators retain their settings', async () => {
  const { document, layout, sections } = await harness('/why-etrade', `
    <div class="section"><div><div class="hero-dark split"></div></div></div>
    <div class="section light"><div>Story</div></div>
    <div class="section dark"><div><div class="cards-icon"></div></div></div>
    <div class="section light"><div>Promos</div></div>`);
  layout.default();
  const main = document.querySelector('main');
  sections(main);
  sections(main);
  assert.equal(main.querySelectorAll('.separator').length, 2);
  assert.equal(main.querySelectorAll('[data-section-kind="separator"]').length, 2);
  assert.equal(main.firstElementChild.dataset.separatorAfter, 'true');
  const existing = await harness('/planning', `
    <div class="section"><div><div class="hero-dark split"></div></div></div>
    <div class="section"><div><div class="separator"><div><div>Height</div><div>99px</div></div></div></div></div>
    <div class="section light"><div>Content</div></div>`);
  existing.layout.default();
  existing.sections(existing.document.querySelector('main'));
  assert.equal(existing.document.querySelectorAll('.separator').length, 1);
  assert.match(existing.document.querySelector('.separator').textContent, /99px/);
});
