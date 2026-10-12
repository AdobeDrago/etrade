import decorateCardRates from '../../scripts/card-rates.js';
import { decorateAction, standaloneAction } from '../../scripts/actions.js';
import { mergeCells } from '../../scripts/media-cards.js';

let instance = 0;

function decorateCards(panel) {
  let cards = [...panel.querySelectorAll('.card')];
  let grid = cards[0]?.parentElement;
  if (!cards.length) {
    grid = [...panel.querySelectorAll(':scope > ul')].find((list) => [...list.children].every((card) => card.querySelector('h3')));
    cards = grid ? [...grid.children] : [];
  }
  // Legacy imported panels flatten account cards into consecutive H3 groups.
  if (!cards.length && panel.querySelector(':scope > h3')) {
    grid = document.createElement('ul');
    let card;
    [...panel.children].forEach((node) => {
      if (node.tagName === 'H3') {
        card = document.createElement('li');
        grid.append(card);
      }
      if (card) card.append(node);
    });
    cards = [...grid.children];
    panel.append(grid);
  }
  if (!cards.length) return;
  grid.classList.add('tabs-accounts-cards');
  cards.forEach((card) => {
    card.classList.add('tabs-accounts-card');
    const actions = document.createElement('div');
    actions.className = 'etrade-actions tabs-accounts-actions';
    [...card.querySelectorAll('p')].forEach((paragraph) => {
      const link = standaloneAction(paragraph);
      if (!link) return;
      decorateAction(link, actions.children.length ? 'outline' : 'secondary', 'tabs-accounts');
      actions.append(link);
      paragraph.remove();
    });
    // Older imports retain the card-footer anchors without paragraph wrappers.
    card.querySelectorAll('.card-footer a[href]').forEach((link) => {
      decorateAction(link, actions.children.length ? 'outline' : 'secondary', 'tabs-accounts');
      actions.append(link);
    });
    if (actions.children.length) card.append(actions);
  });
}

export default async function decorate(block) {
  const rates = decorateCardRates(block);
  instance += 1;
  const tablist = document.createElement('div');
  tablist.className = 'tabs-accounts-list';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Account categories');
  const mobile = document.createElement('label');
  mobile.className = 'tabs-accounts-mobile';
  mobile.textContent = 'Account category';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Account category');
  mobile.append(select);
  const panels = [];
  const buttons = [];
  function activate(index, focus = false) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', i === index);
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    select.value = String(index);
    if (focus) buttons[index].focus();
  }
  [...block.children].forEach((row) => {
    const label = row.firstElementChild?.textContent.trim();
    if (!label || row.children.length < 2) return;
    const index = panels.length;
    row.firstElementChild.remove();
    const panel = document.createElement('div');
    panel.className = 'tabs-accounts-panel';
    panel.id = `accounts-${instance}-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `accounts-${instance}-tab-${index}`);
    panel.tabIndex = 0;
    mergeCells(row, panel);
    decorateCards(panel);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tabs-accounts-tab';
    button.id = `accounts-${instance}-tab-${index}`;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => activate(index));
    button.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') target = (index + buttons.length - 1) % buttons.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = buttons.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      activate(target, true);
    });
    const option = document.createElement('option');
    option.value = index;
    option.textContent = label;
    select.append(option);
    tablist.append(button);
    panels.push(panel);
    buttons.push(button);
  });
  select.addEventListener('change', () => activate(Number(select.value)));
  block.replaceChildren(mobile, tablist, ...panels);
  if (panels.length) activate(0);
  block.hidden = !panels.length;
  await rates;
}
