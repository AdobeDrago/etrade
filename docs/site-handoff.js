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

function enableSidebarResize() {
  const layout = document.querySelector('.guide-layout');
  const sidebar = document.querySelector('.guide-sidebar');
  const handle = document.querySelector('.guide-resizer');
  if (!layout || !sidebar || !handle) return;
  const storageKey = 'etrade-guide-sidebar-width';
  const minimum = 224;
  let preferredWidth;
  let drag;
  try {
    const saved = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(saved) && saved >= minimum && saved <= 420) preferredWidth = saved;
  } catch { /* The sidebar still works when storage is unavailable. */ }

  const maximum = () => Math.min(420, Math.floor(layout.clientWidth * 0.45));
  const defaultWidth = () => Number.parseFloat(window.getComputedStyle(layout)
    .getPropertyValue('--guide-sidebar-default')) || 252;
  const setWidth = (value = preferredWidth ?? defaultWidth()) => {
    const max = maximum();
    const width = Math.round(Math.max(minimum, Math.min(max, value)));
    layout.style.setProperty('--guide-sidebar-width', `${width}px`);
    handle.setAttribute('aria-valuemax', max);
    handle.setAttribute('aria-valuenow', width);
    handle.setAttribute('aria-valuetext', `${width} pixels wide`);
    refreshTableLayout();
    return width;
  };
  const saveWidth = () => {
    try {
      if (preferredWidth === undefined) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, preferredWidth);
    } catch { /* Saving the preference is optional. */ }
  };
  const finishDrag = (save) => {
    if (!drag) return;
    const previous = drag;
    drag = undefined;
    document.body.classList.remove('guide-resizing');
    if (handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
    if (save) {
      preferredWidth = sidebar.getBoundingClientRect().width;
      saveWidth();
    } else if (!mobile.matches) setWidth(previous.width);
  };
  const resetWidth = () => {
    finishDrag(false);
    preferredWidth = undefined;
    setWidth();
    saveWidth();
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || mobile.matches || drag) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, width: sidebar.getBoundingClientRect().width };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('guide-resizing');
  });
  handle.addEventListener('pointermove', (event) => {
    if (event.pointerId === drag?.id) setWidth(drag.width + event.clientX - drag.x);
  });
  handle.addEventListener('pointerup', (event) => {
    if (event.pointerId === drag?.id) finishDrag(true);
  });
  handle.addEventListener('pointercancel', (event) => {
    if (event.pointerId === drag?.id) finishDrag(false);
  });
  handle.addEventListener('lostpointercapture', () => finishDrag(false));
  handle.addEventListener('dblclick', resetWidth);
  handle.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drag) {
      event.preventDefault();
      finishDrag(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      resetWidth();
      return;
    }
    const { width } = sidebar.getBoundingClientRect();
    const step = event.shiftKey ? 50 : 10;
    const next = {
      ArrowLeft: width - step, ArrowRight: width + step, Home: minimum, End: maximum(),
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    preferredWidth = setWidth(next);
    saveWidth();
  });

  const syncResize = () => {
    handle.hidden = mobile.matches;
    if (mobile.matches) finishDrag(false);
    else setWidth();
  };
  mobile.addEventListener('change', syncResize);
  window.addEventListener('resize', syncResize);
  syncResize();
}

function enableGuideSearch(revealEntry) {
  const trigger = document.querySelector('#guide-search-open');
  const dialog = document.querySelector('#guide-search-dialog');
  const input = document.querySelector('#guide-search-input');
  const results = document.querySelector('#guide-search-results');
  const status = document.querySelector('#guide-search-status');
  if (!trigger || !dialog || !input || !results || !status) return;
  const topics = [];
  let topic;
  const normalize = (value) => value.replace(/\s+/g, ' ').trim();
  // textContent includes catalog entries hidden by the independent block filter.
  document.querySelectorAll('main :is(h1, h2, h3, h4, p, li, tr, dt, dd, pre, figcaption, .prompt)')
    .forEach((node, index) => {
      if (node.parentElement.closest('p, li, tr, pre, figcaption, .prompt, .catalog-tools, .catalog-index')) return;
      const block = node.closest('.block-entry');
      const heading = /^H[1-4]$/.test(node.tagName);
      if (heading && (!block || node === block.querySelector('h3'))) {
        if (!node.id && !block) node.id = `guide-topic-${index}`;
        const label = node.cloneNode(true);
        label.querySelectorAll('.tag').forEach((tag) => tag.remove());
        topic = {
          title: normalize(label.textContent),
          section: normalize(node.closest('section').querySelector('h2')?.textContent || 'Overview'),
          id: block?.id || node.id,
          text: '',
        };
        topics.push(topic);
      } else if (topic) {
        const text = node.tagName === 'TR'
          ? [...node.children].map((cell) => cell.textContent).join(' · ')
          : node.textContent;
        topic.text += ` ${normalize(text)}`;
      }
    });

  const search = () => {
    const query = normalize(input.value).toLowerCase();
    results.replaceChildren();
    if (query.length < 2) {
      status.textContent = 'Enter at least 2 characters to search.';
      return;
    }
    const words = query.split(' ');
    const matches = topics.map((item) => {
      const title = item.title.toLowerCase();
      const text = `${title} ${item.section} ${item.text}`.toLowerCase();
      const score = (title.includes(query) ? 100 : 0)
        + words.filter((word) => title.includes(word)).length * 10;
      return { ...item, score, matches: words.every((word) => text.includes(word)) };
    }).filter((item) => item.matches).sort((a, b) => b.score - a.score);
    status.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > 20 ? ' · Showing the first 20' : ''}`
      : 'No results. Try a block name, setting or shorter phrase.';
    matches.slice(0, 20).forEach((item) => {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${item.id}`;
      const section = document.createElement('span');
      section.className = 'guide-search-section';
      section.textContent = item.section;
      const title = document.createElement('strong');
      title.textContent = item.title;
      const excerpt = document.createElement('span');
      excerpt.className = 'guide-search-excerpt';
      const text = normalize(item.text);
      const positions = words.map((word) => text.toLowerCase().indexOf(word))
        .filter((position) => position >= 0);
      const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 45);
      excerpt.textContent = `${start ? '…' : ''}${text.slice(start, start + 170)}${text.length > start + 170 ? '…' : ''}`;
      link.append(section, title, excerpt);
      row.append(link);
      results.append(row);
    });
  };

  trigger.hidden = false;
  trigger.addEventListener('click', () => {
    search();
    dialog.showModal();
    input.focus();
  });
  dialog.querySelector('.guide-search-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  input.addEventListener('input', search);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && results.firstElementChild) {
      event.preventDefault();
      results.querySelector('a').focus();
    }
  });
  dialog.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    results.querySelector('a')?.click();
  });
  results.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey) return;
    revealEntry(link.hash);
    if (mobile.matches && navigation) navigation.open = false;
    dialog.close();
  });
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
enableSidebarResize();
enableGuideSearch(revealBlock);
refreshLayout();
