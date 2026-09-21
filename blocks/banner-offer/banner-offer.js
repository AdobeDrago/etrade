/**
 * banner-offer — dark rounded promotional banner card: a heading, a terms
 * paragraph (often with a promo code), a primary CTA button, and a secondary
 * text link.
 *
 * Expected authored structure (single cell/column):
 *   [ heading, terms paragraph(s) incl. promo code, CTA link(s) ]
 */
export default function decorate(block) {
  // Flatten to a single content wrapper.
  const content = document.createElement('div');
  content.className = 'banner-offer-content';
  [...block.children].forEach((row) => {
    while (row.firstElementChild) content.append(row.firstElementChild);
  });

  // Group CTA links into an actions row.
  const ctaParagraphs = [...content.querySelectorAll(':scope > p')].filter((p) => p.querySelector('a'));
  if (ctaParagraphs.length) {
    const actions = document.createElement('div');
    actions.className = 'banner-offer-actions';
    ctaParagraphs[0].before(actions);
    ctaParagraphs.forEach((p) => actions.append(p));
  }

  block.replaceChildren(content);
}
