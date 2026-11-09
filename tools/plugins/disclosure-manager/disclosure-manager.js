import {
  auditReferences, orderedEntries, pageDisclosurePath, parseSetSource,
  readSource, referenceMarkup, resolveSetPath, validateSet,
} from './model.js';
import { footerEntries, footerPreview, previewContent } from './preview.js';
import { disclosureFragmentPath, disclosureSetMode } from '../../../scripts/disclosure-sets.js';
import { planAffectedSources } from './inventory.js';
import {
  applyOperation, readOperation, restoreOperation, resumeOperation,
} from './operations.js';

const demo = new URLSearchParams(window.location.search).get('demo') === '1';
const byId = (id) => document.getElementById(id);
let sdk;
let model;
let pageHtml = '';
let order = [];
let busy = false;
let dragIndex;
let setIssues = [];
let reviewed;
let pending;
let liveHtml;
const selected = new Set();
const emptyFragments = new Set();
const fragmentContents = new Map();

function status(message, error = false) {
  byId('status').textContent = message;
  byId('status').classList.toggle('error', error);
}

const dirty = () => order.some((index, position) => index !== position);
const valid = () => model && !setIssues.some((issue) => issue.type === 'error');
const needsRecovery = () => pending && !['complete', 'restored'].includes(pending.status);
const savedEntries = () => (model?.data.disclosures || [])
  .filter((item) => !emptyFragments.has(disclosureFragmentPath(item.fragment)));
const entries = () => orderedEntries(model, order)
  .filter((item) => !emptyFragments.has(disclosureFragmentPath(item.fragment)));

function renderPreview() {
  byId('footer-preview').srcdoc = model
    ? footerPreview(model, order, fragmentContents, selected, window.location.origin) : '';
  byId('order-state').textContent = model ? `${dirty() ? 'Unsaved order' : 'Saved order'} · ${entries().length} numbered disclosures` : '';
}

function updateControls() {
  byId('refresh').disabled = busy || !sdk;
  const legacy = model && disclosureSetMode(model.data) !== 'sequence';
  byId('save').textContent = legacy ? 'Convert to numbered references' : 'Review changes';
  byId('save').disabled = busy || !valid() || needsRecovery() || (!dirty() && !legacy);
  byId('reset').disabled = busy || !model || !dirty();
  byId('insert').disabled = busy || !valid() || needsRecovery() || dirty() || !selected.size
    || (!demo && (sdk.context.view !== 'edit' || model.path === sdk.context.path.replace(/\.html$/, '')));
  document.querySelectorAll('.disclosure-item input, .move-actions button').forEach((control) => {
    control.disabled = busy || needsRecovery() || control.dataset.unavailable === 'true';
  });
  document.querySelectorAll('.disclosure-item').forEach((item) => { item.draggable = !busy && valid() && !needsRecovery(); });
  byId('confirm-save').disabled = busy || !reviewed || reviewed.issues.length > 0;
  byId('resume-operation').disabled = busy || !needsRecovery();
  byId('restore-operation').disabled = busy || !needsRecovery();
}

function invalidateReview() {
  reviewed = undefined;
  byId('confirm-numeric').checked = false;
  byId('numeric-confirmation').hidden = true;
  byId('change-review').hidden = true;
  byId('confirm-save').disabled = true;
}

function renderAudit() {
  if (!model) return;
  const auditEntries = valid() ? savedEntries() : [];
  const result = auditReferences(pageHtml, auditEntries, model.data.id);
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
  if (busy || needsRecovery() || from === to || to < 0 || to >= order.length) return;
  invalidateReview();
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  // Rebuilding the list installs the next set of move callbacks.
  // eslint-disable-next-line no-use-before-define
  render();
  status('Order changed. Review the affected citations before saving.');
  byId('disclosure-list').children[to]?.querySelector('button:not(:disabled)')?.focus();
}

function render() {
  const list = byId('disclosure-list');
  list.replaceChildren();
  let number = 0;
  order.forEach((index, position) => {
    const entry = model.data.disclosures[index] || {};
    const { disclosureId, fragment } = entry;
    const available = valid() && !emptyFragments.has(disclosureFragmentPath(fragment));
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
      renderPreview();
    });
    const content = document.createElement('div');
    content.className = 'entry-content';
    const fragmentContent = fragmentContents.get(disclosureFragmentPath(fragment));
    const title = document.createElement('strong');
    title.className = 'entry-title';
    title.textContent = fragmentContent?.title || disclosureId || 'Unavailable disclosure';
    const excerpt = document.createElement('p');
    excerpt.className = 'entry-excerpt';
    excerpt.textContent = fragmentContent?.excerpt || 'No disclosure text is available.';
    const id = document.createElement('span');
    id.className = 'entry-id';
    id.textContent = disclosureId || 'Missing stable ID';
    const path = document.createElement('span');
    path.className = 'entry-path';
    path.textContent = fragment || 'Missing fragment';
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Source and reference';
    details.append(summary, id, path);
    content.append(title, excerpt, details);
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
  renderPreview();
  updateControls();
}

async function load() {
  busy = true;
  byId('saved-page').checked = false;
  model = undefined;
  pending = undefined;
  invalidateReview();
  byId('recovery').hidden = true;
  selected.clear();
  emptyFragments.clear();
  fragmentContents.clear();
  byId('footer-preview').srcdoc = '';
  byId('order-state').textContent = '';
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
    pending = await readOperation(context, path, actions.daFetch);
    order = model.data.disclosures.map((_, index) => index);
    setIssues = validateSet(model);
    if (valid()) {
      const paths = [...new Set(footerEntries(model, order).map((item) => item.path))];
      const checks = await Promise.all(paths.map(async (fragment) => {
        try {
          const html = await readSource(context, fragment, actions.daFetch);
          const content = previewContent(html);
          fragmentContents.set(fragment, content);
          if (content.empty) {
            emptyFragments.add(fragment);
            const numeric = disclosureSetMode(model.data) === 'sequence';
            return { type: numeric ? 'error' : 'warn', message: `Fragment ${fragment} is empty. Fix it before numbered authoring.` };
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
    if (needsRecovery()) {
      byId('recovery').hidden = false;
      byId('recovery-paths').replaceChildren(...pending.writes.map((write) => {
        const item = document.createElement('li');
        item.textContent = `${write.path} — ${write.state}`;
        return item;
      }));
      status('Recovery required. Finish or restore the interrupted change before reordering.', true);
      return;
    }
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

const contextKey = () => `${sdk.context.org}/${sdk.context.repo}${sdk.context.path}`;
const reviewInputs = (review) => JSON.stringify([
  review.contextKey, review.setPath, review.mapping, review.inventory,
  review.guards.map(({ path, original }) => [path, original])
    .sort(([left], [right]) => left.localeCompare(right)),
]);

async function save(approvedReview) {
  busy = true;
  updateControls();
  invalidateReview();
  status('Checking the site for affected pages and shared content…');
  try {
    const site = contextKey();
    const saved = typeof sdk.actions.saveDocument === 'function'
      ? await sdk.actions.saveDocument() : null;
    if (!saved?.ok) {
      byId('saved-page-notice').hidden = false;
      if (!byId('saved-page').checked) throw new Error('Save this page in DA, confirm below, then review again.');
    }
    let candidate = await planAffectedSources(sdk.context, model, order, sdk.actions.daFetch, {
      confirmNumeric: Boolean(approvedReview),
    });
    candidate.contextKey = site;
    if (approvedReview && reviewInputs(approvedReview) !== reviewInputs(candidate)) {
      candidate = await planAffectedSources(sdk.context, model, order, sdk.actions.daFetch);
      candidate.contextKey = site;
    } else if (approvedReview) byId('confirm-numeric').checked = true;
    if (site !== contextKey()) throw new Error('The connected page changed. Refresh before reviewing.');
    reviewed = candidate;
    byId('change-review').hidden = false;
    byId('review-summary').textContent = `${reviewed.scanned} sources checked · ${reviewed.affectedPages.length} affected page(s). ${reviewed.mapping.map(([before, after]) => `${before} → ${after}`).join(', ')}`;
    const paths = new Map(reviewed.writes.map((write) => [write.path, `${write.references} citation change(s)`]));
    reviewed.affectedPages.forEach((path) => { if (!paths.has(path)) paths.set(path, 'Uses changed shared disclosures'); });
    byId('review-paths').replaceChildren(...[...paths].map(([path, detail]) => {
      const item = document.createElement('li');
      item.textContent = `${path} — ${detail}`;
      return item;
    }));
    byId('review-issues').replaceChildren(...reviewed.issues.map((issue) => {
      const item = document.createElement('li');
      item.className = 'audit-item error';
      item.textContent = issue.message;
      return item;
    }));
    byId('numeric-confirmation').hidden = !reviewed.issues.some((issue) => /positional intent/.test(issue.message));
    status(reviewed.issues.length ? 'Resolve the listed issues before saving.' : 'Review the sources below, then choose Save changes.', reviewed.issues.length > 0);
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

async function finishOperation(result, selection = []) {
  const paths = result.operation.writes.map((write) => write.path);
  await load();
  if (!result.ok) {
    status(`${result.message || 'Recovery could not finish.'} ${result.unresolved?.length ? `Review: ${result.unresolved.join(', ')}.` : 'Original sources were restored.'}`, true);
    return;
  }
  selection.forEach((id) => selected.add(id));
  render();
  const output = byId('changed-sources');
  output.hidden = false;
  const text = document.createElement('p');
  text.textContent = 'Preview these sources together in DA. Publish separately using the site’s workflow:';
  const list = document.createElement('ul');
  paths.forEach((path) => {
    const item = document.createElement('li');
    item.textContent = path;
    list.append(item);
  });
  output.replaceChildren(text, list);
  let message = demo ? 'Demo changes saved in memory' : 'Changes saved';
  if (result.operation.status === 'restored') message = 'Original sources restored';
  status(`${message} · ${paths.length} source(s). Preview and publish separately.`);
}

const progress = ({ path, index, total }) => status(`Updating ${index + 1} of ${total}: ${path}`);
const operationOptions = {
  onProgress: progress,
};

async function confirmSave() {
  if (!reviewed || reviewed.issues.length || busy) return;
  const plan = reviewed;
  const mapping = new Map(plan.mapping);
  const selection = [...selected].map((id) => mapping.get(id)).filter(Boolean);
  busy = true;
  updateControls();
  try {
    const result = await applyOperation(sdk.context, plan, sdk.actions.daFetch, operationOptions);
    await finishOperation(result, selection);
  } catch (error) {
    status(error.message, true);
    invalidateReview();
  } finally {
    busy = false;
    updateControls();
  }
}

async function recover(restore) {
  if (!needsRecovery() || busy) return;
  busy = true;
  updateControls();
  try {
    const action = restore ? restoreOperation : resumeOperation;
    const result = await action(sdk.context, pending, sdk.actions.daFetch, operationOptions);
    await finishOperation(result);
  } catch (error) { status(error.message, true); } finally { busy = false; updateControls(); }
}

document.querySelectorAll('[data-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-panel]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
    ['manage', 'audit'].forEach((id) => { byId(id).hidden = id !== button.dataset.panel; });
  });
});
byId('refresh').addEventListener('click', load);
byId('save').addEventListener('click', () => save());
byId('confirm-save').addEventListener('click', confirmSave);
byId('cancel-review').addEventListener('click', invalidateReview);
byId('confirm-numeric').addEventListener('change', () => {
  const approved = byId('confirm-numeric').checked ? reviewed : undefined;
  save(approved);
});
byId('resume-operation').addEventListener('click', () => recover(false));
byId('restore-operation').addEventListener('click', () => recover(true));
byId('reset').addEventListener('click', () => {
  invalidateReview();
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
    sdk = await demoSdk((html) => {
      const output = byId('demo-reference');
      output.hidden = false;
      output.textContent = `Inserted marker: ${html}. The site displays its corresponding number and link.`;
    }, { seedRecovery: new URLSearchParams(window.location.search).get('recovery') === '1' });
  } else if (window.parent !== window) {
    // The DA SDK owns authentication and token refresh; no credentials are stored here.
    // eslint-disable-next-line import/no-unresolved
    const { default: DA_SDK } = await import('https://da.live/nx/utils/sdk.js');
    sdk = await DA_SDK;
  } else return;
  if (!sdk?.context || !sdk.actions?.daFetch) throw new Error('Open Disclosure Manager through the DA Library to connect to your page.');
  sdk.actions.subscribeLiveDocument?.(({ html }) => {
    if (liveHtml !== undefined && liveHtml !== html) {
      byId('saved-page').checked = false;
      invalidateReview();
    }
    liveHtml = html;
  });
  await load();
  updateControls();
}

const ready = init().catch((error) => status(error.message, true));
export default ready;
