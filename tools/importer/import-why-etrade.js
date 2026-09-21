/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import columnsFeatureParser from './parsers/columns-feature.js';
import carouselStoryParser from './parsers/carousel-story.js';
import cardsIconParser from './parsers/cards-icon.js';
import cardsArticleParser from './parsers/cards-article.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/etrade-cleanup.js';
import sectionsTransformer from './transformers/etrade-sections.js';

// PARSER REGISTRY
const parsers = {
  'columns-feature': columnsFeatureParser,
  'carousel-story': carouselStoryParser,
  'cards-icon': cardsIconParser,
  'cards-article': cardsArticleParser,
};

const CC = 'div.root.maincontainer.responsivegrid div.maincontainer.responsivegrid > div.aem-Grid > div.componentContainer';

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'why-etrade',
  description: 'E*TRADE brand/story page: a dark intro feature, a scrolling "Our story" carousel, a "Who we serve" icon-card grid, and a promo article-card grid.',
  urls: [
    'https://us.etrade.com/why-etrade',
  ],
  blocks: [
    { name: 'columns-feature', instances: [`${CC}:has(.rounded-corner-image)`] },
    { name: 'carousel-story', instances: [`${CC}:has(.card-carousel)`] },
    { name: 'cards-icon', instances: [`${CC}:has(.card-icon)`] },
    { name: 'cards-article', instances: [`${CC}:has(.promo-card)`] },
  ],
  sections: [
    { id: 1, name: 'what-sets-apart', selector: [`${CC}:has(.rounded-corner-image)`], style: 'dark', blocks: ['columns-feature'], defaultContent: [] },
    { id: 2, name: 'our-story', selector: [`${CC}:has(.card-carousel)`], style: null, blocks: ['carousel-story'], defaultContent: [`${CC}:has(.card-carousel)`] },
    { id: 3, name: 'who-we-serve', selector: [`${CC}:has(.card-icon)`], style: null, blocks: ['cards-icon'], defaultContent: [`${CC}:has(.card-icon)`] },
    { id: 4, name: 'more-sets-apart', selector: [`${CC}:has(.promo-card)`], style: null, blocks: ['cards-article'], defaultContent: [`${CC}:has(.promo-card)`] },
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
