const DELIVERY_ORIGIN = 'https://da-sc.adobeaem.workers.dev';
const SITE_PATH = '/adobedrago/etrade';

/** Normalize authored document paths without accepting external fragment URLs. */
export function disclosureFragmentPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (path === '/' || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) return null;
  return path.replace(/(?:\.plain)?\.html$/, '');
}

/** Select DA's preview/live delivery endpoint, or an explicitly authored JSON file. */
export function disclosureSetRequest(value, base = window.location.href) {
  let url;
  try { url = new URL(value, base); } catch { return null; }
  const location = new URL(base);
  if (url.origin === DELIVERY_ORIGIN) {
    return /^\/(preview|live)\/adobedrago\/etrade\/.+/.test(url.pathname) ? url.href : null;
  }
  // The metadata may contain a full URL to this site's preview or published content.
  const projectHost = /--etrade--adobedrago\.aem\.(page|live)$/i.test(url.hostname);
  if (url.origin !== location.origin && !projectHost) return null;
  if (url.pathname.endsWith('.json')) return url.href;
  const path = disclosureFragmentPath(url.pathname);
  if (!path?.startsWith('/disclosures/sets/')) return null;
  const preview = /(?:\.aem\.page$|\.hlx\.page$|da\.live$)/i.test(location.hostname)
    || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return `${DELIVERY_ORIGIN}/${preview ? 'preview' : 'live'}${SITE_PATH}${path}`;
}

/** Number valid, unique disclosure IDs in authored array order. */
export function disclosureSetEntries(payload) {
  const set = payload?.data ?? payload;
  if (!set || !Array.isArray(set.disclosures)) throw new Error('Invalid disclosure set.');
  const entries = [];
  const append = (items, entryFor) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const path = disclosureFragmentPath(item?.fragment);
      if (!path) return;
      const entry = entryFor(item);
      if (entry) entries.push({ ...entry, path });
    });
  };
  append(set.introduction, (item) => {
    if (item.kind === 'notice') return { label: 'Notice' };
    if (item.kind === 'logo') return { label: 'Logo' };
    return { label: 'Introduction' };
  });
  const ids = new Set();
  const numbers = new Set();
  const usesIds = set.disclosures.some((item) => item && Object.hasOwn(item, 'disclosureId'));
  append(set.disclosures, (item) => {
    // Preview/live content may still serve the previous schema during migration.
    if (!usesIds) {
      const number = typeof item.number === 'string' && /^\d+$/.test(item.number)
        ? Number(item.number) : item.number;
      if (!Number.isSafeInteger(number) || number < 1 || numbers.has(number)) return null;
      numbers.add(number);
      return { label: String(number) };
    }
    const { disclosureId } = item;
    if (typeof disclosureId !== 'string' || !/^[a-z][a-z0-9]*$/.test(disclosureId)
      || ids.has(disclosureId)) return null;
    ids.add(disclosureId);
    return { label: String(ids.size), disclosureId };
  });
  append(set.closing, () => ({ label: 'Closing' }));
  return entries;
}

export async function loadDisclosureSet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Disclosure set request failed (${response.status}).`);
  return disclosureSetEntries(await response.json());
}
