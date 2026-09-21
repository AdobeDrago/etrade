/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-feature. Base block: columns.
 * Source: https://us.etrade.com/home (sections 4 and 6 — dark product features).
 * Generated: 2026-09-20
 *
 * Block library structure (Columns — multiple columns, one content row):
 *   Row 1: block name
 *   Row 2+: one cell per visual column
 *
 * This variant is a 2-column feature: a product image beside a text column
 * (eyebrow + heading + paragraph + CTA links). The block's decorate() reads
 * block.firstElementChild.children as the columns and detects the image column
 * automatically, so column order (image-left vs image-right) is preserved
 * exactly as authored — we emit image then text (section 4 layout); the
 * image-right option on section 6 is handled at the section/transformer level.
 */
export default function parse(element, { document }) {
  // Image column — the product image (may be wrapped in <picture>).
  const image = element.querySelector('picture, img.responsive-imageET, img[class*="responsive-image"], img');

  // Text column pieces.
  const eyebrow = element.querySelector('p.eyebrow, [class*="eyebrow"]');
  const heading = element.querySelector('h1, h2, h3, [class*="header-2xl"], [class*="header-xl"]');

  // Body paragraphs that are NOT CTA links and NOT the eyebrow.
  const bodyParas = [...element.querySelectorAll('p')].filter((p) => {
    if (p === eyebrow) return false;
    if (p.querySelector('a')) return false;
    return p.textContent.trim().length > 0;
  });

  // CTA links (primary button + "Learn more" secondary link).
  const ctaLinks = [...element.querySelectorAll('a[href]')];

  // Bail gracefully if the text column has no meaningful content.
  if (!heading && !bodyParas.length && !ctaLinks.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Build the text column cell contents.
  const textCell = [];
  if (eyebrow) textCell.push(eyebrow);
  if (heading) textCell.push(heading);
  textCell.push(...bodyParas);
  textCell.push(...ctaLinks);

  // Build the image column cell.
  const imageCell = image ? [image] : [''];

  // One content row, two columns: [ image | text ].
  const cells = [[imageCell, textCell]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-feature', cells });
  element.replaceWith(block);
}
