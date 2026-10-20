export const ONETRUST_SRC = 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js';
// Public domain identifier from the referenced OneTrust integration, not an API credential.
export const ONETRUST_DOMAIN_ID = '01953914-53cc-7833-b8d6-c9c9d7301ff9';
export const ONETRUST_REQUIRED_GROUPS = ['C0002', 'C0004'];

function groups(value) {
  const list = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((item) => typeof item === 'string')
    .map((item) => item.trim()).filter(Boolean))];
}

/** Real CMP integration. A downloaded SDK never implies consent or initialization. */
export default function startOneTrust(doc = document, win = window, options = {}) {
  if (win.etradeOneTrust) return win.etradeOneTrust;
  const domainId = options.domainId
    ?? doc.querySelector('meta[name="onetrust-domain-id"]')?.content.trim()
    ?? ONETRUST_DOMAIN_ID;
  const requiredGroups = [...(options.requiredGroups || ONETRUST_REQUIRED_GROUPS)];
  const loadConsented = options.loadConsented || (() => import('./consented.js'));
  const state = {
    domainId,
    requiredGroups,
    activeGroups: [],
    sdkStatus: 'loading',
    initialized: false,
    consented: false,
    consentedModule: 'Not loaded',
    timedOut: false,
    requestedAt: win.performance.now(),
    loadedAt: null,
    initializedAt: null,
  };
  let timer;
  let consentedPromise;

  function status() {
    if (state.sdkStatus === 'invalid') return 'OneTrust configuration is invalid · tracking stays off';
    if (state.sdkStatus === 'conflict') return 'Another OneTrust domain is already configured · tracking stays off';
    if (state.initialized) {
      return state.consented ? 'OneTrust initialized · required categories granted'
        : 'OneTrust initialized · required categories not granted';
    }
    if (state.sdkStatus === 'error') return 'OneTrust SDK failed to load · tracking stays off';
    if (state.timedOut) {
      return state.sdkStatus === 'loaded'
        ? 'SDK loaded · CMP did not initialize; check domain allowlist, configuration or network'
        : 'OneTrust SDK not ready · check network or content blocking';
    }
    return state.sdkStatus === 'loaded' ? 'SDK loaded · waiting for OneTrust initialization'
      : 'Loading real OneTrust SDK';
  }

  const controller = {
    snapshot: () => ({
      ...state,
      status: status(),
      requiredGroups: [...requiredGroups],
      activeGroups: [...state.activeGroups],
      canOpenPreferences: state.initialized && typeof win.OneTrust?.ToggleInfoDisplay === 'function',
    }),
    hasConsent: () => state.initialized && state.consented,
    openPreferences() {
      if (controller.snapshot().canOpenPreferences) win.OneTrust.ToggleInfoDisplay();
    },
  };
  win.etradeOneTrust = controller;
  const publish = () => options.onChange?.(controller.snapshot());
  const notifyConsent = () => win.dispatchEvent(new win.CustomEvent('consent.update', {
    detail: {
      consented: controller.hasConsent(),
      source: 'onetrust',
      initialized: state.initialized,
      activeGroups: [...state.activeGroups],
      requiredGroups: [...requiredGroups],
    },
  }));

  function updateConsent(value) {
    state.initialized = true;
    state.initializedAt ??= win.performance.now();
    state.activeGroups = groups(value);
    state.consented = requiredGroups.every((group) => state.activeGroups.includes(group));
    win.clearTimeout(timer);
    notifyConsent();
    if (state.consented && !consentedPromise) {
      state.consentedModule = 'Loading';
      // Import once after real consent. Consumers must also handle consent.update revocation.
      consentedPromise = Promise.resolve().then(async () => {
        if (!controller.hasConsent()) {
          state.consentedModule = 'Not loaded';
          consentedPromise = null;
          publish();
          return;
        }
        try {
          await loadConsented();
          state.consentedModule = 'Loaded';
        } catch { state.consentedModule = 'Load failed'; }
        publish();
      });
    }
    publish();
  }

  const existing = doc.querySelector('script[data-domain-script][src*="otSDKStub.js"]');
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:-test)?$/i.test(domainId)
    || !requiredGroups.length || requiredGroups.some((group) => !/^C\d+$/.test(group))) {
    state.sdkStatus = 'invalid';
    notifyConsent();
    publish();
    return controller;
  }
  if (existing && existing.getAttribute('data-domain-script') !== domainId) {
    state.sdkStatus = 'conflict';
    notifyConsent();
    publish();
    return controller;
  }
  // Register before injection so fast loads and restored consent cannot race the gate.
  const previousWrapper = win.OptanonWrapper;
  win.OptanonWrapper = (...args) => {
    try {
      if (typeof previousWrapper === 'function') previousWrapper.apply(win, args);
    } finally {
      updateConsent(win.OnetrustActiveGroups);
    }
  };
  win.addEventListener('OneTrustGroupsUpdated', (event) => {
    updateConsent(event.detail ?? win.OnetrustActiveGroups);
  });
  notifyConsent();
  timer = win.setTimeout(() => { state.timedOut = true; publish(); }, 15000);
  const script = existing || doc.createElement('script');
  script.addEventListener('load', () => {
    state.sdkStatus = 'loaded';
    state.loadedAt = win.performance.now();
    publish();
  }, { once: true });
  script.addEventListener('error', () => {
    state.sdkStatus = 'error';
    win.clearTimeout(timer);
    publish();
  }, { once: true });
  if (!existing) {
    script.src = ONETRUST_SRC;
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.async = true;
    script.setAttribute('data-domain-script', domainId);
    doc.head.append(script);
  }
  if (typeof win.OnetrustActiveGroups === 'string') {
    if (existing) state.sdkStatus = 'loaded';
    updateConsent(win.OnetrustActiveGroups);
  }
  publish();
  return controller;
}
