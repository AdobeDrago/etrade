import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const desktop = window.matchMedia('(min-width: 1085px)');
// Temporary support for the previewed /nav until its authored replacement is installed.
const legacyColumnPaths = new Set([
  '/what-we-offer/our-accounts', '/platforms', '/what-we-offer/investment-choices',
  '/bank', '/planning', '/l/advice', '/why-etrade',
]);

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function button(className, label) {
  const el = element('button', className, label);
  el.type = 'button';
  return el;
}

function icon(name, className = '') {
  const paths = {
    search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    chevron: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `nav-icon ${className}`.trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name]);
  svg.append(path);
  return svg;
}

function cleanLink(link, className = '') {
  const copy = link.cloneNode(true);
  copy.className = className;
  copy.removeAttribute('role');
  copy.removeAttribute('tabindex');
  return copy;
}

function itemLabel(item) {
  const copy = item.cloneNode(true);
  copy.querySelectorAll('ul, picture, img').forEach((el) => el.remove());
  return copy.textContent.trim();
}

function normalizeTheme(value) {
  return String(value || '').trim().toLowerCase().replace(/^theme-/, '')
    .match(/^(light|dark)$/)?.[0] || '';
}

function selectBrand(section, theme) {
  const variants = [...(section?.querySelector('ul')?.children || [])];
  const match = variants.find((item) => normalizeTheme(item.querySelector('p')?.textContent)
    === theme);
  return match?.querySelector('a:has(img)') || section?.querySelector('a:has(img)');
}

function isLoginItem(item) {
  return item.querySelector(':scope > p')?.textContent.trim().toLowerCase() === 'login';
}

function isPromoItem(item) {
  return item.querySelector(':scope > p')?.textContent.trim().toLowerCase() === 'promo';
}

function isColumnItem(item) {
  return item.querySelector(':scope > p')?.textContent.trim().toLowerCase() === 'column';
}

function makePromo(item) {
  const picture = item.querySelector('picture, img');
  const link = [...item.querySelectorAll('a')]
    .filter((a) => !a.querySelector('img') && a.textContent.trim()).at(-1);
  const legacyLink = !link && !isPromoItem(item) ? item.querySelector('a:has(img)') : null;
  const card = element('article', 'nav-promo');
  const content = element('div', 'nav-promo-content');
  const title = item.querySelector('strong');
  const copy = item.cloneNode(true);
  if (isPromoItem(copy)) copy.querySelector(':scope > p').remove();
  copy.querySelectorAll('picture, img, strong').forEach((el) => el.remove());
  copy.querySelectorAll('a').forEach((a) => {
    if (legacyLink) a.replaceWith(...a.childNodes);
    else a.remove();
  });
  if (title) content.append(element('h3', '', title.textContent));
  if (copy.textContent.trim()) content.append(element('p', '', copy.textContent.trim()));
  if (link || legacyLink) {
    const cta = cleanLink(link || legacyLink, 'nav-promo-cta');
    if (legacyLink) cta.textContent = 'Learn how';
    if (title && !cta.hasAttribute('aria-label')) {
      cta.setAttribute('aria-label', `${cta.textContent.trim()}: ${title.textContent.trim()}`);
    }
    content.append(cta);
  }
  if (picture) card.append(picture.cloneNode(true));
  if (content.children.length) card.append(content);
  return card.children.length ? card : null;
}

/** Separate a list item's label from descriptions without including its child links. */
function itemParts(item) {
  const copy = item.cloneNode(true);
  if (isColumnItem(copy)) copy.querySelector(':scope > p').remove();
  copy.querySelectorAll('ul, picture, img').forEach((el) => el.remove());
  const sourceLink = copy.querySelector('a');
  const labelElement = sourceLink?.querySelector('strong') || sourceLink
    || copy.querySelector('strong, p') || copy;
  const range = document.createRange();
  range.selectNodeContents(labelElement);
  const lineBreak = labelElement.querySelector('br');
  if (lineBreak) range.setEndBefore(lineBreak);
  const label = range.toString().trim();
  const link = sourceLink ? cleanLink(sourceLink) : null;
  if (link) link.textContent = label;
  range.deleteContents();
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  copy.querySelectorAll('p').forEach((p) => p.append(' '));
  const description = copy.textContent.replace(/\s+/g, ' ').trim();
  return { link, label, description };
}

function makeMenuLink(item) {
  const { link, label, description } = itemParts(item);
  const li = element('li');
  if (link && label) li.append(link);
  else if (label) li.append(element('span', 'nav-link-label', label));
  if (description) li.append(element('p', 'nav-link-description', description));
  const nested = item.querySelector(':scope > ul');
  if (nested) {
    const list = element('ul');
    [...nested.children].forEach((child) => {
      const childLink = makeMenuLink(child);
      if (childLink) list.append(childLink);
    });
    if (list.children.length) li.append(list);
  }
  return li.children.length ? li : null;
}

/** Nested lists author columns; the imported flat list remains supported. */
function makePanel(list) {
  const panel = element('div', 'nav-panel');
  const columns = element('div', 'nav-columns');
  const promos = element('div', 'nav-promos');
  const explicitColumns = [...list.children].some((item) => isColumnItem(item)
    || item.querySelector(':scope > ul'));
  let column;
  [...list.children].forEach((item) => {
    if (isPromoItem(item) || item.querySelector('img')) {
      const promo = makePromo(item);
      if (promo) promos.append(promo);
      return;
    }
    const nested = item.querySelector(':scope > ul');
    const { link, label, description } = itemParts(item);
    const url = link ? new URL(link.href) : null;
    const path = url && !url.hash ? url.pathname : '';
    if (explicitColumns || legacyColumnPaths.has(path) || !column) {
      column = element('div', 'nav-column');
      const heading = element('h2', 'nav-column-title');
      if (link) heading.append(link);
      else heading.textContent = label;
      if (heading.textContent.trim()) column.append(heading);
      if (description) column.append(element('p', 'nav-column-description', description));
      column.append(element('ul', 'nav-column-links'));
      columns.append(column);
      if (nested) {
        [...nested.children].forEach((child) => {
          const li = makeMenuLink(child);
          if (li) column.querySelector('ul').append(li);
        });
      }
    } else {
      const li = makeMenuLink(item);
      if (li) column.querySelector('ul').append(li);
    }
  });
  if (columns.children.length) panel.append(columns);
  if (promos.children.length) panel.append(promos);
  return panel;
}

export default async function decorate(block) {
  const theme = normalizeTheme(getMetadata('header-theme'))
    || [...block.classList].map(normalizeTheme).find(Boolean)
    || getMetadata('theme').split(',').map(normalizeTheme).find(Boolean) || 'dark';
  block.classList.remove('light', 'dark', 'theme-light', 'theme-dark');
  block.classList.add(theme);
  const navPath = getMetadata('nav') || '/nav';
  let fragment = await loadFragment(navPath);
  if (!fragment && navPath === '/nav') fragment = await loadFragment('/content/nav');
  if (!fragment) return;

  // Authors can use production destinations while only this homepage exists.
  const navLinkBase = getMetadata('nav-link-base');
  if (navLinkBase) {
    try {
      const base = new URL(navLinkBase);
      if (['https:', 'http:'].includes(base.protocol)) {
        fragment.querySelectorAll('a[href]').forEach((link) => {
          const href = link.getAttribute('href');
          if (href.startsWith('/') && !href.startsWith('//')
            && new URL(href, base).pathname !== '/home') link.href = new URL(href, base).href;
        });
      }
    } catch { /* Invalid metadata leaves authored destinations untouched. */ }
  }

  const sections = [...fragment.children];
  const utilitySource = sections[0]?.querySelector('ul');
  const brandSource = selectBrand(sections[1], theme);
  const mainSource = sections[2]?.querySelector('ul');
  const ctaSource = sections[3]?.querySelector('a');
  const nav = element('nav', 'nav-shell');
  const pageMain = document.querySelector('body > main');
  if (pageMain) {
    if (!pageMain.id) pageMain.id = 'main-content';
    const skip = element('a', 'nav-skip', 'Skip to content');
    skip.href = `#${pageMain.id}`;
    skip.addEventListener('click', () => {
      pageMain.setAttribute('tabindex', '-1');
      pageMain.focus({ preventScroll: true });
    });
    nav.append(skip);
  }
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');
  const utility = element('ul', 'nav-utility');
  const bar = element('div', 'nav-bar');
  const brand = element('div', 'nav-brand');
  const drawer = element('div', 'nav-drawer');
  drawer.id = 'nav-drawer';
  const main = element('ul', 'nav-sections');
  const tools = element('div', 'nav-tools');
  const mobileUtility = element('ul', 'nav-mobile-utility');
  const disclosures = [];
  let sequence = 0;
  let openDisclosure;
  let menuOpen = false;
  let searchOpen = false;

  const setPanel = (panel, expanded) => {
    // Desktop panels stay rendered to animate out, but closed links are inert immediately.
    panel.inert = !expanded;
    panel.setAttribute('aria-hidden', String(!expanded));
    panel.hidden = !desktop.matches && !expanded;
  };

  const closeDisclosure = (restoreFocus = false) => {
    if (!openDisclosure) return;
    const { trigger, panel } = openDisclosure;
    trigger.setAttribute('aria-expanded', 'false');
    setPanel(panel, false);
    nav.classList.remove('nav-submenu-open');
    openDisclosure = null;
    if (restoreFocus) trigger.focus();
  };

  const addDisclosure = (item, panel, compact = false) => {
    const li = element('li', compact ? 'nav-utility-item' : 'nav-item');
    const label = itemLabel(item);
    const trigger = button('nav-trigger', label);
    trigger.append(icon('chevron', 'nav-chevron'));
    trigger.id = `nav-trigger-${sequence}`;
    panel.id = `nav-panel-${sequence}`;
    sequence += 1;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', trigger.id);
    setPanel(panel, false);
    const back = button('nav-back', 'Back');
    back.prepend(icon('chevron'));
    back.setAttribute('aria-label', `Back to main navigation from ${label}`);
    back.addEventListener('click', () => closeDisclosure(true));
    panel.prepend(back);
    const disclosure = { trigger, panel, compact };
    disclosures.push(disclosure);
    trigger.addEventListener('click', () => {
      const wasOpen = openDisclosure === disclosure;
      closeDisclosure();
      if (!wasOpen) {
        openDisclosure = disclosure;
        trigger.setAttribute('aria-expanded', 'true');
        setPanel(panel, true);
        if (!desktop.matches) {
          nav.classList.add('nav-submenu-open');
          drawer.scrollTop = 0;
          back.focus();
        }
      }
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && desktop.matches) {
        event.preventDefault();
        if (openDisclosure !== disclosure) trigger.click();
        panel.querySelector('a')?.focus();
      }
    });
    li.append(trigger, panel);
    return li;
  };

  if (brandSource) {
    brand.append(cleanLink(brandSource));
    const img = brand.querySelector('img');
    if (img) {
      // Preserve both palettes for the unmigrated single-logo document only.
      const legacyBrand = !sections[1]?.querySelector('ul')
        && /(?:media_1dcd507a8541accf37afc3365ca6827dd03211e40|etrade-logo-(?:light|dark)|etrade-from-morgan-stanley-logo-(?:light|dark)-theme)\.svg/.test(img.src);
      const logo = getMetadata(`header-logo-${theme}`)
        || (legacyBrand ? `${window.hlx.codeBasePath}/icons/etrade-logo-${theme}.svg` : '');
      if (logo) {
        brand.querySelectorAll('source').forEach((source) => source.remove());
        img.removeAttribute('srcset');
        img.src = logo;
      }
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    }
  }
  [...(mainSource?.children || [])].forEach((item) => {
    if (!itemLabel(item)) return;
    const list = item.querySelector(':scope > ul');
    if (list) main.append(addDisclosure(item, makePanel(list)));
    else {
      const li = element('li', 'nav-item');
      const link = item.querySelector('a');
      if (link) li.append(cleanLink(link, 'nav-link'));
      else li.textContent = itemLabel(item);
      main.append(li);
    }
  });
  const utilityItems = [...(utilitySource?.children || [])];
  const loginItem = utilityItems.find(isLoginItem);
  const authoredRoles = loginItem || sections[1]?.querySelector('ul')
    || [...(mainSource?.querySelectorAll('li') || [])].some((item) => isColumnItem(item)
      || isPromoItem(item));
  utilityItems.forEach((item) => {
    if (!itemLabel(item)) return;
    const list = item.querySelector(':scope > ul');
    if (list) {
      const panel = element('div', 'nav-panel nav-utility-panel');
      const column = element('div', 'nav-column');
      const links = list.cloneNode(true);
      links.className = 'nav-column-links';
      links.querySelectorAll('a').forEach((a) => { a.className = ''; });
      column.append(element('h2', 'nav-column-title', itemLabel(item)), links);
      panel.append(column);
      const li = addDisclosure(item, panel, true);
      utility.append(li);
    } else {
      const link = item.querySelector('a');
      if (!link?.textContent.trim()) return;
      const li = element('li', 'nav-utility-item');
      li.append(cleanLink(link));
      utility.append(li);
      if (item === loginItem || (!authoredRoles && new URL(link.href).pathname.includes('/login'))) {
        tools.append(cleanLink(link, 'nav-logon'));
      } else {
        const mobileLi = element('li');
        mobileLi.append(cleanLink(link));
        mobileUtility.append(mobileLi);
      }
    }
  });

  const searchTrigger = button('nav-search-trigger nav-icon-button');
  searchTrigger.append(icon('search'));
  searchTrigger.setAttribute('aria-label', 'Open search');
  searchTrigger.setAttribute('aria-expanded', 'false');
  searchTrigger.setAttribute('aria-controls', 'nav-search');
  const search = element('form', 'nav-search');
  search.id = 'nav-search';
  search.setAttribute('role', 'search');
  search.action = getMetadata('search-action') || 'https://us.etrade.com/search';
  search.method = 'get';
  search.hidden = true;
  const label = element('label', 'nav-sr-only', 'Search by Symbol/Keyword');
  label.htmlFor = 'nav-search-input';
  const input = element('input');
  input.id = label.htmlFor;
  input.name = 'q';
  input.type = 'search';
  input.placeholder = 'Enter keyword/symbol';
  input.required = true;
  const submit = button('nav-search-submit nav-icon-button');
  submit.append(icon('search'));
  submit.type = 'submit';
  submit.setAttribute('aria-label', 'Submit search');
  const searchClose = button('nav-search-close nav-icon-button');
  searchClose.append(icon('close'));
  searchClose.setAttribute('aria-label', 'Close search');
  search.append(label, submit, input, searchClose);

  const menu = button('nav-menu-toggle nav-icon-button');
  menu.setAttribute('aria-label', 'Open navigation');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', drawer.id);
  const cta = ctaSource?.textContent.trim() ? cleanLink(ctaSource, 'nav-cta') : null;
  if (cta) drawer.append(cta);
  drawer.prepend(main, mobileUtility);
  tools.append(searchTrigger, menu);
  const left = element('div', 'nav-left');
  const content = element('div', 'nav-content');
  content.append(drawer, search, tools);
  left.append(brand, content);
  bar.append(left);
  nav.append(utility, bar);
  block.replaceChildren(nav);
  // The global EDS header reserves 64px; this block supplies its measured height.
  const owner = block.closest('header');
  if (owner) owner.style.height = 'auto';

  const setMenu = (expanded, restoreFocus = false) => {
    closeDisclosure();
    menuOpen = expanded;
    nav.classList.toggle('nav-menu-open', expanded);
    menu.setAttribute('aria-expanded', String(expanded));
    menu.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
    drawer.hidden = !desktop.matches && !expanded;
    drawer.inert = !desktop.matches && !expanded;
    if (restoreFocus) menu.focus();
  };
  const setSearch = (expanded, restoreFocus = false) => {
    setMenu(false);
    searchOpen = expanded;
    search.hidden = !expanded;
    searchTrigger.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('nav-search-open', expanded);
    if (expanded) input.focus();
    else if (restoreFocus) searchTrigger.focus();
  };
  searchTrigger.addEventListener('click', () => setSearch(true));
  searchClose.addEventListener('click', () => setSearch(false, true));
  menu.addEventListener('click', () => {
    if (searchOpen) setSearch(false);
    setMenu(!menuOpen);
  });
  const updateLayout = () => {
    setSearch(false);
    disclosures.forEach(({ panel }) => setPanel(panel, false));
    if (cta) (desktop.matches ? bar : drawer).append(cta);
    disclosures.filter(({ compact }) => compact).forEach(({ trigger }) => {
      const li = trigger.parentElement;
      (desktop.matches ? utility : mobileUtility).append(li);
    });
  };
  desktop.addEventListener('change', updateLayout);
  updateLayout();

  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (searchOpen) setSearch(false, true);
    else if (openDisclosure) closeDisclosure(true);
    else if (menuOpen) setMenu(false, true);
  });
  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) {
      setSearch(false);
    }
  });
  nav.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !nav.contains(event.relatedTarget)) setSearch(false);
  });
}
