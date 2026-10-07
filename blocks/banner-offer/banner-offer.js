import { groupActions } from '../../scripts/actions.js';

/** Independent authored offer; the heading, image, terms, and links stay in DA. */
export default function decorate(block) {
  const content = document.createElement('div');
  content.className = 'banner-offer-copy';
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => content.append(...cell.childNodes));
  });
  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('banner-offer-heading');
  const picture = content.querySelector('picture, img');
  const media = document.createElement('div');
  media.className = 'banner-offer-media';
  if (picture) {
    const paragraph = picture.closest('p');
    media.append(picture);
    if (paragraph && !paragraph.textContent.trim() && !paragraph.children.length) {
      paragraph.remove();
    }
  }
  const actions = groupActions(content, 'banner-offer', block.classList.contains('light') ? 'outline' : 'primary');
  heading?.remove();
  actions.remove();
  block.replaceChildren();
  if (picture) block.append(media);
  else block.classList.add('no-media');
  if (heading) block.append(heading);
  if (content.textContent.trim()) block.append(content);
  if (actions.children.length) block.append(actions);
  block.hidden = !block.children.length;
}
