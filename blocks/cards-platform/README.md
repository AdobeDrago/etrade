# Cards Platform

One row per platform: `[image | heading, description, standalone Learn more link]`.
Images may be pictures or raw images; their sources and alternative text are preserved.
Three cards fill three desktop columns; two cards fill two. Cards stack on mobile.
A single CTA uses a native stretched link, with inline links independently clickable.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
