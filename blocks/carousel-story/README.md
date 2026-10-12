# Carousel Story

One row per story: `[image | year paragraph, heading, description, optional standalone link]`.
Two cards are visible on desktop; one on mobile. The list scrolls and snaps natively.
Previous/Next stop at the boundaries, dots select stories, and a status reports
visible stories. Focus the list to use Left/Right, Home and End. Reduced-motion
preferences disable animated scrolling. There is no automatic advance.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
