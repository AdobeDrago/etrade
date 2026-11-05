# Link Options

A buildless DA panel for links and CTAs. Authors load selected link text, configure its action and tracking, then **Apply to selected link** in supported Canvas blocks. DA owns save and Undo. **Copy URL** remains available for other selections and classic editor hosts. The helper does not write saved page source through the Source API.

## Use it

1. Select some or all of a link's text in DA. In Canvas, open **Outline → Extensions → Link Options**. In the classic editor, open **Library → Link Options**. Use **Load selected link** after changing the selection. Returning focus to the panel also reads the selection while the form has no unsaved edits. Alternatively, paste a destination URL into the panel.
2. Choose **Link action**: **Normal link** follows the authored destination; **Open cookie preferences** opens the site's real OneTrust preference center on the current page. No destination URL is needed for cookie preferences; the URL and page-condition fields are hidden for that action. Wording and icons do not select the action.
3. Optionally toggle **Track clicks** and enter a stable **Tracking key**. **Required consent** defaults to Advertising (`C0004`), with **None**, Analytics (`C0002`), both categories, and custom category IDs available. Every listed category is required before sending. **None** explicitly removes this link's category gate; it does not grant consent to other events or load tracking vendors.
4. Click **Apply to selected link** when enabled. The complete anchor is updated even when only part of its text was selected. Its wording, formatting, media and other links in the block are preserved. Save and preview separately; use DA's Undo to revert.
5. If Apply is unavailable, click **Copy URL**, open DA's native **Edit link** dialog, paste into **URL**, and Save. If clipboard access is blocked, select the generated URL and copy manually.

For example, `/home` with key `home-link` produces `/home?@tracking=home-link`. Choosing Analytics produces `/home?@tracking=home-link&@tracking-category=C0002`. The site's shared decorator converts the markers into `data-tracking-key` / `data-tracking-category` and removes them from the visitor's destination URL. Ordinary query parameters and fragments survive. Turning the toggle off removes only the reserved authoring markers. Pasting an existing marked URL loads its settings into the fields.

The helper reads a single selected anchor, including one serialized inside CTA table wrappers. If the selection contains multiple links or no anchor, paste the destination or select one link and use **Load selected link**. This reads the current editor selection without reloading the page or panel. Selection access is optional: late or unavailable SDK connections leave manual authoring usable. Edits entered while the SDK is connecting are retained.

Choosing **Open cookie preferences** produces the reserved token `@privacy-preferences`, with no destination or action query parameter. The runtime gives the control button semantics, cancels navigation, and opens OneTrust on the current page. New-tab targets are removed; Enter and Space activate the action. The visitor stays on the page while OneTrust loads or if it fails. The token requires the site runtime and is distinct from a section fragment: `#privacy-preferences` remains an ordinary section link. Wording and icons can be changed independently.

Optional click tracking uses the existing reserved tracking parameters; the shared decorator removes those parameters and retains the same-page action. Page-path destination conditions apply to normal links. Cookie preferences uses the same action on every page. Choosing **Normal link** shows the URL and condition fields again; enter a destination when converting an existing action-only link.

Existing footer content must be updated explicitly: load **Your Privacy Choices** from `/footer`, choose the action, copy `@privacy-preferences` back into DA's native link dialog, then save and preview. Older `@action=privacy-preferences` links still load into the helper and are copied in the new form. The runtime recognizes them too and replaces their external destinations with the same-page action. Deploy the shared runtime with the helper before authoring action links. The local `/test/privacy-action.html` review demonstrates an action link without an icon and a normal link with the privacy icon. The authoring helper never creates or styles a cookie banner.

If values change while clipboard permission is pending, the helper identifies the copied URL as the previous version and asks you to copy the current one again. A response from an earlier DA connection cannot replace the current fields; use **Load selected link** again after switching pages or connections.

## Inspect and condition a link

**What this link does** explains the selected wording, default destination, action, opening behavior, reporting key and consent. The summary updates with the form. Normal-link opening behavior comes from the selected anchor; for a pasted URL, it remains the behavior authored in DA. Cookie preferences always opens OneTrust on the current page.

Enable **Change this link on matching pages** to add one route rule. For example, `/brokerage, /what-we-offer` matches those exact page paths and their descendants, including `.html` variants. It does not match `/brokerage-other`. Supply alternate wording and destination together. **Preview on page path** shows the resulting wording and destination for a matching path or an unrelated path. Other pages keep the default destination and the wording authored in DA. The rule uses the page displaying the link, including links loaded from shared navigation, footer and content fragments.

The generated URL carries `@link-paths`, `@link-label` and `@link-url` authoring markers. The shared link decorator resolves them before tracking and button decoration, strips the markers from the delivered destination, and carries the same tracking/consent settings into either version. Ordinary query bytes and anchors survive. Invalid or incomplete rules retain the default link. Disabling the rule removes its markers. Rules support text links and text buttons; image/icon links retain their defaults. This version evaluates the page path on page load; it is not a campaign, signed-in-state or client-side SPA routing engine.

The authored default is still the anchor's destination and text if JavaScript is unavailable; the rule only enhances that link. Deploy the shared runtime with the tool before authoring route rules.

## Enable in DA

Push the plugin files with the project code first. In the [DA site configuration](https://da.live/config#/adobedrago/etrade/), add this row to the **library** tab, preserving its existing rows and columns. If Link Options is already registered, update that row instead of adding a duplicate. Set **experience** to `inline` and leave **ref** empty so authors can use the regular editor URL:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Link Options | https://demo--etrade--adobedrago.aem.live/tools/plugins/link-options/link-options.html | | | inline | |

Save the configuration, then reload [Home in New Authoring](https://da.live/canvas#/adobedrago/etrade/home). Select the link, then open **Outline dropdown → Extensions → Link Options**. Verify that the panel opens within DA, the selected link loads, **Copy URL** copies the configured URL, and **Close** returns to the editor. The absolute plugin **path** loads its code from `demo`; the empty **ref** makes the tool available without a special editor URL and alongside other editor refs. DA content is shared across branches. Review previewed content at [the demo Home preview](https://demo--etrade--adobedrago.aem.page/home).

If **Extensions** is missing from the Outline dropdown, confirm that the saved Link Options row has an empty **ref** cell, then reload the editor. A nonempty ref such as `demo-controller` restricts visibility to matching editor URLs (and local development). Use `inline` to keep the tool in the editor sidebar. Its layout adapts to the available panel width.

For local development, use a separate library row with path `http://localhost:3000/tools/plugins/link-options/link-options.html`, experience `inline`, and ref `local`. Open `https://da.live/canvas?ref=local#/adobedrago/etrade/home` with `npx -y @adobe/aem-cli up` running. After deploying the plugin code to main, update the shared row's path to the main branch's `.aem.live` URL and keep ref empty. No retired repository configuration files are needed.

DA hosts the panel and embeds the plugin URL. Its HTML, CSS and JavaScript must remain served at that URL for the integration to work. The published demo controls have no standalone Link Options shortcut; authoring starts in DA's Extensions picker (Library in the classic editor). This registration does not add fields to DA's built-in Edit link dialog.

Registration follows Adobe's [plugin tutorial](https://docs.da.live/developers/tutorials/eds-micro-frontends/2). The [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js) provides `getSelection()`, `subscribeLiveDocument()`, guarded `sendHTML(..., { replace: true, expected })`, and `closeLibrary()`. Live source is held only in memory. No authentication tokens, page content, or settings are persisted by this helper.

## Review and tests

- Local standalone review: `/tools/plugins/link-options/link-options.html` accepts a pasted URL without DA or authentication.
- Local prefilled example: `/tools/plugins/link-options/link-options.html?demo=1` starts with a marked Home URL and a real campaign parameter.
- `npm run test:link-options` checks selection parsing, parameter preservation, runtime decoration, validation, toggling, copy fallback, and optional SDK behavior.
- `npm run test:tracking` verifies the site's tracking and consent queue contract.

SDK selection access must also be checked inside the authenticated DA editor after registration. The standalone page and mocked SDK tests do not establish that the plugin is enabled in the shared DA configuration.

## Direct Apply and compatibility

The classic DA Library host parses `sendHTML()` as a closed document slice. In a reproduction with Adobe's editor library, replacing just an inline link split its paragraph, and replacing a link in a CTA cell nested a table. The helper therefore uses read-only selection access and the native link dialog for the actual edit. It does not modify or fork DA's built-in dialog.

The newer Canvas host supports guarded replacement of a whole selected block. The helper changes one unambiguous anchor in a copy of that block, then sends the block with the exact live document and selected-block index as a precondition. The host rejects stale content or a moved selection. Duplicate matching anchors, read-only documents, plain paragraphs outside blocks and older hosts keep Apply disabled. Selection is checked again before sending. This avoids the classic host's inline-slice insertion behavior; there is no unguarded `sendHTML()` write fallback.

Authenticated acceptance still needs checks in DA: select partial text in a Footer or CTA block, apply, verify surrounding rows and formatting, Undo, then save/reload. The unit tests cover block preservation and stale-selection refusal but do not replace those host checks.

## Cookie banner review

Open [the PR preview with the explicit banner flag](https://fix-40-privacy-choices--etrade--adobedrago.aem.page/home?cookiebanner=true), or use `?cookiebanner=1`. This opt-in works only on this repository's `.aem.page` previews and local development. It starts the real OneTrust SDK after content loads and takes priority over performance simulations and dummy `consent=accept` overrides.

On the preview host, the flag clears only the `OptanonAlertBoxClosed` dismissal cookie before starting the SDK so a fresh load can show its banner again. It leaves `OptanonConsent` and actual category choices intact. The tenant's geographic/banner configuration still applies. This follows OneTrust's [banner API prerequisites](https://developer.onetrust.com/onetrust/docs/javascript-api); it does not simulate a grant or rejection. Capture the visible banner and the Privacy Choices preference center for PR/QA evidence, and include the query parameter with the screenshot. Authenticated browser capture remains pending.
