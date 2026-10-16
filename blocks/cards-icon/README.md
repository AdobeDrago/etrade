# Cards Icon

One row per audience: `[icon | heading, description, standalone link]`.
The icon cell can contain an image, SVG, authored `.icon`, or one of these text names:
`book`, `computer`, `goal`, `savings`, `tool-box-welcome-kit`, `umbrella`.
Named icons use the E*TRADE icon font. Empty icon cells leave the card copy usable.
The default uses up to three columns of rounded white cards from 768px. `Welcome Back` keeps
its existing two-column desktop layout and accent bars.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.

Planning uses **Cards Icon (Planning)** for the life-events grid. Its icon names are
`home-lending`, `group-family`, `graduation-gift`, `retirement`, and `mountain`.
A row with `offer` in the first cell creates a dark campaign card; put the offer
heading, terms, promo code, disclosure ID, and action in the second cell.

Use **Cards Icon (Tools)** for the four retirement tools. Supported names are
`ira-selector`, `money-automatic-investing`, `calculator`, and `add-funds`.
The variant uses four desktop columns and outline actions. These named cells
survive DA serialization; do not paste empty icon-font elements.

## Shared styles and layout

Colors, typography, spacing, borders, focus and actions consume shared tokens. White cards keep dark copy in dark sections; the Planning offer owns its inverse surface and text roles. Tools uses up to four columns and Welcome Back up to two when space permits. All variants reduce their column count inside narrow section grids or with enlarged text. Welcome Back also stacks its icon and copy when the block is narrow. Section Metadata controls take precedence over legacy introduction styling and Welcome Back's outer width adjustment. See the [shared card styles](../../README.md#shared-card-styles) for validation.
