# Cards Icon

One row per audience: `[icon | heading, description, standalone link]`.
The icon cell can contain an image, SVG, authored `.icon`, or one of these text names:
`book`, `computer`, `goal`, `savings`, `tool-box-welcome-kit`, `umbrella`.
Named icons use the E*TRADE icon font. Empty icon cells leave the card copy usable.
The default is a three-column grid of rounded white cards. `Welcome Back` keeps
its existing two-column desktop layout and accent bars.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Review actual live-content examples at `http://127.0.0.1:3030/docs/remaining-blocks.html`
after `npm run demo:blocks`. Copyable tables are local review artifacts; content
changes must be saved and previewed separately in DA.
