/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-pricing. Base block: cards (no-images variant).
 * Source: https://us.etrade.com/home (section 5 pricing stat tiles).
 * Generated: 2026-09-20
 *
 * These tiles have NO images, so per the block library "Cards (no images)"
 * convention this is a 1-column table: one row per card, the single cell
 * holding the card's content.
 *   Row 1: block name
 *   Row 2+: [ figure/stat, heading label, description, "Learn more" link ]
 *
 * Block decorate() (cards-pricing.js) wraps each row's children in an <li>, so
 * every element pushed into the card's cell becomes part of that card.
 *
 * The instance selector matches each `.card-container.pricing-card` tile
 * individually, so `element` is normally a single card; we also handle a
 * wrapper element that contains several tiles.
 */
export default function parse(element, { document }) {
  // Normalise to a list of card containers.
  const nested = [...element.querySelectorAll('.card-container.pricing-card')];
  const cards = nested.length ? nested
    : (element.matches && element.matches('.card-container.pricing-card')) ? [element]
    : [element];

  const cells = [];

  cards.forEach((card) => {
    const cardCell = [];

    // Large figure / stat (e.g. "$0", "0.50%").
    const figure = card.querySelector('.numeric-stats-lg, p[class*="numeric"]');
    if (figure) cardCell.push(figure);

    // Label heading (e.g. "Commission trades").
    const heading = card.querySelector('.card-text-group h3, .card-text-group h2, h3, h2');
    if (heading) cardCell.push(heading);

    // Description text below the heading.
    const description = card.querySelector('.card-text-group .text-default, .text-default');
    if (description && description !== heading) cardCell.push(description);

    // CTA link ("Learn more").
    const cta = card.querySelector('.card-btn-group a[href], a.btn[href], a[href]');
    if (cta) cardCell.push(cta);

    if (cardCell.length) cells.push([cardCell]);
  });

  // Bail gracefully if no cards were extracted.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-pricing', cells });
  element.replaceWith(block);
}
