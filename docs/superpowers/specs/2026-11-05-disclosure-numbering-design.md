# Disclosure numbering and reference synchronization

Date: 2026-11-05
Status: Approved by the user on 2026-11-06. Implemented and reviewed locally; post-push Canvas QA remains in the plan.
Chosen approach: Renumber disclosure IDs and all affected authored references together.

## Intent and agreed behavior

Authors work with sequence numbers. A superscript 1 means the first disclosure in the selected set. A superscript 1,3 links to the first and third disclosures.

Reordering preserves which legal text an existing citation refers to. Moving the old first disclosure to third position changes its disclosureId from "1" to "3" and changes its existing citations from 1 to 3. Manually editing a superscript from 1 to 2 is different: that intentionally selects the disclosure currently in second position.

The user selected this approach and clarified both behaviors in this chat. Peter's supplied feedback also permits namespacing by set, such as homepage-1.

## Baseline implementation and evidence

- The delivered homepage set has id "homepage" and disclosureId values a through m.
- The live DA disclosure-set schema requires disclosureId to match ^[a-z][a-z0-9]*$. Its description currently tells authors to superscript those identifiers.
- scripts/disclosure-sets.js and Disclosure Manager enforce the same letter-first restriction.
- The manager currently saves only a reordered set. Existing stable-ID citations are never rewritten.
- scripts/disclosure-references.js retains original IDs in runtime data attributes and renders their ordinal labels.
- Draft PR #66 introduces DA's native reloadEditable(main) callback and reconciles manually edited references for issue #54. It is a dependency to incorporate or rebase over, not a second independent editor protocol.
- Adobe's List API enumerates directory children. Its Source API reads and writes individual documents; the documentation does not expose a multi-document transaction or conditional compare-and-swap.

References:
- https://github.com/AdobeDrago/etrade/issues/54
- https://github.com/AdobeDrago/etrade/pull/66
- https://www.aem.live/docs/ew/administering/structured-content
- https://www.aem.live/docs/ew/administering/schema
- https://docs.da.live/developers/api/list
- https://docs.da.live/developers/api/source
- https://github.com/adobe/da-nx/blob/main/docs/quick-edit-events.md

## Approaches

1. Renumber IDs and affected source citations. This is the user's selection. Saved sources, authored numbers and target numbers agree. It requires discovering all consumers, writing several documents, conflict checks and recovery.
2. Keep permanent internal IDs and expose numbers through a page mapping. Peter allowed this alternative, but it adds a mapping layer and does not satisfy the user's selected direct renumbering approach.

Do not silently replace the selected approach with stable IDs rendered under different numbers.

## Scope

Implement numeric reference resolution, manager insertion and reordering, migration from existing letter IDs, discovery and rewriting of affected consumers, interrupted-save recovery, and editor refresh behavior from #54.

Keep legal fragments, legal wording, business figures, media and unrelated links intact. Preserve introduction/notice/logo/closing order and unknown structured-content fields.

Saving source does not publish content. Preview and publish remain separate DA actions. Combining multiple disclosure sets on one page is future work; namespaced anchors prepare for it.

## Schema and data contract

Retain the existing disclosure-set schema name and top-level fields: id, introduction, disclosures and closing. Keep fragment references and fragment selection options.

- id remains the namespace, e.g. homepage.
- disclosureId remains a string. For a migrated set, it is the canonical positive integer string for its position: "1", "2", ... "N".
- Order is authoritative; manager-controlled renumbering writes the corresponding IDs. A numeric set with gaps, duplicate IDs, leading zeros or IDs out of position is invalid.
- The transitional schema permits existing letter-first IDs or positive integer strings. Update its field label and descriptions to explain numbered authoring and manager reordering. Application validation enforces whole-set consistency because supported JSON Schema features cannot be assumed to express every invariant.
- Existing all-letter sets remain readable until explicitly migrated. A set mixing legacy identifiers and numeric identifiers is invalid and cannot be saved by the manager.
- No separate editable number field or new permanent identity field is added.
- The repository contains the schema change as a reviewed patch/template and an exact deployment procedure. Preserve the live schema's fragment enumeration and unrelated definitions when applying it. A developer must not replace the whole live schema with a reduced example.

Numeric sets require nonempty, available disclosure fragments. Otherwise stop the operation and show the source to fix. The numeric renderer must not silently skip an item and thereby make ID 4 display as 3. Existing legacy rendering retains compatibility while its sources await migration.

## Reference contract

Canonical footer anchors include the namespace: #disclosure-homepage-1. The visible text and accessible label both use 1.

Authors may type plain numeric superscripts using the page's selected set, including comma-separated groups. Explicit namespaced superscripts may resolve only against that matching selected set. Legacy markers continue resolving for legacy sets.

Generated markup and temporary data attributes are rendering details. On a genuine author edit, use the newly authored number rather than restoring stale cached IDs. Never mutate an active ProseMirror mini-editor. Reconcile settled static markup through reloadEditable.

Authoring classification (implementation decision): in a numeric set, every plain superscript whose comma-separated tokens are valid numbers in that selected set is a disclosure citation. Identical markup cannot also mean an ordinary exponent. Superscripts outside that grammar or without matching targets, and superscripts inside unrelated external links, remain authored. For a mathematical exponent that would otherwise match, authors must use non-reference notation, such as a Unicode superscript character.

During legacy migration, previously unresolved bare numeric superscripts that collide with the proposed numeric targets are ambiguous. Show their exact source locations and require confirmation of their positional-citation intent, or correction of the source notation, before proceeding. If confirmed as citations, map their old displayed positions through the same frozen reorder map. Do not silently reinterpret them.

When a reference cannot be resolved, preserve it and report it in the manager. Do not guess a target or touch external links.

## Reorder and migration plan

Build a frozen old-to-new map from the loaded entries and the proposed permutation. Apply that map in one pass to each reference token so swaps and rotations cannot cascade.

Example: old entries [1:A, 2:B, 3:C], new order [C, A, B] gives 1→2, 2→3, 3→1. A citation 1,3 becomes 2,1, preserving its citation order and legal targets.

Migration uses the same mechanism: old a, b, c map to numeric IDs according to their positions in the proposed final order. It must be explicit, reviewable and idempotent; runtime rendering must not rewrite saved source by itself.

Rewrite only supported citation structures: superscript text, recognized internal disclosure hrefs and any corresponding authored reference metadata. Use DOM parsing and exact tokens. Preserve formatting and surrounding content. Numeric business values, rate fields, dates, amounts, ordinary links and legal prose are never replacement targets.

Structured content requires schema-aware reference adapters for reference-bearing fields actually used by the site. Do not recursively replace arbitrary strings or numbers in JSON. An unsupported reference-bearing format is a blocking audit issue, not silently omitted work.

## Finding all affected sources

Use the authenticated DA SDK daFetch action and the List/Source APIs within the connected organization and site.

1. Recursively enumerate site HTML/JSON source documents, including drafts. Exclude media and internal configuration/job documents from citation candidates.
2. Read page Metadata and normalize selected set paths using the existing same-site restrictions.
3. Build page-to-set and page-to-content dependency graphs. Follow supported Fragment blocks and explicitly defined structured-content fragment fields; do not treat every ordinary hyperlink as embedded content.
4. Identify every page selecting the reordered set and every source supplying its rendered citations. Include nested dependencies, deduplicate shared sources and stop cycles safely.
5. Check other consumers of each shared source. If the same bare numeric citations need different mappings in different consuming sets, stop and identify the conflicting pages. Do not silently fork content or change the other set's references.
6. Produce a reviewable list of source paths, citation counts, old/new mappings, unchanged legal-fragment paths and required preview/publish paths.
7. Missing permissions, incomplete enumeration, unresolved dependencies or unsupported citation formats prevent the operation from claiming complete coverage.

The initial implementation may block an ambiguous cross-set fragment until authors separate it or make the relevant set orders consistent. Automatic content forking is outside this change.

## Saving and recovery

A successful save means the set and all affected citation sources have been written and read back, not merely that the set POST succeeded.

Before writing:
- Ask the native host to settle/save the current document when supported; otherwise require its normal saved state and detect changes using snapshots.
- Re-read affected sources and set to check the exact snapshots used by the plan.
- Check for an unfinished renumbering operation for this set.
- Persist a recovery manifest through the authenticated Source API under /.da/disclosure-manager/renumber-jobs/. It contains original and target source snapshots, hashes, namespace, mapping, operation identity and per-file progress. Never store credentials.
- If the manifest cannot be persisted, make no content changes.

Write citation consumers once each, then the set, recording progress. Read back every write and compare the intended semantic result. A timed-out write is resolved by reading its current source rather than applying the mapping again.

On failure, stop. Restore only documents still matching this operation's planned output; never overwrite a collaborator's divergent source. Record any unresolved paths and expose recovery in the manager. Reopening the manager detects an unfinished manifest and supports continuing or restoring the same operation from known source states. A fresh unrelated reorder is blocked until recovery is resolved.

These are optimistic conflict checks, not a distributed lock. Adobe's currently documented API cannot guarantee an atomic multi-document update or prevent a collaborator racing the final comparison. The interface and documentation must state that limit. An interrupted operation is never reported as saved or ready to publish.

## Manager experience

Keep the existing title/excerpt list, drag handles, Move up/down controls, footer preview, reference insertion and audit.

- Use sequence numbers throughout labels, selection and inserted superscripts.
- A proposed reorder immediately updates the manager's list and footer preview.
- Before saving, show affected pages/fragments and citation changes in a compact change review. Ambiguous or unreadable consumers are actionable errors.
- Save applies the reviewed batch. Disable conflicting manager actions while it runs and report progress by source.
- Success lists the exact changed sources and their separate preview/publish steps.
- Failure shows recovery state and affected paths rather than a generic set-save success.
- Legacy sets offer migration with the same change review.
- Insertion while an unsaved reorder exists must either apply the reorder first or use saved numbering; it must not insert a number interpreted against an unsaved order.

## Canvas and preview behavior

Use DA's native reloadEditable(main) pipeline from #54 for blur, table edits and Canvas/Layout/side-by-side view changes. Await block loading before resolving citations. Refresh static disclosure targets when a newer previewed set becomes available without touching active editor DOM or forcing a browser reload.

The manager's footer preview represents the proposed/saved source order immediately. DA source saves and AEM preview delivery are separate. Until affected sources are previewed together, the manager must label their preview status honestly; it must not show a source-save success as proof the previewed footer has updated.

During implementation, verify the actual deployed DA save/preview refresh path using a disposable draft set and pages. If the documented host APIs cannot refresh the current Canvas footer after the separate preview action, bring that concrete integration limitation back before declaring #54/reorder QA complete. Do not invent a parallel postMessage protocol, patch DA internals or hide a full-page reload in the save operation.

## Deployment and migration

1. Implement backward-compatible code and regressions on a dedicated branch, based on develop with #54 incorporated or tracked as a dependency.
2. Review branch previews and disposable DA sources before any real-set migration.
3. Deploy compatible renderer/manager code before producing numeric source data.
4. Apply the reviewed transitional change to the existing DA schema, preserving its other fields and fragment options.
5. Migrate a disposable set and all consumers; test reorder, manual retargeting and recovery.
6. Migrate the real homepage set and discovered consumers only after a complete change review. Keep original snapshots recoverable.
7. Preview the changed set and all citation sources, then verify every target.
8. Publish content through the site's normal approval process separately. Do not merge or publish as part of preparing the feature PR.

## Verification

Meaningful regression cases:
- Swap, rotation, move first-to-last and move last-to-first; repeated and grouped citations keep their legal targets.
- Editing a number intentionally retargets; blur and editing-view changes refresh links without a browser reload.
- Source order, numeric IDs, visible footer numbers, hrefs and accessible labels agree.
- Legacy migration, unchanged legacy delivery, repeated saves and recovery are idempotent.
- All consumers and nested shared fragments are found; conflicting cross-set reuse and unreadable paths block writes.
- Rich formatting, metadata, unknown fields, non-reference superscripts, external links and legal/business figures are preserved. Numeric-superscript classification and migration collisions follow the explicit authoring rule above.
- Empty/missing fragments, invalid/duplicate IDs and malformed order cannot cause silent relinking.
- Conflicts before a write, failure on any write, timeout after a successful write, rollback conflict and recovery after reopening.
- Preview/live content separation and the absence of any automatic publishing.

Follow AGENTS.md: Node 24+, npm ci and verified Husky hooks before commits; full npm run check and actual-base commitlint before pushing; no runtime dependencies or build step; no edits to scripts/aem.js. Read source plain HTML before changing block decoration. Keep code and content migrations separately reviewable.

Authenticated Canvas checks and desktop/mobile screenshots belong in the implementation PR. Do not claim a unit-test fixture alone proves DA integration.

## Builder's decisions

The builder may choose module boundaries, concurrency limits for read-only discovery, source snapshot hashing, recovery-manifest serialization and the precise change-review layout. These choices must preserve the behavior, source boundaries and failure rules above.

Known integration questions are to be verified against current DA in a disposable draft before implementation is declared complete: structured reference-field coverage, internal recovery-directory permissions, collaborative source-update behavior, and the post-preview Canvas footer refresh path.

## Builder check

A fresh read-only builder review identified one unresolved ambiguity: a bare numeric superscript can be either a citation or an exponent. This is resolved by the explicit classification rule above, consistent with the requested superscript-number authoring experience. The rule and migration review are the implementer's proposal, not an additional user-selected requirement. No other planning-blocking questions were raised.

## Approved authoring-helper addition (2026-11-06)

The user asked for a Clippy-like disclosure helper, chose suggestions inside Disclosure Manager, and also requested an inline helper if possible. The manager assistant can suggest a matching disclosure/excerpt after a new superscript or selection; edits use supported SDK replacement guards. A Keep as ordinary superscript action offers Unicode superscript notation to preserve visual superscripting without disclosure semantics. The inline helper is an editor-only read-only preview beside a hovered/focused citation; editing decisions remain in the manager, avoiding unsupported cross-origin editor controls. This addition does not replace the numeric authoring contract or introduce prompts on the public site.
