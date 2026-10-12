import { groupActions } from './actions.js';

const glyphs = new Set([
  'book', 'computer', 'goal', 'savings', 'tool-box-welcome-kit', 'umbrella',
  'home-lending', 'group-family', 'graduation-gift', 'retirement', 'mountain',
  'ira-selector', 'money-automatic-investing', 'calculator', 'add-funds', 'idea',
]);

/** Merge optional author cells without discarding rich text or image sources. */
export function mergeCells(row, content) {
  [...row.children].forEach((cell) => content.append(...cell.childNodes));
}

export function extractMedia(content, selector, className) {
  const asset = content.querySelector(selector);
  if (!asset) return null;
  const wrapper = document.createElement('div');
  wrapper.className = className;
  const link = asset.closest('a');
  const media = link && !link.textContent.trim() && link.children.length === 1 ? link : asset;
  const paragraph = media.closest('p');
  wrapper.append(media);
  if (paragraph && !paragraph.textContent.trim() && !paragraph.children.length) paragraph.remove();
  return wrapper;
}

/** One nonempty row per card; all other content stays in a single body. */
export default function buildCards(block, { icon = false, numbered = false, action = 'secondary' } = {}) {
  const name = block.dataset.blockName || [...block.classList][0];
  const list = document.createElement(numbered ? 'ol' : 'ul');
  [...block.children].forEach((row) => {
    const body = document.createElement('div');
    body.className = `${name}-body`;
    // Named glyphs survive DA serialization, unlike an empty icon-font element.
    const token = row.children.length > 1 ? row.firstElementChild.textContent.trim() : '';
    const offer = icon && token.toLowerCase() === 'offer';
    if (offer) row.firstElementChild.replaceChildren();
    if (icon && glyphs.has(token)) {
      row.firstElementChild.replaceChildren();
      const glyph = document.createElement('span');
      glyph.className = `${name}-glyph ${name}-glyph-${token}`;
      glyph.setAttribute('aria-hidden', 'true');
      row.firstElementChild.append(glyph);
    }
    mergeCells(row, body);
    const media = numbered ? null : extractMedia(body, icon
      ? 'picture, img, svg, i.et-icon, i[class*="et-"], .icon, .cards-icon-glyph'
      : 'picture, img', `${name}-${icon ? 'icon' : 'image'}`);
    if (!body.textContent.trim() && !media) return;
    const card = document.createElement('li');
    card.className = `${name}-card`;
    if (offer) card.classList.add(`${name}-offer`);
    if (media) card.append(media);
    if (numbered) {
      const ordinal = document.createElement('span');
      ordinal.className = `${name}-ordinal`;
      ordinal.textContent = list.children.length + 1;
      ordinal.setAttribute('aria-hidden', 'true');
      card.append(ordinal);
    }
    const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
    heading?.classList.add(`${name}-heading`);
    const first = body.firstElementChild;
    if (heading && first?.tagName === 'P' && first !== heading) {
      first.classList.add(`${name}-eyebrow`);
    }
    [...body.children].filter((node) => node.tagName === 'A').forEach((link) => {
      const paragraph = document.createElement('p');
      link.before(paragraph);
      paragraph.append(link);
    });
    const actions = groupActions(body, name, action);
    if (actions.children.length) actions.remove();
    card.append(body);
    if (actions.children.length) card.append(actions);
    list.append(card);
  });
  block.replaceChildren(list);
  block.style.setProperty('--card-count', Math.min(list.children.length || 1, 3));
  block.hidden = !list.children.length;
  return list;
}
