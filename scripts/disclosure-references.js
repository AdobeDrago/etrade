/** Retain stable IDs only while the generated citation is still intact. */
function referenceText(sup, targets) {
  const ids = sup.dataset.disclosureIds;
  const links = [...sup.querySelectorAll('a[href]')];
  const numbers = links.map((link) => link.getAttribute('aria-label')?.match(/^Disclosure (\d+)$/)?.[1]);
  const unchanged = ids && links.length === ids.split(',').length
    && numbers.every((number, index) => number && links[index].textContent === number)
    && sup.textContent.trim() === numbers.join(',');
  if (!unchanged) return sup.textContent.trim();
  const stored = ids.split(',');
  return links.map((link, index) => {
    const href = link.getAttribute('href');
    if (targets.get(stored[index])?.href === href) return stored[index];
    return [...targets].find(([, target]) => target.href === href)?.[0] || '';
  }).join(',');
}

/** Remove only generated, static references when their legal targets become unavailable. */
export function clearDisclosureReferences(main, namespace) {
  main?.querySelectorAll('sup.disclosures-reference').forEach((sup) => {
    if (sup.closest('.prosemirror-editor, .ProseMirror, [contenteditable="true"]')) return;
    const links = [...sup.querySelectorAll('a[href]')];
    if (links.some((link) => {
      const href = link.getAttribute('href');
      const named = href.match(/^#disclosure-(.+)-[1-9]\d*$/);
      return !/^#disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href)
        || (namespace && named && named[1] !== namespace);
    })) return;
    const numbers = links.map((link) => link.getAttribute('aria-label')?.match(/^Disclosure (\d+)$/)?.[1]);
    const intact = numbers.length > 0 && numbers.every(Boolean)
      && sup.textContent.trim() === numbers.join(',');
    sup.textContent = (intact && sup.dataset.disclosureIds) || sup.textContent;
    delete sup.dataset.disclosureIds;
    sup.classList.remove('disclosures-reference');
  });
}

/** Auto-link static markers only after their footer items have rendered. */
export default function decorateDisclosureReferences(main, disclosures = main?.querySelector('.disclosures')
  || document.querySelector('.disclosures:not([hidden])')) {
  if (!main || !disclosures || disclosures.hidden) return;
  const targets = new Map();
  const namespace = disclosures.dataset.disclosureNamespace;
  const items = [...disclosures.querySelectorAll('.disclosures-items > li[id]')];
  const usesIds = items.some((item) => item.dataset.disclosureId);
  items.forEach((item, index) => {
    const legacyId = item.id.match(/^disclosure-(\d+)$/)?.[1];
    const number = Number(item.getAttribute('value') || legacyId || index + 1);
    const id = item.dataset.disclosureId || legacyId || String(number);
    if (id && number > 0) {
      const target = { href: `#${item.id}`, number: String(number) };
      targets.set(id, target);
      if (namespace) targets.set(`${namespace}-${id}`, target);
      // Pages may already author a–z IDs while preview still delivers the numeric schema.
      const legacyNumber = Number(id);
      if (!usesIds && legacyNumber >= 1 && legacyNumber <= 26) {
        targets.set(String.fromCharCode(96 + legacyNumber), target);
      }
    }
  });
  main.querySelectorAll('sup').forEach((sup) => {
    if (sup.closest('.disclosures, .prosemirror-editor, .ProseMirror, [contenteditable="true"]')) return;
    const text = referenceText(sup, targets);
    const ids = text.split(/\s*,\s*/);
    if (!ids.every((id) => targets.has(id))) return;

    const outerLink = sup.closest('a[href]');
    if (outerLink && (outerLink !== sup.parentElement || outerLink.children.length !== 1
      || outerLink.textContent.trim() !== sup.textContent.trim())) return;
    const authoredLinks = [...sup.querySelectorAll('a[href]'), ...(outerLink ? [outerLink] : [])];
    if (authoredLinks.some((link) => {
      const href = link.getAttribute('href');
      const named = href.match(/^#disclosure-(.+)-[1-9]\d*$/);
      return !/^#disclosure-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href)
        || (namespace && named && named[1] !== namespace);
    })) return;

    // Preserve the authored IDs so a later pass never interprets display numbers as IDs.
    sup.dataset.disclosureIds = ids.join(',');
    sup.classList.add('disclosures-reference');
    if (!outerLink && authoredLinks.length === ids.length
      && authoredLinks.every((link, index) => {
        const { href, number } = targets.get(ids[index]);
        return link.getAttribute('href') === href && link.textContent === number
          && link.getAttribute('aria-label') === `Disclosure ${number}`;
      })) return;
    if (outerLink) outerLink.replaceWith(sup);
    sup.replaceChildren();
    ids.forEach((id, index) => {
      if (index) sup.append(',');
      const { href, number } = targets.get(id);
      const link = document.createElement('a');
      link.href = href;
      link.textContent = number;
      link.setAttribute('aria-label', `Disclosure ${number}`);
      sup.append(link);
    });
  });
}
