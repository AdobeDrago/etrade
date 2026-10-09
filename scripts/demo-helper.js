import { rateDecimal, createBankRateRequest } from './bank-rates.js';
import { DEMO_BALANCE_KEY, readDemoBalance } from './demo-balance.js';

const OPEN_KEY = 'etrade:demo-helper-open';
const SOURCE_LABELS = {
  api: 'API response',
  manual: 'Manual',
  override: 'Author override',
  fallback: 'Fallback',
  unavailable: 'Unavailable',
  loading: 'Loading',
};

/** This presentation tool belongs to demo, never a production or other feature host. */
export function isDemoHelperHost(hostname = '') {
  return ['localhost', '127.0.0.1', '[::1]', 'demo--etrade--adobedrago.aem.page']
    .includes(hostname.toLowerCase());
}

function node(doc, tag, className, text) {
  const element = doc.createElement(tag);
  if (className) element.className = `demo-helper-${className}`;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(doc, text, className = 'button') {
  const element = node(doc, 'button', className, text);
  element.type = 'button';
  return element;
}

function money(value) {
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function featureName(block) {
  const name = block.dataset.blockName || [...block.classList].find((value) => value !== 'block');
  if (name === 'hero-dark') {
    if (!block.classList.contains('split')) return 'Homepage hero';
    if (block.classList.contains('balanced')) return 'Hero · balanced split';
    return `Hero · split${block.classList.contains('inset') ? ' with inset text' : ''}`;
  }
  return {
    'hero-light': 'Hero · light introduction',
    'cards-product': 'Product cards',
    'cards-account': 'Account cards',
    'cards-pricing': 'Pricing cards',
    'cards-award': 'Awards',
    'accordion-faq': 'FAQs',
    'welcome-hero': 'Welcome campaign and sign-in',
    'market-ticker': 'Market indices',
    'market-overview': 'Market chart and symbol search',
    'market-top-five': 'Top five lists',
    'floating-dock': 'Account quick links',
    disclosures: 'Disclosures',
    'widget-calculator': 'Savings calculator',
  }[name] || (name || 'Component').replaceAll('-', ' ');
}

export function rateConnection(doc, win) {
  try {
    const source = doc.querySelector('meta[name="bank-rates-source"]')?.content.trim().toLowerCase() || 'direct';
    const endpoint = doc.querySelector('meta[name="bank-rates-endpoint"]')?.content.trim();
    const request = createBankRateRequest({ source, endpoint }, win.location.href);
    const url = new URL(request.url);
    const sample = ['/phx/pros/apicontent/init/bankRates.json', '/phx/pros/aggregate.json']
      .includes(url.pathname) || url.pathname.startsWith('/test/fixtures/');
    return { label: sample ? 'Sample JSON' : 'Configured API', path: `${url.host}${url.pathname}`, sample };
  } catch {
    return { label: 'Invalid rate connection', path: 'Check the page’s bank-rate metadata.', sample: false };
  }
}

/** Preserve the existing userBalance contract. A reload re-renders consumed bindings. */
export function saveDemoBalance(value, win = window) {
  if (!isDemoHelperHost(win.location.hostname)) return { error: 'Demo controls are unavailable on this host.' };
  const balance = value === null ? null : rateDecimal(value);
  if (value !== null && balance === null) {
    return { error: 'Enter a non-negative balance without commas or a currency symbol.', invalid: true };
  }
  try {
    if (balance === null) win.localStorage.removeItem(DEMO_BALANCE_KEY);
    else win.localStorage.setItem(DEMO_BALANCE_KEY, balance);
  } catch {
    return { error: 'Browser storage is unavailable. The balance was not changed.' };
  }
  try { win.sessionStorage.setItem(OPEN_KEY, 'true'); } catch { /* Controls still work without persistence. */ }
  win.location.reload();
  return { balance };
}

export default function mountDemoHelper(doc = document, win = window) {
  if (!isDemoHelperHost(win.location.hostname) || doc.querySelector('.demo-helper')) return null;
  const root = doc.createElement('aside');
  root.className = 'demo-helper';
  root.setAttribute('aria-label', 'Demo helper');
  const toggle = button(doc, 'Demo controls', 'toggle');
  toggle.setAttribute('aria-controls', 'demo-helper-panel');
  const panel = node(doc, 'div', 'panel');
  panel.id = 'demo-helper-panel';
  panel.hidden = true;
  const header = node(doc, 'div', 'header');
  const heading = node(doc, 'h2', 'title', 'Demo controls');
  const close = button(doc, 'Close', 'close');
  header.append(heading, close);
  const badge = node(doc, 'p', 'badge', 'DEMO BRANCH');
  const content = node(doc, 'div', 'content');
  const balanceSection = node(doc, 'section', 'section');
  balanceSection.append(node(doc, 'h3', 'heading', 'User balance'));
  const balanceStatus = node(doc, 'p', 'muted');
  const currentBalance = () => {
    const balance = readDemoBalance(win);
    balanceStatus.textContent = balance === null ? 'Using each card’s authored balance.' : `Demo balance: ${money(balance)}`;
    return balance;
  };
  const form = node(doc, 'form', 'form');
  form.noValidate = true;
  const label = node(doc, 'label', 'label', 'Balance in USD');
  label.htmlFor = 'demo-helper-balance';
  const input = node(doc, 'input', 'input');
  input.id = label.htmlFor;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.value = currentBalance() ?? '';
  input.placeholder = 'e.g. 100000';
  input.setAttribute('aria-describedby', 'demo-helper-balance-help');
  const presetLabel = node(doc, 'label', 'label', 'Try a balance');
  const preset = node(doc, 'select', 'input');
  preset.id = 'demo-helper-preset';
  presetLabel.htmlFor = preset.id;
  const custom = node(doc, 'option', '', 'Choose a preset');
  custom.value = '';
  preset.append(custom);
  ['0', '5000', '10000', '50000', '100000', '500000'].forEach((amount) => {
    const option = node(doc, 'option', '', money(amount));
    option.value = amount;
    preset.append(option);
  });
  const help = node(doc, 'p', 'muted', 'Changes API savings and checking tiers on reload. Manual values, author overrides and CD terms stay fixed.');
  help.id = 'demo-helper-balance-help';
  const apply = button(doc, 'Apply & reload', 'primary');
  apply.type = 'submit';
  const reset = button(doc, 'Use authored balance');
  const actions = node(doc, 'div', 'actions');
  actions.append(apply, reset);
  const feedback = node(doc, 'p', 'feedback');
  feedback.setAttribute('role', 'status');
  form.append(label, input, presetLabel, preset, help, actions, feedback);
  balanceSection.append(balanceStatus, form);

  const rates = node(doc, 'section', 'section');
  rates.append(node(doc, 'h3', 'heading', 'Rate insights'));
  const connection = node(doc, 'p', 'muted');
  const rateList = node(doc, 'ul', 'list');
  rates.append(connection, rateList);
  const features = node(doc, 'section', 'section');
  features.append(node(doc, 'h3', 'heading', 'Features on this page'));
  const featureList = node(doc, 'ul', 'list');
  features.append(featureList);
  const refresh = button(doc, 'Reload page');
  const footer = node(doc, 'p', 'muted', 'Demo values are local to this browser and origin. The balance is never sent to the rate service.');
  content.append(balanceSection, rates, features, refresh, footer);
  panel.append(header, badge, content);
  const highlight = node(doc, 'div', 'highlight');
  highlight.hidden = true;
  highlight.setAttribute('aria-hidden', 'true');
  root.append(panel, toggle, highlight);
  doc.body.append(root);
  let expanded = false;
  let highlighted;
  let highlightTimer;
  let renderTimer;

  function setExpanded(value, restoreFocus = false) {
    expanded = value;
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Hide demo controls' : 'Demo controls';
    try {
      win.sessionStorage.setItem(OPEN_KEY, String(expanded));
    } catch { /* Optional persistence. */ }
    if (restoreFocus) toggle.focus();
  }

  function positionHighlight() {
    if (!highlighted?.isConnected) { highlight.hidden = true; return; }
    const rect = highlighted.getBoundingClientRect();
    Object.assign(highlight.style, {
      top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    });
  }

  function locate(target) {
    setExpanded(false, true);
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    highlighted = target;
    highlight.hidden = false;
    positionHighlight();
    win.clearTimeout(highlightTimer);
    highlightTimer = win.setTimeout(() => { highlight.hidden = true; highlighted = null; }, 4000);
  }

  function item(list, title, detail, target, warning = false) {
    const row = node(doc, 'li', warning ? 'item warning' : 'item');
    // Each insight can locate its corresponding content without rewriting it.
    const locateButton = button(doc, title, 'locate');
    locateButton.setAttribute('aria-label', `Locate ${title}`);
    locateButton.addEventListener('click', () => locate(target));
    row.append(locateButton, node(doc, 'p', 'muted', detail));
    list.append(row);
  }

  function render() {
    if (rateList.contains(doc.activeElement) || featureList.contains(doc.activeElement)) return;
    rateList.replaceChildren();
    featureList.replaceChildren();
    const rateConfig = rateConnection(doc, win);
    connection.textContent = `${rateConfig.label} · ${rateConfig.path}`;
    const markers = [...doc.querySelectorAll('main [data-rate-name]')];
    if (!markers.length) rateList.append(node(doc, 'li', 'empty', 'No dynamic rate bindings are authored on this page.'));
    markers.forEach((marker) => {
      const card = marker.closest('li') || marker.closest('.block') || marker;
      const title = card.querySelector('h2, h3, h4')?.textContent.trim() || marker.dataset.rateName;
      let source = SOURCE_LABELS[marker.dataset.rateSource] || 'Pending';
      if (marker.dataset.rateSource === 'api' && rateConfig.sample) source = 'Sample response';
      const details = [`${marker.textContent} · ${source}`];
      if (marker.dataset.rateBalance !== undefined) {
        details.push(`${money(marker.dataset.rateBalance)} · ${marker.dataset.rateBalanceSource === 'demo' ? 'demo' : 'authored'} balance`);
      }
      if (marker.dataset.rateFetchedAt) {
        const time = new Date(marker.dataset.rateFetchedAt);
        if (Number.isFinite(time.getTime())) details.push(`Fetched ${time.toLocaleTimeString('en-US')}`);
      }
      if (marker.dataset.rateError) details.push(`Reason: ${marker.dataset.rateError}`);
      item(rateList, title, details.join(' · '), card, !!marker.dataset.rateError);
    });
    const blocks = [...doc.querySelectorAll('main .block')];
    if (!blocks.length) featureList.append(node(doc, 'li', 'empty', 'No blocks found on this page yet.'));
    blocks.forEach((block) => {
      const state = block.dataset.marketState;
      let labelText = block.dataset.blockStatus === 'loaded' ? 'Ready' : 'Loading component';
      if (state) {
        labelText = {
          sample: 'Sample data', loaded: 'Data loaded', unavailable: 'Data unavailable', loading: 'Loading data',
        }[state] || state;
      }
      const details = [labelText];
      if (block.querySelector('.hero-dark-offer')) details.push('Authored offer included');
      if (block.dataset.marketError) details.push(`Reason: ${block.dataset.marketError}`);
      if (block.dataset.disclaimerState === 'missing') details.push('Disclaimer not authored');
      item(featureList, featureName(block), details.join(' · '), block, state === 'unavailable');
    });
  }

  function position() {
    const dock = doc.querySelector('.floating-dock-bar');
    const rect = dock?.getBoundingClientRect();
    const dockLinks = dock?.querySelector('.floating-dock-secondary:not([hidden])');
    const top = Math.min(
      rect?.top ?? win.innerHeight,
      dockLinks?.getBoundingClientRect().top ?? win.innerHeight,
    );
    const bottom = rect?.height ? Math.max(16, win.innerHeight - top + 12) : 16;
    root.style.setProperty('--demo-helper-bottom', `${bottom}px`);
    positionHighlight();
  }

  function scheduleRender() {
    win.clearTimeout(renderTimer);
    renderTimer = win.setTimeout(() => { position(); render(); }, 100);
  }

  toggle.addEventListener('click', () => {
    setExpanded(!expanded);
    if (expanded) { render(); input.focus(); }
  });
  close.addEventListener('click', () => setExpanded(false, true));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); setExpanded(false, true); }
  });
  root.addEventListener('focusout', scheduleRender);
  doc.addEventListener('focusin', (event) => {
    if (expanded && !root.contains(event.target)) setExpanded(false);
  });
  input.addEventListener('input', () => { input.setCustomValidity(''); feedback.textContent = ''; });
  preset.addEventListener('change', () => {
    if (preset.value) {
      input.value = preset.value;
      input.setCustomValidity('');
      feedback.textContent = '';
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = saveDemoBalance(input.value, win);
    if (result.error) {
      feedback.textContent = result.error;
      if (result.invalid) { input.setCustomValidity(result.error); input.reportValidity(); }
    }
  });
  reset.addEventListener('click', () => {
    const result = saveDemoBalance(null, win);
    if (result.error) feedback.textContent = result.error;
  });
  refresh.addEventListener('click', () => win.location.reload());
  doc.addEventListener('bank-rates:updated', scheduleRender);
  const main = doc.querySelector('main');
  if (main) {
    new win.MutationObserver(scheduleRender).observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-market-state', 'data-market-error', 'data-block-status', 'data-disclaimer-state', 'data-rate-source', 'data-rate-error', 'aria-expanded'],
    });
  }
  if (win.ResizeObserver) new win.ResizeObserver(position).observe(doc.body);
  win.addEventListener('resize', position);
  win.addEventListener('scroll', positionHighlight, { passive: true });
  win.addEventListener('storage', (event) => {
    if (event.key !== DEMO_BALANCE_KEY && event.key !== null) return;
    const balance = currentBalance();
    if (doc.activeElement !== input) input.value = balance ?? '';
    feedback.textContent = 'Balance changed in another tab. Reload this page to apply it.';
  });
  let storedOpen = false;
  try { storedOpen = win.sessionStorage.getItem(OPEN_KEY) === 'true'; } catch { /* Start collapsed. */ }
  setExpanded(storedOpen);
  render();
  position();
  return root;
}
