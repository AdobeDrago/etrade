/* eslint-disable */
/* global WebImporter */
/**
 * Parser for accordion-faq. Base block: accordion.
 * Generated: 2026-09-20
 *
 * SHARED parser — handles the FAQ markup on BOTH templates:
 *   1. home (https://us.etrade.com/home): a block-collection style accordion,
 *      `ul.accordion-group > li` with a `.accordion-trigger__text` question and
 *      an `.accordion-item-content` answer panel.
 *   2. what-we-offer-2 (https://us.etrade.com/what-we-offer/our-accounts): an
 *      E*TRADE `.faqSection` / `.faqs` with `.panel.panel-default` items. Each
 *      item's question is a `.panel-heading` `[role="button"]` (inside
 *      `h4.panel-title > span.accordion-toggle`) and the answer is the
 *      following `.panel-body`.
 *
 * Block library structure (Accordion — 2 columns, one row per item):
 *   Row 1: block name
 *   Row 2+: [ question title | rich-text answer ]
 *
 * accordion-faq decorate() reads row.children[0] as the summary label and
 * row.children[1] as the body, so every item MUST be a 2-cell row. We drop the
 * runtime "Expand all" button (the block regenerates its own toggle).
 */
export default function parse(element, { document }) {
  const cells = [];

  // --- Structure 1: block-collection accordion (home template) ---------------
  const accordionItems = [...element.querySelectorAll('ul.accordion-group > li, .accordion-item-wrapper')];

  // --- Structure 2: E*TRADE .faqSection panels (this page) --------------------
  const panelItems = [...element.querySelectorAll('.panel.panel-default')];

  // Prefer whichever structure is actually present.
  const items = accordionItems.length ? accordionItems : panelItems;

  items.forEach((item) => {
    let question;
    let answer;

    if (item.matches('.panel.panel-default')) {
      // E*TRADE .faqSection panel: question in .panel-heading role=button,
      // answer in the sibling .panel-body.
      const questionEl = item.querySelector('.accordion-toggle, [role="button"]')
        || item.querySelector('.panel-title, .panel-heading');
      if (questionEl) {
        question = document.createElement('p');
        question.textContent = questionEl.textContent.trim();
      }
      // Body content: unwrap the boilerplate .container/.row wrappers so the
      // answer cell holds the real rich text (paragraphs, lists, links).
      const body = item.querySelector('.panel-body');
      if (body) {
        answer = body.querySelector('.panel-body .row .row, .row') || body;
      }
    } else {
      // block-collection accordion item.
      const questionEl = item.querySelector('.accordion-trigger__text')
        || item.querySelector('h4, h3');
      if (questionEl) {
        question = document.createElement('p');
        question.textContent = questionEl.textContent.trim();
      }
      answer = item.querySelector('.accordion-item-content');
    }

    // Skip items missing either half.
    if (!question || !answer) return;

    cells.push([question, answer]);
  });

  // Bail gracefully if no FAQ items were found.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
