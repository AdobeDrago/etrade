/** Keep decorative transitions separate from EDS content section grouping. */
export default function decorateSectionBoundaries(main) {
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
