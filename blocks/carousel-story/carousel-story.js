import buildCards from '../../scripts/media-cards.js';

let instance = 0;

export default function decorate(block) {
  const slides = buildCards(block);
  const cards = [...slides.children];
  if (!cards.length) return;
  instance += 1;
  slides.className = 'carousel-story-slides';
  slides.id = `stories-${instance}`;
  slides.tabIndex = 0;
  slides.setAttribute('aria-label', 'E*TRADE history stories');
  const nav = document.createElement('div');
  nav.className = 'carousel-story-nav';
  const previous = document.createElement('button');
  const next = document.createElement('button');
  [previous, next].forEach((button, i) => {
    button.type = 'button';
    button.className = `carousel-story-${i ? 'next' : 'prev'}`;
    button.setAttribute('aria-label', `${i ? 'Next' : 'Previous'} story`);
    button.setAttribute('aria-controls', slides.id);
    nav.append(button);
  });
  const dots = document.createElement('div');
  dots.className = 'carousel-story-dots';
  dots.setAttribute('aria-label', 'Choose a story');
  const status = document.createElement('p');
  status.className = 'carousel-story-status';
  status.setAttribute('role', 'status');
  let current = 0;
  let requested;
  const offset = (index) => cards[index].offsetLeft - cards[0].offsetLeft;
  const maxScroll = () => Math.max(0, slides.scrollWidth - slides.clientWidth);
  const go = (index) => {
    const target = Math.max(0, Math.min(cards.length - 1, index));
    requested = target;
    slides.scrollTo({
      left: Math.min(maxScroll(), offset(target)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  cards.forEach((card, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show story ${index + 1}`);
    dot.setAttribute('aria-controls', slides.id);
    dot.addEventListener('click', () => go(index));
    dots.append(dot);
  });
  const update = () => {
    const left = slides.scrollLeft;
    current = cards.reduce((nearest, card, i) => (Math.abs(offset(i) - left)
      < Math.abs(offset(nearest) - left) ? i : nearest), 0);
    const requestedOffset = requested === undefined
      ? null : Math.min(maxScroll(), offset(requested));
    const selected = requestedOffset !== null && Math.abs(requestedOffset - left) <= 1
      ? requested : current;
    previous.disabled = left <= 1;
    next.disabled = left >= maxScroll() - 1;
    [...dots.children].forEach((dot, index) => dot.setAttribute('aria-current', index === selected ? 'true' : 'false'));
    const lastVisible = cards.reduce((last, card, i) => (
      offset(i) < left + slides.clientWidth - 1 ? i : last), current);
    status.textContent = `Stories ${current + 1}${lastVisible > current ? `–${lastVisible + 1}` : ''} of ${cards.length}`;
    nav.hidden = maxScroll() <= 1;
    dots.hidden = maxScroll() <= 1;
  };
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  slides.addEventListener('keydown', (event) => {
    if (event.target !== slides) return;
    let target;
    if (event.key === 'ArrowLeft') target = current - 1;
    if (event.key === 'ArrowRight') target = current + 1;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = cards.length - 1;
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  });
  slides.addEventListener('scroll', update, { passive: true });
  block.replaceChildren(nav, slides, dots, status);
  const observer = new ResizeObserver(update);
  observer.observe(slides);
  update();
}
