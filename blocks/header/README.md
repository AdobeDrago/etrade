# Header

The global EDS header block loads `/nav` as a fragment. Set page metadata `nav` to a different local fragment path to override it. `/content/nav` is a fallback for older content setups. Header behavior and styling live entirely in this block; no auto-block or vendored script changes are required.

## Theme

Set page Metadata `Theme: light` or `Theme: dark` to choose the header palette. `Header Theme: light` or `Header Theme: dark` overrides that choice for the header only. Values are case insensitive; `theme-light` / `theme-dark` aliases are also supported. Missing or unsupported values retain the existing dark header default.

Both the outer strip and rounded bar use the selected palette, including menus, search, and focus styles. In the new format, logo variants come from the Brand section of `/nav` without image-filename recognition or automatic asset substitution. Optional `Header Logo Light` and `Header Logo Dark` page metadata override the selected image without changing its authored link or alternative text.

Example page Metadata:

| Metadata | |
| --- | --- |
| Theme | dark |
| Header Theme | light |

This gives the header a light palette. Color styles for the rest of the page and component theme inheritance are deferred; this change is scoped to the header.

## Authoring

Use four sections, separated with horizontal rules:

1. **Utility links:** a bulleted list. An item with a nested list becomes a Customer Service style disclosure. Identify the login action with a first paragraph containing `Login`, followed by a paragraph containing its link. The marker is not rendered. That link appears beside search on mobile, regardless of its destination. Omit the marked item to omit the mobile login action.
2. **Brand:** a bulleted list of theme variants. Each item starts with a paragraph containing `Dark` or `Light`, followed by its linked logo image. Images, destinations, and alternative text are authored independently. A single linked image is also supported as a fallback; if a variant is missing, the first available authored logo is used.
3. **Main navigation:** a bulleted list. Plain links navigate directly. An item with a nested list opens a panel.
4. **Account action:** a link, normally “Open an account”. It appears in the desktop bar and inside the mobile drawer. Omit the link to omit the action.

For explicit mega-menu columns, nest each column one level deeper. Start each column item with a `Column` paragraph. Put its heading link and optional italic description in the next paragraph, and its links in a child list. The marker is not rendered. A heading without children still creates a separate column; neither labels nor destinations determine grouping:

```html
<ul>
  <li>
    <p>Trading &amp; Investing</p>
    <ul>
      <li>
        <p>Column</p>
        <p><a href="/what-we-offer/our-accounts">Accounts</a><br>
          <em>Your authored description.</em></p>
        <ul>
          <li><a href="/what-we-offer/our-accounts/brokerage-account">Brokerage</a></li>
          <li><a href="/what-we-offer/our-accounts/retirement">Retirement</a></li>
        </ul>
      </li>
      <li>
        <p>Column</p>
        <p><a href="/what-we-offer/investment-choices">Products</a></p>
        <ul><li><a href="/what-we-offer/investment-choices/stocks">Stocks</a></li></ul>
      </li>
    </ul>
  </li>
</ul>
```

An italic description under a child link appears as smaller supporting text on desktop. Nested column lists without markers remain supported when at least one column has children.

Author a promo as another item alongside the columns, with separate paragraphs for its role, image, bold headline, plain description, and CTA link:

```html
<li>
  <p>Promo</p>
  <p><picture><img src="/media_offer.jpg" alt="Your image description"></picture></p>
  <p><strong>Your offer headline</strong></p>
  <p>Your offer description and terms.</p>
  <p><a href="/your-offer">Explore the offer</a></p>
</li>
```

The CTA text and destination are preserved. The CTA text is excluded from the description. Images, headlines, descriptions, and CTAs are optional; an empty promo is skipped. Promo cards and descriptions are omitted from the mobile drill-down. The image's authored alternative text is preserved; use empty alt text for a decorative image. `Login`, `Column`, `Promo`, `Light`, and `Dark` markers are case insensitive.

Logo image references can point to the existing SVG assets in `/icons/` and remain editable content. When migrating `/nav`, retain its previewed media or replace it with equivalent DA assets.

The shared DA document has not yet been migrated because authoring access is unavailable. A temporary compatibility path preserves its imported flat-list grouping, login URL detection, single standard logo's theme substitution, and image-wrapped promo links with their existing “Learn how” label. These fallbacks are used only for the old format; authored variants, columns, login roles, and CTAs do not use them. Remove the compatibility path after replacing and previewing `/nav` in DA. The four-section order remains the existing authoring contract; preserve empty sections when omitting an entire role.

## Behavior

- Below 1085px: logo, Log on, search, and menu button; opening the menu shows a scrollable drawer with Back navigation.
- From 1085px: utility row, rounded navigation bar, and one open mega menu at a time.
- Desktop panels with three or more link columns span the bar. Panels with one or two link columns use the compact production width, reserving two link-column slots before the promo. Column widths and gaps follow the production desktop breakpoints; panels remain within the available header width. Dropdown links underline on hover and keyboard focus.
- Native buttons expose `aria-expanded` and `aria-controls`. Closed panels are immediately `inert` and `aria-hidden`; mobile panels also use `hidden`. Enter/Space activate buttons, Arrow Down enters a desktop panel, Escape closes the current view and returns focus, and clicking or tabbing outside closes it.
- Desktop dropdowns match production's 300ms ease fade, 10px slide, height reveal, and arrow rotation. Closing reverses the motion while immediately disabling the panel's links. The mobile drawer slides in from the right over 400ms and closes immediately, matching production. Reduced-motion preferences disable these animations.
- Search submits `q` to `https://us.etrade.com/search`, matching the public site. Set `search-action` page metadata to change the endpoint. Live symbol autocomplete requires E*TRADE's search service and is not implemented here.
- Opening desktop search replaces the navigation links while keeping the logo and account action in place. On mobile, search replaces the logo and Log on to use the available width; the menu button stays visible. Escape or clicking outside closes search; mobile also has a Close search button. Local SVG search, close, and chevron icons match production sizing without an icon-font dependency.
- This is a public/prospect header. It does not infer login state from cookies or create an authenticated navigation experience. Those require an explicit identity integration and authored signed-in content.

The current `/nav` fragment has fewer links/descriptions and different promotion copy than the live header. Author those changes in content for full menu-copy parity; the block never hardcodes offer amounts or terms.

## Sandbox link destinations

Optional page Metadata `Nav Link Base` accepts an HTTP(S) URL. Root-relative navigation links resolve against that authored base, while the `/home` brand link stays on the current site. For this sandbox homepage, use `https://us.etrade.com` until the destination pages exist locally. Absolute links and tracking parameters are retained. Omit this metadata to keep normal local navigation.

## Migration review

This component is migrated on `et-header`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-header--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
