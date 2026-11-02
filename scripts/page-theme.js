import { getMetadata } from './aem.js';

const themes = new Set(['purple', 'charcoal']);

export function getColorScheme(value) {
  return String(value || '').trim().toLowerCase().replace(/^theme-/, '')
    .match(/^(light|dark)$/)?.[0] || '';
}

/** Page design families are independent of light/dark section and header schemes. */
export function getPageTheme(value = getMetadata('theme')) {
  return String(value || '').split(',')
    .map((name) => name.trim().toLowerCase().replace(/^theme-/, ''))
    .find((name) => themes.has(name)) || '';
}

/** Explicit header choices and legacy schemes take precedence over family defaults. */
export function getHeaderTheme(variants = []) {
  return getColorScheme(getMetadata('header-theme'))
    || [...variants].map(getColorScheme).find(Boolean)
    || String(getMetadata('theme') || '').split(',').map(getColorScheme).find(Boolean)
    || (getPageTheme() === 'purple' ? 'light' : 'dark');
}

/** Apply before the first block loads so inherited tokens resolve on the root. */
export default function decoratePageTheme() {
  const theme = getPageTheme();
  if (theme) document.documentElement.dataset.pageTheme = theme;
  else delete document.documentElement.dataset.pageTheme;
}
