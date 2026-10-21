# XML Tools demo

A DA authoring plugin for importing XML pages, exporting saved pages as XML, and managing the original product Structured Content demo. There is no build step or runtime dependency. All built-in sample values are illustrative.

## Try it locally

Run `npm run demo:xml-tools`, then open [XML Tools](http://localhost:3031/tools/plugins/xml-tools/xml-tools.html?demo=1). Choose **Try page sample** to preview a complete imported page. Upload a `.xml`/`.xhtml` file or paste page XML, then **Import page XML**. **Download DA HTML** works standalone; **Create DA page** requires the DA connection. Standalone mode does not contact DA or persist records after a reload. Expand **Product XML demo** for the earlier single-record workflow.

Product XML uses a `<product>` root with exactly these plain-text fields: `id`, `name`, `rate`, `effectiveDate`, and `disclosure`. Product IDs start with a lowercase letter and use lowercase letters, digits, or hyphens. Dates use YYYY-MM-DD. Product XML is normalized on export; comments, formatting, and processing instructions are not retained. Product namespaces, attributes, nested fields, unknown/repeated fields, DTD/entity declarations, and product files over 250 KB are rejected.

## Import XML pages

Supported page formats:

- `<da-page version="1">`: the tool's own page export. Imports restore the original `<source-html>` text, including sections, blocks, formatting, links, tracking parameters, metadata, and whitespace. The readable section inventory is informational; `source-html` is the authoritative page source.
- XHTML: a well-formed `<html>` document with a `<main>` element. The default XHTML namespace is supported. The complete document is used as the imported source.

The preview shows content structure without EDS block styling or external asset requests. Its iframe is sandboxed, with a restrictive CSP. Scripts, active event attributes, embedded frames/objects, redirects, and executable/local-file URLs prevent import instead of being silently removed. DTDs and entity declarations are unsupported. XML is limited to 12 MB and decoded page source to 5 MB; the exporter also enforces the XML limit so its outputs can be reimported.

After review, choose **New DA page path**, then **Create DA page**. The default is a copy under `/xml-demo/pages/`. All writes use the connected DA site, even when the XML was exported from another site. Existing destinations and hidden configuration folders are refused. The existence check is not an atomic create lock. **Open imported page in DA** opens the regular Canvas editor for editing and normal preview/publish actions. Page imports do not require a Structured Content schema. Relative links and asset references keep their authored values, so review them when moving content to another site or directory.

This implements page XML round trips and XHTML import. Other XML page vocabularies, AEM `.content.xml`, XSD mappings, and AEM Forms packages need format-specific mapping.

## Enable in DA

The plugin follows Adobe's [Library plugin registration](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin). In [site configuration](https://da.live/config#/adobedrago/etrade/), add a row to **library**:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| XML Tools | https://demo--etrade--adobedrago.aem.live/tools/plugins/xml-tools/xml-tools.html | | | fullsize-dialog | |

The demo code lives on `demo`. Leave ref empty so authors can use their regular editor URL. For the local server, use `http://localhost:3031/tools/plugins/xml-tools/xml-tools.html` with a separate ref such as `xml-local`. Chrome may block the local frame from the HTTPS DA page; use the deployed HTTPS entry for DA integration testing.

Open [the DA homepage editor](https://da.live/canvas#/adobedrago/etrade/home), then **Outline dropdown → Extensions → XML Tools**. In the classic editor, use **Library → XML Tools**. The homepage is only the plugin's host: page imports create a separate destination and product imports save records under `/xml-demo/products/`. Neither inserts into or saves the host page.

## Save, edit, and publish

1. Expand **Product XML demo**. Import product XML or choose **Try sample**. Edit the fields and choose a document path under `/xml-demo/products/`.
2. Click **Save in DA**. The plugin uses the DA SDK's authenticated `daFetch` action and Source API. It creates the `xml-product-demo` schema under `/.da/forms/schemas/` if absent, then saves SC markup. An existing different schema stops the save. Tokens are never stored by the plugin.
3. Click **Open SC editor**. The saved file can be edited with DA's generated form. No `editor.path` setting is needed to open the explicit `/form#` link.
4. Use DA's **Send → Preview / Publish** for the demo document. Saving through the plugin does not preview or publish it. **Preview JSON** and **Published JSON** point to Adobe's corresponding SC delivery endpoints and may return 404 until those steps complete.
5. After editing in SC, reopen XML Tools, enter the same path, and choose **Load saved content** before exporting XML or saving further edits.

The plugin checks the saved source before overwriting an existing demo record. Concurrent source changes stop saving and require a reload. This is an optimistic check, not an atomic lock. Saving overwrites the demo record's markup; use only documents created for this demo, without extra metadata or hand-authored blocks.

SC delivery is JSON. **Download XML** creates a real XML file from the current fields. This prototype does not serve a public XML feed or integrate customer-facing AEM Forms.

## Export an existing page

Inside DA, scroll to **Export an existing DA page**, enter a page path such as `/home`, click **Load page for XML export**, then **Download page XML**. This reads the latest saved source from the connected site and never writes the page. Save editor changes first. Referenced fragments and linked assets are not expanded or embedded; their authored references remain in the source.

The versioned `<da-page>` format records org/site/path, a section and block inventory with escaped rich HTML, and the complete original source in `<source-html>`. Import this export through **Import an XML page** to create a new editable DA page. XML character references preserve carriage returns during a round trip. This is a general source export, not a customer-specific XML/XSD mapping. Page XML and product XML are separate formats; downstream publishing integrations are not implemented. Exports are limited to 5 MB of valid XML 1.0 source and 12 MB of XML output.

## Validation

Run `npm run test:xml-tools`. Tests cover page export/import round trips, XHTML, metadata and rich markup preservation, escaped text, rejected XML/active content, field validation, bounded DA paths, schema creation, authentication errors, protected destinations, conflicting saves, and standalone/connected UI behavior. Browser QA covers native XML malformed-input errors and page import previews. The product schema and source format were also checked against Adobe's current [SC SDK](https://github.com/adobe/da-nx/blob/main/nx/deps/da-sc-sdk/dist/index.js) converters and schema validator.

Preview: https://demo--etrade--adobedrago.aem.page/tools/plugins/xml-tools/xml-tools.html?demo=1
