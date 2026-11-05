# Disclosure editor refresh implementation plan

> Execute inline using superpowers:executing-plans; verify each regression before and after its fix.

**Goal:** Resolve #54 before changing disclosure numbering, as requested in this chat.

**Architecture:** Use DA's existing `reloadEditable(main)` callback for detached inline, block and section updates and whole-main view updates. Reconcile references after blocks finish loading. Keep the active ProseMirror DOM under DA's control.

**Spec:** Issue #54 and Peter's supplied feedback: references must refresh after blur and view changes, without refreshing the page.

**Constraints:** Node 24+; development dependencies only; never edit `scripts/aem.js`; no custom message protocol or global editor mutation observer.

## Task 1: Refresh through the native editor callback

- [x] Add regression coverage in `test/page-loading.test.js` for detached inline edits, table/section updates, and disclosures rendered asynchronously in the updated main.
- [x] Confirm the asynchronous target regression fails with DA's existing default decoration/loading sequence.
- [x] Export `reloadEditable(main)` from `scripts/scripts.js`: decorate, await section loading, then reconcile references against newly loaded local disclosures or the shared rendered disclosures.
- [x] Run page loading and disclosure tests; confirm unrelated header/footer nodes are preserved.

## Task 2: Respect authors' current edits

- [x] Add regressions in `test/disclosures.test.js` for changing an already decorated citation, grouped citations, and an active mini-editor.
- [x] Confirm the edit and active-editor regressions fail before implementation.
- [x] Update `scripts/disclosure-references.js` to retain saved IDs only while the generated link structure is intact, and skip active editor DOM.
- [x] Verify existing set reordering remains idempotent and external links stay untouched.

## Review and delivery

- [ ] Run `npm run check`, inspect the diff, verify hooks and Conventional Commit history, and commit the focused fix.
- [ ] Request an independent review, address material findings, and prepare a PR with the actual branch preview URL.
- [ ] Record authenticated Canvas testing separately if browser access is unavailable.

## Progress

- Baseline: disclosure tests 19/19 and section/page tests 26/26 pass.
- Deployed DA callback inspected; it supports detached scopes and `partialReload`.
- Local source markup inspected at `/home.plain.html` before changes.
- Browser verification unavailable: Chrome connection timed out and native Chrome access was not approved.
- Independent review found a grouped-link reorder/destination-edit gap; regression observed failing and fixed. Final `npm run check`: 378 tests pass, lint passes.
