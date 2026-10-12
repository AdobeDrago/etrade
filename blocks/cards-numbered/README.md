# Cards Numbered

One row per reason: `[heading, description, standalone link]`.
The block generates large ordinals from nonempty row order and uses a semantic
ordered list. Reordering rows renumbers the cards without editing their copy.
Desktop shows up to three columns; mobile stacks the reasons.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
