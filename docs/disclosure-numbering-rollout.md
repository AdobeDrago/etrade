# Disclosure numbering rollout

The feature keeps the existing `disclosure-set` schema and changes its authoring contract to sequential numeric identifiers. Code and DA content have separate delivery lifecycles.

## Verification at handoff

On 2026-11-06, the local implementation passed all 431 tests and project lint checks. A fresh branch review found and verified fixes for automatically embedded fragment discovery, JSON links/selectors, unresolved edited numbers, unrelated selected superscripts, numeric-collision approval scope, and hosts without automatic page saving. Each correction has a regression that failed before the fix.

Local browser checks covered conversion and reviewed batch saving, both assistant choices, desktop/mobile layout, and keyboard focus/Escape for the inline preview. Screenshots: [desktop manager](../test/screenshots/disclosure-assistant-desktop.jpg), [mobile manager](../test/screenshots/disclosure-assistant-mobile.jpg), [inline preview fixture](../test/screenshots/disclosure-inline-helper.jpg). These are local demo/fixture results, not authenticated source-write evidence.

The live schema and Card reference fields were inspected after Adobe sign-in; the schema patch preserves all 36 existing fragment options. That initial inspection changed no schema, Library configuration or content. The user will push `codex/rework-disclosure-numbering`; deployed branch checks and disposable Canvas save/Undo/preview tests remain required after that push. This branch must not be treated as content-rollout approval.

The implementation uses one fresh whole-branch review after inline development rather than separate reviewers for every task. The ordinary-superscript choice uses Unicode characters because generic mark attributes cannot be assumed to survive the editor. Helper implementation preceded authenticated integration testing so its full code could be reviewed before granting editing access; real-host issues can still surface during the post-push checks.

## Enable compatible code first

Post-push QA update: the branch preview is available, and **Disclosure Manager (numbering QA)** is registered only for `ref=codex-rework-disclosure-numbering`. The [Canvas test page](https://da.live/canvas?ref=codex-rework-disclosure-numbering#/adobedrago/etrade/drafts/disclosure-numbering-qa/consumer-a) uses the existing `/disclosures/sets/homepage` and its fragments. Canvas rendered repeated/grouped/table citations and the manager loaded all 13 disclosures. The shared set remains unchanged. The user subsequently saved the numeric-only schema update. Full shared-set conversion/reorder and Canvas save/Undo checks remain pending after the latest commits are pushed.

Deploy the backward-compatible renderer and Disclosure Manager before migrating real content. Use a separate plugin registration and disposable draft sources for branch QA. DA sources are shared across code branches: changing homepage content while another active branch still understands only letter IDs can break that branch's footer.

Do not migrate the real homepage as part of merely reviewing the feature PR. Merge/deploy compatible code through the normal process, then schedule the source/schema migration and content review.

## Patch the existing schema

The user reports this update is already saved. The steps below document the required schema for review.

1. Open [Schema Editor](https://da.live/apps/schema), load `/adobedrago/etrade`, and select **Disclosure set**.
2. Copy/export the existing complete JSON as a backup. Preserve the `FragmentPath` definition and all its current `enum`/`enumNames` choices. The live schema inspected on 2026-11-06 had 36 fragment options.
3. In `properties.disclosures.items.properties.disclosureId`, retain `type: "string"` and `minLength: 1`; change:
   - `title`: `Disclosure number`
   - `pattern`: `^[1-9][0-9]*$`
   - `description`: `The disclosure's current sequence number, starting at 1. This value must match its position in the set. Reorder through Disclosure Manager so numbers and all affected references update together.`
4. Update `properties.disclosures.description` to explain that order and numbers must agree and reordering belongs in Disclosure Manager.
5. Keep the schema name, set ID field, fragment references, supporting arrays and unrelated definitions intact. Save the schema only after it validates.
6. If the disclosure item uses a same-document `$ref`, apply the identifier changes in that referenced definition instead.

The pure `numberedDisclosureSchema(schema)` function in [renumber.js](../tools/plugins/disclosure-manager/renumber.js) applies exactly this transformation to a cloned schema. It preserves the site's fragment definitions. It was also checked against the copied live schema. It is a patch helper, not a replacement schema with a fixed list of legal fragments.

The field remains a string containing its current sequence number, rather than a permanent identity. Existing letter sets remain readable through renderer compatibility until their explicit conversion. A migrated set must have IDs "1", "2", ... "N" in that order, with a valid namespace such as `homepage`. Application validation enforces the full sequence. A separate stored/display-number field is not introduced.

Existing card schemas' `disclosureIds` string arrays and `bodyFragment` field remain supported. Their descriptive labels may be updated to say disclosure references/numbers; their property names do not need to change.

## Migrate a disposable set and its consumers

1. Use the existing Canvas test page and its existing homepage set/fragments. Do not create replacement legal fragments or another QA set. Converting the shared set affects every consumer across branches; perform that cutover only after compatible code is deployed and the complete affected-source review has been accepted.
2. Preview the draft legal fragments/set/page and open the appropriate branch/local code in Canvas.
3. Open the review-version Disclosure Manager. For an existing letter set, choose **Convert to numbered references**.
4. Inspect the full mapping and affected-source list. Fix unreadable paths, unsupported structured references, empty legal fragments and conflicting cross-set reuse. Confirm any ambiguous numeric superscripts only after checking their intended meaning.
5. Save the reviewed batch. Verify every listed source and the canonical namespaced anchors.
6. Test swapping and rotating disclosures. Existing citations must follow their legal text; manually changing a superscript must intentionally select that current numbered disclosure.
7. Preview every changed set/citation source together. Verify blur, table editing and Canvas/Layout/side-by-side changes without a browser refresh.
8. Exercise an interrupted save in the no-write demo and inspect recovery. Real authoring changes use optimistic conflict checks; do not test destructive overwrite races against business content.

The renderer refreshes registered static sets through DA's `reloadEditable(main)` hook. Concurrent refreshes share a request. An unavailable legal target hides its region and removes generated static links; active mini-editor markup stays under DA's control.

## Real-set cutover

After the code and disposable draft QA pass, review and migrate the real set through the same manager workflow. The recovery record retains original/target snapshots. Preview the entire changed batch, then publish it through the normal content approval process. Updating only the set or only one page is incomplete.

A bare numeric superscript matching the selected set is a disclosure reference. Ordinary exponents should use non-reference notation such as Unicode superscript characters. The manager helper offers a supported way to make that choice without changing surrounding copy.

The user has already changed the existing schema to numeric-only. Retain legacy renderer compatibility while migrating saved content; all new authoring, insertion and helper choices use sequence numbers.


## Inline helper and open author refresh (November 6 update)

The inline helper runs in quick-edit even when Disclosure Manager is closed. It reads the native mini-editor's exposed EditorView and dispatches guarded transactions, preserving the native saving and Undo path. It shows an excerpt for a matching superscript and offers other existing disclosures for an unmatched number. Pointer choices retain editor focus; Alt+Up/Down chooses a number, Alt+Enter links it, and Escape dismisses. Unsupported, read-only, stale or external-link selections are left unchanged.

New numeric citations also resolve against existing letter sets by their sequence during phaseout. Manager insertion and audit use the same positional contract. Old letter citations remain readable until the reviewed conversion updates their source.

The manager signals a verified completed/restored batch through a same-origin BroadcastChannel. The quick-edit listener refreshes footer targets and static citations. It does not apply a second permutation: DA's native source collaboration carries saved superscript rewrites, then calls reloadEditable after settling. The current Canvas preview and inline plugin share the branch preview.da.live origin. Other origins do not receive that channel.

Verification: a saved-source heading probe updated the open Canvas without reload. A separate local compatibility page used DA's actual getSchema, EditorState and EditorView with the existing rendered homepage fragments. It showed all 13 choices, changed an unmatched superscript 27 to linked sequence 2, settled that link on blur, and showed the corresponding excerpt for a newly typed superscript 1. Screenshots are in test/screenshots/disclosure-inline-{sequence-choices,linked-sequence,matching-sequence}.png. The full shared-set conversion/reorder and DA Undo/save check still require the user to push these commits and run branch Canvas QA; no shared set was migrated by these checks.

## Live Canvas test page (November 8)

The user pushed through `ff92216`, and GitHub's branch head was verified. The existing draft `/drafts/disclosure-numbering-qa/set.json` was reused with sequence numbers 1–3 pointing to the existing brokerage-offer, trading-fees and futures-trading-fees fragments. The existing `consumer-a` page now selects that draft set and authors references `1`, `1`, `3,1`, `2`. The shared homepage set and legal fragments were left unchanged.

A fresh Canvas session loaded the three numbered disclosures and the corresponding namespaced links. The exact source transformation for swapping the first two entries was checked: expected existing references are `2`, `2`, `3,2`, `1`. The ready state is captured in `test/screenshots/disclosure-reorder-ready.png`.

The actual manager save and post-save Canvas update remain unverified. Browser automation could read the plugin iframe, but its click actions failed with “Click target is no longer available” and keyboard targeting failed with “Keyboard focus root is no longer available.” A manual Move 1 down → Review changes action was requested; no reorder save was performed. Do not treat this ready state or the source-transform check as proof of the live end-to-end reorder.
