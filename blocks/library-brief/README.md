# Library Brief

The gallery renders authoring guide metadata as this collapsed native disclosure. It does not inspect or move adjacent headings or example blocks.

Author a two-column table with a merged heading row named **Library Metadata (Guide)**:

| Library Metadata (Guide) | |
| --- | --- |
| Title | Authoring guide |
| Description | Structure, properties & options |
| Table structure | Paragraphs explaining the example table. |
| Authoring properties | A rich-text list describing each property. |
| Supported options | A list of implemented block options. |
| Authoring notes | Guidance and links. |

`Title` and `Description` are optional plain-text settings. Title defaults to “Authoring guide”; omitted description stays empty. Every other complete, nonempty row becomes a labelled section inside the disclosure. Content cells accept ordinary rich text, lists, links, images and tables. Add rows to add documentation sections; omit rows that do not apply. An empty brief stays hidden.

Keep the family title and short introduction before the guide, and the Examples heading and all example tables after it. Put the actual examples in separate sections. Do not place example block tables inside the guide. The library catalog should list component families, rather than this documentation as a separate family.

DA's native pickers exclude tables whose base block name is `library-metadata`, including the `Guide` option. On local and preview gallery pages, `scripts/library-preview.js` converts just these guide tables into `library-brief` before block decoration. The result stays collapsible in preview and is absent from the picker's variants. Other Library Metadata tables continue to supply example names and descriptions.

To migrate an existing library document, deploy this code first, then rename only the guide table's merged heading cell from **Library Brief** to **Library Metadata (Guide)**. Keep all of its documentation rows. Remove the adjacent Library Metadata table that exists only to name that old brief “Authoring guide”; retain each example's metadata. Save the document and check its preview and the Blocks picker. Existing Library Brief tables still render during rollout, but remain insertable until their source heading is updated. Omitting a heading anchor only disables the picker's preview button; it does not disable the separate Add button.

Content is shared across code branches. The block implementation currently ships on `demo`; use `?ref=demo` in DA until the code is promoted.
