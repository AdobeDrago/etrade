import { readDemoSession, writeDemoSession } from './demo-session.js';

const LIMIT = 20;
const number = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
const ms = (value) => (value === null ? 'Not observed' : `${Math.round(value)} ms`);

export function performanceSessionRuns(win) {
  const saved = readDemoSession(win, 'performance-runs');
  if (!Array.isArray(saved)) return [];
  return saved.slice(-LIMIT).filter((run) => (
    run && typeof run.id === 'string' && run.id.length <= 100
    && typeof run.page === 'string' && run.page.startsWith('/') && run.page.length <= 1000
    && typeof run.startedAt === 'string' && Number.isFinite(Date.parse(run.startedAt))
    && ['baseline', 'etrade', 'onetrust', 'onetrust-real'].includes(run.profile)
    && ['early', 'late', 'consent', 'eds'].includes(run.phase)
    && ['none', 'light', 'medium', 'heavy'].includes(run.work)
    && (run.status === undefined || (typeof run.status === 'string' && run.status.length <= 200))
    && ['lcp', 'fcp', 'cls', 'interaction', 'transferred'].every((key) => (
      run[key] === null || (typeof run[key] === 'number' && number(run[key]) !== null)
    ))
  ));
}

/** Each navigation creates a fresh run; previous measurements are retained as history. */
export function recordPerformanceSession(doc, win, controller) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startedAt = new Date().toISOString();
  const page = new URL(win.location.href).pathname;
  const record = () => {
    const snapshot = controller.snapshot();
    const runs = performanceSessionRuns(win).filter((run) => run.id !== id);
    runs.push({
      id,
      startedAt,
      page,
      profile: snapshot.config.profile,
      phase: snapshot.config.phase,
      work: snapshot.config.profile === 'baseline' ? 'none' : snapshot.config.work,
      status: String(snapshot.status).slice(0, 200),
      consent: snapshot.consent,
      lcp: number(snapshot.metrics.lcp),
      fcp: number(snapshot.metrics.fcp),
      cls: number(snapshot.metrics.cls),
      interaction: number(snapshot.metrics.worstInteraction),
      transferred: number(snapshot.actualTransferBytes),
    });
    writeDemoSession(win, 'performance-runs', runs.slice(-LIMIT));
  };
  doc.addEventListener('demo-performance:updated', record);
  win.addEventListener('pagehide', record);
  record();
}

export default function mountSessionHistory(doc, win) {
  const root = doc.createElement('details');
  root.className = 'demo-helper-event-sandbox';
  root.dataset.demoState = 'performance.history';
  const summary = doc.createElement('summary');
  summary.className = 'demo-helper-heading';
  const help = doc.createElement('p');
  help.className = 'demo-helper-muted';
  help.textContent = 'Latest 20 page runs in this tab. Each page starts fresh measurements. Compare modes on the same page for a meaningful performance comparison.';
  const list = doc.createElement('ol');
  list.className = 'demo-helper-event-log';
  list.setAttribute('aria-label', 'Demo session performance history');
  root.append(summary, help, list);
  let previous;
  function render() {
    const runs = performanceSessionRuns(win);
    const signature = JSON.stringify(runs);
    if (signature === previous) return;
    previous = signature;
    summary.textContent = `Session runs (${runs.length})`;
    list.replaceChildren();
    if (!runs.length) {
      const empty = doc.createElement('li');
      empty.className = 'demo-helper-empty';
      empty.textContent = 'Choose a performance mode to start recording page runs.';
      list.append(empty);
    }
    runs.slice().reverse().forEach((run) => {
      const item = doc.createElement('li');
      item.className = 'demo-helper-event';
      const title = doc.createElement('strong');
      title.className = 'demo-helper-event-key';
      title.textContent = run.page;
      const description = doc.createElement('p');
      description.className = 'demo-helper-muted';
      const mode = {
        baseline: 'No tag stack',
        etrade: {
          early: 'Traditional', eds: 'EDS', late: 'Tags after content', consent: 'Tags after consent',
        }[run.phase],
        onetrust: 'OneTrust weights',
        'onetrust-real': 'Real OneTrust',
      }[run.profile];
      description.textContent = `${new Date(run.startedAt).toLocaleTimeString()} · ${mode} · ${run.phase} · ${run.work} processing`;
      const metrics = doc.createElement('p');
      metrics.className = 'demo-helper-muted';
      metrics.textContent = `LCP: ${ms(run.lcp)} · FCP: ${ms(run.fcp)} · CLS: ${run.cls === null ? 'Not observed' : run.cls.toFixed(3)} · Response: ${ms(run.interaction)} · Transferred: ${run.transferred === null ? 'Unavailable' : `${Math.round(run.transferred / 1000)} kB`}`;
      item.append(title, description, metrics);
      if (typeof run.status === 'string') {
        const status = doc.createElement('p');
        status.className = 'demo-helper-muted';
        const gated = run.profile === 'onetrust-real'
          || (run.profile === 'etrade' && ['eds', 'consent'].includes(run.phase));
        status.textContent = `${run.status}${gated && ['pending', 'accepted', 'declined'].includes(run.consent) ? ` · Consent: ${run.consent}` : ''}`;
        item.append(status);
      }
      list.append(item);
    });
  }
  doc.addEventListener('demo-performance:updated', render);
  render();
  return root;
}
