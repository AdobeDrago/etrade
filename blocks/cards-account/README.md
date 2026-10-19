# Cards Account

Single block table, one row per account card. Put its heading, copy and CTA links in the content cell. Additional content cells are merged in order, empty rows are skipped, and inline disclosure links stay with their paragraphs.

Standalone action paragraphs use the shared controls: the primary account action is outlined and later actions use text links. Actions align at the bottom without moving inline or legal links. Headings use 1.5rem on mobile and 1.75rem from 768px. Nested authored lists retain their normal layout.

## Optional dynamic rates

Replace a selected numeric value with `{{rate}}` or a named marker such as `{{rate:base}}`, keeping `%`, APY labels and rich text authored. Add a separate **Rate settings** cell to the same row to choose API, manual or hybrid mode, product/field, balance or CD term, override and approved fallback. Settings cells are consumed before decoration; ordinary additional content cells are preserved. Manual and populated hybrid overrides do not request the API.

See the [shared rate settings](../cards-product/README.md#optional-dynamic-rates). Preview: https://et-dynamic--etrade--AdobeDrago.aem.page/what-we-offer/our-accounts. Existing flattened Our Accounts content must be authored as cards before these bindings apply.

## Shared styles and layout

There are no named variants. Cards use one column, up to two from 600px and three from 900px when the block has enough room. Narrow section cells and enlarged text reflow to fewer columns. The block uses shared card surfaces, text, borders, accent bars, spacing and keyboard focus; its white cards remain readable in dark sections. See the [shared card styles](../../README.md#shared-card-styles) for section controls and validation.
