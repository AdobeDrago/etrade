/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-what-we-offer.js
  var import_what_we_offer_exports = {};
  __export(import_what_we_offer_exports, {
    default: () => import_what_we_offer_default
  });

  // tools/importer/parsers/hero-dark.js
  function parse(element, { document: document2 }) {
    const heading = element.querySelector('h1, h2, [class*="header-3xl"], [class*="header-2xl"]');
    const bgImage = element.querySelector('img.hero-media, img[class*="hero-media"], img[class*="background"], picture img, img');
    const description = [...element.querySelectorAll('p.hero-copy, p[class*="hero-copy"], p')].find((p) => !p.querySelector("a"));
    const ctaLinks = [...element.querySelectorAll("a[href]")];
    if (!heading && !description && !ctaLinks.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [];
    if (bgImage) cells.push([bgImage]);
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (description) contentCell.push(description);
    contentCell.push(...ctaLinks);
    cells.push([contentCell]);
    const block = WebImporter.Blocks.createBlock(document2, { name: "hero-dark", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-platform.js
  function parse2(element, { document: document2 }) {
    const cards = Array.from(element.querySelectorAll(".card-group .card, .card-group a.card")).filter((el, i, arr) => arr.indexOf(el) === i);
    const cells = [];
    cards.forEach((card) => {
      const img = card.querySelector("img");
      const heading = card.querySelector(".card-body h1, .card-body h2, .card-body h3, .card-body h4") || card.querySelector("h1, h2, h3, h4");
      const descriptions = Array.from(card.querySelectorAll(".card-body p")).filter((p) => p.textContent.replace(/ /g, " ").trim().length > 0);
      const href = card.matches("a[href]") ? card.getAttribute("href") : card.querySelector("a[href]") && card.querySelector("a[href]").getAttribute("href");
      let ctaLink = null;
      const ctaEl = card.querySelector(".card-footer a[href]") || card.querySelector(".card-footer button, .card-footer a") || card.querySelector("button");
      if (href) {
        ctaLink = document2.createElement("a");
        ctaLink.href = href;
        ctaLink.textContent = ctaEl && ctaEl.textContent.trim() || "Learn more";
      } else if (ctaEl && ctaEl.matches("a[href]")) {
        ctaLink = ctaEl;
      }
      const bodyCell = [];
      if (heading) bodyCell.push(heading);
      descriptions.forEach((p) => bodyCell.push(p));
      if (ctaLink) bodyCell.push(ctaLink);
      if (!img && bodyCell.length === 0) return;
      cells.push([img || "", bodyCell]);
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const introNodes = [];
    const introHeading = element.querySelector(".richTextEditor h1, .richTextEditor h2, .extra-large-header");
    const introSubhead = element.querySelector(".richTextEditor p.subhead, .richTextEditor .subhead, .richTextEditor p");
    if (introHeading) introNodes.push(introHeading);
    if (introSubhead && introSubhead !== introHeading) introNodes.push(introSubhead);
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards-platform", cells });
    element.replaceWith(...introNodes, block);
  }

  // tools/importer/transformers/etrade-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        "#onetrust-consent-sdk",
        "#ot-fltr-modal",
        ".onetrust-pc-dark-filter",
        '[class*="onetrust"]',
        '[id^="ot-"]'
      ]);
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        "header",
        "footer",
        "nav",
        ".skip-navigation",
        "#host-info",
        "#flash-object-div",
        "#RSADevicePrint",
        "#DeviceTokenFSO",
        "iframe",
        "noscript",
        "script",
        "link",
        "style"
      ]);
      element.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("onclick");
        el.removeAttribute("data-track");
        el.removeAttribute("data-tracking");
      });
    }
  }

  // tools/importer/transformers/etrade-sections.js
  var SECTION_MARKER_ATTR = "data-excat-section-id";
  function querySection(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function transform2(hookName, element, payload) {
    const sections = payload.template && payload.template.sections || [];
    if (hookName === "beforeTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (i === 0 && !section.style) continue;
        const sectionEl = querySection(element, section.selector);
        if (!sectionEl) continue;
        const hr = document.createElement("hr");
        if (section.style) hr.setAttribute(SECTION_MARKER_ATTR, String(section.id));
        sectionEl.before(hr);
      }
    }
    if (hookName === "afterTransform") {
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        const section = sections[i];
        if (!section.style) continue;
        const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
        const anchor = marker || querySection(element, section.selector);
        if (!anchor) continue;
        const metadataBlock = WebImporter.Blocks.createBlock(document, {
          name: "Section Metadata",
          cells: { style: section.style }
        });
        anchor.after(metadataBlock);
        if (marker) {
          marker.removeAttribute(SECTION_MARKER_ATTR);
          if (i === 0) marker.remove();
        }
      }
    }
  }

  // tools/importer/import-what-we-offer.js
  var parsers = {
    "hero-dark": parse,
    "cards-platform": parse2
  };
  var PAGE_TEMPLATE = {
    name: "what-we-offer",
    description: "E*TRADE what-we-offer landing pages: dark hero, dark promo bonus banners (default content), and light sections of platform/product card grids.",
    urls: [
      "https://us.etrade.com/platforms",
      "https://us.etrade.com/what-we-offer/investment-choices",
      "https://us.etrade.com/what-we-offer/pricing-and-rates"
    ],
    blocks: [
      {
        name: "hero-dark",
        instances: [
          "body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.background-secondary)",
          "body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(1)"
        ]
      },
      {
        name: "cards-platform",
        instances: [
          "body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:has(.card-group)"
        ]
      }
    ],
    sections: [
      { id: 1, name: "hero", selector: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(1)"], style: "dark", blocks: ["hero-dark"], defaultContent: [] },
      { id: 2, name: "promo-banner-1", selector: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)"], style: "dark", blocks: [], defaultContent: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(2)"] },
      { id: 3, name: "active-traders", selector: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(3)"], style: null, blocks: ["cards-platform"], defaultContent: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(3)"] },
      { id: 4, name: "aspiring-investors", selector: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(4)"], style: null, blocks: ["cards-platform"], defaultContent: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.aem-GridColumn:nth-of-type(4)"] },
      { id: 5, name: "promo-banner-2", selector: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.reference.parbase"], style: "dark", blocks: [], defaultContent: ["body > div.page-content > div.row-fluid.detail-page > div.span12 > div.aem-Grid > div.reference.parbase"] }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), { template: PAGE_TEMPLATE });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document2, template) {
    const pageBlocks = [];
    const seen = /* @__PURE__ */ new Set();
    template.blocks.forEach((blockDef) => {
      let matched = false;
      blockDef.instances.forEach((selector) => {
        const elements = document2.querySelectorAll(selector);
        elements.forEach((element) => {
          if (seen.has(element)) return;
          seen.add(element);
          matched = true;
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
      if (!matched) console.warn(`Block "${blockDef.name}" not found with any selector`);
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_what_we_offer_default = {
    transform: (payload) => {
      const {
        document: document2,
        url,
        html,
        params
      } = payload;
      const main = document2.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document2, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document: document2, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document2.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document2);
      WebImporter.rules.transformBackgroundImages(main, document2);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
      return [{
        element: main,
        path,
        report: {
          title: document2.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_what_we_offer_exports);
})();
