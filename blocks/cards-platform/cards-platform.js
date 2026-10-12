import buildCards from '../../scripts/media-cards.js';

export default function decorate(block) {
  const compact = block.classList.contains('compact');
  const cards = buildCards(block, { action: compact ? 'secondary' : 'outline' });
  [...cards.children].forEach((card) => {
    const actions = card.querySelector('.cards-platform-actions');
    if (compact) {
      actions?.querySelectorAll('.etrade-action-icon path').forEach((path) => {
        path.setAttribute('d', 'm9 6-1.4 1.4L12.2 12l-4.6 4.6L9 18l6-6z');
      });
    }
    // A native stretched link preserves keyboard, new-tab and modifier-click behavior.
    if (actions?.children.length === 1) actions.firstElementChild.classList.add('cards-platform-link');
  });
}
