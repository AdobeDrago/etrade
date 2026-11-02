/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

async function harness(theme = '', headerTheme = '') {
  const { document } = parseHTML('<html><body class="authored-template"><main><div class="section" data-section-theme="dark"></div><div class="section" data-section-theme="light"></div></main></body></html>');
  const metadata = new Map([['theme', theme], ['header-theme', headerTheme]]);
  const context = vm.createContext({ document });
  const module = new vm.SourceTextModule(await readFile(new URL('../scripts/page-theme.js', import.meta.url), 'utf8'), { context });
  await module.link(() => new vm.SyntheticModule(['getMetadata'], function define() {
    this.setExport('getMetadata', (name) => metadata.get(name) || '');
  }, { context }));
  await module.evaluate();
  return { document, metadata, theme: module.namespace };
}

test('supported page families select matching header defaults and normalize aliases', async () => {
  await Promise.all([
    [' Purple ', 'purple', 'light'],
    ['theme-CHARCOAL', 'charcoal', 'dark'],
    ['campaign, THEME-PURPLE, charcoal', 'purple', 'light'],
  ].map(async ([value, expected, header]) => {
    const page = await harness(value);
    page.theme.default();
    assert.equal(page.document.documentElement.dataset.pageTheme, expected);
    assert.equal(page.theme.getHeaderTheme(), header);
  }));
});

test('legacy page light/dark metadata controls the header without opting into a design family', async () => {
  await Promise.all(['light', 'theme-dark'].map(async (value) => {
    const page = await harness(value);
    page.theme.default();
    assert.equal(page.document.documentElement.hasAttribute('data-page-theme'), false);
    assert.equal(page.theme.getHeaderTheme(), value.replace('theme-', ''));
  }));
  const mixed = await harness('purple, dark');
  mixed.theme.default();
  assert.equal(mixed.document.documentElement.dataset.pageTheme, 'purple');
  assert.equal(mixed.theme.getHeaderTheme(), 'dark');
});

test('header overrides retain precedence over block, legacy and family defaults', async () => {
  const page = await harness('purple, light', 'THEME-DARK');
  assert.equal(page.theme.getHeaderTheme(['light']), 'dark');
  page.metadata.set('header-theme', 'unsupported');
  assert.equal(page.theme.getHeaderTheme(['theme-dark']), 'dark');
  assert.equal(page.theme.getHeaderTheme(['unrelated']), 'light');
});

test('applying or changing page families preserves independent section schemes and authored classes', async () => {
  const page = await harness('purple');
  page.theme.default();
  page.theme.default();
  page.metadata.set('theme', 'charcoal');
  page.theme.default();
  assert.equal(page.document.documentElement.dataset.pageTheme, 'charcoal');
  assert.equal(page.document.body.className, 'authored-template');
  assert.deepEqual([...page.document.querySelectorAll('.section')].map((section) => section.dataset.sectionTheme), ['dark', 'light']);
});

test('missing or unsupported metadata preserves legacy defaults and clears a previous family', async () => {
  const page = await harness('purple');
  page.theme.default();
  ['', 'blue', 'darkish'].forEach((value) => {
    page.metadata.set('theme', value);
    page.theme.default();
    assert.equal(page.document.documentElement.hasAttribute('data-page-theme'), false);
    assert.equal(page.theme.getHeaderTheme(), 'dark');
  });
});
