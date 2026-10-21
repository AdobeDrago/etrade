/* eslint-env node */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import startTracking, { createTrackingQueue, decorateTrackingLinks } from '../scripts/tracking.js';
import mountTrackingControls from '../scripts/demo-tracking.js';

const PAGE = 'https://demo--etrade--adobedrago.aem.page/home';
const settle = () => new Promise((resolve) => { setImmediate(resolve); });

function browser(markup = '', extra = {}) {
  const { document, window } = parseHTML(`<html><body><main>${markup}</main></body></html>`);
  const listeners = new Map();
  const win = {
    location: new URL(PAGE),
    MutationObserver: window.MutationObserver,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    ...extra,
  };
  const emit = (name, detail) => listeners.get(name)?.forEach((callback) => callback({ detail }));
  return {
    document, window, win, emit,
  };
}

test('only the reserved authoring parameters are removed; real query bytes and fragments survive', () => {
  const { document } = browser('<a href="../home?tracking=real&sig=a%20b%2f&@tracking=hero-home&@tracking-category=C0002%2CC0004#offer">Home</a><a href="/home?tracking=real">Unmarked</a>');
  decorateTrackingLinks(document, PAGE);
  const [link, unmarked] = document.querySelectorAll('a');
  assert.equal(link.getAttribute('href'), '../home?tracking=real&sig=a%20b%2f#offer');
  assert.equal(link.dataset.trackingKey, 'hero-home');
  assert.equal(link.dataset.trackingCategory, 'C0002,C0004');
  assert.equal(unmarked.getAttribute('href'), '/home?tracking=real');
  assert.equal(unmarked.hasAttribute('data-tracking-key'), false);
  decorateTrackingLinks(link, PAGE);
  assert.equal(link.dataset.trackingKey, 'hero-home');
  assert.equal(link.cloneNode(true).dataset.trackingKey, 'hero-home');
});

test('empty keys disable tracking, invalid categories fail closed, and non-http links keep working', () => {
  const { document } = browser('<a href="#offer?@tracking=no">Fragment</a><a href="?@tracking=">Empty</a><a href="/home?@tracking=bad&@tracking-category=C0004x">Invalid</a><a href="mailto:example@example.com?subject=a%20b&@tracking=contact">Email</a><a href="tel:123?@tracking=phone">Phone</a>');
  decorateTrackingLinks(document, PAGE);
  const [fragment, empty, invalid, email, phone] = document.querySelectorAll('a');
  assert.equal(fragment.hasAttribute('data-tracking-key'), false);
  assert.equal(empty.getAttribute('href'), '');
  assert.equal(empty.hasAttribute('data-tracking-key'), false);
  assert.equal(invalid.hasAttribute('data-tracking-key'), false);
  assert.equal(invalid.getAttribute('href'), '/home');
  assert.equal(email.getAttribute('href'), 'mailto:example@example.com?subject=a%20b');
  assert.equal(email.dataset.trackingCategory, 'C0004');
  assert.equal(phone.getAttribute('href'), 'tel:123');
});

test('raw and percent-encoded @tracking keys decorate consistently; ordinary tracking keys stay ordinary', () => {
  const { document } = browser('<a href="/home?@tracking=raw">Raw</a><a href="/home?%40tracking=encoded&%40tracking-category=C0002">Encoded</a><a href="/home?tracking=real&cta-tracking-key=external">Ordinary</a>');
  decorateTrackingLinks(document, PAGE);
  const [raw, encoded, ordinary] = document.querySelectorAll('a');
  assert.equal(raw.dataset.trackingKey, 'raw');
  assert.equal(encoded.dataset.trackingKey, 'encoded');
  assert.equal(encoded.dataset.trackingCategory, 'C0002');
  assert.equal(ordinary.hasAttribute('data-tracking-key'), false);
  assert.equal(ordinary.getAttribute('href'), '/home?tracking=real&cta-tracking-key=external');
});

test('fragment and empty links never inherit a tracking marker from the current page URL', () => {
  const { document } = browser('<a href="#offer">Offer</a><a href="">Current page</a><a href="?tracking=campaign#offer">Campaign</a>');
  const links = [...document.querySelectorAll('a')];
  const authored = links.map((link) => link.getAttribute('href'));
  for (let pass = 0; pass < 3; pass += 1) {
    decorateTrackingLinks(document, `${PAGE}?@tracking=landing`);
  }
  assert.deepEqual(links.map((link) => link.getAttribute('href')), authored);
  assert.ok(links.every((link) => !link.hasAttribute('data-tracking-key')));
});

test('URL normalization cannot cause repeated href writes for malformed tracking parameters', () => {
  const { document } = browser();
  const link = document.createElement('a');
  const authored = '/home?@track\ning=hero';
  link.setAttribute('href', authored);
  let writes = 0;
  const setAttribute = link.setAttribute.bind(link);
  link.setAttribute = (name, value) => {
    if (name === 'href') writes += 1;
    setAttribute(name, value);
  };
  for (let pass = 0; pass < 3; pass += 1) decorateTrackingLinks(link, PAGE);
  assert.equal(writes, 0);
  assert.equal(link.getAttribute('href'), authored);
  assert.equal(link.hasAttribute('data-tracking-key'), false);
});

test('observed relative links settle after decoration even when the page URL has a tracking marker', async () => {
  const context = browser('', { location: new URL(`${PAGE}?@tracking=landing`) });
  const NativeObserver = context.window.MutationObserver;
  let deliveries = 0;
  context.win.MutationObserver = class {
    constructor(callback) {
      this.observer = new NativeObserver((records) => {
        deliveries += 1;
        // Bound the old infinite loop so a regression fails instead of hanging the test runner.
        if (deliveries > 5) this.observer.disconnect();
        else callback(records);
      });
    }

    observe(target, options) { this.observer.observe(target, options); }
  };
  startTracking(context.document, context.win);
  const link = context.document.createElement('a');
  link.setAttribute('href', '?@tracking=authored#offer');
  context.document.querySelector('main').append(link);
  await settle();
  assert.ok(deliveries <= 2, `Expected observer to settle, received ${deliveries} callbacks`);
  assert.equal(link.getAttribute('href'), '#offer');
  assert.equal(link.dataset.trackingKey, 'authored');
});

test('category grants release only eligible events; a missing destination never reports a send', async () => {
  const queue = createTrackingQueue();
  queue.track({ key: 'advertising' });
  queue.track({ key: 'analytics', requiredCategories: ['C0002'] });
  queue.track({ key: 'both', requiredCategories: ['C0002', 'C0004'] });
  await queue.setConsent({ C0004: 'granted' });
  assert.deepEqual(queue.snapshot().events.map((event) => event.status), ['ready', 'queued', 'queued']);
  assert.equal(queue.snapshot().connected, false);
  await queue.setConsent({ C0002: 'granted' });
  assert.ok(queue.snapshot().events.every((event) => event.status === 'ready'));
});

test('one asynchronous sender drains eligible events in order and repeated grants do not duplicate them', async () => {
  const queue = createTrackingQueue({ now: () => '2026-10-20T16:00:00.000Z' });
  const sent = [];
  queue.track({ key: 'ad-1', payload: { xdm: { eventType: 'web.webinteraction.linkClicks' } } });
  queue.track({ key: 'analytics', requiredCategories: ['C0002'] });
  queue.track({ key: 'ad-2' });
  await queue.setSender(async (event) => { sent.push(event); await settle(); });
  await queue.setConsent({ C0002: 'granted' });
  assert.deepEqual(sent.map((event) => event.key), ['analytics']);
  await Promise.all([queue.setConsent({ C0004: 'granted' }), queue.setConsent({ C0004: 'granted' })]);
  assert.deepEqual(sent.map((event) => event.key), ['analytics', 'ad-1', 'ad-2']);
  assert.equal(sent[1].payload.xdm.timestamp, '2026-10-20T16:00:00.000Z');
  await queue.flush();
  assert.equal(sent.length, 3);
  assert.ok(queue.snapshot().events.every((event) => event.status === 'sent'));
});

test('denial scrubs queued payloads, skips new clicks, and reacceptance never resurrects them', async () => {
  const queue = createTrackingQueue();
  queue.track({ key: 'before-denial', payload: { context: { label: 'Example' } } });
  await queue.setConsent({ C0004: 'denied' });
  assert.equal(queue.snapshot().events[0].status, 'discarded');
  assert.equal(queue.snapshot().events[0].payload, null);
  assert.equal(queue.track({ key: 'after-denial' }), null);
  const sent = [];
  await queue.setSender(async ({ key }) => { sent.push(key); });
  await queue.setConsent({ C0004: 'granted' });
  assert.deepEqual(sent, []);
  assert.equal(queue.snapshot().skipped, 1);
});

test('a destination connected after consent drains ready events and detaching pauses further sends', async () => {
  const queue = createTrackingQueue();
  queue.track({ key: 'first' });
  queue.track({ key: 'second' });
  await queue.setConsent({ C0004: 'granted' });
  let release;
  const sent = [];
  const draining = queue.setSender((event) => {
    sent.push(event.key);
    return new Promise((resolve) => { release = resolve; });
  });
  await settle();
  queue.setSender(null);
  release();
  await draining;
  assert.deepEqual(sent, ['first']);
  assert.deepEqual(queue.snapshot().events.map((event) => event.status), ['sent', 'ready']);
  await queue.setSender(async (event) => { sent.push(event.key); });
  assert.deepEqual(sent, ['first', 'second']);
});

test('revocation while a send is in flight prevents the next event from being dispatched', async () => {
  const queue = createTrackingQueue();
  let release;
  const sent = [];
  queue.track({ key: 'first' });
  queue.track({ key: 'second' });
  await queue.setSender((event) => {
    sent.push(event.key);
    return new Promise((resolve) => { release = resolve; });
  });
  const sending = queue.setConsent({ C0004: 'granted' });
  await settle();
  queue.setConsent({ C0004: 'denied' });
  release();
  await sending;
  assert.deepEqual(sent, ['first']);
  assert.deepEqual(queue.snapshot().events.map((event) => event.status), ['sent', 'discarded']);
});

test('sender failures are visible without automatic retries, and observers cannot mutate the queue', async () => {
  const queue = createTrackingQueue();
  queue.track({ key: 'failed' });
  let attempts = 0;
  await queue.setSender(async () => { attempts += 1; throw new Error('Unavailable'); });
  await queue.setConsent({ C0004: 'granted' });
  await queue.setConsent({ C0004: 'granted' });
  assert.equal(attempts, 1);
  const view = queue.snapshot();
  view.events[0].status = 'sent';
  assert.equal(queue.snapshot().events[0].status, 'failed');
});

test('a full queue skips new captures instead of silently evicting waiting events', async () => {
  const queue = createTrackingQueue({ limit: 2 });
  queue.track({ key: 'one' });
  queue.track({ key: 'two' });
  assert.equal(queue.track({ key: 'three' }), null);
  assert.deepEqual(queue.snapshot().events.map((event) => event.key), ['one', 'two']);
  await queue.setConsent({ C0004: 'denied' });
  queue.track({ key: 'analytics', requiredCategories: ['C0002'] });
  assert.deepEqual(queue.snapshot().events.map((event) => event.key), ['two', 'analytics']);
});

test('clicks on nested CTA content are captured once without preventing navigation or exposing queries', async () => {
  const context = browser('<a href="/account?token=secret&@tracking=open-account"><span>Open account</span></a>');
  const queue = startTracking(context.document, context.win);
  assert.equal(startTracking(context.document, context.win), queue);
  const click = new context.window.Event('click', { bubbles: true, cancelable: true });
  context.document.querySelector('span').dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  assert.equal(queue.snapshot().events.length, 1);
  const event = queue.snapshot().events[0];
  assert.equal(event.status, 'queued');
  assert.equal(event.payload.xdm.web.webInteraction.URL, `${new URL(PAGE).origin}/account`);
  assert.equal(JSON.stringify(event).includes('secret'), false);
  context.emit('consent.update', { consented: true });
  context.emit('demo-performance:consent.update', { consented: true, simulated: true });
  await settle();
  assert.equal(queue.snapshot().events[0].status, 'queued');
});

test('OneTrust initialization stays pending; exact category changes and explicit rejection are respected', async () => {
  const context = browser();
  const queue = startTracking(context.document, context.win);
  queue.track({ key: 'ads' });
  queue.track({ key: 'analytics', requiredCategories: ['C0002'] });
  context.emit('OneTrustGroupsUpdated', ['C0001', 'C00020']);
  assert.equal(queue.snapshot().consent.C0002, 'pending');
  context.emit('OneTrustGroupsUpdated', ['C0001', 'C0002']);
  assert.deepEqual(queue.snapshot().events.map((event) => event.status), ['queued', 'ready']);
  context.emit('OTConsentApplied');
  assert.equal(queue.snapshot().events[0].status, 'discarded');
  context.emit('OneTrustGroupsUpdated', ['C0001']);
  assert.equal(queue.snapshot().events[1].status, 'discarded');
  await settle();
});

test('middle clicks and marked buttons are captured, while right clicks and unmarked links are ignored', () => {
  const context = browser('<a href="/home?@tracking=middle">Tracked</a><a href="/home">Unmarked</a><button data-tracking-key="button-action" data-tracking-category="C0002"><span>Action</span></button>');
  const queue = startTracking(context.document, context.win);
  const middle = new context.window.Event('auxclick', { bubbles: true });
  middle.button = 1;
  context.document.querySelector('a').dispatchEvent(middle);
  const right = new context.window.Event('auxclick', { bubbles: true });
  right.button = 2;
  context.document.querySelector('a').dispatchEvent(right);
  context.document.querySelectorAll('a')[1].dispatchEvent(new context.window.Event('click', { bubbles: true }));
  context.document.querySelector('button span').dispatchEvent(new context.window.Event('click', { bubbles: true }));
  assert.deepEqual(queue.snapshot().events.map((event) => event.key), ['middle', 'button-action']);
  assert.deepEqual(queue.snapshot().events[1].categories, ['C0002']);
});

test('stored OneTrust choices are read at startup, and later inserted or rewritten links are decorated', async () => {
  const context = browser('', {
    OneTrust: { IsAlertBoxClosed: () => true }, OnetrustActiveGroups: ', C0001, C0004,',
  });
  const queue = startTracking(context.document, context.win);
  assert.equal(queue.snapshot().consent.C0002, 'denied');
  assert.equal(queue.snapshot().consent.C0004, 'granted');
  const fragment = context.document.createElement('div');
  fragment.innerHTML = '<a href="/new?@tracking=fragment">New link</a>';
  context.document.querySelector('main').append(fragment);
  await settle();
  const link = fragment.querySelector('a');
  assert.equal(link.getAttribute('href'), '/new');
  assert.equal(link.dataset.trackingKey, 'fragment');
  link.setAttribute('href', '/other?@tracking=changed');
  await settle();
  assert.equal(link.dataset.trackingKey, 'changed');
});

test('live event log updates immediately, while sample consent cannot release real events', async () => {
  const context = browser('<a href="?@tracking=live#example">Tracked</a>');
  const controls = mountTrackingControls(context.document, context.win);
  context.document.body.append(controls);
  context.document.querySelector('main a').dispatchEvent(new context.window.Event('click', { bubbles: true }));
  assert.ok(controls.querySelector('.demo-helper-event-group').textContent.includes('#1 live'));
  [...controls.querySelectorAll('button')].find((button) => button.textContent === 'Capture advertising example')
    .dispatchEvent(new context.window.Event('click'));
  const advertising = controls.querySelector('[aria-label="Sample C0004 consent"]');
  advertising.querySelector('[value="granted"]').selected = true;
  advertising.dispatchEvent(new context.window.Event('change'));
  await settle();
  assert.equal(context.win.etradeTracking.snapshot().events[0].status, 'queued');
  const sample = controls.querySelector('.demo-helper-event-sandbox');
  assert.ok(sample.textContent.includes('Ready · destination not connected'));
  assert.equal(sample.querySelector('[data-tracking-status="sent"]'), null);
  context.emit('OneTrustGroupsUpdated', ['C0004']);
  assert.ok(controls.querySelector('.demo-helper-event-group').textContent.includes('Ready · destination not connected'));
});

test('marked Home links appear before a click and can be tested without navigation or a real event', async () => {
  const context = browser('<a href="/home?@tracking=home-link">Home</a>');
  const controls = mountTrackingControls(context.document, context.win);
  context.document.body.append(controls);
  const inventory = controls.querySelector('.demo-helper-tracked-links');
  assert.ok(inventory.textContent.includes('1 tracking target detected'));
  assert.ok(inventory.textContent.includes('Home'));
  assert.ok(inventory.textContent.includes('home-link'));
  assert.ok(inventory.textContent.includes('Consent: C0004'));
  assert.ok(controls.querySelector('.demo-helper-event-group').textContent.includes('No events yet.'));
  const source = context.document.querySelector('main a');
  inventory.querySelector('button').dispatchEvent(new context.window.Event('click', { bubbles: true }));
  assert.equal(source.getAttribute('href'), '/home');
  assert.equal(context.win.etradeTracking.snapshot().events.length, 0);
  const sample = controls.querySelector('.demo-helper-event-sandbox');
  assert.equal(sample.open, true);
  assert.ok(sample.textContent.includes('#1 home-link'));
  assert.ok(sample.textContent.includes('Queued · awaiting C0004'));
  const advertising = sample.querySelector('[aria-label="Sample C0004 consent"]');
  advertising.querySelector('[value="granted"]').selected = true;
  advertising.dispatchEvent(new context.window.Event('change'));
  await settle();
  assert.ok(sample.textContent.includes('Ready · destination not connected'));
  assert.equal(context.win.etradeTracking.snapshot().consent.C0004, 'pending');
  assert.equal(inventory.querySelectorAll('.demo-helper-tracked-link').length, 1);
});

test('tracking inventory follows fragment links, clones, direct data attributes and removals', async () => {
  const context = browser();
  const controls = mountTrackingControls(context.document, context.win);
  context.document.body.append(controls);
  const inventory = controls.querySelector('.demo-helper-tracked-links');
  assert.ok(inventory.textContent.includes('No marked links found.'));
  const header = context.document.createElement('header');
  header.innerHTML = '<a href="/home?@tracking=header-home">Home</a>';
  context.document.body.prepend(header);
  await settle();
  assert.ok(inventory.textContent.includes('header-home'));
  const link = header.querySelector('a');
  link.dataset.trackingKey = 'updated-home';
  link.dataset.trackingCategory = 'C0002';
  link.textContent = 'Updated Home';
  await settle();
  assert.ok(inventory.textContent.includes('updated-home'));
  assert.ok(inventory.textContent.includes('Updated Home'));
  assert.ok(inventory.textContent.includes('Consent: C0002'));
  const copy = link.cloneNode(true);
  link.replaceWith(copy);
  const button = context.document.createElement('button');
  button.dataset.trackingKey = 'button-action';
  button.textContent = 'Action';
  context.document.querySelector('main').append(button);
  await settle();
  assert.equal(inventory.querySelectorAll('.demo-helper-tracked-link').length, 2);
  copy.removeAttribute('data-tracking-key');
  button.remove();
  await settle();
  assert.equal(inventory.querySelectorAll('.demo-helper-tracked-link').length, 0);
  assert.ok(inventory.textContent.includes('No marked links found.'));
});

test('invalid tracking configurations remain visible but cannot be tested', () => {
  const context = browser('<a href="/home" data-tracking-key="home" data-tracking-category="ads">Home</a><a href="/home" data-tracking-key="">Empty key</a>');
  const controls = mountTrackingControls(context.document, context.win);
  const inventory = controls.querySelector('.demo-helper-tracked-links');
  assert.equal(inventory.querySelectorAll('.demo-helper-tracked-link').length, 2);
  assert.ok(inventory.textContent.includes('Invalid tracking configuration'));
  assert.ok(inventory.textContent.includes('(empty key)'));
  assert.ok([...inventory.querySelectorAll('button')].every((button) => button.disabled));
});
