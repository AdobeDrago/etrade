/** Keep decorative transitions separate from EDS content section grouping. */
export function decorateSectionBoundaries(main) {
  const sections = [...main.querySelectorAll(':scope > .section')].filter((section) => {
    // Backend metadata can leave an empty trailing section with no authored style.
    if (!section.children.length && !section.textContent.trim() && section.classList.length === 1) {
      section.remove();
      return false;
    }
    return true;
  });
  sections.forEach((section, index) => {
    const blocks = [...section.querySelectorAll('.separator, .floating-dock')];
    const dedicated = blocks.length === 1 && section.children.length === 1
      && section.firstElementChild.children.length === 1;
    if (!dedicated) return;
    const kind = blocks[0].classList.contains('separator') ? 'separator' : 'overlay';
    section.dataset.sectionKind = kind;
    if (kind !== 'separator') return;
    if (sections[index - 1]) sections[index - 1].dataset.separatorAfter = 'true';
    if (sections[index + 1]) sections[index + 1].dataset.separatorBefore = 'true';
  });
}

/** Link only references backed by an authored disclosure item. */
export function linkDisclosureReferences(main) {
  main.querySelectorAll('sup').forEach((sup) => {
    const outerLink = sup.closest('a[href]');
    if (outerLink) {
      // DA may serialize a linked superscript as <a><sup>…</sup></a>.
      // Move that existing link inside the marker; never create nested anchors.
      if (outerLink === sup.parentElement && outerLink.children.length === 1
        && outerLink.textContent.trim() === sup.textContent.trim()) {
        outerLink.replaceWith(sup);
        outerLink.replaceChildren(...sup.childNodes);
        sup.append(outerLink);
      }
      if (/^#disclosure-\d+$/.test(outerLink.getAttribute('href'))) {
        outerLink.setAttribute('aria-label', `Disclosure ${sup.textContent.trim()}`);
      }
      return;
    }
    if (sup.querySelector('a') || !/^\s*\d+(?:\s*,\s*\d+)*\s*$/.test(sup.textContent)) return;
    const parts = sup.textContent.trim().split(/\s*,\s*/);
    if (!parts.every((number) => document.getElementById(`disclosure-${number}`))) return;
    sup.replaceChildren();
    parts.forEach((number, index) => {
      if (index) sup.append(',');
      const link = document.createElement('a');
      link.href = `#disclosure-${number}`;
      link.textContent = number;
      link.setAttribute('aria-label', `Disclosure ${number}`);
      sup.append(link);
    });
  });
}
