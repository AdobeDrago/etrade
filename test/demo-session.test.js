/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  readDemoSession, readDemoUI, resetDemoSession, writeDemoSession,
} from '../scripts/demo-session.js';
import startTracking, { createTrackingQueue } from '../scripts/tracking.js';
import startPerformanceDemo, { resolvePerformanceConfig } from '../scripts/demo-performance.js';
import { performanceSessionRuns } from '../scripts/demo-session-history.js';
import mountTrackingControls from '../scripts/demo-tracking.js';
import mountDemoHelper from '../scripts/demo-helper.js';

const settle = () => new Promise((resolve) => { setImmediate(resolve); });
const manifest = {
  resources: [
    {
      id: 'cmp-stub', group: 'consent', decodedBytes: 1, encodedBytes: 1,
    },
    {
      id: 'cmp-banner', group: 'consent', decodedBytes: 1, encodedBytes: 1,
    },
    {
      id: 'tag-manager', group: 'tags', decodedBytes: 1, encodedBytes: 1,
    },
  ],
};
const dependencies = { fetchProfile: async () => manifest, importResource: async () => {} };

function browser(store = new Map(), path = '/home', host = 'localhost') {
  const { document, window } = parseHTML('<html><head></head><body><main><a href="/next?@tracking=home-next">Next</a></main></body></html>');
  const listeners = new Map();
  const observed = new Map();
  const timers = new Map();
  let timerId = 0;
  let clock = 0;
  let reloads = 0;
  const win = {
    location: {
      hostname: host,
      href: `https://${host}${path}`,
      reload: () => { reloads += 1; },
    },
    innerWidth: 1280,
    innerHeight: 900,
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    localStorage: { getItem: () => null },
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    performance: {
      timeOrigin: 1000,
      now: () => { clock += 1; return clock; },
      measure() {},
      getEntriesByType: () => [],
    },
    PerformanceObserver: class {
      static supportedEntryTypes = ['paint', 'largest-contentful-paint'];

      constructor(callback) { this.callback = callback; }

      observe({ type }) { observed.set(type, this.callback); }

      takeRecords() { this.records = []; return this.records; }

      disconnect() { this.callback = null; }
    },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return 0; },
    clearInterval() {},
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((callback) => callback(event));
    },
  };
  const emit = (name, detail) => win.dispatchEvent({ type: name, detail });
  return {
    document, window, win, store, observed, timers, emit, reloads: () => reloads,
  };
}

async function initializeCMP(context, controller) {
  controller.afterContent();
  const [id, timer] = [...context.timers].find(([, value]) => value.delay === 3000);
  context.timers.delete(id);
  timer.callback();
  await settle();
}

test('session storage is demo-host scoped, versioned and resilient to unavailable or corrupt storage', () => {
  const context = browser();
  assert.equal(writeDemoSession(context.win, 'ui', { view: 'tracking' }), true);
  assert.deepEqual(readDemoSession(context.win, 'ui'), { view: 'tracking' });
  context.store.set('etrade:demo-session:ui', '{bad');
  assert.equal(readDemoSession(context.win, 'ui'), null);
  context.store.set('etrade:demo-session:ui', '{"version":99,"value":{}}');
  assert.equal(readDemoSession(context.win, 'ui'), null);
  const production = browser(context.store, '/home', 'us.etrade.com');
  assert.equal(readDemoSession(production.win, 'ui'), null);
  assert.equal(writeDemoSession(production.win, 'ui', {}), false);
  context.win.sessionStorage.getItem = () => { throw new Error('Blocked'); };
  context.win.sessionStorage.setItem = () => { throw new Error('Blocked'); };
  assert.equal(readDemoSession(context.win, 'ui'), null);
  assert.equal(writeDemoSession(context.win, 'ui', {}), false);
});

test('real click history follows navigation and consent must be established again on the new page', async () => {
  const first = browser();
  const queue = startTracking(first.document, first.win);
  first.document.querySelector('a').dispatchEvent(new first.window.Event('click', { bubbles: true }));
  first.emit('OneTrustGroupsUpdated', ['C0004']);
  assert.equal(queue.snapshot().events[0].status, 'ready');
  const second = browser(first.store, '/bank');
  const restored = startTracking(second.document, second.win);
  assert.equal(restored.snapshot().events[0].key, 'home-next');
  assert.equal(restored.snapshot().events[0].payload.xdm.web.webPageDetails.URL, 'https://localhost/home');
  assert.equal(restored.snapshot().events[0].status, 'queued');
  assert.equal(restored.snapshot().consent.C0004, 'pending');
  const sent = [];
  await restored.setSender(async (event) => { sent.push(event.id); });
  assert.deepEqual(sent, []);
  second.emit('OneTrustGroupsUpdated', ['C0004']);
  await restored.flush();
  assert.deepEqual(sent, [1]);
  const third = browser(first.store, '/account');
  const afterSend = startTracking(third.document, third.win);
  third.emit('OneTrustGroupsUpdated', ['C0004']);
  await afterSend.setSender(async () => assert.fail('Sent history must not be replayed'));
  assert.equal(afterSend.snapshot().events[0].status, 'sent');
  assert.equal(afterSend.track({ key: 'another' }), 2);
});

test('interrupted sends are never retried, and malformed stored events cannot break tracking', async () => {
  const first = createTrackingQueue();
  first.track({ key: 'interrupted' });
  const initial = first.snapshot();
  initial.events[0].status = 'sending';
  initial.events.push({ ...initial.events[0], id: 2, key: [123] });
  const restored = createTrackingQueue({ initial });
  assert.equal(restored.snapshot().events.length, 1);
  assert.equal(restored.snapshot().events[0].status, 'failed');
  await restored.setConsent({ C0004: 'granted' });
  await restored.setSender(async () => assert.fail('An interrupted send might already be delivered'));
});

test('sample history and category choices restore independently of real consent', () => {
  const first = browser();
  mountTrackingControls(first.document, first.win);
  first.win.etradeDemoSampleTracking.track({ key: 'sample-home' });
  first.win.etradeDemoSampleTracking.setConsent({ C0004: 'granted' });
  const second = browser(first.store, '/bank');
  const controls = mountTrackingControls(second.document, second.win);
  assert.ok(controls.querySelector('.demo-helper-event-sandbox').textContent.includes('sample-home'));
  assert.ok(controls.querySelector('.demo-helper-event-sandbox').textContent.includes('Ready · destination not connected'));
  assert.equal(controls.querySelector('[aria-label="Sample C0004 consent"]').value, 'granted');
  assert.equal(second.win.etradeTracking.snapshot().events.length, 0);
  assert.equal(second.win.etradeTracking.snapshot().consent.C0004, 'pending');
  const separateTab = browser();
  mountTrackingControls(separateTab.document, separateTab.win);
  assert.equal(separateTab.win.etradeDemoSampleTracking.snapshot().events.length, 0);
});

test('performance mode follows plain links while each page gets fresh metrics and a retained run record', async () => {
  const first = browser(new Map(), '/home?perf=baseline');
  const baseline = startPerformanceDemo(first.document, first.win, dependencies);
  await baseline.ready;
  first.observed.get('paint')({ getEntries: () => [{ name: 'first-contentful-paint', startTime: 500 }] });
  await settle();
  const second = browser(first.store, '/bank');
  assert.deepEqual(resolvePerformanceConfig(second.win), { profile: 'baseline', phase: 'early', work: 'none' });
  const bank = startPerformanceDemo(second.document, second.win, dependencies);
  assert.equal(bank.snapshot().metrics.fcp, null);
  assert.equal(performanceSessionRuns(second.win).length, 2);
  assert.equal(performanceSessionRuns(second.win)[0].fcp, 500);
  assert.equal(performanceSessionRuns(second.win)[0].page, '/home');
  assert.equal(performanceSessionRuns(second.win)[1].page, '/bank');
  const override = browser(first.store, '/account?perf=etrade&perf-phase=eds');
  assert.equal(startPerformanceDemo(override.document, override.win, dependencies).config.profile, 'etrade');
  const off = browser(first.store, '/home?perf=off');
  assert.equal(startPerformanceDemo(off.document, off.win, dependencies), null);
  const next = browser(first.store, '/next');
  assert.equal(startPerformanceDemo(next.document, next.win, dependencies), null);
});

test('simulated consent persists but is applied only after CMP readiness; it cannot grant real consent', async () => {
  const first = browser(new Map(), '/home?perf=etrade&perf-phase=eds');
  const initial = startPerformanceDemo(first.document, first.win, dependencies);
  await initializeCMP(first, initial);
  initial.grantConsent();
  await settle();
  const second = browser(first.store, '/bank');
  const restored = startPerformanceDemo(second.document, second.win, dependencies);
  assert.equal(restored.snapshot().consent, 'pending');
  assert.equal(restored.snapshot().requested, 0);
  await initializeCMP(second, restored);
  assert.equal(restored.snapshot().cmpReady, true);
  assert.equal(restored.snapshot().consent, 'accepted');
  assert.equal(restored.snapshot().resources.find((resource) => resource.group === 'tags').status, 'loaded');
  restored.declineConsent();
  const declined = browser(first.store, '/declined');
  const held = startPerformanceDemo(declined.document, declined.win, dependencies);
  await initializeCMP(declined, held);
  assert.equal(held.snapshot().consent, 'declined');
  assert.equal(held.snapshot().resources.find((resource) => resource.group === 'tags').status, 'waiting');
  const real = browser(first.store, '/home?perf=onetrust-real&perf-phase=eds');
  const realController = startPerformanceDemo(real.document, real.win);
  realController.grantConsent();
  assert.equal(realController.snapshot().consent, 'pending');
  assert.equal(realController.snapshot().requested, 0);
});

test('panel view, measurement tab and named disclosures restore on a different page', () => {
  const first = browser();
  const root = mountDemoHelper(first.document, first.win);
  root.querySelector('#demo-helper-view-tab-1').dispatchEvent(new first.window.Event('click'));
  root.querySelector('#demo-helper-tab-2').dispatchEvent(new first.window.Event('click'));
  const settings = root.querySelector('[data-demo-state="performance.settings"]');
  settings.open = true;
  settings.dispatchEvent(new first.window.Event('toggle', { bubbles: true }));
  assert.equal(readDemoUI(first.win, 'performance.settings'), true);
  const second = browser(first.store, '/bank');
  const restored = mountDemoHelper(second.document, second.win);
  assert.equal(restored.querySelector('#demo-helper-view-tab-1').getAttribute('aria-selected'), 'true');
  assert.equal(restored.querySelector('#demo-helper-tab-2').getAttribute('aria-selected'), 'true');
  assert.equal(restored.querySelector('[data-demo-state="performance.settings"]').open, true);
});

test('unapplied performance form choices follow navigation without enabling a run', () => {
  const first = browser();
  const root = mountDemoHelper(first.document, first.win);
  const profile = root.querySelector('#demo-helper-performance-profile');
  profile.querySelector('[value="etrade"]').selected = true;
  profile.dispatchEvent(new first.window.Event('change', { bubbles: true }));
  const work = root.querySelector('#demo-helper-performance-work');
  work.querySelector('[value="medium"]').selected = true;
  work.dispatchEvent(new first.window.Event('change', { bubbles: true }));
  const second = browser(first.store, '/bank');
  assert.equal(resolvePerformanceConfig(second.win), null);
  const restored = mountDemoHelper(second.document, second.win);
  assert.equal(restored.querySelector('#demo-helper-performance-profile').value, 'etrade');
  assert.equal(restored.querySelector('#demo-helper-performance-work').value, 'medium');
});

test('history stays bounded and reset clears demo state without touching OneTrust or other storage', () => {
  const store = new Map([['OneTrust', 'unchanged'], ['unrelated', 'keep']]);
  for (let i = 0; i < 25; i += 1) {
    const context = browser(store, `/page-${i}?perf=baseline`);
    startPerformanceDemo(context.document, context.win, dependencies);
  }
  const context = browser(store);
  assert.equal(performanceSessionRuns(context.win).length, 20);
  assert.equal(performanceSessionRuns(context.win)[0].page, '/page-5');
  writeDemoSession(context.win, 'page-events', { events: [] });
  assert.equal(resetDemoSession(context.win), true);
  assert.equal(readDemoSession(context.win, 'performance-config'), null);
  assert.deepEqual(performanceSessionRuns(context.win), []);
  assert.equal(writeDemoSession(context.win, 'performance-runs', ['late pagehide']), false);
  assert.equal(store.get('OneTrust'), 'unchanged');
  assert.equal(store.get('unrelated'), 'keep');
});

test('returning through the browser cache reloads stale demo objects from the latest session', () => {
  const context = browser();
  startTracking(context.document, context.win);
  context.win.dispatchEvent({ type: 'pageshow', persisted: false });
  assert.equal(context.reloads(), 0);
  context.win.dispatchEvent({ type: 'pageshow', persisted: true });
  assert.equal(context.reloads(), 1);
});
