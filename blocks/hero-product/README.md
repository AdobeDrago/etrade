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

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
