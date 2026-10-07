# Floating dock

Fixed account navigation matching the dock on https://us.etrade.com/home.
Use one block per page. Desktop shows the offer, log-on link, and account CTA;
below 768px, the CTA stays visible and a circular disclosure opens the other links.

## Authoring

Create a **Floating Dock** table. Each row has an action type and a labelled link:

| Floating Dock | |
| --- | --- |
| offer | [Limited time offer](https://us.etrade.com/promo/savings) |
| login | [Log on](https://us.etrade.com/etx/pxy/login) |
| primary | [Open an account](https://express.etrade.com/etx/rtao/ma/account-category) |

The links, labels, and query parameters are author controlled. `offer` and `login`
add decorative tag and person icons; `primary` selects the purple CTA. Other types
become extra secondary links. Empty cells and unlabelled links are skipped.
Omitting an action is supported; a block without links renders nothing.
The first primary action wins; additional primary links remain secondary links.

A single row with three linked cells also works: the standard labels or imported
`local_offer` / `person` text identify the actions. Use explicit types for custom
labels or translated content. An `aria-label` on the block overrides the default
navigation landmark label, “Account quick links”.

The imported `/home` content is automatically converted before EDS section/block
decoration when the offer and following account link have their original
`stickyCTA_LTO` and `stickyCTA_openaccount` query parameters. No backend edit is
needed for that page; other pages should use the table above.

## Accessibility and responsive behavior

- Native links preserve authored destinations and open-in-new-tab behavior.
- The mobile disclosure is a named button with `aria-expanded` and `aria-controls`.
- Closed actions are hidden from both keyboard navigation and the accessibility tree.
- Opening the disclosure focuses its first link. Escape closes it and restores
  focus to the disclosure. Clicking outside or tabbing outside also closes it.
- Mobile targets are at least 44px high. Focus rings, reduced motion, forced colors,
  safe-area insets, text wrapping, and short viewport scrolling are supported.
- A spacer after the footer and a focus visibility check keep focused page links
  clear of the fixed dock.

## Local preview

Run `npx -y @adobe/aem-cli up --no-open`, then visit http://localhost:3000/home.
Content is served by EDS; block code and styling come from this checkout.

## Migration review

This component is included on `et-dock-rebuild`. Review its changes against `develop`; the required shared homepage layout helpers are included in this branch.

Preview: https://et-dock-rebuild--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
