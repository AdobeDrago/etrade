import { groupActions } from '../../scripts/actions.js';

export default function decorate(block) {
  const section = block.closest('.section');
  // Explicit block options override section metadata. A neutral section uses light.
  if (!block.classList.contains('light') && !block.classList.contains('dark')) {
    block.classList.add(section?.classList.contains('dark') ? 'dark' : 'light');
  }
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      const picture = cell.querySelector('picture, img');
      const onlyMedia = picture && !cell.querySelector('h1, h2, h3, h4, h5, h6, a[href]');
      cell.classList.add(onlyMedia ? 'columns-feature-media' : 'columns-feature-copy');
      if (!onlyMedia) groupActions(cell, 'columns-feature', block.classList.contains('outline') ? 'outline' : 'primary');
    });
  });
}
