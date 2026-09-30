/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroLightParser from './parsers/hero-light.js';
import tabsAccountsParser from './parsers/tabs-accounts.js';
import accordionFaqParser from './parsers/accordion-faq.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/etrade-cleanup.js';
import sectionsTransformer from './transformers/etrade-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-light': heroLightParser,
  'tabs-accounts': tabsAccountsParser,
  'accordion-faq': accordionFaqParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'what-we-offer-2',
  description: 'E*TRADE Our Accounts page: light intro hero, a tabbed account selector (with account-card grids per tab), and an FAQ accordion.',
  urls: [
    'https://us.etrade.com/what-we-offer/our-accounts',
  ],
  blocks: [
    {
      name: 'hero-light',
      instances: [
        'body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)',
      ],
    },
    {
      name: 'tabs-accounts',
      instances: [
        'body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn.tabbedTabs',
      ],
    },
    {
      name: 'accordion-faq',
      instances: [
        'body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.faqSection)',
      ],
    },
  ],
  sections: [
    { id: 1, name: 'hero-intro', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)'], style: null, blocks: ['hero-light'], defaultContent: [] },
    { id: 2, name: 'account-tabs', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn.tabbedTabs'], style: null, blocks: ['tabs-accounts'], defaultContent: [] },
    { id: 3, name: 'account-faqs', selector: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.faqSection)'], style: null, blocks: ['accordion-faq'], defaultContent: ['body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.faqSection)'] },
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
