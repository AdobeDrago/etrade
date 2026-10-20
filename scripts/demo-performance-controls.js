import { performanceURL, readPerformanceConfig } from './demo-performance.js';
import isDemoHelperHost from './demo-host.js';
import mountRunComparison from './demo-run-comparison.js';

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
const PROFILE_LABELS = {
  baseline: 'No tag stack', onetrust: 'OneTrust weights', etrade: 'Full tag stack · simulated', 'onetrust-real': 'Real OneTrust SDK',
};
const PHASE_LABELS = {
  eds: 'EDS', early: 'Startup', late: 'Tags after page', consent: 'Early CMP + consent',
};

function loadingProgress(snapshot) {
  const { config, milestones } = snapshot;
  const real = config.profile === 'onetrust-real';
  const gated = config.profile === 'etrade' && ['eds', 'consent'].includes(config.phase);
  const stopped = snapshot.status === 'Stopped';
  const failed = /failed|unavailable|did not initialize/i.test(snapshot.status);
  const resources = snapshot.resources.filter((resource) => resource.group === 'tags');
  const loaded = resources.filter((resource) => resource.status === 'loaded').length;
  const failures = resources.filter((resource) => resource.status === 'failed').length;
  const complete = resources.length > 0 && loaded === resources.length;
  const declined = snapshot.consent === 'declined';
  const content = { text: 'Waiting', state: 'waiting', time: milestones.contentReady };
  if (milestones.contentReady !== undefined) Object.assign(content, { text: 'Ready', state: 'done' });
  const cmp = { text: 'Waiting', state: 'waiting', time: milestones.cmpReady };
  if (milestones.cmpStarted !== undefined) cmp.text = 'Loading';
  if (failed) Object.assign(cmp, { text: 'Unavailable', state: 'error' });
  if (stopped) cmp.text = 'Stopped';
  if (snapshot.cmpReady) Object.assign(cmp, { text: 'Ready', state: 'done' });
  const tags = { text: 'Waiting', state: 'waiting', time: milestones.tagsReady };
  if (milestones.tagsStarted !== undefined) tags.text = `${loaded}/${resources.length} loaded`;
  if (gated && snapshot.consent !== 'accepted') tags.text = 'Awaiting consent';
  if (complete) Object.assign(tags, { text: 'Loaded', state: 'done' });
  if (gated && declined) Object.assign(tags, { text: 'Declined', state: 'waiting', time: milestones.consentUpdated });
  if (failures) Object.assign(tags, { text: `${failures} failed`, state: 'error' });
  if (stopped) Object.assign(tags, { text: 'Stopped', time: undefined });
  if (real) {
    Object.assign(tags, {
      text: snapshot.realCMP?.consented ? 'Open' : 'Closed',
      state: snapshot.realCMP?.consented ? 'done' : 'waiting',
    });
  }
  return {
    real, gated, stopped, failed, declined, loaded, content, cmp, tags,
  };
}

function nextInstruction(snapshot, progress) {
  const {
    real, gated, stopped, failed, declined, loaded,
  } = progress;
  if (stopped) return 'This run is stopped. Run again to start a fresh comparison.';
  if (failed) {
    return real
      ? 'Check the Consent tab for initialization details. Tracking stays gated.'
      : 'Some downloads are unavailable. Check Downloads or run the comparison again.';
  }
  if (real) {
    return snapshot.cmpReady
      ? 'Use OneTrust preferences to make a real consent choice. This mode loads the CMP only.'
      : 'Waiting for the real CMP. Its domain allowlist or tenant settings may prevent initialization.';
  }
  if (gated && !snapshot.cmpReady) {
    return snapshot.config.phase === 'eds'
      ? 'Content comes first in EDS mode. You can queue the cookie banner while OneTrust loads.'
      : 'OneTrust starts early in this comparison. You can queue the cookie banner while it loads.';
  }
  if (gated && declined) {
    return loaded
      ? 'Declined: downloaded scripts stay in memory; additional simulated tracking work stops.'
      : 'Declined: the tag stack stays unloaded. Reopen the banner to try Accept.';
  }
  if (gated && snapshot.consent === 'pending') return 'Try the cookie banner or accept below to release the simulated tag stack.';
  if (snapshot.config.profile === 'baseline') return 'Page measurements with no simulated tag stack. Try Traditional or EDS next.';
  if (snapshot.config.profile === 'etrade' && snapshot.config.phase === 'early') return 'Traditional comparison: the stack starts during page startup without a consent gate. Switch to EDS to load content first and wait for consent.';
  return 'Explore the page, then compare Page experience and Downloads. Run again for a fresh measurement.';
}

function afterPaint(win, callback) {
  if (win.requestAnimationFrame) {
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => win.setTimeout(callback, 0)));
  } else Promise.resolve().then(callback);
}

/** Baseline and loaded comparisons share the same controls and measurement overhead. */
export default function mountPerformanceControls(doc, win) {
  const current = readPerformanceConfig(win.location.href);
  function navigate(config) {
    if (!isDemoHelperHost(win.location.hostname)) return;
    try {
      win.sessionStorage.setItem('etrade:demo-helper-open', 'true');
      win.sessionStorage.setItem('etrade:demo-helper-view', 'performance');
    } catch { /* Optional persistence. */ }
    win.location.assign(performanceURL(win.location.href, config));
  }
  const section = node(doc, 'details', 'section');
  section.classList.add('demo-helper-performance');
  section.open = Boolean(current);
  section.append(node(doc, 'summary', 'heading', 'Performance comparison'));
  const scenarios = node(doc, 'div', 'scenarios');
  scenarios.setAttribute('role', 'group');
  scenarios.setAttribute('aria-label', 'Quick performance comparisons');
  [
    ['baseline', 'eds', 'No tag stack', 'Page only'],
    ['etrade', 'early', 'Traditional', 'Tags at startup'],
    ['etrade', 'eds', 'EDS', 'Content first'],
  ].forEach(([profile, phase, title, description]) => {
    const scenario = button(doc, '');
    scenario.className = 'demo-helper-scenario';
    scenario.setAttribute('aria-pressed', String(current?.profile === profile
      && (profile === 'baseline' || current.phase === phase)));
    scenario.append(node(doc, 'strong', 'scenario-title', title), node(doc, 'span', 'scenario-description', description));
    scenario.addEventListener('click', () => navigate({ profile, phase, work: current?.work || 'none' }));
    scenarios.append(scenario);
  });
  const comparisonHelp = node(doc, 'p', 'muted', 'Traditional and EDS simulate the same production-sized tag stack. Choose a mode to reload.');
  const overview = node(doc, 'details', 'run-overview');
  const runSummary = node(doc, 'summary', 'run-summary');
  const runLabel = node(doc, 'p', 'run-label');
  const status = node(doc, 'p', 'run-status');
  status.setAttribute('role', 'status');
  const sequence = node(doc, 'ol', 'sequence');
  sequence.setAttribute('aria-label', 'Loading progress');
  const stages = new Map();
  let order = ['cmp', 'content', 'tags'];
  if (current?.phase === 'eds' || current?.profile === 'baseline') order = ['content', 'cmp', 'tags'];
  else if (current?.phase === 'early' && current?.profile === 'etrade') order = ['cmp', 'tags', 'content'];
  order.forEach((key) => {
    const item = node(doc, 'li', 'stage');
    item.dataset.stage = key;
    const label = node(doc, 'span', 'stage-label', { content: 'Page content', cmp: 'OneTrust', tags: current?.profile === 'onetrust-real' ? 'Consent gate' : 'Tag stack' }[key]);
    const state = node(doc, 'strong', 'stage-state');
    const timing = node(doc, 'span', 'stage-timing');
    item.append(label, state, timing);
    stages.set(key, { item, state, timing });
    sequence.append(item);
  });
  const nextStep = node(doc, 'p', 'next-step');
  runSummary.append(runLabel, status);
  overview.append(runSummary, sequence);
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
      const metric = node(doc, 'div', 'metric');
      metric.append(node(doc, 'dt', 'metric-label', label), value);
      list.append(metric);
    });
    wrapper.append(list);
    panels[index].append(wrapper);
    return wrapper;
  }
  const vitals = group(0, 'Core Web Vitals', [['lcp', 'LCP · largest paint'], ['cls', 'CLS · layout shift']]);
  vitals.classList.add('demo-helper-vitals');
  const comparison = mountRunComparison(doc, win);
  const vitalsHeader = node(doc, 'div', 'vitals-header');
  vitalsHeader.append(vitals.querySelector('h4'), comparison.save);
  vitals.prepend(vitalsHeader);
  panels[0].append(comparison.element, comparison.feedback);
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
  const stop = button(doc, 'Stop this run');
  workloadActions.append(run, stop);
  const workloadHelp = node(doc, 'p', 'workload-help');
  panels[2].append(workloadHelp, workloadActions);

  const settings = node(doc, 'details', 'settings');
  settings.open = false;
  settings.append(node(doc, 'summary', 'heading', 'Advanced settings'));
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
  const changeProcessing = button(doc, 'Change processing');
  panels[2].append(changeProcessing);
  changeProcessing.addEventListener('click', () => {
    settings.open = true;
    work.scrollIntoView?.({ block: 'nearest' });
    work.focus();
  });
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
  const consent = button(doc, 'Accept');
  consent.setAttribute('aria-label', 'Accept simulated tracking');
  const decline = button(doc, 'Decline');
  decline.setAttribute('aria-label', 'Decline simulated tracking');
  const response = button(doc, 'Test response');
  let testingResponse = false;
  response.dataset.perfInteraction = 'true';
  const refresh = button(doc, 'Refresh measurements');
  const preferences = button(doc, 'Open OneTrust preferences');
  runtimeActions.append(preferences, response, refresh);
  const consentHelp = node(doc, 'p', 'muted', 'These buttons simulate consent. No real OneTrust banner or tracking is loaded.');
  const bannerControl = node(doc, 'div', 'banner-control');
  const bannerLabel = node(doc, 'label', 'banner-toggle');
  const bannerToggle = doc.createElement('input');
  bannerToggle.type = 'checkbox';
  bannerToggle.checked = false;
  bannerToggle.setAttribute('aria-controls', 'demo-helper-cookie-banner');
  bannerLabel.append(bannerToggle, node(doc, 'span', 'label-text', 'Show demo cookie banner'));
  const bannerWaiting = node(doc, 'p', 'muted', 'The demo banner will appear when simulated OneTrust is ready.');
  bannerWaiting.setAttribute('role', 'status');
  const banner = doc.createElement('aside');
  banner.className = 'demo-cookie-banner';
  banner.hidden = true;
  banner.id = 'demo-helper-cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-labelledby', 'demo-helper-cookie-banner-title');
  const bannerTitle = node(doc, 'h2', 'heading', 'Your privacy choices');
  bannerTitle.id = 'demo-helper-cookie-banner-title';
  const bannerActions = node(doc, 'div', 'actions');
  const bannerAccept = button(doc, 'Accept');
  bannerAccept.className = 'demo-cookie-banner-action demo-cookie-banner-accept';
  const bannerDecline = button(doc, 'Decline');
  bannerDecline.className = 'demo-cookie-banner-action';
  bannerActions.append(bannerAccept, bannerDecline);
  const bannerCopy = node(doc, 'div', 'banner-copy');
  bannerCopy.append(bannerTitle);
  bannerCopy.append(node(doc, 'p', 'muted', 'Choose whether to allow optional cookies for analytics and personalized content. This is a demo banner; Accept and Decline only control simulated tracking and do not change real cookie preferences.'));
  banner.append(bannerCopy, bannerActions);
  doc.body.append(banner);
  bannerControl.append(bannerLabel, bannerWaiting);
  const consentControl = node(doc, 'details', 'consent-control');
  const consentState = node(doc, 'summary', 'consent-state');
  const consentActions = node(doc, 'div', 'actions');
  consentActions.append(consent, decline);
  consentControl.append(consentState, consentActions, bannerControl);
  const responseStatus = node(doc, 'p', 'muted');
  responseStatus.setAttribute('role', 'status');
  const refreshStatus = node(doc, 'p', 'muted');
  refreshStatus.setAttribute('role', 'status');
  const runActions = node(doc, 'div', 'actions');
  const rerun = button(doc, 'Run again');
  const share = button(doc, 'Copy comparison link');
  runActions.append(rerun, share);
  const shareStatus = node(doc, 'p', 'muted');
  shareStatus.setAttribute('role', 'status');
  const shareURL = node(doc, 'input', 'input');
  shareURL.readOnly = true;
  shareURL.hidden = true;
  shareURL.setAttribute('aria-label', 'Comparison link');
  section.append(scenarios, comparisonHelp, overview, nextStep, consentControl, measurements);
  section.append(runtimeActions, responseStatus, refreshStatus, consentHelp);
  section.append(runActions, shareStatus, shareURL, settings);
  let lastConsent;
  let bannerVisible = false;
  const notifyBannerLayout = () => doc.dispatchEvent(new win.CustomEvent('demo-cookie-banner:updated'));
  if (win.ResizeObserver) new win.ResizeObserver(notifyBannerLayout).observe(banner);

  function showBanner(visible) {
    banner.hidden = !visible;
    if (bannerVisible === visible) return;
    bannerVisible = visible;
    notifyBannerLayout();
  }

  function render() {
    const snapshot = win.etradePerformanceDemo?.snapshot();
    overview.hidden = !snapshot;
    nextStep.hidden = !snapshot;
    comparisonHelp.hidden = Boolean(snapshot);
    runActions.hidden = !snapshot;
    measurements.hidden = !snapshot;
    runtimeActions.hidden = !snapshot;
    consentHelp.hidden = !snapshot;
    consentControl.hidden = true;
    bannerControl.hidden = true;
    bannerWaiting.hidden = true;
    status.textContent = snapshot?.status || '';
    if (!snapshot) { showBanner(false); return; }
    const progress = loadingProgress(snapshot);
    const { real, gated } = progress;
    let processing = snapshot.config.work === 'none' ? 'Download + parse' : `${snapshot.config.work} assumed CPU`;
    if (real) processing = 'Actual SDK';
    runLabel.textContent = `${PROFILE_LABELS[snapshot.config.profile]} · ${PHASE_LABELS[snapshot.config.phase]} · ${processing}`;
    if (snapshot.config.profile === 'baseline') runLabel.textContent = 'No tag stack · page measurements only';
    let comparisonLabel = runLabel.textContent;
    if (snapshot.config.profile === 'etrade') comparisonLabel = `${snapshot.config.phase === 'early' ? 'Traditional' : PHASE_LABELS[snapshot.config.phase]} · ${processing}`;
    comparison.update(snapshot, comparisonLabel);
    const timed = (value) => (value === undefined ? '' : `at ${(value / 1000).toFixed(2)} s`);
    const stage = (key, { text, state, time }) => {
      const entry = stages.get(key);
      entry.state.textContent = text;
      entry.item.dataset.state = state;
      entry.timing.textContent = timed(time);
    };
    ['content', 'cmp', 'tags'].forEach((key) => stage(key, progress[key]));
    stages.get('cmp').item.hidden = snapshot.config.profile === 'baseline';
    stages.get('tags').item.hidden = ['baseline', 'onetrust'].includes(snapshot.config.profile);
    nextStep.textContent = nextInstruction(snapshot, progress);
    reference.hidden = real;
    realDownloads.hidden = !real;
    simulation.hidden = real;
    realConsent.hidden = !real;
    workloadActions.hidden = real;
    workloadHelp.hidden = real;
    changeProcessing.hidden = real;
    if (snapshot.config.profile !== 'etrade') workloadHelp.textContent = 'The interaction workload is available with the full simulated tag stack.';
    else if (snapshot.config.work === 'none') workloadHelp.textContent = 'Download and parse only: no assumed CPU delays are added. Choose a processing preset to demonstrate interaction and background work.';
    else if (snapshot.status === 'Stopped') workloadHelp.textContent = 'This run is stopped. Use Run again for a fresh comparison.';
    else if (gated && !snapshot.cmpReady) workloadHelp.textContent = 'OneTrust is still loading. Consent controls become available when it is ready.';
    else if (gated && snapshot.consent !== 'accepted') workloadHelp.textContent = 'Accept simulated consent to release the tags and start the 30-second workload.';
    else if (snapshot.completed + snapshot.failed < snapshot.resources.length || !snapshot.resources.length) workloadHelp.textContent = 'Waiting for the simulated tag stack to finish loading.';
    else if (snapshot.runtimeActive) workloadHelp.textContent = `Assumed processing is active for another ${Math.ceil(snapshot.runtimeRemainingMs / 1000)} seconds. Try Test response or interact with the page.`;
    else workloadHelp.textContent = 'The workload is idle. Run another 30-second window to demonstrate interaction and background work.';
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
    consentControl.hidden = !gated;
    if (lastConsent !== snapshot.consent) consentControl.open = snapshot.consent === 'pending';
    consentState.textContent = `Simulated consent · ${{ pending: 'no choice yet', accepted: 'accepted', declined: 'declined' }[snapshot.consent]}`;
    consent.setAttribute('aria-pressed', String(snapshot.consent === 'accepted'));
    decline.setAttribute('aria-pressed', String(snapshot.consent === 'declined'));
    bannerControl.hidden = !gated;
    if (!gated || snapshot.status === 'Stopped'
      || (lastConsent !== undefined && lastConsent !== snapshot.consent)) {
      bannerToggle.checked = false;
    }
    lastConsent = snapshot.consent;
    bannerToggle.disabled = snapshot.status === 'Stopped';
    bannerWaiting.hidden = !bannerToggle.checked || snapshot.cmpReady;
    showBanner(gated && bannerToggle.checked && snapshot.cmpReady);
    consent.hidden = !gated;
    decline.hidden = !gated;
    consent.disabled = snapshot.status === 'Stopped' || !snapshot.cmpReady;
    decline.disabled = consent.disabled;
    bannerAccept.disabled = consent.disabled;
    bannerDecline.disabled = consent.disabled;
    stop.disabled = snapshot.status === 'Stopped' || snapshot.config.profile === 'baseline';
    response.disabled = snapshot.status === 'Stopped' || testingResponse;
    run.textContent = snapshot.runtimeActive ? 'Restart 30-second workload' : 'Run 30-second workload';
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
      runtime: snapshot.runtimeActive ? `Active · ${Math.ceil(snapshot.runtimeRemainingMs / 1000)} s left` : 'Inactive',
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
    navigate(profile.value === 'off' ? null : {
      profile: profile.value, phase: phase.value, work: work.value,
    });
  });
  rerun.addEventListener('click', () => {
    if (!isDemoHelperHost(win.location.hostname)) return;
    try { win.sessionStorage.setItem('etrade:demo-helper-open', 'true'); } catch { /* Optional persistence. */ }
    win.location.reload();
  });
  share.addEventListener('click', async () => {
    try {
      if (!win.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await win.navigator.clipboard.writeText(win.location.href);
      shareStatus.textContent = 'Comparison link copied. The balance stays local to this browser.';
      shareURL.hidden = true;
    } catch {
      shareStatus.textContent = 'Copy the link below. The balance stays local to this browser.';
      shareURL.value = win.location.href;
      shareURL.hidden = false;
      shareURL.focus();
      shareURL.select?.();
    }
  });
  function chooseConsent(accepted) {
    const snapshot = win.etradePerformanceDemo?.snapshot();
    if (snapshot?.config.profile !== 'etrade' || !['eds', 'consent'].includes(snapshot.config.phase)
      || !snapshot.cmpReady || snapshot.status === 'Stopped') return;
    const restoreFocus = banner.contains(doc.activeElement);
    const restorePanelFocus = consentControl.contains(doc.activeElement);
    bannerToggle.checked = false;
    if (accepted) win.etradePerformanceDemo.grantConsent();
    else win.etradePerformanceDemo.declineConsent();
    render();
    if (restoreFocus) (doc.querySelector('.demo-helper-toggle') || bannerToggle).focus();
    else if (restorePanelFocus && !consentControl.open) consentState.focus();
  }
  consent.addEventListener('click', () => chooseConsent(true));
  decline.addEventListener('click', () => chooseConsent(false));
  bannerAccept.addEventListener('click', () => chooseConsent(true));
  bannerDecline.addEventListener('click', () => chooseConsent(false));
  bannerToggle.addEventListener('change', () => {
    render();
    if (bannerToggle.checked && banner.hidden) bannerWaiting.scrollIntoView?.({ block: 'nearest' });
  });
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
    afterPaint(win, finish);
  });
  let responseCount = 0;
  response.addEventListener('click', () => {
    if (testingResponse) return;
    const before = win.etradePerformanceDemo?.snapshot();
    const restoreFocus = doc.activeElement === response;
    testingResponse = true;
    response.disabled = true;
    response.textContent = 'Testing…';
    responseCount += 1;
    responseStatus.textContent = `Response ${responseCount} rendered. Waiting for paint…`;
    afterPaint(win, () => {
      win.etradePerformanceDemo?.refreshMeasurements();
      render();
      testingResponse = false;
      response.disabled = win.etradePerformanceDemo?.snapshot().status === 'Stopped';
      response.textContent = 'Test response';
      if (restoreFocus && !response.closest('[hidden]')
        && (doc.activeElement === doc.body || doc.activeElement === response)) response.focus();
      let detail = 'No assumed CPU delay was added to this response.';
      if (before?.runtimeActive) detail = 'This response included the active simulated workload.';
      else if (before?.config.work !== 'none' && before?.config.profile === 'etrade') detail = 'The simulated workload is idle; check Workload to start it.';
      responseStatus.textContent = `Response ${responseCount} painted. Measurements updated. ${detail}`;
    });
  });
  doc.addEventListener('demo-performance:updated', render);
  win.addEventListener('resize', render);
  render();
  return section;
}
