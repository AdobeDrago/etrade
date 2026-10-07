# Hero Dark

A dark hero with an authored heading, supporting copy, CTA links, and image. The homepage places the heading and supporting copy side by side above full-width media on desktop.

## Authoring

Use a **Hero Dark** table. Put the image, heading, supporting paragraphs, and standalone CTA links in its cells. Both a single content cell and separate image/copy rows are supported; row and cell counts are not fixed.

| Hero Dark |
| --- |
| Image with authored alternative text |
| H1: Access to IPOs starts here |
| See IPO opportunities with an eligible E*TRADE from Morgan Stanley account. |
| [Open an account](https://express.etrade.com/etx/rtao/ma/account-types/brokerage) |
| [Learn more](https://us.etrade.com/what-we-offer/investment-choices/new-issues) |

The first standalone link becomes the primary button; later standalone links become secondary links with a decorative arrow. Links within supporting paragraphs stay inline. Link destinations, query parameters, authored inline formatting, heading IDs, and image alternative text are preserved. An imported `arrow_forward` icon token is removed from CTA text and titles.

The first image and first H1/H2/H3 provide the hero media and title. Authors can omit the image, copy, links, or heading; the remaining content stays usable. A missing image leaves a solid dark surface. Use an H1 for the page's main title and H2/H3 when reusing the block farther down a page. Keep the image in its own paragraph or cell. When the image has its own cell without a heading or CTA, any accompanying text becomes its caption beneath the image. Campaign headlines, imagery, rates, disclosures, and link destinations belong in this authored table.

## Layout and accessibility

- Below 768px: centered 36px heading and supporting copy, a two-column CTA row with mobile button sizes, then the full-width image.
- From 768px: left-aligned stacked content, a 48px heading, and compact desktop CTA sizes.
- From 992px: the heading spans six columns, followed by a one-column gap and five columns of supporting copy and CTAs. Both are vertically centered above the full-width image. No content overlays the media.

The container is capped at 1200px, with 20px outer gutters on mobile and 10px from 768px. Caption text remains below the media at every size.

Reading order is heading, copy, CTA links, then image at every breakpoint. Links have visible keyboard focus and retain native link semantics. The arrow is decorative; no icon token enters the accessible link name. Image dimensions and responsive sources are preserved. A hero in the first section uses eager image loading and high fetch priority; later hero images retain their authored loading behavior.

The block supplies its dark component surface regardless of the surrounding page theme. The imported homepage's isolated plain-text `Home` breadcrumb is hidden; other surrounding content remains visible.

No Universal Editor model is required; this project uses Document Authoring.

## Migration review

This component is migrated on `et-hero`. Review its changes against `et-actions`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-hero--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
