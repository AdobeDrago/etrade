import { groupActions } from '../../scripts/actions.js';
import { mergeCells, extractMedia } from '../../scripts/media-cards.js';

export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'hero-product-content';
  const offer = document.createElement('div');
  offer.className = 'hero-product-offer';
  const slots = new Map(['eyebrow', 'heading', 'content', 'image', 'offer'].map((key) => [key, []]));
  [...block.children].forEach((row) => {
    const key = row.firstElementChild?.textContent.trim().toLowerCase();
    if (row.children.length > 1 && slots.has(key)) {
      row.firstElementChild.remove();
      const part = document.createElement('div');
      mergeCells(row, part);
      slots.get(key).push(...part.childNodes);
    } else mergeCells(row, content);
  });
  const eyebrowNodes = slots.get('eyebrow');
  if (eyebrowNodes.length && !eyebrowNodes.some((node) => node.nodeType === 1)) {
    const paragraph = document.createElement('p');
    paragraph.append(...eyebrowNodes);
    eyebrowNodes.splice(0, eyebrowNodes.length, paragraph);
  }
  content.prepend(...eyebrowNodes, ...slots.get('heading'));
  content.append(...slots.get('content'), ...slots.get('image'));
  offer.append(...slots.get('offer'));
  const media = extractMedia(content, 'picture, img', 'hero-product-media');
  if (media) {
    const image = media.querySelector('img');
    if (image && block.closest('.section') === document.querySelector('main > .section')) {
      image.loading = 'eager';
      image.setAttribute('fetchpriority', 'high');
    }
  } else block.classList.add('no-image');
  const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const eyebrow = slots.get('eyebrow').find((node) => node.nodeType === 1)
    || (headings[0]?.tagName === 'H1' && headings[1]?.tagName === 'H2' ? headings[0] : null);
  eyebrow?.classList.add('hero-product-eyebrow');
  const heading = [...headings].find((node) => node !== eyebrow);
  heading?.classList.add('hero-product-heading');
  groupActions(content, 'hero-product');
  groupActions(offer, 'hero-product-offer', 'secondary');
  if (!offer.querySelector('h1, h2, h3, h4')) block.classList.add('copy-only-offer');
  block.replaceChildren(content);
  if (media) block.append(media);
  if (offer.textContent.trim()) block.append(offer);
  block.hidden = !content.textContent.trim() && !media && !offer.textContent.trim();
}
