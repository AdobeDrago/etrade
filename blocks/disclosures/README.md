# Disclosures

Keep homepage disclosures in a separate DA document, such as `/homepage-disclosures`. Set page Metadata `Disclosures` to that document path. The loader places its authored content after the global footer. The global footer document remains independent.

The same Metadata row or a one-cell Disclosures block can select any of these formats automatically:

- A structured fragment set at `/disclosures/sets/homepage`, or an explicit site `.json` file.
- A document containing an authored **Disclosures** table.
- A rich-text disclosure page, such as `/disclosures/docs/homepage`, with headings, paragraphs, tables, media, and an optional numbered list.

For a rich-text page, top-level ordered lists become the numbered disclosure items. Nested lists remain inside their legal copy. Authored list starts, item values, reversed numbering, anchors, formatting, and content order are preserved. Items without an authored anchor receive `disclosure-N` IDs. Numeric markers and the legacy `a`–`z` markers link to matching displayed numbers; content without a numbered list still renders without creating footnote targets. Content before the first list uses the introduction styles, and content after it uses the closing styles. If the document contains a Disclosures table, only that block is consumed.

Document paths may be extensionless or end in `.html` or `.plain.html`, including full site URLs. Legal documents load without page auto-block or button transformations. Preview the referenced document before testing on `.aem.page`, and publish it before testing on `.aem.live` or production. Empty documents stay hidden; unavailable documents are hidden and log a loading error.

## Fragment sets

The **Disclosures** row in the page's **Metadata** table can also point to a structured disclosure set:

| Metadata | |
| --- | --- |
| Disclosures | /disclosures/sets/homepage |

Create that document with the `disclosure-set` schema in DA. The set selects rich-text documents from the fragment directory. New numeric sets use a string `disclosureId` that matches each item’s position: `"1"`, `"2"`, and so on. Reorder through Disclosure Manager so existing citations follow their legal text. Existing letter-ID sets remain readable until explicitly migrated. Introduction, notice, logo, and closing entries do not count toward numbering. For example:

```json
{
  "id": "homepage",
  "introduction": [
    { "kind": "introduction", "fragment": "/disclosures/fragments/investing-introduction" },
    { "kind": "notice", "fragment": "/disclosures/fragments/investment-risk-notice" },
    { "kind": "logo", "fragment": "/disclosures/fragments/sipc-logo" }
  ],
  "disclosures": [
    { "disclosureId": "1", "fragment": "/disclosures/fragments/brokerage-offer" },
    { "disclosureId": "2", "fragment": "/disclosures/fragments/trading-fees" }
  ],
  "closing": [
    { "fragment": "/disclosures/fragments/corporate-closing" }
  ]
}
```

The loader uses Adobe's [structured-content delivery endpoint](https://www.aem.live/docs/ew/administering/structured-content#delivery-endpoint) for `/disclosures/sets/` paths. Localhost and AEM preview hosts request the `preview` environment; published and production hosts request `live`, for `adobedrago/etrade`. An explicit `.json` path can instead reference a JSON file on the site. Metadata values may include the site's full preview/live URL or the Adobe delivery URL.

Preview the set and every referenced fragment before testing on `.aem.page`; publish them before using them on `.aem.live` or the production site. Each unique document loads once per set. The renderer preserves authored order, bold/emphasis, links, anchor IDs, lists, and media without applying page button or auto-block transformations to the fragment body. Notice and logo entries use the existing disclosure styles and accessible logo labels.

Numeric IDs must exactly match nonempty disclosure positions and use a valid set namespace. Missing/empty legal fragments, mixed letter/numeric IDs, duplicates and gaps cannot silently shift numbering. The entire region is hidden on a failed numeric set. Existing letter-ID sets retain their earlier validation/skipping behavior while migration is pending.

Author a claim with `<sup>1</sup>`. For set `homepage`, it resolves to `#disclosure-homepage-1`, with visible text and accessible label 1. Moving that disclosure to position 2 through Disclosure Manager changes both its ID and its affected authored citations to 2. Manually editing a superscript from 1 to 2 instead chooses the current second disclosure.

A comma-separated marker such as `<sup>2,1</sup>` becomes separate numbered links in that citation order. Explicit `homepage-1` markers also resolve in that selected set. Groups with unresolved targets and external links remain authored. A plain matching numeric superscript counts as a disclosure citation; use ordinary Unicode superscript notation, such as ², for an exponent. The authoring helper can assist with that choice.

Legacy sets still accept their existing IDs, such as `offer`, until explicitly converted. Runtime data attributes preserve generated reference identity only while a link is intact; an author’s genuine edit takes precedence.

Run `npm run test:disclosures` to verify set delivery, fragment composition, rich text, footnotes, and legacy rendering.

The [Disclosure Manager DA plugin](../../tools/plugins/disclosure-manager/README.md) provides numbered reference insertion, a reviewed reorder/migration workflow, shared-consumer discovery and recovery for interrupted saves. Register it in the DA Library using its setup instructions. Preview every changed set and citation source together; publishing is separate. Its guide includes the schema contract.

Use a two-column **Disclosures** table. `Introduction` rows hold introductory rich text. Numbered rows (`1`, `2`, and so on) hold the corresponding legal copy. An optional `Closing` row follows the numbered list. Blank rows and empty cells are skipped. Links, lists, and inline formatting remain authored; the block has no legal-copy fallback.

For legacy numeric tables and documents, numeric superscripts in the page content link to existing numbered entries. While a set still delivers the previous numeric schema, the JavaScript also converts single-letter superscripts `a`–`z` to the corresponding explicit numbers `1`–`26` and links them to those existing footer items. For example, `<sup>b</sup>` becomes `<sup><a href="#disclosure-2" aria-label="Disclosure 2">2</a></sup>`. This compatibility mapping uses the footer's explicit numbers, regardless of citation or item order, and only applies when the rendered disclosures contain no stable IDs. A comma-separated reference such as `5,9` or `e,i` becomes two links. References are left unchanged when any target is missing. Legacy numbered items retain `disclosure-N` IDs and can receive focus after anchor navigation. Numeric markers do not select items by displayed position in legacy letter-ID sets; use Disclosure Manager to migrate the set and citations together.

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
