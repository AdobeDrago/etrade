import { escapeMarkup } from './model.js';

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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<da-page version="1" org="${escapeMarkup(context.org)}" site="${escapeMarkup(context.repo)}" path="${escapeMarkup(path)}">\n  <sections>\n${inventory.join('\n')}\n  </sections>\n  <source-html>${escapeMarkup(source)}</source-html>\n</da-page>\n`;
}

export async function loadPageXml(context, input, request) {
  if (![context?.org, context?.repo].every((part) => typeof part === 'string' && /^[a-z0-9-]+$/i.test(part))) {
    throw new Error('Open XML Tools inside DA to connect to your site.');
  }
  const path = pagePath(input);
  const encoded = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  const url = `https://admin.da.live/source/${context.org}/${context.repo}${encoded}.html`;
  const response = await request(`${url}?nocache=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load the saved page (${response.status}). Check the path and your DA access.`);
  const source = await response.text();
  return { path, xml: pageXml(source, context, path), filename: `${path.slice(1).replaceAll('/', '--')}.xml` };
}
