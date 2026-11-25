import loadStructuredCards from '../../scripts/structured-cards.js';
import buildCards from '../../scripts/media-cards.js';
import decorateCarousel from '../../scripts/carousel.js';

export default async function decorate(block) {
  const structured = loadStructuredCards(block);
  if (structured) await structured;
  decorateCarousel(block, buildCards(block), {
    name: 'carousel-story',
    id: 'stories',
    labels: {
      list: 'E*TRADE history stories',
      previous: 'Previous story',
      next: 'Next story',
      dots: 'Choose a story',
      dot: 'Show story',
      status: 'Stories',
    },
  });
}
