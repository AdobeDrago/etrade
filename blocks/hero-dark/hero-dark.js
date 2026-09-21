/**
 * hero-dark — full-bleed hero with a dark background image, heading, supporting
 * copy and call-to-action links. Variant of the base `hero` block.
 *
 * Expected authored structure (1 row, 1 column):
 *   [ background image, H1, paragraph(s), CTA link(s) ]
 */
export default function decorate(block) {
  // Background image lives in the first cell; if absent, fall back to a solid
  // dark background so text stays readable.
  if (!block.querySelector(':scope picture')) {
    block.classList.add('no-image');
  }

  // Group the CTA links into a single actions row so they lay out side by side.
  const paragraphs = [...block.querySelectorAll(':scope p')];
  const ctaParagraphs = paragraphs.filter((p) => p.querySelector('a'));
  if (ctaParagraphs.length) {
    const actions = document.createElement('div');
    actions.className = 'hero-dark-actions';
    ctaParagraphs[0].before(actions);
    ctaParagraphs.forEach((p) => actions.append(p));
  }
}
