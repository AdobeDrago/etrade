/*
 * carousel-story — horizontally scrolling carousel of story cards, with prev/next
 * controls. Each row becomes one card slide.
 *
 * Expected authored structure (one row per card):
 *   [ image (optional), heading, description paragraph(s), link(s) ]
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const slides = document.createElement('ul');
  slides.className = 'carousel-story-slides';

  [...block.children].forEach((row) => {
    const slide = document.createElement('li');
    slide.className = 'carousel-story-slide';
    while (row.firstElementChild) slide.append(row.firstElementChild);
    slides.append(slide);
  });

  slides.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '600' }])));

  const container = document.createElement('div');
  container.className = 'carousel-story-container';
  container.append(slides);

  // Prev/next controls.
  const nav = document.createElement('div');
  nav.className = 'carousel-story-nav';
  nav.innerHTML = `
    <button type="button" class="carousel-story-prev" aria-label="Previous"></button>
    <button type="button" class="carousel-story-next" aria-label="Next"></button>`;

  const scrollByCard = (dir) => {
    const first = slides.querySelector('.carousel-story-slide');
    const amount = first ? first.getBoundingClientRect().width + 24 : 300;
    slides.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };
  nav.querySelector('.carousel-story-prev').addEventListener('click', () => scrollByCard(-1));
  nav.querySelector('.carousel-story-next').addEventListener('click', () => scrollByCard(1));

  block.replaceChildren(container, nav);
}
