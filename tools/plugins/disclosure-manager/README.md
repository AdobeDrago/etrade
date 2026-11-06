# Disclosure Manager

A DA Library plugin for this project's ID-based disclosure sets. Inspired by [Peter Stolmar's Disclosure Manager](https://github.com/peterstolmar-vml/eds/tree/main/tools/plugins/disclosure-manager), adapted to the site's [disclosure set and reference contract](../../../blocks/disclosures/README.md). This implementation reads DA markup with the DOM rather than the original demo's HTML regular expressions. It has no build step or additional dependencies.

## Enable in DA

Deploy the plugin's HTML, CSS and JavaScript with the project's code first. In the [site's DA configuration](https://da.live/config#/adobedrago/etrade/), add this row to the **library** tab:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Disclosure Manager | https://demo--etrade--adobedrago.aem.live/tools/plugins/disclosure-manager/disclosure-manager.html | | | inline | |

The deployed plugin code lives on `demo`. Leave ref empty so the plugin is available from the regular editor URL. Open [the homepage editor](https://da.live/canvas#/adobedrago/etrade/home), then **Outline dropdown → Disclosure Manager**. In the classic editor use **Library → Disclosure Manager**. Use the plugin URL without `?demo=1` for real authoring. The URL's branch selects the plugin code; DA source content is shared across branches. An editor `?ref=demo` is only needed when reviewing the demo branch's site rendering inside DA. Review previewed content on [the demo homepage](https://demo--etrade--adobedrago.aem.page/home).

For local development, run `npx -y @adobe/aem-cli up` and add a separate row:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Disclosure Manager (local) | http://localhost:3000/tools/plugins/disclosure-manager/disclosure-manager.html | | | inline | local |

Open [the homepage editor with the local ref](https://da.live/edit?ref=local#/adobedrago/etrade/home), then **Library → Disclosure Manager (local)**. Adobe documents this registration and local-ref workflow in [Build your basic plugin](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin). Do not commit an old `fstab.yaml` or other retired configuration file to register the plugin.

The plugin connects through the [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js). Requests use its `daFetch` action, including DA's authentication and token refresh. Source documents load and save through Adobe's [Source API](https://docs.da.live/developers/api/source) using multipart `data` uploads. No tokens are written to files or browser storage by this plugin.

## Authoring

1. Save the current page in DA. Its Metadata **Disclosures** row selects a set under `/disclosures/sets/` or a site JSON document with the same structure.
2. Open Disclosure Manager. Review each disclosure's title, excerpt and **Source and reference** details. The footer preview preserves supporting fragments and legal copy. Numeric sets require available, nonempty disclosure fragments; an item cannot be silently omitted and shift later numbers.
3. Existing letter-ID sets offer **Convert to numbered references**. Numeric sets offer **Review changes** after a drag or **Move up/down**. The review shows the old-to-new mapping and every changed source. It checks all pages, drafts, nested fragments and supported structured fields. Other pages' normal hyperlinks are not embedded-content dependencies.
4. Resolve every blocking issue before **Save changes**. A shared fragment used under incompatible sets must be separated or qualified first. Previously unresolved numeric superscripts in a legacy set require explicit confirmation of their positional-citation intent. The manager does not guess whether they are mathematical exponents.
5. Saving updates the set and its citation sources together. Moving disclosure 1 to position 3 makes it ID 3 and changes existing citations 1 → 3, keeping their legal target. Manually editing a citation to 2 instead chooses the current second disclosure.
6. **Insert reference** inserts selected saved numbers through DA's normal selection/save/undo flow, e.g. `<sup>2,1</sup>`. Insertion is disabled during an unsaved reorder. Put the cursor after the claim; insertion replaces a selected range.
7. Preview the listed changed sources together, then publish separately through the site's normal workflow. A source save does not itself update preview delivery or publish anything.

The set's `id` namespaces its anchors: set `homepage`, number `1` targets `#disclosure-homepage-1`. Authors normally type plain superscript numbers; explicit `homepage-1` references are also supported for that selected set. Numeric IDs must exactly match array positions. Use the manager to reorder; editing only the structured form's order does not update page citations.

The **Audit** tab checks the saved current page, including grouped and linked citations. The batch review additionally discovers all affected sources. An unmatched marker remains authored. A plain numeric superscript matching the selected numeric set counts as a disclosure citation; use ordinary Unicode superscript characters, such as ², for an exponent with the same number.

Legacy stable-ID rendering and old numeric legal documents remain compatible. Converting a structured set and its consumers is explicit. Legacy tables/documents must first be migrated to a structured set; the tool does not infer legal identities from arbitrary documents.

## Disclosure assistant

With a saved numbered set loaded, leave the manager open while authoring a numeric superscript. The assistant offers the matching disclosure excerpt, **Link disclosure**, **Keep as ordinary superscript**, and **Dismiss**. **Check selected superscript** also checks a selected number or comma-separated group. Keeping an ordinary superscript explicitly converts its digits to Unicode superscript characters, such as `²`, retaining surrounding formatting.

Applying a suggestion requires DA's supported, version-guarded block replacement capability and an unambiguous current selection. Older hosts and ambiguous selections offer copy options. No unguarded replacement is attempted. Reordering or an unfinished recovery disables assistant edits until the set is saved.

In Canvas quick-edit rendering, focusing or hovering a rendered disclosure reference shows its actual legal excerpt beside the reference. Escape closes this read-only hint. It lives outside authored content, does not alter an active editor, and is absent on the public website. Linking decisions stay in the manager.

## Interrupted saves and collaboration

DA's Source API writes individual documents. The tool checks exact source snapshots and the complete consumer inventory before saving, verifies writes, and stores a recovery manifest under `/.da/disclosure-manager/renumber-jobs/`. The manifest contains original/target source snapshots and integrity hashes; credentials are never persisted. Completed manifests are retained when a new operation starts.

If a save fails, the tool restores only sources still matching that operation's output. Collaborator edits are preserved and reported. Reopening the manager detects unfinished work and offers **Resume change** or **Restore original sources**. A new reorder stays blocked until recovery is resolved. A timed-out POST is checked by reading its actual result, so a permutation is not applied twice.

These checks are optimistic; the API has no multi-document transaction or atomic edit lock. Authors should wait for the reviewed batch to finish before editing its sources. Review the entire changed batch before previewing or publishing.

## Schema rollout

See [the schema and migration procedure](../../../docs/disclosure-numbering-rollout.md). The existing schema keeps its name, fragment choices and fields. Its identifier pattern transitions from letter-only to legacy-or-numeric strings; there is no separate editable number field. Form-based conversion is blocked until the live schema accepts the new numbers. JSON sets use their own explicit source contract.

## Local review

Open `http://localhost:3000/tools/plugins/disclosure-manager/disclosure-manager.html?demo=1` (or the port printed by AEM CLI). The demo includes two consuming pages, shared content, grouped/repeated citations, an unmatched marker and an unreferenced disclosure. Review and save use the real planning/recovery code with an in-memory API; they do not write DA content. Reloading the browser resets it. Add `&recovery=1` to inspect an interrupted operation with a collaborator conflict.

After conversion, **Try a new superscript (demo)** exercises assistant linking and ordinary-superscript choices against the same guarded interface in memory.

Run `npm run test:disclosure-manager`, `npm run test:disclosures`, and `npm test` for transformation, discovery, recovery, editor lifecycle and interface checks. The demo does not replace authenticated Canvas checks of SDK editing, source permissions and preview propagation.
