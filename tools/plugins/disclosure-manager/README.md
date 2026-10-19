# Disclosure Manager

A DA Library plugin for this project's ID-based disclosure sets. Inspired by [Peter Stolmar's Disclosure Manager](https://github.com/peterstolmar-vml/eds/tree/main/tools/plugins/disclosure-manager), adapted to the site's [disclosure set and reference contract](../../../blocks/disclosures/README.md). This implementation reads DA markup with the DOM rather than the original demo's HTML regular expressions. It has no build step or additional dependencies.

## Enable in DA

Deploy the plugin's HTML, CSS and JavaScript with the project's code first. In the [site's DA configuration](https://da.live/config#/adobedrago/etrade/), add this row to the **library** tab:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Disclosure Manager | https://main--etrade--adobedrago.aem.live/tools/plugins/disclosure-manager/disclosure-manager.html | | | inline | |

To test this work on `et-scui`, push that branch and add a branch-specific row instead:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Disclosure Manager (et-scui) | https://et-scui--etrade--adobedrago.aem.live/tools/plugins/disclosure-manager/disclosure-manager.html | | | inline | et-scui |

Open [the homepage editor with the et-scui ref](https://da.live/edit?ref=et-scui#/adobedrago/etrade/home), then **Library → Disclosure Manager (et-scui)**. Use the URL without `?demo=1` for real authoring. The branch selects the plugin code; DA source content is shared across branches. Review previewed content on [the et-scui homepage](https://et-scui--etrade--adobedrago.aem.page/home). A repo change alone does not register a DA Library plugin: the row above must be saved in DA's site configuration.

For local development, run `npx -y @adobe/aem-cli up` and add a separate row:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Disclosure Manager (local) | http://localhost:3000/tools/plugins/disclosure-manager/disclosure-manager.html | | | inline | local |

Open [the homepage editor with the local ref](https://da.live/edit?ref=local#/adobedrago/etrade/home), then **Library → Disclosure Manager (local)**. Adobe documents this registration and local-ref workflow in [Build your basic plugin](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin). Do not commit an old `fstab.yaml` or other retired configuration file to register the plugin.

The plugin connects through the [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js). Requests use its `daFetch` action, including DA's authentication and token refresh. Source documents load and save through Adobe's [Source API](https://docs.da.live/developers/api/source) using multipart `data` uploads. No tokens are written to files or browser storage by this plugin.

## Authoring

1. Save the page in DA. Its Metadata **Disclosures** row must reference an existing `/disclosures/sets/...` document using the `disclosure-set` schema, or a site JSON document with the same `disclosures` array. Full project preview/live URLs and Adobe structured-content delivery URLs are supported.
2. Open Disclosure Manager from the Library. It reads the saved page, resolves its set, and checks the referenced fragment sources. Each item shows its stable ID, fragment path, and expected display number. **Find a disclosure** searches IDs, paths and saved copy. **Preview saved copy** expands formatted text, links and lists without loading media or executing authored markup. **Edit fragment** opens that fragment in DA. **Edit set**, **Browse sets** and **Browse fragments** open the corresponding authoring locations. Refresh after saving source edits; these are saved-source previews, not the unsaved editor state or a rendering of the published page. Introduction and closing fragments are outside this numbered-item preview. Empty fragments are excluded from numbering, matching the site's renderer. Missing fragments and invalid or duplicate IDs disable saving and inserting until corrected in the set editor.
3. Drag items or use **Move up/down**. **Reset order** restores the loaded order. **Save order** saves only the set document; it preserves introduction, closing, schema metadata, fragment contents, other fields, and stable IDs. The page is never rewritten. If the source changed since loading, saving stops and asks you to refresh. This check does not provide an atomic lock against simultaneous edits.
   Clear search before reordering. Filtering retains the complete set's display numbers and current selections; the selection summary includes IDs hidden by search.
4. Place the editor cursor after a claim, open the manager, select one or more disclosures, and click **Insert reference**. Selection order determines the comma-separated marker, such as `<sup>fees,offer</sup>`. This inserts via the DA editor's `sendHTML` action, keeping the page's normal save/undo flow. Save the page afterward. Insert is disabled while a reorder is unsaved. Use a cursor with no selected claim text because insertion replaces the editor selection.
5. Preview the changed set and every fragment in DA before reviewing `.aem.page`. Publish the set, fragments and page as needed for `.aem.live` or production. Saving the order does not preview or publish content.

**Audit** checks the saved page's bare, grouped and already linked superscripts. It reports matching links, missing IDs, numeric markers that need migration, and references embedded in a larger link. External links are preserved. It reports disclosures without a reference in the saved page as an advisory: references inside separately loaded page fragments are outside this audit. Refresh after saving page edits to update the audit.

Legacy numeric tables/documents require migration to an ID-based disclosure set before using the manager. It never guesses which existing numeric citation should become which stable ID. Rates, offer terms and legal copy remain authored in their existing documents.

## Local review

Open `http://localhost:3000/tools/plugins/disclosure-manager/disclosure-manager.html?demo=1` for a standalone demo. It includes repeated and grouped references, a missing target, and an unreferenced disclosure. Reorder, save and insert operations stay in memory; no DA API or authentication calls occur. Refresh restores the current in-memory saved order; reloading the browser resets the demo.

Run `npm run test:disclosure-manager` for source parsing/preservation, audits, safe saves and the UI workflow. Run `npm run test:disclosures` for the site's automatic numbering/linking contract. The demo verifies the plugin interface; it does not replace testing SDK insertion and permissions inside the authenticated DA editor.

## Connection troubleshooting

- **Plugin is absent:** verify the row is on the site's **library** tab, save the configuration, and open the editor with the matching `?ref=et-scui` or `?ref=local` before `#`. A repo `tools/sidekick/config.json` does not register plugins in the DA editor.
- **Plugin URL fails:** open the row's exact HTML URL directly. Branch code must be pushed and available through AEM Code Sync. Local rows require the local AEM server. The direct page offers the standalone demo; real page context is available only when embedded by DA.
- **Connecting never finishes:** the shared SDK loader now reports a timeout and offers **Retry connection**. Sign in to DA, verify the row's path/ref, and reopen the Library or reload the plugin frame. The SDK handshake, source read and source write permissions need verification in the authenticated editor. Extensions that modify request headers can interfere with the SDK handshake.
- **No disclosures found:** save the page Metadata `Disclosures` value and use an ID-based set. The manager does not create or migrate schemas. Confirm the existing schema in [Schema Editor](https://da.live/apps/schema#/adobedrago/etrade).
- **Wrong editor opens for sets:** in the [organization configuration](https://da.live/config#/adobedrago/), verify the `editor.path` mapping `/adobedrago/etrade/disclosures/sets=https://da.live/form#`. Keep rich-text fragments in the ordinary document editor. See [Adobe's structured content setup](https://www.aem.live/docs/ew/administering/structured-content).
- **Saved content is absent from preview/live:** preview or publish the set and its fragments separately. Code branch refs do not isolate authored content or publish it.

See [the shared authoring helpers](../README.md) when building the same experience for another structured content type.
