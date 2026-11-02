# Reusable Content

The DA Library entry **Reusable Content** is Adobe's [Fragment Picker](https://github.com/adobe-rnd/aem-apps/tree/main/tools/plugins/fragments), presented in the editor sidebar. It remains hosted and maintained upstream; this project does not fork its implementation.

In the normal [DA editor](https://da.live/canvas#/adobedrago/etrade/home), open **Outline dropdown → Extensions → Reusable Content**. Browse or search for a fragment, select it to preview, then choose **Insert selected fragment**. In the classic editor, open the same entry from Library.

Insertion adds a reference to shared content. It does not create an independent copy of the fragment's wording. Edit the original fragment to update every page that references it, then preview/publish that source and review the pages using it. A section that needs page-specific edits should be authored as local page content instead. Disclosure sets and disclosure references stay in Disclosure Manager.

Register or update the existing entry in the **library** sheet of [DA site configuration](https://da.live/config#/adobedrago/etrade/):

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| Reusable Content | https://main--aem-apps--adobe-rnd.aem.page/tools/plugins/fragments/fragments.html | | | inline | |

Keep the existing upstream path and empty ref. Use the existing sidebar presentation for browsing and previewing content. The rename and presentation change do not alter existing fragment content or references.
