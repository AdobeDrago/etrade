/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import mountInline from '../scripts/disclosure-inline.js';

function harness(text = '27') {
  const { document, window } = parseHTML(`<html><body class="quick-edit"><main><div class="prosemirror-editor"><div class="ProseMirror" contenteditable="true"><p>Claim <sup>${text}</sup></p></div></div></main><aside class="disclosures"><ol class="disclosures-items"><li id="disclosure-offer" value="1">First offer terms</li><li id="disclosure-rate" value="2">Second rate terms</li></ol></aside></body></html>`);
  const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} }, marks: { superscript: {}, link: { attrs: { href: {} } } } });
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Claim '), schema.text(text, [schema.marks.superscript.create()])])]);
  const root = document.querySelector('.prosemirror-editor');
  const view = {
    dom: root.firstElementChild,
    editable: true,
    state: EditorState.create({ doc, selection: TextSelection.create(doc, 8) }),
    dispatch(tr) { this.state = this.state.apply(tr); },
  };
  root.view = view;
  Object.defineProperty(document, 'activeElement', { get: () => view.dom });
  const timers = new Map();
  let id = 0;
  const dispose = mountInline(document, window, {
    setTimer: (fn) => { id += 1; timers.set(id, fn); return id; },
    clearTimer: (key) => timers.delete(key),
  });
  const flush = () => {
    const callbacks = [...timers.values()];
    timers.clear(); callbacks.forEach((fn) => fn());
  };
  view.dom.dispatchEvent(new window.Event('input', { bubbles: true })); flush();
  return {
    document, window, view, root, dispose, flush,
  };
}

test('inline help suggests an existing alternative and links through a native edit', () => {
  const ui = harness();
  const panel = ui.document.querySelector('.disclosure-inline');
  assert.equal(panel?.hidden, false);
  assert.equal(ui.document.querySelector('main .disclosure-inline'), null);
  assert.match(panel.textContent, /27/);
  const choice = panel.querySelector('button[data-number="2"]');
  assert.match(choice.textContent, /Second rate terms/);
  const mouse = new ui.window.Event('mousedown', { bubbles: true, cancelable: true });
  choice.dispatchEvent(mouse);
  assert.equal(mouse.defaultPrevented, true);
  choice.click();
  assert.equal(ui.view.state.doc.textContent, 'Claim 2');
  assert.equal(ui.view.state.doc.nodeAt(7).marks.find((mark) => mark.type.name === 'link').attrs.href, '#disclosure-rate');
  assert.equal(panel.hidden, true);
  ui.dispose();
});

test('inline help shows the matching excerpt and supports keyboard choice without moving focus', () => {
  const ui = harness('1');
  const panel = ui.document.querySelector('.disclosure-inline');
  assert.equal(panel?.hidden, false);
  assert.match(panel.textContent, /First offer terms/);
  const key = (value) => {
    const event = new ui.window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperties(event, { key: { value }, altKey: { value: true } });
    ui.view.dom.dispatchEvent(event);
  };
  key('ArrowDown'); key('Enter');
  assert.equal(ui.view.state.doc.textContent, 'Claim 2');
  ui.dispose();
});

test('an inline suggestion refuses a stale source and disposes all UI', () => {
  const ui = harness('1');
  const panel = ui.document.querySelector('.disclosure-inline');
  assert.ok(panel);
  ui.view.dispatch(ui.view.state.tr.insertText('changed ', 1));
  panel.querySelector('button[data-number="2"]').click();
  assert.equal(ui.view.state.doc.textContent, 'changed Claim 1');
  ui.dispose();
  assert.equal(ui.document.querySelector('.disclosure-inline'), null);
});

test('a changed disclosure footer invalidates an open suggestion before it can link', () => {
  const ui = harness('1');
  ui.document.querySelector('.disclosures-items').innerHTML = '<li id="disclosure-offer" value="1">Different legal terms after reorder</li><li id="disclosure-rate" value="2">Another disclosure</li>';
  ui.document.querySelector('.disclosure-inline button[data-number="2"]').click();
  assert.equal(ui.view.state.doc.textContent, 'Claim 1');
  assert.equal(ui.view.state.doc.nodeAt(7).marks.some((mark) => mark.type.name === 'link'), false);
  ui.dispose();
});
