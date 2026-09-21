/* eslint-disable */
/* global WebImporter */
/**
 * Parser for tabs-accounts. Base block: tabs.
 * Source: https://us.etrade.com/what-we-offer/our-accounts (section, tabbed account selector).
 * Generated: 2026-09-20
 *
 * Block library structure (Tabs — 2 columns, one row per tab):
 *   Row 1: block name
 *   Row 2+: [ tab label | tab content ]
 *
 * tabs-accounts decorate() takes each row's first cell as the tab label and the
 * rest of the row as the panel content, so every item MUST be a 2-cell row.
 *
 * Source specifics: the desktop tablist is `ul.tabs[role="tablist"]` (there is
 * also a `ul.dropdown-menu.mobiletabs` clone we ignore). Each `a[role="tab"]`
 * has `data-target="#dttab_N"` pointing at a `div[role="tabpanel"].tab-pane`
 * with `id="dttab_N"`. Each panel holds a heading + intro paragraph and a
 * `.card-group` grid of account cards (accent bar + `h3` name + description +
 * "Learn more" / "Open an account" CTA links).
 */
export default function parse(element, { document }) {
  // Desktop tablist only — skip the mobile dropdown clone.
  const tablists = [...element.querySelectorAll('ul.tabs[role="tablist"], [role="tablist"]')]
    .filter((ul) => !ul.classList.contains('mobiletabs') && !ul.classList.contains('dropdown-menu'));
  const tablist = tablists[0];

  const cells = [];

  const tabs = tablist
    ? [...tablist.querySelectorAll(':scope > li > a[role="tab"], :scope > li a[role="tab"]')]
    : [];

  tabs.forEach((tab) => {
    // Tab label — the <span> text inside the anchor.
    const labelText = (tab.querySelector('span') || tab).textContent.trim();
    if (!labelText) return;

    // Resolve the panel this tab targets (data-target / href → #dttab_N).
    const targetSel = tab.getAttribute('data-target') || tab.getAttribute('href');
    let panel;
    if (targetSel && targetSel.startsWith('#')) {
      const id = targetSel.slice(1);
      panel = element.querySelector(`#${CSS.escape(id)}[role="tabpanel"]`)
        || element.querySelector(`#${CSS.escape(id)}`);
    }
    if (!panel) return;

    // Build the label cell as a paragraph so the block gets clean label text.
    const label = document.createElement('p');
    label.textContent = labelText;

    // Content cell — collect the panel's meaningful content: heading + intro
    // (rich text) and each account card. Fall back to the whole panel if the
    // expected sub-structure isn't present.
    const contentCell = [];
    const richText = panel.querySelector('.richTextEditor');
    if (richText) contentCell.push(richText);
    const cards = [...panel.querySelectorAll('.card')];
    contentCell.push(...cards);

    cells.push([label, contentCell.length ? contentCell : panel]);
  });

  // Bail gracefully if we found no tabs/panels.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'tabs-accounts', cells });
  element.replaceWith(block);
}
