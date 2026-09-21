/*
 * accordion-faq — FAQ accordion with expandable question/answer items and an
 * "Expand all" toggle. Variant of the block-collection accordion.
 *
 * Expected authored structure (one row per item, two columns):
 *   [ question title | rich-text answer ]
 */
export default function decorate(block) {
  const items = [];
  [...block.children].forEach((row) => {
    // decorate accordion item label
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-faq-item-label';
    summary.append(...label.childNodes);
    // decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-faq-item-body';
    // decorate accordion item
    const details = document.createElement('details');
    details.className = 'accordion-faq-item';
    details.append(summary, body);
    row.replaceWith(details);
    items.push(details);
  });

  // "Expand all" toggle controlling every item.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'accordion-faq-expand-all';
  toggle.textContent = 'Expand all';
  toggle.addEventListener('click', () => {
    const shouldOpen = items.some((d) => !d.open);
    items.forEach((d) => { d.open = shouldOpen; });
    toggle.textContent = shouldOpen ? 'Collapse all' : 'Expand all';
  });
  block.prepend(toggle);
}
