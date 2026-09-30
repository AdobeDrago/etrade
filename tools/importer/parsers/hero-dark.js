/* eslint-disable */
/* global WebImporter */
/**
 * Parser for hero-dark. Base block: hero.
 * Source: https://us.etrade.com/home (dark IPO hero, section 1).
 * Generated: 2026-09-20
 *
 * Block library structure (Hero — 1 column, up to 3 rows):
 *   Row 1: block name
 *   Row 2: background image (optional)
 *   Row 3: single cell containing Title (heading), Subheading (text), CTA link(s)
 *
 * Source specifics: an <h1> headline, a <p class="hero-copy"> supporting line,
 * a full-bleed <img class="hero-media"> background, and one or more CTA anchors
 * (primary button + "Learn more" link).
 */
export default function parse(element, { document }) {
  // Title — top headline of the hero.
  const heading = element.querySelector('h1, h2, [class*="header-3xl"], [class*="header-2xl"]');

  // Background image (optional) — full-bleed media behind the content.
  const bgImage = element.querySelector('img.hero-media, img[class*="hero-media"], img[class*="background"], picture img, img');

  // Subheading — supporting copy paragraph that does NOT itself contain a link.
  const description = [...element.querySelectorAll('p.hero-copy, p[class*="hero-copy"], p')]
    .find((p) => !p.querySelector('a'));

  // CTA link(s) — every anchor in the hero (primary button + secondary link).
  const ctaLinks = [...element.querySelectorAll('a[href]')];

  // Bail gracefully if there is no meaningful content.
  if (!heading && !description && !ctaLinks.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [];

  // Row 2: background image (only if present).
  if (bgImage) cells.push([bgImage]);

  // Row 3: single cell holding title + subheading + CTAs.
  const contentCell = [];
  if (heading) contentCell.push(heading);
  if (description) contentCell.push(description);
  contentCell.push(...ctaLinks);
  cells.push([contentCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-dark', cells });
  element.replaceWith(block);
}
