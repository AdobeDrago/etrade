/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroProductParser from './parsers/hero-product.js';
import cardsPricingParser from './parsers/cards-pricing.js';
import bannerOfferParser from './parsers/banner-offer.js';
import cardsNumberedParser from './parsers/cards-numbered.js';
import columnsFeatureParser from './parsers/columns-feature.js';
import cardsArticleParser from './parsers/cards-article.js';
import accordionFaqParser from './parsers/accordion-faq.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/etrade-cleanup.js';
import sectionsTransformer from './transformers/etrade-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-product': heroProductParser,
  'cards-pricing': cardsPricingParser,
  'banner-offer': bannerOfferParser,
  'cards-numbered': cardsNumberedParser,
  'columns-feature': columnsFeatureParser,
  'cards-article': cardsArticleParser,
  'accordion-faq': accordionFaqParser,
};

const CC = 'div.root.maincontainer.responsivegrid div.maincontainer.responsivegrid > div.aem-Grid > div.componentContainer';

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'our-accounts',
  description: 'E*TRADE account detail page: dark product hero, pricing stat tiles, a dark promo banner, three numbered reasons, a dark product feature, an awards callout, article cards, and an FAQ accordion.',
  urls: [
    'https://us.etrade.com/what-we-offer/our-accounts/brokerage-account',
    'https://us.etrade.com/why-etrade',
  ],
  blocks: [
    { name: 'hero-product', instances: [`${CC}:has(.white)`] },
    { name: 'banner-offer', instances: [`${CC}:has(.column-divider-xshide)`] },
    { name: 'cards-numbered', instances: [`${CC}:has(.col-centered-8)`] },
    { name: 'columns-feature', instances: [`${CC}:has(.basicOneUp)`] },
    { name: 'cards-article', instances: [`${CC}:has(.card-img)`] },
    { name: 'accordion-faq', instances: [`${CC}:has(.accordion-section)`] },
    { name: 'cards-pricing', instances: [`${CC}:has(.pricing-card)`] },
  ],
  sections: [
    { id: 1, name: 'hero-offer', selector: [`${CC}:nth-of-type(1)`], style: 'dark', blocks: ['hero-product'], defaultContent: [`${CC}:nth-of-type(1)`] },
    { id: 2, name: 'low-fees-pricing', selector: [`${CC}:nth-of-type(2)`], style: null, blocks: ['cards-pricing'], defaultContent: [`${CC}:nth-of-type(2)`] },
    { id: 3, name: 'offer-banner', selector: [`${CC}:nth-of-type(3)`], style: null, blocks: ['banner-offer'], defaultContent: [] },
    { id: 4, name: 'three-reasons', selector: [`${CC}:nth-of-type(4)`], style: null, blocks: ['cards-numbered'], defaultContent: [`${CC}:nth-of-type(4)`] },
    { id: 5, name: 'advanced-trading', selector: [`${CC}:nth-of-type(5)`], style: null, blocks: ['columns-feature'], defaultContent: [] },
    { id: 6, name: 'awards-recognition', selector: [`${CC}:nth-of-type(6)`], style: null, blocks: [], defaultContent: [`${CC}:nth-of-type(6)`] },
    { id: 7, name: 'insights-resources', selector: [`${CC}:nth-of-type(7)`], style: null, blocks: ['cards-article'], defaultContent: [`${CC}:nth-of-type(7)`] },
    { id: 8, name: 'faqs', selector: [`${CC}:nth-of-type(8)`], style: null, blocks: ['accordion-faq'], defaultContent: [`${CC}:nth-of-type(8)`] },
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
    // Try selectors in order; stop at the first that yields any unseen element.
    for (const selector of blockDef.instances) {
      const elements = [...document.querySelectorAll(selector)].filter((el) => !seen.has(el));
      if (!elements.length) continue;
      elements.forEach((element) => {
        seen.add(element);
        matched = true;
        pageBlocks.push({
          name: blockDef.name, selector, element, section: blockDef.section || null,
        });
      });
      if (matched) break;
    }
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
