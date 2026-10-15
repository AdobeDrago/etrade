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
      if (onlyMedia) {
        const paragraph = picture.closest('p');
        if (paragraph && !paragraph.textContent.trim() && paragraph.children.length === 1) {
          paragraph.replaceWith(picture);
        }
      }
      if (!onlyMedia) {
        let kind = block.classList.contains('outline') ? 'outline' : 'primary';
        if (block.classList.contains('award')) kind = 'secondary';
        groupActions(cell, 'columns-feature', kind);
      }
    });
  });
  if (block.classList.contains('award')) {
    const copy = block.querySelector('.columns-feature-copy');
    const title = copy?.querySelector('h2');
    if (title) {
      const heading = document.createElement('div');
      heading.className = 'columns-feature-award-heading';
      const eyebrow = copy.querySelector('h3');
      if (eyebrow) heading.append(eyebrow);
      heading.append(title);
      block.prepend(heading);
    }
    const actions = copy?.querySelector('.columns-feature-actions');
    if (actions) block.append(actions);
  }
}
