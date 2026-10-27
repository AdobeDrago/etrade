/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import mountRunComparison from '../scripts/demo-run-comparison.js';

const KEY = 'etrade:demo-comparison';

function snapshot(changes = {}) {
  return {
    config: { profile: 'etrade', phase: 'early', work: 'none' },
    metrics: { lcp: 1200, fcp: 900, cls: 0 },
    actualTransferBytes: 930000,
    completed: 20,
    resources: Array(20).fill({}),
    failed: 0,
    cmpReady: true,
    consent: 'pending',
    ...changes,
  };
}

function browser(store = new Map(), href = 'http://localhost/home?perf=etrade', balance = '100000') {
  const { document, window } = parseHTML('<html><body></body></html>');
  const win = {
    location: { href, hostname: new URL(href).hostname },
    innerWidth: 1280,
    innerHeight: 720,
    localStorage: { getItem: () => balance },
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };
  const comparison = mountRunComparison(document, win);
  document.body.append(comparison.save, comparison.element, comparison.feedback);
  const click = (target) => target.dispatchEvent(new window.Event('click'));
  const row = (title) => [...comparison.element.querySelectorAll('tbody tr')]
    .find((element) => element.querySelector('th').textContent === title);
  const values = (title) => [...row(title).querySelectorAll('td')].map((cell) => cell.textContent);
  return {
    comparison, store, document, win, click, values,
  };
}

test('saved measurements survive reload and stay fixed as the current run changes', () => {
  const first = browser();
  const original = snapshot();
  first.comparison.update(original, 'Traditional · download and parse');
  first.click(first.comparison.save);
  original.metrics.lcp = 9999;
  first.comparison.update(original, 'Traditional · download and parse');
  assert.deepEqual(first.values('LCP'), ['1200 ms', '9999 ms']);
  const second = browser(first.store, 'http://localhost/home?perf=etrade&perf-phase=eds#rates');
  second.comparison.update(snapshot({
    config: { profile: 'etrade', phase: 'eds', work: 'none' },
    metrics: { lcp: 400, fcp: 300, cls: 0 },
    actualTransferBytes: 200000,
    completed: 2,
  }), 'EDS · download and parse');
  assert.equal(second.comparison.element.hidden, false);
  assert.deepEqual(second.values('LCP'), ['1200 ms', '400 ms']);
  assert.deepEqual(second.values('CLS'), ['0.000', '0.000']);
  assert.deepEqual(second.values('Files'), ['20/20', '2/20']);
  assert.deepEqual(second.values('Consent'), ['Not gated', 'pending']);
  assert.ok(second.comparison.element.textContent.includes('Some tags have not loaded'));
  second.comparison.update(snapshot({
    config: { profile: 'etrade', phase: 'eds', work: 'none' },
    consent: 'accepted',
  }), 'EDS · download and parse');
  assert.deepEqual(second.values('Files'), ['20/20', '20/20']);
  assert.equal(second.comparison.element.textContent.includes('Some tags have not loaded'), false);
  second.store.set('unrelated', 'keep');
  let focused = false;
  second.comparison.save.focus = () => { focused = true; };
  second.click(second.comparison.element.querySelector('button'));
  assert.equal(second.store.has(KEY), false);
  assert.equal(second.store.get('unrelated'), 'keep');
  assert.equal(second.comparison.element.hidden, true);
  assert.equal(focused, true);
});

test('saving a reference on another page preserves the first page’s comparison', () => {
  const home = browser();
  home.comparison.update(snapshot(), 'Home reference');
  home.click(home.comparison.save);
  const bank = browser(home.store, 'http://localhost/bank?perf=etrade');
  bank.comparison.update(snapshot({ metrics: { lcp: 2200, fcp: 1900, cls: 0 } }), 'Bank reference');
  bank.click(bank.comparison.save);
  const returned = browser(home.store);
  returned.comparison.update(snapshot(), 'Current home');
  assert.deepEqual(returned.values('LCP'), ['1200 ms', '1200 ms']);
  assert.ok(returned.comparison.element.textContent.includes('Home reference'));
});

test('saved references are scoped to the page and report processing and balance differences', () => {
  const first = browser(new Map(), 'http://localhost/home?b=2&a=1&perf=etrade');
  first.comparison.update(snapshot(), 'Traditional');
  first.click(first.comparison.save);
  const same = browser(first.store, 'http://localhost/home?a=1&perf=etrade&b=2', '200000');
  same.comparison.update(snapshot({
    config: { profile: 'etrade', phase: 'eds', work: 'medium' },
  }), 'EDS · assumed processing');
  assert.equal(same.comparison.element.hidden, false);
  assert.ok(same.comparison.element.textContent.includes('Added processing differs'));
  assert.ok(same.comparison.element.textContent.includes('demo balance changed'));
  same.win.innerWidth = 390;
  same.comparison.update(snapshot(), 'EDS');
  assert.ok(same.comparison.element.textContent.includes('viewport changed'));
  same.win.innerWidth = 1280;
  same.comparison.update(snapshot(), 'EDS');
  assert.ok(same.comparison.element.textContent.includes('viewport changed'));
  ['http://localhost/other?a=1&b=2', 'http://localhost/home?a=changed&b=2'].forEach((href) => {
    const other = browser(first.store, href);
    other.comparison.update(snapshot(), 'Traditional');
    assert.equal(other.comparison.element.hidden, true);
    assert.equal(other.store.has(KEY), true);
  });
});

test('invalid stored values are ignored and browser storage errors leave live metrics usable', () => {
  const first = browser();
  first.comparison.update(snapshot(), 'Traditional');
  first.click(first.comparison.save);
  const saved = JSON.parse(first.store.get(KEY));
  [
    'not JSON', JSON.stringify({ ...saved, version: 99 }),
    JSON.stringify({ ...saved, lcp: -1 }), JSON.stringify({ ...saved, completed: null }),
    JSON.stringify({ ...saved, completed: 21 }), JSON.stringify({ ...saved, cls: 'zero' }),
    JSON.stringify({ ...saved, lcp: null, fcp: null }),
  ].forEach((value) => {
    const context = browser(new Map([[KEY, value]]));
    context.comparison.update(snapshot(), 'Traditional');
    assert.equal(context.comparison.element.hidden, true);
    assert.equal(context.comparison.save.disabled, false);
  });
  const denied = browser();
  denied.win.sessionStorage.setItem = () => { throw new Error('Denied'); };
  denied.comparison.update(snapshot({ metrics: { lcp: null, fcp: null, cls: 0 } }), 'Traditional');
  assert.equal(denied.comparison.save.disabled, true);
  denied.comparison.update(snapshot(), 'Traditional');
  denied.click(denied.comparison.save);
  assert.ok(denied.comparison.feedback.textContent.includes('could not save'));
  assert.equal(denied.comparison.element.hidden, true);
  assert.equal(denied.comparison.save.disabled, false);
});

test('real CMP partial loads remain explicit and unknown transfer sizes never appear as zero', () => {
  const context = browser();
  context.comparison.update(snapshot(), 'Traditional');
  context.click(context.comparison.save);
  context.comparison.update(snapshot({
    config: { profile: 'onetrust-real', phase: 'eds', work: 'none' },
    actualTransferBytes: null,
    completed: 0,
    resources: [],
    realResources: [{}, {}],
    cmpReady: false,
    realCMP: { consented: false },
  }), 'Real OneTrust');
  assert.deepEqual(context.values('Transferred'), ['930.0 kB', 'Unavailable']);
  assert.deepEqual(context.values('Files'), ['20/20', '2 observed']);
  assert.deepEqual(context.values('Consent'), ['Not gated', 'Gate closed']);
  assert.ok(context.comparison.element.textContent.includes('different code'));
  assert.ok(context.comparison.element.textContent.includes('load is incomplete'));
});

test('OneTrust-only references warn while their CMP fixtures are incomplete', () => {
  const context = browser();
  context.comparison.update(snapshot(), 'Reference');
  context.click(context.comparison.save);
  context.comparison.update(snapshot({
    config: { profile: 'onetrust', phase: 'eds', work: 'none' },
    completed: 0,
    resources: [],
    cmpReady: false,
  }), 'OneTrust weights');
  assert.ok(context.comparison.element.textContent.includes('load is incomplete'));
  context.comparison.update(snapshot({
    config: { profile: 'onetrust', phase: 'eds', work: 'none' },
    completed: 2,
    resources: [{}, {}],
  }), 'OneTrust weights');
  assert.equal(context.comparison.element.textContent.includes('load is incomplete'), false);
});
