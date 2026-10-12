# Banner Offer

Merge authored cells containing an optional image, heading, terms, promo code and
standalone CTA paragraphs. A dark offer with one CTA and no image is centered,
matching Platforms. An image creates the desktop brokerage split; mobile omits
the decorative banner image. `Light` preserves the compact homepage layout.
Inline terms links remain in their paragraphs. Two standalone links become a
primary CTA and secondary arrow link.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.

**Banner Offer (Compact)** is the dark horizontal tax feature on Planning. It
uses an optional thumbnail, heading, description, and outline action. The image
is hidden on phones; desktop uses the same compact columns as Light while keeping
a dark surface. Updated page examples: `docs/current-pages-authoring.html`.
