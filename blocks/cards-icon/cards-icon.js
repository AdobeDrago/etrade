/**
 * cards-icon — grid of cards, each with an icon, a heading, and a short
 * description. Icons may be an <img>/<picture> or an icon-font element.
 *
 * Expected authored structure (one row per card):
 *   [ icon | heading, description paragraph(s) ]
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.querySelector('picture, img') && div.children.length === 1) div.className = 'cards-icon-icon';
      else if (div.querySelector('i, svg, [class*="icon"]') && !div.querySelector('h1,h2,h3,h4,h5,h6,p')) div.className = 'cards-icon-icon';
      else div.className = 'cards-icon-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }])));
  block.replaceChildren(ul);
}
