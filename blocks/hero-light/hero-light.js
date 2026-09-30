/**
 * hero-light — light, left-aligned intro hero: a heading, an intro paragraph,
 * and an optional text CTA. No background image. Variant of the base `hero`.
 *
 * Expected authored structure (1 column):
 *   [ H1 heading, paragraph(s), optional link(s) ]
 */
export default function decorate(block) {
  block.classList.add('no-image');

  // Group any CTA links into an actions row.
  const ctaParagraphs = [...block.querySelectorAll(':scope p')].filter((p) => p.querySelector('a'));
  if (ctaParagraphs.length) {
    const actions = document.createElement('div');
    actions.className = 'hero-light-actions';
    ctaParagraphs[0].before(actions);
    ctaParagraphs.forEach((p) => actions.append(p));
  }
}
