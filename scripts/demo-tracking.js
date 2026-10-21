import startTracking, { createTrackingQueue, linkTrackingEvent } from './tracking.js';
import isDemoHelperHost from './demo-host.js';
import { readDemoSession, writeDemoSession } from './demo-session.js';

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = `demo-helper-${className}`;
  if (text !== undefined) node.textContent = text;
  return node;
}

function eventStatus(event, snapshot) {
  if (event.status === 'queued') {
    const waiting = event.categories.filter((category) => snapshot.consent[category] !== 'granted');
    return `Queued · awaiting ${waiting.join(', ')}`;
  }
  return {
    ready: snapshot.connected ? 'Ready to send' : 'Ready · destination not connected',
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed · no automatic retry',
    discarded: 'Discarded · consent denied or withdrawn',
  }[event.status];
}

function mountLog(doc, container, queue, label) {
  const states = element(doc, 'p', 'muted');
  const summary = element(doc, 'p', 'event-summary');
  summary.setAttribute('role', 'status');
  const list = element(doc, 'ol', 'event-log');
  list.setAttribute('aria-label', label);
  container.append(states, summary, list);
  queue.subscribe((snapshot) => {
    const open = new Set([...list.querySelectorAll('details[open]')].map((node) => node.dataset.eventId));
    const pending = snapshot.events.filter((event) => event.status === 'queued').length;
    const ready = snapshot.events.filter((event) => event.status === 'ready').length;
    const sent = snapshot.events.filter((event) => event.status === 'sent').length;
    states.textContent = Object.entries(snapshot.consent).filter(([category]) => category !== 'C0001')
      .map(([category, state]) => `${category}: ${state}`).join(' · ');
    summary.textContent = `${pending} queued · ${ready} ready · ${sent} sent${snapshot.skipped ? ` · ${snapshot.skipped} skipped (denied, invalid or full queue)` : ''}`;
    list.replaceChildren();
    if (!snapshot.events.length) {
      list.append(element(doc, 'li', 'empty', 'No events yet.'));
      return;
    }
    snapshot.events.slice(-25).forEach((event) => {
      const item = element(doc, 'li', 'event');
      item.dataset.trackingStatus = event.status;
      const title = element(doc, 'strong', 'event-key', `#${event.id} ${event.key}`);
      const status = element(doc, 'span', 'event-status', eventStatus(event, snapshot));
      const time = new Date(event.timestamp).toLocaleTimeString('en-US');
      let page = '';
      try {
        page = new URL(event.payload?.xdm?.web?.webPageDetails?.URL).pathname;
      } catch { /* Discarded or custom event. */ }
      item.append(title, status, element(doc, 'p', 'muted', `${time} · ${event.categories.join(', ')}${page ? ` · ${page}` : ''}`));
      if (event.payload) {
        const payload = element(doc, 'details', 'event-payload');
        payload.dataset.eventId = String(event.id);
        payload.open = open.has(String(event.id));
        payload.append(
          element(doc, 'summary', 'event-payload-title', 'Payload preview'),
          element(doc, 'pre', 'event-json', JSON.stringify(event.payload, null, 2)),
        );
        item.append(payload);
      }
      list.append(item);
    });
  });
}

function mountTrackedLinks(doc, win, root, onTest) {
  const section = element(doc, 'section', 'tracked-links');
  const count = element(doc, 'p', 'muted');
  count.setAttribute('role', 'status');
  const list = element(doc, 'ul', 'tracked-list');
  list.setAttribute('aria-label', 'Detected tracking links and buttons');
  const feedback = element(doc, 'p', 'muted');
  feedback.setAttribute('role', 'status');
  section.append(element(doc, 'h4', 'heading', 'Tracked links on this page'), count, list, feedback);
  let previousLinks = [];
  let previousSignature;
  function render() {
    const links = [...doc.querySelectorAll('a[href][data-tracking-key], button[data-tracking-key]')]
      .filter((link) => !root.contains(link));
    const entries = links.map((link) => {
      let event;
      try {
        event = linkTrackingEvent(link, win.location.href);
      } catch { /* Show invalid targets too. */ }
      const label = event?.payload.context.label || link.getAttribute('aria-label')
        || link.textContent.trim() || link.querySelector('img')?.alt || 'Untitled link';
      const key = event?.key || '(empty key)';
      const category = event?.requiredCategories?.join(', ') || 'Invalid tracking configuration';
      return {
        link, event, label, key, category,
      };
    });
    const signature = JSON.stringify(entries.map(({
      event, label, key, category,
    }) => (
      [event, label, key, category]
    )));
    if (signature === previousSignature && links.length === previousLinks.length
      && links.every((link, index) => link === previousLinks[index])) return;
    previousLinks = links;
    previousSignature = signature;
    count.textContent = `${links.length} tracking target${links.length === 1 ? '' : 's'} detected. Marking a link does not create a click event.`;
    list.replaceChildren();
    feedback.textContent = '';
    if (!links.length) {
      list.append(element(doc, 'li', 'empty', 'No marked links found. Author a URL such as /home?@tracking=home-link, or use data-tracking-key on the link.'));
    }
    entries.forEach(({
      link, event, label, key, category,
    }) => {
      const item = element(doc, 'li', 'tracked-link');
      item.append(
        element(doc, 'strong', 'event-key', label),
        element(doc, 'code', 'tracked-key', key),
        element(doc, 'p', 'muted', `Consent: ${category}`),
      );
      const test = element(doc, 'button', 'button', 'Test in sample queue');
      test.type = 'button';
      test.disabled = !event?.requiredCategories;
      test.setAttribute('aria-label', `Test ${label} in sample queue`);
      test.addEventListener('click', () => {
        try {
          const current = linkTrackingEvent(link, win.location.href);
          if (!current?.requiredCategories) return;
          onTest(current);
          feedback.textContent = `Sample event added for ${current.key} in “Try a sample queue” below.`;
        } catch { /* The source link may have changed since the list rendered. */ }
      });
      item.append(test);
      list.append(item);
    });
  }
  render();
  if (win.MutationObserver) {
    new win.MutationObserver((records) => {
      if (records.some((record) => !root.contains(record.target))) render();
    }).observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'data-tracking-key', 'data-tracking-category', 'aria-label', 'alt'],
    });
  }
  return section;
}

/** Demo controls are observers of real events. Sample consent operates on its own queue. */
export default function mountTrackingControls(doc, win) {
  if (!isDemoHelperHost(win.location.hostname)) return null;
  const root = element(doc, 'section', 'tracking');
  const queue = startTracking(doc, win);
  const connection = element(doc, 'p', 'tracking-notice');
  queue.subscribe(({ connected }) => {
    connection.textContent = connected
      ? 'A destination is connected. Required consent still applies.'
      : 'No analytics destination connected. Eligible events stay Ready.';
  });
  root.append(
    element(doc, 'h3', 'heading', 'Link tracking'),
    element(doc, 'p', 'muted', 'Inspect marked links below, or click one on the page to capture a real event. Event history follows this tab across pages for the current demo session.'),
    connection,
  );
  root.append(element(doc, 'p', 'muted', 'Configure tracking while authoring in DA: Library → Link Options.'));
  const sampleQueue = win.etradeDemoSampleTracking || createTrackingQueue({
    initial: readDemoSession(win, 'sample-events'), restoreConsent: true,
  });
  if (!win.etradeDemoSampleTracking) {
    win.etradeDemoSampleTracking = sampleQueue;
    sampleQueue.subscribe((snapshot) => writeDemoSession(win, 'sample-events', snapshot));
  }
  const demo = element(doc, 'details', 'event-sandbox');
  demo.dataset.demoState = 'tracking.samples';
  root.append(mountTrackedLinks(doc, win, root, (event) => {
    sampleQueue.track(event);
    demo.open = true;
  }));
  const live = element(doc, 'section', 'event-group');
  live.append(element(doc, 'h4', 'heading', 'Page events · real OneTrust consent'));
  mountLog(doc, live, queue, 'Page tracking events (latest 25)');
  root.append(live);

  demo.append(
    element(doc, 'summary', 'heading', 'Try a sample queue'),
    element(doc, 'p', 'muted', 'Capture a few sample clicks, then grant one category to release its events. These controls affect samples only; they do not change OneTrust or page-event consent.'),
  );
  const controls = element(doc, 'div', 'event-consent');
  const actions = element(doc, 'div', 'actions');
  [['C0002', 'analytics'], ['C0004', 'advertising']].forEach(([category, name]) => {
    const label = element(doc, 'label', 'label', `${category} · ${name}`);
    const select = element(doc, 'select', 'input');
    select.id = `demo-helper-sample-${category}`;
    select.setAttribute('aria-label', `Sample ${category} consent`);
    label.htmlFor = select.id;
    ['pending', 'granted', 'denied'].forEach((state) => {
      const option = doc.createElement('option');
      option.value = state;
      option.textContent = state[0].toUpperCase() + state.slice(1);
      option.selected = sampleQueue.snapshot().consent[category] === state;
      select.append(option);
    });
    select.addEventListener('change', () => sampleQueue.setConsent({ [category]: select.value }));
    controls.append(label, select);
    const capture = element(doc, 'button', 'button', `Capture ${name} example`);
    capture.type = 'button';
    capture.addEventListener('click', () => {
      const link = doc.createElement('a');
      link.href = '#';
      link.textContent = `${name} example`;
      link.dataset.trackingKey = `demo-${name}-click`;
      link.dataset.trackingCategory = category;
      sampleQueue.track(linkTrackingEvent(link, win.location.href));
    });
    actions.append(capture);
  });
  demo.append(controls, actions);
  mountLog(doc, demo, sampleQueue, 'Sample tracking events (latest 25)');
  root.append(demo);
  root.append(element(doc, 'p', 'muted', 'History is kept in this tab’s session on this preview host. OneTrust revalidates real consent on each page.'));
  return root;
}
