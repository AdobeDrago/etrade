import { escapeMarkup, parseXmlDocument } from './model.js';

export const MAX_PAGE_XML_BYTES = 12000000;

export function pagePath(input) {
  const path = String(input || '').trim().replace(/\.html$/, '');
  if (!path.startsWith('/') || path.endsWith('/') || /[\s?#%\\]/.test(path)
    || Array.from(path).some((char) => char.codePointAt(0) < 32 || char.codePointAt(0) === 127)
    || path.slice(1).split('/').some((part) => !part || ['.', '..'].includes(part))) {
    throw new Error('Enter a page path such as /home, without a hostname, query or fragment.');
  }
  return path;
}

/** General DA export: a readable section inventory plus the complete saved HTML source. */
export function pageXml(source, context, input) {
  const path = pagePath(input);
  if (typeof source !== 'string' || !source.trim()) throw new Error('The saved page is empty.');
  if (new Blob([source]).size > 5000000) throw new Error('This demo exports pages up to 5 MB.');
  if (Array.from(source).some((char) => {
    const cp = char.codePointAt(0);
    return !(cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp <= 0xd7ff)
      || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff));
  })) throw new Error('The source contains characters that XML 1.0 cannot represent.');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const main = doc.querySelector('main');
  if (!main) throw new Error('This saved document has no main content to export.');
  const children = Array.from(main.children);
  const sections = children.length && children.every((node) => node.tagName === 'DIV')
    ? children : [main];
  const inventory = sections.map((section, index) => {
    const items = Array.from(section.children).map((node) => {
      const block = node.tagName === 'TABLE'
        ? node.querySelector('tr > :is(td, th)')?.textContent.trim()
        : node.tagName === 'DIV' && node.className;
      return block
        ? `      <block name="${escapeMarkup(block)}"><html>${escapeMarkup(node.outerHTML)}</html></block>`
        : `      <content tag="${node.tagName.toLowerCase()}"><html>${escapeMarkup(node.outerHTML)}</html></content>`;
    });
    return `    <section index="${index + 1}">\n${items.join('\n')}\n    </section>`;
  });
  // Character references preserve CR/CRLF when the XML parser normalizes newlines.
  const escapedSource = escapeMarkup(source).replaceAll('\r', '&#13;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<da-page version="1" org="${escapeMarkup(context.org)}" site="${escapeMarkup(context.repo)}" path="${escapeMarkup(path)}">\n  <sections>\n${inventory.join('\n')}\n  </sections>\n  <source-html>${escapedSource}</source-html>\n</da-page>\n`;
  if (new Blob([xml]).size > MAX_PAGE_XML_BYTES) throw new Error('This demo supports page XML up to 12 MB.');
  return xml;
}

function sourceUrl(context, path) {
  if (![context?.org, context?.repo].every((part) => typeof part === 'string' && /^[a-z0-9-]+$/i.test(part))) {
    throw new Error('Open XML Tools inside DA to connect to your site.');
  }
  const encoded = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `https://admin.da.live/source/${context.org}/${context.repo}${encoded}.html`;
}

function inspectSource(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('This XML page has no HTML source to import.');
  if (new Blob([source]).size > 5000000) throw new Error('This demo imports page source up to 5 MB.');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const main = doc.querySelector('main');
  if (!main) throw new Error('The imported page must contain a <main> element with its page content.');
  if (doc.querySelector('script, iframe, object, embed, base, meta[http-equiv]')) {
    throw new Error('Remove scripts, embedded frames, objects, and redirects before importing this page.');
  }
  Array.from(doc.querySelectorAll('*')).forEach((element) => {
    Array.from(element.attributes).forEach(({ name, value }) => {
      if (/^on[a-z]|^srcdoc$/i.test(name)) throw new Error('Remove executable event attributes before importing this page.');
      if (['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'poster'].includes(name.toLowerCase())
        && /^(javascript:|vbscript:|file:|data:text\/html)/i.test(value.replace(/\s/g, ''))) {
        throw new Error('Remove executable or local-file URLs before importing this page.');
      }
    });
  });
  const children = Array.from(main.children);
  const sections = children.length && children.every((node) => node.tagName === 'DIV')
    ? children : [main];
  const blocks = sections.reduce((total, section) => total + Array.from(section.children)
    .filter((node) => node.tagName === 'TABLE' || (node.tagName === 'DIV' && node.className)).length, 0);
  const title = doc.querySelector('title')?.textContent.trim()
    || main.querySelector('h1')?.textContent.trim() || 'Imported page';
  return {
    title, sections: sections.length, blocks, mainHtml: main.innerHTML,
  };
}

/** Restore our versioned full-page XML export, or a well-formed XHTML page. */
export function parsePageXml(xml) {
  const doc = parseXmlDocument(xml, MAX_PAGE_XML_BYTES);
  const root = doc.documentElement;
  let source;
  let originalPath;
  let format;
  if (root?.tagName === 'da-page' && !root.getAttribute('xmlns')) {
    if (root.getAttribute('version') !== '1') throw new Error('This tool imports da-page XML version 1.');
    const sources = Array.from(root.children).filter((node) => node.tagName === 'source-html');
    if (sources.length !== 1 || sources[0].children.length) throw new Error('The page XML must contain one text-only <source-html> element.');
    source = sources[0].textContent;
    originalPath = pagePath(root.getAttribute('path'));
    format = 'DA page XML';
  } else if (root?.localName === 'html'
    && (!root.getAttribute('xmlns') || root.getAttribute('xmlns') === 'http://www.w3.org/1999/xhtml')) {
    // Save HTML markup without the XML declaration; DA accepts the complete document.
    source = root.outerHTML;
    originalPath = '/imported-page';
    format = 'XHTML';
  } else {
    throw new Error('Choose a da-page XML export or an XHTML page with a <main> element. Product XML uses the separate product demo below.');
  }
  return {
    source, originalPath, format, ...inspectSource(source),
  };
}

export function pagePreview(source) {
  const { mainHtml } = inspectSource(source);
  // The sandbox and CSP block scripts, subresource requests, forms and top-level navigation.
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{margin:0;padding:24px;color:#242035;font:15px/1.6 Arial,sans-serif;overflow-wrap:anywhere}h1,h2,h3{line-height:1.25}h1{font-size:28px}h2{font-size:21px}main>div+div{border-top:1px solid #dedbe8;margin-top:24px;padding-top:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dedbe8;padding:8px;vertical-align:top}a{color:#5627d8}.metadata,.da-metadata{display:none}img{max-width:100%}</style></head><body><main>${mainHtml}</main></body></html>`;
}

export function samplePageXml() {
  const source = '<body><header></header><main><div><h1>Investing with confidence</h1><p>A sample page imported from XML, ready for <strong>author review</strong>.</p><p><a href="/what-we-offer/our-accounts">Explore accounts</a></p></div><div><h2>Find your next step</h2><div class="columns"><div><div><h3>Build your portfolio</h3><p>Explore investing choices that fit your goals.</p></div><div><h3>Plan for tomorrow</h3><p>Learn about retirement account options.</p></div></div></div></div><div><div class="metadata"><div><div>Title</div><div>XML page import demo</div></div><div><div>robots</div><div>noindex, nofollow</div></div></div></div></main><footer></footer></body>';
  return pageXml(source, { org: 'adobedrago', repo: 'etrade' }, '/xml-demo/pages/investing');
}

/** Create a new page on the connected site. Imports never replace existing source. */
export async function saveImportedPage(context, input, imported, request) {
  const path = pagePath(input);
  if (path.split('/').some((part) => part.startsWith('.'))) throw new Error('Choose a visible page path outside hidden configuration folders.');
  inspectSource(imported?.source);
  const url = sourceUrl(context, path);
  const existing = await request(`${url}?nocache=${Date.now()}`, { cache: 'no-store' });
  if (existing.ok) throw new Error('A page already exists at this path. Choose a new destination to keep the existing page.');
  if (existing.status !== 404) throw new Error(`Could not check the destination page (${existing.status}). Check your DA access.`);
  const body = new FormData();
  body.append('data', new Blob([imported.source], { type: 'text/html' }), 'page.html');
  const result = await request(url, { method: 'POST', body });
  if (!result.ok) throw new Error(`Could not create the DA page (${result.status}).`);
  return { path, source: imported.source };
}

export async function loadPageXml(context, input, request) {
  const path = pagePath(input);
  const url = sourceUrl(context, path);
  const response = await request(`${url}?nocache=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the saved page (${response.status}). Check the path and your DA access.`);
  const source = await response.text();
  return { path, xml: pageXml(source, context, path), filename: `${path.slice(1).replaceAll('/', '--')}.xml` };
}
