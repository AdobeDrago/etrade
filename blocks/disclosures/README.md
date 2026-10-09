# Disclosures

Keep homepage disclosures in a separate DA document, such as `/homepage-disclosures`. Set page Metadata `Disclosures` to that document path. The loader places its authored content after the global footer. The global footer document remains independent.

## Fragment sets

The **Disclosures** row in the page's **Metadata** table can also point to a structured disclosure set:

| Metadata | |
| --- | --- |
| Disclosures | /disclosures/sets/homepage |

Create that document with the `disclosure-set` schema in DA. The set selects rich-text documents from the fragment directory; footnote numbers belong to the set, not to the shared fragment. For example:

```json
{
  "id": "homepage",
  "introduction": [
    { "kind": "introduction", "fragment": "/disclosures/fragments/investing-introduction" },
    { "kind": "notice", "fragment": "/disclosures/fragments/investment-risk-notice" },
    { "kind": "logo", "fragment": "/disclosures/fragments/sipc-logo" }
  ],
  "disclosures": [
    { "number": 1, "fragment": "/disclosures/fragments/brokerage-offer" },
    { "number": 3, "fragment": "/disclosures/fragments/trading-fees" }
  ],
  "closing": [
    { "fragment": "/disclosures/fragments/corporate-closing" }
  ]
}
```

The loader uses Adobe's [structured-content delivery endpoint](https://www.aem.live/docs/ew/administering/structured-content#delivery-endpoint) for `/disclosures/sets/` paths. Localhost and AEM preview hosts request the `preview` environment; published and production hosts request `live`, for `adobedrago/etrade`. An explicit `.json` path can instead reference a JSON file on the site. Metadata values may include the site's full preview/live URL or the Adobe delivery URL.

Preview the set and every referenced fragment before testing on `.aem.page`; publish them before using them on `.aem.live` or the production site. Each unique document loads once per set. The renderer preserves authored order, bold/emphasis, links, anchor IDs, lists, and media without applying page button or auto-block transformations to the fragment body. Notice and logo entries use the existing disclosure styles and accessible logo labels.

Incomplete entries and duplicate footnote numbers are skipped without renumbering subsequent entries. If the set request or a referenced fragment fails, the region is hidden and a loading error is logged; no partial legal footer or fallback copy is generated. Existing inline Disclosures tables and links to legacy disclosure documents continue to work.

Run `npm run test:disclosures` to verify set delivery, fragment composition, rich text, footnotes, and legacy rendering.

Use a two-column **Disclosures** table. `Introduction` rows hold introductory rich text. Numbered rows (`1`, `2`, and so on) hold the corresponding legal copy. An optional `Closing` row follows the numbered list. Blank rows and empty cells are skipped. Links, lists, and inline formatting remain authored; the block has no legal-copy fallback.

Numeric superscripts in the page content link to existing numbered entries. A comma-separated reference such as `5,9` becomes two links. References are left unchanged when any target is missing. Numbered items have stable `disclosure-N` IDs and can receive focus after anchor navigation.

A one-cell block containing a single document link also loads an authored disclosure document. Avoid using both inline disclosures and page Metadata to define duplicate entries. Update offer rates, dates, eligibility, tiers, and associated disclosure copy together.

The disclosure area has a full-width light background. Its introduction, numbered disclosures, and closing copy stay centered with a maximum width of 1180px; the background continues through the side gutters and bottom padding.

## Migration review

This component is migrated on `et-disclosures`. Review its changes against `develop`.

Preview: https://et-disclosures--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns the disclosure region and `.disclosures-reference` markers in page content. The block decorator links those markers after the authored disclosure items are available. Shared homepage section spacing remains in `styles/styles.css`.
