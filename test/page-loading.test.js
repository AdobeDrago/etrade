/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness(body, loadSection, theme = '', realCMP = false) {
  const { document, window } = parseHTML(`<html data-block-review><head></head><body>${body}</body></html>`);
  window.location = new URL(`http://localhost:3000/home${realCMP ? '?perf=onetrust-real&consent=accept' : ''}`);
  window.hlx = { codeBasePath: '' };
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
    getMetadata: (name) => (name === 'theme' ? theme : ''),
  };
  const dependencies = {
    './aem.js': helpers,
    './actions.js': { groupActions: noop },
    './section-layout.js': { default: noop },
    './section-authoring.js': { default: noop },
    './disclosure-references.js': { default: noop },
    './page-layout.js': {
      default: noop,
      localizePageLinks: noop,
      decoratePricingIntroductions: noop,
      decoratePageActions: noop,
    },
    './demo-host.js': { default: () => realCMP },
    './tracking.js': { default: noop, decorateTrackingLinks: noop },
  };
  const source = await readFile(new URL('../scripts/scripts.js', import.meta.url), 'utf8');
  const themeModule = new vm.SourceTextModule(await readFile(new URL('../scripts/page-theme.js', import.meta.url), 'utf8'), { context });
  const imports = [];
  const module = new vm.SourceTextModule(`${source}\nexport { loadEager, loadPage };`, {
    context,
    async importModuleDynamically(specifier) {
      imports.push(specifier);
      const values = specifier === './demo-performance.js' ? {
        default: () => ({ config: { profile: 'onetrust-real' }, ready: Promise.resolve(), afterContent: noop }),
      } : { default: noop };
      const dependency = new vm.SyntheticModule(['default'], function define() {
        this.setExport('default', values.default);
      }, { context });
      await dependency.link(() => {});
      await dependency.evaluate();
      return dependency;
    },
  });
  await module.link((specifier) => {
    if (specifier === './page-theme.js') return themeModule;
    const values = dependencies[specifier];
    return new vm.SyntheticModule(Object.keys(values), function define() {
      Object.entries(values).forEach(([name, value]) => this.setExport(name, value));
    }, { context });
  });
  await module.evaluate();
  return {
    document, loadEager: module.namespace.loadEager, loadPage: module.namespace.loadPage, imports,
  };
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

test('page family tokens resolve before the first section loads or the page appears', async () => {
  await Promise.all(['Purple', 'Charcoal'].map(async (theme) => {
    let rootTheme;
    let visible;
    const page = await harness('<main><div class="section"><p>Campaign</p></div></main>', (section) => {
      rootTheme = section.ownerDocument.documentElement.dataset.pageTheme;
      visible = section.ownerDocument.body.classList.contains('appear');
    }, theme);
    await page.loadEager(page.document);
    assert.equal(rootTheme, theme.toLowerCase());
    assert.equal(visible, false);
  }));
});

test('a page without main content can still display its shared chrome', async () => {
  const page = await harness('<header></header>', () => assert.fail('No section should load'));
  await page.loadEager(page.document);
  assert.equal(page.document.body.classList.contains('appear'), true);
});

test('real OneTrust mode never imports the dummy consent override, even with consent=accept', async () => {
  const page = await harness('<header></header><main></main><footer></footer>', () => {}, '', true);
  await page.loadPage();
  assert.equal(page.document.body.classList.contains('appear'), true);
  assert.ok(page.imports.includes('./demo-performance.js'));
  assert.equal(page.imports.includes('./consent-check.js'), false);
});
