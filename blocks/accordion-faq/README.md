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

## Behavior and accessibility

- All answers start collapsed. Opening one question closes the others, matching production. Closing a question leaves any other answers open.
- Expand all opens every answer; Collapse all closes them. The all-control label and `aria-expanded` update after individual interactions too. Mixed states show Expand all.
- Native buttons support Enter and Space. Questions are headings one level below the section heading (Heading 3 when no section heading is present).
- Each button controls a uniquely identified answer region. Closed answers are immediately `inert` and `aria-hidden`, so their links are excluded from keyboard navigation and screen-reader output during the closing animation.
- The 300ms grid reveal, fade, and chevron rotation follow production timing. Reduced-motion preferences remove these transitions.
- Below 768px, tighter row spacing and padding accompany the mobile heading, answer text, and action sizes. Long questions wrap and keep their chevron aligned beside the label.
- Visible focus outlines and underlined answer links on hover/focus support keyboard use.

No variations or identity-service integration are required. Content publishes separately from code.

## Migration review

This component is migrated on `et-accordion-faq`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-accordion-faq--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
