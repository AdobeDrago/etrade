/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness(body, loadSection) {
  const { document, window } = parseHTML(`<html data-block-review><head></head><body>${body}</body></html>`);
  window.location = new URL('http://localhost:3000/home');
  window.innerWidth = 412;
  const context = vm.createContext({
    document, window, URL, URLSearchParams, sessionStorage: { getItem: () => null },
  });
  const noop = () => {};
  const helpers = {
    loadHeader: noop,
    loadFooter: noop,
    decorateIcons: noop,
    decorateSections: noop,
    decorateBlocks: noop,
    decorateTemplateAndTheme: noop,
    waitForFirstImage: noop,
    loadSection,
    loadSections: noop,
    loadCSS: noop,
    buildBlock: noop,
    decorateBlock: noop,
    loadBlock: noop,
    getMetadata: noop,
  };
  const dependencies = {
    './aem.js': helpers,
    './actions.js': { groupActions: noop },
    './section-layout.js': { default: noop },
    './disclosure-references.js': { default: noop },
    './page-layout.js': {
      default: noop,
      localizePageLinks: noop,
      decoratePricingIntroductions: noop,
      decoratePageActions: noop,
    },
    './demo-host.js': { default: () => false },
  };
  const source = await readFile(new URL('../scripts/scripts.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(`${source}\nexport { loadEager };`, { context });
  await module.link((specifier) => {
    const values = dependencies[specifier];
    return new vm.SyntheticModule(Object.keys(values), function define() {
      Object.entries(values).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();
  return { document, loadEager: module.namespace.loadEager };
}

test('the page stays hidden until its first section and image are ready', async () => {
  let release;
  let section;
  const ready = new Promise((resolve) => { release = resolve; });
  const page = await harness('<main><div class="section"><p>Campaign</p></div></main>', (first) => {
    section = first;
    return ready;
  });
  const loading = page.loadEager(page.document);
  assert.equal(section, page.document.querySelector('.section'));
  assert.equal(page.document.body.classList.contains('appear'), false);
  release();
  await loading;
  assert.equal(page.document.body.classList.contains('appear'), true);
});

test('an empty authored page can appear without a section to load', async () => {
  const page = await harness('<main></main>', () => assert.fail('No section should load'));
  await page.loadEager(page.document);
  assert.equal(page.document.body.classList.contains('appear'), true);
});

test('a page without main content can still display its shared chrome', async () => {
  const page = await harness('<header></header>', () => assert.fail('No section should load'));
  await page.loadEager(page.document);
  assert.equal(page.document.body.classList.contains('appear'), true);
});
