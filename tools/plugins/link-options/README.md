# Link Options

A buildless DA Library URL helper for links and CTAs. Authors configure tracking through fields, copy the generated URL, and paste it into DA's existing **Edit link → URL** field. Display text, title, save and undo stay in DA's native link editor. The helper never writes page source or replaces editor selections.

## Use it

1. Select a complete link in DA, then open **Library → Link Options** to load its URL and tracking settings. Alternatively, paste a destination URL into the helper; this works without DA or authentication.
2. Toggle **Track clicks** and enter a stable **Tracking key**. **Advanced → Required consent** defaults to Advertising (`C0004`), with Analytics (`C0002`), both categories, and custom category IDs available. IDs must match the tenant's OneTrust policy. Every listed category is required before sending.
3. Click **Copy URL**. If browser clipboard access is blocked, the helper selects the generated URL and shows manual copy instructions.
4. Close the panel, open DA's native **Edit link** dialog, paste into **URL**, then **Save**. Save and preview the page separately in DA.

For example, `/home` with key `home-link` produces `/home?@tracking=home-link`. Choosing Analytics produces `/home?@tracking=home-link&@tracking-category=C0002`. The site's shared decorator converts the markers into `data-tracking-key` / `data-tracking-category` and removes them from the visitor's destination URL. Ordinary query parameters and fragments survive. Turning the toggle off removes only the reserved authoring markers. Pasting an existing marked URL loads its settings into the fields.

The helper reads a single selected anchor, including one serialized inside CTA table wrappers. If the selection contains multiple links or no anchor, paste the destination or select one link and use **Reload selection**. Selection access is optional: late or unavailable SDK connections leave manual authoring usable. Edits entered while the SDK is connecting are retained.

## Enable in DA

Push the plugin files with the project code first. In the [DA site configuration](https://da.live/config#/adobedrago/etrade/), add this row to the **library** tab, preserving its existing rows and columns:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Link Options | https://demo-controller--etrade--adobedrago.aem.live/tools/plugins/link-options/link-options.html | | | inline | demo-controller |

Open [the Home editor with the matching ref](https://da.live/edit?ref=demo-controller#/adobedrago/etrade/home), select the link, then open **Library → Link Options**. The ref selects plugin code; DA content is shared across branches. Review previewed content at [the demo-controller Home preview](https://demo-controller--etrade--adobedrago.aem.page/home).

For local development, use a separate library row with path `http://localhost:3000/tools/plugins/link-options/link-options.html`, experience `inline`, and ref `local`. Open `https://da.live/edit?ref=local#/adobedrago/etrade/home` with `npx -y @adobe/aem-cli up` running. For main, use the main branch's `.aem.live` URL and leave ref empty after the code is deployed there. No retired repository configuration files are needed.

Registration follows Adobe's [plugin tutorial](https://docs.da.live/developers/tutorials/eds-micro-frontends/2). The [DA SDK](https://github.com/adobe/da-nx/blob/main/nx/utils/sdk.js) is used only for `getSelection()` and `closeLibrary()`. No authentication tokens, page content, or settings are stored by this helper. The URL remains local until the author pastes it into DA.

## Review and tests

- Standalone: `/tools/plugins/link-options/link-options.html` accepts a pasted URL.
- Prefilled example: `/tools/plugins/link-options/link-options.html?demo=1` starts with a marked Home URL and a real campaign parameter.
- **Demo controls → Tracking → Open Link Options** opens the helper in a new tab.
- `npm run test:link-options` checks selection parsing, parameter preservation, runtime decoration, validation, toggling, copy fallback, and optional SDK behavior.
- `npm run test:tracking` verifies the site's tracking and consent queue contract.

SDK selection access must also be checked inside the authenticated DA editor after registration. The standalone page and mocked SDK tests do not establish that the plugin is enabled in the shared DA configuration.

## Why it copies a URL

The classic DA Library host parses `sendHTML()` as a closed document slice. In a reproduction with Adobe's editor library, replacing just an inline link split its paragraph, and replacing a link in a CTA cell nested a table. The helper therefore uses read-only selection access and the native link dialog for the actual edit. It does not modify or fork DA's built-in dialog.
