# Cards Product

Author one row per card in a **Cards Product** block. Put an H3 product name, an optional H4 rate, supporting paragraphs, and an optional standalone linked paragraph in its cell. Additional cells are merged; empty rows are skipped.

Rates, offer dates, legal references, CTA labels, and destinations belong in DA. The block preserves rich text and supplies a decorative arrow for standalone actions. Cards use one column below 768px and up to two above it, with safe wrapping and actions aligned at the bottom.

## Optional dynamic rates

Replace only a selected numeric rate with `{{rate}}` (or `{{rate:base}}`) and add a separate **Rate settings** cell in the same row. Settings select API, manual or hybrid mode, the product/field, balance or CD term, and an optional approved fallback. Unconfigured cards keep their authored values. A manual or populated hybrid override does not request rates. Keep `%`, APY labels, promotional copy and disclosure references authored; the base-rate API does not supply boosted promotional APYs.

For `{{rate:base}}% APY`, add a separate cell in the same card row. Start with a **Rate settings** paragraph and put each setting in its own paragraph:

```text
Rate settings
Name: base
Mode: api
Product: 3100
Field: advertisedAPY
Balance: 0
Fallback: -.--
```

Supported products are savings (`3100`), checking (`4240`) and CDs (`3500`). Savings/checking use an explicit Balance and `advertisedAPY`, `disclosureAPY` or `finalRate`. CDs use a Term such as `12M` with `disclosureAPY` or `finalRate`, or `minDisclosureAPY`/`maxDisclosureAPY` without Term or Balance. A name identifies only the matching markers in that card row.

For a fixed rate, use `Mode: manual` with a numeric `Override`. `Mode: hybrid` uses a populated Override first and otherwise requests the configured API rate. A numeric zero is valid. Page metadata **Bank rates source** selects `direct` (default) or `aggregate`; **Bank rates endpoint** may select a same-origin service route. Without an endpoint override, the shared client requests the real E*TRADE service: guest GET `https://us.etrade.com/phx/pros/apicontent/init/bankRates`, or POST `https://us.etrade.com/phx/pros/aggregate` with the bank-rate subrequest. Concurrent cards share one bounded request. Sample JSON under `/phx/pros` is selected only through an explicit test endpoint; it is not an automatic fallback. Verify real service access from the delivery host separately from fixture tests.

Use `Fallback: -.--` to display that placeholder while a rate loads or cannot be resolved. The placeholder does not prevent valid API or hybrid lookups. With authored `{{rate}}% APY`, it displays as `-.--% APY`; screen readers receive an unavailable-rate label. Numeric fallbacks, including zero, remain supported. Overrides must still be numeric.

For balance testing on localhost or an `aem.page` preview, run `localStorage.setItem('userBalance', '100000'); location.reload();` in that page's browser console. Savings/checking API bindings select the tier for this dummy balance; manual and populated hybrid overrides, CD terms and ordinary authored cards retain their values. Remove the test value with `localStorage.removeItem('userBalance'); location.reload();`. Missing, invalid or inaccessible storage uses the authored Balance. Production hosts, including `aem.live`, ignore the test key. Storage is per origin, so set it on the same host and port as the page you are testing. Markers expose `data-rate-balance` and `data-rate-balance-source` for inspection.

The four dummy JSON files under `test/fixtures` and `/phx/pros` share distinct savings APYs: 3.75 below $5,000; 3.85 from $5,000; 4.00 from $50,000; 4.15 from $100,000; 4.25 from $500,000. These are fabricated test values. Keep `Balance` authored for every savings/checking binding, and keep the page connected to a sample JSON endpoint when testing these expectations.

## Migration review

The shared style migration is on `etrade-style`. Preview: https://etrade-style--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

**Cards Product (Three Columns)** displays the three current homepage product
cards in up to three columns from 768px. The ordinary variant retains its two-column cap.
Maintain campaign copy and its matching disclosures in DA.

## Shared styles and layout

The block consumes shared surface, text, typography, spacing, border, focus and action tokens. Its white cards retain dark copy in dark sections. Narrow section cells and enlarged text reduce the internal column count; authored Section Metadata owns the surrounding layout. Rate bindings, units, zero values, fallback labels and legal references are independent of the style migration. See the [shared card styles](../../README.md#shared-card-styles) for validation.
