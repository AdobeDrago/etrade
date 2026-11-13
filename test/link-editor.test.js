/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { captureLinkEdit, updatedLinkBlock } from '../tools/plugins/link-options/editor.js';

class BrowserParser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, type);
  }
}
globalThis.DOMParser = BrowserParser;
const selected = '<p><a href="/privacy" target="_blank">Privacy</a></p>';
const snapshot = {
  html: '<html><body><main><div><div class="footer" data-block-index="3"><div><div><p>Before <strong><a href="/privacy" target="_blank" title="Legal">Your Privacy Choices</a></strong> after</p><a href="/other">Other</a></div></div></div></div></main></body></html>',
  selection: { blockIndex: 3 },
  editable: true,
};

test('a partial link selection targets the full anchor inside its selected block', () => {
  const edit = captureLinkEdit(snapshot, selected);
  const html = updatedLinkBlock(edit, '@privacy-preferences');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  assert.equal(doc.querySelector('strong a').textContent, 'Your Privacy Choices');
  assert.equal(doc.querySelector('strong a').getAttribute('href'), '@privacy-preferences');
  assert.equal(doc.querySelector('strong a').getAttribute('title'), 'Legal');
  assert.equal(doc.querySelector('strong a').getAttribute('target'), '_blank');
  assert.equal(doc.querySelector('p').textContent, 'Before Your Privacy Choices after');
  assert.equal(doc.querySelector('a[href="/other"]').textContent, 'Other');
  assert.deepEqual(edit.expected, { html: snapshot.html, blockIndex: 3 });
});

test('ambiguous links, read-only snapshots and unguardable selections cannot apply', () => {
  assert.equal(captureLinkEdit({ ...snapshot, editable: false }, selected), null);
  assert.equal(captureLinkEdit({ ...snapshot, selection: { blockIndex: null } }, selected), null);
  assert.equal(captureLinkEdit(snapshot, '<p>Unlinked text</p>'), null);
  const duplicate = snapshot.html.replace('<a href="/other">Other</a>', '<a href="/privacy">Privacy</a>');
  assert.equal(captureLinkEdit({ ...snapshot, html: duplicate }, selected), null);
});
