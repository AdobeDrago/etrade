/**
 * cards-pricing — grid of pricing stat tiles. Each card shows a large figure
 * (e.g. "$0"), a label, and a "Learn more" link. No images.
 *
 * Expected authored structure (one row per card, single column):
 *   [ figure/heading, label paragraph(s), link ]
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      div.className = 'cards-pricing-body';
    });
    ul.append(li);
  });
  block.replaceChildren(ul);
}
