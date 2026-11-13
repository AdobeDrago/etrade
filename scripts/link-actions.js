import { KEY_PARAM, CATEGORY_PARAM } from './tracking-attributes.js';

export const PRIVACY_ACTION = 'privacy-preferences';
export const PRIVACY_ACTION_HREF = `@${PRIVACY_ACTION}`;
const PARAMETER = '@action';

function queryParts(href) {
  const hashAt = href.indexOf('#');
  const target = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = target.indexOf('?');
  return { target, queryAt, hash: hashAt < 0 ? '' : href.slice(hashAt) };
}

export function linkAction(href) {
  const { target, queryAt, hash } = queryParts(href);
  const values = new URLSearchParams(queryAt < 0 ? '' : target.slice(queryAt + 1))
    .getAll(PARAMETER);
  if (values.length) return values.length === 1 && values[0] === PRIVACY_ACTION ? PRIVACY_ACTION : '';
  const path = queryAt < 0 ? target : target.slice(0, queryAt);
  return path === PRIVACY_ACTION_HREF && !hash ? PRIVACY_ACTION : '';
}

/** Remove only action markers, preserving the spelling of all other URL bytes. */
export function cleanActionHref(href) {
  const { target, queryAt, hash } = queryParts(href);
  const path = queryAt < 0 ? target : target.slice(0, queryAt);
  const destination = path === PRIVACY_ACTION_HREF ? '' : path;
  if (queryAt < 0) return `${destination}${hash}`;
  const query = target.slice(queryAt + 1).split('&').filter((part) => (
    new URLSearchParams(part).keys().next().value !== PARAMETER
  )).join('&');
  return `${destination}${query ? `?${query}` : ''}${hash}`;
}

export function authorActionHref(href, action = '') {
  if (action && action !== PRIVACY_ACTION) throw new Error('Choose a supported link action.');
  if (!action) return cleanActionHref(href);
  const { target, queryAt } = queryParts(href);
  const query = queryAt < 0 ? '' : target.slice(queryAt + 1).split('&').filter((part) => (
    [KEY_PARAM, CATEGORY_PARAM].includes(new URLSearchParams(part).keys().next().value)
  )).join('&');
  return `${PRIVACY_ACTION_HREF}${query ? `?${query}` : ''}`;
}

/** Explicit actions survive cloning; an icon never selects link behavior. */
export default function decorateLinkActions(root) {
  const links = [...root.querySelectorAll('a[href]')];
  if (root.matches?.('a[href]')) links.unshift(root);
  links.forEach((link) => {
    const href = link.getAttribute('href');
    const clean = cleanActionHref(href);
    const action = clean === href ? link.dataset.linkAction : linkAction(href);
    if (clean === href && action !== PRIVACY_ACTION) return;
    let url;
    try { url = new URL(clean, 'https://authoring.example/'); } catch { /* Keep normal navigation. */ }
    const supported = action === PRIVACY_ACTION && ['http:', 'https:'].includes(url?.protocol);
    const destination = supported
      ? `${authorActionHref(href, action).slice(PRIVACY_ACTION_HREF.length)}#` : clean;
    // Tracking watches href changes; writing an unchanged value would retrigger decoration.
    if (href !== destination) link.setAttribute('href', destination);
    if (!supported) {
      if (link.dataset.linkAction === PRIVACY_ACTION) {
        link.removeAttribute('aria-haspopup');
        if (link.getAttribute('role') === 'button') link.removeAttribute('role');
      }
      delete link.dataset.linkAction;
      return;
    }
    link.removeAttribute('target');
    link.removeAttribute('download');
    link.dataset.linkAction = action;
    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'dialog');
  });
}
