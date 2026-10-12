# Cards Article

One row per article: `[image | optional eyebrow paragraph, heading, copy, standalone link]`.
Default cards have inset images and 28px desktop headings. Four cards become four
columns on wide desktops. `Cards Article (Promo)` uses full-width images and smaller
headings, matching Why E*TRADE. The importer preserves the promo variant and eyebrows.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
