const registrations = new WeakMap();

/** The block owns rendering; editor code can refresh it without importing another block. */
export function registerDisclosureSet(block, refresh) {
  const doc = block.ownerDocument;
  if (!registrations.has(doc)) registrations.set(doc, new Map());
  registrations.get(doc).set(block, { refresh, connected: block.isConnected, pending: null });
}

export async function refreshDisclosureSets(doc) {
  const registered = registrations.get(doc);
  if (!registered) return;
  const results = await Promise.allSettled([...registered].map(async ([block, state]) => {
    if (!block.isConnected) {
      if (state.connected) registered.delete(block);
      return;
    }
    state.connected = true;
    if (!state.pending) {
      state.pending = Promise.resolve().then(state.refresh)
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
