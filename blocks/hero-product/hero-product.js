/**
 * hero-product — dark hero with an eyebrow, centered heading, supporting copy, a
 * primary CTA, and a foreground product screenshot (e.g. a phone/app shot).
 * Variant of the base `hero`.
 *
 * Expected authored structure (1 column):
 *   [ eyebrow/heading, paragraph(s), CTA link(s), product image ]
 * The image is a foreground element (not a full-bleed background).
 */
export default function decorate(block) {
  // Separate the foreground product image into its own wrapper.
  const picture = block.querySelector('picture');
  if (picture) {
    const media = document.createElement('div');
    media.className = 'hero-product-media';
    const wrapper = picture.closest('div') || picture;
    media.append(picture);
    block.append(media);
    if (wrapper !== picture && !wrapper.children.length) wrapper.remove();
  } else {
    block.classList.add('no-image');
  }

  // Group CTA links into an actions row.
  const ctaParagraphs = [...block.querySelectorAll(':scope p')].filter((p) => p.querySelector('a'));
  if (ctaParagraphs.length) {
    const actions = document.createElement('div');
    actions.className = 'hero-product-actions';
    ctaParagraphs[0].before(actions);
    ctaParagraphs.forEach((p) => actions.append(p));
  }
}
