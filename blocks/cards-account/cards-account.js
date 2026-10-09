import decorateCardRates from '../../scripts/card-rates.js';
import { standaloneAction } from '../../scripts/actions.js';

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

    // Group CTA links into an actions row.
    const ctaParagraphs = [...body.querySelectorAll(':scope > p')].filter((p) => standaloneAction(p));
    if (ctaParagraphs.length) {
      const actions = document.createElement('div');
      actions.className = 'cards-account-actions';
      ctaParagraphs[0].before(actions);
      ctaParagraphs.forEach((p) => actions.append(p));
    }

    ul.append(li);
  });
  block.replaceChildren(ul);
  block.hidden = !ul.children.length;
  await rates;
}
