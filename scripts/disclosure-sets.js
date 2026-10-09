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
  const preview = /(?:\.aem\.page$|\.hlx\.page$)/i.test(location.hostname)
    || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return `${DELIVERY_ORIGIN}/${preview ? 'preview' : 'live'}${SITE_PATH}${path}`;
}

/** Keep authored order and explicit numbers; omit incomplete or duplicate entries. */
export function disclosureSetEntries(payload) {
  const set = payload?.data ?? payload;
  if (!set || !Array.isArray(set.disclosures)) throw new Error('Invalid disclosure set.');
  const entries = [];
  const append = (items, labelFor) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const path = disclosureFragmentPath(item?.fragment);
      if (!path) return;
      const label = labelFor(item);
      if (label !== null) entries.push({ label, path });
    });
  };
  append(set.introduction, (item) => {
    if (item.kind === 'notice') return 'Notice';
    if (item.kind === 'logo') return 'Logo';
    return 'Introduction';
  });
  const numbers = new Set();
  append(set.disclosures, (item) => {
    const number = typeof item.number === 'string' && /^\d+$/.test(item.number)
      ? Number(item.number) : item.number;
    if (!Number.isSafeInteger(number) || number < 1 || numbers.has(number)) return null;
    if (!disclosureFragmentPath(item.fragment)) return null;
    numbers.add(number);
    return String(number);
  });
  append(set.closing, () => 'Closing');
  return entries;
}

export async function loadDisclosureSet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Disclosure set request failed (${response.status}).`);
  return disclosureSetEntries(await response.json());
}
