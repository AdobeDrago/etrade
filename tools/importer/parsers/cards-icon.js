/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-icon. Base: cards.
 * Source: https://us.etrade.com/why-etrade ("Who we serve" section)
 * Grid of icon cards. Each card (.card-container.super-card-one) has an
 * icon-font element (<i class="card-icon et-icon ...">, no <img>), an H3
 * heading (header-small), a description (.text-default) and a "Learn more"
 * CTA link (.card-btn-group a).
 * Library convention: 2 columns, one row per card — [ icon | text content ].
 * decorate() treats the first cell as the icon (it detects <i>/[class*="icon"])
 * and the second cell as heading + description (+ CTA).
 */
export default function parse(element, { document }) {
  // Each card is a .super-card-one container.
  const cards = Array.from(
    element.querySelectorAll('.card-container.super-card-one, .super-card-one, .card-container'),
  );

  const cells = [];
  cards.forEach((card) => {
    // Column 1: the icon-font element (no <img> in these cards).
    const icon = card.querySelector('i.card-icon, i.et-icon, i[class*="et-icon"], i[class*="icon"]');
    // Column 2 contents: heading, description paragraph(s), CTA link(s).
    const heading = card.querySelector('.card-text-group h3, h3');
    const description = card.querySelector('.card-text-group .text-default, .text-default');
    const links = Array.from(card.querySelectorAll('.card-btn-group a, a.btn-link'));

    const bodyCell = [];
    if (heading) bodyCell.push(heading);
    if (description) bodyCell.push(description);
    bodyCell.push(...links);

    // Skip empty placeholder cards (no icon and no text content).
    if (icon || bodyCell.length) {
      // 2-column row: icon cell | body cell (pad icon cell with '' if absent).
      cells.push([icon || '', bodyCell]);
    }
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-icon', cells });
  element.replaceWith(block);
}
