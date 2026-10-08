# Cards Award

Use a two-column **Cards Award** table with one row per award. The first cell contains an authored image or icon; the second contains an H3 award title, description, disclosure reference, and attribution. Empty media cells are supported. No award name, year, image, or attribution is supplied by the block.

For the homepage trophy, author an image referencing `/icons/award.svg` with empty alternative text, or use `:award:`. The trophy is decorative because the adjacent copy identifies the award. Author meaningful alt text for an image that adds information.

The cards stack below 768px and form three columns above it. Headings are normalized to H3 under the section's authored H2. Empty rows are skipped and all rich text is preserved.

## Migration review

This component is migrated on `et-cards-award`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-cards-award--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Style ownership

The block stylesheet owns both the component and its feature-specific surrounding section styles. Section selectors require this block to be present; `:where()` preserves their existing specificity. Shared homepage section spacing remains in `styles/styles.css`.
