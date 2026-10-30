# Import & Export

A DA authoring plugin for importing XML pages, exporting saved pages as XML, and managing the original product Structured Content demo. There is no build step or runtime dependency. All built-in sample values are illustrative.

## Try it locally

Run `npm run demo:xml-tools`, then open [Import & Export](http://localhost:3031/tools/plugins/xml-tools/xml-tools.html?demo=1). Choose **Try page sample** to preview a complete imported page. Upload a `.xml`/`.xhtml` file or paste page XML, then **Review page XML**. **Download DA HTML** works standalone; creating or replacing a DA page requires the DA connection. Standalone mode does not contact DA or persist records after a reload. Expand **Advanced: product XML demo** for the earlier single-record workflow.

Product XML uses a `<product>` root with exactly these plain-text fields: `id`, `name`, `rate`, `effectiveDate`, and `disclosure`. Product IDs start with a lowercase letter and use lowercase letters, digits, or hyphens. Dates use YYYY-MM-DD. Product XML is normalized on export; comments, formatting, and processing instructions are not retained. Product namespaces, attributes, nested fields, unknown/repeated fields, DTD/entity declarations, and product files over 250 KB are rejected.

## Import XML pages

Supported page formats:

- `<da-page version="1">`: the tool's own page export. Imports restore the original `<source-html>` text, including sections, blocks, formatting, links, tracking parameters, metadata, and whitespace. The readable section inventory is informational; `source-html` is the authoritative page source.
- XHTML: a well-formed `<html>` document with a `<main>` element. The default XHTML namespace is supported. The complete document is used as the imported source.

The preview shows content structure without EDS block styling or external asset requests. Its iframe is sandboxed, with a restrictive CSP. Scripts, active event attributes, embedded frames/objects, redirects, and executable/local-file URLs prevent import instead of being silently removed. DTDs and entity declarations are unsupported. XML is limited to 12 MB and decoded page source to 5 MB; the exporter also enforces the XML limit so its outputs can be reimported.

After reviewing the content preview, choose an **Import destination**:

- **Create a new DA page** (the default): enter a **New DA page path**, then choose **Create new DA page**. The default path is a copy under `/xml-demo/pages/`. Existing destinations and hidden configuration folders are refused.
- **Import content onto current page**: the tool shows the current DA editor's page path and an overwrite warning. Choose **Import content onto current page**, review saved versus incoming wording, link destinations, section/block counts, and metadata changes. **Download saved page backup** exports the exact saved source as restorable page XML. Then confirm **Overwrite and import** to replace all existing page content and metadata with the imported source. **Cancel** or Escape leaves the page unchanged. This option requires a DA page editor context and a readable existing page; the XML's original path and the new-page path cannot redirect the overwrite. If the saved source changes while confirmation is open, the import stops and requires another review and confirmation.

All writes use the connected DA site, even when the XML was exported from another site. The existence and source comparison checks are optimistic checks, not atomic locks. Current-page replacement uses the Source API, which synchronizes external writes with the open collaborative DA editor. Review the updated page before previewing or publishing. **Open imported page in DA** opens the regular Canvas editor for editing and normal preview/publish actions. Page imports do not require a Structured Content schema. Relative links and asset references keep their authored values, so review them when moving content to another site or directory.

Changing the DA connection clears previous export downloads, saved document snapshots, and result links. Load saved content again before overwriting an existing product in the new connection. Late results from the previous connection cannot become the current export or show a link under the new site. Requests already in progress may still complete on their original site; review that destination if you switch connections during a save.

This implements page XML round trips and XHTML import. Other XML page vocabularies, AEM `.content.xml`, XSD mappings, and AEM Forms packages need format-specific mapping.

## Enable in DA

The plugin follows Adobe's [Library plugin registration](https://www.aem.live/docs/ew/developing/micro-frontends/2-build-your-basic-plugin). In [site configuration](https://da.live/config#/adobedrago/etrade/), add a row to **library**:

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Import & Export | https://demo--etrade--adobedrago.aem.live/tools/plugins/xml-tools/xml-tools.html | | | inline | |

Use `inline` to keep the tool in the editor sidebar; the import comparison remains an explicit overwrite confirmation. The demo code lives on `demo`. Leave ref empty so authors can use their regular editor URL. For the local server, use `http://localhost:3031/tools/plugins/xml-tools/xml-tools.html` with a separate ref such as `xml-local`. Chrome may block the local frame from the HTTPS DA page; use the deployed HTTPS entry for DA integration testing.

Open [the DA homepage editor](https://da.live/canvas#/adobedrago/etrade/home), then **Outline dropdown → Extensions → Import & Export**. In the classic editor, use **Library → Import & Export**. Page imports create a separate destination by default. Selecting the current-page destination and confirming the warning overwrites the host page. Product imports continue to save records under `/xml-demo/products/`.

## Deploy to another DA site

The registration and editor links above target the AdobeDrago E*TRADE demo. When copying the tool to a customer site:

- Deploy `tools/plugins/xml-tools/` together, then set the customer's Library entry to `https://{branch}--{repo}--{org}.aem.live/tools/plugins/xml-tools/xml-tools.html` using that site's deployed branch, repository, and organization. Keep **experience** set to `inline`.
- Register the entry in the customer's `https://da.live/config#/{org}/{repo}/` and open it from that site's DA editor. Source API requests, editor links, and Structured Content delivery links use the DA SDK's connected organization and repository; they do not use the registration example's tenant. Adobe service hosts such as `admin.da.live` remain unchanged.
- Update the E*TRADE title/eyebrow in `xml-tools.html` and the illustrative content in `samplePageXml()` in `page-xml.js` for the customer. Choose suitable demo destinations if `/xml-demo/pages/` and `/xml-demo/products/` are not appropriate; product paths and schema are defined in `model.js`.
- Review linked media, fragments, and relative paths in imported source. Importing preserves those references and does not copy assets between sites.

First verify export and new-page import on a disposable customer page, then preview through that site's normal DA workflow. Saving through this tool does not publish content.

## Save, edit, and publish

1. Expand **Advanced: product XML demo**. Import product XML or choose **Try sample**. Edit the fields and choose a document path under `/xml-demo/products/`.
2. Click **Save in DA**. The plugin uses the DA SDK's authenticated `daFetch` action and Source API. It creates the `xml-product-demo` schema under `/.da/forms/schemas/` if absent, then saves SC markup. An existing different schema stops the save. Tokens are never stored by the plugin.
3. Click **Open SC editor**. The saved file can be edited with DA's generated form. No `editor.path` setting is needed to open the explicit `/form#` link.
4. Use DA's **Send → Preview / Publish** for the demo document. Saving through the plugin does not preview or publish it. **Preview JSON** and **Published JSON** point to Adobe's corresponding SC delivery endpoints and may return 404 until those steps complete.
5. After editing in SC, reopen Import & Export, enter the same path, and choose **Load saved content** before exporting XML or saving further edits.

The plugin checks the saved source before overwriting an existing demo record. Concurrent source changes stop saving and require a reload. This is an optimistic check, not an atomic lock. Saving overwrites the demo record's markup; use only documents created for this demo, without extra metadata or hand-authored blocks.

SC delivery is JSON. **Download XML** creates a real XML file from the current fields. This prototype does not serve a public XML feed or integrate customer-facing AEM Forms.

## Export an existing page

Inside DA, choose **Export this page**, then **Download page XML**. The current editor path is detected automatically. To export a different page, enter its path and choose **Prepare XML export**. This reads the latest saved source from the connected site and never writes the page. Save editor changes first. Referenced fragments and linked assets are not expanded or embedded; their authored references remain in the source.

The versioned `<da-page>` format records org/site/path, a section and block inventory with escaped rich HTML, and the complete original source in `<source-html>`. Import this export through **Import an XML page** to create a new editable DA page or replace the current page after confirmation. XML character references preserve carriage returns during a round trip. This is a general source export, not a customer-specific XML/XSD mapping. Page XML and product XML are separate formats; downstream publishing integrations are not implemented. Exports are limited to 5 MB of valid XML 1.0 source and 12 MB of XML output.

## Validation

Run `npm run test:xml-tools`. Tests cover page export/import round trips, XHTML, metadata and rich markup preservation, escaped text, rejected XML/active content, field validation, bounded DA paths, schema creation, authentication errors, protected destinations, conflicting saves, overwrite confirmation/cancellation, current-page targeting, and standalone/connected UI behavior. Browser QA covers native XML malformed-input errors and page import previews. The product schema and source format were also checked against Adobe's current [SC SDK](https://github.com/adobe/da-nx/blob/main/nx/deps/da-sc-sdk/dist/index.js) converters and schema validator.

Preview: https://demo--etrade--adobedrago.aem.page/tools/plugins/xml-tools/xml-tools.html?demo=1
