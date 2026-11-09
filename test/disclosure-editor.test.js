/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { superscriptSelection, applyDisclosureChoice } from '../scripts/disclosure-editor.js';

const schema = new Schema({
  nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} },
  marks: {
    sup: { parseDOM: [{ tag: 'sup' }] }, strong: {}, em: {}, link: { attrs: { href: {} }, inclusive: false },
  },
});
const choices = [
  { number: '1', href: '#disclosure-homepage-1', excerpt: 'First legal terms' },
  { number: '2', href: '#disclosure-homepage-2', excerpt: 'Second legal terms' },
  { number: '3', href: '#disclosure-homepage-3', excerpt: 'Third legal terms' },
];
const marked = (text, extra = []) => schema.text(text, [schema.marks.sup.create(), ...extra]);
function editor(content, start = 7, end = start) {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Claim '), ...content, schema.text(' remains.')])]);
  const view = {
    state: EditorState.create({ doc, selection: TextSelection.create(doc, start, end) }),
    editable: true,
    isDestroyed: false,
    dispatch(tr) { this.state = this.state.apply(tr); },
  };
  return view;
}

test('native inline choice links the selected grouped superscript and preserves rich marks', () => {
  const view = editor([marked('2', [schema.marks.strong.create()]), marked(', '), marked('1', [schema.marks.em.create()])], 8);
  const candidate = superscriptSelection(view, choices);
  assert.deepEqual(candidate?.numbers, ['2', '1']);
  assert.equal(applyDisclosureChoice(view, candidate), true);
  const nodes = [];
  view.state.doc.descendants((node) => { if (node.isText) nodes.push(node); });
  assert.equal(view.state.doc.textContent, 'Claim 2, 1 remains.');
  assert.equal(nodes.find((node) => node.text === '2').marks.find((mark) => mark.type.name === 'link').attrs.href, '#disclosure-homepage-2');
  assert.equal(nodes.find((node) => node.text === '2').marks.some((mark) => mark.type.name === 'strong'), true);
  assert.equal(nodes.find((node) => node.text === '1').marks.some((mark) => mark.type.name === 'em'), true);
});

test('an unknown superscript can select an existing alternative without changing the claim', () => {
  const view = editor([marked('27', [schema.marks.strong.create()])], 8);
  const candidate = superscriptSelection(view, choices);
  assert.equal(candidate?.linkable, false);
  assert.equal(applyDisclosureChoice(view, candidate, '3'), true);
  assert.equal(view.state.doc.textContent, 'Claim 3 remains.');
  const target = view.state.doc.nodeAt(7);
  assert.equal(target.marks.find((mark) => mark.type.name === 'link').attrs.href, '#disclosure-homepage-3');
  assert.equal(target.marks.some((mark) => mark.type.name === 'strong'), true);
});

test('stale documents, moved selections, read-only and destroyed editors reject inline writes', () => {
  const view = editor([marked('1')], 8);
  const candidate = superscriptSelection(view, choices);
  view.dispatch(view.state.tr.insertText('x', 1));
  assert.equal(applyDisclosureChoice(view, candidate, '2'), false);
  const fresh = superscriptSelection(view, choices);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
  assert.equal(applyDisclosureChoice(view, fresh, '2'), false);
  const other = editor([marked('1')], 8);
  const current = superscriptSelection(other, choices);
  other.editable = false;
  assert.equal(applyDisclosureChoice(other, current, '2'), false);
  other.editable = true; other.isDestroyed = true;
  assert.equal(applyDisclosureChoice(other, current, '2'), false);
});

test('plain text, external links, invalid groups and cross-superscript selections are excluded', () => {
  const unsupported = [
    [schema.text('1')],
    [marked('1', [schema.marks.link.create({ href: 'https://example.com' })])],
    [marked('0')], [marked('01')], [marked('1, nope')], [marked('™')],
  ];
  unsupported.forEach((content) => {
    assert.equal(superscriptSelection(editor(content, 7), choices), null);
  });
  const crossed = editor([marked('1'), schema.text(' other '), marked('2')], 7, 16);
  assert.equal(superscriptSelection(crossed, choices), null);
  const view = editor([marked('1')]);
  assert.equal(applyDisclosureChoice(view, superscriptSelection(view, choices), '99'), false);
});

test('a captured suggestion cannot be applied to a different editor sharing the same document', () => {
  const first = editor([marked('1')]);
  const second = { ...first };
  assert.equal(applyDisclosureChoice(second, superscriptSelection(first, choices), '2'), false);
});
