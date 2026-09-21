/* eslint-disable */
/* global WebImporter */
/**
 * Parser for hero-light. Base block: hero.
 * Source: https://us.etrade.com/what-we-offer/our-accounts (section 2, light intro hero).
 * Generated: 2026-09-20
 *
 * Block library structure (Hero — 1 column):
 *   Row 1: block name
 *   Row 2: single cell holding [ heading, intro paragraph(s), optional CTA link(s) ]
 *
 * hero-light decorate() adds the `no-image` variant and groups any paragraph
 * containing an <a> into an actions row, so the CTA must stay inside its own
 * <p>. This is a light intro hero with NO background image, so we emit only the
 * single content row.
 *
 * Source specifics: the content lives inside a `.richTextEditor span` with an
 * <h1 class="extra-extra-large-header"> heading, a `p.subhead` intro paragraph
 * and a trailing `p` that wraps the "See all pricing and rates" CTA link.
 */
export default function parse(element, { document }) {
  // Heading — the H1 intro title (fall back to any heading).
  const heading = element.querySelector('h1, h2, [class*="header"]');

  // Body paragraphs (intro copy + any CTA paragraphs), in source order.
  // Scoped to the rich-text span so we never pull stray page chrome.
  const paragraphs = [...element.querySelectorAll('p')];

  // Bail gracefully if there is no meaningful content.
  if (!heading && !paragraphs.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const contentCell = [];
  if (heading) contentCell.push(heading);
  contentCell.push(...paragraphs);

  const cells = [];
  cells.push([contentCell]); // 1-column hero: one row, one cell holding all content

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-light', cells });
  element.replaceWith(block);
}
