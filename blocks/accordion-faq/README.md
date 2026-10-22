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

The decorator moves that adjacent heading and link into the component to style them. Heading text, heading ID, link text, URL, and tracking parameters remain authored. Unrelated paragraphs and images stay outside the component. The imported homepage's explicit 1×1 tracking images alongside its action are retained in a decorative element without affecting layout. The component's surface and spacing are scoped to `.accordion-faq`; shared design values come from `styles/brand.css`.

## Flat variant

Use **Accordion FAQ (Flat)** for the divided-row layout: a white surface, a centered 2rem heading (32px at the default root size), flat rows with thin bottom dividers, 1.25rem medium-weight question labels, and purple plus/minus controls on the right. The default **Accordion FAQ** keeps the homepage's rounded gray rows and left chevrons. Choose the variant from the reference layout. Flat supports rich-text answers and native HTML tables for any subject. Tables retain their semantics and get a labeled, keyboard-focusable horizontal scroll region for narrow screens.

Content authored as **Accordion FAQ (Pricing)** remains supported as a legacy alias. The decorator adds the `flat` class so existing content uses the same styles and behavior. Use **Flat** for new or updated content.

### Pricing and Rates example

Place Heading 2 **Detailed pricing** immediately before the block, preserving its `detailed-pricing` anchor. Author one category per row, with its complete rich-text answer in the second cell. Keep fee tables inside the answer as native HTML tables with column/row headers, `scope`, merged cells and all explanatory copy. Do not promote fee-table headings such as Pricing, Debit balance or Paper statement fee into separate block names.

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

Review the variant after saving and previewing content: https://demo--etrade--AdobeDrago.aem.page/what-we-offer/pricing-and-rates#detailed-pricing

## Behavior and accessibility

- All answers start collapsed. Opening one question closes the others, matching production. Closing a question leaves any other answers open.
- Expand all opens every answer; Collapse all closes them. The all-control label and `aria-expanded` update after individual interactions too. Mixed states show Expand all.
- Native buttons support Enter and Space. Questions are headings one level below the section heading (Heading 3 when no section heading is present).
- Each button controls a uniquely identified answer region. Closed answers are immediately `inert` and `aria-hidden`, so their links are excluded from keyboard navigation and screen-reader output during the closing animation.
- Shared motion tokens retain the 300ms grid reveal and existing fade timing by default. The default FAQ rotates its chevron; Flat switches between plus and minus. Reduced-motion preferences remove these transitions.
- Below 768px, the default FAQ uses tighter row spacing and mobile type sizes. Flat retains its flat rows and scrolls wide tables inside the answer. Long labels wrap without displacing their icon.
- Visible focus outlines and underlined answer links on hover/focus support keyboard use.

Content publishes separately from code.

## Shared design tokens

Both variants consume the shared semantic colors, font sizes and weights, spacing, container widths, radii, focus and motion tokens. Text sizes and content spacing scale with the browser's root font size, and unitless line heights keep pace with the text. The default heading follows the responsive section-heading role; Flat retains its distinct 2rem heading. Small negative letter spacing uses `--tracking-tight`, equivalent to -0.25px at the default 16px root size.

Flat uses the shared primary text, border and action colors in place of its former separate gray and purple values. The block retains its own light surface and readable headings, paragraphs and ordinary links when placed inside a dark section. Its CTA keeps white text on hover.

The local `--accordion-faq-*` spacing variables preserve the reference's question padding, answer padding, paragraph rhythm and action separation. Remaining uncommon rem values are component measurements, not additions to the global spacing scale. The existing `--faq-gutter-offset` hook and layout breakpoints remain supported. Expand/collapse behavior and authored content are preserved.

### Page families

The standard accordion also consumes the `--accordion-faq-item-*` theme roles in `styles/themes.css`. **Purple** uses deep-purple question/answer cards, light text and links, a light focus ring, and smaller corners. **Charcoal** uses the existing light-gray cards, dark text, purple links and rounded corners. Changing the page family or library preview updates these colors immediately and preserves open answers. Flat and its Pricing alias retain their light divided rows in both page families. Pages without a selected family retain the existing default treatment.

## Authored section controls

Both variants support the shared Section Metadata controls. In an authored section, the accordion fills its wrapper or grid cell, and its light surface stays within the block. Its legacy full-width background effect and Flat section resets apply only to sections without the new controls. The section's selected container, background and responsive grid remain in control of the outer layout.

When **Spacing** is specified, section padding supplies the outer top and bottom space, including `none`; the accordion removes its own outer vertical padding. Question padding, answer spacing and all interaction styling remain local to the block. A section **Gap** separates whole blocks in a grid and keeps the accordion's internal row spacing intact.

In a section **Grid**, the authored section heading, introduction and standalone action stay outside individual accordions so they can span all columns. Question headings remain one level below the nearest preceding section heading. Outside grids, the existing behavior of moving the adjacent heading and action into the accordion is preserved.

Both variants retain their own light surface, primary text and purple links inside dark, colored, gradient or image sections. They also use a light native color scheme for controls and table scroll regions. The section's theme continues to control surrounding default content.

## Validation

Run `npm run test:accordion` for semantic-table preservation, omitted cells, panel controls and default FAQ regression checks. Run `npm run lint` before committing.

In a browser, review both variants below and above 768px and 900px, including expanded answers, keyboard focus, a dark surrounding section, long labels and 200% text sizing. Also review narrow/full containers, section backgrounds, `Spacing: none` and multi-block grids with shared headings and actions. Flat answer tables should scroll within their labeled region without widening the page. Confirm exclusive opening, Expand all / Collapse all, plus/minus or chevron states and reduced-motion behavior.

## Migration review

This component is migrated on `et-accordion-faq`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-accordion-faq--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
