/** Capture one unambiguous anchor in a block DA can replace with a version guard. */
export function captureLinkEdit(snapshot, selectionHTML) {
  const index = snapshot?.selection?.blockIndex;
  if (snapshot?.editable !== true || !Number.isSafeInteger(index) || index < 0
    || typeof snapshot.html !== 'string' || typeof selectionHTML !== 'string') return null;
  const parser = new DOMParser();
  const selection = parser.parseFromString(selectionHTML, 'text/html');
  const selected = [...selection.querySelectorAll('a[href]')];
  if (selected.length !== 1) return null;
  const doc = parser.parseFromString(snapshot.html, 'text/html');
  const block = doc.querySelector(`[data-block-index="${index}"]`);
  if (!block) return null;
  const links = [...block.querySelectorAll('a[href]')];
  const matches = links.filter((link) => link.getAttribute('href') === selected[0].getAttribute('href')
    && link.textContent.includes(selected[0].textContent));
  if (matches.length !== 1) return null;
  return {
    expected: { html: snapshot.html, blockIndex: index },
    blockHTML: block.outerHTML,
    linkIndex: links.indexOf(matches[0]),
    linkHTML: matches[0].outerHTML,
    selectionHTML,
  };
}

/** Preserve the full block, wording, marks, media and unrelated anchors. */
export function updatedLinkBlock(edit, href) {
  const doc = new DOMParser().parseFromString(edit.blockHTML, 'text/html');
  const block = doc.querySelector('[data-block-index]');
  const link = block.querySelectorAll('a[href]')[edit.linkIndex];
  link.setAttribute('href', href);
  link.removeAttribute('data-tracking-key');
  link.removeAttribute('data-tracking-category');
  link.removeAttribute('data-link-action');
  return block.outerHTML;
}
