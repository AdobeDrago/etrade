# Cards Product

Author one row per card in a **Cards Product** block. Put an H3 product name, an optional H4 rate, supporting paragraphs, and an optional standalone linked paragraph in its cell. Additional cells are merged; empty rows are skipped.

Rates, offer dates, legal references, CTA labels, and destinations belong in DA. The block preserves rich text and supplies a decorative arrow for standalone actions. Cards use one column below 600px and two above it, with safe wrapping and actions aligned at the bottom.

## Optional dynamic rates

Replace only a selected numeric rate with `{{rate}}` (or `{{rate:base}}`) and add a separate **Rate settings** cell in the same row. Settings select API, manual or hybrid mode, the product/field, balance or CD term, and an optional approved fallback. Unconfigured cards keep their authored values. A manual or populated hybrid override does not request rates. Keep `%`, APY labels, promotional copy and disclosure references authored; the base-rate API does not supply boosted promotional APYs.

See the [copy-and-paste authoring guide](../../docs/dynamic-rates-authoring.html). Review dynamic bindings at https://et-dynamic--etrade--AdobeDrago.aem.page/home after authoring the markers and settings in preview content.

Use `Fallback: -.--` to display that placeholder while a rate loads or cannot be resolved. The placeholder does not prevent valid API or hybrid lookups. With authored `{{rate}}% APY`, it displays as `-.--% APY`; screen readers receive an unavailable-rate label. Numeric fallbacks, including zero, remain supported. Overrides must still be numeric.

For balance testing on localhost or an `aem.page` preview, run `localStorage.setItem('userBalance', '100000'); location.reload();` in that page's browser console. Savings/checking API bindings select the tier for this dummy balance; manual and populated hybrid overrides, CD terms and ordinary authored cards retain their values. Remove the test value with `localStorage.removeItem('userBalance'); location.reload();`. Missing, invalid or inaccessible storage uses the authored Balance. Production hosts, including `aem.live`, ignore the test key. Storage is per origin, so set it on the same host and port as the page you are testing. Markers expose `data-rate-balance` and `data-rate-balance-source` for inspection.

The four dummy JSON files under `test/fixtures` and `/phx/pros` share distinct savings APYs: 3.75 below $5,000; 3.85 from $5,000; 4.00 from $50,000; 4.15 from $100,000; 4.25 from $500,000. These are fabricated test values. Keep `Balance` authored for every savings/checking binding, and keep the page connected to a sample JSON endpoint when testing these expectations.

## Migration review

This component is migrated on `et-cards-product`. Review its changes against `et-actions`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-cards-product--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
