import { decorateAction, standaloneAction } from './actions.js';

/** Preserve authored rich text; give values, headings, and actions explicit roles. */
export default function decorateCards(block, name) {
  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.some((cell) => cell.textContent.trim() || cell.querySelector('img, picture, .icon'))) return;
    const item = document.createElement('li');
    const body = document.createElement('div');
    body.className = `${name}-body`;
    cells.forEach((cell) => body.append(...cell.childNodes));
    const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && heading.tagName !== 'H3') {
      const replacement = document.createElement('h3');
      [...heading.attributes].forEach(({ name: key, value }) => {
        replacement.setAttribute(key, value);
      });
      if (heading.tagName === 'H4') replacement.classList.add(`${name}-compact-title`);
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);
    }
    const first = body.firstElementChild;
    if (first?.matches('p') && /^\s*\$?[\d,.]+%?\s*$/.test(first.textContent)) {
      first.classList.add(`${name}-value`);
      item.classList.add(`${name}-has-value`);
    }
    const rate = body.querySelector('h4, h5, h6');
    if (rate) rate.classList.add(`${name}-rate`);
    const actions = document.createElement('div');
    actions.className = `etrade-actions ${name}-actions`;
    [...body.querySelectorAll(':scope > p')].forEach((paragraph) => {
      const action = standaloneAction(paragraph);
      if (!action) return;
      actions.append(decorateAction(action, block.classList.contains('text-links') ? 'secondary' : 'outline'));
      paragraph.remove();
    });
    item.append(body);
    if (actions.children.length) item.append(actions);
    list.append(item);
  });
  block.replaceChildren(list);
  block.hidden = !list.children.length;
}
