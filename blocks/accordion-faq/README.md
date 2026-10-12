# Accordion FAQ

Responsive FAQ accordion styled to match the E*TRADE homepage: light surface, rounded gray question rows, left chevrons, expandable rich-text answers, and an Expand all / Collapse all control.

## Authoring in DA

Use one two-column **Accordion FAQ** table. Each row is one question and answer:

| Accordion FAQ | |
| --- | --- |
| Your question | Your rich-text answer. |
| Another question | Another answer, including optional headings, paragraphs, lists, images, and links. |

Questions are rendered as plain-text labels. Answers retain authored formatting and destinations. Additional answer cells are combined in order. Rows without a question, an answer cell, or answer content are skipped safely. No questions, answers, offer amounts, or links are supplied by the block.

For the complete homepage treatment, author in its own section:

1. A heading immediately before the block (normally Heading 2).
2. The Accordion FAQ table.
3. An optional paragraph immediately after the table containing one standalone link, such as the authored See all FAQs link.

The decorator moves that adjacent heading and link into the component to style them. Heading text, heading ID, link text, URL, and tracking parameters remain authored. Unrelated paragraphs and images stay outside the component. The imported homepage's explicit 1×1 tracking images alongside its action are retained in a decorative element without affecting layout. The component's surface and spacing are scoped to `.accordion-faq`; no global styles or vendored scripts are modified.

## Pricing and Rates variant

Use **Accordion FAQ (Pricing)** for Detailed pricing. This supported variant matches the live Pricing and Rates treatment: a white surface, a centered 32px heading, flat rows with thin bottom dividers, 20px medium-weight category labels, and purple plus/minus controls on the right. The default **Accordion FAQ** keeps the homepage's rounded gray rows and left chevrons. Choose the table variant from the actual reference section; the shared block name alone does not establish the visual treatment.

Place Heading 2 **Detailed pricing** immediately before the block, preserving its `detailed-pricing` anchor. Author one category per row, with its complete rich-text answer in the second cell. Keep fee tables inside the answer as native HTML tables with column/row headers, `scope`, merged cells and all explanatory copy. Do not promote fee-table headings such as Pricing, Debit balance or Paper statement fee into separate block names. Tables retain their semantics and get a labeled, keyboard-focusable horizontal scroll region for narrow screens.

The live page checked on October 12, 2026 has these 12 categories in order:

1. Stock and options trades
2. Exchange-traded funds (ETFs)
3. Bonds and CDs
4. Futures
5. Mutual funds
6. Cryptocurrency
7. Margin rates
8. Managed Portfolios
9. Premium Savings Account
10. Max-Rate Checking
11. Certificates of Deposit (CD)
12. Other fees

The current preview has nine simplified answers. Besides applying the variant, restore missing categories and full fee tables from the live reference. Keep bank-rate bindings and stable disclosure IDs; do not replace them with guessed rates or displayed footnote numbers. Expand all, exclusive individual opening, native buttons and accessibility behavior are shared by both variants.

Authoring prompt: [Pricing and Rates](../../docs/pricing-and-rates-authoring-prompt.txt). Local visual review: `/docs/pricing-accordion-review.html`.

## Behavior and accessibility

- All answers start collapsed. Opening one question closes the others, matching production. Closing a question leaves any other answers open.
- Expand all opens every answer; Collapse all closes them. The all-control label and `aria-expanded` update after individual interactions too. Mixed states show Expand all.
- Native buttons support Enter and Space. Questions are headings one level below the section heading (Heading 3 when no section heading is present).
- Each button controls a uniquely identified answer region. Closed answers are immediately `inert` and `aria-hidden`, so their links are excluded from keyboard navigation and screen-reader output during the closing animation.
- The 300ms grid reveal and fade follow production timing. The default FAQ rotates its chevron; Pricing switches between plus and minus. Reduced-motion preferences remove these transitions.
- Below 768px, the default FAQ uses tighter row spacing and mobile type sizes. Pricing retains its flat rows and scrolls wide fee tables inside the answer. Long labels wrap without displacing their icon.
- Visible focus outlines and underlined answer links on hover/focus support keyboard use.

Content publishes separately from code.

## Validation

Run `npm run test:accordion` for semantic-table preservation, omitted cells, panel controls and default FAQ regression checks. Run `npm run lint` before committing.

## Migration review

This component is migrated on `et-accordion-faq`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-accordion-faq--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
