import decorateDisclosureReferences from './disclosure-references.js';
import cardBody, { cardURL } from './card-body.js';
import { cardGlyphs } from './media-cards.js';
import { authoredLinkHref } from './link-source.js';

const DELIVERY = 'https://da-sc.adobeaem.workers.dev';
const SITE = '/adobedrago/etrade';
const requests = new WeakMap();
const mediaBlocks = new Set(['cards', 'cards-article', 'cards-platform', 'cards-award', 'cards-icon', 'carousel-story']);
const rateBlocks = new Set(['cards-account', 'cards-product', 'cards-pricing']);
const rateKeys = ['name', 'mode', 'product', 'field', 'balance', 'term', 'override', 'fallback'];
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Strict document paths, with optional authored HTML extension. */
function documentPath(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)[a-z0-9_~./-]+$/i.test(value)) return null;
  const path = value.replace(/(?:\.plain)?\.html$/, '');
  if (path.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) return null;
  return path;
}

/** References always follow this page's preview/live environment. */
export function structuredCardRequest(value, base = window.location.href) {
  if (!text(value) || /[\\%\s]/.test(value)) return null;
  try {
    const page = new URL(base);
    const url = new URL(value, page);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    const projectHost = /--etrade--adobedrago\.aem\.(page|live)$/i.test(url.hostname);
    let path = url.pathname;
    if (url.origin === DELIVERY) {
      const prefix = /^\/(preview|live)\/adobedrago\/etrade\//;
      if (!prefix.test(path)) return null;
      path = path.replace(prefix, '/');
    } else if (url.origin !== page.origin && !(projectHost && url.protocol === 'https:' && !url.port)) return null;
    path = documentPath(path);
    if (!path?.startsWith('/cards/') || path.endsWith('.json')) return null;
    const preview = /(?:\.aem\.page$|\.hlx\.page$|da\.live$)/i.test(page.hostname)
      || ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
    return `${DELIVERY}/${preview ? 'preview' : 'live'}${SITE}${path}`;
  } catch {
    return null;
  }
}

function rowSource(row, base) {
  const cells = [...row.children].filter((cell) => cell.textContent.trim() || cell.querySelector('img, picture, svg, .icon'));
  if (cells.length !== 1 || cells[0].querySelector('img, picture, svg, .icon')) return null;
  const [cell] = cells;
  const links = [...cell.querySelectorAll('a[href]')];
  if (links.length > 1
    || (links.length === 1 && cell.textContent.trim() !== links[0].textContent.trim())) return null;
  const value = links.length ? authoredLinkHref(links[0]) : cell.textContent.trim();
  return structuredCardRequest(value, base);
}

function request(doc, url, json) {
  if (!requests.has(doc)) requests.set(doc, new Map());
  const cache = requests.get(doc);
  if (!cache.has(url)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    cache.set(url, (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: json ? 'omit' : 'same-origin' });
        if (!response.ok) throw new Error(`Card content request failed (${response.status}).`);
        return await (json ? response.json() : response.text());
      } finally {
        clearTimeout(timer);
      }
    })());
  }
  return cache.get(url);
}

function paragraph(doc, value, tag = 'p') {
  const element = doc.createElement(tag);
  element.textContent = text(value);
  return element;
}

function disclosures(element, ids) {
  if (!Array.isArray(ids)) return;
  const valid = ids.filter((id) => typeof id === 'string' && /^[a-z][a-z0-9]*$/.test(id));
  if (!valid.length) return;
  const marker = element.ownerDocument.createElement('sup');
  marker.textContent = [...new Set(valid)].join(',');
  element.append(marker);
}

function imageCell(doc, image, base) {
  if (!image || typeof image !== 'object') return null;
  const src = cardURL(image.src, base, true);
  if (!src) return null;
  // Empty alt is meaningful only when decoration is explicitly selected.
  if (image.decorative !== true && !text(image.alt)) throw new Error('Informative card images require alternative text.');
  const cell = doc.createElement('div');
  const picture = doc.createElement('picture');
  const img = doc.createElement('img');
  img.src = src.href;
  img.alt = image.decorative === true ? '' : text(image.alt);
  img.loading = 'lazy';
  picture.append(img);
  cell.append(picture);
  return cell;
}

/** Translate only defined fields; card decorators retain control of presentation. */
async function cardCells(doc, payload, name, base) {
  const data = payload?.data ?? payload;
  if (!data || Array.isArray(data) || !/^[a-z][a-z0-9-]*$/.test(text(data.id)) || !text(data.title)) {
    throw new Error('Structured cards require a valid id and title.');
  }
  const cells = [];
  if (mediaBlocks.has(name)) {
    let media = imageCell(doc, data.image, base);
    if (name === 'cards-icon' && data.kind === 'offer') {
      media = paragraph(doc, 'offer', 'div');
    } else if (!media && name === 'cards-icon' && cardGlyphs.has(data.icon)) {
      media = paragraph(doc, data.icon, 'div');
    } else if (!media && name === 'cards-award' && data.icon === 'award') {
      media = doc.createElement('div');
      const icon = doc.createElement('span');
      icon.className = 'icon icon-award';
      media.append(icon);
    }
    if (media) cells.push(media);
  }
  const body = doc.createElement('div');
  let bodyIds = new Map();
  if (name === 'cards-pricing' && text(data.value)) {
    const value = paragraph(doc, data.value);
    disclosures(value, data.valueDisclosureIds);
    body.append(value);
  }
  if (['cards-article', 'carousel-story'].includes(name) && text(data.eyebrow)) body.append(paragraph(doc, data.eyebrow));
  const heading = paragraph(doc, data.title, 'h3');
  heading.dataset.cardId = data.id;
  body.append(heading);
  if (rateBlocks.has(name) && text(data.rateText)) {
    const rate = paragraph(doc, data.rateText, 'h4');
    disclosures(rate, data.rateDisclosureIds);
    body.append(rate);
  }
  if (data.bodyFragment !== undefined && data.bodyFragment !== '') {
    const path = documentPath(data.bodyFragment);
    if (!path) throw new Error('Use a same-site document path for card body content.');
    const html = await request(doc, `${new URL(path, base).href}.plain.html`, false);
    const { content: rich, ids } = cardBody(doc, html, new URL(path, base).href);
    bodyIds = ids;
    if (!rich.textContent.trim() && !rich.querySelector('img, .icon')) throw new Error('Card body content is empty.');
    body.append(...rich.childNodes);
    if (Array.isArray(data.disclosureIds) && data.disclosureIds.length) {
      const marker = doc.createElement('p');
      disclosures(marker, data.disclosureIds);
      if (marker.childNodes.length) body.append(marker);
    }
  } else if (text(data.description) || data.disclosureIds?.length) {
    const description = paragraph(doc, data.description);
    disclosures(description, data.disclosureIds);
    body.append(description);
  }
  if (name === 'cards-award' && text(data.attribution)) body.append(paragraph(doc, data.attribution));
  if (Array.isArray(data.actions)) {
    data.actions.forEach((action) => {
      if (!text(action?.label) || !cardURL(action.href, base)) return;
      const link = doc.createElement('a');
      link.textContent = action.label;
      const href = action.href.trim();
      link.setAttribute('href', href.startsWith('#') && bodyIds.has(href.slice(1))
        ? `#${bodyIds.get(href.slice(1))}` : href);
      if (action.target === '_blank') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      if (text(action.ariaLabel)) link.setAttribute('aria-label', action.ariaLabel);
      const wrapper = doc.createElement('p');
      wrapper.append(link);
      body.append(wrapper);
    });
  }
  cells.push(body);
  if (rateBlocks.has(name) && Array.isArray(data.rates)) {
    data.rates.forEach((binding) => {
      const settings = paragraph(doc, '', 'div');
      settings.append(paragraph(doc, 'Rate settings'));
      rateKeys.forEach((key) => {
        const value = binding?.[key];
        if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
          settings.append(paragraph(doc, `${key}: ${value}`));
        }
      });
      cells.push(settings);
    });
  }
  return cells;
}

/** No source rows: return synchronously, preserving ordinary card decoration. */
export default function loadStructuredCards(block) {
  const doc = block.ownerDocument;
  // Do not inspect URLs unless a row could be a source, including in existing test/author hosts.
  const base = doc.defaultView.location.href;
  const sources = [...block.children].map((row) => ({ row, url: rowSource(row, base) }))
    .filter(({ url }) => url);
  if (!sources.length) return null;
  const name = block.dataset.blockName || [...block.classList][0];
  return Promise.all(sources.map(async ({ row, url }) => {
    try {
      const payload = await request(doc, url, true);
      const cells = await cardCells(doc, payload, name, base);
      row.replaceChildren(...cells);
    } catch (error) {
      row.remove();
      // eslint-disable-next-line no-console
      console.error('Structured card loading failed', url, error);
    }
  })).then(async () => {
    const [{ decorateIcons }, { decorateTrackingLinks }] = await Promise.all([
      import('./aem.js'), import('./tracking.js'),
    ]);
    decorateIcons(block);
    decorateTrackingLinks(block, base);
    decorateDisclosureReferences(block);
  });
}
