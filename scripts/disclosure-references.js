/** Auto-link inline markers only after their footer items have rendered. */
export default function decorateDisclosureReferences(main, disclosures = document.querySelector('.disclosures:not([hidden])')) {
  if (!main || !disclosures || disclosures.hidden) return;
  const targets = new Map();
  const items = [...disclosures.querySelectorAll('.disclosures-items > li[id]')];
  const usesIds = items.some((item) => item.dataset.disclosureId);
  items.forEach((item, index) => {
    const legacyId = item.id.match(/^disclosure-(\d+)$/)?.[1];
    const id = item.dataset.disclosureId || legacyId;
    const number = Number(item.getAttribute('value') || legacyId || index + 1);
    if (id && number > 0) {
      const target = { href: `#${item.id}`, number: String(number) };
      targets.set(id, target);
      // Pages may already author a–z IDs while preview still delivers the numeric schema.
      const legacyNumber = Number(legacyId);
      if (!usesIds && legacyNumber >= 1 && legacyNumber <= 26) {
        targets.set(String.fromCharCode(96 + legacyNumber), target);
      }
    }
  });
  main.querySelectorAll('sup').forEach((sup) => {
    if (sup.closest('.disclosures')) return;
    const text = sup.dataset.disclosureIds || sup.textContent.trim();
    const ids = text.split(/\s*,\s*/);
    if (!ids.every((id) => targets.has(id))) return;

    const outerLink = sup.closest('a[href]');
    if (outerLink && (outerLink !== sup.parentElement || outerLink.children.length !== 1
      || outerLink.textContent.trim() !== sup.textContent.trim())) return;
    const authoredLinks = [...sup.querySelectorAll('a[href]'), ...(outerLink ? [outerLink] : [])];
    if (authoredLinks.some((link) => !/^#disclosure-[a-z0-9]+$/.test(link.getAttribute('href')))) return;

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
