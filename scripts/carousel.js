let instance = 0;

/** Material "keyboard_arrow" chevrons, matching the icons on the original site. */
const ARROWS = [
  'M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z',
  'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
];

function arrow(name, path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `${name}-arrow`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = document.createElementNS(svg.namespaceURI, 'path');
  shape.setAttribute('d', path);
  svg.append(shape);
  return svg;
}

/**
 * Turns a list of cards into a native scroll-snap carousel with Previous/Next buttons,
 * one dot per card, a visually hidden status and Left/Right/Home/End keys on the list.
 * Classes are prefixed with `name`; the block owns all styling.
 * @param {Element} block Block element; its children are replaced by nav, list, dots, status.
 * @param {HTMLElement} slides List whose element children are the cards.
 * @param {object} options
 * @param {string} options.name Class prefix, normally the block name.
 * @param {string} options.id Prefix for the list ID referenced by the controls.
 * @param {object} options.labels list, previous, next, dots, dot (prefix), status (noun).
 * @returns {HTMLElement|null} The list, or null when there are no cards.
 */
export default function decorateCarousel(block, slides, { name, id, labels }) {
  const cards = [...slides.children];
  if (!cards.length) return null;
  instance += 1;
  slides.className = `${name}-slides`;
  slides.id = `${id}-${instance}`;
  slides.tabIndex = 0;
  slides.setAttribute('aria-label', labels.list);
  const nav = document.createElement('div');
  nav.className = `${name}-nav`;
  const previous = document.createElement('button');
  const next = document.createElement('button');
  [previous, next].forEach((button, i) => {
    button.type = 'button';
    button.className = `${name}-${i ? 'next' : 'prev'}`;
    button.setAttribute('aria-label', i ? labels.next : labels.previous);
    button.setAttribute('aria-controls', slides.id);
    button.append(arrow(name, ARROWS[i]));
    nav.append(button);
  });
  const dots = document.createElement('div');
  dots.className = `${name}-dots`;
  dots.setAttribute('aria-label', labels.dots);
  const status = document.createElement('p');
  status.className = `${name}-status`;
  status.setAttribute('role', 'status');
  let current = 0;
  let requested;
  let navigating = false;
  const offset = (index) => cards[index].offsetLeft - cards[0].offsetLeft;
  const maxScroll = () => Math.max(0, slides.scrollWidth - slides.clientWidth);
  const update = () => {
    const left = slides.scrollLeft;
    current = cards.reduce((nearest, card, i) => (Math.abs(offset(i) - left)
      < Math.abs(offset(nearest) - left) ? i : nearest), 0);
    const requestedOffset = requested === undefined
      ? null : Math.min(maxScroll(), offset(requested));
    const selected = requestedOffset !== null && Math.abs(requestedOffset - left) <= 1
      ? requested : current;
    if (selected === requested) navigating = false;
    previous.disabled = left <= 1;
    next.disabled = left >= maxScroll() - 1;
    [...dots.children].forEach((dot, index) => dot.setAttribute('aria-current', index === selected ? 'true' : 'false'));
    const lastVisible = cards.reduce((last, card, i) => (
      offset(i) < left + slides.clientWidth - 1 ? i : last), current);
    status.textContent = `${labels.status} ${current + 1}${lastVisible > current ? `–${lastVisible + 1}` : ''} of ${cards.length}`;
    nav.hidden = maxScroll() <= 1;
    dots.hidden = maxScroll() <= 1;
  };
  const go = (index) => {
    const target = Math.max(0, Math.min(cards.length - 1, index));
    requested = target;
    navigating = true;
    slides.scrollTo({
      left: Math.min(maxScroll(), offset(target)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
    update();
  };
  cards.forEach((card, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${labels.dot} ${index + 1}`);
    dot.setAttribute('aria-controls', slides.id);
    dot.addEventListener('click', () => go(index));
    dots.append(dot);
  });
  const navigationIndex = () => (navigating ? requested : current);
  previous.addEventListener('click', () => go(navigationIndex() - 1));
  next.addEventListener('click', () => go(navigationIndex() + 1));
  slides.addEventListener('keydown', (event) => {
    if (event.target !== slides) return;
    let target;
    if (event.key === 'ArrowLeft') target = navigationIndex() - 1;
    if (event.key === 'ArrowRight') target = navigationIndex() + 1;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = cards.length - 1;
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  });
  slides.addEventListener('scroll', update, { passive: true });
  // Native dragging or wheel scrolling takes over from a pending button request.
  ['pointerdown', 'wheel', 'scrollend'].forEach((type) => {
    slides.addEventListener(type, () => { navigating = false; }, { passive: true });
  });
  block.replaceChildren(nav, slides, dots, status);
  const observer = new ResizeObserver(update);
  observer.observe(slides);
  update();
  return slides;
}
