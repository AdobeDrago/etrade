/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const source = await readFile(new URL('../blocks/library-brief/library-brief.js', import.meta.url), 'utf8');
const row = (...cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`;

async function render(rows) {
  const { document } = parseHTML(`<html><body><main><h1>Cards</h1><p>Introduction.</p>
    <div class="library-brief" data-aue-resource="brief">${rows}</div>
    <h2>Examples</h2><div class="cards">Example content</div></main></body></html>`);
  const block = document.querySelector('.library-brief');
  const note = block.querySelector('[data-richtext-note]');
  const example = document.querySelector('.cards');
  const module = new vm.SourceTextModule(source, { context: vm.createContext({ document }) });
  await module.link(() => { throw new Error('Unexpected import'); });
  await module.evaluate();
  module.namespace.default(block);
  return {
    block, document, note, example,
  };
}

test('authored settings and rich-text rows form a closed guide without moving adjacent content', async () => {
  const {
    block, document, note, example,
  } = await render(
    row('Title', 'How to author cards') + row('Description', 'Properties and examples')
      + row('Properties', '<ul data-richtext-note="true"><li><strong>Heading:</strong> required.</li></ul>', '<p>Extra cell.</p>')
      + row('Notes', '<p>Read <a href="/guide">the guide</a>.</p>'),
  );
  assert.equal(block.querySelector('summary').textContent, 'How to author cardsProperties and examples');
  assert.equal(block.querySelector('details').hasAttribute('open'), false);
  assert.equal(block.querySelectorAll('.library-brief-section').length, 2);
  assert.equal(block.querySelector('[data-richtext-note]'), note);
  assert.equal(block.dataset.aueResource, 'brief');
  assert.equal(block.querySelector('a').getAttribute('href'), '/guide');
  assert.match(block.textContent, /Extra cell/);
  assert.equal(block.querySelector('[role="heading"]').getAttribute('aria-level'), '3');
  assert.equal(document.querySelector('.cards'), example);
  assert.equal(block.previousElementSibling.textContent, 'Introduction.');
  assert.equal(block.nextElementSibling.textContent, 'Examples');
});

test('omitted settings use a default title and malformed or empty rows are ignored', async () => {
  const { block } = await render(
    row('Missing content') + row('', 'Unlabelled') + row('Empty', ' ')
      + row('Structure', '<p>Two columns.</p>'),
  );
  assert.equal(block.querySelector('summary').textContent, 'Authoring guide');
  assert.equal(block.querySelector('.library-brief-description'), null);
  assert.equal(block.querySelectorAll('.library-brief-section').length, 1);
  assert.equal(block.hidden, false);
});

test('media-only documentation is retained and an empty brief is hidden', async () => {
  const { block } = await render(row('Example image', '<img src="/diagram.png" alt="Table structure">'));
  assert.equal(block.querySelector('img').alt, 'Table structure');
  assert.equal(block.hidden, false);
  const empty = await render(row('Title', 'Nothing here') + row('Incomplete'));
  assert.equal(empty.block.hidden, true);
});

test('the authored DA source table renders all four documentation sections', async () => {
  const html = await readFile(new URL('./fixtures/block-library/library-brief.html', import.meta.url), 'utf8');
  const { document } = parseHTML(html);
  const [header, ...rows] = document.querySelectorAll('table tr');
  assert.equal(header.textContent.trim(), 'Library Brief');
  const raw = rows.map((tr) => row(...[...tr.children].map((cell) => cell.innerHTML))).join('');
  const { block } = await render(raw);
  assert.equal(block.querySelectorAll('.library-brief-section').length, 4);
  assert.equal(block.querySelector('.library-brief-title').textContent, 'Authoring guide');
  assert.match(block.textContent, /Balanced and Inset require Split/);
  assert.equal(block.querySelectorAll('ul').length, 3);
});
