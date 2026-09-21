/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroDarkParser from './parsers/hero-dark.js';
import cardsPlatformParser from './parsers/cards-platform.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/etrade-cleanup.js';
import sectionsTransformer from './transformers/etrade-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-dark': heroDarkParser,
  'cards-platform': cardsPlatformParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'what-we-offer',
  description: 'E*TRADE what-we-offer landing pages: dark hero, dark promo bonus banners (default content), and light sections of platform/product card grids.',
  urls: [
    'https://us.etrade.com/platforms',
    'https://us.etrade.com/what-we-offer/investment-choices',
    'https://us.etrade.com/what-we-offer/pricing-and-rates',
  ],
  blocks: [
    {
      name: 'hero-dark',
      instances: [
        'body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.background-secondary)',
      ],
    },
    {
      name: 'cards-platform',
      instances: [
        'body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.card-group)',
      ],
    },
  ],
  sections: [
    { id: 1, name: 'hero', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(1)'], style: 'dark', blocks: ['hero-dark'], defaultContent: [] },
    { id: 2, name: 'promo-banner-1', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)'], style: 'dark', blocks: [], defaultContent: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)'] },
    { id: 3, name: 'active-traders', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(3)'], style: null, blocks: ['cards-platform'], defaultContent: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(3)'] },
    { id: 4, name: 'aspiring-investors', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(4)'], style: null, blocks: ['cards-platform'], defaultContent: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(4)'] },
    { id: 5, name: 'promo-banner-2', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.reference.parbase'], style: 'dark', blocks: [], defaultContent: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.reference.parbase'] },
  ],
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  const seen = new Set();
  template.blocks.forEach((blockDef) => {
    let matched = false;
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        matched = true;
        pageBlocks.push({
          name: blockDef.name, selector, element, section: blockDef.section || null,
        });
      });
    });
    if (!matched) console.warn(`Block "${blockDef.name}" not found with any selector`);
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const {
      document, url, html, params,
    } = payload;

    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    executeTransformers('afterTransform', main, payload);

    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
