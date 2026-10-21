export const KEY_PARAM = '@tracking';
export const CATEGORY_PARAM = '@tracking-category';
export const DEFAULT_CATEGORY = 'C0004';

export function trackingCategories(value) {
  const list = Array.isArray(value) ? value : String(value).split(',');
  const result = [...new Set(list.map((item) => String(item).trim()))];
  return result.length && result.every((item) => /^C\d{4,}$/.test(item)) ? result : null;
}

export function validTrackingKey(key) {
  return typeof key === 'string' && !!key && key.length <= 160
    && ![...key].some((char) => char.charCodeAt(0) < 32);
}

/** Read only an authored query; fragment links must not inherit the current page's query. */
export function trackingParameters(href) {
  const queryAt = href.indexOf('?');
  const hashAt = href.indexOf('#');
  const query = queryAt < 0 || (hashAt >= 0 && queryAt > hashAt)
    ? '' : href.slice(queryAt + 1, hashAt < 0 ? undefined : hashAt);
  const parameters = new URLSearchParams(query);
  return {
    enabled: parameters.has(KEY_PARAM),
    key: (parameters.get(KEY_PARAM) || '').trim(),
    category: parameters.get(CATEGORY_PARAM) ?? DEFAULT_CATEGORY,
  };
}

/** Retain other query bytes, relative URL spelling and fragments. */
export function cleanTrackingHref(href) {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const target = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = target.indexOf('?');
  if (queryAt < 0) return href;
  const query = target.slice(queryAt + 1).split('&').filter((part) => {
    const name = new URLSearchParams(part).keys().next().value;
    return name !== KEY_PARAM && name !== CATEGORY_PARAM;
  }).join('&');
  return `${target.slice(0, queryAt)}${query ? `?${query}` : ''}${hash}`;
}

export function authorTrackingHref(href, { enabled, key, category = DEFAULT_CATEGORY }) {
  const clean = cleanTrackingHref(href);
  if (!enabled) return clean;
  const required = trackingCategories(category);
  if (!validTrackingKey(key) || !required) throw new Error('Invalid tracking configuration.');
  const hashAt = clean.indexOf('#');
  const target = hashAt < 0 ? clean : clean.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : clean.slice(hashAt);
  let separator = target.includes('?') ? '&' : '?';
  if (/[?&]$/.test(target)) separator = '';
  const consent = required.join(',');
  const categoryParam = consent === DEFAULT_CATEGORY ? '' : `&${CATEGORY_PARAM}=${encodeURIComponent(consent)}`;
  return `${target}${separator}${KEY_PARAM}=${encodeURIComponent(key)}${categoryParam}${hash}`;
}
