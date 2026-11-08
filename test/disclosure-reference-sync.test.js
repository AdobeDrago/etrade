/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { captureDisclosureRenumbering, applyDisclosureRenumbering } from '../scripts/disclosure-reference-sync.js';

const change = {
  id: 'operation-one',
  namespace: 'qa',
  setPath: '/drafts/qa/set.json',
  mapping: [['1', '2'], ['2', '1'], ['3', '3']],
  before: { id: 'qa', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }, { disclosureId: '3', fragment: '/three' }] },
  after: { id: 'qa', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }, { disclosureId: '3', fragment: '/three' }] },
};
function page(content = '<p>Offer<sup>1</sup>. Group<sup><strong>3</strong>,<em>1</em></sup>. Fee<sup>2</sup>.</p>') {
  return parseHTML(`<html><body class="quick-edit"><main>${content}</main><div class="disclosures" data-disclosure-namespace="qa"><ol class="disclosures-items"><li id="disclosure-qa-1" data-disclosure-id="1" data-disclosure-fragment="/one" value="1">One</li><li id="disclosure-qa-2" data-disclosure-id="2" data-disclosure-fragment="/two" value="2">Two</li><li id="disclosure-qa-3" data-disclosure-id="3" data-disclosure-fragment="/three" value="3">Three</li></ol></div></body></html>`).document;
}

test('verified reorder explicitly changes captured superscripts once and preserves rich marks', () => {
  const doc = page();
  const captured = captureDisclosureRenumbering(doc, change);
  assert.equal(applyDisclosureRenumbering(doc, captured), 3);
  assert.deepEqual([...doc.querySelectorAll('main sup')].map((el) => el.textContent), ['2', '3,2', '1']);
  assert.equal(doc.querySelector('em').textContent, '2');
  assert.equal(doc.querySelector('strong').textContent, '3');
  assert.equal(applyDisclosureRenumbering(doc, captured), 0);
});

test('native replacements and user edits after capture are never remapped again', () => {
  const doc = page('<p><sup>1</sup><sup>2</sup></p>');
  const captured = captureDisclosureRenumbering(doc, change);
  doc.querySelector('sup').outerHTML = '<sup>2</sup>';
  doc.querySelectorAll('sup')[1].textContent = '3';
  assert.equal(applyDisclosureRenumbering(doc, captured), 0);
  assert.deepEqual([...doc.querySelectorAll('main sup')].map((el) => el.textContent), ['2', '3']);
});

test('unrelated links, active editors and unavailable or stale footer bindings stay untouched', () => {
  const doc = page('<p><sup><a href="https://example.com">1</a></sup><sup>27</sup><a href="/claim">Claim<sup>1</sup></a></p><div class="prosemirror-editor"><p contenteditable="true"><sup>1</sup></p></div>');
  const before = doc.querySelector('main').outerHTML;
  applyDisclosureRenumbering(doc, captureDisclosureRenumbering(doc, change));
  assert.equal(doc.querySelector('main').outerHTML, before);
  const stale = page();
  stale.querySelector('li').dataset.disclosureFragment = '/different-content';
  assert.equal(captureDisclosureRenumbering(stale, change).length, 0);
});

test('generated legacy links remap their authored ID while preserving the intended legal target', () => {
  const legacy = { ...change, mapping: [['a', '2'], ['b', '1']], before: { id: 'qa', disclosures: [{ disclosureId: 'a', fragment: '/one' }, { disclosureId: 'b', fragment: '/two' }] } };
  const doc = page('<p><sup class="disclosures-reference" data-disclosure-ids="a"><a href="#disclosure-a" aria-label="Disclosure 1">1</a></sup></p>');
  doc.querySelector('.disclosures-items').innerHTML = '<li id="disclosure-a" data-disclosure-id="a" data-disclosure-fragment="/one" value="1">One</li><li id="disclosure-b" data-disclosure-id="b" data-disclosure-fragment="/two" value="2">Two</li>';
  applyDisclosureRenumbering(doc, captureDisclosureRenumbering(doc, legacy));
  assert.equal(doc.querySelector('main sup').textContent, '2');
  assert.equal(doc.querySelector('main sup').dataset.disclosureIds, undefined);
});

test('authored fragment .html suffixes bind to the same normalized rendered legal fragment', () => {
  const doc = page();
  const authored = { ...change, before: { ...change.before, disclosures: change.before.disclosures.map((entry) => ({ ...entry, fragment: `${entry.fragment}.html` })) } };
  assert.equal(applyDisclosureRenumbering(doc, captureDisclosureRenumbering(doc, authored)), 3);
});

test('opening the disclosure tooltip does not invalidate an otherwise unchanged reference', () => {
  const doc = page('<p>Offer<sup class="disclosures-reference" data-disclosure-ids="1"><a href="#disclosure-qa-1" aria-label="Disclosure 1">1</a></sup></p>');
  const hint = doc.createElement('aside'); hint.id = 'disclosure-hint'; hint.className = 'disclosure-hint'; doc.body.append(hint);
  const captured = captureDisclosureRenumbering(doc, change);
  doc.querySelector('main a').setAttribute('aria-describedby', hint.id);
  assert.equal(applyDisclosureRenumbering(doc, captured), 1);
  assert.equal(doc.querySelector('main sup').textContent, '2');
});

test('code examples and structured authoring metadata follow the source rewriter exclusions', () => {
  const doc = page('<p>Offer<sup>1</sup></p><code>x<sup>1</sup></code><pre><sup>1</sup></pre><div class="da-metadata"><sup>1</sup></div><div class="da-form"><sup>1</sup></div><div class="disclosure-set"><sup>1</sup></div><math><sup>1</sup></math>');
  applyDisclosureRenumbering(doc, captureDisclosureRenumbering(doc, change));
  assert.deepEqual([...doc.querySelectorAll('main sup')].map((el) => el.textContent), ['2', '1', '1', '1', '1', '1', '1']);
});

test('rendered source signatures distinguish original citations from already updated citations', async () => {
  const { disclosureReferenceSignature } = await import('../scripts/disclosure-reference-sync.js');
  assert.equal(typeof disclosureReferenceSignature, 'function');
  const doc = page('<p><sup class="disclosures-reference" data-disclosure-ids="1"><a href="#disclosure-qa-1" aria-label="Disclosure 1">1</a></sup><sup>2,1</sup></p><code><sup>1</sup></code>');
  assert.deepEqual(disclosureReferenceSignature(doc, change), ['1', '2,1']);
});

test('standalone disclosure links follow their legal target while keeping link text intact', () => {
  const doc = page('<p><a href="#disclosure-qa-1">Full offer terms</a><a href="#disclosure-qa-2">Claim<sup>1</sup></a></p>');
  applyDisclosureRenumbering(doc, captureDisclosureRenumbering(doc, change));
  assert.deepEqual([...doc.querySelectorAll('main a')].map((link) => link.getAttribute('href')), ['#disclosure-qa-2', '#disclosure-qa-1']);
  assert.equal(doc.querySelector('main a').textContent, 'Full offer terms');
  assert.equal(doc.querySelector('main sup').textContent, '1');
});

test('ambiguous views also unlink standalone selected-set references', async () => {
  const { requireDisclosureViewRefresh } = await import('../scripts/disclosure-reference-sync.js');
  const doc = page('<p><a href="#disclosure-qa-1">Full offer terms</a><a href="https://example.com">Outside source</a></p>');
  requireDisclosureViewRefresh(doc, change);
  assert.equal(doc.querySelector('main a[href="#disclosure-qa-1"]'), null);
  assert.equal(doc.querySelector('main a').getAttribute('href'), 'https://example.com');
});
