# Fragment Picker

Use Adobe's hosted [Fragment Picker plugin](https://github.com/adobe-rnd/aem-apps/tree/main/tools/plugins/fragments) directly in the DA Library. It provides a searchable folder tree, a live preview pane, keyboard navigation and fragment-link insertion. There is no local copy of Adobe's plugin to build or maintain.

## Register in DA

In the site's [DA configuration](https://da.live/config#/adobedrago/etrade/), add the following row to the **library** tab alongside Disclosure Manager. Preserve existing Library rows. Save the configuration using the paper plane menu.

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Fragment Picker (et-scui) | https://main--aem-apps--adobe-rnd.aem.page/tools/plugins/fragments/fragments.html | | | fullsize-dialog | et-scui |

Open [the et-scui homepage editor](https://da.live/edit?ref=et-scui#/adobedrago/etrade/home), then **Library → Fragment Picker (et-scui)**. The plugin is hosted by Adobe; the `ref` controls which editor session displays its Library entry. Push this branch's site compatibility change before reviewing [the branch homepage](https://et-scui--etrade--AdobeDrago.aem.page/home).

For local testing of the site code, use this row and [the local-ref editor](https://da.live/edit?ref=local#/adobedrago/etrade/home):

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Fragment Picker (local) | https://main--aem-apps--adobe-rnd.aem.page/tools/plugins/fragments/fragments.html | | | fullsize-dialog | local |

The local entry still loads Adobe's hosted picker. Run the local AEM server to review the inserted content on `localhost:3000`. After the compatibility change ships to `main`, the ordinary entry can use title **Fragment Picker** and an empty `ref`. This DA configuration is separate from the AEM delivery configuration at tools.aem.live; no retired repository YAML files are needed.

## Content and preview

The upstream plugin discovers folders named `fragments` at the root or up to two directory levels below it, then crawls their subfolders for HTML documents. This includes `/fragments` and `/disclosures/fragments`, as well as locale-specific fragment folders. It uses the current DA organization/repository context. Missing or inaccessible content requires checking the author's DA permissions and the source folders.

Select a document to preview it, then choose **Insert** with the editor cursor in its own empty paragraph. The plugin inserts a link such as:

```html
<a href="https://main--etrade--adobedrago.aem.page/fragments/example" class="fragment">https://main--etrade--adobedrago.aem.page/fragments/example</a>
```

The picker previews against `main` on `.aem.page`. Preview the selected fragment in DA before relying on that pane. A preview that shows sign-in or a missing document requires authenticating to the site's preview environment or previewing the source. The site's loader resolves the inserted path against the current page environment, so the same authored link works on the branch, localhost and published site. Publish fragment content separately before live use.

## Site compatibility

`scripts/scripts.js` accepts both the picker's `a.fragment` output and existing bare fragment links. Only ancestor Fragment blocks suppress automatic loading; an anchor's own `fragment` class no longer prevents it. Paths ending in `.html` or `.plain.html` are normalized before the existing fragment loader requests `.plain.html` from the current origin.

Automatic inclusion requires a standalone paragraph containing only that link. Inline links, paragraphs with multiple links or images, and foreign-site URLs stay authored so adjacent content is preserved. Explicit Fragment blocks retain their own decoration path. A failed fragment request retains the authored link and logs the failure; it does not generate replacement copy. Loaded content keeps the existing block decoration and disclosure-reference linking behavior, including nested fragments.

The picker inserts reusable rich-text content; it does not add an item to a structured disclosure set or create a stable-ID citation. Use Disclosure Manager for set order and references. To change a disclosure set's `fragment` field, choose its path in the structured form editor.

## Verification

Run `npm run test:fragments` for the real auto-loader/fragment pipeline with Adobe's documented output, legacy links, disclosure fragments, HTML suffixes, nested loading, surrounding-copy preservation and request failures. The tests do not access DA or modify authored content.

Once signed in, verify Library registration on a test document: browse `/fragments` and `/disclosures/fragments`, preview a document, insert into an empty paragraph, and check editor undo/save. Preview the test page and its fragment, then verify rendering on the branch. DA authentication, folder permissions, hosted-picker behavior and content delivery still require this authenticated check.
