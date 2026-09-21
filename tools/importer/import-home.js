/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroDarkParser from './parsers/hero-dark.js';
import widgetCalculatorParser from './parsers/widget-calculator.js';
import columnsFeatureParser from './parsers/columns-feature.js';
import cardsPricingParser from './parsers/cards-pricing.js';
import cardsProductParser from './parsers/cards-product.js';
import cardsAwardParser from './parsers/cards-award.js';
import accordionFaqParser from './parsers/accordion-faq.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/etrade-cleanup.js';
import sectionsTransformer from './transformers/etrade-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-dark': heroDarkParser,
  'widget-calculator': widgetCalculatorParser,
  'columns-feature': columnsFeatureParser,
  'cards-pricing': cardsPricingParser,
  'cards-product': cardsProductParser,
  'cards-award': cardsAwardParser,
  'accordion-faq': accordionFaqParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'home',
  description: 'E*TRADE homepage: dark IPO hero, bonus offer + funding calculator, dark product-feature columns, pricing stat and product cards, awards, and an FAQ accordion.',
  urls: [
    'https://us.etrade.com/home',
  ],
  blocks: [
    {
      name: 'hero-dark',
      instances: [
        'div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.hero-banner-overlay)',
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(1)',
      ],
    },
    {
      name: 'widget-calculator',
      instances: [
        '.interactive-slider-container',
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2) .interactive-slider-container',
      ],
    },
    {
      name: 'columns-feature',
      instances: [
        'div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.rounded-corner-image)',
      ],
    },
    {
      name: 'cards-pricing',
      instances: [
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5) .card-container.pricing-card',
        '.card-container.pricing-card',
      ],
    },
    {
      name: 'cards-product',
      instances: [
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5) .card-container.super-card-one',
        '.card-container.super-card-one',
      ],
    },
    {
      name: 'cards-award',
      instances: [
        'div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.et-top-five)',
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)',
      ],
    },
    {
      name: 'accordion-faq',
      instances: [
        '.accordion.aem-GridColumn',
        'div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10) .accordion',
      ],
    },
  ],
  sections: [
    { id: 1, name: 'hero', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(1)'], style: 'dark', blocks: ['hero-dark'], defaultContent: [] },
    { id: 2, name: 'bonus-offer-calculator', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2)'], style: 'dark', blocks: ['widget-calculator'], defaultContent: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2)'] },
    { id: 3, name: 'product-feature-1', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(4)'], style: 'dark', blocks: ['columns-feature'], defaultContent: [] },
    { id: 4, name: 'pricing', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5)'], style: null, blocks: ['cards-pricing', 'cards-product'], defaultContent: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5)'] },
    { id: 5, name: 'product-feature-2', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(6)'], style: 'dark', blocks: ['columns-feature'], defaultContent: [] },
    { id: 6, name: 'awards', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)'], style: null, blocks: ['cards-award'], defaultContent: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)'] },
    { id: 7, name: 'faq', selector: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10)'], style: null, blocks: ['accordion-faq'], defaultContent: ['div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10)'] },
  ],
};

// TRANSFORMER REGISTRY - cleanup runs first, section transformer after (needs 2+ sections)
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook.
 */
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

/**
 * Find all blocks on the page based on the embedded template configuration.
 * Only the first matching selector per block definition is used, so alternate
 * fallback selectors don't double-match the same element.
 */
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
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
    if (!matched) {
      console.warn(`Block "${blockDef.name}" not found with any selector`);
    }
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

// EXPORT DEFAULT CONFIGURATION
export default {
  transform: (payload) => {
    const {
      document, url, html, params,
    } = payload;

    const main = document.body;

    // 1. beforeTransform cleanup
    executeTransformers('beforeTransform', main, payload);

    // 2. Discover blocks
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block (skip elements already replaced by an earlier parser)
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

    // 4. afterTransform cleanup + section breaks/metadata
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Sanitized path (root URL maps to /index to avoid empty-path crash)
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
