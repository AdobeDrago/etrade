export default function decorate(block) {
  const list = document.createElement('ul');
  [...block.children].forEach((row) => {
    const item = document.createElement('li');
    [...row.children].forEach((cell) => {
      if (!cell.textContent.trim() && !cell.querySelector('picture, img, .icon, svg')) return;
      const image = cell.querySelector('picture, img, .icon, svg');
      cell.classList.add(image && !cell.querySelector('h1, h2, h3, h4, h5, h6')
        ? 'cards-award-image' : 'cards-award-body');
      const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && heading.tagName !== 'H3') {
        const replacement = document.createElement('h3');
        [...heading.attributes].forEach(({ name, value }) => replacement.setAttribute(name, value));
        replacement.append(...heading.childNodes);
        heading.replaceWith(replacement);
      }
      item.append(cell);
    });
    if (item.children.length) list.append(item);
  });
  block.replaceChildren(list);
  block.hidden = !list.children.length;
}
