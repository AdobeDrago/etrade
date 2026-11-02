import isDemoHelperHost from './demo-host.js';

const PREFIX = 'etrade:demo-session:';
const KEYS = ['performance-config', 'performance-consent', 'performance-runs', 'performance-references', 'page-events', 'sample-events', 'ui', 'performance-draft'];

export function readDemoSession(win, name) {
  if (!isDemoHelperHost(win.location.hostname)) return null;
  try {
    const raw = win.sessionStorage.getItem(`${PREFIX}${name}`);
    if (!raw || raw.length > 500000) return null;
    const saved = JSON.parse(raw);
    return saved?.version === 1 ? saved.value : null;
  } catch { return null; }
}

export function writeDemoSession(win, name, value) {
  if (!isDemoHelperHost(win.location.hostname) || win.etradeDemoSessionReset) return false;
  try {
    win.sessionStorage.setItem(`${PREFIX}${name}`, JSON.stringify({ version: 1, value }));
    return true;
  } catch { return false; }
}

export function readDemoUI(win, name) {
  return readDemoSession(win, 'ui')?.[name];
}

export function writeDemoUI(win, name, value) {
  const current = readDemoSession(win, 'ui');
  const ui = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  writeDemoSession(win, 'ui', { ...ui, [name]: value });
}

/** Only explicitly named disclosures are restored; consent decisions are handled separately. */
export function rememberDemoDetails(root, win) {
  root.querySelectorAll('details[data-demo-state]').forEach((details) => {
    const open = readDemoUI(win, details.dataset.demoState);
    if (typeof open === 'boolean') details.open = open;
  });
  root.addEventListener('toggle', ({ target }) => {
    if (target.matches?.('details[data-demo-state]')) {
      writeDemoUI(win, target.dataset.demoState, target.open);
    }
  }, true);
}

export function resetDemoSession(win) {
  if (!isDemoHelperHost(win.location.hostname)) return false;
  try {
    KEYS.forEach((key) => win.sessionStorage.removeItem(`${PREFIX}${key}`));
    ['etrade:demo-helper-open', 'etrade:demo-helper-view', 'etrade:demo-comparison']
      .forEach((key) => win.sessionStorage.removeItem(key));
    // Old pagehide handlers must not recreate records after reset, before navigation finishes.
    win.etradeDemoSessionReset = true;
    win.etradePerformanceDemo?.stop();
    return true;
  } catch { return false; }
}

export function watchDemoNavigation(win) {
  if (!isDemoHelperHost(win.location.hostname) || win.etradeDemoNavigation) return;
  win.etradeDemoNavigation = true;
  win.addEventListener('pageshow', (event) => {
    // A bfcache document holds old queue/controller objects. Rehydrate from the latest session.
    if (event.persisted) win.location.reload();
  });
}
