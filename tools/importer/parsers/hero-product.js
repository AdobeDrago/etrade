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

  const cells = [];
  if (eyebrow) cells.push(['Eyebrow', eyebrow]);
  if (heading) cells.push(['Heading', heading]);
  const content = [];
  if (paragraph) content.push(paragraph);
  ctaLinks.forEach((link) => {
    const p = document.createElement('p');
    p.append(link);
    content.push(p);
  });
  if (content.length) cells.push(['Content', content]);
  if (image) cells.push(['Image', image]);
  const offerHeading = element.querySelector('h2.subhead-medium, h2.subhead-large, h3.subhead-large');
  if (offerHeading) {
    const offer = [offerHeading];
    const area = offerHeading.closest('.row-flex, .row') || offerHeading.parentElement.parentElement;
    const terms = [...area.querySelectorAll('p')];
    offer.push(...terms);
    [...area.querySelectorAll('a')].filter((link) => !terms.some((p) => p.contains(link))).forEach((link) => {
      const p = document.createElement('p');
      p.append(link);
      offer.push(p);
    });
    cells.push(['Offer', offer]);
  }
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }
  element.replaceWith(WebImporter.Blocks.createBlock(document, { name: 'hero-product', cells }));
}
