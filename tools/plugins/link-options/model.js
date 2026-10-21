import {
  authorTrackingHref, cleanTrackingHref, DEFAULT_CATEGORY,
  trackingCategories, trackingParameters, validTrackingKey,
} from '../../../scripts/tracking-attributes.js';

function fail(field, message) {
  throw Object.assign(new Error(message), { field });
}

export function readSelectedLink(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = [...doc.body.querySelectorAll('a[href]')];
  if (links.length !== 1) {
    throw new Error('Select one complete link and reload the selection, or paste its URL below.');
  }
  const [link] = links;
  const href = link.getAttribute('href');
  const tracking = trackingParameters(href);
  if (!tracking.enabled && link.hasAttribute('data-tracking-key')) {
    tracking.enabled = true;
    tracking.key = link.dataset.trackingKey;
    tracking.category = link.dataset.trackingCategory ?? DEFAULT_CATEGORY;
  }
  return {
    href: cleanTrackingHref(href),
    label: link.textContent.trim() || link.querySelector('img')?.alt || 'Image link',
    ...tracking,
  };
}

export function composeLinkURL(options) {
  const href = options.href.trim();
  const hasControls = [...href]
    .some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (!href || hasControls) fail('url', 'Enter a valid destination URL.');
  let url;
  try { url = new URL(href, 'https://authoring.example/'); } catch {
    fail('url', 'Enter a valid destination URL.');
  }
  if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
    fail('url', 'Use a web address, relative path, email address or telephone link.');
  }
  const key = options.key.trim();
  if (options.enabled && !validTrackingKey(key)) {
    fail('tracking-key', 'Enter a tracking key of 1–160 characters without control characters.');
  }
  const required = trackingCategories(options.category);
  if (options.enabled && !required) {
    fail('custom-category', 'Use consent category IDs such as C0004 or C0002,C0004.');
  }
  return authorTrackingHref(href, {
    enabled: options.enabled, key, category: required || DEFAULT_CATEGORY,
  });
}
