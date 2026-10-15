# Separator

An authored decorative divider matching the rounded stepped line on the E*TRADE homepage. The block name is **Separator**, so the delivered markup is `.separator`.

## Authoring

Put the block in its own section between the two content sections, with a section break (`---`) before and after the table. Use two columns for setting names and values. Rows can be reordered or omitted; unknown rows and extra cells are ignored.

| Separator | |
| --- | --- |
| First section color | #121213 |
| Second section color | #fafafa |
| Line break location | 50% |
| Height | 81px |
| Mobile height | 45px |

The four main settings are:

- **First section color:** color above the line, continuing down its right side. Default: `#121213`.
- **Second section color:** color below the line, beginning on its left side. Default: `#fafafa`.
- **Line break location:** horizontal position of the vertical step, measured from the left edge. `50` and `50%` both mean halfway across. Values are clamped to 0–100%; invalid or blank values use 50%. `Line break` is also accepted as the row label.
- **Height:** the overall component height in pixels; `81` and `81px` are both accepted. A supplied height applies at all screen sizes unless Mobile height overrides it. When omitted, production defaults are 81px from 768px and 45px below 768px. Invalid, zero, or negative heights use the defaults.

Optional settings:

- **Mobile height:** positive pixel height used below 768px. Omit it to inherit an authored Height or use the 45px default.
- **Line color:** a CSS color for a 1px outline, or `none` to hide the outline. By default, matching surface colors receive a `#ccc` outline, as on the production light divider; contrasting colors have no outline. For a dark outline use `#4a4a4a`.

Colors accept CSS color values (hex, RGB, HSL, named colors, or CSS variables) and the shortcuts `light` (`#fafafa`) and `dark` (`#121213`). Invalid or blank surface colors fall back to the defaults.

To create the light outline version, set both section colors to `#fafafa`. To reverse a dark/light transition, swap the two colors. Use `25%` or `75%` to move the bend.

These settings color the divider itself. Author the neighboring sections' backgrounds separately with Section Metadata so their surfaces match; the block does not change another component's colors. Dedicated divider sections remove their own section margins and gutters. Other content in a shared section keeps its section spacing.

## Responsive behavior and accessibility

The divider fills its section width without a fixed desktop width. Its 16px corner radius stays consistent when resized and shrinks only when the available height or distance to an edge cannot fit the corners. A ResizeObserver redraws the inline SVG when the block dimensions change. No image request, external dependency, animation, or site-wide autoblock is needed.

The SVG and configuration are decorative and hidden from assistive technology. The block has no focusable controls, role, or announcement; reading and keyboard order of surrounding content stay intact. No Universal Editor model is required; this project uses Document Authoring.

## Homepage section integration

The real EDS section breaks remain before and after each dedicated Separator table. They still group blocks and apply Section Metadata. The shared section-layout helper identifies the dedicated divider section and removes its outer spacing/gutters; it does not merge sections or move their content. The neighboring sections retain their authored backgrounds and internal padding. A Separator sharing a section with content keeps that section's normal layout.


Shared homepage content-gutter rules must exclude dedicated `data-section-kind` sections, including separators. Verify the separator block and SVG bounds rather than only the wrapper: both should start at the viewport's left edge and span its content width at desktop and mobile sizes. When a neighboring section uses `#1c1a1e`, author that explicit surface color; the `dark` shortcut resolves to `#121213`.

## Migration review

This component is migrated on `et-separator`. Review its changes against `develop`.

Preview: https://et-separator--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns the component itself. Common homepage gutters, dedicated divider/overlay section spacing, and superscript typography remain in `styles/styles.css`; `scripts/section-layout.js` only identifies section boundaries. These shared rules are identical across the layout-dependent PRs.
