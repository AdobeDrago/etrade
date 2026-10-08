import { decorateAction, standaloneAction } from '../../scripts/actions.js';

let sequence = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = `widget-calculator-${className}`;
  if (text) node.textContent = text;
  return node;
}

function parseAmount(text) {
  const value = String(text).trim();
  if (!/^\$?\s*\d[\d,]*(?:\.\d+)?\+?$/.test(value)) return null;
  const number = Number(value.replace(/[$,\s+]/g, ''));
  return Number.isSafeInteger(number) ? number : null;
}

function currency(value) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function shortCurrency(value) {
  if (value >= 1000000) return `$${value / 1000000}M`;
  if (value >= 1000) return `$${value / 1000}K`;
  return currency(value);
}

async function fallbackCredits() {
  try {
    const response = await fetch(new URL('./tiers.json', import.meta.url));
    if (!response.ok) return new Map();
    const { tiers } = await response.json();
    return new Map(tiers.map(({ funding, credit }) => [funding, credit]));
  } catch {
    return new Map();
  }
}

function authoredContent(cell, tag, className) {
  const node = element(tag, className);
  if (/^H[1-6]$/.test(tag.toUpperCase())) node.textContent = cell.textContent.trim();
  else {
    const source = tag === 'p' && cell.children.length === 1 && cell.firstElementChild.tagName === 'P'
      ? cell.firstElementChild : cell;
    node.append(...[...source.childNodes].map((child) => child.cloneNode(true)));
  }
  return node;
}

// The imported home page keeps the offer copy immediately before the block.
// Move that authored content into the cards without changing its text or links.
function adjacentContent(block, content) {
  const previous = block.parentElement.previousElementSibling;
  if (!previous?.classList.contains('default-content-wrapper')) return;
  const nodes = [...previous.children];
  if (content.heading || !nodes.some((node) => /^H[34]$/.test(node.tagName))) {
    if (nodes.some((node) => node.tagName === 'H2') && !nodes.some((node) => /^H[34]$/.test(node.tagName))) {
      content.lead = element('div', 'heading');
      content.lead.append(...nodes);
    }
    return;
  }
  const headingIndex = nodes.findLastIndex((node) => /^H[34]$/.test(node.tagName));
  if (headingIndex < 0) return;
  [content.heading] = nodes.slice(headingIndex, headingIndex + 1);
  const descriptions = [];
  const legacy = {};
  nodes.slice(headingIndex + 1).forEach((node) => {
    const link = standaloneAction(node);
    if (link) {
      if (!legacy.primary) legacy.primary = node;
      else if (!legacy.secondary) legacy.secondary = node;
      else descriptions.push(node);
    } else if (/^promo code\s*:/i.test(node.textContent.trim())) legacy.code = node;
    else descriptions.push(node);
  });
  if (descriptions.length) {
    legacy.description = element('div', 'description');
    legacy.description.append(...descriptions);
  }
  Object.entries(legacy).forEach(([role, node]) => {
    if (!content[role]) content[role] = node;
    else node.remove();
  });
  const lead = nodes.slice(0, headingIndex);
  if (lead.some((node) => node.tagName === 'H2')) {
    content.lead = element('div', 'heading');
    content.lead.append(...lead);
  }
}

function promoCard(content) {
  const card = element('div', 'promo');
  if (content.heading) {
    content.heading.classList.add('widget-calculator-promo-heading');
    card.append(content.heading);
  }
  if (content.description) {
    content.description.classList.add('widget-calculator-description');
    card.append(content.description);
  }
  if (content.code) {
    content.code.classList.add('widget-calculator-code');
    card.append(content.code);
  }
  const actions = element('div', 'actions');
  actions.classList.add('etrade-actions');
  ['primary', 'secondary'].forEach((role) => {
    const source = content[role];
    const link = source?.matches('a') ? source : source && standaloneAction(source);
    if (!link) return;
    decorateAction(link, role, 'widget-calculator');
    const action = element('div', 'action');
    action.append(link);
    if (source !== link) source.remove();
    actions.append(action);
  });
  if (actions.children.length) card.append(actions);
  return card.children.length ? card : null;
}

function fundingDropdown(id, label, items, hasDisclaimer, onChange) {
  const selector = element('div', 'selector');
  const selectLabel = element('label', 'select-label', label);
  selectLabel.id = `${id}-select-label`;
  selectLabel.htmlFor = `${id}-select`;
  const dropdown = element('div', 'dropdown');
  const trigger = element('button', 'select');
  trigger.type = 'button';
  trigger.id = selectLabel.htmlFor;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-labelledby', selectLabel.id);
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${id}-options`);
  if (hasDisclaimer) trigger.setAttribute('aria-describedby', `${id}-disclaimer`);
  const value = element('span', 'selected-value', 'Select');
  trigger.append(value);
  const list = element('ul', 'options');
  list.id = `${id}-options`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-labelledby', selectLabel.id);
  list.hidden = true;
  const options = items.map((text, index) => {
    const option = element('li', 'option', text);
    option.id = `${id}-option-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    list.append(option);
    return option;
  });
  dropdown.append(trigger, list);
  selector.append(selectLabel, dropdown);
  let selected = -1;
  let active = 0;
  let search = '';
  let lastTyped = 0;

  const close = () => {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    options.forEach((option) => option.classList.remove('widget-calculator-option-active'));
    search = '';
  };
  const highlight = (index, showFocus = true) => {
    active = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, position) => {
      option.classList.toggle('widget-calculator-option-active', showFocus && position === active);
    });
    trigger.setAttribute('aria-activedescendant', options[active].id);
    options[active].scrollIntoView({ block: 'nearest' });
  };
  const open = (showFocus = false) => {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    highlight(selected < 0 ? 0 : selected, showFocus);
  };
  const setSelection = (index) => {
    selected = index;
    value.textContent = items[index];
    options.forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
  };
  const commit = () => {
    setSelection(active);
    onChange(active);
    close();
  };
  trigger.addEventListener('click', () => {
    if (list.hidden) open();
    else close();
  });
  trigger.addEventListener('keydown', (event) => {
    const { key } = event;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      const wasClosed = list.hidden;
      if (wasClosed) open(true);
      if (key === 'Home') highlight(0);
      else if (key === 'End') highlight(options.length - 1);
      else if (!wasClosed) highlight(active + (key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (list.hidden) open(true);
      else commit();
    } else if (key === 'Escape') {
      if (!list.hidden) event.preventDefault();
      close();
    } else if (key === 'Tab') {
      if (!list.hidden) commit();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      search = now - lastTyped > 1000 ? key : search + key;
      lastTyped = now;
      if (list.hidden) open(true);
      const index = items.findIndex((text) => text.replace(/^\$/, '').startsWith(search.replace(/^\$/, '')));
      if (index >= 0) highlight(index);
    }
  });
  options.forEach((option, index) => {
    // Keep DOM focus on the combobox until the option click has committed.
    option.addEventListener('pointerdown', (event) => event.preventDefault());
    option.addEventListener('click', () => {
      active = index;
      commit();
      trigger.focus({ preventScroll: true });
    });
  });
  selector.addEventListener('focusout', (event) => {
    if (!selector.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!selector.contains(event.target)) close();
  });
  return { selector, close, setSelection };
}

export default async function decorate(block) {
  const content = {};
  const labels = { funding: 'Deposit amount*', credit: 'Cash credit', select: 'Funding amount' };
  const roles = {
    heading: ['heading', 'h3', 'promo-heading'],
    description: ['description', 'div', 'description'],
    'promo code': ['code', 'p', 'code'],
    'primary cta': ['primary', 'div', 'action'],
    'secondary cta': ['secondary', 'div', 'action'],
    disclaimer: ['disclaimer', 'div', 'disclaimer'],
  };
  const labelRoles = { 'funding label': 'funding', 'credit label': 'credit', 'select label': 'select' };
  let legacyLabels = false;
  const tiers = [];
  [...block.children].forEach((row, rowIndex) => {
    const [first, second] = row.children;
    if (!first) return;
    const funding = parseAmount(first.textContent);
    if (funding > 0) {
      const text = second?.textContent.trim() || '';
      tiers.push({ funding, credit: text ? parseAmount(text) ?? NaN : null });
      return;
    }
    const key = first.textContent.trim().toLowerCase();
    if (roles[key]) {
      if (second?.textContent.trim()) {
        const [role, tag, className] = roles[key];
        content[role] = authoredContent(second, tag, className);
      }
      return;
    }
    if (labelRoles[key]) {
      const name = labelRoles[key];
      labels[name] = second?.textContent.trim() || labels[name];
      return;
    }
    if (rowIndex === 0 && funding === null && second?.textContent.trim()
      && !/^[-+$\d]/.test(first.textContent.trim())) {
      labels.funding = first.textContent.trim();
      labels.credit = second.textContent.trim();
      legacyLabels = true;
    } else if (legacyLabels && rowIndex === 1 && !content.disclaimer
      && funding === null && !second?.textContent.trim()
      && first.textContent.trim() && !/^[-+$\d]/.test(first.textContent.trim())) {
      content.disclaimer = authoredContent(first, 'div', 'disclaimer');
    }
  });

  const defaults = tiers.some((tier) => tier.credit === null) ? await fallbackCredits() : new Map();
  const unique = new Map();
  tiers.forEach(({ funding, credit }) => {
    const amount = credit ?? defaults.get(funding);
    if (Number.isFinite(amount) && amount >= 0) unique.set(funding, { funding, credit: amount });
  });
  const amounts = [...unique.values()].sort((a, b) => a.funding - b.funding);
  if (!amounts.length) return;

  adjacentContent(block, content);
  const previous = block.parentElement.previousElementSibling;
  const layout = element('div', 'layout');
  const promo = promoCard(content);
  block.replaceChildren();
  if (content.lead) block.append(content.lead);
  if (promo) layout.append(promo);
  else layout.classList.add('widget-calculator-standalone');
  if (previous?.classList.contains('default-content-wrapper') && !previous.children.length) previous.remove();

  const id = `widget-calculator-${sequence}`;
  sequence += 1;
  const control = element('div', 'control');
  const stats = element('dl', 'stats');
  const values = {};
  ['credit', 'funding'].forEach((name) => {
    const row = element('div', 'stat');
    const label = element('dt', 'label', labels[name]);
    const value = element('dd', name);
    values[name] = value;
    row.append(label, value);
    stats.append(row);
  });
  control.append(stats);

  const range = element('div', 'range');
  const rangeControl = element('div', 'range-control');
  const rangeLabel = element('label', 'sr-only', labels.select);
  rangeLabel.htmlFor = `${id}-slider`;
  const track = element('div', 'track');
  track.setAttribute('aria-hidden', 'true');
  const slider = element('input', 'slider');
  slider.type = 'range';
  slider.id = rangeLabel.htmlFor;
  slider.min = '0';
  slider.max = String(amounts.length);
  slider.step = '1';
  slider.value = '0';
  if (content.disclaimer) slider.setAttribute('aria-describedby', `${id}-disclaimer`);
  const markings = element('div', 'markings');
  markings.setAttribute('aria-hidden', 'true');
  const stride = Math.max(1, Math.ceil(amounts.length / 5));
  for (let index = 0; index <= amounts.length; index += 1) {
    const mark = element('span', 'tick');
    mark.style.left = `${(index / amounts.length) * 100}%`;
    if (index % stride === 0 || index === amounts.length) {
      mark.classList.add('widget-calculator-tick-labelled');
      const tier = amounts[Math.min(index, amounts.length - 1)];
      mark.append(element('span', 'tick-label', `${shortCurrency(tier.funding)}${index === amounts.length ? '+' : ''}`));
    }
    markings.append(mark);
  }
  rangeControl.append(track, slider, markings);
  range.append(rangeLabel, rangeControl);
  control.append(range);

  const status = element('div', 'sr-only');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  const update = (index, announce = false) => {
    const tier = amounts[Math.min(index, amounts.length - 1)];
    const deposit = `${currency(tier.funding)}${index === amounts.length ? '+' : ''}`;
    values.funding.textContent = deposit;
    values.credit.textContent = currency(tier.credit);
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', `${labels.funding.replace(/\*$/, '')}: ${deposit}, ${labels.credit}: ${currency(tier.credit)}`);
    rangeControl.style.setProperty('--funding-progress', `${(index / amounts.length) * 100}%`);
    status.textContent = announce ? slider.getAttribute('aria-valuetext') : '';
  };
  const optionLabels = amounts.map((tier, index) => {
    const next = amounts[index + 1];
    return next ? `${currency(tier.funding)} - ${currency(next.funding - 1)}` : `${currency(tier.funding)}+`;
  });
  const mobile = window.matchMedia('(width < 768px)');
  const dropdown = fundingDropdown(
    id,
    labels.select,
    optionLabels,
    !!content.disclaimer,
    (index) => update(index === amounts.length - 1 ? amounts.length : index, true),
  );
  control.append(dropdown.selector);
  if (content.disclaimer) {
    content.disclaimer.id = `${id}-disclaimer`;
    control.append(content.disclaimer);
  }
  control.append(status);
  layout.append(control);
  block.append(layout);
  slider.addEventListener('input', () => {
    const index = Number(slider.value);
    dropdown.setSelection(Math.min(index, amounts.length - 1));
    update(index);
  });
  mobile.addEventListener('change', () => {
    dropdown.close();
    // The mobile final option represents the open-ended highest funding tier.
    if (mobile.matches && Number(slider.value) === amounts.length - 1) update(amounts.length);
  });
  update(0);
}
