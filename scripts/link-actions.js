export const PRIVACY_ACTION = 'privacy-preferences';
const PARAMETER = '@action';

function queryParts(href) {
  const hashAt = href.indexOf('#');
  const target = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = target.indexOf('?');
  return { target, queryAt, hash: hashAt < 0 ? '' : href.slice(hashAt) };
}

export function linkAction(href) {
  const { target, queryAt } = queryParts(href);
  const values = new URLSearchParams(queryAt < 0 ? '' : target.slice(queryAt + 1))
    .getAll(PARAMETER);
  return values.length === 1 && values[0] === PRIVACY_ACTION ? PRIVACY_ACTION : '';
}

/** Remove only action markers, preserving the spelling of all other URL bytes. */
export function cleanActionHref(href) {
  const { target, queryAt, hash } = queryParts(href);
  if (queryAt < 0) return href;
  const query = target.slice(queryAt + 1).split('&').filter((part) => (
    new URLSearchParams(part).keys().next().value !== PARAMETER
  )).join('&');
  return `${target.slice(0, queryAt)}${query ? `?${query}` : ''}${hash}`;
}

export function authorActionHref(href, action = '') {
  if (action && action !== PRIVACY_ACTION) throw new Error('Choose a supported link action.');
  const clean = cleanActionHref(href);
  if (!action) return clean;
  const { target, hash } = queryParts(clean);
  let separator = target.includes('?') ? '&' : '?';
  if (/[?&]$/.test(target)) separator = '';
  return `${target}${separator}${PARAMETER}=${action}${hash}`;
}

/** Explicit actions survive cloning; an icon never selects link behavior. */
export default function decorateLinkActions(root) {
  const links = [...root.querySelectorAll('a[href]')];
  if (root.matches?.('a[href]')) links.unshift(root);
  links.forEach((link) => {
    const href = link.getAttribute('href');
    const clean = cleanActionHref(href);
    if (clean === href) return;
    const action = linkAction(href);
    let url;
    try { url = new URL(clean, 'https://authoring.example/'); } catch { /* Keep normal navigation. */ }
    link.setAttribute('href', clean);
    if (link.dataset.linkAction === PRIVACY_ACTION) link.removeAttribute('aria-haspopup');
    delete link.dataset.linkAction;
    if (!action || !['http:', 'https:'].includes(url?.protocol)) return;
    link.dataset.linkAction = action;
    link.setAttribute('aria-haspopup', 'dialog');
  });
}
