import { buildBlock } from './aem.js';

/** Keep decorative transitions separate from EDS content section grouping. */
export default function decorateSectionBoundaries(main) {
  const first = main.querySelector(':scope > .section');
  const transitions = first?.querySelector('.hero-dark.split') ? [first] : [];
  if (document.body.classList.contains('why-etrade')) {
    transitions.push(...main.querySelectorAll(':scope > .section.dark:has(.cards-icon)'));
  }
  transitions.forEach((previous) => {
    const next = previous.nextElementSibling;
    if (!document.body.classList.contains('etrade-page') || !next
      || next.querySelector('.separator')) return;
    const section = document.createElement('div');
    section.className = 'section separator-container';
    const wrapper = document.createElement('div');
    wrapper.append(buildBlock('separator', [
      ['First section color', 'dark'], ['Second section color', 'light'],
      ['Line break location', '35%'], ['Height', '81px'], ['Mobile height', '45px'],
    ]));
    section.append(wrapper);
    previous.after(section);
  });
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
