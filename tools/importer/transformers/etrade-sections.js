/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: E*TRADE section breaks + Section Metadata.
 * Uses payload.template.sections from page-templates.json (home: 7 sections,
 * dark styling on hero/calculator/product-feature sections 1,2,3,5).
 * Selectors come straight from each section's `selector` array (DOM-verified in analysis).
 *
 * Breaks are inserted in beforeTransform (while every section element still exists),
 * marked with a data attribute, then Section Metadata is anchored to those markers in
 * afterTransform (after parsers may have replaced section elements). See
 * references/generate-import-transformer.md "Why both hooks".
 */

const SECTION_MARKER_ATTR = 'data-excat-section-id';

// section.selector is an array of candidate selectors — try each in order, first match wins.
function querySection(root, selectors) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const sections = (payload.template && payload.template.sections) || [];

  if (hookName === 'beforeTransform') {
    // Insert breaks now, before parsers can replace any section element.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (i === 0 && !section.style) continue; // first section: no leading break needed
      const sectionEl = querySection(element, section.selector);
      if (!sectionEl) continue; // no selector matched on this page — skip, never guess

      const hr = document.createElement('hr');
      if (section.style) hr.setAttribute(SECTION_MARKER_ATTR, String(section.id));
      sectionEl.before(hr);
    }
  }

  if (hookName === 'afterTransform') {
    // Anchor each styled section's Section Metadata block to whichever survived:
    // the marker <hr> placed above, or the original element itself.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;

      const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
      const anchor = marker || querySection(element, section.selector);
      if (!anchor) continue; // neither survived — skip, never guess

      const metadataBlock = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      anchor.after(metadataBlock);

      if (marker) {
        marker.removeAttribute(SECTION_MARKER_ATTR);
        if (i === 0) marker.remove(); // section 0 never gets a real leading break
      }
    }
  }
}
