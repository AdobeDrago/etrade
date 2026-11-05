import {
  authorTrackingHref, cleanTrackingHref, DEFAULT_CATEGORY,
  trackingCategories, trackingParameters, validTrackingKey,
} from '../../../scripts/tracking-attributes.js';
import { authorRouteHref, cleanRouteHref, routeSettings } from '../../../scripts/route-links.js';
import {
  authorActionHref, cleanActionHref, linkAction, PRIVACY_ACTION, PRIVACY_ACTION_HREF,
} from '../../../scripts/link-actions.js';

function fail(field, message) {
  throw Object.assign(new Error(message), { field });
}

export function readSelectedLink(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = [...doc.body.querySelectorAll('a[href]')];
  if (links.length !== 1) {
    throw new Error('Select one complete link and use “Load selected link”, or paste its URL below.');
  }
  const [link] = links;
  const href = link.getAttribute('href');
  let action = linkAction(href);
  if (cleanActionHref(href) === href && link.dataset.linkAction === PRIVACY_ACTION) {
    action = PRIVACY_ACTION;
  }
  const tracking = trackingParameters(href);
  if (!tracking.enabled && link.hasAttribute('data-tracking-key')) {
    tracking.enabled = true;
    tracking.key = link.dataset.trackingKey;
    tracking.category = link.dataset.trackingCategory ?? DEFAULT_CATEGORY;
  }
  return {
    href: action ? '' : cleanActionHref(cleanRouteHref(cleanTrackingHref(href))),
    label: link.textContent.trim() || link.querySelector('img')?.alt || 'Image link',
    target: link.getAttribute('target') || '_self',
    action,
    route: routeSettings(href),
    ...tracking,
  };
}

/** Explain the author settings without implying a reporting event has been sent. */
export function linkSummary(options) {
  const categories = trackingCategories(options.category);
  const names = { C0002: 'Analytics', C0004: 'Advertising' };
  let opening = 'Keep the opening behavior set in DA';
  if (options.target === '_blank') opening = 'Opens in a new tab or window';
  else if (options.target === '_self') opening = 'Opens in the same tab';
  else if (options.target) opening = `Opens in target “${options.target}”`;
  if (options.action === PRIVACY_ACTION) opening = 'Opens OneTrust cookie preferences on this page';
  return {
    label: options.label || 'Load a selected link to see its wording',
    destination: options.action === PRIVACY_ACTION ? 'No destination — stays on this page' : options.href.trim() || 'Add a destination below',
    opening,
    action: options.action === PRIVACY_ACTION ? 'Open cookie preferences (OneTrust)' : 'Normal link',
    condition: options.action !== PRIVACY_ACTION && options.route?.enabled
      ? `Alternate wording and destination under ${options.route.paths || 'the paths below'}; default everywhere else`
      : 'Same wording and destination on every page',
    tracking: options.enabled ? `Reports clicks using “${options.key.trim() || 'add a tracking key'}”` : 'Link click tracking is off',
    consent: options.enabled
      ? categories?.map((id) => `${names[id] || 'Custom category'} (${id})`).join(' + ') || 'Choose valid consent categories'
      : 'No consent category added by this tool',
  };
}

export function composeLinkURL(options) {
  if (options.action && options.action !== PRIVACY_ACTION) {
    fail('link-action', 'Choose a supported link action.');
  }
  const isAction = options.action === PRIVACY_ACTION;
  const href = isAction ? PRIVACY_ACTION_HREF : cleanActionHref(options.href.trim());
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
  try {
    return authorActionHref(authorRouteHref(authorTrackingHref(href, {
      enabled: options.enabled, key, category: required || DEFAULT_CATEGORY,
    }), isAction ? null : options.route), options.action);
  } catch (error) {
    const field = { label: 'route-label', href: 'route-url' }[error.field] || 'route-paths';
    throw Object.assign(error, { field });
  }
}
