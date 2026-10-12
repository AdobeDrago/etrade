import buildCards from '../../scripts/media-cards.js';

export default function decorate(block) {
  buildCards(block, { icon: true });
}
