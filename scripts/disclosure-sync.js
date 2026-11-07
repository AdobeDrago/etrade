const CHANNEL = 'etrade-disclosure-saves-v1';
const SITE = 'adobedrago/etrade';
const pathFor = (value) => (typeof value === 'string' && /^\/(?!\/)[^?#\\]*$/.test(value)
  ? value.replace(/\.html$/, '').replace(/\/$/, '') : null);
const completed = (operation) => ['complete', 'restored'].includes(operation?.status);

/** Signal only a verified batch. Authored text is updated by DA source collaboration. */
export function notifyDisclosureSave(context, operation, win) {
  if (!win.BroadcastChannel || !completed(operation)
    || `${context.org}/${context.repo}`.toLowerCase() !== SITE
    || `${operation.org}/${operation.repo}`.toLowerCase() !== SITE
    || typeof operation.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operation.namespace)
    || !Array.isArray(operation.affectedPages)) return false;
  const channel = new win.BroadcastChannel(CHANNEL);
  channel.postMessage({
    version: 1,
    site: SITE,
    id: operation.id,
    status: operation.status,
    namespace: operation.namespace,
    setPath: operation.setPath,
    affectedPages: operation.affectedPages.map(pathFor).filter(Boolean),
  });
  channel.close();
  return true;
}

/** Same-origin Canvas preview and inline manager share this standard browser channel. */
export function listenDisclosureSaves(doc, win, refresh) {
  if (!doc.body?.classList.contains('quick-edit') || !win.BroadcastChannel) return null;
  const channel = new win.BroadcastChannel(CHANNEL);
  const seen = new Set();
  let pending = Promise.resolve();
  channel.onmessage = ({ data }) => {
    if (data?.version !== 1 || data.site !== SITE || !completed(data)
      || typeof data.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.namespace)
      || !Array.isArray(data.affectedPages)
      || !data.affectedPages.includes(pathFor(win.location.pathname))) return;
    const key = `${data.id}:${data.status}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 50) seen.delete(seen.values().next().value);
    // Refresh footer targets only. Applying the permutation here would double-map native updates.
    pending = pending.then(() => refresh(data)).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Disclosure author refresh failed', error);
    });
  };
  return () => channel.close();
}
