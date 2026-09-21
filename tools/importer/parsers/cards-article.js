/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-article. Base: cards.
 * Source: https://us.etrade.com/what-we-offer/our-accounts/brokerage-account
 * Grid of editorial article cards. Each card: top image + H3 heading + short
 * description + "Read more" link. Source cards use .card-img / .super-card-two.
 * decorate() expects one row per card, 2 columns:
 *   [ image | heading, description paragraph(s), link ]
 */
export default function parse(element, { document }) {
  // Each card is a .super-card-two container (fallback to any .card-container).
  const cards = Array.from(element.querySelectorAll('.card-container.super-card-two, .super-card-two, .card-container'));

  const cells = [];
  cards.forEach((card) => {
    // Column 1: the top image.
    const image = card.querySelector('img.card-img, img');
    // Column 2: heading + description + "Read more" link.
    const heading = card.querySelector('.card-text-group h3, h3');
    const description = card.querySelector('.card-text-group .text-default, .text-default');
    const link = card.querySelector('.card-btn-group a, a.btn-link, a');

    const bodyCell = [];
    if (heading) bodyCell.push(heading);
    if (description) bodyCell.push(description);
    if (link) bodyCell.push(link);

    if (image || bodyCell.length) {
      // 2-column row: image cell | body cell (pad image cell with '' if absent).
      cells.push([image || '', bodyCell]);
    }
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-article', cells });
  element.replaceWith(block);
}
