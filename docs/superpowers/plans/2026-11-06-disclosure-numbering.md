# Disclosure Numbering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Keep numeric disclosure identities and all authored citations synchronized when disclosures are reordered, with migration, recovery and authoring assistance.
**Architecture:** Shared numbering validation feeds the renderer and manager. Pure source transformations produce a reviewed batch from an authenticated site inventory; a persisted recovery manifest coordinates individual DA writes. DA's existing editor hooks and SDK own editing and undo.
**Tech Stack:** Browser JavaScript modules, DOMParser, DA SDK/Source/List APIs, Node 24+, linkedom and node:test; no runtime dependencies.
**Spec:** ../specs/2026-11-05-disclosure-numbering-design.md (approved by user on 2026-11-06).
**Execution:** Inline in this existing isolated worktree; user approved beginning implementation. Preserve that authorization and continue through the plan without additional workflow-choice prompts.

## Global Constraints

- No build step; development dependencies only; never edit scripts/aem.js.
- Read the owning block and backend plain HTML before changing decoration.
- Scope added CSS to its owning component. Only fragment/fragment.js may be imported across blocks.
- Keep legal wording, business figures, media and unrelated links intact.
- Source saves, previews and publishing are separate actions; no automatic publishing or merging.
- Preserve existing legacy content until explicit migration.
- Use the connected DA site only; no persisted credentials or undocumented editor message protocols.
- Use Node 24+, npm ci, verified hooks, Conventional Commits, full npm run check and actual-base commitlint before pushing.

## Review Focus

- A shared source reached through another set must block a conflicting numeric rewrite (Task 3).
- Migration collisions between existing numeric superscripts and new numeric identities require explicit classification (Task 2).
- A lost POST response must not apply the permutation twice (Task 4).
- An unsaved reorder must not produce citations interpreted against unsaved numbering (Task 5).
- Assistant actions on stale, ambiguous or unsupported editor selections must never overwrite source (Task 7).

## File responsibilities

- scripts/disclosure-sets.js: shared set mode/namespace validation and normalized entries.
- scripts/disclosure-references.js: numeric and legacy reference resolution and retargeting.
- blocks/disclosures/disclosures.js: render strict numeric sets with namespaced anchors.
- tools/plugins/disclosure-manager/model.js: source parsing, validation and legacy helpers.
- tools/plugins/disclosure-manager/renumber.js: pure set/source transformation and schema patch.
- tools/plugins/disclosure-manager/inventory.js: authenticated discovery, dependency analysis and batch creation.
- tools/plugins/disclosure-manager/operations.js: durable operation manifest, source writes and recovery.
- tools/plugins/disclosure-manager/controller.js: manager batch/recovery integration, if extracted from the current entry module.
- tools/plugins/disclosure-manager/assistant.js: live/selected superscript suggestions and guarded block actions.
- scripts/disclosure-hints.js and styles/disclosure-hints.css: editor-only read-only inline disclosure preview outside authored content.
- Existing manager HTML/CSS/demo/preview and documentation: corresponding UI and migration instructions.
- test/disclosure-renumber.test.js, test/disclosure-inventory.test.js, test/disclosure-operations.test.js, test/disclosure-assistant.test.js: focused new behavioral tests.

### Task 1: Strict numeric contracts and editor baseline

**Interfaces:** Extend disclosureSetEntries(payload) to return namespace for numeric entries; expose disclosureSetMode(set) returning legacy, stable or sequence. Keep existing entry shapes for old modes.

- [x] Incorporate the existing #54 commit (10b1c38) as the approved dependency; run its regressions rather than rewriting its implementation.
- [x] Add renderer regressions for {id:'homepage', disclosures:[{disclosureId:'1',fragment:'/a'},{disclosureId:'2',fragment:'/b'}]}; assert numbers 1/2, anchors disclosure-homepage-1/2, repeated/grouped/plain/namespaced markers, and manual retargeting.
- [x] Run the disclosure suite and observe rejection/absent numeric rendering before implementation.
- [x] Implement numeric mode detection, whole-set sequential ID/namespace validation and strict nonempty numeric fragments. Leave legacy outputs unchanged.
- [x] Verify invalid/mixed/out-of-order IDs and empty fragments cannot silently shift targets; ordinary external links remain authored.
- [x] Run disclosure and page-loading suites and commit.

### Task 2: Exact source renumbering and schema transition

**Interfaces:** renumberPlan(model, order) -> {namespace, before, after, mapping, setSource}; rewriteDisclosureReferences(source, plan, {confirmNumeric=false}) -> {source, changes, issues}; numberedDisclosureSchema(schema) -> cloned schema.

- [x] Add tests for swap/rotation, grouped/repeated references, source IDs matching positions, namespaced/legacy anchor rewrites, preserved rich text/metadata and non-citation business figures.
- [x] Add a migration collision test: an old unmatched numeric superscript blocks until explicitly confirmed as a positional citation.
- [x] Run and observe missing transformation behavior.
- [x] Implement immutable single-pass mappings for JSON and DA structured HTML. Preserve unknown fields and self-reference identities; change only actual disclosureId cells and order.
- [x] Implement citation-only DOM rewrites and explicit structured reference-field adapters; report unsupported reference formats.
- [x] Implement a schema transformation that changes only disclosure identifier validation/descriptions and keeps fragment enum options/other definitions.
- [x] Run new transformation tests plus legacy manager tests; commit.

### Task 3: Complete consumer inventory

**Interfaces:** planAffectedSources(context, model, order, request, options) -> {namespace, setPath, mapping, writes:[{path, original, target, references, kind}], issues, scanned}; every path is site-relative.

- [x] Add authenticated fake Source/List fixtures containing two matching pages, nested shared fragments, another set consumer, a cycle, unrelated links and JSON structured content.
- [x] Assert all affected sources are included exactly once, ordinary links are not dependencies, cross-set ambiguity blocks, and any failed enumeration/read blocks saving.
- [x] Run to observe missing discovery.
- [x] Implement bounded recursive List inventory, source cache and normalized dependency graph. Restrict requests and returned paths to the connected site; reject unsafe paths and malformed list responses.
- [x] Add explicit adapters for actual structured fragment/reference fields; unsupported affected structured consumers produce blocking issues.
- [x] Produce a frozen reviewed write list with the set last. Recheck inventory before execution through source snapshots.
- [x] Run inventory and transformation suites; commit.

### Task 4: Durable saves and recovery

**Interfaces:** readOperation(context,setPath,request); applyOperation(context,plan,request,{onProgress}); resumeOperation(context,operation,request,{onProgress}); restoreOperation(context,operation,request,{onProgress}). Operations contain original/target snapshots, progress and no credentials.

- [x] Add in-memory server tests covering success, conflict before writes, a failure at each write, timeout after a successful write, recovery after reopening and a collaborator divergence during rollback.
- [x] Assert no content writes occur if the manifest cannot be persisted, and repeated resume never remaps already-written content.
- [x] Observe red, then implement stable same-site manifest paths under /.da/disclosure-manager/renumber-jobs/ and strict manifest validation.
- [x] Preflight exact source snapshots; persist manifest before content writes; write/read back consumers once, then set; persist progress.
- [x] Resolve uncertain POST outcomes by reading current source. Roll back only operation-owned outputs; preserve divergent collaborator changes and record recovery requirements.
- [x] Verify the API's optimistic limits are explicit and incomplete work never returns success.
- [x] Run operation, inventory and transformation tests; commit.

### Task 5: Reviewable manager workflow

**Interfaces:** Manager calls planAffectedSources for review, then applyOperation; discovers pending operations via readOperation and offers resume/restore. Preview uses proposed numeric entries while insertion uses saved entries.

- [x] Extend UI harness tests for migration review, affected-source list, blocking audit, successful batch, pending recovery, selection and unsaved-order insertion.
- [x] Observe missing UI behaviors.
- [x] Integrate Review changes -> Save changes, migration action, source progress, pending-operation recovery, and separate preview/publish path report.
- [x] Preserve existing drag/move/reset, excerpt/title and inert footer preview behavior. Numeric selections remain attached to their entry across proposed moves.
- [x] Refresh/settle the connected current page with native saveDocument when supported; source snapshot changes invalidate an old review.
- [x] Extend the no-write demo with multiple consumers and an operation store so browser QA exercises real batch logic.
- [x] Run manager, operation and preview suites; commit.

### Task 6: Canvas refresh, schema procedure and authenticated QA

**Interfaces:** reloadEditable(main) remains DA's sole reload callback. Numeric target refresh uses the shared set loader and source identity; active mini-editor DOM remains untouched.

- [ ] Add regression for a newer numeric set after a preview update and detached inline/table/view changes.
- [ ] Observe stale-target failure, implement scoped static target refresh with deduplicated fetching and no hidden browser reload.
- [ ] Document exact schema patch application, code-before-content migration, complete-batch preview/publish, recovery and ordinary-superscript rules.
- [ ] Verify current live DA schema/structured reference fields and disposable draft save/preview behavior. Record concrete platform limitations if present.
- [ ] Run full check; verify the branch preview and capture desktop/mobile authoring screenshots; commit.

### Task 7: Manager assistant and safe inline preview

**Interfaces:** mountDisclosureAssistant({document, sdk, getEntries, getNamespace, getFragments, onStatus}) -> {dispose}; candidate/block helpers are pure and covered independently. mountDisclosureHints(doc,win) activates only with body.quick-edit.

**User steering:** Build the helper inside Disclosure Manager first; also provide an inline helper where supported. This augments, and does not block, the approved renumbering implementation.

- [ ] Add tests for new/selected superscript candidates, matching excerpts, grouped numbers, dismissal, stale snapshots and unsupported editor hosts.
- [ ] Observe red; implement suggestions using subscribeLiveDocument/getSelection only while the manager is open. Debounce stable changes and avoid repeating dismissed suggestions.
- [ ] Implement Link disclosure with supported sendHTML replacement and the host's exact document/block guard. Unsupported selections provide a copy fallback, not an unguarded write.
- [ ] Keep as ordinary superscript can explicitly convert digits to Unicode superscript characters while preserving surrounding inline formatting, following the approved non-reference notation rule. Its UI explains the result before applying it; unsupported hosts use a copy fallback.
- [ ] Add tests proving the inline helper renders outside authored main, shows the actual disclosure excerpt on citation hover/focus, supports Escape, and never runs on the public site or mutates an active editor.
- [ ] Implement read-only inline preview through site-owned quick-edit lifecycle and delegated events. No cross-origin DOM manipulation or custom editor message protocol. Editing decisions stay in the manager.
- [ ] Browser-check keyboard/pointer behavior in demo and authenticated Canvas where available; run all suites, then commit.

## Completion

- [ ] Update approved spec status and record helper scope and significant rulings.
- [ ] Full npm run check; hooks and full commit range validation against origin/develop.
- [ ] Fresh whole-branch review; reproduce and fix material findings with regressions.
- [ ] Prepare a draft Conventional Commit PR with the actual branch preview URL, clear remaining authenticated/content rollout steps, and screenshots.
- [ ] Do not merge or publish automatically.
