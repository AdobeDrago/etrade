/* The complete guide and catalog remain readable without JavaScript. */
const filter = document.querySelector('#block-filter');
const family = document.querySelector('#block-family');
const entries = [...document.querySelectorAll('.block-entry')];
const count = document.querySelector('#block-count');
const clear = document.querySelector('#clear-filter');
const empty = document.querySelector('#catalog-empty');
const indexLinks = [...document.querySelectorAll('.catalog-index a')];
const navigation = document.querySelector('.guide-navigation');
const navLinks = [...document.querySelectorAll('.guide-nav a[href^="#"]')];
const sections = [...document.querySelectorAll('main > section')];
const currentSection = document.querySelector('.guide-current-section');
const mobile = window.matchMedia('(max-width: 900px)');
let layoutPending = false;
let tableAccessPending = true;
let activeId = '';

function updateReadingPosition() {
  const headerHeight = document.querySelector('.guide-header').getBoundingClientRect().height;
  const offset = `${headerHeight}px`;
  if (document.body.style.getPropertyValue('--guide-header-offset') !== offset) {
    document.body.style.setProperty('--guide-header-offset', offset);
  }
  const threshold = headerHeight + (mobile.matches ? 80 : 48);
  let active = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= threshold) active = section;
  });
  if (!active || active.id === activeId) return;
  activeId = active.id;
  navLinks.forEach((link) => {
    if (link.hash === `#${activeId}`) {
      link.setAttribute('aria-current', 'location');
      currentSection.textContent = link.firstChild.textContent.trim();
      currentSection.hidden = false;
    } else link.removeAttribute('aria-current');
  });
}

function updateTableAccess() {
  // Only scrollable tables need an extra stop in the keyboard tab order.
  document.querySelectorAll('.table-scroll').forEach((region) => {
    if (region.scrollWidth > region.clientWidth + 1) region.tabIndex = 0;
    else region.removeAttribute('tabindex');
  });
}

function refreshLayout() {
  if (layoutPending) return;
  layoutPending = true;
  window.requestAnimationFrame(() => {
    layoutPending = false;
    updateReadingPosition();
    if (tableAccessPending) {
      updateTableAccess();
      tableAccessPending = false;
    }
  });
}

function refreshTableLayout() {
  tableAccessPending = true;
  refreshLayout();
}

function filterBlocks() {
  const words = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  entries.forEach((entry) => {
    const text = entry.textContent.toLowerCase();
    const matches = (!family.value || entry.dataset.family === family.value)
      && words.every((word) => text.includes(word));
    entry.hidden = !matches;
    if (matches) shown += 1;
  });
  indexLinks.forEach((link) => {
    link.hidden = document.getElementById(link.hash.slice(1))?.hidden || false;
  });
  count.textContent = `${shown} of ${entries.length} blocks${shown ? '' : ' — try another search or reset the filters.'}`;
  clear.hidden = !filter.value && !family.value;
  empty.hidden = shown > 0;
  refreshTableLayout();
}

function revealBlock(hash) {
  const entry = entries.find((item) => `#${item.id}` === hash);
  if (!entry?.hidden) return;
  filter.value = '';
  family.value = '';
  filterBlocks();
  entry.scrollIntoView();
}

if (filter && family && count && clear && empty) {
  document.querySelector('.catalog-tools').hidden = false;
  filter.addEventListener('input', filterBlocks);
  family.addEventListener('change', filterBlocks);
  clear.addEventListener('click', () => {
    filter.value = '';
    family.value = '';
    filterBlocks();
    filter.focus();
  });
  // A link can target the current hash, which does not fire hashchange again.
  document.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || event.button !== 0) return;
    const link = event.target.closest?.('a[href^="#block-"]');
    if (link) revealBlock(link.hash);
  });
  window.addEventListener('hashchange', () => revealBlock(window.location.hash));
  filterBlocks();
}

if (navigation) {
  const syncNavigation = () => {
    navigation.open = !mobile.matches;
    activeId = '';
    refreshTableLayout();
  };
  syncNavigation();
  mobile.addEventListener('change', syncNavigation);
  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (mobile.matches && !event.metaKey && !event.ctrlKey && !event.shiftKey
        && !event.altKey && event.button === 0) navigation.open = false;
    });
  });
}

window.addEventListener('scroll', refreshLayout, { passive: true });
window.addEventListener('resize', refreshTableLayout);
window.addEventListener('hashchange', refreshLayout);
refreshLayout();
