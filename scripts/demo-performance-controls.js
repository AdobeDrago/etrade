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

const milliseconds = (value) => (value === null || value === undefined ? 'Not observed' : `${Math.round(value)} ms`);
const bytes = (value) => {
  if (value === null) return 'Unavailable';
  return value >= 1000000 ? `${(value / 1000000).toFixed(2)} MB` : `${(value / 1000).toFixed(1)} kB`;
};
const PHASE_CHOICES = [
  ['eds', 'EDS · CMP after page, tags after consent'],
  ['early', 'Startup · CMP and tags before page'],
  ['late', 'Early CMP · tags when page is ready'],
  ['consent', 'Early CMP · tags when consent is granted'],
];
const STRATEGIES = {
  eds: 'Page content loads first. This demo waits 3 seconds, then loads simulated OneTrust. Tags wait for simulated consent. The delay is a demo setting.',
  early: 'Simulated OneTrust and blocking tag fixtures start before page content. Tracking is not consent-gated in this comparison.',
  late: 'Simulated OneTrust starts before page content. Tags start automatically when page content is ready, without waiting for consent.',
  consent: 'Simulated OneTrust starts before page content. Tags wait for you to accept simulated tracking, even when page content is already ready.',
};

/** Baseline and loaded comparisons share the same controls and measurement overhead. */
export default function mountPerformanceControls(doc, win) {
  const current = readPerformanceConfig(win.location.href);
  const section = node(doc, 'details', 'section');
  section.classList.add('demo-helper-performance');
  section.open = Boolean(current);
  section.append(node(doc, 'summary', 'heading', 'Third-party performance'));
  const status = node(doc, 'p', 'muted');
  status.setAttribute('role', 'status');
  const measurements = node(doc, 'div', 'measurements');
  const tablist = node(doc, 'div', 'tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Performance measurements');
  measurements.append(tablist);
  const tabs = [];
  const panels = [];
  const values = new Map();

  function activate(index) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }

  ['Page experience', 'Downloads', 'Workload'].forEach((label, index) => {
    const tab = button(doc, label);
    tab.id = `demo-helper-tab-${index}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `demo-helper-metrics-${index}`);
    const panel = node(doc, 'div', 'metric-panel');
    panel.id = `demo-helper-metrics-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      const next = {
        ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      activate(next);
      tabs[next].focus();
    });
    tabs.push(tab);
    panels.push(panel);
    tablist.append(tab);
    measurements.append(panel);
  });
  activate(0);

  function group(index, title, rows) {
    const wrapper = node(doc, 'div', 'metric-group');
    wrapper.append(node(doc, 'h4', 'metric-heading', title));
    const list = node(doc, 'dl', 'metrics');
    rows.forEach(([key, label]) => {
      const value = node(doc, 'dd', 'metric-value', 'Not observed');
      values.set(key, value);
      list.append(node(doc, 'dt', 'metric-label', label), value);
    });
    wrapper.append(list);
    panels[index].append(wrapper);
    return wrapper;
  }
  group(0, 'Core Web Vitals', [['lcp', 'LCP'], ['cls', 'CLS']]);
  group(0, 'Additional observations', [['interaction', 'Slowest interaction (lab)'], ['fcp', 'FCP']]);
  panels[0].append(node(doc, 'p', 'muted', 'Slowest interaction is a lab observation, not field INP. Initial-load values can stay unchanged after the page finishes loading.'));
  const downloads = group(1, 'This run · fixture downloads', [['transfer', 'Transferred, including headers'], ['downloaded', 'Downloaded source size']]);
  const reference = group(1, 'Reference profile · selected libraries', [['source', 'Total source size'], ['gzip', 'Captured compressed responses'], ['cmp', 'OneTrust source size'], ['tags', 'Other tags source size']]);
  const realDownloads = group(1, 'Real OneTrust network observations', [['requests', 'Requests observed'], ['sdkDuration', 'SDK request duration']]);
  const requestList = node(doc, 'ul', 'requests');
  realDownloads.append(requestList);
  const downloadHelp = node(doc, 'p', 'muted');
  panels[1].append(downloadHelp);
  const simulation = group(2, 'Simulation', [['fixtures', 'Fixtures loaded'], ['consent', 'Simulated tracking consent'], ['cpu', 'Added CPU work'], ['runtime', 'Interaction workload']]);
  const realConsent = group(2, 'Real OneTrust consent', [['sdkStatus', 'SDK file'], ['cmpStatus', 'CMP initialization'], ['activeGroups', 'Active categories'], ['requiredGroups', 'Required categories'], ['gate', 'Tracking gate'], ['tracking', 'Consented module download']]);
  group(2, 'Observed browser work', [['tasks', 'Long tasks'], ['excess', 'Long-task excess (>50 ms)']]);
  const workloadActions = node(doc, 'div', 'actions');
  const run = button(doc, 'Run 30-second workload');
  const stop = button(doc, 'Stop workload');
  workloadActions.append(run, stop);
  panels[2].append(workloadActions);

  const settings = node(doc, 'details', 'settings');
  settings.open = !current;
  settings.append(node(doc, 'summary', 'heading', 'Comparison settings'));
  const form = node(doc, 'form', 'form');
  const profile = select(doc, form, 'profile', 'Libraries', [
    ['off', 'Off'], ['baseline', 'Measured baseline'], ['onetrust', 'OneTrust script weights'], ['etrade', 'E*TRADE tag + OneTrust script weights'],
    ['onetrust-real', 'OneTrust · real SDK'],
  ], current?.profile || 'off');
  const phase = select(doc, form, 'phase', 'Loading strategy', PHASE_CHOICES, current?.phase || 'eds');
  const strategyHelp = node(doc, 'p', 'muted');
  strategyHelp.id = 'demo-helper-strategy-help';
  phase.setAttribute('aria-describedby', strategyHelp.id);
  const describeStrategy = () => {
    if (profile.value === 'onetrust-real') {
      strategyHelp.textContent = phase.value === 'eds'
        ? 'Page content loads first; the real OneTrust SDK starts 3 seconds later. Tracking waits for the required OneTrust categories.'
        : 'The real OneTrust SDK starts asynchronously at page startup. Page rendering does not wait for the SDK, and tracking waits for the required OneTrust categories.';
    } else strategyHelp.textContent = STRATEGIES[phase.value];
  };
  phase.addEventListener('change', describeStrategy);
  describeStrategy();
  form.append(strategyHelp);
  const work = select(doc, form, 'work', 'Extra browser processing', [
    ['none', 'Download and parse only'], ['light', 'Light · assumed CPU work'], ['medium', 'Moderate · assumed CPU work'], ['heavy', 'Heavy · assumed CPU work'],
  ], current?.work || 'none');
  const processingHelp = node(doc, 'p', 'muted');
  form.append(processingHelp);
  function describeProfile() {
    const real = profile.value === 'onetrust-real';
    const chosen = phase.value;
    const choices = real ? [
      ['eds', 'EDS · real CMP after page, tracking after consent'],
      ['early', 'Split · async CMP at startup, tracking after consent'],
    ] : PHASE_CHOICES;
    phase.replaceChildren();
    choices.forEach(([value, text]) => {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = value === (chosen === 'eds' || !real ? chosen : 'early');
      phase.append(option);
    });
    work.disabled = real;
    if (real) work.querySelector('[value="none"]').selected = true;
    processingHelp.textContent = real
      ? 'This mode runs the real CMP without assumed CPU work. Its domain allowlist and tenant configuration may prevent initialization. It does not install the production analytics/ad stack.'
      : 'Processing levels are assumed CPU work, not measured vendor timings. Interaction and background work run for 30 seconds when page content and tags are ready. Keep settings identical when comparing strategies.';
    describeStrategy();
  }
  profile.addEventListener('change', describeProfile);
  describeProfile();
  const actions = node(doc, 'div', 'actions');
  const apply = button(doc, 'Apply & reload');
  apply.className = 'demo-helper-primary';
  apply.type = 'submit';
  actions.append(apply);
  form.append(actions);
  settings.append(form);

  const runtimeActions = node(doc, 'div', 'actions');
  const consent = button(doc, 'Accept simulated tracking');
  const decline = button(doc, 'Decline simulated tracking');
  const response = button(doc, 'Test response');
  response.dataset.perfInteraction = 'true';
  const refresh = button(doc, 'Refresh measurements');
  const preferences = button(doc, 'Open OneTrust preferences');
  runtimeActions.append(consent, decline, preferences, response, refresh);
  const consentHelp = node(doc, 'p', 'muted', 'These buttons simulate consent. No real OneTrust banner or tracking is loaded.');
  const responseStatus = node(doc, 'p', 'muted');
  const refreshStatus = node(doc, 'p', 'muted');
  refreshStatus.setAttribute('role', 'status');
  section.append(status, measurements, runtimeActions, consentHelp);
  section.append(responseStatus, refreshStatus, settings);

  function render() {
    const snapshot = win.etradePerformanceDemo?.snapshot();
    measurements.hidden = !snapshot;
    runtimeActions.hidden = !snapshot;
    consentHelp.hidden = !snapshot;
    status.textContent = snapshot ? snapshot.status : 'Off · choose a measured baseline to compare.';
    if (!snapshot) return;
    const real = snapshot.config.profile === 'onetrust-real';
    reference.hidden = real;
    realDownloads.hidden = !real;
    simulation.hidden = real;
    realConsent.hidden = !real;
    workloadActions.hidden = real;
    tabs[2].textContent = real ? 'Consent' : 'Workload';
    downloads.querySelector('h4').textContent = real ? 'This run · real OneTrust' : 'This run · fixture downloads';
    downloadHelp.textContent = real
      ? 'Actual browser resource timings for OneTrust requests. Cross-origin size restrictions or blocked requests can make byte totals unavailable; unavailable does not mean zero. A partial load does not establish production timing equivalence.'
      : 'Reference sizes were captured on Oct 13, 2026. This run varies with compression, cache and which fixtures have loaded.';
    consentHelp.textContent = real
      ? 'Only OneTrust can grant consent in this mode. If initialization fails, tracking stays off. The consented module is currently an empty integration hook.'
      : 'These buttons simulate consent. No real OneTrust banner or tracking is loaded.';
    preferences.hidden = !real;
    preferences.disabled = !snapshot.realCMP?.canOpenPreferences;
    const gated = snapshot.config.profile === 'etrade'
      && ['eds', 'consent'].includes(snapshot.config.phase);
    consent.hidden = !gated;
    decline.hidden = !gated;
    consent.disabled = snapshot.status === 'Stopped' || !snapshot.cmpReady;
    decline.disabled = consent.disabled;
    stop.disabled = snapshot.status === 'Stopped' || snapshot.config.profile === 'baseline';
    response.disabled = snapshot.status === 'Stopped';
    run.disabled = snapshot.status === 'Stopped' || snapshot.config.work === 'none'
      || snapshot.config.profile !== 'etrade'
      || (gated && snapshot.consent !== 'accepted')
      || snapshot.completed + snapshot.failed < snapshot.resources.length;
    const groupBytes = (name) => snapshot.resources.filter((resource) => resource.group === name)
      .reduce((total, resource) => total + resource.decodedBytes, 0);
    const metrics = {
      lcp: milliseconds(snapshot.metrics.lcp),
      cls: snapshot.metrics.cls === null ? 'Not observed' : snapshot.metrics.cls.toFixed(3),
      interaction: milliseconds(snapshot.metrics.worstInteraction),
      fcp: milliseconds(snapshot.metrics.fcp),
      transfer: bytes(snapshot.actualTransferBytes),
      downloaded: bytes(snapshot.actualDecodedBytes),
      source: bytes(snapshot.decodedBytes),
      gzip: bytes(snapshot.observedEncodedBytes),
      cmp: bytes(groupBytes('consent')),
      tags: bytes(groupBytes('tags')),
      fixtures: `${snapshot.completed}/${snapshot.resources.length}${snapshot.failed ? ` · ${snapshot.failed} failed` : ''}`,
      consent: gated ? snapshot.consent : 'Not gated in this comparison',
      cpu: milliseconds(snapshot.simulatedCPU),
      runtime: snapshot.runtimeActive ? 'Active · 30-second window' : 'Inactive',
      tasks: snapshot.metrics.longTasks ?? 'Not observed',
      excess: milliseconds(snapshot.metrics.longTaskExcess),
      requests: snapshot.realResources?.length ?? 0,
      sdkDuration: milliseconds(snapshot.realResources?.find((entry) => entry.url.includes('/otSDKStub.js'))?.duration),
      sdkStatus: snapshot.realCMP?.sdkStatus || 'Not requested',
      cmpStatus: snapshot.realCMP?.initialized ? 'Initialized' : 'Not initialized',
      activeGroups: snapshot.realCMP?.activeGroups.join(', ') || 'None reported',
      requiredGroups: snapshot.realCMP?.requiredGroups.join(', ') || 'C0002, C0004',
      tracking: snapshot.realCMP?.consentedModule || 'Not loaded',
      gate: snapshot.realCMP?.consented ? 'Open' : 'Closed',
    };
    Object.entries(metrics).forEach(([key, value]) => {
      values.get(key).textContent = String(value);
    });
    requestList.replaceChildren();
    snapshot.realResources?.forEach((entry) => {
      const path = new URL(entry.url).pathname;
      requestList.append(node(doc, 'li', 'muted', `${path} · ${milliseconds(entry.duration)}`));
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
  preferences.addEventListener('click', () => win.etradePerformanceDemo?.openConsentPreferences());
  let refreshing = false;
  let refreshCount = 0;
  refresh.addEventListener('click', () => {
    if (refreshing) return;
    refreshing = true;
    refresh.disabled = true;
    refresh.textContent = 'Refreshing…';
    const finish = () => {
      win.etradePerformanceDemo?.refreshMeasurements();
      refreshing = false;
      refreshCount += 1;
      render();
      refresh.disabled = false;
      refresh.textContent = 'Refresh measurements';
      refreshStatus.textContent = `Measurements updated (${refreshCount}). Initial-load values can stay unchanged. Apply & reload starts a new test.`;
    };
    // Give the preceding interaction a paint before collecting queued observations.
    if (win.requestAnimationFrame) {
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => win.setTimeout(finish, 0)));
    } else Promise.resolve().then(finish);
  });
  let responseCount = 0;
  response.addEventListener('click', () => {
    responseCount += 1;
    responseStatus.textContent = `Response ${responseCount} rendered. Refresh measurements after the next paint.`;
  });
  doc.addEventListener('demo-performance:updated', render);
  render();
  return section;
}
