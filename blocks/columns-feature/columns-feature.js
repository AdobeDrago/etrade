/**
 * columns-feature — two-column product feature: a product image beside an
 * eyebrow/heading/paragraph and CTA links, on a dark background.
 *
 * Expected authored structure (1 row, 2 columns):
 *   [ image | heading, paragraph(s), link(s) ]   (image left, default)
 * The `image-right` option flips the image to the trailing column.
 */
export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-feature-${cols.length}-cols`);

  // Tag image columns so CSS can size them.
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-feature-img-col');
        }
      }

      // Group CTA links into an actions row.
      const ctaParagraphs = [...col.querySelectorAll(':scope > p')].filter((p) => p.querySelector('a'));
      if (ctaParagraphs.length) {
        const actions = document.createElement('div');
        actions.className = 'columns-feature-actions';
        ctaParagraphs[0].before(actions);
        ctaParagraphs.forEach((p) => actions.append(p));
      }
    });
  });
}
