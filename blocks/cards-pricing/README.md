# Cards Pricing

Author one row per card in a **Cards Pricing** block. A single content cell is enough; additional cells are merged in reading order. Empty rows are skipped.

Put the amount in the first paragraph (for example `$0`, `$0.65`, or `0.50%`), followed by an H3 label, supporting copy, and an optional standalone linked paragraph. The amount gets the large pricing treatment; labels use smaller headings. An offer card can start with its heading instead. Inline disclosure superscripts and links remain authored.

Standalone links become outline buttons by default; **Cards Pricing (Text Links)** uses text actions with a decorative arrow. Text, destinations, and tracking parameters come from DA. The grid has one column on narrow phones and three from 768px. Cards stretch evenly and align their actions at the bottom.

For the Investment Choices summary, use **Cards Pricing (Band)**. Put the Low pricing
H2 immediately before the table in the same section. Author three rows with `$0`,
`65¢` and `$1.50` as the first paragraph, followed by the H3 label and its disclosure
ID. The variant renders a dark blue band with a cyan section heading. A standalone
View all pricing link in any row moves into a shared primary action below the values.
Do not add the extra per-trade descriptions from the older preview when matching
the live summary. The ordinary Cards Pricing treatment remains available.

## Optional dynamic bank rates

The shared rate binding supports `{{rate}}` or named markers plus a separate **Rate settings** cell. API, manual and hybrid modes are documented in the [authoring guide](../../docs/dynamic-rates-authoring.html). Keep units and disclosure superscripts authored. Commission amounts and ordinary pricing remain authored unless explicitly configured; the bank-rate endpoint does not supply trading fees. Review: https://et-dynamic--etrade--AdobeDrago.aem.page/home.

## Migration review

This component is migrated on `et-cards-pricing`. Review its changes against `develop`.

Preview: https://et-cards-pricing--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns both the component and its feature-specific surrounding section styles. Section selectors require this block to be present; `:where()` preserves their existing specificity. Shared homepage section spacing remains in `styles/styles.css`.
