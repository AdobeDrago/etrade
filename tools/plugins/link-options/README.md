# Link Options

A buildless DA Library dialog for links and CTAs. Authors configure tracking inside DA, copy the generated URL, and paste it into DA's existing **Edit link → URL** field. Display text, title, save and undo stay in DA's native link editor. The helper never writes page source or replaces editor selections.

## Use it

1. Select a complete link in DA. In New Authoring, open the **Outline** dropdown at the top of the right sidebar and choose **Link Options** under **Extensions**. In the classic editor, open **Library → Link Options**. The dialog opens over the editor and loads the link's URL and tracking settings. Alternatively, paste a destination URL into the dialog.
2. Toggle **Track clicks** and enter a stable **Tracking key**. **Advanced → Required consent** defaults to Advertising (`C0004`), with Analytics (`C0002`), both categories, and custom category IDs available. IDs must match the tenant's OneTrust policy. Every listed category is required before sending.
3. Click **Copy URL**. If browser clipboard access is blocked, the helper selects the generated URL and shows manual copy instructions.
4. Close Link Options, open DA's native **Edit link** dialog, paste into **URL**, then **Save**. Save and preview the page separately in DA.

For example, `/home` with key `home-link` produces `/home?@tracking=home-link`. Choosing Analytics produces `/home?@tracking=home-link&@tracking-category=C0002`. The site's shared decorator converts the markers into `data-tracking-key` / `data-tracking-category` and removes them from the visitor's destination URL. Ordinary query parameters and fragments survive. Turning the toggle off removes only the reserved authoring markers. Pasting an existing marked URL loads its settings into the fields.

The helper reads a single selected anchor, including one serialized inside CTA table wrappers. If the selection contains multiple links or no anchor, paste the destination or select one link and use **Load selected link**. This reads the current editor selection without reloading the page or dialog. Selection access is optional: late or unavailable SDK connections leave manual authoring usable. Edits entered while the SDK is connecting are retained.

If values change while clipboard permission is pending, the helper identifies the copied URL as the previous version and asks you to copy the current one again. A response from an earlier DA connection cannot replace the current fields; use **Load selected link** again after switching pages or connections.

## Enable in DA

Push the plugin files with the project code first. In the [DA site configuration](https://da.live/config#/adobedrago/etrade/), add this row to the **library** tab, preserving its existing rows and columns. If Link Options is already registered, update that row instead of adding a duplicate. Set **experience** to `fullsize-dialog` and leave **ref** empty so authors can use the regular editor URL:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Link Options | https://demo--etrade--adobedrago.aem.live/tools/plugins/link-options/link-options.html | | | fullsize-dialog | |

Save the configuration, then reload [Home in New Authoring](https://da.live/canvas#/adobedrago/etrade/home). Select the link, then open **Outline dropdown → Extensions → Link Options**. Verify that the dialog opens within DA, the selected link loads, **Copy URL** copies the configured URL, and **Close** returns to the editor. The absolute plugin **path** loads its code from `demo`; the empty **ref** makes the tool available without a special editor URL and alongside other editor refs. DA content is shared across branches. Review previewed content at [the demo Home preview](https://demo--etrade--adobedrago.aem.page/home).

If **Extensions** is missing from the Outline dropdown, confirm that the saved Link Options row has an empty **ref** cell, then reload the editor. A nonempty ref such as `demo-controller` restricts visibility to matching editor URLs (and local development). `fullsize-dialog` opens a modal in New Authoring; the classic editor also accepts this value. Plain `dialog` uses the classic editor's modal but appears as a sidebar tool in New Authoring.

For local development, use a separate library row with path `http://localhost:3000/tools/plugins/link-options/link-options.html`, experience `fullsize-dialog`, and ref `local`. Open `https://da.live/canvas?ref=local#/adobedrago/etrade/home` with `npx -y @adobe/aem-cli up` running. After deploying the plugin code to main, update the shared row's path to the main branch's `.aem.live` URL and keep ref empty. No retired repository configuration files are needed.

DA hosts the dialog and embeds the plugin URL. Its HTML, CSS and JavaScript must remain served at that URL for the integration to work. The published demo controls have no standalone Link Options shortcut; authoring starts in DA's Extensions picker (Library in the classic editor). This registration does not add fields to DA's built-in Edit link dialog.

Registration follows Adobe's [plugin tutorial](https://docs.da.live/developers/tutorials/eds-micro-frontends/2). The [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js) is used only for `getSelection()` and `closeLibrary()`. No authentication tokens, page content, or settings are stored by this helper. The URL remains local until the author pastes it into DA.

## Review and tests

- Local standalone review: `/tools/plugins/link-options/link-options.html` accepts a pasted URL without DA or authentication.
- Local prefilled example: `/tools/plugins/link-options/link-options.html?demo=1` starts with a marked Home URL and a real campaign parameter.
- `npm run test:link-options` checks selection parsing, parameter preservation, runtime decoration, validation, toggling, copy fallback, and optional SDK behavior.
- `npm run test:tracking` verifies the site's tracking and consent queue contract.

SDK selection access must also be checked inside the authenticated DA editor after registration. The standalone page and mocked SDK tests do not establish that the plugin is enabled in the shared DA configuration.

## Why it copies a URL

The classic DA Library host parses `sendHTML()` as a closed document slice. In a reproduction with Adobe's editor library, replacing just an inline link split its paragraph, and replacing a link in a CTA cell nested a table. The helper therefore uses read-only selection access and the native link dialog for the actual edit. It does not modify or fork DA's built-in dialog.
