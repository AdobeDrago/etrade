import { loadFragment } from '../fragment/fragment.js';
import { decorateIcons } from '../../scripts/aem.js';
import { disclosureFragmentPath, disclosureSetRequest, loadDisclosureSet } from '../../scripts/disclosure-sets.js';
import decorateDisclosureReferences from '../../scripts/disclosure-references.js';

function finishDisclosures(block) {
  decorateIcons(block);
  block.querySelectorAll('a').forEach((link) => link.classList.remove('button', 'primary', 'secondary', 'accent'));
  block.hidden = !block.textContent.trim() && !block.querySelector('img, picture, .icon');
  if (!block.hidden) decorateDisclosureReferences(document.querySelector('main'), block);
}

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
  finishDisclosures(block);
}

function renderTable(block) {
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

/** Preserve rich-text pages, using only their top-level ordered lists as disclosures. */
function renderPage(block, fragment) {
  const nodes = [...fragment.childNodes].flatMap((section) => (
    section.nodeType === 1 && section.tagName === 'DIV' && !section.className
      ? [...section.childNodes] : [section]
  ));
  const children = [];
  let content;
  let hasList = false;
  nodes.forEach((node) => {
    if (node.nodeType === 3 && !node.textContent.trim()) return;
    if (node.nodeType === 1 && node.tagName === 'OL') {
      const items = [...node.children].filter((item) => item.tagName === 'LI');
      const step = node.hasAttribute('reversed') ? -1 : 1;
      let number = Number(node.getAttribute('start') ?? (step < 0 ? items.length : 1));
      node.classList.add('disclosures-items');
      items.forEach((item) => {
        number = Number(item.getAttribute('value') ?? number);
        if (!item.id) item.id = `disclosure-${number}`;
        item.setAttribute('value', String(number));
        item.tabIndex = -1;
        number += step;
      });
      children.push(node);
      content = null;
      hasList = true;
    } else {
      if (!content) {
        content = document.createElement('div');
        content.className = hasList ? 'disclosures-closing' : 'disclosures-intro';
        children.push(content);
      }
      content.append(node);
    }
  });
  block.replaceChildren(...children);
  finishDisclosures(block);
}

/** Load raw legal copy before any page auto-block transformations can rewrite it. */
async function renderDocument(block, url) {
  const path = disclosureFragmentPath(new URL(url).pathname);
  const fragment = await loadFragment(path, { decorate: false });
  if (!fragment) throw new Error(`Disclosure document could not be loaded: ${path}`);
  const content = fragment.querySelector('.disclosures');
  if (!content) {
    renderPage(block, fragment);
    return;
  }
  if (!content.querySelector('.disclosures-items, .disclosures-intro, .disclosures-closing')) {
    renderTable(content);
  }
  block.replaceChildren(...content.childNodes);
  finishDisclosures(block);
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
        await renderDocument(block, reference.href);
      }
    } catch (error) {
      block.replaceChildren();
      block.hidden = true;
      // eslint-disable-next-line no-console
      console.error('Disclosure loading failed', error);
    }
    return;
  }
  renderTable(block);
}
