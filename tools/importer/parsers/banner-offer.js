/* eslint-disable */
/* global WebImporter */
/**
 * Parser for banner-offer. Base: banner (custom — inferred from source HTML + block decorate()).
 * Source: https://us.etrade.com/what-we-offer/our-accounts/brokerage-account
 * Dark rounded promo banner: heading (with strikethrough $1,000 and $1,500),
 * terms paragraph(s) incl. promo code OFFER26, primary "Open an account" button, "Learn how" text link.
 * decorate() expects a single column, one cell holding:
 *   [ heading, terms paragraph(s), CTA link(s) ]
 */
export default function parse(element, { document }) {
  // Heading with the strikethrough/current offer amounts.
  const heading = element.querySelector('h2.header-large, h2[class*="header"], h2');

  // Terms paragraph(s), including the one with promo code OFFER26.
  const paragraphs = Array.from(element.querySelectorAll('p.text-default, p'));

  // Primary CTA button + secondary "Learn how" text link.
  // Mutually exclusive: primary buttons vs. non-button links.
  const ctaLinks = Array.from(element.querySelectorAll('a.btn-primary, a.btn.btn-primary'));
  const textLinks = Array.from(element.querySelectorAll('a:not(.btn)'));

  const contentCell = [];
  if (heading) contentCell.push(heading);
  contentCell.push(...paragraphs);
  contentCell.push(...ctaLinks);
  contentCell.push(...textLinks);

  if (!heading && !contentCell.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Single column: one row, one cell holding all elements.
  const cells = [[contentCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'banner-offer', cells });
  element.replaceWith(block);
}
