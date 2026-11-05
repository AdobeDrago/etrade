# Lint guardrails

Run `npm run check` before opening a pull request. All new tooling is development-only; EDS still serves native browser modules without a build step.

## CSS

Stylelint covers CSS in `blocks/`, `styles/`, `tools/` and `docs/`.

- Font sizes and font shorthands, letter spacing, margins, padding and gaps reject `px`. Existing spacing/typography custom-property families are checked too, including local properties ending in `-gap`, `-padding`, `-margin` or `-spacing`.
- Use existing typography and spacing tokens when the values and purpose match. Scalable local values, percentages, `auto`, `clamp()` and intrinsic layout values remain available.
- Line heights reject physical and relative length units and percentages; use a unitless number, unitless `calc()`, a unitless token or `normal`.
- Borders, outlines, chart/artwork coordinates, container limits and viewport media queries may retain physical pixels. Arbitrary custom properties are not type-checked: authors must preserve the unit contract of values passed through them.
- Site colors in block/shared styles come from `brand.css` or `themes.css`. Direct hex/named colors and color-constructor functions are rejected elsewhere. `transparent`, `currentcolor`, gradients using tokens, color mixing and embedded assets remain valid. The shared foundation preserves existing library/FAQ colors rather than substituting nearby brand shades.
- Standalone tools and documentation own their palettes because they do not load site tokens; scalable unit rules still apply.
- Block selectors must name their owning block, wrapper or container. `:has()` section integration and positive `:is()`/`:where()` branches are supported. A class mentioned only inside `:not()` does not establish ownership. Keyframes are exempt. Shared shell and inline disclosure reference styles live in `styles/styles.css`.
- ID selectors are prohibited; keep HTML IDs for semantics/JS and style classes or attributes. Selector specificity is capped at `0,10,5`, accommodating current section integrations while preventing further unrestricted escalation.
- `!important` is prohibited except narrowly documented suppressions. Existing exceptions ensure native hidden state wins against component display rules, and allow the full filtered catalog to print. Stylelint rejects invalid, unnecessary and descriptionless suppressions.

The selector parser in `tools/lint/block-scope.mjs` implements project ownership. `tools/lint/unitless-line-height.mjs` checks line heights in longhands and font shorthands; other rules use Stylelint's standard checks. Lint cannot prove visual correctness, accessible contrast, defensive handling of authored cells or the semantic purpose of a chosen token. Existing behavior tests and browser review remain required.

## JavaScript and repository checks

ESLint keeps the Airbnb base and recognizes explicit `.js`, `.mjs` and `.cjs` imports. Warnings and unused suppressions fail checks. Source files in a block may import its own helpers, shared `/scripts/` modules and Fragment, with other block imports and bare runtime package imports rejected.

The current import restrictions apply to static import/re-export declarations. Dynamic widget loading remains supported; computed dynamic imports require review.

`scripts/aem.js` is excluded from autofix and protected by its recorded SHA-256 checksum. Updating that checksum is an explicit, separately reviewed vendor change. Generated importer bundles and demo performance assets remain outside source lint; hand-maintained importer parsers have unused suppressions removed.

Repository checks inspect tracked and unignored local files, or the Git index with `--staged`. They reject unresolved conflict markers, runtime dependencies and common local/generated artifacts. A staged vendor deletion is also rejected. This check is not a secret scanner.

## Local hooks and CI

`npm ci` installs Husky hooks. Pre-commit runs index repository checks unconditionally, including deletion-only commits, then ESLint/Stylelint on staged source through lint-staged. The commit-msg hook runs commitlint. lint-staged protects partial staging; the tasks do not autofix. Configuration/tooling/package changes trigger full lint. Explicit full checks inspect the current working tree and always verify the vendored runtime's presence.

CI runs full lint/tests and commit-message checks for pushes and pull requests. PR titles must follow Conventional Commits, with a nonempty subject and a header of at most 100 characters. PR descriptions must include an HTTPS URL for the actual branch under `--etrade--AdobeDrago.aem.page`, with slash branches normalized to hostname form. This verifies the URL's structure, not remote availability or the visual result.

`test/git-hooks.test.js` exercises real hooks in a disposable repository, including invalid commit messages, filenames with spaces and partially staged CSS. Rule tests verify rejected and accepted input rather than matching configuration text.

GitHub branch protection is configured outside the repository. Make the workflow's `build` job required before merging to protected branches. Hooks provide early feedback; required CI provides merge enforcement.
