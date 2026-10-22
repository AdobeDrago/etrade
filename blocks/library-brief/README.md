# Library Brief

Use this documentation block above the examples in a block library document. It renders a collapsed native disclosure; it does not inspect or move adjacent headings or example blocks.

Author a two-column table with a merged heading row named **Library Brief**:

| Library Brief | |
| --- | --- |
| Title | Authoring guide |
| Description | Structure, properties & options |
| Table structure | Paragraphs explaining the example table. |
| Authoring properties | A rich-text list describing each property. |
| Supported options | A list of implemented block options. |
| Authoring notes | Guidance and links. |

`Title` and `Description` are optional plain-text settings. Title defaults to “Authoring guide”; omitted description stays empty. Every other complete, nonempty row becomes a labelled section inside the disclosure. Content cells accept ordinary rich text, lists, links, images and tables. Add rows to add documentation sections; omit rows that do not apply. An empty brief stays hidden.

Keep the family title and short introduction before the brief, and the Examples heading and all example tables after it. Do not place example block tables inside the brief. The library catalog should list component families, rather than this documentation block as a separate family.

For the native DA picker, put a normal paragraph immediately before the brief and an adjacent Library Metadata table with `name` set to `Authoring guide`. The picker then presents a disabled reference entry because the brief has no preceding heading anchor. The actual examples retain their own headings and insert actions.

Content is shared across code branches. The block implementation currently ships on `demo`; use `?ref=demo` in DA until the code is promoted.
