# Your Project's Title...
Your project's description...

## Environments
- Preview: https://main--etrade--AdobeDrago.aem.page/
- Live: https://main--etrade--AdobeDrago.aem.live/

## Documentation

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `etrade` directory in your favorite IDE and start coding :)

## Shared design tokens

[`styles/brand.css`](styles/brand.css) is the global token source, loaded by [`styles/styles.css`](styles/styles.css). Its palette starts with the [brand reference](https://adobedrago.github.io/etrade/#brand) and preserves existing component colors. Link hover (`#451fad`) and primary-button hover (`#7852e0`) remain separate during migration; market status colors are existing component values, not additions to the official brand palette. Existing `--brand-*` and EDS variables remain available as compatibility aliases.

| Token family | Purpose |
| --- | --- |
| `--palette-*` | Base color values; prefer semantic colors in block rules |
| `--color-*` | Text, surfaces, borders, links, actions, focus, disabled and market status roles |
| `--font-*`, `--text-*`, `--line-height-*`, `--tracking-*` | Font families, weights, size scale, responsive text roles, line heights and letter spacing |
| `--space-*`, `--spacing-*`, `--layout-*` | Spacing scale, containers, gutters, grid gaps, section spacing and header reserve |
| `--radius-*`, `--border-width-*`, `--focus-ring-*`, `--shadow-*` | Shared shapes, strokes, keyboard focus and elevation |
| `--motion-*`, `--layer-*` | Transition timing, easing and shared stacking order |

Font-size and spacing suffixes describe pixel equivalents at the browser's default 16px root size: `--font-size-16` and `--space-16` are `1rem`. The site leaves the root font size unset. Line heights are unitless; thin strokes and the existing container/header measurements retain physical pixels. `--tracking-tight` supplies a shared value equivalent to `-0.25px` for later block migrations. Motion duration tokens become zero when reduced motion is requested; blocks must consume those tokens to inherit that behavior.

For example, a block can consume the foundation without importing another block's CSS:

```css
.example-block {
  padding: var(--space-24);
  border: var(--border-width-thin) solid var(--color-border-default);
  border-radius: var(--radius-card);
  background: var(--color-surface-default);
  color: var(--color-text-primary);
  font-size: var(--text-body-size);
  line-height: var(--line-height-copy);
}
```

Keep layout and variants scoped to the owning block. Choose inverse text/link roles for dark surfaces and matching text roles for cards with their own surfaces. Component variables can refer to semantic tokens where a variant needs an override. Native custom properties cannot be used in media-query conditions; shared responsive tokens retain the current 768px, 900px and 1085px transitions, while other block breakpoints stay with their layouts. All visual blocks consume the shared foundation. Fragment is a content loader with no visual stylesheet, and Widget is a minimal host whose loaded widget owns its styles. Font loading is unchanged.

## Page themes

Set page Metadata **Theme** to `Purple` or `Charcoal` to select a design family. These are project names for the two reference treatments, independent of a section's light/dark color scheme.

| Page Theme | Reference pages | Defaults |
| --- | --- | --- |
| `Purple` | [Platforms](https://us.etrade.com/platforms), [Pricing and Rates](https://us.etrade.com/what-we-offer/pricing-and-rates), [Welcome Back](https://us.etrade.com/home/welcome-back) | Light header, deep-purple inverse and campaign surfaces, light footer, small card corners |
| `Charcoal` | [Home](https://us.etrade.com/home), [Bank](https://us.etrade.com/bank) | Dark header, charcoal inverse surfaces and footer, rounded cards; campaign artwork and variants retain their own treatment |

[`styles/themes.css`](styles/themes.css) overrides semantic roles from the foundation. The deep purple (`#241056`) and light footer (`#eee`) are reference-page values. Shared typography, spacing, actions, focus and motion remain in `brand.css`; block layouts, artwork and responsive variants remain authored or block-owned. Selecting a family does not replace a block variant or campaign image, or guarantee a pixel match to every reference layout. Use artwork and logo assets appropriate to their surfaces.

The page theme resolves on the document root before the first section loads, so derived tokens and compatibility aliases follow the selected values. No URL-based or operating-system theme detection is used. Missing or unsupported values retain the existing mixed page treatment. Values are case insensitive; `theme-purple` and `theme-charcoal` aliases are accepted. With comma-separated values, the first recognized design family wins.

`Header Theme: light` or `dark` overrides the family default. Explicit Header block Light/Dark variants also retain precedence over the family default. Legacy `Theme: light` and `Theme: dark` continue to select the header scheme without selecting a page family. A legacy scheme combined with a family (for example, `Theme: Purple, dark`) overrides that family's default header scheme.

Within either family, use Section Metadata **Color Scheme: light** or **dark** for matching text, normal/hover links and native controls. A dark section uses the selected family's inverse surface; an explicitly authored background still takes precedence. Cards with their own light surfaces keep dark text and purple links inside dark sections.

Example page Metadata:

| Metadata | |
| --- | --- |
| Theme | Purple |
| Header Theme | dark |

This selects the Purple family with an explicit dark header. Section schemes remain independently authored. Run `node --experimental-vm-modules --test test/page-theme.test.js test/page-loading.test.js` for selection, precedence, compatibility and eager-loading checks. Browser review must also cover both families, header overrides, section schemes, owned card surfaces, hover/focus, narrow containers and enlarged text.

### Authoring rollout

Code changes and authored content must be tracked together. Theme support is implemented in this branch; the following DA updates are pending, and must be saved and previewed separately from code.

| Authoring update | When needed |
| --- | --- |
| Set page Metadata `Theme` to the family listed in the reference table above | Required to opt that page into the new theme system. Existing pages remain unchanged until selected. |
| Review `Header Theme` and explicit Header Light/Dark variants | Keep deliberate exceptions. Remove an override when the header should follow the page family. When replacing legacy `Theme: light` or `dark`, move that scheme to `Header Theme` if it should remain an explicit exception. |
| Supply matching Light/Dark brand images in `/nav` | Needed if a selected header scheme has no suitable authored logo. Use the existing Brand variants or `Header Logo Light` / `Header Logo Dark` metadata. Shared navigation changes affect every page using that fragment. |
| Review Footer Brand images and custom social artwork | Needed when an authored image has colors suited only to the previous surface. The bundled phone and social icons adapt in code; other authored images retain their colors. Use the existing `Footer` metadata to select a separate fragment when the two page families need different footer content. |
| Review campaign images, text baked into images, section backgrounds and explicit block variants | Change only content that conflicts with the intended family or needs a different layout. A page-theme change does not replace artwork or authored block variants. |

Existing block tables, copy, action formatting, links and rate settings do not need to be rewritten for the token migration. Section Metadata changes are needed only when intentionally changing a section's scheme, background, spacing, container or grid. Retain disclosure references, link tracking and image alternatives while making content changes.

Moving existing block layouts into their owning stylesheets requires no DA changes. Theme selection and asset reviews above remain separate authoring work.

The six saved-page fixtures currently contain header schemes but no Purple/Charcoal page-family selections. `/home` should opt into Charcoal and `/home/welcome-back` into Purple using the supplied references. Confirm the intended family for Our Accounts, Brokerage, Planning and Why E*TRADE before assigning it; header color alone does not identify a page family. These fixtures are saved examples, not confirmation of the current DA content. Re-preview the affected pages and shared fragments on the branch before publishing content.

## Shared component styles

Each block's stylesheet owns its wrapper container, surface roles, layout, variants and container queries. A block can reflow independently of the viewport without a global stylesheet listing its internal selectors. The migrated groups are:

| Group | Blocks |
| --- | --- |
| Navigation and page chrome | Header, Footer, Floating Dock |
| Heroes | Hero (including Wide), Hero Dark (including Split, Balanced and Inset), Hero Light, Hero Product, Welcome Hero |
| Content and offers | Banner Offer (including Light, Compact and Centered), Columns, Columns Feature (including Dark, Media First, Image Right, Band, Outline and Award), Carousel Story, Tabs Accounts |
| Market data | Market Ticker, Market Overview, Market Top Five |
| Supporting content | Disclosures, Separator, Widget Calculator, Widget and Fragment |

Colors, font families, weights, rem text sizes, unitless line heights, small negative tracking, spacing, focus, common radii, layers and motion use shared tokens. Existing campaign, calculator, navigation-overlay and chart-series colors extend the foundation; they are preserved reference values or consolidated existing shades, not additions to the official palette. Thin strokes, physical container limits, chart coordinates and decorative artwork can retain local dimensions. Font-face descriptors and embedded SVG artwork remain asset definitions.

Section wrappers establish an inline-size container. Below 38rem of available block width, multi-part heroes, feature columns, banners, market layouts and calculators stack; the calculator uses its existing dropdown. Tabs Accounts uses its existing category selector below 62rem of block width. Smaller containers also reduce card columns and bound inner padding. Viewport breakpoints still select the reference typography and other variant details. Container thresholds are rem based, so enlarged text reduces the number of side-by-side items. Carousel dots wrap; charts keep readable labels and scroll within their own plot when necessary, with the full observation table still available.

| Stylesheet | Ownership |
| --- | --- |
| `styles/brand.css`, `styles/themes.css` | Shared tokens and page-family values |
| `styles/styles.css` | Base elements, page composition, default section spacing and shared loading visibility |
| `styles/sections.css` | Authored section containers, grids, spacing, backgrounds and schemes |
| `styles/actions.css`, `styles/cards.css` | Common action controls and card-family roles, wrapping, focus and grid sizing |
| `blocks/{name}/{name}.css` | That block's section exceptions, wrapper container, surfaces, variant layouts, artwork and responsive rules |

Keep container queries beside their block's viewport rules. Establish the `block-layout` container on the block wrapper so the query can adapt the block itself. Scoped section exceptions belong in the owning block's stylesheet and must continue to defer to authored Section Metadata. Generic page spacing supplies defaults without enumerating blocks that have their own section layouts. Adding a block layout does not require a new entry in a global component stylesheet.

Light and dark components own matching foreground, link, hover and native-control roles. Transparent text intros follow their section's scheme; explicitly themed feature bands and awards keep a matching surface. Legacy dark sections inherit text and link roles rather than forcing every nested paragraph white. Explicit Section Metadata controls take precedence over legacy component section styling, including the standard container and spacing on non-homepage templates. Header bars can wrap with enlarged text, and dropdown/drawer height is measured from the available viewport space.

The migration retains authored claims, legal IDs, link targets, tracking, image alternatives, rate bindings, market requests and sign-in handoffs. PR 21's shared tracking and scalable typography feedback is applied throughout. Product rate documentation describes the implemented real-service contract and the explicit test endpoint; fixture success does not verify live-service access. Disclosure loading retains its logged, hidden failure behavior.

Run `npm run lint` and `node --experimental-vm-modules --test test/*.test.js` for the complete regression suite. Browser review should include every documented variant, the six saved page layouts, mobile and desktop breakpoints, light/dark themes, authored grids and containers, 200% text, keyboard navigation and enlarged controls. Local browser fixtures are separate from live content. Review pushed code and separately previewed content at [etrade-style /home](https://etrade-style--etrade--AdobeDrago.aem.page/home).

## Shared card styles

[`styles/cards.css`](styles/cards.css) supplies common text, copy, surface and link roles, keyboard focus, wrapping and grid sizing for all nine card blocks. [`styles/actions.css`](styles/actions.css) supplies their shared action controls. Block styles own artwork, accents and variant layouts. Most card headings use 1.5rem on mobile and 1.75rem on desktop; award titles, compact cards and other reference-specific treatments retain their own token sizes. Thin borders use the shared border color. Small negative letter spacing uses `--tracking-tight`, including the award values identified in PR 21.

| Block | Variants and maximum internal columns at the default text size |
| --- | --- |
| [Cards](blocks/cards/README.md) | Auto-fills the available width with cards at least 16.0625rem wide when space permits |
| [Cards Account](blocks/cards-account/README.md) | One column; up to two from 600px and three from 900px |
| [Cards Article](blocks/cards-article/README.md) | One column; up to three from 768px, or four for four-card content; Promo retains its image and content treatment |
| [Cards Award](blocks/cards-award/README.md) | One column; up to three from 768px |
| [Cards Icon](blocks/cards-icon/README.md) | One column; up to three from 768px; Planning includes dark offer cards; Tools uses up to four; Welcome Back uses up to two |
| [Cards Numbered](blocks/cards-numbered/README.md) | One column; up to three from 768px |
| [Cards Platform](blocks/cards-platform/README.md) | One column; up to two from 600px and three from 900px; two-card content stays at two; Compact retains full-width images |
| [Cards Pricing](blocks/cards-pricing/README.md) | One column; up to three from 768px; default, Text Links and Band |
| [Cards Product](blocks/cards-product/README.md) | One column; up to two from 768px, or three with Three Columns |

Column counts are caps. A block placed in a narrow section grid uses fewer internal columns as needed. The shared minimum is `--layout-card-min` (14rem); four-card articles and icon tools use 10rem. Enlarged text increases those minimums, text wraps and cards grow vertically. Promo article content stays in normal flow over its artwork, so longer copy does not escape a fixed overlay. Welcome Back stacks its icon and copy when the block is narrow.

Cards with white surfaces keep dark copy and purple links in dark sections. Transparent award cards follow the section theme; icon offers and pricing bands use their own inverse roles. The pricing band's blue and cyan are preserved reference colors, exposed through feature tokens rather than added to the official brand palette. Opting into Section Metadata lets the section own its container, spacing, background and introduction alignment; legacy card-specific section styling applies only without those controls.

Account cards use the shared outline and secondary actions. Inline links, destinations, tracking, image alternatives, rich copy, legal references and configured rate bindings remain authored. Missing rows are skipped. Product, account and pricing cards retain API/manual/hybrid rates, valid zero values and unavailable-rate placeholders; sample responses are for testing.

Run `npm run test:cards` and `npm run lint`. Browser review should cover the variants above, 320px through desktop, dark sections, narrow/full containers, section grids, 200% text, keyboard focus and missing or extra cells. The branch preview is [etrade-style /home](https://etrade-style--etrade--AdobeDrago.aem.page/home); preview content is managed separately from code.

## Flexible section authoring

Add a **Section Metadata** table in the section you want to configure. Omitted options retain the existing page and block layout. These controls use E*TRADE tokens and the flexible-section approach from the [Signet Author Kit](https://github.com/AdobeDevXSC/signet-author-kit#flexible-section-authoring).

| Section Metadata | |
| --- | --- |
| Container | standard |
| Grid | 3 |
| Gap | m |
| Spacing | l |
| Background | subtle |
| Color Scheme | light |

| Field | Supported values and behavior |
| --- | --- |
| Container | `narrow` (800px maximum), `standard` (1200px maximum), `full` (full width without side gutters). Constrained widths include the shared responsive side gutters. |
| Grid | `1`–`6` whole blocks per row on desktop. Below 768px every grid stacks; from 768px it uses up to two columns; from 1200px it uses the selected count. Default content spans all columns. Each block retains its own internal layout. |
| Gap | `none`, `xs`, `s`, `m`, `l`, `xl`, `xxl`. Sets spacing between grid cells. The default grid gap uses `--layout-grid-gap`. |
| Spacing | The same named sizes. Applies top and bottom section padding, replacing outer vertical margins. `none` removes both. |
| Color Scheme | `light` or `dark`. Sets section text, default-content links, inherited action colors and the default surface. Blocks retain ownership of their own surfaces and explicit text colors. |
| Background | `default`, `page`, `subtle`, `inverse`, `inverse-raised`, `highlight`; a CSS color; a `--color-*`, `--palette-*` or `--brand-*` token (optionally wrapped in `var(...)`); a CSS gradient; or an authored image. Named surfaces choose a matching scheme unless Color Scheme is specified. |
| Background Color / Background Image | Optional separate fields for combining a solid background with an authored image. Image fields accept native images and pictures, preserving responsive sources. |
| Align | `left`, `center`, `right` for default content. |
| Anchor / ID | Optional section deep-link ID, with or without a leading `#`. |
| Style | Existing section classes remain supported. Optional aliases include `container-narrow`, `container-standard`, `container-full`, `grid-1`–`grid-6`, `gap-m`, `spacing-l`, `light-scheme`, `dark-scheme` and `center`. |

The named spacing scale maps to shared rem tokens. These are the pixel equivalents at a 16px browser default:

| Size | Grid gap | Top padding | Bottom padding |
| --- | ---: | ---: | ---: |
| none | 0 | 0 | 0 |
| xs | 4 | 8 | 8 |
| s | 8 | 16 | 16 |
| m | 12 | 24 | 24 |
| l | 24 | 48 | 48 |
| xl | 32 | 64 | 64 |
| xxl | 48 | 96 | 96 |

For custom colors, gradients and images, choose a Color Scheme that makes the foreground readable. Background images are decorative; put meaningful images in block content. The first section's background image loads eagerly; later section backgrounds load lazily. Grid controls apply to ordinary content sections; keep decorative separators and floating overlays in their own sections.

The shared helper consumes metadata before block initialization without moving block wrappers. It also runs for decorated fragments. Place a Fragment block in its own section to retain the fragment's section options; fragments sharing a section follow the existing behavior of flattening content into their parent section. Missing cells, unsupported options and unknown fields are ignored, and configuration tables are removed from rendered content. Repeated decoration does not duplicate backgrounds. Existing pages without these options keep their current styles.

Run `npm run test:sections` for authoring, page-layout and loading checks. Browser verification should cover all grid counts, each spacing size, constrained and full-width containers, themes, background colors/gradients/images, keyboard focus and enlarged text. The live preview for this branch is [etrade-style /home](https://etrade-style--etrade--AdobeDrago.aem.page/home); authored content must be saved and previewed separately.

## Authoring and regression tests

Author content directly in DA using the table structures and variants documented in each block's README. Save, preview and publish content separately from code. Dynamic bank-rate settings are documented in [Cards Product](blocks/cards-product/README.md#optional-dynamic-rates); campaign claims and their disclosures must be updated together.

Page and block examples used by regression tests live in `test/fixtures/`. Run `npm run test:blocks` and `npm run test:cards` to check them, or `npm run test:rates` for rate checks alone. For browser rate checks, run `npm run demo:rates` with the AEM proxy on port 3000, then open http://127.0.0.1:3020/test/card-rates.html.
