/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser, parseHTML } from 'linkedom';
import mountAssistant, { copyAssistantContent, superscriptCandidates, updatedSuperscriptBlock } from '../tools/plugins/disclosure-manager/assistant.js';
import mountHints from '../scripts/disclosure-hints.js';

class Parser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html>${html}</html>`, type);
  }
}
globalThis.DOMParser = Parser;
const entries = ['1', '2', '3'].map((disclosureId) => ({ disclosureId, fragment: `/terms/${disclosureId}` }));
const snapshot = (content) => ({ html: `<body><main><div class="hero" data-block-index="2"><p>Claim <strong>keep wording</strong>${content}</p><a href="https://example.com">Other link</a></div></main></body>`, editable: true, selection: { blockIndex: 2 } });
const parse = (html) => new Parser().parseFromString(html, 'text/html');

test('copying a disclosure puts rich HTML and plain numbers on the clipboard', async () => {
  const writes = [];
  function Item(types) { return { types }; }
  const clipboard = { write: async (items) => writes.push(items) };
  await copyAssistantContent('2,3', '<sup>2,3</sup>', clipboard, Item);
  assert.equal(await writes[0][0].types['text/html'].text(), '<sup>2,3</sup>');
  assert.equal(await writes[0][0].types['text/plain'].text(), '2,3');
});

test('assistant captures plain and grouped superscripts with exact block/document guards', () => {
  const current = snapshot('<sup>2,3</sup><sup>27</sup><sup>™</sup><sup><a href="https://example.com">1</a></sup>');
  const candidates = superscriptCandidates(current, entries, 'homepage');
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].numbers, ['2', '3']);
  assert.equal(candidates[0].expected.html, current.html);
  assert.equal(candidates[0].expected.blockIndex, 2);
  const changed = parse(updatedSuperscriptBlock(candidates[0], 'link'));
  assert.deepEqual([...changed.querySelector('sup').querySelectorAll('a')].map((link) => link.getAttribute('href')), ['#disclosure-homepage-2', '#disclosure-homepage-3']);
  assert.equal(changed.querySelector('strong').textContent, 'keep wording');
  assert.equal(changed.querySelector('[data-block-index] > a[href="https://example.com"]').textContent, 'Other link');
  assert.equal(candidates[1].linkable, false);
});

test('ordinary superscript conversion retains surrounding and nested marks without disclosure links', () => {
  const [candidate] = superscriptCandidates(snapshot('<sup><em>2</em></sup>'), entries, 'homepage');
  const changed = parse(updatedSuperscriptBlock(candidate, 'ordinary'));
  assert.equal(changed.querySelector('sup'), null);
  assert.equal(changed.querySelector('em').textContent, '²');
  assert.equal(changed.querySelector('strong').textContent, 'keep wording');
});

async function assistantHarness(capable = true, selectionHTML = '<sup>2</sup>') {
  const html = await readFile(new URL('../tools/plugins/disclosure-manager/disclosure-manager.html', import.meta.url), 'utf8');
  const { document, window } = parseHTML(html);
  const timers = new Map();
  let id = 0;
  let listener;
  let current = snapshot('');
  const writes = [];
  const copies = [];
  const statuses = [];
  const sdk = {
    capabilities: { sendHTMLReplace: capable ? 1 : 0 },
    actions: {
      subscribeLiveDocument: (callback) => {
        listener = callback;
        callback(current);
        return () => { listener = undefined; };
      },
      getSelection: async () => selectionHTML,
      sendHTML: async (htmlText, options) => {
        writes.push({ html: htmlText, options });
        return { ok: true };
      },
    },
  };
  const controller = mountAssistant({
    document,
    sdk,
    getEntries: () => entries,
    getNamespace: () => 'homepage',
    getFragments: () => new Map(entries.map((entry) => [entry.fragment, { title: `Terms ${entry.disclosureId}`, excerpt: `Excerpt ${entry.disclosureId}` }])),
    onStatus: (message) => statuses.push(message),
    copyText: async (text, htmlText) => { copies.push({ text, html: htmlText }); },
    setTimer: (fn) => { id += 1; timers.set(id, fn); return id; },
    clearTimer: (timer) => timers.delete(timer),
  });
  const emit = (content) => { current = snapshot(content); listener?.(current); };
  const flush = () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((fn) => fn());
  };
  return {
    document, window, controller, emit, flush, writes, copies, statuses, current: () => current,
  };
}

test('live suggestions show the matching excerpt and apply through the host guard', async () => {
  const ui = await assistantHarness();
  ui.emit('<sup>2</sup>');
  ui.flush();
  assert.equal(ui.document.getElementById('assistant-suggestion').hidden, false);
  assert.match(ui.document.getElementById('assistant-question').textContent, /2/);
  assert.match(ui.document.getElementById('assistant-excerpt').textContent, /Excerpt 2/);
  ui.document.getElementById('assistant-link').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(ui.writes.length, 1);
  assert.equal(ui.writes[0].options.replace, true);
  assert.equal(ui.writes[0].options.expected.html, ui.current().html);
  assert.equal(ui.writes[0].options.expected.blockIndex, 2);
  ui.controller.dispose();
});

test('a stale suggestion never writes, and dismissed suggestions do not immediately return', async () => {
  const ui = await assistantHarness();
  ui.emit('<sup>2</sup>'); ui.flush();
  ui.emit('<sup>3</sup>');
  ui.document.getElementById('assistant-link').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(ui.writes.length, 0);
  assert.match(ui.statuses.at(-1), /changed|again/i);
  ui.flush();
  ui.document.getElementById('assistant-dismiss').click();
  ui.emit('<sup>3</sup>'); ui.flush();
  assert.equal(ui.document.getElementById('assistant-suggestion').hidden, true);
  ui.controller.dispose();
});

test('unsupported hosts use copy options without calling legacy insertion APIs', async () => {
  const ui = await assistantHarness(false);
  ui.emit('<sup>2</sup>'); ui.flush();
  assert.equal(ui.document.getElementById('assistant-link').disabled, true);
  ui.document.getElementById('assistant-link').click();
  ui.document.getElementById('assistant-copy-link').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.copies[0].text, '2');
  assert.match(ui.copies[0].html, /#disclosure-homepage-2/);
  assert.equal(ui.document.getElementById('assistant-copy').value, '2');
  ui.controller.dispose();
});

test('an unknown number can be kept ordinary without inventing a legal target', async () => {
  const ui = await assistantHarness();
  ui.emit('<sup>27</sup>'); ui.flush();
  assert.equal(ui.document.getElementById('assistant-link').disabled, true);
  assert.equal(ui.document.getElementById('assistant-ordinary').disabled, false);
  ui.document.getElementById('assistant-ordinary').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.match(ui.writes[0].html, /²⁷/);
  assert.doesNotMatch(ui.writes[0].html, /disclosure-homepage/);
  ui.controller.dispose();
});

test('plain numbers and external selected superscripts cannot authorize another citation edit', async () => {
  await Promise.all(['2', '<sup><a href="https://example.com">2</a></sup>'].map(async (selection) => {
    const ui = await assistantHarness(true, selection);
    ui.emit('2 accounts. Claim<sup>2</sup>'); ui.flush();
    ui.document.getElementById('assistant-check').click();
    await new Promise((resolve) => { setImmediate(resolve); });
    assert.equal(ui.document.getElementById('assistant-ordinary').disabled, true);
    ui.document.getElementById('assistant-ordinary').click();
    assert.equal(ui.writes.length, 0);
    ui.controller.dispose();
  }));
});

test('inserting before an existing marker suggests the new marker, while indistinguishable duplicates stay copy-only', async () => {
  const ui = await assistantHarness();
  ui.emit('<sup>2</sup>'); ui.flush();
  ui.emit('<sup>3</sup><sup>2</sup>'); ui.flush();
  assert.match(ui.document.getElementById('assistant-question').textContent, /3/);
  ui.emit('<sup>3</sup><sup>2</sup><sup>2</sup>'); ui.flush();
  assert.equal(ui.document.getElementById('assistant-ordinary').disabled, true);
  assert.equal(ui.document.getElementById('assistant-copy-ordinary').disabled, false);
  ui.controller.dispose();
});

function hintHarness(editor = true) {
  const { document, window } = parseHTML(`<html><body class="${editor ? 'quick-edit' : ''}"><main><p>Offer<sup class="disclosures-reference"><a href="#disclosure-homepage-1" aria-label="Disclosure 1">1</a></sup></p></main><aside class="disclosures"><ol class="disclosures-items"><li id="disclosure-homepage-1">Approved offer terms and qualifications.</li></ol></aside></body></html>`);
  window.innerWidth = 1000;
  window.innerHeight = 800;
  return { document, window };
}

test('inline hints stay outside authored main and show the actual legal excerpt on focus', () => {
  const { document, window } = hintHarness();
  const dispose = mountHints(document, window);
  const link = document.querySelector('main a');
  link.dispatchEvent(new window.Event('focusin', { bubbles: true }));
  const hint = document.querySelector('.disclosure-hint');
  assert.equal(hint.hidden, false);
  assert.equal(document.querySelector('main .disclosure-hint'), null);
  assert.match(hint.textContent, /Approved offer terms/);
  assert.match(link.getAttribute('aria-describedby'), /disclosure-hint/);
  const escape = new window.Event('keydown', { bubbles: true });
  Object.defineProperty(escape, 'key', { value: 'Escape' });
  document.dispatchEvent(escape);
  assert.equal(hint.hidden, true);
  assert.equal(link.hasAttribute('aria-describedby'), false);
  dispose();
});

test('public pages and active mini-editors never receive an inline disclosure hint', () => {
  const publicPage = hintHarness(false);
  assert.equal(mountHints(publicPage.document, publicPage.window), null);
  assert.equal(publicPage.document.querySelector('.disclosure-hint'), null);
  const editing = hintHarness();
  editing.document.querySelector('p').setAttribute('contenteditable', 'true');
  const before = editing.document.querySelector('main').outerHTML;
  const dispose = mountHints(editing.document, editing.window);
  editing.document.querySelector('main a').dispatchEvent(new editing.window.Event('focusin', { bubbles: true }));
  assert.equal(editing.document.querySelector('.disclosure-hint').hidden, true);
  assert.equal(editing.document.querySelector('main').outerHTML, before);
  dispose();
});

test('inline hint identity never collides with an authored element', () => {
  const { document, window } = hintHarness();
  const existing = document.createElement('span');
  existing.id = 'disclosure-hint';
  document.querySelector('main').append(existing);
  const dispose = mountHints(document, window);
  assert.equal(document.querySelectorAll('[id="disclosure-hint"]').length, 1);
  assert.notEqual(document.querySelector('aside.disclosure-hint').id, existing.id);
  dispose();
});
