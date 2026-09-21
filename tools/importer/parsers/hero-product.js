/* eslint-disable */
/* global WebImporter */
/**
 * Parser for hero-product. Base: hero.
 * Source: https://us.etrade.com/what-we-offer/our-accounts/brokerage-account
 * Dark hero: eyebrow + centered heading + supporting copy + primary CTA + foreground product screenshot.
 * decorate() expects 1 column, one cell holding:
 *   [ eyebrow/heading, paragraph(s), CTA link(s), product image ]
 */
export default function parse(element, { document }) {
  // Eyebrow + heading (validated against source: h1.eyebrow, h2.header-3xl).
  const eyebrow = element.querySelector('h1.eyebrow, .eyebrow');
  const heading = element.querySelector('h2.header-3xl, h2[class*="header"], h2, h1:not(.eyebrow)');

  // Supporting copy — the hero paragraph carries the text-default class in source.
  const paragraph = element.querySelector('p.text-default');

  // Primary CTA (the offer overlay uses no primary button, so this is unique to the hero).
  const ctaLinks = Array.from(element.querySelectorAll('a.btn-primary, a.btn.btn-primary'));

  // Foreground product screenshot (iPhone/app visual).
  const image = element.querySelector('img.rounded-corner-image, img.responsive-imageET, img');

  const contentCell = [];
  if (eyebrow) contentCell.push(eyebrow);
  if (heading) contentCell.push(heading);
  if (paragraph) contentCell.push(paragraph);
  contentCell.push(...ctaLinks);
  if (image) contentCell.push(image);

  if (!heading && !contentCell.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // hero-product is 1 column: one row, one cell holding every element (image included so it is preserved).
  const cells = [[contentCell]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-product', cells });
  element.replaceWith(block);
}
