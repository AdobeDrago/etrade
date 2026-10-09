# cards-account

Custom **cards** block. 

## Authoring (Document Authoring)

Model: `standalone`

Single block table, one row per account card. Put its heading, copy and CTA links in the content cell. Additional content cells are merged in order, empty rows are skipped, and inline disclosure links stay with their paragraphs.

## Optional dynamic rates

Replace a selected numeric value with `{{rate}}` or a named marker such as `{{rate:base}}`, keeping `%`, APY labels and rich text authored. Add a separate **Rate settings** cell to the same row to choose API, manual or hybrid mode, product/field, balance or CD term, override and approved fallback. Settings cells are consumed before decoration; ordinary additional content cells are preserved. Manual and populated hybrid overrides do not request the API.

See the [copy-and-paste authoring guide](../../docs/dynamic-rates-authoring.html). Preview: https://et-dynamic--etrade--AdobeDrago.aem.page/what-we-offer/our-accounts. Existing flattened Our Accounts content must be authored as cards before these bindings apply.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
