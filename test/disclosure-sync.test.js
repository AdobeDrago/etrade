/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { prepareDisclosureSave, notifyDisclosureSave, listenDisclosureSaves } from '../scripts/disclosure-sync.js';

const operation = {
  id: 'qa-operation',
  status: 'complete',
  namespace: 'homepage',
  org: 'adobedrago',
  repo: 'etrade',
  setPath: '/disclosures/sets/homepage',
  affectedPages: ['/drafts/disclosure-numbering-qa/consumer-a'],
};
const context = { org: 'adobedrago', repo: 'etrade' };
function author(path = operation.affectedPages[0]) {
  const { document } = parseHTML('<html><body class="quick-edit"><main></main></body></html>');
  return { document, win: { BroadcastChannel, location: new URL(`https://qa--etrade--adobedrago.preview.da.live${path}`) } };
}

function failingChannel(phase) {
  return class extends BroadcastChannel {
    constructor(name) {
      if (phase === 'open') throw new Error('Channel blocked');
      super(name);
    }

    postMessage(message) {
      if (phase === 'send' || message.phase === phase) throw new Error('Channel send unavailable');
      super.postMessage(message);
    }
  };
}

const numberedChange = {
  ...operation,
  mapping: [['1', '2'], ['2', '1']],
  before: { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] },
  after: { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] },
};

test('blocked channel creation leaves source saves and author setup available', async () => {
  const { document, win } = author();
  win.BroadcastChannel = failingChannel('open');
  assert.equal(await prepareDisclosureSave(context, numberedChange, win), false);
  assert.equal(notifyDisclosureSave(context, operation, win), false);
  assert.equal(listenDisclosureSaves(document, win, () => assert.fail('No channel opened')), null);
});

test('failed channel sends resolve without turning a verified source save into an error', async () => {
  const win = { BroadcastChannel: failingChannel('send') };
  assert.equal(await prepareDisclosureSave(context, numberedChange, win), false);
  assert.equal(notifyDisclosureSave(context, operation, win), false);
});

test('an acknowledgement send failure does not prevent the later saved-order refresh', async () => {
  const { document, win } = author();
  win.BroadcastChannel = failingChannel('ready');
  let wake;
  const arrived = new Promise((resolve) => { wake = resolve; });
  let refreshed = false;
  const dispose = listenDisclosureSaves(document, win, () => { refreshed = true; wake(); });
  const timeout = setTimeout(() => wake(), 1000);
  try {
    const ready = await prepareDisclosureSave(context, numberedChange, win, { timeout: 100 });
    assert.equal(ready, false);
    assert.equal(notifyDisclosureSave(context, numberedChange, win), true);
    await arrived;
    assert.equal(refreshed, true);
  } finally { clearTimeout(timeout); dispose?.(); }
});

test('verified saves notify the affected open author once without exposing a reorder permutation', async () => {
  const { document, win } = author();
  const received = [];
  let wake;
  const arrived = new Promise((resolve) => { wake = resolve; });
  const dispose = listenDisclosureSaves(document, win, async (message) => {
    received.push(message); wake();
  });
  const timeout = setTimeout(() => wake(), 1000);
  try {
    assert.equal(notifyDisclosureSave(context, operation, win), true);
    await arrived;
    assert.equal(received.length, 1);
    assert.equal(received[0].namespace, 'homepage');
    assert.equal(Object.hasOwn(received[0], 'mapping'), false);
    notifyDisclosureSave(context, operation, win);
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    assert.equal(received.length, 1);
  } finally { clearTimeout(timeout); dispose?.(); }
});

test('other pages, other sites and unfinished operations do not refresh this author', async () => {
  const { document, win } = author('/unrelated');
  const received = [];
  const dispose = listenDisclosureSaves(document, win, async (message) => received.push(message));
  try {
    assert.equal(notifyDisclosureSave(context, { ...operation, status: 'writing' }, win), false);
    assert.equal(notifyDisclosureSave(context, { ...operation, org: 'other' }, win), false);
    notifyDisclosureSave(context, operation, win);
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    assert.equal(received.length, 0);
    assert.equal(typeof dispose, 'function');
  } finally { dispose?.(); }
});

test('restoring a rotation uses its inverse mapping for existing rendered references', async () => {
  const { prepareAuthorSync, notifyAuthorSync } = await import('../tools/plugins/disclosure-manager/author-sync.js');
  const original = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }, { disclosureId: '3', fragment: '/three' }] };
  const target = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/three' }, { disclosureId: '2', fragment: '/one' }, { disclosureId: '3', fragment: '/two' }] };
  const restore = {
    ...operation,
    direction: 'restore',
    status: 'restored',
    mapping: [['1', '2'], ['2', '3'], ['3', '1']],
    writes: [{
      kind: 'set', path: `${operation.setPath}.json`, original: JSON.stringify(original), target: JSON.stringify(target),
    }],
  };
  const { document, win } = author();
  document.querySelector('main').innerHTML = '<p>Offer<sup>2</sup></p>';
  const footer = document.createElement('div');
  footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/three">Three</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-3" data-disclosure-id="3" data-disclosure-fragment="/two">Two</li></ol>';
  document.body.append(footer);
  let wake;
  const waiting = new Promise((resolve) => { wake = resolve; });
  const timeout = setTimeout(() => wake(), 1000);
  const dispose = listenDisclosureSaves(document, win, () => wake());
  try {
    const current = { ...context, path: operation.affectedPages[0] };
    assert.equal(await prepareAuthorSync(current, restore, win), true);
    notifyAuthorSync(context, restore, win);
    await waiting;
    assert.equal(document.querySelector('sup').textContent, '1');
  } finally { clearTimeout(timeout); dispose(); }
});

test('native-updated links are not clickable against the old footer while refresh is pending', async () => {
  const before = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] };
  const after = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] };
  const change = {
    ...operation, mapping: [['1', '2'], ['2', '1']], before, after,
  };
  const { document, win } = author();
  document.querySelector('main').innerHTML = '<p><sup>1</sup></p>';
  const footer = document.createElement('div'); footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/two">Two</li></ol>';
  document.body.append(footer);
  let wake;
  const waiting = new Promise((resolve) => { wake = resolve; });
  let linkCount;
  const timeout = setTimeout(() => wake(), 1000);
  const dispose = listenDisclosureSaves(document, win, () => { linkCount = document.querySelectorAll('main sup a').length; wake(); });
  try {
    await prepareDisclosureSave({ ...context, path: operation.affectedPages[0] }, change, win);
    document.querySelector('sup').outerHTML = '<sup class="disclosures-reference" data-disclosure-ids="2"><a href="#disclosure-homepage-2" aria-label="Disclosure 2">2</a></sup>';
    notifyDisclosureSave(context, change, win);
    await waiting;
    assert.equal(document.querySelector('main sup').textContent, '2');
    assert.equal(linkCount, 0);
  } finally { clearTimeout(timeout); dispose(); }
});

test('a prepare that times out behind an older refresh cannot capture already updated numbers', async () => {
  const before = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] };
  const after = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] };
  const change = {
    ...operation, id: 'timed-out-operation', mapping: [['1', '2'], ['2', '1']], before, after,
  };
  const { document, win } = author();
  document.querySelector('main').innerHTML = '<p><sup>1</sup></p>';
  const footer = document.createElement('div'); footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/two">Two</li></ol>';
  document.body.append(footer);
  let entered; let release; let wake;
  const started = new Promise((resolve) => { entered = resolve; });
  const blocked = new Promise((resolve) => { release = resolve; });
  const done = new Promise((resolve) => { wake = resolve; });
  const timeout = setTimeout(() => { release(); entered(); wake(); }, 1000);
  const dispose = listenDisclosureSaves(document, win, async (message) => {
    if (message.id === 'previous-operation') { entered(); await blocked; } else wake();
  });
  try {
    notifyDisclosureSave(context, { ...operation, id: 'previous-operation' }, win);
    await started;
    const current = { ...context, path: operation.affectedPages[0] };
    const ready = await prepareDisclosureSave(current, change, win, { timeout: 5 });
    assert.equal(ready, false);
    document.querySelector('sup').textContent = '2';
    release();
    notifyDisclosureSave(context, change, win);
    await done;
    assert.equal(document.querySelector('sup').textContent, '2');
  } finally { clearTimeout(timeout); release(); dispose(); }
});

test('standalone terms links are restored with their new target after the footer refresh', async () => {
  const before = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/one' }, { disclosureId: '2', fragment: '/two' }] };
  const after = { id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/two' }, { disclosureId: '2', fragment: '/one' }] };
  const change = {
    ...operation, id: 'standalone-save', mapping: [['1', '2'], ['2', '1']], before, after,
  };
  const { document, win } = author();
  document.querySelector('main').innerHTML = '<p><a href="#disclosure-homepage-1">Full offer terms</a></p>';
  const footer = document.createElement('div'); footer.className = 'disclosures';
  footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-homepage-1" data-disclosure-id="1" data-disclosure-fragment="/one">One</li><li id="disclosure-homepage-2" data-disclosure-id="2" data-disclosure-fragment="/two">Two</li></ol>';
  document.body.append(footer);
  let wake;
  const waiting = new Promise((resolve) => { wake = resolve; });
  const timeout = setTimeout(() => wake(), 1000);
  const dispose = listenDisclosureSaves(document, win, () => {
    footer.innerHTML = '<ol class="disclosures-items"><li id="disclosure-homepage-1">Two</li><li id="disclosure-homepage-2">One</li></ol>';
    wake();
  });
  try {
    await prepareDisclosureSave({ ...context, path: operation.affectedPages[0] }, change, win);
    notifyDisclosureSave(context, change, win);
    await waiting;
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    assert.equal(document.querySelector('main a')?.getAttribute('href'), '#disclosure-homepage-2');
    assert.equal(document.querySelector('main a').textContent, 'Full offer terms');
  } finally { clearTimeout(timeout); dispose(); }
});
