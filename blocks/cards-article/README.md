# Cards Article

One row per article: `[image | optional eyebrow paragraph, heading, copy, standalone link]`.
Default cards have inset images and 1.75rem desktop headings. Four cards use up to four
columns from 768px when space permits. `Cards Article (Promo)` uses full-width images and smaller
headings, matching Why E*TRADE. The importer preserves the promo variant and eyebrows.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

## Shared styles and layout

The block consumes shared color, typography, spacing, border and action tokens. Column counts adapt to the block's available width, including authored section grids and enlarged text. Promo content stays in normal flow over its artwork and the card grows with longer copy. White content surfaces keep dark text in dark sections. Section Metadata controls take precedence over the legacy introduction layout. See the [shared card styles](../../README.md#shared-card-styles) for validation.
