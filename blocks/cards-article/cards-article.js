import buildCards from '../../scripts/media-cards.js';

export default function decorate(block) {
  const cards = buildCards(block);
  if (cards.children.length === 4) block.classList.add('four-up');
  if (block.classList.contains('promo')) {
    [...cards.children].forEach((card) => {
      const content = document.createElement('div');
      content.className = 'cards-article-content';
      [...card.children].filter((node) => !node.classList.contains('cards-article-image'))
        .forEach((node) => content.append(node));
      card.append(content);
    });
  }
}
