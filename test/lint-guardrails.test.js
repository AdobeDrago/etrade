/* eslint-env node */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
// ESLint 8 cannot resolve Stylelint's exports-only package.
// eslint-disable-next-line import/no-unresolved
import stylelint from 'stylelint';
import { ESLint } from 'eslint';

async function cssWarnings(code, file = 'blocks/cards/cards.css') {
  const result = await stylelint.lint({ code, codeFilename: resolve(file) });
  return result.results.flatMap((entry) => entry.warnings);
}

test('CSS rejects fixed-pixel type and spacing, including shorthands, logical properties and fallbacks', async () => {
  const declarations = [
    'font-size: 16px', 'font: 600 16px/1.5 sans-serif',
    'padding: 0 16px', 'margin-inline-start: 8px', 'row-gap: 12px',
    'letter-spacing: -0.25px', '--space-card: 16px', '--header-menu-gap: 48px',
    'padding: var(--space-16, 16px)', 'line-height: 1.5rem', 'line-height: 120%',
  ];
  await Promise.all(declarations.map(async (declaration) => {
    const warnings = await cssWarnings(`.cards { ${declaration}; }`);
    const expected = declaration.startsWith('line-height:')
      ? 'etrade/unitless-line-height' : 'declaration-property-unit-disallowed-list';
    assert.ok(warnings.some(({ rule }) => rule === expected), declaration);
  }));
});

test('line heights reject every length unit and percentages in longhands and font shorthands', async () => {
  await Promise.all([
    'line-height: 12pt', 'line-height: 1ch', 'line-height: 10vmin',
    '--line-height-body: 1.5rem',
    'font: 1rem/1.5rem Arial, sans-serif', 'font: 1rem/150% Arial, sans-serif',
    'font: 1rem/var(--line-height-body, 20px) Arial, sans-serif',
  ].map(async (declaration) => {
    const warnings = await cssWarnings(`.cards { ${declaration}; }`);
    assert.ok(warnings.some(({ rule }) => rule === 'etrade/unitless-line-height'), declaration);
  }));
  assert.deepEqual(await cssWarnings('.cards { font: 1rem/1.5 Arial, sans-serif; }'), []);
});

test('CSS allows scalable values, physical strokes, viewport breakpoints and embedded assets', async () => {
  const warnings = await cssWarnings(`.cards {
  padding: var(--space-16) 1rem;
  margin-inline: auto;
  gap: 2%;
  font-size: clamp(1rem, 2vw, 2rem);
  line-height: calc(24 / 16);
  border: 1px solid currentcolor;
  background: url("data:image/svg+xml,%3Csvg width='16px'%3E%3C/svg%3E");
}

@media (width >= 768px) {
  .cards { padding: 2rem; }
}`);
  assert.deepEqual(warnings, []);
});

test('site styles require token colors while foundation and standalone tools own their palettes', async () => {
  const warnings = await cssWarnings('.cards { color: #fff; background: rgb(0 0 0); }');
  assert.ok(warnings.some(({ rule }) => rule === 'color-no-hex'));
  assert.ok(warnings.some(({ rule }) => rule === 'function-disallowed-list'));
  await Promise.all(['styles/brand.css', 'styles/themes.css', 'tools/example/example.css', 'docs/example.css'].map(async (file) => {
    assert.deepEqual(await cssWarnings('.example { color: #fff; }', file), [], file);
  }));
});

test('block styles reject unscoped selectors, including leaks in selector lists and negation', async () => {
  await Promise.all(['h2', '.cards-title', '.cards h2, h3', 'body:not(.cards) h2', '.cards + h2', ':is(.cards, .other) h2'].map(async (selector) => {
    const warnings = await cssWarnings(`${selector} { margin: 0; }`);
    assert.ok(warnings.some(({ rule }) => rule === 'etrade/block-scope'), selector);
  }));
});

test('block styles allow their block, section integration, keyframes and shared stylesheet scopes', async () => {
  await Promise.all(['.cards h2', '.cards-wrapper', '.cards-container > div', 'main .section:has(.cards) h2', '.cards p + p', '.cards > div + div'].map(async (selector) => {
    assert.deepEqual(await cssWarnings(`${selector} { margin: 0; }`), [], selector);
  }));
  assert.deepEqual(await cssWarnings('@keyframes cards-enter { from { opacity: 0; } to { opacity: 1; } }'), []);
  assert.deepEqual(await cssWarnings('body { margin: 0; }', 'styles/styles.css'), []);
});

test('CSS rejects important declarations and ID selectors', async () => {
  const warnings = await cssWarnings('.cards #title { margin: 0 !important; }');
  assert.ok(warnings.some(({ rule }) => rule === 'declaration-no-important'));
  assert.ok(warnings.some(({ rule }) => rule === 'selector-max-id'));
});

test('JS allows scripts and Fragment imports and rejects other blocks and runtime packages', async () => {
  const eslint = new ESLint();
  await Promise.all(['../cards/cards.js', '/blocks/cards/cards.js', '../fragment/private.js', 'linkedom'].map(async (source) => {
    const [result] = await eslint.lintText(`import value from '${source}';\n\nexport default value;\n`, { filePath: 'blocks/hero/hero.js' });
    assert.ok(result.messages.some(({ ruleId }) => ruleId === 'no-restricted-imports'), source);
  }));
  await Promise.all(['../../scripts/actions.js', '../fragment/fragment.js', '/scripts/actions.js', '/blocks/fragment/fragment.js'].map(async (source) => {
    const [result] = await eslint.lintText(`import value from '${source}';\n\nexport default value;\n`, { filePath: 'blocks/hero/hero.js' });
    assert.equal(result.messages.some(({ ruleId }) => ruleId === 'no-restricted-imports'), false, source);
  }));
});

test('JS import boundaries resolve nested helper paths and apply to module extensions', async () => {
  // This virtual helper has no module graph; exercise the import boundary independently.
  const eslint = new ESLint({ overrideConfig: { rules: { 'import/no-cycle': 'off' } } });
  const [result] = await eslint.lintText("import value from '../../cards/cards.js';\n\nexport default value;\n", { filePath: 'blocks/hero/nested/helper.mjs' });
  assert.ok(result.messages.some(({ ruleId }) => ruleId === 'import/no-restricted-paths'));
});
