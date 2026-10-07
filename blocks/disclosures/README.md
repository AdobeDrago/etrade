# Disclosures

Keep homepage disclosures in a separate DA document, such as `/homepage-disclosures`. Set page Metadata `Disclosures` to that document path. The loader places its authored content after the global footer. The global footer document remains independent.

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
