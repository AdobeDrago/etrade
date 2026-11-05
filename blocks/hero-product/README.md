# Hero Product

The brokerage hero uses a dark split layout with text on the left, product media
on the right and an optional compact offer beneath the image. Mobile stacks these
in that order.

Author named rows: `[Eyebrow | content]`, `[Heading | content]`, `[Content | copy and
standalone CTA paragraphs]`, `[Image | image]`, `[Offer | heading, terms, standalone link]`.
Rows can be omitted or reordered and can contain extra value cells. Legacy single
content cells also work: an H1 followed by H2 identifies the eyebrow and headline.
Only the first section's hero image is promoted to eager loading.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

## Shared style system

This block consumes the shared color, typography, spacing, border, focus and applicable motion tokens. Narrow section cells and enlarged text reflow within the block. Authored Section Metadata takes precedence over legacy surrounding section styles; content, links and existing interactions are preserved. See the [shared component styles](../../README.md#shared-component-styles) for ownership and validation on `etrade-style`.
