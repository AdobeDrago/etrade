import {
  appendCardRow, fragmentReference, fragmentUrl, newCardBlock, siteContext,
} from './model.js';
import { catalogFiles, createDirectory, previewCard } from './source.js';

export default function mountPicker(doc, sdk, fetchCard = fetch) {
  const byId = (id) => doc.getElementById(id);
  const tabs = [...doc.querySelectorAll('[data-kind]')];
  const { context, actions, capabilities } = sdk;
  const site = siteContext(context);
  const list = createDirectory(context, actions.daFetch);
  const catalogs = new Map();
  let kind = 'fragment';
  let paths = [];
  let selected;
  let card;
  let live;
  let preview;
  let writing = false;
  const canTrackEdits = capabilities?.liveDocument === 1 && actions.subscribeLiveDocument;
  const canEdit = context.view === 'edit' && typeof actions.sendHTML === 'function';

  function updateActions() {
    const blockIndex = live?.selection?.blockIndex;
    const append = canEdit && card && capabilities?.sendHTMLReplace === 1
      && appendCardRow(doc, live, card);
    const create = canEdit && live?.editable === true && blockIndex === null && card;
    byId('append-card').disabled = writing || !append;
    byId('create-card').disabled = writing || !create;
    byId('insert-fragment').disabled = writing || !canEdit || !selected
      || (canTrackEdits && live?.editable !== true);
    if (!card) return;
    let hint = 'Place the cursor in a matching block to add a row, or in a paragraph between blocks to create one.';
    if (!canTrackEdits) hint = 'Open this page in DA Canvas to insert a Structured Card.';
    else if (live?.editable === false) hint = 'This page is read-only.';
    else if (append) hint = 'The card will be added as the last row of the selected block.';
    else if (create) hint = 'A matching block will be inserted at the cursor.';
    byId('placement').textContent = hint;
  }

  function clearPreview() {
    preview?.abort();
    selected = undefined;
    card = undefined;
    byId('card').hidden = true;
    byId('fragment').hidden = true;
    byId('fragment-frame').removeAttribute('src');
    byId('status').textContent = 'Select a source to preview it.';
    updateActions();
  }

  async function select(path, button) {
    clearPreview();
    selected = path;
    byId('results').querySelector('[aria-current]')?.removeAttribute('aria-current');
    button.setAttribute('aria-current', 'true');
    if (kind === 'fragment') {
      byId('fragment-frame').src = fragmentUrl(context, path);
      byId('fragment').hidden = false;
      byId('status').textContent = path;
      updateActions();
      return;
    }
    const request = new AbortController();
    preview = request;
    byId('status').textContent = 'Loading card preview…';
    try {
      const result = await previewCard(
        context,
        path,
        fetchCard,
        AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
      );
      if (request.signal.aborted) return;
      card = result;
      byId('card-title').textContent = result.title;
      byId('card-block').textContent = result.block;
      byId('card-description').textContent = result.description;
      byId('card').hidden = false;
      byId('status').textContent = path;
      updateActions();
    } catch (error) {
      if (!request.signal.aborted) byId('status').textContent = error.message;
    }
  }

  function renderResults() {
    const term = byId('search').value.trim().toLowerCase();
    const matched = paths.filter((path) => path.toLowerCase().includes(term));
    byId('catalog-status').textContent = matched.length ? '' : 'No matching sources.';
    byId('results').replaceChildren(...matched.map((path) => {
      const item = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = path;
      if (path === selected) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => select(path, button));
      item.append(button);
      return item;
    }));
  }

  async function show(next) {
    kind = next;
    clearPreview();
    tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.kind === next)));
    byId('search').disabled = true;
    byId('results').replaceChildren();
    byId('retry').hidden = true;
    byId('catalog-status').textContent = 'Loading sources…';
    if (!catalogs.has(next)) catalogs.set(next, catalogFiles(list, next));
    try {
      const results = await catalogs.get(next);
      if (kind !== next) return;
      paths = results;
      byId('search').disabled = false;
      renderResults();
    } catch (error) {
      catalogs.delete(next);
      if (kind !== next) return;
      byId('catalog-status').textContent = error.message;
      byId('retry').hidden = false;
    }
  }

  async function write(html, options) {
    if (writing) return;
    writing = true;
    updateActions();
    try {
      const result = await actions.sendHTML(html, options);
      if (options && !result?.ok) {
        throw new Error('The editor could not add the row. Check the selected block and try again.');
      }
      if (options && live?.html === options.expected.html) live = { ...live, ...result };
      byId('status').textContent = options ? 'Card row added.' : 'Insertion sent to the editor.';
    } catch (error) {
      byId('status').textContent = error.message;
    } finally {
      writing = false;
      updateActions();
    }
  }

  tabs.forEach((tab) => {
    tab.disabled = false;
    tab.addEventListener('click', () => { if (kind !== tab.dataset.kind) show(tab.dataset.kind); });
  });
  byId('retry').addEventListener('click', () => show(kind));
  byId('search').addEventListener('input', renderResults);
  byId('insert-fragment').addEventListener('click', () => {
    if (!byId('insert-fragment').disabled) write(fragmentReference(doc, context, selected));
  });
  byId('create-card').addEventListener('click', () => {
    if (!byId('create-card').disabled) write(newCardBlock(doc, card));
  });
  byId('append-card').addEventListener('click', () => {
    if (byId('append-card').disabled) return;
    const update = appendCardRow(doc, live, card);
    if (update) write(update.html, { expected: update.expected, replace: true });
  });
  if (canTrackEdits) {
    actions.subscribeLiveDocument((snapshot) => {
      live = snapshot;
      updateActions();
    });
  }
  if (site.org !== 'adobedrago' || site.repo !== 'etrade') {
    tabs.find((tab) => tab.dataset.kind === 'card').hidden = true;
  }
  return show(kind);
}

function enableDivider(doc) {
  const picker = doc.querySelector('.picker');
  const divider = doc.querySelector('.divider');
  const sources = doc.querySelector('.sources');
  const rem = parseFloat(getComputedStyle(doc.documentElement).fontSize);
  const minimum = 12 * rem;
  const maximum = () => Math.max(minimum, picker.clientWidth - 18 * rem);
  function announceWidth() {
    divider.setAttribute('aria-valuemin', Math.round(minimum));
    divider.setAttribute('aria-valuemax', Math.round(maximum()));
    divider.setAttribute('aria-valuenow', Math.round(sources.getBoundingClientRect().width));
  }
  function resize(width) {
    const clamped = Math.max(minimum, Math.min(maximum(), width));
    picker.style.setProperty('--file-list-width', `${clamped}px`);
    announceWidth();
  }
  let drag;
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    divider.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, width: sources.getBoundingClientRect().width };
  });
  divider.addEventListener('pointermove', (event) => {
    if (drag && divider.hasPointerCapture(event.pointerId)) {
      resize(drag.width + event.clientX - drag.x);
    }
  });
  divider.addEventListener('lostpointercapture', () => { drag = undefined; });
  divider.addEventListener('keydown', (event) => {
    const { width } = sources.getBoundingClientRect();
    const widths = {
      ArrowLeft: width - rem, ArrowRight: width + rem, Home: minimum, End: maximum(),
    };
    if (!Object.hasOwn(widths, event.key)) return;
    event.preventDefault();
    resize(widths[event.key]);
  });
  new ResizeObserver(announceWidth).observe(sources);
}

async function init() {
  enableDivider(document);
  if (window.parent === window) throw new Error('Open Reusable Content from the DA editor.');
  // eslint-disable-next-line import/no-unresolved
  const { default: connection } = await import('https://da.live/nx/utils/sdk.js');
  const timer = setTimeout(() => {
    document.getElementById('catalog-status').textContent = 'Waiting for DA. Reopen if disconnected.';
  }, 10000);
  const sdk = await connection.finally(() => clearTimeout(timer));
  return mountPicker(document, sdk);
}

if (typeof window !== 'undefined') {
  init().catch((error) => { document.getElementById('catalog-status').textContent = error.message; });
}
