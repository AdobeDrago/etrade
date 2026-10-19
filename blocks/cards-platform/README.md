# Cards Platform

One row per platform: `[image | heading, description, standalone Learn more link]`.
Images may be pictures or raw images; their sources and alternative text are preserved.
Three cards use up to three columns from 900px; two cards stay at two. Cards stack on mobile, with up to two columns from 600px.
A single CTA uses a native stretched link, with inline links independently clickable.

Use **Cards Platform (Compact)** for the six Investment Choices cards. This variant
uses full-width images, left-aligned 1.375rem headings, 0.8125rem descriptions and a text
Learn more action with a chevron. Its section heading and introduction are centered.
Keep the ordinary Cards Platform table for the larger Platforms cards.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

## Shared styles and layout

The block consumes shared surface, text, typography, border, spacing and action tokens. Grids use fewer columns when the block is narrow or text is enlarged. White cards remain readable in dark sections. Native stretched links keep keyboard focus, modifier clicks and independent inline links. Section Metadata controls take precedence over Compact's legacy section width, spacing and centered introduction. See the [shared card styles](../../README.md#shared-card-styles) for validation.
