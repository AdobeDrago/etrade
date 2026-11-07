/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { notifyDisclosureSave, listenDisclosureSaves } from '../scripts/disclosure-sync.js';

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
