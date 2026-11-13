/** Remember the authored destination before route/tracking controls are consumed. */
export function rememberLinkSource(link) {
  // Preserve provenance through fragment cloning and DOM wrapper changes as well as moves.
  if (!link.hasAttribute('data-authored-href')) {
    link.setAttribute('data-authored-href', link.getAttribute('href'));
  }
}

export function authoredLinkHref(link) {
  return link.getAttribute('data-authored-href') ?? link.getAttribute('href');
}
