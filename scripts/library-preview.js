import { getPageTheme } from './page-theme.js';

const STORAGE_KEY = 'etrade:library-preview-theme';
const labels = { charcoal: 'Charcoal', purple: 'Purple' };

/** Library controls belong to preview hosts and never become authored block content. */
export function isLibraryPreview(location = {}) {
  const { hostname = '', pathname = '' } = location;
  return /^\/library\/blocks\/[a-z0-9-]+\/?$/i.test(pathname)
    && (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname)
      || /\.(aem\.page|hlx\.page|preview\.da\.live)$/i.test(hostname));
}

function savedTheme(win) {
  try {
    const value = win.sessionStorage.getItem(STORAGE_KEY);
    return Object.hasOwn(labels, value) ? value : '';
  } catch {
    return '';
  }
}

function bodyTheme(doc) {
  const rows = [...doc.querySelectorAll('main .metadata > div')];
  const row = rows.find((candidate) => candidate.firstElementChild?.textContent.trim().toLowerCase() === 'theme');
  return row ? getPageTheme(row.children[1]?.textContent) : '';
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Collapse the known brief range without swallowing examples or their block tables. */
function collapseAuthoringBrief(main, doc) {
  const title = main.querySelector('h1');
  if (!/\sblock brief$/i.test(title?.textContent.trim() || '')) return;
  const siblings = [...title.parentElement.children];
  const start = siblings.findIndex((node) => node.matches('h2')
    && node.textContent.trim().toLowerCase() === 'table structure');
  const end = siblings.findIndex((node) => node.matches('h2')
    && node.textContent.trim().toLowerCase() === 'examples');
  if (start <= siblings.indexOf(title) || end <= start) return;
  const notes = siblings.slice(start, end);
  if (notes.some((node) => !node.matches('h2, h3, h4, p, ul, ol, blockquote, pre')
    || node.querySelector('table, .block'))) return;

  const guide = element(doc, 'details', 'library-preview-guide');
  const summary = element(doc, 'summary');
  summary.append(
    element(doc, 'span', 'library-preview-guide-label', 'Authoring guide'),
    element(doc, 'span', 'library-preview-guide-hint', 'Structure, properties & options'),
  );
  const content = element(doc, 'article', 'library-preview-guide-content');
  notes[0].before(guide);
  content.append(...notes);
  guide.append(summary, content);
}

export default function mountLibraryPreview(doc = document, win = window) {
  if (!isLibraryPreview(win.location) || doc.querySelector('.library-preview')) return false;
  const main = doc.querySelector('main');
  if (!main) return false;

  const root = doc.documentElement;
  const authoredTheme = root.dataset.pageTheme || bodyTheme(doc);
  const panel = element(doc, 'aside', 'library-preview');
  panel.setAttribute('aria-label', 'Block library theme preview');
  const toggle = element(doc, 'button', 'library-preview-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Theme preview');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'library-preview-tray');
  const icon = element(doc, 'span', 'library-preview-icon');
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(icon, element(doc, 'span', '', 'Theme'));
  const tray = element(doc, 'div', 'library-preview-tray');
  tray.id = 'library-preview-tray';
  tray.hidden = true;
  const controls = element(doc, 'div', 'library-preview-controls');
  const group = element(doc, 'div', 'library-preview-themes');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Page theme');
  const buttons = Object.entries(labels).map(([value, label]) => {
    const button = element(doc, 'button', 'library-preview-theme');
    button.type = 'button';
    button.dataset.theme = value;
    const swatch = element(doc, 'span', 'library-preview-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    button.append(swatch, element(doc, 'span', '', label));
    group.append(button);
    return button;
  });
  const reset = element(doc, 'button', 'library-preview-reset', 'Use page default');
  reset.type = 'button';
  controls.append(group, reset);
  const status = element(doc, 'p', 'library-preview-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const help = element(doc, 'p', 'library-preview-help', 'Session preview · Set Metadata → Theme to use on your page.');
  help.title = 'Section color schemes, block options and artwork stay authored.';
  tray.append(controls, status, help);
  panel.append(toggle, tray);
  main.before(panel);
  doc.body.dataset.libraryPreview = 'true';

  function apply(value, remember = false) {
    if (Object.hasOwn(labels, value)) root.dataset.pageTheme = value;
    else delete root.dataset.pageTheme;
    icon.dataset.previewTheme = value;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === value)));
    status.textContent = {
      purple: 'Deep-purple surfaces · Smaller card corners',
      charcoal: 'Charcoal surfaces · Rounded card corners',
    }[value] || 'Page default: no page family selected.';
    if (remember) {
      try { win.sessionStorage.setItem(STORAGE_KEY, value); } catch { /* Preview still works. */ }
    }
  }

  function setExpanded(expanded) {
    toggle.setAttribute('aria-expanded', String(expanded));
    tray.hidden = !expanded;
  }

  toggle.addEventListener('click', () => setExpanded(tray.hidden));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !tray.hidden) {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      toggle.focus();
    }
  });

  buttons.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.theme, true));
  });
  reset.addEventListener('click', () => {
    try { win.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Preview still works. */ }
    apply(authoredTheme);
  });

  // These tables describe picker entries and page metadata, not visual components.
  main.querySelectorAll('.library-metadata, .metadata').forEach((metadata) => metadata.remove());
  collapseAuthoringBrief(main, doc);
  apply(savedTheme(win) || authoredTheme);
  return true;
}
