import { loadFragment } from '../fragment/fragment.js';
import { decorateIcons } from '../../scripts/aem.js';
import { disclosureSetRequest, loadDisclosureSet } from '../../scripts/disclosure-sets.js';
import decorateDisclosureReferences from '../../scripts/disclosure-references.js';

/** Render both legacy table rows and resolved rich-text fragments consistently. */
function renderDisclosures(block, entries) {
  const intro = document.createElement('div');
  intro.className = 'disclosures-intro';
  const closing = document.createElement('div');
  closing.className = 'disclosures-closing';
  const list = document.createElement('ol');
  list.className = 'disclosures-items';
  entries.forEach(({ label, disclosureId, nodes }) => {
    const content = document.createElement(/^\d+$/.test(label) ? 'li' : 'div');
    content.append(...nodes);
    if (!content.textContent.trim() && !content.querySelector('img, picture, .icon')) return;
    decorateIcons(content);
    content.querySelectorAll('a').forEach((link) => link.classList.remove('button', 'primary', 'secondary', 'accent'));
    if (/^\d+$/.test(label)) {
      const number = disclosureId ? list.children.length + 1 : Number(label);
      content.id = `disclosure-${disclosureId || number}`;
      content.setAttribute('value', String(number));
      if (disclosureId) content.dataset.disclosureId = disclosureId;
      content.tabIndex = -1;
      list.append(content);
    } else if (/^closing$/i.test(label)) closing.append(content);
    else {
      if (/^notice$/i.test(label)) content.className = 'disclosures-notice';
      if (/^logo$/i.test(label)) {
        content.className = 'disclosures-logo';
        const icon = content.querySelector('.icon');
        const name = content.textContent.trim();
        if (icon && name) {
          icon.setAttribute('role', 'img');
          icon.setAttribute('aria-label', name);
          content.replaceChildren(icon);
        }
      }
      intro.append(content);
    }
  });
  block.replaceChildren();
  if (intro.children.length) block.append(intro);
  if (list.children.length) block.append(list);
  if (closing.children.length) block.append(closing);
  block.hidden = !block.children.length;
  if (!block.hidden) decorateDisclosureReferences(document.querySelector('main'), block);
}

/** Fetch each document once, then clone it for every position in the set. */
async function renderSet(block, url) {
  const entries = await loadDisclosureSet(url);
  const documents = new Map();
  entries.forEach(({ path }) => {
    if (!documents.has(path)) documents.set(path, loadFragment(path, { decorate: false }));
  });
  const rows = await Promise.all(entries.map(async ({ label, disclosureId, path }) => {
    const fragment = await documents.get(path);
    if (!fragment) throw new Error(`Disclosure fragment could not be loaded: ${path}`);
    const nodes = [...fragment.childNodes].flatMap((section) => (
      section.nodeType === 1 && section.tagName === 'DIV'
        ? [...section.childNodes] : [section]
    )).map((node) => node.cloneNode(true));
    return { label, disclosureId, nodes };
  }));
  renderDisclosures(block, rows);
}

export default async function decorate(block) {
  const reference = block.querySelector(':scope > div > div > a[href], :scope > div > div > p > a[href]');
  const isReference = reference && block.textContent.trim() === reference.textContent.trim();
  if (block.children.length === 1 && isReference) {
    try {
      const request = disclosureSetRequest(reference.href);
      if (request) {
        await renderSet(block, request);
      } else {
        const fragment = await loadFragment(new URL(reference.href).pathname);
        const content = fragment?.querySelector('.disclosures');
        block.replaceChildren(...(content ? [...content.childNodes] : []));
        block.hidden = !content;
        if (!block.hidden) decorateDisclosureReferences(document.querySelector('main'), block);
      }
    } catch (error) {
      block.replaceChildren();
      block.hidden = true;
      // eslint-disable-next-line no-console
      console.error('Disclosure loading failed', error);
    }
    return;
  }
  const entries = [...block.children].flatMap((row) => {
    const [key, ...cells] = row.children;
    if (!key || !cells.length) return [];
    return [{
      label: key.textContent.trim(),
      nodes: cells.flatMap((cell) => [...cell.childNodes]),
    }];
  });
  renderDisclosures(block, entries);
}
