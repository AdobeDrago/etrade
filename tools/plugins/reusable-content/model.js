const schemas = new Map([
  ['card', 'cards'],
  ['card-account', 'cards-account'],
  ['card-product', 'cards-product'],
  ['card-pricing', 'cards-pricing'],
  ['card-article', 'cards-article'],
  ['card-platform', 'cards-platform'],
  ['card-icon', 'cards-icon'],
  ['card-award', 'cards-award'],
  ['card-numbered', 'cards-numbered'],
  ['card-story', 'carousel-story'],
]);

export function validPath(path) {
  return typeof path === 'string' && /^(?:\/[a-z0-9_.~-]+)+$/i.test(path)
    && !path.split('/').some((part) => part === '.' || part === '..');
}

export function siteContext({ org, repo, site } = {}) {
  const names = [org, repo || site].map((name) => name?.toLowerCase());
  if (!names.every((name) => /^[a-z0-9-]+$/.test(name))) throw new Error('Open this extension from a DA page.');
  return { org: names[0], repo: names[1] };
}

export function fragmentUrl(context, path) {
  const { org, repo } = siteContext(context);
  if (!validPath(path) || !path.includes('/fragments/')) throw new Error('Invalid fragment path.');
  return `https://main--${repo}--${org}.aem.page${path}`;
}

function link(doc, href, label) {
  const anchor = doc.createElement('a');
  anchor.setAttribute('href', href);
  anchor.textContent = label;
  return anchor;
}

export function fragmentReference(doc, context, path) {
  const url = fragmentUrl(context, path);
  const anchor = link(doc, url, url);
  anchor.className = 'fragment';
  return anchor.outerHTML;
}

export function cardRecord(path, payload) {
  const block = schemas.get(payload?.metadata?.schemaName);
  const { id, title, description } = payload?.data ?? {};
  if (!validPath(path) || !path.startsWith('/cards/') || path.endsWith('.json')
    || !block || typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id.trim())
    || typeof title !== 'string' || !title.trim()) {
    throw new Error('This source is not a supported Structured Card.');
  }
  return {
    path, block, title: title.trim(), description: typeof description === 'string' ? description : '',
  };
}

function cardRow(doc, record, rowTag, cellTag) {
  const row = doc.createElement(rowTag);
  const cell = doc.createElement(cellTag);
  const paragraph = doc.createElement('p');
  paragraph.append(link(doc, record.path, record.title));
  cell.append(paragraph);
  row.append(cell);
  return row;
}

export function newCardBlock(doc, record) {
  const table = doc.createElement('table');
  const body = doc.createElement('tbody');
  const header = doc.createElement('tr');
  const cell = doc.createElement('td');
  const name = doc.createElement('p');
  name.textContent = record.block;
  cell.append(name);
  header.append(cell);
  body.append(header, cardRow(doc, record, 'tr', 'td'));
  table.append(body);
  return table.outerHTML;
}

export function appendCardRow(doc, snapshot, record) {
  const blockIndex = snapshot?.selection?.blockIndex;
  if (snapshot?.editable !== true || !Number.isSafeInteger(blockIndex) || blockIndex < 0
    || typeof snapshot.html !== 'string') return null;
  const template = doc.createElement('template');
  template.innerHTML = snapshot.html;
  // Canvas selection is an ordinal. The HTML marker is a position in the editor document.
  const blocks = template.content.querySelectorAll(
    'main > div > div[data-block-index], main > div > div.library-metadata',
  );
  const block = blocks[blockIndex];
  if (!block?.hasAttribute('data-block-index') || [...block.classList][0] !== record.block) return null;
  block.append(cardRow(doc, record, 'div', 'div'));
  return { html: block.outerHTML, expected: { html: snapshot.html, blockIndex } };
}
