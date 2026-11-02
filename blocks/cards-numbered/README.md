# Cards Numbered

One row per reason: `[heading, description, standalone link]`.
The block generates large ordinals from nonempty row order and uses a semantic
ordered list. Reordering rows renumbers the cards without editing their copy.
Desktop shows up to three columns; mobile stacks the reasons.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

## Shared styles and layout

The block consumes shared text, surface, typography, spacing, border and action tokens. Ordinals retain their larger display size and tracking. From 768px the grid uses up to three columns, reducing the count inside narrow section cells or with enlarged text. White cards retain dark text in dark sections. Section Metadata controls take precedence over legacy introduction styling. See the [shared card styles](../../README.md#shared-card-styles) for validation.
