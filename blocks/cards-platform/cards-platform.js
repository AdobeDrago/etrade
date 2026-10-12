import buildCards from '../../scripts/media-cards.js';

export default function decorate(block) {
  const cards = buildCards(block, { action: 'outline' });
  [...cards.children].forEach((card) => {
    const actions = card.querySelector('.cards-platform-actions');
    // A native stretched link preserves keyboard, new-tab and modifier-click behavior.
    if (actions?.children.length === 1) actions.firstElementChild.classList.add('cards-platform-link');
  });
}
