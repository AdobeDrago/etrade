# Cards Pricing

Author one row per card in a **Cards Pricing** block. A single content cell is enough; additional cells are merged in reading order. Empty rows are skipped.

Put the amount in the first paragraph (for example `$0`, `$0.65`, or `0.50%`), followed by an H3 label, supporting copy, and an optional standalone linked paragraph. The amount gets the large pricing treatment; labels use smaller headings. An offer card can start with its heading instead. Inline disclosure superscripts and links remain authored.

Standalone links become secondary actions with a decorative arrow. Text, destinations, and tracking parameters come from DA. The grid has one column on narrow phones, two from 600px, and three from 900px. Cards stretch evenly and align their actions at the bottom.

## Migration review

This component is migrated on `et-cards-pricing`. Review its changes against `develop`.

Preview: https://et-cards-pricing--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns both the component and its feature-specific surrounding section styles. Section selectors require this block to be present; `:where()` preserves their existing specificity. Shared homepage section spacing remains in `styles/styles.css`.
