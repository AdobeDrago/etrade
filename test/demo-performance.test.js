/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import startPerformanceDemo, { readPerformanceConfig, performanceURL } from '../scripts/demo-performance.js';
import mountPerformanceControls from '../scripts/demo-performance-controls.js';
import mountDemoHelper from '../scripts/demo-helper.js';

const manifest = JSON.parse(await readFile(new URL('../scripts/demo-performance-profile.json', import.meta.url)));

function browser(query, hostname = 'localhost') {
  const { document, window } = parseHTML('<html><head></head><body><main><button>FAQ</button></main></body></html>');
  const observed = new Map();
  const queued = new Map();
  const timers = new Map();
  const consentEvents = [];
  const listeners = new Map();
  let clock = 0;
  let timerID = 0;
  const win = {
    location: { hostname, href: `http://${hostname}/home${query}` },
    CustomEvent: window.CustomEvent,
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) {
      consentEvents.push({ type: event.type, detail: event.detail });
      listeners.get(event.type)?.(event);
      return true;
    },
    performance: {
      timeOrigin: 1000,
      now: () => { clock += 1; return clock; },
      measure() {},
      getEntriesByType: () => [],
    },
    PerformanceObserver: class {
      static supportedEntryTypes = ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask', 'event'];

      constructor(callback) { this.callback = callback; }

      observe({ type }) { this.type = type; observed.set(type, this.callback); }

      takeRecords() {
        const entries = queued.get(this.type) || [];
        queued.delete(this.type);
        return entries;
      }

      disconnect() { this.callback = null; }
    },
    setTimeout(callback, delay) {
      timerID += 1;
      timers.set(timerID, { callback, delay });
      return timerID;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback, delay) {
      timerID += 1;
      timers.set(timerID, { callback, delay, interval: true });
      return timerID;
    },
    clearInterval(id) { timers.delete(id); },
  };
  return {
    document, win, timers, observed, queued, window, consentEvents,
  };
}

async function settle() {
  await new Promise((resolve) => { setImmediate(resolve); });
}

async function delayedCMP(context, controller) {
  controller.afterContent();
  const [id, timer] = [...context.timers.entries()].find(([, value]) => value.delay === 3000);
  context.timers.delete(id);
  timer.callback();
  await settle();
}

test('disabled, malformed and non-demo URLs never fetch, observe or create a controller', () => {
  ['', '?perf=unknown', '?perf=etrade&perf-work=heavy'].forEach((query, index) => {
    const context = browser(query, index === 2 ? 'main--etrade--adobedrago.aem.page' : 'localhost');
    const result = startPerformanceDemo(context.document, context.win, {
      fetchProfile: () => { throw new Error('Unexpected request'); },
    });
    assert.equal(result, null);
    assert.equal(context.observed.size, 0);
    assert.equal(context.win.etradePerformanceDemo, undefined);
  });
});

test('demo-controller preview supports performance comparisons while remaining opt-in', async () => {
  const hostname = 'demo-controller--etrade--adobedrago.aem.page';
  const disabled = browser('', hostname);
  assert.equal(startPerformanceDemo(disabled.document, disabled.win), null);
  assert.equal(disabled.observed.size, 0);
  const context = browser('?perf=baseline', hostname);
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: () => { throw new Error('Baseline must not request fixtures'); },
  });
  await controller.ready;
  assert.equal(controller.snapshot().config.profile, 'baseline');
  assert.equal(controller.snapshot().requested, 0);
  assert.equal(context.observed.size, 5);
  controller.stop();
});

test('baseline measures without fixture requests; comparison URLs preserve page settings and hash', async () => {
  const context = browser('?perf=baseline');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: () => { throw new Error('Unexpected request'); },
  });
  await controller.ready;
  assert.equal(controller.snapshot().requested, 0);
  assert.equal(context.observed.size, 5);
  const href = 'https://localhost/home?balance=10000&perf=etrade&perf-work=heavy#faq';
  const url = new URL(performanceURL(href, { profile: 'baseline', phase: 'early', work: 'none' }));
  assert.equal(url.searchParams.get('balance'), '10000');
  assert.equal(url.hash, '#faq');
  assert.equal(readPerformanceConfig(url.href).profile, 'baseline');
  assert.equal(new URL(performanceURL(href, null)).searchParams.has('perf-work'), false);
});

test('startup waits for blocking scripts and leaves the asynchronous banner in flight', async () => {
  const context = browser('?perf=etrade');
  const pending = new Map();
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: (url) => new Promise((resolve) => {
      const id = new URL(url).pathname.split('/').at(-1).replace('.js', '');
      requested.push(id);
      pending.set(id, resolve);
    }),
  });
  await settle();
  assert.deepEqual(requested, ['cmp-stub']);
  pending.get('cmp-stub')();
  await settle();
  assert.equal(requested[0], 'cmp-stub');
  assert.deepEqual(new Set(requested.slice(1)), new Set(['cmp-banner', 'tag-manager']));
  pending.get('tag-manager')();
  await controller.ready;
  assert.equal(controller.snapshot().resources.find((resource) => resource.id === 'cmp-banner').status, 'loading');
  controller.stop();
  [...pending.values()].forEach((resolve) => resolve());
  await settle();
  assert.equal(controller.snapshot().simulatedCPU, 0);
  assert.equal(context.timers.size, 0);
});

test('late and consent modes hold all tags and start each fixture once when released', async () => {
  await Promise.all(['late', 'consent'].map(async (phase) => {
    const context = browser(`?perf=etrade&perf-phase=${phase}`);
    const requested = [];
    const controller = startPerformanceDemo(context.document, context.win, {
      fetchProfile: async () => manifest,
      importResource: async (url) => { requested.push(new URL(url).pathname); },
    });
    await controller.ready;
    await settle();
    assert.equal(requested.length, 2);
    if (phase === 'late') { controller.afterContent(); controller.afterContent(); } else { controller.grantConsent(); controller.grantConsent(); }
    await settle();
    assert.equal(requested.length, manifest.resources.length);
    assert.equal(new Set(requested).size, requested.length);
    assert.equal(controller.snapshot().completed, manifest.resources.length);
    assert.equal(controller.snapshot().runtimeActive, false);
    controller.stop();
  }));
});

test('fixture failures do not stall page readiness and stop cancels interaction/background work', async () => {
  const context = browser('?perf=etrade&perf-work=heavy');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => { if (url.includes('cmp-stub')) throw new Error('Unavailable'); },
  });
  await controller.ready;
  await settle();
  assert.equal(controller.snapshot().failed, 1);
  controller.afterContent();
  assert.equal(controller.snapshot().runtimeActive, true);
  const expiry = [...context.timers.values()].find((timer) => timer.delay === 30000);
  assert.ok(expiry);
  expiry.callback();
  const before = controller.snapshot().simulatedCPU;
  context.document.querySelector('button').dispatchEvent(new context.window.Event('click', { bubbles: true }));
  assert.equal(controller.snapshot().simulatedCPU, before);
  assert.equal(controller.snapshot().runtimeActive, false);
  assert.equal(context.timers.size, 0);
  controller.stop();
});

test('unsupported metrics remain unavailable; CLS uses session windows and recent-input shifts are excluded', async () => {
  const context = browser('?perf=baseline');
  const controller = startPerformanceDemo(context.document, context.win);
  await controller.ready;
  const shifts = [
    { startTime: 100, value: 0.1 }, { startTime: 200, value: 0.2 },
    { startTime: 300, value: 1, hadRecentInput: true }, { startTime: 2000, value: 0.25 },
  ];
  context.observed.get('layout-shift')({ getEntries: () => shifts });
  context.observed.get('event')({ getEntries: () => [{ interactionId: 1, duration: 120 }] });
  assert.ok(Math.abs(controller.snapshot().metrics.cls - 0.3) < 0.0001);
  assert.equal(controller.snapshot().metrics.worstInteraction, 120);
  delete context.win.PerformanceObserver;
  delete context.win.etradePerformanceDemo;
  const unsupported = startPerformanceDemo(context.document, context.win);
  assert.equal(unsupported.snapshot().metrics.cls, null);
});

test('inert fixtures match captured decoded sizes and compression budgets without vendor code', async () => {
  await Promise.all(manifest.resources.map(async (resource) => {
    const body = await readFile(new URL(`../scripts/demo-performance-assets/${resource.id}.js`, import.meta.url));
    assert.equal(body.length, resource.decodedBytes, resource.id);
    const difference = Math.abs(gzipSync(body).length - resource.gzipBytes);
    assert.ok(difference < resource.gzipBytes * 0.005 + 100, resource.id);
    assert.ok(!/https?:|fetch\(|document\.|window\./.test(body.toString()), resource.id);
    const module = await import(`../scripts/demo-performance-assets/${resource.id}.js`);
    assert.ok(Array.isArray(module.default));
  }));
});

test('refresh drains queued observations once and CLS starts its window at the first shift', () => {
  const context = browser('?perf=baseline');
  const controller = startPerformanceDemo(context.document, context.win);
  context.queued.set('event', [{ interactionId: 1, duration: 88 }]);
  context.queued.set('longtask', [{ duration: 90 }]);
  // A first shift at 900 ms starts a five-second window, rather than navigation at 0.
  context.queued.set('layout-shift', [900, 1800, 2700, 3600, 4500, 5400]
    .map((startTime) => ({ startTime, value: 0.1 })));
  assert.equal(controller.snapshot().metrics.worstInteraction, null);
  controller.refreshMeasurements();
  assert.equal(controller.snapshot().metrics.worstInteraction, 88);
  assert.ok(Math.abs(controller.snapshot().metrics.cls - 0.6) < 0.0001);
  assert.equal(controller.snapshot().metrics.longTasks, 1);
  controller.refreshMeasurements();
  assert.equal(controller.snapshot().metrics.longTasks, 1);
  controller.stop();
});

test('measurement tabs preserve selection and refresh waits for paint with visible feedback', async () => {
  const context = browser('?perf=baseline');
  const frames = [];
  context.win.requestAnimationFrame = (callback) => frames.push(callback);
  const controller = startPerformanceDemo(context.document, context.win);
  const controls = mountPerformanceControls(context.document, context.win);
  const tabs = [...controls.querySelectorAll('[role="tab"]')];
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(controls.querySelector('[role="tabpanel"] h4').textContent, 'Core Web Vitals');
  let focused;
  tabs.forEach((tab) => { tab.focus = () => { focused = tab; }; });
  const arrow = new context.window.Event('keydown', { cancelable: true });
  arrow.key = 'ArrowRight';
  tabs[0].dispatchEvent(arrow);
  assert.equal(focused, tabs[1]);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  const refresh = [...controls.querySelectorAll('button')]
    .find((element) => element.textContent === 'Refresh measurements');
  context.queued.set('largest-contentful-paint', [{ startTime: 1234 }]);
  refresh.dispatchEvent(new context.window.Event('click'));
  assert.equal(refresh.disabled, true);
  assert.equal(controller.snapshot().metrics.lcp, null);
  frames.shift()();
  assert.equal(controller.snapshot().metrics.lcp, null);
  frames.shift()();
  const [id, timer] = [...context.timers.entries()].find(([, value]) => value.delay === 0);
  context.timers.delete(id);
  timer.callback();
  assert.equal(controller.snapshot().metrics.lcp, 1234);
  assert.ok(controls.textContent.includes('Measurements updated (1)'));
  assert.equal(refresh.disabled, false);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  controller.stop();
});

test('new browser measurements update the panel automatically and batch notifications', async () => {
  const context = browser('?perf=baseline&perf-work=heavy');
  const controller = startPerformanceDemo(context.document, context.win);
  const controls = mountPerformanceControls(context.document, context.win);
  const tabs = [...controls.querySelectorAll('[role="tab"]')];
  tabs[1].dispatchEvent(new context.window.Event('click'));
  let updates = 0;
  context.document.addEventListener('demo-performance:updated', () => { updates += 1; });
  context.observed.get('paint')({
    getEntries: () => [{ name: 'first-contentful-paint', startTime: 820 }],
  });
  context.observed.get('largest-contentful-paint')({ getEntries: () => [{ startTime: 1240 }] });
  context.observed.get('layout-shift')({
    getEntries: () => [{ startTime: 1500, value: 0.025, hadRecentInput: false }],
  });
  await settle();
  assert.equal(updates, 1);
  assert.ok(controls.querySelector('.demo-helper-vitals').textContent.includes('1240 ms'));
  assert.ok(controls.querySelector('.demo-helper-vitals').textContent.includes('0.025'));
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  const label = controls.querySelector('.demo-helper-run-label').textContent;
  assert.equal(label.includes('assumed CPU'), false);
  controller.stop();
});

test('each loading strategy explains its release condition and downloads separate CMP and tags', async () => {
  const context = browser('?perf=etrade&perf-phase=early');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest, importResource: async () => {},
  });
  const controls = mountPerformanceControls(context.document, context.win);
  const phase = controls.querySelector('#demo-helper-performance-phase');
  const help = controls.querySelector('#demo-helper-strategy-help');
  ['eds', 'early', 'late', 'consent'].forEach((value) => {
    [...phase.options].forEach((option) => option.removeAttribute('selected'));
    phase.querySelector(`[value="${value}"]`).setAttribute('selected', '');
    phase.dispatchEvent(new context.window.Event('change'));
    if (value === 'late') assert.ok(help.textContent.includes('without waiting for consent'));
    if (value === 'consent') assert.ok(help.textContent.includes('wait for you to accept'));
    if (value === 'eds') assert.ok(help.textContent.includes('3 seconds'));
    if (value === 'early') assert.ok(help.textContent.includes('before page content'));
  });
  await controller.ready;
  await settle();
  assert.ok(controls.textContent.includes('3.35 MB'));
  assert.ok(controls.textContent.includes('593.4 kB'));
  assert.ok(controls.textContent.includes('930.9 kB'));
  assert.ok(controls.textContent.includes('No real OneTrust banner'));
  controller.stop();
});

test('EDS never holds page readiness and delays the CMP profile and fixtures until after content', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  const requested = [];
  let profiles = 0;
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => { profiles += 1; return manifest; },
    importResource: async (url) => { requested.push(new URL(url).pathname); },
  });
  await controller.ready;
  assert.equal(profiles, 0);
  assert.deepEqual(requested, []);
  controller.afterContent();
  controller.afterContent();
  assert.equal(context.timers.size, 1);
  assert.equal(profiles, 0);
  await delayedCMP(context, controller);
  assert.equal(profiles, 1);
  assert.equal(requested.length, 2);
  const snapshot = controller.snapshot();
  assert.equal(snapshot.cmpReady, true);
  assert.ok(snapshot.milestones.cmpStarted > snapshot.milestones.contentReady);
  assert.equal(snapshot.milestones.tagsStarted, undefined);
  controller.stop();
});

test('EDS decline leaves tags unloaded; repeated acceptance imports the selected tags once', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => { requested.push(new URL(url).pathname); },
  });
  await delayedCMP(context, controller);
  controller.declineConsent();
  controller.declineConsent();
  await settle();
  assert.equal(requested.length, 2);
  assert.equal(controller.snapshot().consent, 'declined');
  controller.grantConsent();
  controller.grantConsent();
  await settle();
  const snapshot = controller.snapshot();
  assert.equal(requested.length, manifest.resources.length);
  assert.equal(new Set(requested).size, requested.length);
  assert.equal(snapshot.completed, manifest.resources.length);
  assert.ok(snapshot.milestones.tagsStarted > snapshot.milestones.cmpReady);
  assert.deepEqual(context.consentEvents, [
    { type: 'demo-performance:consent.update', detail: { consented: false, simulated: true } },
    { type: 'demo-performance:consent.update', detail: { consented: true, simulated: true } },
  ]);
  controller.stop();
});

test('consent granted before EDS content cannot bypass delayed CMP initialization', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => { requested.push(new URL(url).pathname); },
  });
  controller.grantConsent();
  await controller.ready;
  assert.equal(requested.length, 0);
  await delayedCMP(context, controller);
  assert.equal(requested.length, manifest.resources.length);
  controller.stop();
});

test('EDS revocation stops interaction and background processing; acceptance resumes without reimporting', async () => {
  const context = browser('?perf=etrade&perf-phase=eds&perf-work=heavy');
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => { requested.push(new URL(url).pathname); },
  });
  await delayedCMP(context, controller);
  controller.grantConsent();
  await settle();
  assert.equal(controller.snapshot().runtimeActive, true);
  const click = () => context.document.querySelector('main button')
    .dispatchEvent(new context.window.Event('click', { bubbles: true }));
  const loaded = controller.snapshot().simulatedCPU;
  click();
  assert.ok(controller.snapshot().simulatedCPU > loaded);
  controller.declineConsent();
  controller.runInteractions();
  const revoked = controller.snapshot();
  assert.equal(revoked.runtimeActive, false);
  assert.equal(context.timers.size, 0);
  click();
  assert.equal(controller.snapshot().simulatedCPU, revoked.simulatedCPU);
  controller.grantConsent();
  await settle();
  assert.equal(controller.snapshot().runtimeActive, true);
  assert.equal(requested.length, manifest.resources.length);
  controller.stop();
});

test('revoking while Launch loads holds dependent tags and reaccepting resumes without duplicate requests', async () => {
  const context = browser('?perf=etrade&perf-phase=eds&perf-work=heavy');
  const requested = [];
  let releaseLaunch;
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => {
      const id = new URL(url).pathname.split('/').at(-1).replace('.js', '');
      requested.push(id);
      if (id === 'tag-manager') await new Promise((resolve) => { releaseLaunch = resolve; });
    },
  });
  await delayedCMP(context, controller);
  controller.grantConsent();
  await settle();
  assert.equal(requested.length, 3);
  const before = controller.snapshot().simulatedCPU;
  controller.declineConsent();
  releaseLaunch();
  await settle();
  assert.equal(requested.length, 3);
  assert.equal(controller.snapshot().simulatedCPU, before);
  controller.grantConsent();
  await settle();
  assert.equal(requested.length, manifest.resources.length);
  assert.equal(new Set(requested).size, requested.length);
  assert.equal(controller.snapshot().completed, manifest.resources.length);
  controller.stop();
});

test('stopping EDS before its delayed phase cancels all profile and fixture requests', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: () => assert.fail('A stopped simulation must not fetch'),
  });
  controller.afterContent();
  const timer = [...context.timers.values()][0];
  controller.stop();
  assert.equal(context.timers.size, 0);
  timer.callback();
  controller.grantConsent();
  await settle();
  assert.equal(controller.snapshot().requested, 0);
});

test('failed EDS consent fixtures keep the tracking gate closed without blocking the page', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => {
      requested.push(url);
      if (url.includes('cmp-banner')) throw new Error('Unavailable');
    },
  });
  await controller.ready;
  await delayedCMP(context, controller);
  controller.grantConsent();
  await settle();
  assert.equal(requested.length, 2);
  assert.equal(controller.snapshot().cmpReady, false);
  assert.equal(controller.snapshot().failed, 1);
  controller.stop();
});

test('startup and EDS use identical source weights and initialization processing budgets', async () => {
  const snapshots = await Promise.all(['early', 'eds'].map(async (phase) => {
    const context = browser(`?perf=etrade&perf-phase=${phase}&perf-work=heavy`);
    const controller = startPerformanceDemo(context.document, context.win, {
      fetchProfile: async () => manifest,
      importResource: async () => {},
    });
    await controller.ready;
    if (phase === 'eds') {
      await delayedCMP(context, controller);
      controller.grantConsent();
    }
    await settle();
    const snapshot = controller.snapshot();
    controller.stop();
    return snapshot;
  }));
  assert.equal(snapshots[0].decodedBytes, snapshots[1].decodedBytes);
  assert.equal(snapshots[0].observedEncodedBytes, snapshots[1].observedEncodedBytes);
  assert.equal(snapshots[0].simulatedCPU, snapshots[1].simulatedCPU);
  assert.deepEqual(
    snapshots[0].resources.map((resource) => resource.id),
    snapshots[1].resources.map((resource) => resource.id),
  );
});

test('controls enable accept and decline only when the simulated CMP is ready and preserve workload in comparison URLs', async () => {
  const context = browser('?balance=10000&perf=etrade&perf-phase=eds&perf-work=medium');
  let destination;
  context.win.location.assign = (url) => { destination = url; };
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async () => {},
  });
  const controls = mountPerformanceControls(context.document, context.win);
  const buttons = [...controls.querySelectorAll('button')];
  const accept = buttons.find((button) => button.getAttribute('aria-label') === 'Accept simulated tracking');
  const decline = buttons.find((button) => button.getAttribute('aria-label') === 'Decline simulated tracking');
  assert.equal(accept.disabled, true);
  assert.equal(decline.disabled, true);
  await delayedCMP(context, controller);
  assert.equal(accept.disabled, false);
  accept.dispatchEvent(new context.window.Event('click'));
  await settle();
  assert.equal(controller.snapshot().consent, 'accepted');
  decline.dispatchEvent(new context.window.Event('click'));
  assert.equal(controller.snapshot().runtimeActive, false);
  controls.querySelector('form').dispatchEvent(new context.window.Event('submit', { cancelable: true }));
  const url = new URL(destination);
  assert.equal(url.searchParams.get('balance'), '10000');
  assert.equal(url.searchParams.get('perf-work'), 'medium');
  assert.equal(url.searchParams.get('perf-phase'), 'eds');
  controller.stop();
});

test('quick comparisons preserve processing, page parameters and hash without silently starting a workload', () => {
  const context = browser('?balance=0&perf=etrade&perf-phase=consent&perf-work=medium#rates');
  const session = new Map();
  context.win.sessionStorage = { setItem: (key, value) => session.set(key, value) };
  let destination;
  context.win.location.assign = (url) => { destination = new URL(url); };
  const controls = mountPerformanceControls(context.document, context.win);
  const scenarios = [...controls.querySelectorAll('.demo-helper-scenario')];
  const choices = [['baseline', 'eds'], ['etrade', 'early'], ['etrade', 'eds']];
  scenarios.forEach((scenario, index) => {
    scenario.dispatchEvent(new context.window.Event('click'));
    assert.equal(destination.searchParams.get('perf'), choices[index][0]);
    assert.equal(destination.searchParams.get('perf-phase'), choices[index][1]);
    assert.equal(destination.searchParams.get('perf-work'), 'medium');
    assert.equal(destination.searchParams.get('balance'), '0');
    assert.equal(destination.hash, '#rates');
  });
  assert.equal(session.get('etrade:demo-helper-open'), 'true');
  assert.equal(session.get('etrade:demo-helper-view'), 'performance');
  assert.equal(context.win.etradePerformanceDemo, undefined);
  const disabled = browser('', 'main--etrade--adobedrago.aem.page');
  disabled.win.location.assign = () => assert.fail('Must not navigate from a non-demo host');
  mountPerformanceControls(disabled.document, disabled.win).querySelector('.demo-helper-scenario')
    .dispatchEvent(new disabled.window.Event('click'));
});

test('loading progress reflects real milestones, held tags and revocation after download', async () => {
  const context = browser('?perf=etrade&perf-phase=eds&perf-work=none');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest, importResource: async () => {},
  });
  const controls = mountPerformanceControls(context.document, context.win);
  const stage = (key) => controls.querySelector(`[data-stage="${key}"]`);
  assert.equal(stage('content').querySelector('strong').textContent, 'Waiting');
  assert.equal(stage('tags').querySelector('strong').textContent, 'Awaiting consent');
  await delayedCMP(context, controller);
  assert.equal(stage('content').dataset.state, 'done');
  assert.equal(stage('cmp').dataset.state, 'done');
  assert.equal(stage('tags').querySelector('strong').textContent, 'Awaiting consent');
  assert.equal(controller.snapshot().requested, 2);
  controller.grantConsent();
  await settle();
  assert.equal(stage('tags').querySelector('strong').textContent, 'Loaded');
  assert.ok(stage('tags').querySelector('.demo-helper-stage-timing').textContent.startsWith('at '));
  const { milestones } = controller.snapshot();
  assert.ok(milestones.tagsReady > milestones.tagsStarted);
  controller.declineConsent();
  assert.equal(stage('tags').querySelector('strong').textContent, 'Declined');
  const instruction = controls.querySelector('.demo-helper-next-step').textContent;
  assert.ok(instruction.includes('downloaded scripts stay in memory'));
  controller.stop();
  assert.equal(stage('tags').querySelector('strong').textContent, 'Stopped');
});

test('comparison links copy the current URL, offer a manual fallback and rerun the current configuration', async () => {
  const context = browser('?perf=baseline&perf-phase=eds&perf-work=none#rates');
  let copied;
  let reloads = 0;
  context.win.navigator = { clipboard: { writeText: async (value) => { copied = value; } } };
  context.win.location.reload = () => { reloads += 1; };
  const controls = mountPerformanceControls(context.document, context.win);
  const click = (text) => [...controls.querySelectorAll('button')]
    .find((element) => element.textContent === text).dispatchEvent(new context.window.Event('click'));
  click('Copy comparison link');
  await settle();
  assert.equal(copied, context.win.location.href);
  assert.ok(controls.textContent.includes('link copied'));
  assert.equal(controls.querySelector('input[aria-label="Comparison link"]').hidden, true);
  context.win.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  click('Copy comparison link');
  await settle();
  const input = controls.querySelector('input[aria-label="Comparison link"]');
  assert.equal(input.hidden, false);
  assert.equal(input.value, context.win.location.href);
  assert.equal(input.readOnly, true);
  click('Run again');
  assert.equal(reloads, 1);
});

test('real CMP starts asynchronously without fixture requests or simulated work', async () => {
  const context = browser('?perf=onetrust-real&perf-phase=early&perf-work=heavy&consent=accept');
  let imported = 0;
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: () => assert.fail('Real mode must not fetch the fixture profile'),
    importResource: () => assert.fail('Real mode must not import simulated libraries'),
    oneTrust: { loadConsented: async () => { imported += 1; } },
  });
  await controller.ready;
  assert.equal(controller.config.work, 'none');
  assert.ok(context.document.querySelector('script[src*="otSDKStub.js"]'));
  assert.equal(controller.snapshot().cmpReady, false);
  controller.afterContent();
  controller.grantConsent();
  controller.declineConsent();
  await settle();
  assert.equal(controller.snapshot().consent, 'pending');
  assert.equal(imported, 0);
  context.win.OnetrustActiveGroups = ',C0002,C0004,';
  context.win.OptanonWrapper();
  await settle();
  assert.equal(controller.snapshot().consent, 'accepted');
  assert.equal(controller.snapshot().realCMP.consentedModule, 'Loaded');
  assert.equal(imported, 1);
  assert.equal(controller.snapshot().simulatedCPU, 0);
  assert.equal(controller.snapshot().resources.length, 0);
  controller.stop();
});

test('real EDS mode postpones the SDK until after content and keeps a blocked CMP closed', async () => {
  const context = browser('?perf=onetrust-real&perf-phase=eds');
  const controller = startPerformanceDemo(context.document, context.win);
  const controls = mountPerformanceControls(context.document, context.win);
  await controller.ready;
  assert.equal(context.document.querySelector('script'), null);
  await delayedCMP(context, controller);
  const script = context.document.querySelector('script');
  assert.ok(script.src.includes('/otSDKStub.js'));
  script.dispatchEvent(new context.window.Event('load'));
  [...context.timers.values()].find((timer) => timer.delay === 15000).callback();
  assert.equal(controller.snapshot().cmpReady, false);
  assert.equal(controller.snapshot().consent, 'pending');
  assert.ok(controller.snapshot().status.includes('CMP did not initialize'));
  assert.equal(controls.querySelector('[data-stage="cmp"]').dataset.state, 'error');
  assert.equal(controls.querySelector('[data-stage="tags"] strong').textContent, 'Closed');
  controller.stop();
});

test('real network measurements exclude fixtures and distinguish unavailable cross-origin sizes', () => {
  const context = browser('?perf=onetrust-real');
  let entries = [
    {
      name: 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js', duration: 140, transferSize: 9000, decodedBodySize: 27000,
    },
    {
      name: 'http://localhost/scripts/demo-performance-assets/cmp-stub.js', duration: 5, transferSize: 27000, decodedBodySize: 27000,
    },
    {
      name: 'https://cookielaw.org.example.com/pixel.js', duration: 50, transferSize: 999, decodedBodySize: 999,
    },
  ];
  context.win.performance.getEntriesByType = () => entries;
  const controller = startPerformanceDemo(context.document, context.win);
  assert.equal(controller.snapshot().realResources.length, 1);
  assert.equal(controller.snapshot().actualTransferBytes, 9000);
  assert.equal(controller.snapshot().actualDecodedBytes, 27000);
  entries = [...entries, {
    name: 'https://cdn.cookielaw.org/consent/domain/domain.json',
    duration: 80,
    transferSize: 0,
    decodedBodySize: 0,
  }];
  assert.equal(controller.snapshot().actualTransferBytes, null);
  assert.equal(controller.snapshot().restrictedSizes, true);
  controller.stop();
});

test('real controls expose two valid strategies and real preferences without simulated consent', () => {
  const context = browser('?perf=onetrust-real&perf-phase=eds');
  const controller = startPerformanceDemo(context.document, context.win);
  const controls = mountPerformanceControls(context.document, context.win);
  const phase = controls.querySelector('#demo-helper-performance-phase');
  assert.deepEqual([...phase.options].map((option) => option.value), ['eds', 'early']);
  assert.equal(controls.querySelector('#demo-helper-performance-work').disabled, true);
  const buttons = [...controls.querySelectorAll('button')];
  assert.equal(buttons.find((element) => element.getAttribute('aria-label') === 'Accept simulated tracking').hidden, true);
  assert.equal(buttons.find((element) => element.getAttribute('aria-label') === 'Decline simulated tracking').hidden, true);
  assert.equal(buttons.find((element) => element.textContent === 'Open OneTrust preferences').disabled, true);
  assert.equal(controls.querySelectorAll('[role="tab"]')[2].textContent, 'Consent');
  assert.ok(controls.textContent.includes('Unavailable'));
  assert.equal(controls.querySelector('.demo-helper-banner-control').hidden, true);
  assert.equal(context.document.querySelector('.demo-cookie-banner').hidden, true);
  controller.stop();
});

test('demo banner is opt-in, waits for CMP readiness and shares the panel consent actions', async () => {
  const context = browser('?perf=etrade&perf-phase=eds&perf-work=medium');
  const requested = [];
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest,
    importResource: async (url) => { requested.push(new URL(url).pathname); },
  });
  const controls = mountPerformanceControls(context.document, context.win);
  const toggle = controls.querySelector('.demo-helper-banner-toggle input');
  const banner = context.document.querySelector('.demo-cookie-banner');
  assert.equal(banner.parentElement, context.document.body);
  assert.equal(controls.contains(banner), false);
  const click = (text) => [...controls.querySelectorAll('button'), ...banner.querySelectorAll('button')]
    .find((element) => element.textContent === text || element.getAttribute('aria-label') === text)
    .dispatchEvent(new context.window.Event('click'));
  assert.equal(toggle.checked, false);
  assert.equal(banner.hidden, true);
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  assert.equal(banner.hidden, true);
  assert.ok(controls.textContent.includes('will appear when simulated OneTrust is ready'));
  await delayedCMP(context, controller);
  assert.equal(banner.hidden, false);
  assert.ok(banner.textContent.includes('This is a demo banner;'));
  click('Decline');
  assert.equal(controller.snapshot().consent, 'declined');
  assert.equal(banner.hidden, true);
  assert.equal(toggle.checked, false);
  assert.equal(requested.length, 2);
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  assert.equal(banner.hidden, false);
  click('Accept');
  await settle();
  assert.equal(controller.snapshot().consent, 'accepted');
  assert.equal(controller.snapshot().completed, manifest.resources.length);
  assert.equal(banner.hidden, true);
  const cpuBeforeChoice = controller.snapshot().simulatedCPU;
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  click('Accept');
  assert.equal(controller.snapshot().simulatedCPU, cpuBeforeChoice);
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  click('Accept simulated tracking'); // Repeating the same panel choice also dismisses the banner.
  assert.equal(banner.hidden, true);
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  click('Decline simulated tracking');
  assert.equal(controller.snapshot().consent, 'declined');
  assert.equal(controller.snapshot().runtimeActive, false);
  assert.equal(banner.hidden, true);
  assert.ok(context.consentEvents.every((event) => event.type === 'demo-performance:consent.update'));
  controller.stop();
});

test('banner stays absent from comparisons without a simulated consent gate and dismisses on stop', async () => {
  await Promise.all(['', '?perf=baseline', '?perf=onetrust', '?perf=etrade&perf-phase=early', '?perf=etrade&perf-phase=late']
    .map(async (query) => {
      const context = browser(query);
      const controller = startPerformanceDemo(context.document, context.win, {
        fetchProfile: async () => manifest, importResource: async () => {},
      });
      await controller?.ready;
      await settle();
      const controls = mountPerformanceControls(context.document, context.win);
      assert.equal(controls.querySelector('.demo-helper-banner-control').hidden, true);
      assert.equal(context.document.querySelector('.demo-cookie-banner').hidden, true);
      controller?.stop();
    }));
  const context = browser('?perf=etrade&perf-phase=consent');
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest, importResource: async () => {},
  });
  const controls = mountPerformanceControls(context.document, context.win);
  await controller.ready;
  await settle();
  const toggle = controls.querySelector('.demo-helper-banner-toggle input');
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  assert.equal(context.document.querySelector('.demo-cookie-banner').hidden, false);
  controller.stop();
  assert.equal(context.document.querySelector('.demo-cookie-banner').hidden, true);
  assert.equal(toggle.disabled, true);
});

test('page banner survives closing the panel, reserves space and restores focus after a choice', async () => {
  const context = browser('?perf=etrade&perf-phase=eds');
  context.win.innerHeight = 900;
  context.win.MutationObserver = function MutationObserver() { this.observe = () => {}; };
  const controller = startPerformanceDemo(context.document, context.win, {
    fetchProfile: async () => manifest, importResource: async () => {},
  });
  const helper = mountDemoHelper(context.document, context.win);
  const banner = context.document.querySelector('.demo-cookie-banner');
  banner.getBoundingClientRect = () => ({ top: 740, height: 144 });
  let focused;
  Object.defineProperty(context.document, 'activeElement', { get: () => focused });
  context.document.querySelectorAll('button, input').forEach((element) => {
    element.focus = () => { focused = element; };
  });
  const toggle = helper.querySelector('.demo-helper-banner-toggle input');
  helper.querySelector('.demo-helper-toggle').dispatchEvent(new context.window.Event('click'));
  assert.equal(helper.querySelector('.demo-helper-panel').hidden, false);
  await delayedCMP(context, controller);
  toggle.checked = true;
  toggle.dispatchEvent(new context.window.Event('change'));
  assert.equal(helper.style.getPropertyValue('--demo-helper-bottom'), '172px');
  const performance = helper.querySelector('.demo-helper-performance');
  performance.open = false;
  helper.querySelector('.demo-helper-close').dispatchEvent(new context.window.Event('click'));
  assert.equal(helper.querySelector('.demo-helper-panel').hidden, true);
  assert.equal(banner.hidden, false);
  const accept = [...banner.querySelectorAll('button')].find((element) => element.textContent === 'Accept');
  accept.focus();
  accept.dispatchEvent(new context.window.Event('click', { bubbles: true }));
  await settle();
  assert.equal(controller.snapshot().consent, 'accepted');
  assert.equal(banner.hidden, true);
  assert.equal(helper.style.getPropertyValue('--demo-helper-bottom'), '16px');
  assert.equal(focused, helper.querySelector('.demo-helper-toggle'));
  controller.stop();
});
