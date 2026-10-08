# Cards Product

Author one row per card in a **Cards Product** block. Put an H3 product name, an optional H4 rate, supporting paragraphs, and an optional standalone linked paragraph in its cell. Additional cells are merged; empty rows are skipped.

Rates, offer dates, legal references, CTA labels, and destinations belong in DA. The block preserves rich text and supplies a decorative arrow for standalone actions. Cards use one column below 600px and two above it, with safe wrapping and actions aligned at the bottom.

## Optional dynamic rates

Replace only a selected numeric rate with `{{rate}}` (or `{{rate:base}}`) and add a separate **Rate settings** cell in the same row. Settings select API, manual or hybrid mode, the product/field, balance or CD term, and an optional approved fallback. Unconfigured cards keep their authored values. A manual or populated hybrid override does not request rates. Keep `%`, APY labels, promotional copy and disclosure references authored; the base-rate API does not supply boosted promotional APYs.

See the [copy-and-paste authoring guide](../../docs/dynamic-rates-authoring.html). Review dynamic bindings at https://et-dynamic--etrade--AdobeDrago.aem.page/home after authoring the markers and settings in preview content.

## Migration review

This component is migrated on `et-cards-product`. Review its changes against `et-actions`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-cards-product--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
