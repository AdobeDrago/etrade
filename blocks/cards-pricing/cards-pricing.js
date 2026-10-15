import decorateCards from '../../scripts/card-content.js';
import decorateCardRates from '../../scripts/card-rates.js';
import { decorateAction } from '../../scripts/actions.js';

export default async function decorate(block) {
  const rates = decorateCardRates(block);
  decorateCards(block, 'cards-pricing');
  if (block.classList.contains('band')) {
    const actions = document.createElement('div');
    actions.className = 'etrade-actions cards-pricing-actions';
    // The band has one shared action area; links and tracking remain authored.
    block.querySelectorAll('.cards-pricing-actions').forEach((group) => {
      [...group.children].forEach((link) => actions.append(decorateAction(link, 'primary')));
      group.remove();
    });
    if (actions.children.length) block.append(actions);
  }
  await rates;
}
