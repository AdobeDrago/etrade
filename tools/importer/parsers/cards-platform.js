/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-platform. Base: cards.
 * Source: https://us.etrade.com/platforms (what-we-offer template)
 * Generated: 2026-09-20
 *
 * Block library convention (cards): 2 columns, one row per card:
 *   [ image | heading, description paragraph(s), CTA link ]
 * The first row is the block name only.
 *
 * Source specifics: cards live inside a `.card-group`; each card is an
 * `<a class="card ...">` (the whole card is the link). Inside each card:
 *   - a product screenshot `<img>` on top
 *   - a `.card-body` with an `<h3>` heading and a short description `<p>`
 *   - a `.card-footer` with a "Learn more" `<button>` (rebuilt here as a real
 *     link using the card's own href so the block's clickable-card CTA works).
 * The intro heading + subhead above the grid is section default content and is
 * preserved before the block rather than dropped.
 */
export default function parse(element, { document }) {
  // Cards: the anchor itself carries the `card` class inside `.card-group`.
  const cards = Array.from(element.querySelectorAll('.card-group .card, .card-group a.card'))
    // De-duplicate in case fallback selectors overlap on the same element.
    .filter((el, i, arr) => arr.indexOf(el) === i);

  const cells = [];

  cards.forEach((card) => {
    // Image (top of card).
    const img = card.querySelector('img');

    // Heading.
    const heading = card.querySelector('.card-body h1, .card-body h2, .card-body h3, .card-body h4')
      || card.querySelector('h1, h2, h3, h4');

    // Description paragraph(s) — skip empty/&nbsp; spacers.
    const descriptions = Array.from(card.querySelectorAll('.card-body p'))
      .filter((p) => p.textContent.replace(/ /g, ' ').trim().length > 0);

    // Card href: the card itself is an anchor, otherwise a nested anchor.
    const href = card.matches('a[href]')
      ? card.getAttribute('href')
      : (card.querySelector('a[href]') && card.querySelector('a[href]').getAttribute('href'));

    // CTA: rebuild the "Learn more" button/link as a real link using the card href.
    let ctaLink = null;
    const ctaEl = card.querySelector('.card-footer a[href]')
      || card.querySelector('.card-footer button, .card-footer a')
      || card.querySelector('button');
    if (href) {
      ctaLink = document.createElement('a');
      ctaLink.href = href;
      ctaLink.textContent = (ctaEl && ctaEl.textContent.trim()) || 'Learn more';
    } else if (ctaEl && ctaEl.matches('a[href]')) {
      ctaLink = ctaEl;
    }

    // Build the text cell (heading, descriptions, CTA) in reading order.
    const bodyCell = [];
    if (heading) bodyCell.push(heading);
    descriptions.forEach((p) => bodyCell.push(p));
    if (ctaLink) bodyCell.push(ctaLink);

    // Skip cards with no usable content.
    if (!img && bodyCell.length === 0) return;

    // 2-column row: [ image | text content ].
    cells.push([img || '', bodyCell]);
  });

  // Empty-block guard: no cards found — leave content in place.
  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Preserve the intro heading + subhead (section default content) before the block.
  const introNodes = [];
  const introHeading = element.querySelector('.richTextEditor h1, .richTextEditor h2, .extra-large-header');
  const introSubhead = element.querySelector('.richTextEditor p.subhead, .richTextEditor .subhead, .richTextEditor p');
  if (introHeading) introNodes.push(introHeading);
  if (introSubhead && introSubhead !== introHeading) introNodes.push(introSubhead);

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-platform', cells });
  element.replaceWith(...introNodes, block);
}
