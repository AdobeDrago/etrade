# Structured cards implementation plan

> Execute inline with test-driven development; review the whole change before completion.

**Goal:** Add DA structured card references to all nine card blocks and Carousel Story while preserving ordinary authoring and mixed rows.

**Spec:** The ten schemas and field contract supplied by the user in this chat, plus the explicit requirement that this is an optional, additive feature.

**Architecture:** A shared `/scripts/structured-cards.js` loader expands a reference-only row into the ordinary cells expected by existing decorators. Each block calls it before its existing decoration. Page block variants own presentation. No source reference means no requests or asynchronous delay before ordinary decoration.

**Constraints:** Work on the user's `et-structured-cards` branch in place. Never edit `scripts/aem.js`. No runtime dependencies, build step, schema changes, content publication, or redesign. Use preview DA JSON on localhost/preview hosts and live JSON on production. Keep ordinary rows intact and preserve their order relative to referenced cards.

## Tasks

- [x] Add failing integration tests for mixed authored/referenced rows across all ten components, plus images, body copy, actions, disclosures, rates, delivery selection, caching and failure isolation.
- [x] Implement strict site-reference detection, bounded shared fetches and safe schema-to-cell adaptation; reuse rate parsing and existing decorators.
- [x] Verify page auto-blocks cannot consume structured references, and async disclosure/tracking decoration is reapplied after insertion.
- [x] Document one link/path per source row, field behavior, content setup and failure behavior in shared authoring guidance linked from each block.
- [x] Run targeted tests, full lint/tests, unchanged-vendor/diff checks and an independent code review. Report live DA sample verification separately if no previewed document is available.

## Review focus

- Standalone action links and inline links in ordinary cards must not become fragment references.
- An unavailable/invalid structured card must not become a misleading link-only card or remove adjacent authored cards; a failed rich body must not fall back to alternate copy.
- Zero rates/overrides, numeric pricing and omitted optional values retain their meaning; untrusted URLs/markup never become executable content.
- References are fetched once per page; cards render in authored order regardless of response order; repeated cards do not produce duplicate HTML IDs.
- New content must receive disclosure, tracking and icon decoration without running page auto-block transformations on its rich body.

## Decisions / progress

- One card document per reference-only table row; blank extra cells are allowed. Structured and ordinary rows can coexist.
- Shared code adapts fields to the chosen block; per-family schemas remain maintained in DA. Card identity uses data attributes rather than global HTML IDs.
- No local AEM preview server was running when backend markup was requested. Use existing backend fixtures and explicit JSON/HTML responses for implementation checks; do not claim live DA acceptance.

## Verification

- Baseline: 359 tests passed before implementation.
- Final: `npm run lint` passes; `npm test` passes 379 tests with zero failures; `git diff --check` passes and `scripts/aem.js` is unchanged.
- Browser smoke: Chrome rendered mixed ordinary/structured rows in all ten components, preserving order, and the page width matched its 1425px viewport. A malformed image event-handler probe did not execute during inert rich-body parsing. These checks used explicit local sample responses, not live DA documents.
- Independent review found and verified fixes for inert HTML parsing and original-link eligibility after tracking/route cleanup. Focused regressions also cover scoped CTA anchors, unknown glyphs and superscript-only legal references remaining body content while ordinary disclosure CTAs retain their treatment.
- Ruling: preserve authored href as DOM metadata when consuming route/tracking controls, so classification survives fragment cloning and DOM wrapper changes. Ordinary action rows must not become structured references after their query is removed.
- Live DA content acceptance remains pending: the supplied report confirms schemas, but no previewed card document was supplied. No content or code was published.
