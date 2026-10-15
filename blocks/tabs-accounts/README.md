# Tabs Accounts

The block name is `Tabs Accounts` (plural). One row per category:
`[label | heading, intro paragraph, account list | optional extra content/settings]`.
Each account is a list item containing H3, description paragraphs and standalone
Learn more / Open account links. Legacy `.card` imports and flattened H3 groups
remain supported. The importer produces editor-safe lists rather than classed divs.

Desktop uses accessible tabs with roving focus and Left/Right, Home and End support.
Below 900px a labeled native select changes the same active panel. IDs are unique
across repeated labels and block instances. Inactive panels use `hidden`.
Live-style hashes such as `#tab_5` select the zero-based category on initial load;
out-of-range hashes fall back to the first category. Desktop tabs have a raised
purple top border, and account cards use slate accents and compact typography.

Rate markers and extra `Rate Settings` cells use the existing `/scripts/card-rates.js`
mechanism. Name each rate independently when a panel needs multiple rates; see
the [shared rate settings](../cards-product/README.md#optional-dynamic-rates). Do not bake live bank rates into code.
Prefer `{{rate:psa-rate}}` with `Name: psa-rate`. Existing shorthand such as
`{{psa-rate}}` also resolves when that name has a Rate Settings cell in the same
panel row. Unconfigured shorthand remains authored text.
`/phx/pros/apicontent/init/bankRates.json` is bundled **sample data**, not a live
bank-rates feed. Delivery pages need the approved live endpoint (the default when
Bank rates endpoint is omitted), or a verified same-origin proxy. Verify browser
access before using either. Fixed promotional APYs and their offer terms remain
authored; do not replace a promotional savings APY with a standard balance-tier APY.

Blank rows are skipped; extra content cells are combined. Rich text, tracking URLs,
inline links and superscripts remain authored. Standalone link paragraphs become
styled actions. Use stable disclosure IDs in `<sup>` when the page uses a disclosure
set; the footer resolves their displayed numbers.
Learn more links render as plain text actions. Application links such as Open an
account, Apply now and Get started render as outlines, including cards with only
one action. Include the panel H2 and both links where the live page has them.

The October 12, 2026 **Our Accounts** reference has seven categories, ending in
Cryptocurrency. Its account counts are 6, 3, 6, 2, 4, 4, 1. This page's Bank order
is Premium Savings Account, Certificates of Deposit, Max-Rate Checking, Line of
Credit. Do not reuse the Investment Choices page's six-category snapshot or Bank
order. Maintain the account panels in DA.
