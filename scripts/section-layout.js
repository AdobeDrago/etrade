import { buildBlock } from './aem.js';

/** Keep decorative transitions separate from EDS content section grouping. */
export default function decorateSectionBoundaries(main) {
  const first = main.querySelector(':scope > .section');
  const transitions = first?.querySelector('.hero-dark.split, .hero-product')
    ? [{ previous: first, firstColor: 'dark', bend: '35%' }] : [];
  if (document.body.classList.contains('why-etrade')) {
    main.querySelectorAll(':scope > .section.dark:has(.cards-icon)').forEach((previous) => {
      transitions.push({ previous, firstColor: '#1c1a1e', bend: '50%' });
    });
  }
  const outlines = new Map([
    ['planning', '.cards-icon.planning, .cards-article'],
    ['brokerage', '.cards-article'],
    ['homepage', '.widget-calculator, .cards-award'],
  ]).get([...document.body.classList].find((name) => ['planning', 'brokerage', 'homepage'].includes(name)));
  if (outlines) {
    main.querySelectorAll(':scope > .section').forEach((previous) => {
      if (previous.querySelector(outlines)) {
        transitions.push({
          previous, firstColor: 'light', bend: document.body.classList.contains('planning') ? '65%' : '50%',
        });
      }
    });
  }
  if (document.body.classList.contains('homepage')) {
    main.querySelectorAll(':scope > .section:has(.columns-feature.band)').forEach((previous) => {
      transitions.push({ previous, firstColor: '#1c1a1e', bend: '75%' });
    });
  }
  transitions.forEach(({ previous, firstColor, bend }) => {
    const next = previous.nextElementSibling;
    if (!document.body.classList.contains('etrade-page') || !next
      || next.querySelector('.separator')) return;
    const section = document.createElement('div');
    section.className = 'section separator-container';
    section.dataset.sectionStatus = 'initialized';
    section.style.display = 'none';
    const wrapper = document.createElement('div');
    wrapper.append(buildBlock('separator', [
      ['First section color', firstColor], ['Second section color', 'light'],
      ['Line break location', bend], ['Height', '81px'], ['Mobile height', '45px'],
    ]));
    section.append(wrapper);
    previous.after(section);
  });
  const sections = [...main.querySelectorAll(':scope > .section')].filter((section) => {
    // Backend metadata can leave an empty trailing section with no authored style.
    if (!section.children.length && !section.textContent.trim() && section.classList.length === 1
      && !section.hasAttribute('data-section-layout') && !section.id) {
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
