import loadStructuredCards from '../../scripts/structured-cards.js';
import buildCards from '../../scripts/media-cards.js';

export default async function decorate(block) {
  const structured = loadStructuredCards(block);
  if (structured) await structured;
  buildCards(block, { numbered: true });
}
