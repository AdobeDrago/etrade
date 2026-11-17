/**
 * Links leaving E*TRADE open in a new tab. Preview hosts count as E*TRADE, but its
 * /speedbump/ exit pages (which forward to banks and other partners) count as external.
 */
export function isExternalLink(link) {
  let url;
  try {
    url = new URL(link.getAttribute('href'), window.location.href);
  } catch (error) {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const { hostname, pathname } = url;
  const isEtrade = hostname === window.location.hostname
    || hostname === 'etrade.com' || hostname.endsWith('.etrade.com');
  return !isEtrade || pathname.startsWith('/speedbump/');
}

/** Give external links target="_blank", and every new-tab link rel="noopener noreferrer". */
export default function openExternalLinks(container) {
  container.querySelectorAll('a[href]').forEach((link) => {
    if (isExternalLink(link)) link.target = '_blank';
    if (link.getAttribute('target') !== '_blank') return;
    const rel = (link.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
    link.setAttribute('rel', [...new Set([...rel, 'noopener', 'noreferrer'])].join(' '));
  });
}
