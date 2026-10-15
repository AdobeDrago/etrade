import { performanceURL, readPerformanceConfig } from './demo-performance.js';
import isDemoHelperHost from './demo-host.js';

function node(doc, tag, name, text) {
  const element = doc.createElement(tag);
  element.className = `demo-helper-${name}`;
  if (text !== undefined) element.textContent = text;
  return element;
}

function select(doc, form, name, labelText, choices, current) {
  const label = node(doc, 'label', 'label', labelText);
  const input = node(doc, 'select', 'input');
  input.id = `demo-helper-performance-${name}`;
  label.htmlFor = input.id;
  choices.forEach(([value, text]) => {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = value === current;
    input.append(option);
  });
  form.append(label, input);
  return input;
}

function button(doc, text) {
  const element = node(doc, 'button', 'button', text);
  element.type = 'button';
  return element;
}

/** The same demo controls and metrics are present in baseline and loaded comparisons. */
export default function mountPerformanceControls(doc, win) {
  const section = node(doc, 'section', 'section');
  section.append(node(doc, 'h3', 'heading', 'Third-party performance'));
  section.append(node(doc, 'p', 'muted', 'Script sizes captured from E*TRADE on Oct 13, 2026. Both strategies use the same test files. Processing levels are simulated, rather than measured vendor timings.'));
  const current = readPerformanceConfig(win.location.href);
  const form = node(doc, 'form', 'form');
  const profile = select(doc, form, 'profile', 'Libraries', [
    ['off', 'Off'], ['baseline', 'Measured baseline'], ['onetrust', 'OneTrust script weights'], ['etrade', 'E*TRADE tag + OneTrust script weights'],
  ], current?.profile || 'off');
  const phase = select(doc, form, 'phase', 'Loading strategy', [
    ['eds', 'EDS · page first, tracking after consent'],
    ['early', 'Startup · OneTrust and tags before content'],
    ['late', 'Startup OneTrust · tags after content'],
    ['consent', 'Startup OneTrust · tags after consent'],
  ], current?.phase || 'eds');
  const work = select(doc, form, 'work', 'Extra browser processing', [
    ['none', 'Download and parse only'], ['light', 'Light · assumed CPU work'], ['medium', 'Moderate · assumed CPU work'], ['heavy', 'Heavy · assumed CPU work'],
  ], current?.work || 'none');
  const strategyHelp = node(doc, 'p', 'muted');
  const describeStrategy = () => {
    strategyHelp.textContent = phase.value === 'eds'
      ? 'EDS shows page content, waits 3 seconds, then loads simulated OneTrust. Tag files load after you accept simulated tracking.'
      : 'OneTrust starts before page content. Tag timing follows the selected startup option.';
  };
  phase.addEventListener('change', describeStrategy);
  describeStrategy();
  form.append(strategyHelp, node(doc, 'p', 'muted', 'Added click and background processing runs for 30 seconds once page content and tags are ready. Keep libraries and processing settings identical when comparing strategies.'));
  const actions = node(doc, 'div', 'actions');
  const apply = button(doc, 'Apply & reload');
  apply.className = 'demo-helper-primary';
  apply.type = 'submit';
  actions.append(apply);
  form.append(actions);
  section.append(form);
  const status = node(doc, 'p', 'muted');
  status.setAttribute('role', 'status');
  const summary = node(doc, 'dl', 'metrics');
  const runtimeActions = node(doc, 'div', 'actions');
  const consent = button(doc, 'Accept simulated tracking');
  const decline = button(doc, 'Decline simulated tracking');
  const response = button(doc, 'Test response');
  response.dataset.perfInteraction = 'true';
  const refresh = button(doc, 'Refresh measurements');
  const stop = button(doc, 'Stop workload');
  const run = button(doc, 'Run 30-second workload');
  runtimeActions.append(consent, decline, run, response, refresh, stop);
  const responseStatus = node(doc, 'p', 'muted', 'Test menus, FAQs and form inputs too.');
  section.append(status, summary, runtimeActions, responseStatus);
  section.append(node(doc, 'p', 'muted', 'Local results vary with device, cache and throttling. Slowest interaction is a lab observation; it is not field INP.'));

  function render() {
    const controller = win.etradePerformanceDemo;
    const snapshot = controller?.snapshot();
    summary.replaceChildren();
    runtimeActions.hidden = !snapshot;
    status.textContent = snapshot ? snapshot.status : 'Off · choose a measured baseline to compare.';
    if (!snapshot) return;
    const gated = snapshot.config.profile === 'etrade'
      && ['eds', 'consent'].includes(snapshot.config.phase);
    consent.hidden = !gated;
    decline.hidden = consent.hidden;
    consent.disabled = snapshot.status === 'Stopped' || !snapshot.cmpReady;
    decline.disabled = consent.disabled;
    stop.disabled = snapshot.status === 'Stopped' || snapshot.config.profile === 'baseline';
    response.disabled = snapshot.status === 'Stopped';
    run.disabled = snapshot.status === 'Stopped' || snapshot.config.work === 'none'
      || snapshot.config.profile !== 'etrade'
      || (gated && snapshot.consent !== 'accepted')
      || snapshot.completed + snapshot.failed < snapshot.resources.length;
    const ms = (value) => (value === null || value === undefined ? 'Not observed' : `${Math.round(value)} ms`);
    const kb = (value) => `${(value / 1024).toFixed(1)} KiB`;
    const values = [
      ['Fixtures', `${snapshot.completed}/${snapshot.resources.length} loaded${snapshot.failed ? ` · ${snapshot.failed} failed` : ''}`],
      ['Captured gzip responses', kb(snapshot.observedEncodedBytes)],
      ['Fixture transfer this run', kb(snapshot.actualTransferBytes)],
      ['Fixture source size', kb(snapshot.decodedBytes)],
      ['Simulated tracking consent', gated ? snapshot.consent : 'Not gated in this comparison'],
      ['FCP', ms(snapshot.metrics.fcp)],
      ['LCP', ms(snapshot.metrics.lcp)],
      ['CLS', snapshot.metrics.cls === null ? 'Not observed' : snapshot.metrics.cls.toFixed(3)],
      ['Slowest interaction', ms(snapshot.metrics.worstInteraction)],
      ['Long tasks', snapshot.metrics.longTasks ?? 'Not observed'],
      ['Long-task excess (>50 ms)', ms(snapshot.metrics.longTaskExcess)],
      ['Added CPU work', ms(snapshot.simulatedCPU)],
      ['Interaction workload', snapshot.runtimeActive ? 'Active · 30-second window' : 'Inactive'],
    ];
    values.forEach(([label, value]) => {
      summary.append(node(doc, 'dt', 'metric-label', label), node(doc, 'dd', 'metric-value', String(value)));
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isDemoHelperHost(win.location.hostname)) return;
    const config = profile.value === 'off' ? null : {
      profile: profile.value, phase: phase.value, work: work.value,
    };
    try { win.sessionStorage.setItem('etrade:demo-helper-open', 'true'); } catch { /* Optional persistence. */ }
    win.location.assign(performanceURL(win.location.href, config));
  });
  consent.addEventListener('click', () => { win.etradePerformanceDemo?.grantConsent(); render(); });
  decline.addEventListener('click', () => { win.etradePerformanceDemo?.declineConsent(); render(); });
  stop.addEventListener('click', () => { win.etradePerformanceDemo?.stop(); render(); });
  run.addEventListener('click', () => { win.etradePerformanceDemo?.runInteractions(); render(); });
  refresh.addEventListener('click', render);
  let responseCount = 0;
  response.addEventListener('click', () => {
    responseCount += 1;
    responseStatus.textContent = `Response ${responseCount} rendered. Refresh measurements after the next paint.`;
  });
  doc.addEventListener('demo-performance:updated', render);
  render();
  return section;
}
