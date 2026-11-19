/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseHTML } from 'linkedom';

test('the migration playbook sidebar lists each section once in reading order', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const { document } = parseHTML(html);
  const headings = document.querySelectorAll('main .page-hero[id], main .doc-section[id]');
  const expected = Array.from(headings, (section) => `#${section.id}`);
  const links = Array.from(document.querySelectorAll('.sidebar-link'), (link) => link.getAttribute('href'));
  assert.ok(expected.length > 0);
  assert.equal(new Set(links).size, links.length);
  assert.deepEqual(links, expected);
});
