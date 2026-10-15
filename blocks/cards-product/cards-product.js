import decorateCards from '../../scripts/card-content.js';
import decorateCardRates from '../../scripts/card-rates.js';

export default async function decorate(block) {
  const rates = decorateCardRates(block);
  decorateCards(block, 'cards-product');
  await rates;
}
