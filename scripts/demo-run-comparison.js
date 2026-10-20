import { readDemoBalance } from './demo-balance.js';

const KEY = 'etrade:demo-comparison';
const numericKeys = ['lcp', 'fcp', 'cls', 'transfer', 'completed', 'total', 'failed', 'width', 'height'];
const measured = (value) => Number.isFinite(value) && value >= 0;
const milliseconds = (value) => (value === null ? 'Not observed' : `${Math.round(value)} ms`);
const bytes = (value) => {
  if (value === null) return 'Unavailable';
  return value >= 1000000 ? `${(value / 1000000).toFixed(2)} MB` : `${(value / 1000).toFixed(1)} kB`;
};

function pageKey(href) {
  const url = new URL(href);
  ['perf', 'perf-phase', 'perf-work'].forEach((key) => url.searchParams.delete(key));
  url.searchParams.sort();
  return `${url.origin}${url.pathname}${url.search}`;
}

function capture(snapshot, label, environment) {
  const gated = snapshot.config.profile === 'etrade' && ['eds', 'consent'].includes(snapshot.config.phase);
  let consent = 'Not gated';
  if (gated) consent = snapshot.consent;
  if (snapshot.config.profile === 'onetrust-real') consent = snapshot.realCMP?.consented ? 'Gate open' : 'Gate closed';
  return {
    version: 1,
    page: environment.page,
    balance: environment.balance,
    label,
    profile: snapshot.config.profile,
    work: snapshot.config.profile === 'baseline' ? 'none' : snapshot.config.work,
    consent,
    lcp: measured(snapshot.metrics.lcp) ? snapshot.metrics.lcp : null,
    fcp: measured(snapshot.metrics.fcp) ? snapshot.metrics.fcp : null,
    cls: measured(snapshot.metrics.cls) ? snapshot.metrics.cls : null,
    transfer: snapshot.actualTransferBytes,
    completed: snapshot.completed,
    total: snapshot.resources.length,
    failed: snapshot.failed,
    realRequests: snapshot.realResources?.length ?? null,
    cmpReady: snapshot.cmpReady,
    width: environment.width,
    height: environment.height,
    viewportChanged: environment.viewportChanged,
  };
}

function readSaved(win) {
  try {
    const saved = JSON.parse(win.sessionStorage.getItem(KEY));
    if (!saved || saved.version !== 1 || saved.page !== pageKey(win.location.href)) return null;
    if (typeof saved.label !== 'string' || saved.label.length > 200) return null;
    if (saved.balance !== null && (typeof saved.balance !== 'string' || saved.balance.length > 64)) return null;
    if (!['baseline', 'onetrust', 'etrade', 'onetrust-real'].includes(saved.profile)) return null;
    if (!['none', 'light', 'medium', 'heavy'].includes(saved.work)) return null;
    if (['baseline', 'onetrust-real'].includes(saved.profile) && saved.work !== 'none') return null;
    const choices = ['Not gated', 'pending', 'accepted', 'declined', 'Gate open', 'Gate closed'];
    if (!choices.includes(saved.consent)) return null;
    if (numericKeys.some((key) => saved[key] !== null && !measured(saved[key]))) return null;
    if (!['completed', 'total', 'failed'].every((key) => Number.isInteger(saved[key]))) return null;
    const invalidRequests = !Number.isInteger(saved.realRequests) || saved.realRequests < 0;
    if (saved.realRequests !== null && invalidRequests) return null;
    if (typeof saved.cmpReady !== 'boolean' || saved.completed + saved.failed > saved.total) return null;
    if (typeof saved.viewportChanged !== 'boolean') return null;
    if (saved.lcp === null && saved.fcp === null) return null;
    return saved;
  } catch { return null; }
}

/** Keep one explicit snapshot in this tab, scoped to the same page and page settings. */
export default function mountRunComparison(doc, win) {
  const environment = {
    page: pageKey(win.location.href),
    balance: readDemoBalance(win),
    width: measured(win.innerWidth) ? win.innerWidth : null,
    height: measured(win.innerHeight) ? win.innerHeight : null,
    viewportChanged: false,
  };
  const node = (tag, name, text) => {
    const element = doc.createElement(tag);
    element.className = `demo-helper-${name}`;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const save = node('button', 'save-run', 'Save this run');
  save.type = 'button';
  save.disabled = true;
  save.setAttribute('aria-describedby', 'demo-helper-comparison-feedback');
  const element = node('section', 'comparison');
  element.hidden = true;
  element.setAttribute('aria-label', 'Saved run comparison');
  const heading = node('div', 'comparison-heading');
  const clear = node('button', 'clear-run', 'Clear');
  clear.type = 'button';
  clear.setAttribute('aria-label', 'Clear saved comparison');
  heading.append(node('h4', 'metric-heading', 'Saved vs current'), clear);
  const description = node('p', 'comparison-description');
  const table = node('table', 'comparison-table');
  table.setAttribute('aria-label', 'Saved and current measurements');
  const tableHead = doc.createElement('thead');
  const headings = doc.createElement('tr');
  ['Measurement', 'Saved', 'Current'].forEach((title) => {
    const cell = doc.createElement('th');
    cell.scope = 'col';
    cell.textContent = title;
    headings.append(cell);
  });
  tableHead.append(headings);
  const body = doc.createElement('tbody');
  table.append(tableHead, body);
  const notes = node('p', 'comparison-notes');
  const feedback = node('p', 'muted', 'Save a run, then switch modes to compare. Saved values stay in this tab.');
  feedback.id = 'demo-helper-comparison-feedback';
  feedback.setAttribute('role', 'status');
  element.append(heading, description, table, notes);
  let saved = readSaved(win);
  let current;
  let awaitingPaint = true;

  function render() {
    save.textContent = saved ? 'Replace saved run' : 'Save this run';
    element.hidden = !saved || !current;
    if (element.hidden) return;
    description.textContent = `Saved: ${saved.label}\nCurrent: ${current.label}`;
    const files = (run) => {
      if (run.profile === 'onetrust-real') return `${run.realRequests} observed`;
      if (run.profile === 'baseline') return 'None added';
      if (!run.total) return 'Not requested';
      return `${run.completed}/${run.total}${run.failed ? ` · ${run.failed} failed` : ''}`;
    };
    const rows = [
      ['LCP', (run) => milliseconds(run.lcp)],
      ['FCP', (run) => milliseconds(run.fcp)],
      ['CLS', (run) => (run.cls === null ? 'Not observed' : run.cls.toFixed(3))],
      ['Transferred', (run) => bytes(run.transfer)],
      ['Files', files],
      ['Consent', (run) => run.consent],
    ];
    body.replaceChildren();
    rows.forEach(([title, format]) => {
      const row = doc.createElement('tr');
      const label = doc.createElement('th');
      label.scope = 'row';
      label.textContent = title;
      row.append(label);
      [saved, current].forEach((run) => {
        const cell = doc.createElement('td');
        cell.textContent = format(run);
        row.append(cell);
      });
      body.append(row);
    });
    const differences = [];
    if (saved.work !== current.work) differences.push('Added processing differs.');
    if (saved.balance !== current.balance) differences.push('The demo balance changed.');
    if (saved.width !== current.width || saved.height !== current.height
      || saved.viewportChanged || current.viewportChanged) differences.push('The browser viewport changed during one of these runs.');
    if ((saved.profile === 'onetrust-real') !== (current.profile === 'onetrust-real')) differences.push('Real OneTrust and simulated runs use different code.');
    if ([saved, current].some((run) => run.failed || (run.profile === 'onetrust-real' && !run.cmpReady))) differences.push('A load is incomplete; review its status before drawing timing conclusions.');
    if ([saved, current].some((run) => run.profile === 'etrade' && (!run.total || run.completed < run.total))) differences.push('Some tags have not loaded. These runs may include different amounts of work.');
    notes.textContent = differences.join(' ') || 'Single runs under your current browser conditions. Repeat with the same settings to assess consistency.';
  }

  save.addEventListener('click', () => {
    if (!current || save.disabled) return;
    try {
      win.sessionStorage.setItem(KEY, JSON.stringify(current));
      saved = current;
      feedback.textContent = 'Run saved. Switch modes to compare against these values.';
      render();
    } catch { feedback.textContent = 'This browser could not save the run. Your measurements are still available.'; }
  });
  clear.addEventListener('click', () => {
    try {
      win.sessionStorage.removeItem(KEY);
      saved = null;
      feedback.textContent = 'Saved comparison cleared.';
      render();
      save.focus();
    } catch { feedback.textContent = 'This browser could not clear the saved comparison.'; }
  });
  return {
    element,
    save,
    feedback,
    update(snapshot, label) {
      const width = measured(win.innerWidth) ? win.innerWidth : null;
      const height = measured(win.innerHeight) ? win.innerHeight : null;
      if (width !== environment.width || height !== environment.height) {
        environment.viewportChanged = true;
      }
      current = capture(snapshot, label, environment);
      save.disabled = current.lcp === null && current.fcp === null;
      if (save.disabled) feedback.textContent = 'Waiting for a paint measurement before this run can be saved.';
      else if (awaitingPaint) {
        feedback.textContent = saved
          ? 'Saved reference restored. Current measurements update automatically.'
          : 'Save a run, then switch modes to compare. Saved values stay in this tab.';
      }
      awaitingPaint = save.disabled;
      render();
    },
  };
}
