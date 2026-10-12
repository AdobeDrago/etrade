# Tabs Accounts

The block name is `Tabs Accounts` (plural). One row per category:
`[label | heading, intro paragraph, account list | optional extra content/settings]`.
Each account is a list item containing H3, description paragraphs and standalone
Learn more / Open account links. Legacy `.card` imports and flattened H3 groups
remain supported. The importer produces editor-safe lists rather than classed divs.

Desktop uses accessible tabs with roving focus and Left/Right, Home and End support.
Below 900px a labeled native select changes the same active panel. IDs are unique
across repeated labels and block instances. Inactive panels use `hidden`.
Live-style hashes such as `#tab_5` select the zero-based category on initial load;
out-of-range hashes fall back to the first category. Desktop tabs have a raised
purple top border, and account cards use slate accents and compact typography.

Rate markers and extra `Rate Settings` cells use the existing `/scripts/card-rates.js`
mechanism. Name each rate independently when a panel needs multiple rates; see
`docs/dynamic-rates-demo.html` for settings. Do not bake live bank rates into code.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.
Learn more links render as plain text actions. Application links such as Open an
account, Apply now and Get started render as outlines, including cards with only
one action. Include the panel H2 and both links where the live page has them.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
