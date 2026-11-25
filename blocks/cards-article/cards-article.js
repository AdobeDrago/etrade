import loadStructuredCards from '../../scripts/structured-cards.js';
import buildCards from '../../scripts/media-cards.js';
import decorateCarousel from '../../scripts/carousel.js';

export default async function decorate(block) {
  const structured = loadStructuredCards(block);
  if (structured) await structured;
  const cards = buildCards(block);
  const carousel = block.classList.contains('carousel');
  if (cards.children.length === 4 && !carousel) block.classList.add('four-up');
  if (block.classList.contains('promo')) {
    [...cards.children].forEach((card) => {
      const content = document.createElement('div');
      content.className = 'cards-article-content';
      [...card.children].filter((node) => !node.classList.contains('cards-article-image'))
        .forEach((node) => content.append(node));
      card.append(content);
    });
  }
  if (carousel) {
    const heading = block.closest('.section')?.querySelector('.default-content-wrapper > h2');
    decorateCarousel(block, cards, {
      name: 'cards-article',
      id: 'articles',
      labels: {
        list: heading?.textContent.trim() || 'Articles',
        previous: 'Previous article',
        next: 'Next article',
        dots: 'Choose an article',
        dot: 'Show article',
        status: 'Articles',
      },
    });
  }
}
