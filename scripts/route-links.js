import { authorTrackingHref, trackingParameters } from './tracking-attributes.js';

const PARAMETERS = ['@link-paths', '@link-label', '@link-url'];
const hasControls = (value) => [...value]
  .some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

function queryParts(href) {
  const hashAt = href.indexOf('#');
  const target = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = target.indexOf('?');
  return { target, queryAt, hash: hashAt < 0 ? '' : href.slice(hashAt) };
}

export function cleanRouteHref(href) {
  const { target, queryAt, hash } = queryParts(href);
  if (queryAt < 0) return href;
  const query = target.slice(queryAt + 1).split('&').filter((part) => (
    !PARAMETERS.includes(new URLSearchParams(part).keys().next().value)
  )).join('&');
  return `${target.slice(0, queryAt)}${query ? `?${query}` : ''}${hash}`;
}

export function routeSettings(href) {
  const { target, queryAt } = queryParts(href);
  const params = new URLSearchParams(queryAt < 0 ? '' : target.slice(queryAt + 1));
  return {
    enabled: PARAMETERS.some((name) => params.has(name)),
    paths: params.get('@link-paths') || '',
    label: params.get('@link-label') || '',
    href: params.get('@link-url') || '',
  };
}

export function routePaths(value) {
  const paths = [...new Set(String(value).split(',').map((item) => item.trim().replace(/\.html$/, '').replace(/\/$/, '') || '/'))];
  if (!paths.length || paths.length > 10 || paths.some((path) => path.length > 256
    || !/^\/(?:[a-z0-9_~.-]+\/)*[a-z0-9_~.-]*$/i.test(path)
    || path.split('/').some((part) => part === '.' || part === '..'))) {
    throw new Error('Enter up to 10 page paths, separated by commas, such as /brokerage, /what-we-offer.');
  }
  if (!String(value).trim() || String(value).split(',').some((part) => !part.trim())) {
    throw new Error('Enter a page path for each condition.');
  }
  return paths;
}

export function validateRouteRule(rule) {
  const paths = routePaths(rule.paths);
  const label = rule.label.trim();
  const href = cleanRouteHref(rule.href.trim());
  if (!label || label.length > 160 || hasControls(label)) {
    throw Object.assign(new Error('Enter alternate wording of 1–160 characters without control characters.'), { field: 'label' });
  }
  let url;
  try { url = new URL(href, 'https://authoring.example/'); } catch { /* Validate below. */ }
  if (!href || href.length > 2048 || hasControls(href)
    || !['http:', 'https:', 'mailto:', 'tel:'].includes(url?.protocol)) {
    throw Object.assign(new Error('Enter a valid web, email or telephone destination for matching pages.'), { field: 'href' });
  }
  return { paths, label, href };
}

export function authorRouteHref(href, rule) {
  const clean = cleanRouteHref(href);
  if (!rule?.enabled) return clean;
  const valid = validateRouteRule(rule);
  const { target, hash } = queryParts(clean);
  let separator = target.includes('?') ? '&' : '?';
  if (/[?&]$/.test(target)) separator = '';
  return `${target}${separator}@link-paths=${encodeURIComponent(valid.paths.join(','))}&@link-label=${encodeURIComponent(valid.label)}&@link-url=${encodeURIComponent(valid.href)}${hash}`;
}

export function resolveRouteLink(href, pageUrl) {
  const fallback = cleanRouteHref(href);
  const settings = routeSettings(href);
  if (!settings.enabled) return { href: fallback, matched: false };
  try {
    const rule = validateRouteRule(settings);
    const path = new URL(pageUrl).pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const matched = rule.paths.some((prefix) => prefix === '/' || path === prefix || path.startsWith(`${prefix}/`));
    if (matched) {
      const tracking = trackingParameters(fallback);
      return { href: authorTrackingHref(rule.href, tracking), label: rule.label, matched: true };
    }
  } catch { /* Incomplete or invalid rules keep the default destination and wording. */ }
  return { href: fallback, matched: false };
}

/** Run before tracking and button decoration, including on shared fragments. */
export default function decorateRouteLinks(root, pageUrl) {
  const links = [...root.querySelectorAll('a[href]')];
  if (root.matches?.('a[href]')) links.unshift(root);
  links.forEach((link) => {
    const authored = link.getAttribute('href');
    if (!routeSettings(authored).enabled) return;
    const textNodes = [];
    const visit = (node) => {
      if (node.nodeType === 3 && node.textContent.trim()) textNodes.push(node);
      else [...node.childNodes].forEach(visit);
    };
    visit(link);
    // Image/icon links need a separate accessible-name contract; keep their authored default.
    const media = link.querySelector('img, picture, svg, .icon');
    const result = media || !textNodes.length
      ? { href: cleanRouteHref(authored), matched: false } : resolveRouteLink(authored, pageUrl);
    if (result.matched) {
      const oldLabel = link.textContent.trim();
      textNodes.forEach((node, index) => { node.textContent = index === 0 ? result.label : ''; });
      if (link.hasAttribute('aria-label')) link.setAttribute('aria-label', result.label);
      if (link.getAttribute('title') === oldLabel) link.setAttribute('title', result.label);
    }
    link.setAttribute('href', result.href);
  });
}
