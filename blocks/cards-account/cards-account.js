import decorateCardRates from '../../scripts/card-rates.js';
import { groupActions } from '../../scripts/actions.js';

/**
 * cards-account — grid of account cards, each with a top accent bar, an account
 * name, a short label/description, and one or two CTA links. No images.
 *
 * Expected authored structure (one row per card, single column):
 *   [ heading (account name), label/description paragraph(s), CTA link(s) ]
 */
export default async function decorate(block) {
  const rates = decorateCardRates(block);
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.some((cell) => cell.textContent.trim() || cell.querySelector('img, picture, .icon'))) return;
    const li = document.createElement('li');
    const body = document.createElement('div');
    body.className = 'cards-account-body';
    cells.forEach((cell) => body.append(...cell.childNodes));
    li.append(body);

    const actions = groupActions(body, 'cards-account', 'outline');
    if (actions.children.length) li.append(actions);

    ul.append(li);
  });
  block.replaceChildren(ul);
  block.hidden = !ul.children.length;
  await rates;
}
