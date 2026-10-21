# XML Tools demo

A DA authoring plugin with two XML workflows: import a product, edit fields and save an editable Structured Content document; or export any saved DA page as general page XML. There is no build step or runtime dependency. All demo values are illustrative.

## Try it locally

Run `npm run demo:xml-tools`, then open [XML Tools](http://localhost:3031/tools/plugins/xml-tools/xml-tools.html?demo=1). Choose **Try sample**, change a field, expand **Generated XML**, and **Download XML**. File upload and pasted XML use the same parser. Standalone mode does not contact DA or persist records after a reload.

The supported format is a `<product>` root with exactly these plain-text fields: `id`, `name`, `rate`, `effectiveDate`, and `disclosure`. Product IDs start with a lowercase letter and use lowercase letters, digits, or hyphens. Dates use YYYY-MM-DD. XML is normalized on export; comments, formatting, and processing instructions are not retained. Namespaces, attributes, nested fields, unknown/repeated fields, DTD/entity declarations, and files over 250 KB are rejected. This is a single-record demo, not an XML/XSD or AEM Forms package importer.

## Enable in DA

The plugin follows Adobe's [Library plugin registration](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin). In [site configuration](https://da.live/config#/adobedrago/etrade/), add a row to **library**:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| XML Tools | https://demo--etrade--adobedrago.aem.live/tools/plugins/xml-tools/xml-tools.html | | | fullsize-dialog | |

The demo code lives on `demo`. Leave ref empty so authors can use their regular editor URL. For the local server, use `http://localhost:3031/tools/plugins/xml-tools/xml-tools.html` with a separate ref such as `xml-local`. Chrome may block the local frame from the HTTPS DA page; use the deployed HTTPS entry for DA integration testing.

Open [the DA homepage editor](https://da.live/canvas#/adobedrago/etrade/home), then **Outline dropdown → Extensions → XML Tools**. In the classic editor, use **Library → XML Tools**. The homepage is only the plugin's host: product import saves separate records under `/xml-demo/products/` and never inserts into or saves the host page.

## Save, edit, and publish

1. Import XML or choose **Try sample**. Edit the fields and choose a document path under `/xml-demo/products/`.
2. Click **Save in DA**. The plugin uses the DA SDK's authenticated `daFetch` action and Source API. It creates the `xml-product-demo` schema under `/.da/forms/schemas/` if absent, then saves SC markup. An existing different schema stops the save. Tokens are never stored by the plugin.
3. Click **Open SC editor**. The saved file can be edited with DA's generated form. No `editor.path` setting is needed to open the explicit `/form#` link.
4. Use DA's **Send → Preview / Publish** for the demo document. Saving through the plugin does not preview or publish it. **Preview JSON** and **Published JSON** point to Adobe's corresponding SC delivery endpoints and may return 404 until those steps complete.
5. After editing in SC, reopen XML Tools, enter the same path, and choose **Load saved content** before exporting XML or saving further edits.

The plugin checks the saved source before overwriting an existing demo record. Concurrent source changes stop saving and require a reload. This is an optimistic check, not an atomic lock. Saving overwrites the demo record's markup; use only documents created for this demo, without extra metadata or hand-authored blocks.

SC delivery is JSON. **Download XML** creates a real XML file from the current fields. This prototype does not serve a public XML feed or integrate customer-facing AEM Forms.

## Export an existing page

Inside DA, scroll to **Export an existing DA page**, enter a page path such as `/home`, click **Load page for XML export**, then **Download page XML**. This reads the latest saved source from the connected site and never writes the page. Save editor changes first. Referenced fragments and linked assets are not expanded or embedded; their authored references remain in the source.

The versioned `<da-page>` format records org/site/path, a section and block inventory with escaped rich HTML, and the complete original source in `<source-html>`. Reading that element's text recovers the source, including metadata, link attributes and whitespace. This is a general source export, not a customer-specific XML/XSD mapping. Page XML and product XML are separate formats: reimporting page XML, arbitrary XML import, and downstream publishing integrations are not implemented. Exports are limited to 5 MB and valid XML 1.0 characters.

## Validation

Run `npm run test:xml-tools`. Tests cover XML/HTML round trips, escaping, rejected XML structures, field validation, bounded DA paths, schema creation, authentication errors, conflicting saves, and standalone/connected UI behavior. Browser QA covers native XML malformed-input errors and file import/download. The schema and source format were also checked against Adobe's current [SC SDK](https://github.com/adobe/da-nx/blob/main/nx/deps/da-sc-sdk/dist/index.js) converters and schema validator.

Preview: https://demo--etrade--adobedrago.aem.page/tools/plugins/xml-tools/xml-tools.html?demo=1
