import { groupActions } from '../../scripts/actions.js';

/** Text-only intro; preserve inline links and combine optional author cells. */
export default function decorate(block) {
  const heading = block.querySelector('h1, h2, h3');
  const previous = block.parentElement.previousElementSibling;
  if (heading && previous?.matches('.default-content-wrapper')
    && previous.children.length === 1 && previous.firstElementChild.matches('p')
    && previous.textContent.trim() === heading.textContent.trim()
    && !previous.querySelector('a, img')) previous.classList.add('hero-light-breadcrumb');
  const content = document.createElement('div');
  content.className = 'hero-light-content';
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => content.append(...cell.childNodes));
  });
  groupActions(content, 'hero-light', 'outline');
  block.classList.add('no-image');
  block.replaceChildren(content);
}
