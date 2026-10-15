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

Keep layout and variants scoped to the owning block. Choose inverse text/link roles for dark surfaces and matching text roles for cards with their own surfaces. Component variables can refer to semantic tokens where a variant needs an override. Native custom properties cannot be used in media-query conditions; shared responsive tokens retain the current 768px, 900px and 1085px transitions, while other block breakpoints stay with their layouts. This foundation does not yet migrate block literals or change font loading.

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

Page and block examples used by regression tests live in `test/fixtures/`. Run `npm run test:blocks` and `npm run test:rates` to check them. For browser rate checks, run `npm run demo:rates` with the AEM proxy on port 3000, then open http://127.0.0.1:3020/test/card-rates.html.
