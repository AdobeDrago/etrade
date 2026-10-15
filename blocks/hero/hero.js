import { groupActions } from '../../scripts/actions.js';

/** Background hero: authored cell placement does not determine the visual layout. */
export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'hero-content';
  const media = document.createElement('div');
  media.className = 'hero-media';
  const cells = [...block.children].flatMap((row) => {
    const [key, ...values] = row.children;
    const named = values.length && ['eyebrow', 'heading', 'content', 'image']
      .includes(key.textContent.trim().toLowerCase());
    return named ? values : [...row.children];
  });
  const image = block.querySelector('picture, img');
  if (image) {
    const parent = image.parentElement;
    media.append(image);
    if (parent.matches('p') && !parent.textContent.trim() && !parent.children.length) parent.remove();
    const img = image.matches('img') ? image : image.querySelector('img');
    if (img && block.closest('.section') === document.querySelector('main > .section')) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    }
  } else block.classList.add('no-image');

  cells.forEach((cell) => {
    [...cell.childNodes].forEach((node) => {
      if (node.textContent.trim() || node.querySelector?.('img, picture')
        || node.matches?.('img, picture')) content.append(node);
    });
  });
  groupActions(content, 'hero');
  if (!content.childNodes.length) block.classList.add('no-content');
  block.replaceChildren();
  if (media.children.length) block.append(media);
  if (content.childNodes.length) block.append(content);
}
