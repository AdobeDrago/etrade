const allowedTags = new Set('P DIV SPAN STRONG B EM I U S SUB SUP UL OL LI BR A PICTURE SOURCE IMG TABLE THEAD TBODY TFOOT TR TH TD BLOCKQUOTE CODE PRE H1 H2 H3 H4 H5 H6 HR'.split(' '));
const discardedTags = new Set('SCRIPT STYLE IFRAME OBJECT EMBED FORM INPUT BUTTON LINK META BASE SVG MATH'.split(' '));
let sequence = 0;

/** Only navigable web/contact URLs or web images; never executable schemes. */
export function cardURL(value, base, image = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value, base);
    if (url.username || url.password) return null;
    if (!(image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']).includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Copy phrasing, lists and media without executable markup or duplicate IDs. */
export default function cardBody(doc, html, base) {
  // Template contents are inert: original images/events must not run before filtering.
  const source = doc.createElement('template');
  source.innerHTML = html;
  const body = doc.createElement('div');
  const ids = new Map();
  sequence += 1;
  function copy(parent, node) {
    if (node.nodeType === 3) {
      parent.append(doc.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== 1 || discardedTags.has(node.tagName)) return;
    if (!allowedTags.has(node.tagName)) {
      [...node.childNodes].forEach((child) => copy(parent, child));
      return;
    }
    const element = doc.createElement(node.tagName.toLowerCase());
    const id = node.getAttribute('id');
    if (id && !ids.has(id)) {
      ids.set(id, `card-body-${sequence}-${ids.size + 1}`);
      element.id = ids.get(id);
    }
    ['alt', 'title', 'lang', 'dir', 'colspan', 'rowspan', 'scope', 'start', 'value', 'reversed', 'width', 'height'].forEach((key) => {
      if (node.hasAttribute(key)) element.setAttribute(key, node.getAttribute(key));
    });
    if (node.tagName === 'SPAN' && /^icon(?: icon-[a-z0-9-]+)+$/.test(node.className)) element.className = node.className;
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (cardURL(href, base)) element.setAttribute('href', href.startsWith('#') ? href : new URL(href, base).href);
      if (node.getAttribute('target') === '_blank') {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
      if (node.hasAttribute('aria-label')) element.setAttribute('aria-label', node.getAttribute('aria-label'));
    }
    if (['IMG', 'SOURCE'].includes(node.tagName)) {
      const src = cardURL(node.getAttribute('src'), base, true);
      if (src) element.setAttribute('src', src.href);
      const srcset = node.getAttribute('srcset')?.split(',').map((candidate) => {
        const [path, descriptor, ...extra] = candidate.trim().split(/\s+/);
        const url = cardURL(path, base, true);
        if (!url || extra.length || (descriptor && !/^\d+(?:\.\d+)?[wx]$/.test(descriptor))) return '';
        return `${url.href}${descriptor ? ` ${descriptor}` : ''}`;
      }).filter(Boolean)
        .join(', ');
      if (srcset) element.setAttribute('srcset', srcset);
      ['media', 'type'].forEach((key) => {
        if (node.hasAttribute(key)) element.setAttribute(key, node.getAttribute(key));
      });
      if (node.tagName === 'IMG') {
        element.alt = node.getAttribute('alt') || '';
        element.loading = 'lazy';
      }
    }
    [...node.childNodes].forEach((child) => copy(element, child));
    parent.append(element);
  }
  [...source.content.childNodes].forEach((node) => copy(body, node));
  body.querySelectorAll('a[href^="#"]').forEach((link) => {
    const target = ids.get(link.getAttribute('href').slice(1));
    if (target) link.setAttribute('href', `#${target}`);
  });
  // Backend sections are wrappers, not part of a card's authored body.
  body.querySelectorAll('div:not([id])').forEach((section) => section.replaceWith(...section.childNodes));
  return { content: body, ids };
}
