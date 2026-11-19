import loadStructuredCards from '../../scripts/structured-cards.js';
import decorateCards from '../../scripts/card-content.js';
import decorateCardRates from '../../scripts/card-rates.js';

export default async function decorate(block) {
  const structured = loadStructuredCards(block);
  if (structured) await structured;
  const rates = decorateCardRates(block);
  decorateCards(block, 'cards-product');
  await rates;
}
