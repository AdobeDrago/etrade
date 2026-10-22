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

export default function mountLibraryPreview(doc = document, win = window) {
  if (!isLibraryPreview(win.location) || doc.querySelector('.library-preview')) return false;
  const main = doc.querySelector('main');
  if (!main) return false;

  const root = doc.documentElement;
  const authoredTheme = root.dataset.pageTheme || bodyTheme(doc);
  const panel = element(doc, 'aside', 'library-preview');
  panel.setAttribute('aria-label', 'Block library theme preview');
  const controls = element(doc, 'div', 'library-preview-controls');
  controls.append(element(doc, 'strong', 'library-preview-label', 'Preview theme'));
  const group = element(doc, 'div', 'library-preview-themes');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Page theme');
  const buttons = Object.entries(labels).map(([value, label]) => {
    const button = element(doc, 'button', 'library-preview-theme', label);
    button.type = 'button';
    button.dataset.theme = value;
    group.append(button);
    return button;
  });
  const reset = element(doc, 'button', 'library-preview-reset', 'Use page default');
  reset.type = 'button';
  controls.append(group, reset);
  const status = element(doc, 'p', 'library-preview-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const help = element(doc, 'p', 'library-preview-help', 'Preview only. On your page, set Metadata → Theme to Purple or Charcoal. Section color schemes, block options and artwork stay authored.');
  panel.append(controls, status, help);
  main.before(panel);
  doc.body.dataset.libraryPreview = 'true';

  function apply(value, remember = false) {
    if (Object.hasOwn(labels, value)) root.dataset.pageTheme = value;
    else delete root.dataset.pageTheme;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === value)));
    status.textContent = {
      purple: 'Purple: deep-purple inverse surfaces and smaller card corners.',
      charcoal: 'Charcoal: charcoal inverse surfaces and rounded card corners.',
    }[value] || 'Page default: no page family selected.';
    if (remember) {
      try { win.sessionStorage.setItem(STORAGE_KEY, value); } catch { /* Preview still works. */ }
    }
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.theme, true));
  });
  reset.addEventListener('click', () => {
    try { win.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Preview still works. */ }
    apply(authoredTheme);
  });

  // These tables describe picker entries and page metadata, not visual components.
  main.querySelectorAll('.library-metadata, .metadata').forEach((metadata) => metadata.remove());
  apply(savedTheme(win) || authoredTheme);
  return true;
}
