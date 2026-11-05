# Cards Pricing

Author one row per card in a **Cards Pricing** block. A single content cell is enough; additional cells are merged in reading order. Empty rows are skipped.

Put the amount in the first paragraph (for example `$0`, `$0.65`, or `0.50%`), followed by an H3 label, supporting copy, and an optional standalone linked paragraph. The amount gets the large pricing treatment; labels use smaller headings. An offer card can start with its heading instead. Inline disclosure superscripts and links remain authored.

Standalone links become outline buttons by default; **Cards Pricing (Text Links)** uses text actions with a decorative arrow. Text, destinations, and tracking parameters come from DA. The grid has one column on narrow phones and up to three from 768px when space permits. Cards stretch evenly and align their actions at the bottom.

For the Investment Choices summary, use **Cards Pricing (Band)**. Put the Low pricing
H2 immediately before the table in the same section. Author three rows with `$0`,
`65¢` and `$1.50` as the first paragraph, followed by the H3 label and its disclosure
ID. The variant renders a dark blue band with a cyan section heading. A standalone
View all pricing link in any row moves into a shared primary action below the values.
Do not add the extra per-trade descriptions from the older preview when matching
the live summary. The ordinary Cards Pricing treatment remains available.

## Optional dynamic bank rates

The shared rate binding supports `{{rate}}` or named markers plus a separate **Rate settings** cell. API, manual and hybrid modes are documented in the [shared rate settings](../cards-product/README.md#optional-dynamic-rates). Keep units and disclosure superscripts authored. Commission amounts and ordinary pricing remain authored unless explicitly configured; the bank-rate endpoint does not supply trading fees. Review: https://et-dynamic--etrade--AdobeDrago.aem.page/home.

## Migration review

The shared style migration is on `etrade-style`. Preview: https://etrade-style--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block consumes shared card, typography, spacing, border, focus and action tokens. Section selectors require this block to be present. Explicit Section Metadata owns the surrounding container, spacing, background and introduction alignment; Band retains its own blue surface and inverse values inside that section. Narrow section cells and enlarged text reduce the internal column count as needed. See the [shared card styles](../../README.md#shared-card-styles) for validation.
