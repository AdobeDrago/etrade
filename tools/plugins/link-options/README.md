# Link Options

A buildless DA Library panel for links and CTAs. Authors configure tracking inside DA, copy the generated URL, and paste it into DA's existing **Edit link → URL** field. Display text, title, save and undo stay in DA's native link editor. The helper never writes page source or replaces editor selections.

## Use it

1. Select a complete link in DA. In New Authoring, open the **Outline** dropdown at the top of the right sidebar and choose **Link Options** under **Extensions**. In the classic editor, open **Library → Link Options**. The panel opens alongside the editor and loads the link's URL and tracking settings. Alternatively, paste a destination URL into the panel.
2. Toggle **Track clicks** and enter a stable **Tracking key**. **Consent settings → Required consent** defaults to Advertising (`C0004`), with Analytics (`C0002`), both categories, and custom category IDs available. IDs must match the tenant's OneTrust policy. Every listed category is required before sending.
3. Click **Copy URL**. If browser clipboard access is blocked, the helper selects the generated URL and shows manual copy instructions.
4. Close Link Options, open DA's native **Edit link** dialog, paste into **URL**, then **Save**. Save and preview the page separately in DA.

For example, `/home` with key `home-link` produces `/home?@tracking=home-link`. Choosing Analytics produces `/home?@tracking=home-link&@tracking-category=C0002`. The site's shared decorator converts the markers into `data-tracking-key` / `data-tracking-category` and removes them from the visitor's destination URL. Ordinary query parameters and fragments survive. Turning the toggle off removes only the reserved authoring markers. Pasting an existing marked URL loads its settings into the fields.

The helper reads a single selected anchor, including one serialized inside CTA table wrappers. If the selection contains multiple links or no anchor, paste the destination or select one link and use **Load selected link**. This reads the current editor selection without reloading the page or panel. Selection access is optional: late or unavailable SDK connections leave manual authoring usable. Edits entered while the SDK is connecting are retained.

If values change while clipboard permission is pending, the helper identifies the copied URL as the previous version and asks you to copy the current one again. A response from an earlier DA connection cannot replace the current fields; use **Load selected link** again after switching pages or connections.

## Inspect and condition a link

**What this link does** explains the selected wording, default destination, opening behavior, reporting key and consent. The summary updates with the form. Opening behavior comes from the selected anchor; for a pasted URL, it remains the behavior authored in DA.

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

Registration follows Adobe's [plugin tutorial](https://docs.da.live/developers/tutorials/eds-micro-frontends/2). The [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js) is used only for `getSelection()` and `closeLibrary()`. No authentication tokens, page content, or settings are stored by this helper. The URL remains local until the author pastes it into DA.

## Review and tests

- Local standalone review: `/tools/plugins/link-options/link-options.html` accepts a pasted URL without DA or authentication.
- Local prefilled example: `/tools/plugins/link-options/link-options.html?demo=1` starts with a marked Home URL and a real campaign parameter.
- `npm run test:link-options` checks selection parsing, parameter preservation, runtime decoration, validation, toggling, copy fallback, and optional SDK behavior.
- `npm run test:tracking` verifies the site's tracking and consent queue contract.

SDK selection access must also be checked inside the authenticated DA editor after registration. The standalone page and mocked SDK tests do not establish that the plugin is enabled in the shared DA configuration.

## Why it copies a URL

The classic DA Library host parses `sendHTML()` as a closed document slice. In a reproduction with Adobe's editor library, replacing just an inline link split its paragraph, and replacing a link in a CTA cell nested a table. The helper therefore uses read-only selection access and the native link dialog for the actual edit. It does not modify or fork DA's built-in dialog.

The newer SDK supports guarded replacement of a whole selected block. It does not offer an anchor-only edit action. Direct Apply remains a separate integration task requiring preservation and Undo checks against the deployed DA host; this iteration retains the native link edit workflow.
