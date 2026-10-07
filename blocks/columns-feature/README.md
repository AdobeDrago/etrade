# Columns Feature

Use a **Columns Feature** table with an image in one cell and authored copy in the other. Put an optional eyebrow paragraph, H2 heading, supporting paragraphs, and standalone CTA links in the copy cell. Images and links within paragraphs keep their authored alternative text and destinations.

The first standalone CTA is primary; later CTAs are secondary. Decorative arrows come from the shared action helper. Imported duplicate arrow links are normalized into one accessible link.

## Theme and layout

The block inherits `dark` from its section; other sections use `light`. Explicit **Columns Feature (light)** or **Columns Feature (dark)** options override that default for the component. **Columns Feature (image-right, dark)** places the image on the right on desktop. Theme choices do not alter neighboring sections.

From 900px, the two cells sit side by side. Below that breakpoint, copy comes before the image. Content wraps within the available width. Omitted cells and CTAs remain usable.

## Migration review

This component is migrated on `et-columns-feature`. Review its changes against `et-actions`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-columns-feature--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
