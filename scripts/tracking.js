const KEY_PARAM = '@tracking';
const CATEGORY_PARAM = '@tracking-category';
const DEFAULT_CATEGORY = 'C0004';
const CATEGORY = /^C\d{4,}$/;
const STATES = new Set(['pending', 'granted', 'denied']);
const WAITING = new Set(['queued', 'ready']);
const clone = (value) => JSON.parse(JSON.stringify(value));

function categories(value) {
  const list = Array.isArray(value) ? value : String(value).split(',');
  const result = [...new Set(list.map((item) => String(item).trim()))];
  return result.length && result.every((item) => CATEGORY.test(item)) ? result : null;
}

/** Remove only our authoring parameters, retaining other query bytes and relative URLs. */
function cleanHref(href) {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const target = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = target.indexOf('?');
  const query = target.slice(queryAt + 1).split('&').filter((part) => {
    const name = new URLSearchParams(part).keys().next().value;
    return name !== KEY_PARAM && name !== CATEGORY_PARAM;
  }).join('&');
  return `${target.slice(0, queryAt)}${query ? `?${query}` : ''}${hash}`;
}

/** Shared by initial content, fragments and dynamically inserted links. */
export function decorateTrackingLinks(root, base = root.baseURI || root.ownerDocument?.baseURI) {
  const links = [...root.querySelectorAll('a[href]')];
  if (root.matches?.('a[href]')) links.unshift(root);
  links.forEach((link) => {
    const href = link.getAttribute('href');
    let url;
    try { url = new URL(href, base); } catch { return; }
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      || !url.searchParams.has(KEY_PARAM)) return;
    const key = url.searchParams.get(KEY_PARAM).trim();
    const required = categories(url.searchParams.get(CATEGORY_PARAM) ?? DEFAULT_CATEGORY);
    link.setAttribute('href', cleanHref(href));
    link.removeAttribute('data-tracking-key');
    link.removeAttribute('data-tracking-category');
    if (!key || key.length > 160 || [...key].some((char) => char.charCodeAt(0) < 32)
      || !required) return;
    link.dataset.trackingKey = key;
    link.dataset.trackingCategory = required.join(',');
  });
}

/** Page-lifetime queue. No storage, vendor code, or network transport is installed here. */
export function createTrackingQueue({ limit = 100, now = () => new Date().toISOString() } = {}) {
  const events = [];
  const listeners = new Set();
  const consent = { C0002: 'pending', C0004: 'pending' };
  let defaultState = 'pending';
  let sequence = 0;
  let skipped = 0;
  let sender = null;
  let flushing = null;
  const stateOf = (category) => consent[category] || defaultState;
  const snapshot = () => clone({
    events, consent, skipped, connected: !!sender,
  });
  const notify = () => listeners.forEach((listener) => {
    try { listener(snapshot()); } catch { /* A viewer cannot interrupt tracking or navigation. */ }
  });
  function refresh() {
    events.filter((event) => WAITING.has(event.status)).forEach((event) => {
      if (event.categories.some((category) => stateOf(category) === 'denied')) {
        event.status = 'discarded';
        event.payload = null;
      } else {
        event.status = event.categories.every((category) => stateOf(category) === 'granted')
          ? 'ready' : 'queued';
      }
    });
    notify();
  }
  function flush() {
    if (flushing) return flushing;
    flushing = Promise.resolve().then(async () => {
      // Recheck consent before each send, including after asynchronous adapter work.
      while (sender) {
        const next = events.find((event) => event.status === 'ready');
        if (!next) break;
        if (!next.categories.every((category) => stateOf(category) === 'granted')) break;
        next.status = 'sending';
        notify();
        try {
          // eslint-disable-next-line no-await-in-loop
          await sender(clone(next));
          next.status = 'sent';
        } catch {
          // A failed response can follow a delivered request; never retry automatically.
          next.status = 'failed';
        }
        notify();
      }
    }).finally(() => {
      flushing = null;
      if (sender && events.some((event) => event.status === 'ready')) return flush();
      return undefined;
    });
    return flushing;
  }
  return {
    snapshot,
    flush,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    setConsent(values, fallback = defaultState) {
      if (STATES.has(fallback)) defaultState = fallback;
      Object.entries(values).forEach(([category, state]) => {
        if (CATEGORY.test(category) && STATES.has(state)) consent[category] = state;
      });
      refresh();
      return flush();
    },
    setSender(adapter) {
      if (adapter !== null && typeof adapter !== 'function') throw new TypeError('Expected a tracking sender function.');
      sender = adapter;
      notify();
      return flush();
    },
    track({ key, requiredCategories = [DEFAULT_CATEGORY], payload = {} }) {
      const required = categories(requiredCategories);
      if (!key || !required || required.some((category) => stateOf(category) === 'denied')) {
        skipped += 1;
        notify();
        return null;
      }
      if (events.length >= limit) {
        const completed = events.findIndex((event) => !WAITING.has(event.status) && event.status !== 'sending');
        if (completed < 0) { skipped += 1; notify(); return null; }
        events.splice(completed, 1);
      }
      required.forEach((category) => { consent[category] ??= defaultState; });
      sequence += 1;
      const timestamp = now();
      const body = clone(payload);
      if (body.xdm) body.xdm.timestamp = timestamp;
      const event = {
        id: sequence, key, categories: required, timestamp, status: 'queued', payload: body,
      };
      events.push(event);
      refresh();
      flush();
      return event.id;
    },
  };
}

/** Exclude URL query data and contact addresses from the event preview/payload. */
function reportingURL(href, base) {
  const url = new URL(href, base);
  return ['http:', 'https:'].includes(url.protocol) ? `${url.origin}${url.pathname}` : url.protocol;
}

export function linkTrackingEvent(link, pageURL) {
  const key = link.dataset.trackingKey?.trim();
  if (!key) return null;
  const target = link.getAttribute('href') || pageURL;
  const destination = new URL(target, pageURL);
  let type = destination.origin === new URL(pageURL).origin ? 'other' : 'exit';
  if (link.hasAttribute('download')) type = 'download';
  return {
    key,
    requiredCategories: categories(link.dataset.trackingCategory ?? DEFAULT_CATEGORY),
    payload: {
      xdm: {
        eventType: 'web.webinteraction.linkClicks',
        web: {
          webPageDetails: { URL: reportingURL(pageURL, pageURL) },
          webInteraction: {
            name: key, URL: reportingURL(target, pageURL), type, linkClicks: { value: 1 },
          },
        },
      },
      context: {
        label: (link.getAttribute('aria-label') || link.textContent).trim().slice(0, 200),
        block: link.closest('.block')?.dataset.blockName || '',
      },
    },
  };
}

/** Start before autoblocking and CMP setup so neither link clones nor consent can race us. */
export default function startTracking(doc = document, win = window) {
  if (win.etradeTracking) return win.etradeTracking;
  const queue = createTrackingQueue();
  win.etradeTracking = queue;
  let activeGroups = [];
  let resolved = false;
  function syncConsent(value, applied = false) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    activeGroups = list.map((category) => String(category).trim())
      .filter((category) => CATEGORY.test(category));
    try { resolved ||= win.OneTrust?.IsAlertBoxClosed?.() === true; } catch { /* Keep pending. */ }
    resolved ||= applied;
    const previous = queue.snapshot().consent;
    const known = new Set([...Object.keys(previous), ...activeGroups]);
    const states = {};
    known.forEach((category) => {
      if (activeGroups.includes(category)) states[category] = 'granted';
      else {
        states[category] = resolved || previous[category] === 'granted' || previous[category] === 'denied'
          ? 'denied' : 'pending';
      }
    });
    queue.setConsent(states, resolved ? 'denied' : 'pending');
  }
  win.addEventListener('OneTrustGroupsUpdated', (event) => syncConsent(event.detail));
  win.addEventListener('OTConsentApplied', () => syncConsent(win.OnetrustActiveGroups ?? activeGroups, true));
  win.addEventListener('consent.update', ({ detail }) => {
    // Dummy and performance-simulation consent must never release real page events.
    if (detail?.source === 'onetrust' && detail.initialized) syncConsent(detail.activeGroups);
  });
  const restored = win.etradeOneTrust?.snapshot();
  if (restored?.initialized) syncConsent(restored.activeGroups);
  else if (win.OnetrustActiveGroups !== undefined) syncConsent(win.OnetrustActiveGroups);

  decorateTrackingLinks(doc, win.location.href);
  function capture(event) {
    if (event.button !== undefined && event.button > 1) return;
    const link = event.target.closest?.('a[href], button[data-tracking-key]');
    if (!link) return;
    decorateTrackingLinks(link, win.location.href);
    try {
      const tracked = linkTrackingEvent(link, win.location.href);
      if (tracked) queue.track(tracked);
    } catch { /* A malformed authored URL cannot break its interaction. */ }
  }
  doc.addEventListener('click', capture);
  doc.addEventListener('auxclick', capture);
  if (win.MutationObserver) {
    new win.MutationObserver((records) => records.forEach((record) => {
      if (record.type === 'attributes') decorateTrackingLinks(record.target, win.location.href);
      else {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) decorateTrackingLinks(node, win.location.href);
        });
      }
    })).observe(doc.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['href'],
    });
  }
  return queue;
}
