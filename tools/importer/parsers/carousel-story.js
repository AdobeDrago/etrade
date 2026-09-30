/* eslint-disable */
/* global WebImporter */
/**
 * Parser for carousel-story. Base: carousel.
 * Source: https://us.etrade.com/why-etrade ("Our story" timeline carousel)
 * A card carousel (.card-carousel / .cardCarousel with .card-carousel_glide).
 * Each slide is a .card-container.super-card-two holding: top image (card-img),
 * an eyebrow year (p.eyebrow-small), an H3 heading (header-small) and a
 * description (.text-default). No CTA links are present in the source cards.
 * Library convention: 2 columns, one row per slide — [ image | text content ].
 * carousel-story decorate() flattens each row into one slide, so the eyebrow,
 * heading and description are grouped in the second (text) cell.
 */
export default function parse(element, { document }) {
  // Each slide lives in a .glide__slide li; the card body is .card-container.
  const cards = Array.from(
    element.querySelectorAll('.glide__slides > li .card-container, .glide__slide .card-container'),
  );

  const cells = [];
  cards.forEach((card) => {
    // Column 1: the slide image.
    const image = card.querySelector('img.card-img, img');
    // Column 2 contents: eyebrow (year), heading, description paragraph(s), link(s).
    const eyebrow = card.querySelector(':scope > .eyebrow-small, .eyebrow-small');
    const heading = card.querySelector('.card-text-group h3, h3');
    const description = card.querySelector('.card-text-group .text-default, .text-default');
    const links = Array.from(card.querySelectorAll('.card-btn-group a, a.btn-link'));

    const textCell = [];
    if (eyebrow) textCell.push(eyebrow);
    if (heading) textCell.push(heading);
    if (description) textCell.push(description);
    textCell.push(...links);

    // Skip empty placeholder slides (no image and no text content).
    if (image || textCell.length) {
      // 2-column row: image cell | text-content cell (pad image with '' if absent).
      cells.push([image || '', textCell]);
    }
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-story', cells });
  element.replaceWith(block);
}
