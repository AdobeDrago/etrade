/**
 * cards-platform — grid of platform cards, each with a product screenshot image
 * on top, a heading, a short description, and a "Learn more" CTA. The whole card
 * is clickable.
 *
 * Expected authored structure (one row per card):
 *   [ image | heading, description paragraph(s), CTA link ]
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-platform-image';
      else div.className = 'cards-platform-body';
    });

    // If the card body ends in a CTA link, make the whole card clickable.
    const link = li.querySelector('.cards-platform-body a[href]');
    if (link) li.dataset.href = link.href;

    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));

  ul.querySelectorAll('li[data-href]').forEach((li) => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.location.href = li.dataset.href;
    });
  });

  block.replaceChildren(ul);
}
