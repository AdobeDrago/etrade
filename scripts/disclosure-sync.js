import {
  captureDisclosureRenumbering, applyDisclosureRenumbering, disclosureReferenceSignature,
  hasMatchingDisclosureFooter, requireDisclosureViewRefresh, unlinkDisclosureReferences,
  restoreDisclosureLinks,
} from './disclosure-reference-sync.js';
import { disclosureSetEntries } from './disclosure-sets.js';

const CHANNEL = 'etrade-disclosure-saves-v1';
const SITE = 'adobedrago/etrade';
const pathFor = (value) => (typeof value === 'string' && /^\/(?!\/)[^?#\\]*$/.test(value)
  ? value.replace(/\.html$/, '').replace(/\/$/, '') : null);
const completed = (operation) => ['complete', 'restored'].includes(operation?.status);

function validMapping(change) {
  if (!Array.isArray(change.mapping) || !change.mapping.length
    || change.mapping.length > 5000) return false;
  try {
    disclosureSetEntries(change.before);
    disclosureSetEntries(change.after);
    if (change.before.id !== change.namespace || change.after.id !== change.namespace) return false;
    const map = new Map(change.mapping);
    return map.size === change.before.disclosures.length
      && new Set(map.values()).size === map.size && map.size === change.after.disclosures.length
      && change.before.disclosures.every((entry) => change.after.disclosures.some((target) => (
        target.disclosureId === map.get(entry.disclosureId) && target.fragment === entry.fragment
      )));
  } catch { return false; }
}

function messageFor(context, operation) {
  if (`${context.org}/${context.repo}`.toLowerCase() !== SITE
    || `${operation.org}/${operation.repo}`.toLowerCase() !== SITE
    || typeof operation.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operation.namespace)
    || !Array.isArray(operation.affectedPages)) return null;
  return {
    version: 1,
    site: SITE,
    id: operation.id,
    status: operation.status,
    namespace: operation.namespace,
    setPath: operation.setPath,
    affectedPages: operation.affectedPages.map(pathFor).filter(Boolean),
    ...(validMapping(operation) && {
      mapping: operation.mapping,
      before: operation.before,
      after: operation.after,
      references: operation.references || [],
      direction: operation.direction,
    }),
  };
}

function captureView(doc, data, path, recovering = false) {
  const signature = disclosureReferenceSignature(doc, data);
  const source = data.references?.find((entry) => entry.path === path && entry.safe);
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const target = source && same(signature, source.after) && !same(signature, source.before);
  const original = source && same(signature, source.before);
  const bound = !recovering && hasMatchingDisclosureFooter(doc, data);
  const map = new Map(data.mapping);
  const expected = target ? source.after : signature.map((group) => {
    const linked = group.startsWith('@');
    const tokens = (linked ? group.slice(1) : group).split(',');
    const values = tokens.map((token) => (
      map.get(token) || map.get(data.before.disclosures[Number(token) - 1]?.disclosureId)
    ));
    return `${linked ? '@' : ''}${values.join(',')}`;
  });
  return {
    intent: JSON.stringify([data.namespace, data.setPath, data.mapping, data.before, data.after]),
    captured: !target && (original || bound)
      ? captureDisclosureRenumbering(doc, data, { allowUnbound: Boolean(original) }) : [],
    expected,
    blocked: signature.length > 0 && !target && !original && !bound,
  };
}

/** Capture author references before the first source write, with a bounded current-page ack. */
export function prepareDisclosureSave(context, operation, win, { timeout = 350 } = {}) {
  const message = messageFor(context, operation);
  if (!win.BroadcastChannel || !message?.mapping) return Promise.resolve(false);
  const channel = new win.BroadcastChannel(CHANNEL);
  const outcome = operation.direction === 'restore' ? 'restored' : 'complete';
  return new Promise((resolve) => {
    const expires = Date.now() + timeout;
    let timer;
    const finish = (ready) => { clearTimeout(timer); channel.close(); resolve(ready); };
    channel.onmessage = ({ data }) => {
      if (data?.phase === 'ready' && data.id === message.id && data.site === SITE
        && data.path === pathFor(context.path) && data.outcome === outcome) finish(true);
    };
    timer = setTimeout(() => finish(false), timeout);
    channel.postMessage({
      ...message, phase: 'prepare', outcome, expires,
    });
  });
}

/** Signal only a verified batch. Authored text is updated by DA source collaboration. */
export function notifyDisclosureSave(context, operation, win) {
  const message = messageFor(context, operation);
  if (!win.BroadcastChannel || !completed(operation) || !message) return false;
  const channel = new win.BroadcastChannel(CHANNEL);
  channel.postMessage({ ...message, phase: 'complete' });
  channel.close();
  return true;
}

/** Same-origin Canvas preview and inline manager share this standard browser channel. */
export function listenDisclosureSaves(doc, win, refresh) {
  if (!doc.body?.classList.contains('quick-edit') || !win.BroadcastChannel) return null;
  const channel = new win.BroadcastChannel(CHANNEL);
  const seen = new Set();
  const prepared = new Map();
  let pending = Promise.resolve();
  let disposed = false;
  channel.onmessage = ({ data }) => {
    if (data?.version !== 1 || data.site !== SITE
      || typeof data.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.namespace)
      || !Array.isArray(data.affectedPages)
      || !data.affectedPages.includes(pathFor(win.location.pathname))) return;
    if ((data.mapping || data.before || data.after) && !validMapping(data)) return;
    if (data.phase === 'prepare' && ['complete', 'restored'].includes(data.outcome)
      && validMapping(data)) {
      const key = `${data.id}:${data.outcome}`;
      pending = pending.then(() => {
        if (disposed || !Number.isFinite(data.expires) || Date.now() >= data.expires) return;
        if (!seen.has(key) && !prepared.has(key)) {
          prepared.set(key, captureView(doc, data, pathFor(win.location.pathname), data.direction === 'resume'));
          if (prepared.size > 20) prepared.delete(prepared.keys().next().value);
        }
        channel.postMessage({
          phase: 'ready', site: SITE, id: data.id, outcome: data.outcome, path: pathFor(win.location.pathname),
        });
      });
      return;
    }
    if ((data.phase && data.phase !== 'complete') || !completed(data)) return;
    const key = `${data.id}:${data.status}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 50) seen.delete(seen.values().next().value);
    const captured = prepared.get(key);
    prepared.delete(key);
    pending = pending.then(async () => {
      if (disposed || !data.affectedPages.includes(pathFor(win.location.pathname))) return;
      let suspended = [];
      if (validMapping(data)) {
        const current = captured || captureView(doc, data, pathFor(win.location.pathname), true);
        const intent = JSON.stringify([
          data.namespace, data.setPath, data.mapping, data.before, data.after,
        ]);
        if (!current.blocked && current.intent === intent) {
          applyDisclosureRenumbering(doc, current.captured);
        }
        const rendered = JSON.stringify(disclosureReferenceSignature(doc, data));
        if (current.blocked || current.intent !== intent
          || rendered !== JSON.stringify(current.expected)) {
          requireDisclosureViewRefresh(doc, data);
        }
        suspended = unlinkDisclosureReferences(doc, data, { suspendStandalone: true });
      }
      await refresh(data);
      if (!disposed) restoreDisclosureLinks(doc, suspended);
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Disclosure author refresh failed', error);
    });
  };
  return () => { disposed = true; channel.close(); };
}
