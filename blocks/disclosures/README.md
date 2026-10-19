# Disclosures

Keep homepage disclosures in a separate DA document, such as `/homepage-disclosures`. Set page Metadata `Disclosures` to that document path. The loader places its authored content after the global footer. The global footer document remains independent.

## Fragment sets

The **Disclosures** row in the page's **Metadata** table can also point to a structured disclosure set:

| Metadata | |
| --- | --- |
| Disclosures | /disclosures/sets/homepage |

Create that document with the `disclosure-set` schema in DA. The set selects rich-text documents from the fragment directory. Each disclosure has a stable `disclosureId`; its position in the `disclosures` array determines its displayed number, starting at 1. Introduction, notice, logo, and closing entries do not count toward numbering. For example:

```json
{
  "id": "homepage",
  "introduction": [
    { "kind": "introduction", "fragment": "/disclosures/fragments/investing-introduction" },
    { "kind": "notice", "fragment": "/disclosures/fragments/investment-risk-notice" },
    { "kind": "logo", "fragment": "/disclosures/fragments/sipc-logo" }
  ],
  "disclosures": [
    { "disclosureId": "offer", "fragment": "/disclosures/fragments/brokerage-offer" },
    { "disclosureId": "fees", "fragment": "/disclosures/fragments/trading-fees" }
  ],
  "closing": [
    { "fragment": "/disclosures/fragments/corporate-closing" }
  ]
}
```

The loader uses Adobe's [structured-content delivery endpoint](https://www.aem.live/docs/ew/administering/structured-content#delivery-endpoint) for `/disclosures/sets/` paths. Localhost and AEM preview hosts request the `preview` environment; published and production hosts request `live`, for `adobedrago/etrade`. An explicit `.json` path can instead reference a JSON file on the site. Metadata values may include the site's full preview/live URL or the Adobe delivery URL.

Preview the set and every referenced fragment before testing on `.aem.page`; publish them before using them on `.aem.live` or the production site. Each unique document loads once per set. The renderer preserves authored order, bold/emphasis, links, anchor IDs, lists, and media without applying page button or auto-block transformations to the fragment body. Notice and logo entries use the existing disclosure styles and accessible logo labels.

IDs must match `^[a-z][a-z0-9]*$`: `a`, `disc1`, `offer`, and `apy` are valid. Incomplete entries, invalid IDs, duplicate IDs after the first valid entry, and empty fragment bodies are skipped. The rendered items are numbered consecutively from 1 to N in set order. Reusing one fragment with different IDs is supported. If the set request or a referenced fragment fails, the region is hidden and a loading error is logged; no partial legal footer or fallback copy is generated. Previously delivered sets using `number`, inline Disclosures tables, and links to legacy disclosure documents retain their numeric behavior during migration. A set containing `disclosureId` uses the new schema throughout.

Author a claim with `<sup>offer</sup>`. Once its footer item exists, the inline auto-block helper converts it to `<sup><a href="#disclosure-offer" aria-label="Disclosure 1">1</a></sup>`. The footer item uses the same number and the stable `disclosure-offer` anchor. Moving `offer` to the second position makes both its claim marker and footer display 2, while the anchor remains unchanged. Citation order on the page does not affect numbering.

A comma-separated marker such as `<sup>fees,offer</sup>` becomes separate numbered links in that citation order. Each ID must exist in the rendered footer; unmatched markers and groups with any missing ID remain as authored. Ordinary superscripts and external links stay authored. Authors do not need to create links manually. Markers already wrapped in disclosure anchors are normalized without nesting links. The helper retains the original IDs in `data-disclosure-ids` so repeated decoration does not treat display numbers as identifiers.

Run `npm run test:disclosures` to verify set delivery, fragment composition, rich text, footnotes, and legacy rendering.

The [Disclosure Manager DA plugin](../../tools/plugins/disclosure-manager/README.md) provides search across IDs and saved copy, expandable copy previews, source edit links, a reorder interface, stable-ID reference insertion, and an audit of the saved page. Register it in the DA Library using its branch or local setup instructions. It updates the disclosure set without rewriting page numbers; preview or publish the content separately after saving.

Use a two-column **Disclosures** table. `Introduction` rows hold introductory rich text. Numbered rows (`1`, `2`, and so on) hold the corresponding legal copy. An optional `Closing` row follows the numbered list. Blank rows and empty cells are skipped. Links, lists, and inline formatting remain authored; the block has no legal-copy fallback.

For legacy numeric tables and documents, numeric superscripts in the page content link to existing numbered entries. While a set still delivers the previous numeric schema, the JavaScript also converts single-letter superscripts `a`–`z` to the corresponding explicit numbers `1`–`26` and links them to those existing footer items. For example, `<sup>b</sup>` becomes `<sup><a href="#disclosure-2" aria-label="Disclosure 2">2</a></sup>`. This compatibility mapping uses the footer's explicit numbers, regardless of citation or item order, and only applies when the rendered disclosures contain no stable IDs. A comma-separated reference such as `5,9` or `e,i` becomes two links. References are left unchanged when any target is missing. Legacy numbered items retain `disclosure-N` IDs and can receive focus after anchor navigation. Numeric markers do not select items by their display number in ID-based sets; migrate those page markers to their corresponding IDs.

A one-cell block containing a single document link also loads an authored disclosure document. Avoid using both inline disclosures and page Metadata to define duplicate entries. Update offer rates, dates, eligibility, tiers, and associated disclosure copy together.

The disclosure area has a full-width light background. Its introduction, numbered disclosures, and closing copy stay centered with a maximum width of 1180px; the background continues through the side gutters and bottom padding.

## Migration review

This component is migrated on `et-disclosures`. Review its changes against `develop`.

Preview: https://et-disclosures--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns the disclosure region and `.disclosures-reference` markers in page content. The shared `/scripts/disclosure-references.js` helper runs in `buildAutoBlocks` for content added after the footer is ready, and the block decorator runs it after the authored disclosure items are available. Automatically loaded fragments receive another pass after insertion. Shared homepage section spacing remains in `styles/styles.css`.

## Shared style system

The owned light surface, links, typography, spacing and focus use shared tokens. Inner gutters are bounded in narrow containers and with enlarged text. Legal IDs, ordered entries, authored rich content and the logged, hidden loading-failure behavior are unchanged. See the [shared component styles](../../README.md#shared-component-styles) for ownership and validation on `etrade-style`.
