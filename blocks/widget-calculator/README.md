# Widget Calculator

A brokerage funding offer with an authored promo card and an interactive cash-credit card. No account session or external calculator service is required.

## Authoring

Use a two-column **Widget Calculator** block table. Optional named rows hold the promo content and labels; numeric rows define the funding tiers.

| Widget Calculator | |
| --- | --- |
| Heading | Adjust your funding and watch your bonus increase |
| Description | Offer eligibility and funding requirements. |
| Promo code | Promo code: OFFER26 |
| Primary CTA | [Open an account](https://express.etrade.com/etx/rtao/ma/account-types/brokerage) |
| Secondary CTA | [Learn more](https://us.etrade.com/promo/brokerage) |
| Funding label | Deposit amount* |
| Credit label | Cash credit |
| Select label | Funding amount |
| Disclaimer | Funding disclosure text. |
| $1,000 | $50 |
| $5,000 | $150 |
| $20,000 | $300 |

The example tiers are illustrative; author all tiers that apply to the offer. Funding and credit cells accept whole-dollar amounts with optional dollar signs and commas. An explicit `$0` credit is valid. Tiers are sorted by funding; if a funding amount is repeated, the last valid row wins. Extra cells and unknown configuration rows are ignored.

Only the tier rows are required. Omitting all promo content produces a standalone calculator. Omit either CTA independently. Description, promo code, and disclaimer preserve authored inline formatting; links preserve their destinations and tracking parameters. The secondary-link arrow is supplied by the block.

## Existing home-page content

The current imported home page has a legacy table:

1. First row: deposit label and cash-credit label.
2. Second row: disclosure text, with an empty second cell.
3. Remaining rows: funding thresholds, with empty cash-credit cells.

The block supports this format. When the table has no `Heading` row, it uses the immediately preceding H3/H4 and its following copy, promo-code paragraph, and two links as the promo card. Explicit named rows take precedence over the corresponding legacy copy or link. The preceding H2 and introduction become the section heading. This compatibility path moves existing authored content; it does not replace its text or URLs.

Empty credit cells use the matching funding amount from `tiers.json`. This local snapshot was verified against the production home-page calculator on October 5, 2026. Authored credit amounts always take precedence. A tier with an invalid credit or no matching fallback is omitted; if no valid tiers remain, the original markup is preserved. Update authored tiers for a new offer rather than relying on the fallback snapshot.

## Responsive behavior and accessibility

- Below 768px: stacked cards, labels above their values, and a custom funding-range combobox with a scrollable listbox.
- From 768px: a native slider, horizontal values, and inline promo links.
- From 992px: paired cards with the calculator's notch pointing toward the promo card.

The slider steps through the authored thresholds, followed by a final `+` position for the highest tier. Dropdown options represent the ranges between thresholds. Both controls share the same funding and credit state. Switching to mobile at the highest threshold selects its open-ended `+` range.

Controls have visible keyboard focus, associated labels, unique IDs, and disclosure descriptions when supplied. Slider value text includes the deposit and credit; dropdown changes also announce both values through a status region. The combobox supports Arrow keys, Home/End, number typeahead, Enter/Space to select, Escape to cancel, and Tab to select and move on. Clicking outside closes the popup. Keyboard focus stays on the combobox, with its active option exposed through `aria-activedescendant`. The hidden control is removed from keyboard navigation by its responsive display rule. Focus-strip motion respects reduced-motion preferences.

No block variations or Universal Editor model are required; this project uses Document Authoring.

## Migration review

This component is migrated on `et-widget-calculator`. Review its changes against `et-actions`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-widget-calculator--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
