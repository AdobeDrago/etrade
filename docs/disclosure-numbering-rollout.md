# Disclosure numbering rollout

The feature keeps the existing `disclosure-set` schema and changes its authoring contract to sequential numeric identifiers. Code and DA content have separate delivery lifecycles.

## Verification at handoff

On 2026-11-06, the local implementation passed all 431 tests and project lint checks. A fresh branch review found and verified fixes for automatically embedded fragment discovery, JSON links/selectors, unresolved edited numbers, unrelated selected superscripts, numeric-collision approval scope, and hosts without automatic page saving. Each correction has a regression that failed before the fix.

Local browser checks covered conversion and reviewed batch saving, both assistant choices, desktop/mobile layout, and keyboard focus/Escape for the inline preview. Screenshots: [desktop manager](../test/screenshots/disclosure-assistant-desktop.jpg), [mobile manager](../test/screenshots/disclosure-assistant-mobile.jpg), [inline preview fixture](../test/screenshots/disclosure-inline-helper.jpg). These are local demo/fixture results, not authenticated source-write evidence.

The live schema and Card reference fields were inspected after Adobe sign-in; the schema patch preserves all 36 existing fragment options. No live schema, Library configuration or content was changed. The user will push `codex/rework-disclosure-numbering`; deployed branch checks and disposable Canvas save/Undo/preview tests remain required after that push. This branch must not be treated as content-rollout approval.

The implementation uses one fresh whole-branch review after inline development rather than separate reviewers for every task. The ordinary-superscript choice uses Unicode characters because generic mark attributes cannot be assumed to survive the editor. Helper implementation preceded authenticated integration testing so its full code could be reviewed before granting editing access; real-host issues can still surface during the post-push checks.

## Enable compatible code first

Deploy the backward-compatible renderer and Disclosure Manager before migrating real content. Use a separate plugin registration and disposable draft sources for branch QA. DA sources are shared across code branches: changing homepage content while another active branch still understands only letter IDs can break that branch's footer.

Do not migrate the real homepage as part of merely reviewing the feature PR. Merge/deploy compatible code through the normal process, then schedule the source/schema migration and content review.

## Patch the existing schema

1. Open [Schema Editor](https://da.live/apps/schema), load `/adobedrago/etrade`, and select **Disclosure set**.
2. Copy/export the existing complete JSON as a backup. Preserve the `FragmentPath` definition and all its current `enum`/`enumNames` choices. The live schema inspected on 2026-11-06 had 36 fragment options.
3. In `properties.disclosures.items.properties.disclosureId`, retain `type: "string"` and `minLength: 1`; change:
   - `title`: `Disclosure number`
   - `pattern`: `^(?:[a-z][a-z0-9]*|[1-9][0-9]*)$`
   - `description`: `Use Disclosure Manager to number disclosures and update references together. Existing letter identifiers remain valid until migrated.`
4. Update `properties.disclosures.description` to explain that order and numbers must agree and reordering belongs in Disclosure Manager.
5. Keep the schema name, set ID field, fragment references, supporting arrays and unrelated definitions intact. Save the schema only after it validates.
6. If the disclosure item uses a same-document `$ref`, apply the identifier changes in that referenced definition instead.

The pure `numberedDisclosureSchema(schema)` function in [renumber.js](../tools/plugins/disclosure-manager/renumber.js) applies exactly this transformation to a cloned schema. It preserves the site's fragment definitions. It was also checked against the copied live schema. It is a patch helper, not a replacement schema with a fixed list of legal fragments.

The field remains a string so existing letter sets survive the transition. A migrated set must have IDs "1", "2", ... "N" in that order, with a valid namespace such as `homepage`. Application validation enforces the full sequence. A separate stored/display-number field is not introduced.

Existing card schemas' `disclosureIds` string arrays and `bodyFragment` field remain supported. Their descriptive labels may be updated to say disclosure references/numbers; their property names do not need to change.

## Migrate a disposable set and its consumers

1. Create draft test pages, shared fragments and a test set with a unique namespace. Include repeated citations, grouped citations, a citation inside a table, a shared fragment and two consuming pages.
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

Keep legacy compatibility during migration. Tightening the schema to numeric-only is a separate cleanup after every relevant set and consumer has been migrated and verified.
