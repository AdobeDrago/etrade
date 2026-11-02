import { disclosureSetEntries } from '../../../scripts/disclosure-sets.js';
import { orderedEntries } from './model.js';

function textOf(element) {
  const copy = element.cloneNode(true);
  copy.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, br').forEach((node) => { node.append(' '); });
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/** Keep authored rich text in an inert preview; never execute fragment markup. */
export function previewContent(source) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const main = doc.querySelector('main');
  if (!main) {
    return {
      html: '', title: '', excerpt: '', empty: true,
    };
  }
  main.querySelectorAll('.metadata, .da-metadata, script, style, iframe, object, embed, form, input, button, select, textarea, link, meta, base, svg, math')
    .forEach((node) => node.remove());
  const hasMedia = Boolean(main.querySelector('img, picture, .icon'));
  const heading = main.querySelector('h1, h2, h3, h4, h5, h6') || main.querySelector('p');
  const title = textOf(heading || main);
  const text = textOf(main);
  const excerptCopy = main.cloneNode(true);
  const excerptHeading = excerptCopy.querySelector('h1, h2, h3, h4, h5, h6') || excerptCopy.querySelector('p');
  excerptHeading?.remove();
  const excerpt = textOf(excerptCopy) || text;
  main.querySelectorAll('img').forEach((img) => {
    const placeholder = doc.createElement('span');
    placeholder.textContent = img.getAttribute('alt') ? `[${img.getAttribute('alt')}]` : '[Image]';
    img.replaceWith(placeholder);
  });
  main.querySelectorAll('source').forEach((node) => node.remove());
  main.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach(({ name }) => {
      if (!['colspan', 'rowspan', 'scope', 'lang', 'dir'].includes(name)) node.removeAttribute(name);
    });
  });
  return {
    html: main.innerHTML,
    title: title.length > 90 ? `${title.slice(0, 89)}…` : title,
    excerpt: excerpt.length > 180 ? `${excerpt.slice(0, 179)}…` : excerpt,
    empty: !text && !hasMedia,
  };
}

export function footerEntries(model, order) {
  return disclosureSetEntries({ ...model.data, disclosures: orderedEntries(model, order) });
}

export function footerPreview(model, order, fragments, selected, origin) {
  const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html');
  const block = doc.createElement('div');
  block.className = 'disclosures';
  const intro = doc.createElement('div');
  intro.className = 'disclosures-intro';
  const list = doc.createElement('ol');
  list.className = 'disclosures-items';
  const closing = doc.createElement('div');
  closing.className = 'disclosures-closing';
  footerEntries(model, order).forEach(({ label, disclosureId, path }) => {
    const fragment = fragments.get(path);
    if (!fragment || fragment.empty) return;
    const item = doc.createElement(disclosureId ? 'li' : 'div');
    item.innerHTML = fragment.html;
    if (disclosureId) {
      item.setAttribute('value', String(list.children.length + 1));
      item.dataset.disclosureId = disclosureId;
      if (selected.has(disclosureId)) item.className = 'preview-selected';
      list.append(item);
    } else if (label === 'Closing') closing.append(item);
    else {
      if (label === 'Notice') item.className = 'disclosures-notice';
      intro.append(item);
    }
  });
  if (intro.children.length) block.append(intro);
  if (list.children.length) block.append(list);
  if (closing.children.length) block.append(closing);
  const base = new URL(origin).origin;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${base}; font-src ${base}; form-action 'none'; base-uri 'none'"><link rel="stylesheet" href="${base}/styles/styles.css"><link rel="stylesheet" href="${base}/blocks/disclosures/disclosures.css"><style>body{margin:0;background:#fff;font-family:Arial,sans-serif}.disclosures{padding-top:16px}.preview-selected{outline:2px solid #5627d8;outline-offset:4px}a{color:inherit;text-decoration:underline}</style></head><body class="appear">${block.outerHTML}</body></html>`;
}
