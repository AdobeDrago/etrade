/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-product. Base block: cards (no-images variant).
 * Source: https://us.etrade.com/home (section 5 product tiles, e.g. Premium
 * Savings Account, Certificates of Deposit, and the limited-time offer card).
 * Generated: 2026-09-20
 *
 * These tiles have NO images, so per the block library "Cards (no images)"
 * convention this is a 1-column table: one row per card, the single cell
 * holding the card's content.
 *   Row 1: block name
 *   Row 2+: [ heading, rate (h4), description paragraph(s), CTA link ]
 *
 * Block decorate() (cards-product.js) wraps each row's children in an <li>.
 *
 * The instance selector matches each `.card-container.super-card-one` tile
 * individually, so `element` is normally a single card; we also handle a
 * wrapper element that contains several tiles.
 */
export default function parse(element, { document }) {
  // Normalise to a list of card containers.
  const nested = [...element.querySelectorAll('.card-container.super-card-one')];
  const cards = nested.length ? nested
    : (element.matches && element.matches('.card-container.super-card-one')) ? [element]
    : [element];

  const cells = [];

  cards.forEach((card) => {
    const cardCell = [];

    // Product heading (e.g. "Premium Savings Account").
    const heading = card.querySelector('.card-text-group h3, h3');
    if (heading) cardCell.push(heading);

    // Rate / APY subheading (e.g. "4.00% Annual Percentage Yield").
    const rate = card.querySelector('.card-text-group h4, h4');
    if (rate) cardCell.push(rate);

    // Description paragraph(s) below the rate.
    const descWrap = card.querySelector('.card-text-group .text-default, .text-default');
    if (descWrap) {
      const paras = [...descWrap.querySelectorAll(':scope > p')];
      if (paras.length) cardCell.push(...paras);
      else cardCell.push(descWrap);
    }

    // CTA link ("Learn more" / "Learn how").
    const cta = card.querySelector('.card-btn-group a[href], a.btn[href], a[href]');
    if (cta) cardCell.push(cta);

    if (cardCell.length) cells.push([cardCell]);
  });

  // Bail gracefully if no cards were extracted.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-product', cells });
  element.replaceWith(block);
}
