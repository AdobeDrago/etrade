# Cards Article

One row per article: `[image | optional eyebrow paragraph, heading, copy, standalone link]`.
Default cards have inset images and 28px desktop headings. Four cards become four
columns on wide desktops. `Cards Article (Promo)` uses full-width images and smaller
headings, matching Why E*TRADE. The importer preserves the promo variant and eyebrows.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.
