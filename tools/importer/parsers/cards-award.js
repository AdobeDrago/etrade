/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-award. Base block: cards.
 * Source: https://us.etrade.com/home (section 8 awards & recognition).
 * Generated: 2026-09-20
 *
 * Award items each have a badge/icon, a title and a short description. The
 * cards-award decorate() detects an image-only cell and tags it as the image
 * column, otherwise treats the cell as the card body. Per the "Cards" library
 * convention this is a 2-column table:
 *   Row 1: block name
 *   Row 2+: [ badge image | title heading, description paragraph(s) ]
 *
 * Source specifics: the parser element is the full awards section. Each award
 * lives in a `.col-xs-12.col-sm-4` column: the badge is an `<i class="et-icon">`
 * (icon font, no <img>), followed by an <h2> title and description paragraphs.
 * Because there is no real image asset, we still emit a 2-column row but put the
 * icon element in the first cell so the structure matches the library; if a
 * genuine <img>/<picture> is present it is used instead.
 */
export default function parse(element, { document }) {
  // Each award item column. Prefer the specific award columns; fall back to any
  // column that contains a title heading.
  let items = [...element.querySelectorAll('.col-sm-4')]
    .filter((col) => col.querySelector('h2, h3'));

  if (!items.length) {
    items = [...element.querySelectorAll('.richTextEditor')]
      .filter((col) => col.querySelector('h2, h3'));
  }

  const cells = [];

  items.forEach((item) => {
    // Badge: a real image if present, else the icon font element.
    const image = item.querySelector('picture, img');
    const icon = item.querySelector('i.et-icon, [class*="et-icon"]');
    const badge = image || icon;

    // Title heading.
    const heading = item.querySelector('h2, h3');

    // Description paragraph(s) — everything textual after the heading.
    const paras = [...item.querySelectorAll('p')].filter((p) => p.textContent.trim().length > 0);

    // Skip empty items.
    if (!heading && !paras.length) return;

    const bodyCell = [];
    if (heading) bodyCell.push(heading);
    bodyCell.push(...paras);

    // 2-column row: [ badge | body ]. Pad the image cell if there is no badge.
    cells.push([badge ? [badge] : '', bodyCell]);
  });

  // Bail gracefully if no award items were found.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-award', cells });
  element.replaceWith(block);
}
