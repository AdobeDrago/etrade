/** Keep authenticated requests and authoring links inside the SDK's current site. */
function documentPath(context, path) {
  const normalized = typeof path === 'string' ? path.trim().replace(/(?:\.plain)?\.html$/, '') : '';
  if (!normalized.startsWith('/') || normalized === '/' || /[%\s?#\\]/.test(normalized)
    || normalized.split('/').slice(1).some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Use a document path within this site.');
  }
  if (![context.org, context.repo].every((part) => /^[a-z0-9-]+$/i.test(part || ''))) {
    throw new Error('DA did not provide a valid site context.');
  }
  return normalized;
}

export function sourceUrl(context, path) {
  const normalized = documentPath(context, path);
  return `https://admin.da.live/source/${context.org}/${context.repo}${normalized}${normalized.endsWith('.json') ? '' : '.html'}`;
}

export function authoringUrl(context, path, view = 'edit') {
  const normalized = documentPath(context, path);
  if (!['edit', 'form', 'sheet', 'browse'].includes(view)) throw new Error('Unsupported DA editor.');
  return `https://da.live/${view === 'browse' ? '' : view}#/${context.org}/${context.repo}${normalized}`;
}

export async function readSource(context, path, request) {
  const url = new URL(sourceUrl(context, path));
  url.searchParams.set('nocache', String(Date.now()));
  const response = await request(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.text();
}

/** Render a saved copy preview without executing scripts or loading authored media. */
export function sourcePreview(html, context) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('main');
  main?.querySelectorAll('.metadata, .da-metadata').forEach((item) => item.remove());
  const empty = !main || (!main.textContent.trim() && !main.querySelector('img, picture, .icon'));
  const content = document.createDocumentFragment();
  const allowed = new Set(['P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'SUP', 'SUB', 'BR', 'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);
  const skip = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEMPLATE']);
  function append(node, parent) {
    if (node.nodeType === 3) { parent.append(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== 1 || skip.has(node.tagName)) return;
    if (node.tagName === 'IMG') {
      const alt = node.getAttribute('alt');
      if (alt) parent.append(document.createTextNode(`[${alt}]`));
      return;
    }
    const target = allowed.has(node.tagName)
      ? document.createElement(node.tagName.toLowerCase()) : parent;
    if (node.tagName === 'A' && node.getAttribute('href')) {
      try {
        const url = new URL(node.getAttribute('href'), `https://main--${context.repo}--${context.org}.aem.page/`);
        if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) {
          target.setAttribute('href', url.href);
          target.setAttribute('target', '_blank');
          target.setAttribute('rel', 'noopener noreferrer');
        }
      } catch { /* Preserve link text when the destination is invalid. */ }
    }
    [...node.childNodes].forEach((child) => append(child, target));
    if (target !== parent) parent.append(target);
  }
  [...(main?.childNodes || [])].forEach((node) => append(node, content));
  const text = [...content.childNodes].map((node) => node.textContent).join(' ').trim();
  return { content, text, empty };
}
