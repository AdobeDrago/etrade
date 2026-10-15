import {
  auditReferences, orderedEntries, pageDisclosurePath, parseSetSource,
  readSource, referenceMarkup, resolveSetPath, saveOrder, validateSet,
} from './model.js';

const demo = new URLSearchParams(window.location.search).get('demo') === '1';
const byId = (id) => document.getElementById(id);
let sdk;
let model;
let pageHtml = '';
let order = [];
let busy = false;
let dragIndex;
let setIssues = [];
const selected = new Set();
const emptyFragments = new Set();

function status(message, error = false) {
  byId('status').textContent = message;
  byId('status').classList.toggle('error', error);
}

const dirty = () => order.some((index, position) => index !== position);
const valid = () => model && !setIssues.some((issue) => issue.type === 'error');
const entries = () => orderedEntries(model, order)
  .filter((item) => !emptyFragments.has(item.fragment));

function updateControls() {
  byId('refresh').disabled = busy || !sdk;
  byId('save').disabled = busy || !valid() || !dirty();
  byId('reset').disabled = busy || !model || !dirty();
  byId('insert').disabled = busy || !valid() || dirty() || !selected.size
    || (!demo && (sdk.context.view !== 'edit' || model.path === sdk.context.path.replace(/\.html$/, '')));
  document.querySelectorAll('.disclosure-item input, .move-actions button').forEach((control) => {
    control.disabled = busy || control.dataset.unavailable === 'true';
  });
  document.querySelectorAll('.disclosure-item').forEach((item) => { item.draggable = !busy && valid(); });
}

function renderAudit() {
  if (!model) return;
  const result = auditReferences(pageHtml, valid() ? entries() : []);
  const issues = [...setIssues, ...result.issues];
  const errors = issues.filter((item) => item.type === 'error').length;
  byId('audit-summary').textContent = `${result.references} matching reference(s) · ${errors} error(s)${dirty() ? ' · Proposed order' : ''}`;
  const output = byId('audit-output');
  output.replaceChildren();
  issues.sort((a, b) => ['error', 'warn', 'ok'].indexOf(a.type) - ['error', 'warn', 'ok'].indexOf(b.type));
  issues.forEach(({ type, message }) => {
    const item = document.createElement('li');
    item.className = `audit-item ${type}`;
    item.textContent = message;
    output.append(item);
  });
  if (!issues.length) output.textContent = 'No disclosure references found in the saved page.';
}

function move(from, to) {
  if (busy || from === to || to < 0 || to >= order.length) return;
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  // Rebuilding the list installs the next set of move callbacks.
  // eslint-disable-next-line no-use-before-define
  render();
  status('Order changed. Save order to update the set.');
  byId('disclosure-list').children[to]?.querySelector('button:not(:disabled)')?.focus();
}

function render() {
  const list = byId('disclosure-list');
  list.replaceChildren();
  let number = 0;
  order.forEach((index, position) => {
    const entry = model.data.disclosures[index] || {};
    const { disclosureId, fragment } = entry;
    const available = valid() && !emptyFragments.has(fragment);
    if (available) number += 1;
    const item = document.createElement('li');
    item.className = 'disclosure-item';
    item.draggable = !busy && valid();
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-hidden', 'true');
    const badge = document.createElement('span');
    badge.className = 'number';
    badge.textContent = available ? String(number) : '—';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(disclosureId);
    checkbox.dataset.unavailable = String(!available);
    checkbox.setAttribute('aria-label', `Select ${disclosureId || `entry ${position + 1}`}`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(disclosureId);
      else selected.delete(disclosureId);
      updateControls();
    });
    const content = document.createElement('div');
    content.className = 'entry-content';
    const id = document.createElement('span');
    id.className = 'entry-id';
    id.textContent = disclosureId || 'Missing stable ID';
    const path = document.createElement('span');
    path.className = 'entry-path';
    path.textContent = fragment || 'Missing fragment';
    content.append(id, path);
    const controls = document.createElement('div');
    controls.className = 'move-actions';
    [-1, 1].forEach((direction) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = direction < 0 ? '↑' : '↓';
      button.setAttribute('aria-label', `Move ${disclosureId || 'entry'} ${direction < 0 ? 'up' : 'down'}`);
      button.dataset.unavailable = String(!valid()
        || position + direction < 0 || position + direction >= order.length);
      button.addEventListener('click', () => move(position, position + direction));
      controls.append(button);
    });
    item.append(handle, badge, checkbox, content, controls);
    item.addEventListener('dragstart', (event) => {
      if (busy || !valid()) { event.preventDefault(); return; }
      dragIndex = position;
      event.dataTransfer.setData('text/plain', String(position));
      event.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', (event) => {
      if (busy || dragIndex === undefined) return;
      event.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('dragend', () => { dragIndex = undefined; item.classList.remove('drag-over'); });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('drag-over');
      if (dragIndex !== undefined) move(dragIndex, position);
      dragIndex = undefined;
    });
    list.append(item);
  });
  renderAudit();
  updateControls();
}

async function load() {
  busy = true;
  model = undefined;
  selected.clear();
  emptyFragments.clear();
  byId('disclosure-list').replaceChildren();
  byId('audit-output').replaceChildren();
  byId('audit-summary').textContent = '';
  byId('source').textContent = '';
  updateControls();
  status('Loading the saved page and disclosure set…');
  try {
    const { context, actions } = sdk;
    pageHtml = await readSource(context, context.path, actions.daFetch);
    const directSet = context.path.startsWith('/disclosures/sets/');
    const path = resolveSetPath(directSet ? context.path : pageDisclosurePath(pageHtml), context);
    const source = directSet ? pageHtml : await readSource(context, path, actions.daFetch);
    model = parseSetSource(source, path);
    order = model.data.disclosures.map((_, index) => index);
    setIssues = validateSet(model);
    if (valid()) {
      const paths = [...new Set(model.data.disclosures.map((item) => item.fragment))];
      const checks = await Promise.all(paths.map(async (fragment) => {
        try {
          const html = await readSource(context, fragment, actions.daFetch);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const main = doc.querySelector('main');
          main?.querySelectorAll('.metadata, .da-metadata').forEach((item) => item.remove());
          if (!main || (!main.textContent.trim() && !main.querySelector('img, picture, .icon'))) {
            emptyFragments.add(fragment);
            return { type: 'warn', message: `Fragment ${fragment} is empty. Its disclosures will not receive a number.` };
          }
          return null;
        } catch (error) {
          return { type: 'error', message: error.message };
        }
      }));
      setIssues.push(...checks.filter(Boolean));
    }
    const link = document.createElement('a');
    const route = path.endsWith('.json') ? 'sheet' : 'form';
    link.href = `https://da.live/${route}#/${context.org}/${context.repo}${path}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `Edit set: ${path}`;
    byId('source').replaceChildren(link);
    if (directSet) pageHtml = '';
    render();
    status(valid() ? `Loaded ${model.data.disclosures.length} disclosure(s)${demo ? ' · Demo mode' : ''}.` : 'Fix the set or fragment errors shown in Audit, then refresh.', !valid());
  } catch (error) {
    model = undefined;
    order = [];
    status(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

async function save() {
  busy = true;
  updateControls();
  status('Saving disclosure order…');
  try {
    model = await saveOrder(sdk.context, model, order, sdk.actions.daFetch);
    order = model.data.disclosures.map((_, index) => index);
    render();
    status(demo ? 'Demo order saved locally. No DA content was changed.' : 'Order saved. Preview or publish the set in DA to update the site.');
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

document.querySelectorAll('[data-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-panel]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
    ['manage', 'audit'].forEach((id) => { byId(id).hidden = id !== button.dataset.panel; });
  });
});
byId('refresh').addEventListener('click', load);
byId('save').addEventListener('click', save);
byId('reset').addEventListener('click', () => {
  order = model.data.disclosures.map((_, index) => index);
  render();
  status('Restored the saved order.');
});
byId('insert').addEventListener('click', () => {
  try {
    sdk.actions.sendHTML(referenceMarkup([...selected], entries()));
    if (!demo) sdk.actions.closeLibrary();
  } catch (error) { status(error.message, true); }
});

async function init() {
  if (demo) {
    const { default: demoSdk } = await import('./demo.js');
    sdk = demoSdk((html) => {
      const output = byId('demo-reference');
      output.hidden = false;
      output.textContent = `Inserted marker: ${html}. The site displays its corresponding number and link.`;
    });
  } else if (window.parent !== window) {
    // The DA SDK owns authentication and token refresh; no credentials are stored here.
    // eslint-disable-next-line import/no-unresolved
    const { default: DA_SDK } = await import('https://da.live/nx/utils/sdk.js');
    sdk = await DA_SDK;
  } else return;
  if (!sdk?.context || !sdk.actions?.daFetch) throw new Error('Open Disclosure Manager through the DA Library to connect to your page.');
  await load();
}

const ready = init().catch((error) => status(error.message, true));
export default ready;
