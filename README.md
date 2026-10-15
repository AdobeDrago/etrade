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
| `--space-*`, `--layout-*` | Spacing scale, containers, gutters, grid gaps, section spacing and header reserve |
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

## Authoring and regression tests

Author content directly in DA using the table structures and variants documented in each block's README. Save, preview and publish content separately from code. Dynamic bank-rate settings are documented in [Cards Product](blocks/cards-product/README.md#optional-dynamic-rates); campaign claims and their disclosures must be updated together.

Page and block examples used by regression tests live in `test/fixtures/`. Run `npm run test:blocks` and `npm run test:rates` to check them. For browser rate checks, run `npm run demo:rates` with the AEM proxy on port 3000, then open http://127.0.0.1:3020/test/card-rates.html.
