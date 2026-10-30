import isDemoHelperHost from './demo-host.js';
import startOneTrust from './onetrust.js';
import { readDemoSession, writeDemoSession } from './demo-session.js';
import { recordPerformanceSession } from './demo-session-history.js';

const PROFILES = new Set(['baseline', 'onetrust', 'etrade', 'onetrust-real']);
const PHASES = new Set(['early', 'late', 'consent', 'eds']);
const WORK = {
  none: { initPer100KB: 0, interaction: 0, background: 0 },
  light: { initPer100KB: 5, interaction: 8, background: 10 },
  medium: { initPer100KB: 20, interaction: 40, background: 30 },
  heavy: { initPer100KB: 60, interaction: 120, background: 60 },
};
const RUNTIME_MS = 30000;
const CMP_DELAY_MS = 3000;

/** URL settings make baseline and workload runs shareable and reproducible. */
export function readPerformanceConfig(href) {
  const params = new URL(href).searchParams;
  const profile = params.get('perf');
  if (!PROFILES.has(profile)) return null;
  const phase = params.get('perf-phase');
  const work = params.get('perf-work');
  if (profile === 'onetrust-real') return { profile, phase: phase === 'eds' ? 'eds' : 'early', work: 'none' };
  return {
    profile,
    phase: PHASES.has(phase) ? phase : 'early',
    work: Object.hasOwn(WORK, work) ? work : 'none',
  };
}

export function performanceURL(href, config) {
  const url = new URL(href);
  ['perf', 'perf-phase', 'perf-work'].forEach((key) => url.searchParams.delete(key));
  if (config) {
    url.searchParams.set('perf', config.profile);
    url.searchParams.set('perf-phase', config.phase);
    url.searchParams.set('perf-work', config.work);
  }
  return url.href;
}

/** Explicit URLs override this tab's last applied mode; unmarked page links inherit it. */
export function resolvePerformanceConfig(win) {
  if (!isDemoHelperHost(win.location.hostname)) return null;
  if (new URL(win.location.href).searchParams.has('perf')) {
    return readPerformanceConfig(win.location.href);
  }
  const saved = readDemoSession(win, 'performance-config');
  if (!saved || !PROFILES.has(saved.profile) || !PHASES.has(saved.phase)
    || !Object.hasOwn(WORK, saved.work)) return null;
  return readPerformanceConfig(performanceURL(win.location.href, saved));
}

function observeMetrics(win, metrics, onUpdate) {
  const observers = [];
  let session;
  let pending = false;
  let observing = true;
  let frame;
  const notify = () => {
    if (pending || !observing) return;
    pending = true;
    const deliver = () => {
      pending = false;
      if (observing) onUpdate();
    };
    if (win.requestAnimationFrame) frame = win.requestAnimationFrame(deliver);
    else Promise.resolve().then(deliver);
  };
  const supported = win.PerformanceObserver?.supportedEntryTypes || [];
  if (supported.includes('layout-shift')) metrics.cls = 0;
  if (supported.includes('longtask')) {
    metrics.longTasks = 0;
    metrics.longTaskExcess = 0;
  }
  const observe = (type, callback, options = {}) => {
    if (!supported.includes(type)) return;
    const observer = new win.PerformanceObserver((list) => {
      callback(list.getEntries());
      notify();
    });
    try {
      observer.observe({ type, buffered: true, ...options });
      observers.push({ observer, callback });
    } catch { /* Keep unavailable metrics empty. */ }
  };
  observe('paint', (entries) => {
    entries.forEach((entry) => { if (entry.name === 'first-contentful-paint') metrics.fcp = entry.startTime; });
  });
  observe('largest-contentful-paint', (entries) => {
    metrics.lcp = entries.at(-1)?.startTime ?? metrics.lcp;
  });
  observe('layout-shift', (entries) => {
    entries.filter((entry) => !entry.hadRecentInput).forEach((entry) => {
      if (!session || entry.startTime - session.last > 1000
        || entry.startTime - session.start > 5000) {
        session = { start: entry.startTime, last: entry.startTime, value: 0 };
      }
      session.last = entry.startTime;
      session.value += entry.value;
      metrics.cls = Math.max(metrics.cls ?? 0, session.value);
    });
  });
  observe('longtask', (entries) => {
    metrics.longTasks = (metrics.longTasks ?? 0) + entries.length;
    entries.forEach((entry) => {
      metrics.longTaskExcess = (metrics.longTaskExcess ?? 0) + Math.max(0, entry.duration - 50);
    });
  });
  observe('event', (entries) => {
    entries.filter((entry) => entry.interactionId).forEach((entry) => {
      metrics.worstInteraction = Math.max(metrics.worstInteraction ?? 0, entry.duration);
    });
  }, { durationThreshold: 16 });
  return {
    flush: () => observers.forEach(({ observer, callback }) => {
      callback(observer.takeRecords?.() || []);
    }),
    disconnect: () => {
      observing = false;
      win.cancelAnimationFrame?.(frame);
      observers.forEach(({ observer }) => observer.disconnect());
    },
  };
}

/** Bounded main-thread work. Millisecond budgets are assumptions, not vendor timings. */
function occupy(win, milliseconds, label) {
  if (!milliseconds) return 0;
  const start = win.performance.now();
  const end = start + Math.min(milliseconds, 500);
  let value = 0;
  while (win.performance.now() < end) value = Math.imul(value + 1, 16807);
  const finish = win.performance.now();
  win.performance.measure(`demo-third-party:${label}`, { start, end: finish, detail: value });
  return finish - start;
}

/** No payload requests, observers or work unless explicitly enabled on a demo host. */
export default function startPerformanceDemo(doc = document, win = window, dependencies = {}) {
  if (!isDemoHelperHost(win.location.hostname)) return null;
  const config = resolvePerformanceConfig(win);
  writeDemoSession(win, 'performance-config', config);
  if (new URL(win.location.href).searchParams.has('perf')) {
    writeDemoSession(win, 'performance-draft', config);
  }
  if (!config) return null;
  if (win.etradePerformanceDemo) return win.etradePerformanceDemo;
  const realCMP = config.profile === 'onetrust-real';
  const rememberedConsent = readDemoSession(win, 'performance-consent');
  const metrics = {
    fcp: null, lcp: null, cls: null, worstInteraction: null,
  };
  const metricObservers = observeMetrics(win, metrics, () => {
    doc.dispatchEvent(new win.CustomEvent('demo-performance:updated'));
  });
  const workload = WORK[config.work];
  const state = {
    config,
    status: 'Loading profile',
    resources: [],
    requested: 0,
    completed: 0,
    failed: 0,
    simulatedCPU: 0,
    runtimeActive: false,
    cmpReady: false,
    consent: 'pending',
    milestones: {},
  };
  let stopped = false;
  let contentReady = false;
  let consentGranted = false;
  let tagsStarted = false;
  let tagsLoaded = false;
  let cmpStarted = false;
  let cmpLoading = false;
  let profileFailed = false;
  let cmpTimer;
  let runtimeTimer;
  let runtimeEndsAt;
  let interval;
  let manifest;
  let oneTrust;
  const loads = new Map();
  const consentGated = config.phase === 'eds' || config.phase === 'consent';
  const publish = () => {
    if (stopped) state.status = 'Stopped';
    else if (realCMP) {
      state.status = state.realCMP?.status || (contentReady
        ? 'Page ready · real OneTrust starts after 3 seconds' : 'Waiting for page content');
    } else if (config.profile === 'baseline') state.status = 'Baseline · no simulated libraries';
    else if (profileFailed) state.status = 'Profile unavailable · page continues without simulation';
    else if (consentGated && state.consent === 'declined') {
      state.status = tagsStarted ? 'Tracking declined · added tag work stopped' : 'Tracking declined · tags remain unloaded';
    } else if (tagsStarted) {
      state.status = 'Loading simulated tags';
      if (tagsLoaded) state.status = state.failed ? 'Some fixtures failed' : 'Simulated tags loaded';
    } else if (cmpLoading) state.status = 'Loading simulated OneTrust';
    else if (!cmpStarted) {
      state.status = contentReady ? 'Page ready · OneTrust starts after 3 seconds' : 'Waiting for page content';
    } else if (!state.cmpReady && consentGated) state.status = 'OneTrust fixture failed · tags remain unloaded';
    else if (config.profile === 'onetrust') state.status = state.failed ? 'Some fixtures failed' : 'Simulated OneTrust ready';
    else if (consentGated) state.status = 'OneTrust ready · awaiting simulated consent';
    else state.status = 'Waiting for page content before tags';
    doc.dispatchEvent(new win.CustomEvent('demo-performance:updated'));
  };
  const importResource = dependencies.importResource || ((url) => import(url));

  function interaction(event) {
    if (stopped || doc.hidden || (consentGated && !consentGranted)) return;
    // Control changes do not inflate the workload; the explicit response test does.
    if (event.target.closest?.('.demo-helper, .demo-cookie-banner')
      && !event.target.closest('[data-perf-interaction]')) return;
    state.simulatedCPU += occupy(win, workload.interaction, 'interaction');
  }

  function endRuntime() {
    win.clearInterval(interval);
    win.clearTimeout(runtimeTimer);
    doc.removeEventListener('click', interaction, true);
    doc.removeEventListener('keydown', interaction, true);
    state.runtimeActive = false;
    runtimeEndsAt = undefined;
  }

  function startRuntime() {
    if (stopped || !workload.interaction || !tagsLoaded || !contentReady
      || (consentGated && !consentGranted)) return;
    endRuntime();
    state.runtimeActive = true;
    runtimeEndsAt = win.performance.now() + RUNTIME_MS;
    doc.addEventListener('click', interaction, true);
    doc.addEventListener('keydown', interaction, true);
    interval = win.setInterval(() => {
      if (!doc.hidden) state.simulatedCPU += occupy(win, workload.background, 'background');
      publish();
    }, 2000);
    runtimeTimer = win.setTimeout(() => { endRuntime(); publish(); }, RUNTIME_MS);
  }

  function loadResource(resource) {
    if (loads.has(resource.id)) return loads.get(resource.id);
    const promise = (async () => {
      if (resource.dependsOn) {
        const dependency = state.resources.find((item) => item.id === resource.dependsOn);
        if (dependency) await loadResource(dependency);
      }
      if (stopped || (resource.group === 'tags' && consentGated && !consentGranted)) return;
      state.requested += 1;
      resource.status = 'loading';
      resource.requestedAt = win.performance.now();
      let timeout;
      try {
        // Use fresh module URLs each run. Browser cache policy is still controlled by the host.
        const url = new URL(`./demo-performance-assets/${resource.id}.js`, import.meta.url);
        url.searchParams.set('run', String(win.performance.timeOrigin));
        await Promise.race([
          importResource(url.href),
          new Promise((resolve, reject) => {
            timeout = win.setTimeout(() => reject(new Error('Fixture load timed out')), 10000);
          }),
        ]);
        if (stopped) return;
        const budget = (resource.decodedBytes / 102400) * workload.initPer100KB;
        if (resource.group !== 'tags' || !consentGated || consentGranted) {
          state.simulatedCPU += occupy(win, budget, resource.id);
        }
        resource.status = 'loaded';
        resource.loadedAt = win.performance.now();
        state.completed += 1;
      } catch {
        resource.status = 'failed';
        state.failed += 1;
      } finally {
        win.clearTimeout(timeout);
      }
    })();
    loads.set(resource.id, promise);
    return promise;
  }

  async function startTags() {
    if (tagsStarted || stopped || !manifest || config.profile !== 'etrade') return;
    if (consentGated && !consentGranted) return;
    if (config.phase === 'eds' && (!contentReady || !state.cmpReady)) return;
    tagsStarted = true;
    state.milestones.tagsStarted = win.performance.now();
    publish();
    await Promise.all(state.resources.filter((resource) => resource.group === 'tags').map(loadResource));
    if (stopped) return;
    // Revoking consent may leave dependent fixtures waiting; accepting again resumes them.
    tagsLoaded = state.resources.filter((resource) => resource.group === 'tags')
      .every((resource) => ['loaded', 'failed'].includes(resource.status));
    if (tagsLoaded) state.milestones.tagsReady = win.performance.now();
    if (!tagsLoaded) {
      tagsStarted = false;
      state.resources.filter((resource) => resource.status === 'waiting')
        .forEach((resource) => loads.delete(resource.id));
      if (consentGranted) startTags();
    }
    if (contentReady) startRuntime();
    publish();
  }

  function stop() {
    stopped = true;
    win.clearTimeout(cmpTimer);
    endRuntime();
    state.status = 'Stopped';
    // Observers keep measuring the page; stop prevents all subsequent simulated work.
    publish();
  }

  function setConsent(accepted) {
    if (realCMP) return; // Demo buttons and query overrides never grant real consent.
    const next = accepted ? 'accepted' : 'declined';
    if (stopped || state.consent === next) return;
    consentGranted = accepted;
    state.consent = next;
    writeDemoSession(win, 'performance-consent', next);
    state.milestones.consentUpdated = win.performance.now();
    // Simulation events cannot grant consent to the site's real analytics integration.
    win.dispatchEvent(new win.CustomEvent('demo-performance:consent.update', {
      detail: { consented: accepted, simulated: true },
    }));
    if (!accepted && consentGated) endRuntime();
    if (accepted && consentGated) {
      if (tagsLoaded) startRuntime();
      else if (config.phase !== 'eds' || state.cmpReady) startTags();
    }
    publish();
  }

  async function startCMP() {
    if (cmpStarted || stopped) return;
    cmpStarted = true;
    state.milestones.cmpStarted = win.performance.now();
    if (realCMP) {
      const update = (snapshot) => {
        state.realCMP = snapshot;
        state.cmpReady = snapshot.initialized;
        if (snapshot.initialized && state.milestones.cmpReady === undefined) {
          state.milestones.cmpReady = win.performance.now();
        }
        state.consent = snapshot.consented ? 'accepted' : 'declined';
        if (!snapshot.initialized) state.consent = 'pending';
        publish();
      };
      oneTrust = startOneTrust(doc, win, {
        ...dependencies.oneTrust,
        onChange: update,
      });
      update(oneTrust.snapshot());
      return;
    }
    cmpLoading = true;
    publish();
    try {
      const fetchProfile = dependencies.fetchProfile || (() => win.fetch(new URL('./demo-performance-profile.json', import.meta.url), { credentials: 'omit', signal: win.AbortSignal.timeout(5000) }).then((response) => {
        if (!response.ok) throw new Error('Profile unavailable');
        return response.json();
      }));
      manifest = await fetchProfile();
      if (stopped) return;
      state.resources = manifest.resources
        .filter((resource) => config.profile === 'etrade' || resource.group === 'consent')
        .map((resource) => ({ ...resource, status: 'waiting' }));
      // Both strategies use the same fixtures, dependency graph and CPU budgets.
      const stub = state.resources.find((resource) => resource.id === 'cmp-stub');
      if (stub) await loadResource(stub);
      if (stopped) return;
      const banner = state.resources.find((resource) => resource.id === 'cmp-banner');
      const bannerReady = banner ? loadResource(banner) : Promise.resolve();
      if (config.phase === 'early' && config.profile === 'etrade') {
        // Startup comparison: stub and Launch hold page decoration; the banner is async.
        const launch = state.resources.find((resource) => resource.id === 'tag-manager');
        if (launch) await loadResource(launch);
        startTags();
      } else if (config.phase !== 'eds') {
        if ((config.phase === 'late' && contentReady)
          || (config.phase === 'consent' && consentGranted)) startTags();
      }
      // EDS waits for the simulated CMP to initialize, then responds to consent changes.
      bannerReady.then(() => {
        if (stopped) return;
        cmpLoading = false;
        state.cmpReady = state.resources.filter((resource) => resource.group === 'consent')
          .every((resource) => resource.status === 'loaded');
        if (state.cmpReady) {
          state.milestones.cmpReady = win.performance.now();
          if (state.consent === 'pending' && ['accepted', 'declined'].includes(rememberedConsent)) {
            setConsent(rememberedConsent === 'accepted');
          }
          if (config.phase === 'eds' && consentGranted) startTags();
        }
        publish();
      });
      publish();
    } catch {
      cmpLoading = false;
      profileFailed = true;
      publish();
    }
  }

  const controller = {
    config,
    stop,
    runInteractions() { startRuntime(); publish(); },
    afterContent() {
      if (contentReady || stopped) return;
      contentReady = true;
      state.milestones.contentReady = win.performance.now();
      if (config.phase === 'eds' && config.profile !== 'baseline') {
        cmpTimer = win.setTimeout(() => { startCMP(); }, CMP_DELAY_MS);
      }
      if (config.phase === 'late') startTags();
      if (tagsLoaded) startRuntime();
      publish();
    },
    grantConsent() { setConsent(true); },
    declineConsent() { setConsent(false); },
    openConsentPreferences() { oneTrust?.openPreferences(); },
    refreshMeasurements() { metricObservers.flush(); publish(); },
    snapshot() {
      const actual = win.performance.getEntriesByType('resource').filter((entry) => {
        if (!realCMP) return entry.name.includes('/demo-performance-assets/');
        const { hostname } = new URL(entry.name);
        return ['cookielaw.org', 'onetrust.com'].some((host) => hostname === host
          || hostname.endsWith(`.${host}`));
      });
      const restrictedSizes = realCMP && (!actual.length
        || actual.some((entry) => !entry.decodedBodySize));
      const remaining = state.runtimeActive
        ? Math.max(0, runtimeEndsAt - win.performance.now()) : 0;
      return {
        ...state,
        metrics: { ...metrics },
        runtimeRemainingMs: remaining,
        resources: state.resources.map((resource) => ({ ...resource })),
        milestones: { ...state.milestones },
        ...(realCMP ? {
          realResources: actual.map((entry) => ({
            url: entry.name,
            duration: entry.duration,
            transferBytes: entry.transferSize,
            decodedBytes: entry.decodedBodySize,
          })),
          restrictedSizes,
        } : {}),
        capturedOn: manifest?.capturedOn,
        observedEncodedBytes: state.resources
          .reduce((sum, resource) => sum + resource.encodedBytes, 0),
        decodedBytes: state.resources.reduce((sum, resource) => sum + resource.decodedBytes, 0),
        actualTransferBytes: restrictedSizes ? null
          : actual.reduce((sum, entry) => sum + entry.transferSize, 0),
        actualDecodedBytes: restrictedSizes ? null
          : actual.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
      };
    },
  };
  win.etradePerformanceDemo = controller;
  recordPerformanceSession(doc, win, controller);
  win.addEventListener('pagehide', () => { stop(); metricObservers.disconnect(); }, { once: true });

  // EDS returns immediately: even the profile request waits until the delayed phase.
  controller.ready = config.profile === 'baseline' || config.phase === 'eds'
    ? Promise.resolve() : startCMP();
  publish();
  return controller;
}
