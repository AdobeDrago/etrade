/**
 * cards-product — highlighted product tiles (e.g. Premium Savings Account,
 * Certificates of Deposit). Each card has a heading, a rate/figure, a
 * description, and a CTA. No images.
 *
 * Expected authored structure (one row per card, single column):
 *   [ heading, rate, description paragraph(s), CTA link ]
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      div.className = 'cards-product-body';
    });
    ul.append(li);
  });
  block.replaceChildren(ul);
}
