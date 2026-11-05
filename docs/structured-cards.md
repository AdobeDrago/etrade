# Optional structured cards

All nine Cards blocks and Carousel Story support the ten DA schemas alongside ordinary authoring. Continue authoring card tables as before. A block may contain ordinary rows, referenced rows, or both, in the desired order. Existing variants, section themes and layouts still come from the page's block and Section Metadata.

## Author a reference

In the appropriate card block, add a row containing just a link to a card document under `/cards/`. For example, put a link labelled **Premium Savings** with destination `/cards/product/premium-savings` in a Cards Product row. Keep the ordinary product cards in their other rows.

An unlinked path also works. Extensionless, `.html` and `.plain.html` paths are accepted, as are this site's full AEM preview/live URLs and its DA structured delivery URLs. The loader always selects the current page's environment: preview on localhost, DA and AEM preview hosts; live on production and published hosts. URLs containing a query or hash are ordinary authored links rather than source references.

The source row must contain exactly one nonempty cell and either a single standalone link or the document path. Blank extra cells are allowed. A paragraph containing inline copy and a link remains ordinary authored content. An ordinary CTA pointing outside `/cards/` also remains ordinary. Put card-specific changes in the source document; additional nonempty cells make the row ordinary authored content rather than an override of its source.

## Schema mapping

| DA schema | Website block |
| --- | --- |
| `card` | Cards |
| `card-account` | Cards Account |
| `card-product` | Cards Product |
| `card-pricing` | Cards Pricing |
| `card-article` | Cards Article |
| `card-platform` | Cards Platform |
| `card-icon` | Cards Icon |
| `card-award` | Cards Award |
| `card-numbered` | Cards Numbered |
| `card-story` | Carousel Story |

Select the corresponding schema in DA. The website adapts supported fields to the receiving block; it does not change the block family based on the source or create presentation variants from JSON. Numbered cards receive consecutive ordinals in displayed row order, including ordinary authored cards.

## Fields and delivery

- `id` and `title` are required. Card IDs use lowercase letters, digits and hyphens, starting with a letter. Reusing a card does not create duplicate heading IDs; its identity is available as `data-card-id` on the heading.
- `title`, `description`, `value`, `rateText`, `eyebrow` and `attribution` are plain text. Use `bodyFragment` for formatted paragraphs, lists, inline links, media and superscripts. Its same-site document path, normally under `/card-copy/`, supplies the body in place of `description`. Do not put standalone CTAs in the rich body; author them in `actions`.
- `image.src` selects media. Informative images require `image.alt`; explicitly set `image.decorative: true` for empty alternative text. Missing media leaves copy usable. Image-bearing blocks use the existing media rendering. Card Icon uses an image when supplied, otherwise its named icon; `kind: offer` selects its existing offer treatment. Card Award also supports `icon: award`.
- `actions` retain their order, URLs, query parameters and supported tracking/route controls. `target: _blank` receives safe link relations; `ariaLabel` supplies an optional accessible label. Each existing block owns its action appearance.
- `disclosureIds`, `valueDisclosureIds` and `rateDisclosureIds` attach references to their respective copy or claims. IDs must exist in the page's disclosure set and follow its lowercase-letter/digit convention. The adapter does not select legal copy or invent display numbers. References are resolved whether the footer loads before or after the card.
- Account, Product and Pricing accept the existing `rates` contract with `{{rate}}` or named markers. Bindings become normal Rate settings cells before existing rate decoration. Manual, hybrid and API selection, zero values, balance/CD requirements and unavailable placeholders use the shared rate parser/client. Invalid combinations never request the service and display the configured fallback or unavailable marker. Ordinary commission values remain authored; bank-rate data does not supply them.

The delivery JSON may be the card object directly or an object with the card in `data`. Each unique source and rich body is requested once per page, with a ten-second timeout. A failed or invalid card is omitted and logged; its neighboring authored and referenced cards remain. A failed rich body omits the card instead of substituting its alternate description. A block with no remaining cards is hidden. Executable URL schemes, active rich markup and event handlers are not inserted; rich-body anchor IDs are scoped per instance.

Keep structured card documents under `/cards/` and rich body documents under `/card-copy/`, avoiding the page's special `/fragments/` and `/widgets/` auto-block paths. Preview each source and body before reviewing on `.aem.page`, and publish them for live delivery. Schema creation alone does not preview/publish a card document. The DA folder mapping `/adobedrago/etrade/cards=https://da.live/form#` selects the structured editor and is configured separately from this code.

## Validation

Run `npm run test:cards` for structured and ordinary card regressions, and `npm test` plus `npm run lint` for full checks. Tests exercise all ten decorators, mixed ordering, request sharing, rich bodies, accessibility fields, tracking, disclosure timing, rates, invalid content and page auto-block compatibility. Live DA response/access and authored preview acceptance require a previewed document; local JSON/HTML fixtures alone do not establish those checks.

Branch preview: https://et-structured-cards--etrade--AdobeDrago.aem.page/home
