import buildCards from '../../scripts/media-cards.js';

export default function decorate(block) {
  const cards = buildCards(block);
  if (cards.children.length === 4) block.classList.add('four-up');
}
