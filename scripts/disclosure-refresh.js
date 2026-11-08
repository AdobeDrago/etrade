import { disclosureFragmentPath } from './disclosure-sets.js';

const registrations = new WeakMap();

function setPath(request) {
  try {
    const path = new URL(request, 'https://placeholder.invalid').pathname
      .replace(/^\/(preview|live)\/adobedrago\/etrade(?=\/)/, '');
    return disclosureFragmentPath(path);
  } catch { return null; }
}

/** The block owns rendering; editor code can refresh it without importing another block. */
export function registerDisclosureSet(block, refresh, request) {
  const doc = block.ownerDocument;
  if (!registrations.has(doc)) registrations.set(doc, new Map());
  registrations.get(doc).set(block, {
    refresh, request, connected: block.isConnected, pending: null, snapshot: undefined,
  });
}

export async function refreshDisclosureSets(doc, change) {
  const registered = registrations.get(doc);
  if (!registered) return;
  const results = await Promise.allSettled([...registered].map(async ([block, state]) => {
    if (!block.isConnected) {
      if (state.connected) registered.delete(block);
      return;
    }
    state.connected = true;
    if (change?.after && setPath(state.request) === disclosureFragmentPath(change.setPath)) {
      state.snapshot = change.after;
    }
    if (!state.pending) {
      const refresh = async () => {
        const { snapshot } = state;
        const caughtUp = await state.refresh(snapshot);
        if (state.snapshot !== snapshot) { await refresh(); return; }
        if (caughtUp) state.snapshot = undefined;
      };
      state.pending = Promise.resolve().then(refresh)
        .finally(() => { state.pending = null; });
    }
    await state.pending;
  }));
  results.forEach((result) => {
    if (result.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('Disclosure refresh failed', result.reason);
    }
  });
}
