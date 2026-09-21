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

  // tools/importer/import-home.js
  var import_home_exports = {};
  __export(import_home_exports, {
    default: () => import_home_default
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

  // tools/importer/parsers/widget-calculator.js
  function parse2(element, { document: document2 }) {
    const cells = [];
    const offerLabel = element.querySelector(".offer-description");
    const offerValue = element.querySelector("#slider-offer-value, .offer-value");
    const fundingLabel = element.querySelector(".funding-description, .promo-dropdown-label");
    const depositLabelText = fundingLabel && fundingLabel.textContent.trim() || "Deposit amount";
    const creditLabelText = offerLabel && offerLabel.textContent.trim() || "Cash credit";
    cells.push([depositLabelText, creditLabelText]);
    const promoNote = element.querySelector(".promotion-note-container p, .promotion-note-container");
    if (promoNote && promoNote.textContent.trim()) {
      cells.push([promoNote.cloneNode(true), ""]);
    }
    const parseAmount = (text) => Number(String(text).replace(/[^0-9.]/g, "")) || 0;
    const rangeItems = [...element.querySelectorAll(".dropdown-item, .cfc__Dropdown__option")];
    const fundingTiers = rangeItems.map((li) => {
      const first = li.textContent.trim().split(/[-–—]|\+/)[0];
      return parseAmount(first);
    }).filter((n) => n > 0);
    const defaultDeposit = parseAmount((element.querySelector("#slider-default-slab-id") || {}).textContent || "");
    const defaultCredit = parseAmount((offerValue || {}).textContent || "");
    const knownBonus = /* @__PURE__ */ new Map();
    if (defaultDeposit > 0 && defaultCredit > 0) knownBonus.set(defaultDeposit, defaultCredit);
    const allFunding = [.../* @__PURE__ */ new Set([...fundingTiers, ...knownBonus.keys()])].sort((a, b) => a - b);
    const fmt = (n) => `$${n.toLocaleString("en-US")}`;
    allFunding.forEach((funding) => {
      const bonus = knownBonus.has(funding) ? fmt(knownBonus.get(funding)) : "";
      cells.push([fmt(funding), bonus]);
    });
    if (cells.length <= 1 && !allFunding.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "widget-calculator", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-feature.js
  function parse3(element, { document: document2 }) {
    const image = element.querySelector('picture, img.responsive-imageET, img[class*="responsive-image"], img');
    const eyebrow = element.querySelector('p.eyebrow, [class*="eyebrow"]');
    const heading = element.querySelector('h1, h2, h3, [class*="header-2xl"], [class*="header-xl"]');
    const bodyParas = [...element.querySelectorAll("p")].filter((p) => {
      if (p === eyebrow) return false;
      if (p.querySelector("a")) return false;
      return p.textContent.trim().length > 0;
    });
    const ctaLinks = [...element.querySelectorAll("a[href]")];
    if (!heading && !bodyParas.length && !ctaLinks.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const textCell = [];
    if (eyebrow) textCell.push(eyebrow);
    if (heading) textCell.push(heading);
    textCell.push(...bodyParas);
    textCell.push(...ctaLinks);
    const imageCell = image ? [image] : [""];
    const cells = [[imageCell, textCell]];
    const block = WebImporter.Blocks.createBlock(document2, { name: "columns-feature", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-pricing.js
  function parse4(element, { document: document2 }) {
    const nested = [...element.querySelectorAll(".card-container.pricing-card")];
    const cards = nested.length ? nested : element.matches && element.matches(".card-container.pricing-card") ? [element] : [element];
    const cells = [];
    cards.forEach((card) => {
      const cardCell = [];
      const figure = card.querySelector('.numeric-stats-lg, p[class*="numeric"]');
      if (figure) cardCell.push(figure);
      const heading = card.querySelector(".card-text-group h3, .card-text-group h2, h3, h2");
      if (heading) cardCell.push(heading);
      const description = card.querySelector(".card-text-group .text-default, .text-default");
      if (description && description !== heading) cardCell.push(description);
      const cta = card.querySelector(".card-btn-group a[href], a.btn[href], a[href]");
      if (cta) cardCell.push(cta);
      if (cardCell.length) cells.push([cardCell]);
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards-pricing", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-product.js
  function parse5(element, { document: document2 }) {
    const nested = [...element.querySelectorAll(".card-container.super-card-one")];
    const cards = nested.length ? nested : element.matches && element.matches(".card-container.super-card-one") ? [element] : [element];
    const cells = [];
    cards.forEach((card) => {
      const cardCell = [];
      const heading = card.querySelector(".card-text-group h3, h3");
      if (heading) cardCell.push(heading);
      const rate = card.querySelector(".card-text-group h4, h4");
      if (rate) cardCell.push(rate);
      const descWrap = card.querySelector(".card-text-group .text-default, .text-default");
      if (descWrap) {
        const paras = [...descWrap.querySelectorAll(":scope > p")];
        if (paras.length) cardCell.push(...paras);
        else cardCell.push(descWrap);
      }
      const cta = card.querySelector(".card-btn-group a[href], a.btn[href], a[href]");
      if (cta) cardCell.push(cta);
      if (cardCell.length) cells.push([cardCell]);
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards-product", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-award.js
  function parse6(element, { document: document2 }) {
    let items = [...element.querySelectorAll(".col-sm-4")].filter((col) => col.querySelector("h2, h3"));
    if (!items.length) {
      items = [...element.querySelectorAll(".richTextEditor")].filter((col) => col.querySelector("h2, h3"));
    }
    const cells = [];
    items.forEach((item) => {
      const image = item.querySelector("picture, img");
      const icon = item.querySelector('i.et-icon, [class*="et-icon"]');
      const badge = image || icon;
      const heading = item.querySelector("h2, h3");
      const paras = [...item.querySelectorAll("p")].filter((p) => p.textContent.trim().length > 0);
      if (!heading && !paras.length) return;
      const bodyCell = [];
      if (heading) bodyCell.push(heading);
      bodyCell.push(...paras);
      cells.push([badge ? [badge] : "", bodyCell]);
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "cards-award", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/accordion-faq.js
  function parse7(element, { document: document2 }) {
    const items = [...element.querySelectorAll("ul.accordion-group > li, .accordion-item-wrapper")];
    const cells = [];
    items.forEach((item) => {
      const questionEl = item.querySelector(".accordion-trigger__text") || item.querySelector("h4 .accordion-trigger__text");
      const headingEl = item.querySelector("h4, h3");
      let question;
      if (questionEl) {
        question = document2.createElement("p");
        question.textContent = questionEl.textContent.trim();
      } else if (headingEl) {
        question = document2.createElement("p");
        question.textContent = headingEl.textContent.trim();
      }
      const answer = item.querySelector(".accordion-item-content");
      if (!question || !answer) return;
      cells.push([question, answer]);
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document2, { name: "accordion-faq", cells });
    element.replaceWith(block);
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

  // tools/importer/import-home.js
  var parsers = {
    "hero-dark": parse,
    "widget-calculator": parse2,
    "columns-feature": parse3,
    "cards-pricing": parse4,
    "cards-product": parse5,
    "cards-award": parse6,
    "accordion-faq": parse7
  };
  var PAGE_TEMPLATE = {
    name: "home",
    description: "E*TRADE homepage: dark IPO hero, bonus offer + funding calculator, dark product-feature columns, pricing stat and product cards, awards, and an FAQ accordion.",
    urls: [
      "https://us.etrade.com/home"
    ],
    blocks: [
      {
        name: "hero-dark",
        instances: [
          "div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.hero-banner-overlay)",
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(1)"
        ]
      },
      {
        name: "widget-calculator",
        instances: [
          ".interactive-slider-container",
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2) .interactive-slider-container"
        ]
      },
      {
        name: "columns-feature",
        instances: [
          "div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.rounded-corner-image)"
        ]
      },
      {
        name: "cards-pricing",
        instances: [
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5) .card-container.pricing-card",
          ".card-container.pricing-card"
        ]
      },
      {
        name: "cards-product",
        instances: [
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5) .card-container.super-card-one",
          ".card-container.super-card-one"
        ]
      },
      {
        name: "cards-award",
        instances: [
          "div.root.maincontainer.responsivegrid > div > div > div > div.componentContainer:has(.et-top-five)",
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)"
        ]
      },
      {
        name: "accordion-faq",
        instances: [
          ".accordion.aem-GridColumn",
          "div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10) .accordion"
        ]
      }
    ],
    sections: [
      { id: 1, name: "hero", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(1)"], style: "dark", blocks: ["hero-dark"], defaultContent: [] },
      { id: 2, name: "bonus-offer-calculator", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2)"], style: "dark", blocks: ["widget-calculator"], defaultContent: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(2)"] },
      { id: 3, name: "product-feature-1", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(4)"], style: "dark", blocks: ["columns-feature"], defaultContent: [] },
      { id: 4, name: "pricing", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5)"], style: null, blocks: ["cards-pricing", "cards-product"], defaultContent: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(5)"] },
      { id: 5, name: "product-feature-2", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(6)"], style: "dark", blocks: ["columns-feature"], defaultContent: [] },
      { id: 6, name: "awards", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)"], style: null, blocks: ["cards-award"], defaultContent: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(8)"] },
      { id: 7, name: "faq", selector: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10)"], style: null, blocks: ["accordion-faq"], defaultContent: ["div.root.maincontainer.responsivegrid > div > div > div > div:nth-child(10)"] }
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
      if (!matched) {
        console.warn(`Block "${blockDef.name}" not found with any selector`);
      }
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_home_default = {
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
  return __toCommonJS(import_home_exports);
})();
