# Cards

Author one row per card in a **Cards** table. Put an optional picture in the first cell and a heading, rich copy and links in the following cells. Blank rows are skipped; an empty block is hidden. Images use the existing optimized-picture helper and preserve authored alternative text. Additional content cells remain in reading order.

The grid fills the available width with cards at least 16.0625rem wide when space permits, stacking in smaller containers. It uses shared surface, border, text, focus and typography tokens. Headings use 1.5rem on mobile and 1.75rem from 768px, and text wraps as its size increases.

See the [shared card styles](../../README.md#shared-card-styles) for section controls, themes and validation. Nested authored lists retain their list semantics and are not treated as card grids.
