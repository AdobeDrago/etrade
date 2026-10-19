# Authoring tools

The DA Library tools are the local [Disclosure Manager](disclosure-manager/README.md) and Adobe's hosted [Fragment Picker](fragments/README.md). Their setup guides contain the exact `et-scui` and local configuration rows. There is no Sidekick block-library loader in this checkout. DA Library registration lives in the site's [DA configuration](https://da.live/config#/adobedrago/etrade/), not in a repository Sidekick file. Adobe documents the [DA Library setup](https://www.aem.live/docs/ew/administering/set-up-library) and [plugin ref workflow](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin).

## Reuse for other structured content

Keep authoring controls in a DA plugin. The public block remains responsible for rendering delivered content. The reusable helpers in `shared/` provide:

- `da-sdk.js`: `connectDA()` imports Adobe's hosted SDK, waits for context and authenticated `daFetch`, validates the connection, and reports failed or stalled connections. The host plugin decides how to display errors and retry. Adobe's SDK owns authentication and refresh.
- `da-source.js`: `sourceUrl()` and `readSource()` restrict authenticated reads to the SDK's current site; `authoringUrl()` creates document, form, sheet and folder links; `sourcePreview()` creates a passive preview of saved rich text for search and inspection. Preview links resolve against this site's main preview host. Authored scripts, embedded frames, event handlers and media requests are omitted. This helper is a copy preview, not a full page renderer.

For another schema, reuse these helpers and implement its own parsing, validation and save operation. Start with read-only search, copy previews and links to the form editor. Add writes only when that schema's fields and preservation rules are defined. The Disclosure Manager's `model.js` stays specific to disclosure sets, stable IDs and reference audits.

Do not wrap one SDK plugin inside another iframe: the plugin registered in DA needs the host's context handshake. Register each plugin's HTML entry directly in the Library. Existing block/template JSON catalog rows can remain alongside plugin rows.

## Verification

`npm run test:disclosure-manager` covers source preservation, request boundaries, safe copy previews, SDK connection failures, filtering, selection retention, reordering, insertion and the demo save workflow. `npm run test:disclosures` covers the delivered footer contract. The standalone demo performs no DA writes.

`npm run test:fragments` verifies compatibility with the hosted Fragment Picker's output, legacy links, nested fragments, disclosure references and failure handling. Register the picker directly at Adobe's hosted HTML URL using `fullsize-dialog`; it does not use the local plugin's SDK loader or need a local wrapper.

After registering the local or branch row, verify these steps inside a signed-in DA editor on a suitable test page/set:

1. Open the Library plugin; confirm that the context resolves to the current page and set.
2. Search by copy and ID; expand a preview and follow the fragment/form links.
3. Insert a stable-ID marker at an empty cursor position; verify normal editor undo/save.
4. Reorder and save the set; refresh and confirm the saved order. This updates shared DA source even when opened with a branch ref.
5. Preview the affected page, set and fragments; check matching numbers and anchors on [et-scui](https://et-scui--etrade--adobedrago.aem.page/home).

Local automated and demo checks do not certify DA permissions, the host SDK handshake or published content. No new dependencies or build step are required.
