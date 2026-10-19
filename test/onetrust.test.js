/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import startOneTrust, { ONETRUST_SRC, ONETRUST_DOMAIN_ID } from '../scripts/onetrust.js';

function browser(head = '') {
  const { document, window } = parseHTML(`<html><head>${head}</head><body></body></html>`);
  const events = [];
  const changes = [];
  const listeners = new Map();
  const timers = new Map();
  let imports = 0;
  let now = 0;
  const win = {
    CustomEvent: window.CustomEvent,
    performance: { now: () => { now += 10; return now; } },
    addEventListener: (name, callback) => listeners.set(name, callback),
    dispatchEvent(event) { events.push(event); listeners.get(event.type)?.(event); return true; },
    setTimeout: (callback, delay) => { timers.set(delay, callback); return delay; },
    clearTimeout: (id) => timers.delete(id),
  };
  const options = {
    onChange: (snapshot) => changes.push(snapshot),
    loadConsented: async () => { imports += 1; },
  };
  const start = (extra = {}) => startOneTrust(document, win, { ...options, ...extra });
  return {
    document, window, win, start, events, timers, changes, imports: () => imports,
  };
}

const settle = () => new Promise((resolve) => { setImmediate(resolve); });

test('real SDK uses the correct asynchronous URL and registers callbacks before injection', () => {
  const context = browser();
  let callbacksReady;
  const append = context.document.head.append.bind(context.document.head);
  context.document.head.append = (script) => {
    callbacksReady = typeof context.win.OptanonWrapper === 'function';
    append(script);
  };
  const controller = context.start();
  const script = context.document.querySelector('script');
  assert.equal(callbacksReady, true);
  assert.equal(script.src, ONETRUST_SRC);
  assert.equal(script.async, true);
  assert.equal(script.getAttribute('data-domain-script'), ONETRUST_DOMAIN_ID);
  assert.equal(controller.hasConsent(), false);
  assert.equal(context.events[0].detail.consented, false);
  assert.equal(context.imports(), 0);
});

test('SDK download alone and initialization timeout keep consented code unloaded', async () => {
  const context = browser();
  const controller = context.start();
  context.document.querySelector('script').dispatchEvent(new context.window.Event('load'));
  assert.equal(controller.snapshot().sdkStatus, 'loaded');
  assert.equal(controller.snapshot().initialized, false);
  context.timers.get(15000)();
  await settle();
  assert.ok(controller.snapshot().status.includes('CMP did not initialize'));
  assert.ok(controller.snapshot().status.includes('allowlist'));
  assert.equal(controller.hasConsent(), false);
  assert.equal(context.imports(), 0);
});

test('network failure and a stalled SDK report separate failures without granting consent', () => {
  const failed = browser();
  const controller = failed.start();
  failed.document.querySelector('script').dispatchEvent(new failed.window.Event('error'));
  assert.equal(controller.snapshot().sdkStatus, 'error');
  assert.equal(failed.timers.size, 0);
  assert.equal(controller.hasConsent(), false);
  const stalled = browser();
  const pending = stalled.start();
  stalled.timers.get(15000)();
  assert.ok(pending.snapshot().status.includes('SDK not ready'));
  assert.equal(stalled.imports(), 0);
});

test('both exact category IDs are required; repeated callbacks import the consented hook once', async () => {
  const context = browser();
  let previousCalls = 0;
  context.win.OptanonWrapper = () => { previousCalls += 1; };
  const controller = context.start();
  context.win.OnetrustActiveGroups = ',C0001,C00020,C0004,';
  context.win.OptanonWrapper();
  await settle();
  assert.equal(controller.hasConsent(), false);
  assert.equal(context.imports(), 0);
  context.win.OnetrustActiveGroups = ',C0001,C0002,C0004,';
  context.win.OptanonWrapper();
  context.win.OptanonWrapper();
  await settle();
  assert.equal(previousCalls, 3);
  assert.equal(context.imports(), 1);
  assert.equal(controller.snapshot().consentedModule, 'Loaded');
  assert.equal(controller.hasConsent(), true);
  assert.equal(context.events.at(-1).detail.source, 'onetrust');
  assert.deepEqual(context.events.at(-1).detail.activeGroups, ['C0001', 'C0002', 'C0004']);
});

test('array events grant and revoke consent; reaccepting does not rerun the imported module', async () => {
  const context = browser();
  const controller = context.start();
  const update = (detail) => context.win.dispatchEvent(new context.win.CustomEvent('OneTrustGroupsUpdated', { detail }));
  update(['C0001', 'C0002', 'C0004']);
  await settle();
  assert.equal(controller.hasConsent(), true);
  update(['C0001']);
  assert.equal(controller.hasConsent(), false);
  assert.equal(context.events.at(-1).detail.consented, false);
  update(['C0001', 'C0002', 'C0004']);
  await settle();
  assert.equal(context.imports(), 1);
});

test('immediate revocation cancels the queued import and a later grant can retry it', async () => {
  const context = browser();
  const controller = context.start();
  context.win.OnetrustActiveGroups = ',C0002,C0004,';
  context.win.OptanonWrapper();
  context.win.OnetrustActiveGroups = ',C0001,';
  context.win.OptanonWrapper();
  await settle();
  assert.equal(context.imports(), 0);
  assert.equal(controller.snapshot().consentedModule, 'Not loaded');
  context.win.OnetrustActiveGroups = ',C0002,C0004,';
  context.win.OptanonWrapper();
  await settle();
  assert.equal(context.imports(), 1);
});

test('late initialization recovers after timeout, and existing consent is checked at setup', async () => {
  const context = browser();
  const controller = context.start();
  context.timers.get(15000)();
  context.win.OnetrustActiveGroups = ',C0002,C0004,';
  context.win.OptanonWrapper();
  await settle();
  assert.equal(controller.hasConsent(), true);
  assert.ok(controller.snapshot().status.includes('initialized'));
  const restored = browser();
  restored.win.OnetrustActiveGroups = ',C0002,C0004,';
  assert.equal(restored.start().hasConsent(), true);
  await settle();
  assert.equal(restored.imports(), 1);
});

test('setup is idempotent and an existing SDK for the same domain is reused', () => {
  const context = browser(`<script src="${ONETRUST_SRC}" data-domain-script="${ONETRUST_DOMAIN_ID}"></script>`);
  const controller = context.start();
  assert.equal(context.start(), controller);
  assert.equal(context.document.querySelectorAll('script').length, 1);
  assert.equal(context.timers.size, 1);
  const initialized = browser(`<script src="${ONETRUST_SRC}" data-domain-script="${ONETRUST_DOMAIN_ID}"></script>`);
  initialized.win.OnetrustActiveGroups = ',C0001,';
  assert.equal(initialized.start().snapshot().sdkStatus, 'loaded');
  assert.equal(initialized.start().snapshot().initialized, true);
  assert.equal(initialized.start().hasConsent(), false);
});

test('invalid domain/category settings and conflicting tenant scripts never load the SDK', () => {
  const invalid = browser('<meta name="onetrust-domain-id" content="bad-id">');
  assert.equal(invalid.start().snapshot().sdkStatus, 'invalid');
  assert.equal(invalid.document.querySelector('script'), null);
  const categories = browser();
  assert.equal(categories.start({ requiredGroups: [] }).snapshot().sdkStatus, 'invalid');
  const conflict = browser(`<script src="${ONETRUST_SRC}" data-domain-script="another-tenant"></script>`);
  assert.equal(conflict.start().snapshot().sdkStatus, 'conflict');
  assert.equal(conflict.document.querySelectorAll('script').length, 1);
});

test('preferences use the real API only once initialized; import failure is visible', async () => {
  const context = browser();
  let opened = 0;
  context.win.OneTrust = { ToggleInfoDisplay: () => { opened += 1; } };
  const controller = context.start({ loadConsented: async () => { throw new Error('Unavailable'); } });
  controller.openPreferences();
  assert.equal(opened, 0);
  context.win.OnetrustActiveGroups = ',C0002,C0004,';
  context.win.OptanonWrapper();
  await settle();
  controller.openPreferences();
  assert.equal(opened, 1);
  assert.equal(controller.snapshot().consentedModule, 'Load failed');
});
