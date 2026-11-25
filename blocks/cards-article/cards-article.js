import loadStructuredCards from '../../scripts/structured-cards.js';
import buildCards from '../../scripts/media-cards.js';
import decorateCarousel from '../../scripts/carousel.js';

let stagesInstance = 0;

/** Material "keyboard_arrow_down", rotated by CSS for the open stage. */
function chevron() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cards-article-stage-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shape = document.createElementNS(svg.namespaceURI, 'path');
  shape.setAttribute('d', 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z');
  svg.append(shape);
  return svg;
}

/**
 * Stages: each card's eyebrow (life stage) and the paragraph before its heading become a
 * button that shows that card. One card is open at a time; each panel follows its button,
 * so narrow blocks stack and CSS moves the panels into a second column on wide blocks.
 */
function decorateStages(block, list) {
  stagesInstance += 1;
  const items = [...list.children].map((card, index) => {
    const body = card.querySelector('.cards-article-body');
    const heading = body?.querySelector('.cards-article-heading');
    const eyebrow = body?.querySelector(':scope > .cards-article-eyebrow');
    const next = eyebrow?.nextElementSibling;
    const description = next?.tagName === 'P' && next !== heading ? next : null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cards-article-stage';
    button.id = `stages-${stagesInstance}-${index + 1}`;
    button.style.setProperty('--stage-row', String(index + 1));
    const title = document.createElement('span');
    title.className = 'cards-article-stage-title';
    // Without an authored stage name, the article heading labels the button.
    if (eyebrow) title.append(...eyebrow.childNodes);
    else title.textContent = heading?.textContent.trim() || `${index + 1}`;
    button.append(title);
    if (description) {
      const text = document.createElement('span');
      text.className = 'cards-article-stage-text';
      text.append(...description.childNodes);
      button.append(text);
      description.remove();
    }
    button.append(chevron());
    eyebrow?.remove();
    const panel = document.createElement('div');
    panel.className = 'cards-article-panel';
    panel.id = `${button.id}-panel`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', button.id);
    const content = document.createElement('div');
    content.className = card.className;
    content.append(...card.childNodes);
    panel.append(content);
    button.setAttribute('aria-controls', panel.id);
    return { button, panel };
  });
  const open = (selected) => items.forEach(({ button, panel }, index) => {
    button.setAttribute('aria-expanded', index === selected ? 'true' : 'false');
    panel.hidden = index !== selected;
  });
  items.forEach(({ button }, index) => button.addEventListener('click', () => open(index)));
  block.replaceChildren(...items.flatMap(({ button, panel }) => [button, panel]));
  block.style.setProperty('--stage-count', String(items.length));
  open(0);
}

export default async function decorate(block) {
  const structured = loadStructuredCards(block);
  if (structured) await structured;
  const cards = buildCards(block);
  const carousel = block.classList.contains('carousel');
  const stages = block.classList.contains('stages');
  if (cards.children.length === 4 && !carousel && !stages) block.classList.add('four-up');
  if (block.classList.contains('promo')) {
    [...cards.children].forEach((card) => {
      const content = document.createElement('div');
      content.className = 'cards-article-content';
      [...card.children].filter((node) => !node.classList.contains('cards-article-image'))
        .forEach((node) => content.append(node));
      card.append(content);
    });
  }
  if (stages && cards.children.length) decorateStages(block, cards);
  else if (carousel) {
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
