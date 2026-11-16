# Reusable Content

The E*TRADE **Reusable Content** extension browses HTML fragments and Structured Cards in the DA editor sidebar. It replaces the existing Library entry that points to Adobe's [Fragment Picker](https://github.com/adobe-rnd/aem-apps/tree/main/tools/plugins/fragments) once the new URL is registered.

In the [DA canvas editor](https://da.live/canvas#/adobedrago/etrade/home), open **Panels → Extensions → Reusable Content**. Drag the left edge of the sidebar to widen it. When the file list and preview are side by side, drag the divider between them or focus it and use the arrow keys. In the classic editor, open the extension from Library to browse and insert HTML fragments.

Under **Fragments**, browse or search for a source, then choose **Insert fragment**. The picker discovers DA HTML documents under `/fragments` and under `fragments` folders with up to two parent folders, such as `/components/fragments`. It inserts a shared reference for rich text, blocks, and multi-section documents. Preview uses the site's `main` preview URL.

Sheets, JSON, and native AEM Content Fragments and Experience Fragments have no dedicated picker support. The site loads `/nav` and `/footer` separately. HTML in `/disclosures/fragments` matches the picker’s folder convention. Use Disclosure Manager to insert numbered disclosure references and manage shared disclosure sets.

Insertion adds a reference to shared content. Edit the original fragment to update every page that references it, then preview/publish that source and review the pages using it. Author sections that need page-specific edits as local page content.

## Structured Cards

In DA Canvas, choose **Structured Cards** and select a record under `/cards/`. The picker reads its Structured Content preview to identify the matching block. For example, `/cards/product/guide-core-brokerage` uses Cards Product.

- Place the cursor inside a matching block and choose **Add row to selected block**. The shared card link goes in the last row. Existing rows and block variants are preserved.
- Place the cursor in a paragraph between blocks and choose **Create matching block**. The picker inserts a new block with one linked card row.

Preview a card source before using the picker and publish it for live delivery. For manual authoring and the schema-to-block mapping, see [Structured Cards](structured-cards.md).

After the extension is deployed to main, update the existing entry in the **library** sheet of [DA site configuration](https://da.live/config#/adobedrago/etrade/).

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Reusable Content | https://main--etrade--adobedrago.aem.page/tools/plugins/reusable-content/reusable-content.html | | | inline | |

For local testing, use a separate entry with `http://localhost:3000/tools/plugins/reusable-content/reusable-content.html`, experience `inline`, and ref `local`. Open [DA Canvas with the local plugin ref](https://da.live/canvas?ref=local#/adobedrago/etrade/home) while the local server is running.
