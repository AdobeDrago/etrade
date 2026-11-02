# DA block library pilot

Create two library documents for the existing Hero Dark and Cards Article blocks. Use the prepared source tables without changing their structure. The documents provide six examples across two block families; the current rendering code already supports these variants.

## Code and authoring environment

The pilot uses the `demo` branch. Normal DA editor URLs currently render `main`, which does not contain the latest section-metadata, tracking, and button-style fixes. After creating the test page, open it at `https://da.live/canvas?ref=demo#/adobedrago/etrade/drafts/block-library-pilot`.

Promote the verified authoring fixes into the intended rollout branch before making the library available to authors using normal editor URLs. Creating library documents does not deploy code. DA content is shared across branches.

## Prepared source files

| File | DA destination | Examples |
| --- | --- | --- |
| [Hero Dark source](../test/fixtures/block-library/hero-dark.html) | `/library/blocks/hero-dark` | Default, Split, Split with Balanced, Split with Inset |
| [Cards Article source](../test/fixtures/block-library/cards-article.html) | `/library/blocks/cards-article` | Default and Promo, each containing three complete card rows |
| [Blocks index](../test/fixtures/block-library/blocks.csv) | `/library/blocks` as a sheet | Two rows with `name` and `path` columns |

The source files contain native DA tables, headings for example labels, and Library Metadata descriptions. Keep the descriptions in the library documents. Insert the actual example tables into pages through the library picker. Images reference existing artwork used by the project's saved examples. Check their availability and appearance in DA preview; replace sample copy and artwork for real campaigns. Set the main hero heading to H1 when it is the page title.

The fixtures live under `test/`, which `.hlxignore` excludes from EDS delivery. Attach the HTML and CSV files to the DA assistant if it supports attachments. If attachment import is unavailable, use the project's XML Tools dialog to import the XHTML files into new DA pages, and create the index using the native sheet editor. XML Tools accepts these files through its page XML input. Do not paste rendered HTML as literal page text.

## DA assistant prompt

Create a small block library pilot in the existing `adobedrago/etrade` site using the attached Hero Dark and Cards Article source files and Blocks CSV. First check whether each destination already exists. If it exists, inspect it and report any differences before overwriting it.

Create `/library/blocks/hero-dark` and `/library/blocks/cards-article` as editable DA documents. Preserve the example headings, exact block table names, row/cell structure, rich text, image alternatives, relative links, and Library Metadata descriptions from the supplied sources. Create `/library/blocks` as a sheet with the CSV's `name` and `path` columns. The sheet and the directory containing its example documents intentionally share the `blocks` name.

Use only the implemented table names: `Hero Dark`, `Hero Dark (Split)`, `Hero Dark (Split, Balanced)`, `Hero Dark (Split, Inset)`, `Cards Article`, and `Cards Article (Promo)`. Cards Article has one complete card per row: image in the first cell and eyebrow, heading, body paragraphs, and a standalone link paragraph in the second cell. Keep CTA links in separate paragraphs. The card count controls the default card grid automatically. Do not create new block names or invent layout options.

Keep the four existing library extension registrations. If the configuration tools are available, register the new catalog as `Blocks` in the site configuration's `library` tab, using the index sheet's verified JSON URL and `ref` set to `demo` for this pilot. The content URL to verify is `https://content.da.live/adobedrago/etrade/library/blocks.json`; verify that it returns the index rows before using it. Leave `format`, `icon`, and `experience` empty for this native Blocks catalog. If that URL or the configuration tools are unavailable, report the exact unresolved setup step instead of substituting a different URL or claiming registration succeeded.

Create a separate test page at `/drafts/block-library-pilot`. Use the demo editor URL while testing. Insert examples from the native Blocks picker rather than rebuilding them manually in the test page. Save drafts and leave publication for a separate release step. Report the created document URLs, index JSON URL, registration status, and any incomplete verification.

## Acceptance checks

1. The demo editor's tool panel shows Blocks, with both families and all six prepared examples available. Example descriptions are readable.
2. Insert each example into a fresh page outside the existing imported page paths. Confirm that media, headings, copy, and CTA destinations survive.
3. Add a complete Cards Article row, remove an optional image cell, and edit an inline body link. Confirm that the correct number of cards remains and inline links remain within their paragraphs.
4. Edit a hero heading and CTA, use Undo, save, reload, and verify the rendered content. Check the named split variants and missing-image behavior.
5. Check phone and desktop layouts, meaningful image alternatives, heading levels, and keyboard access. Verify sample asset requests before calling the examples ready for authors.
6. Confirm that the sample documents can be inserted through the picker. Rendering tests alone do not establish native DA library insertion or save/undo behavior.

Run `npm run test:library` for the twelve source-example checks. They exercise the existing decoration pipeline and block decorators on a fresh page path, including optional images, added card rows, inline links, and tracking preservation. Browser verification in DA remains the acceptance gate after the documents and catalog are created.

## Next library phase

After the two pilots pass, add Hero Light, Cards Icon, Columns Feature, Accordion FAQ, guided section metadata, and two starter page templates. Keep global navigation, footer, API-driven widgets, and RTE customization outside this pilot.

Follow Adobe's [library setup guide](https://www.aem.live/docs/ew/administering/set-up-library) for the native catalog and configuration contract.
