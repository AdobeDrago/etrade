# Cards Award

Use a two-column **Cards Award** table with one row per award. The first cell contains an authored image or icon; the second contains an H3 award title, description, disclosure reference, and attribution. Empty media cells are supported. No award name, year, image, or attribution is supplied by the block.

For the homepage trophy, author an image referencing `/icons/award.svg` with empty alternative text, or use `:award:`. The trophy is decorative because the adjacent copy identifies the award. Author meaningful alt text for an image that adds information.

The cards stack below 768px and use up to three columns above it when space permits. Headings are normalized to H3 under the section's authored H2. Empty rows are skipped and all rich text is preserved.

## Migration review

The shared style migration is on `etrade-style`. Preview: https://etrade-style--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns the component and its legacy surrounding section styles. Section selectors require this block to be present. Explicit Section Metadata owns the section's container, spacing, background and introduction alignment. Common card roles and responsive grid sizing live in `styles/cards.css`.

## Shared design tokens

The block uses shared semantic text colors, font sizes and weights, spacing and grid-gap tokens from `styles/brand.css`. Body copy stays at 1rem and award titles at 1.375rem (16px and 22px at the default root size). The homepage section heading keeps its 1.75rem mobile and 2.25rem desktop sizes. Unitless line heights scale with the text.

Body copy, award titles and the homepage section heading all use `--tracking-tight`, equivalent to -0.25px at the default root size. This replaces the separate -0.21px, -0.4px and -0.25px values called out in PR 21. The 4.5rem artwork dimensions are local component measurements. The desktop column cap still switches at 768px; narrow section cells and enlarged text reduce the count as needed.

Awards inherit their surrounding section surface and use inverse text in dark sections. Authored images, alternative text, rich copy, disclosures, links and heading normalization are preserved. Shared action styling and font loading remain owned by their existing global stylesheets.

## Validation

Run `npm run lint` and `npm run test:cards`. Review saved homepage content below and above 768px, including 200% text sizing, long headings, missing images, extra cells, disclosure references, keyboard focus and a dark surrounding section. Check that the cards and their text remain within the page width and the authored awards link retains its destination and tracking. See the [shared card styles](../../README.md#shared-card-styles).
