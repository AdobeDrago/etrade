# Handoff Review Follow-up Plan

> **For agentic workers:** Use superpowers:executing-plans in this session. Steps use checkboxes for tracking.

**Goal:** Address the requested date layout, reader-facing copy, Unslop audit, and whole-guide search.

**Architecture:** Keep the standalone guide and existing block filter. Add a header button and native search dialog, with a text index built from guide headings and passages. Search results link to existing section/block anchors or generated heading anchors. Queries never filter the document; following a hidden block result uses the existing reveal behavior.

**Tech Stack:** Existing HTML, scoped CSS, vanilla JavaScript, Node test runner and linkedom.

**Spec:** The user's four review notes in chat. Implementation choices are a native dialog with ranked heading/excerpt results, a two-character minimum, and a 20-result display limit. Preserve browser Find, existing catalog controls, sidebar resizing, no-JavaScript reading and printing.

## Constraints and review focus

- Continue on `handoff-doc`; modify documentation and focused search tests only.
- Preserve technical facts, financial examples, source links, block contracts and existing anchors.
- Use abbreviated changelog dates with a wide, nonwrapping date column.
- Run the linked Unslop scanners locally; review flags in context rather than rewriting valid reference patterns.
- Search includes tables, authoring steps and all 32 blocks, even when catalog filters hide them.
- Typing a guide query must preserve catalog queries, categories and visibility.
- Search input is text, including punctuation or markup-like queries; never insert it as HTML.
- Verify keyboard dismissal/focus return, narrow screens, no results, and reopening after navigation.

### Task 1: Copy and changelog

- [x] Run Unslop phrase, structure and silhouette scans on extracted guide text.
- [x] Remove internal commentary and repetitive framing; preserve actionable limitations and pending checks.
- [x] Abbreviate changelog dates and reserve enough column width.
- [x] Compare edits, check anchors/assets and inspect the date column on desktop/mobile.

### Task 2: Guide search

- [ ] Write behavioral tests for full-guide matching, hidden catalog entries, independent filters, navigation and literal input; observe the missing feature fail.
- [ ] Add a header search button and accessible dialog with ranked results and excerpts.
- [ ] Implement heading/passages indexing and existing-anchor navigation without changing the block filter.
- [ ] Verify tests, desktop/mobile layout, keyboard use, no results, focus return and catalog interactions.
- [ ] Run project tests, lint, explicit documentation CSS lint and structural checks.
- [ ] Request one fresh review, resolve material findings, save screenshots and prepare the finished work for focused commits.

## Execution notes

- Initial phrase scan: zero matches. Reference-field repetition and the maintenance section produce soft structure/silhouette flags; preserve the consistent catalog format.
- Final scans with the documentation genre: zero phrase matches, zero silhouette flags, one soft opener-repetition flag from the reference format. Preservation: all 539 extracted constraints retained. Reviewed the reduced negation count against the edited sentences; removed redundant scope statements without changing block or service behavior.
- Date layout checked on desktop and at 320px: both dates remain on one line in a 144px column.
