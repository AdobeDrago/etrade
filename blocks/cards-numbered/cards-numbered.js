/**
 * cards-numbered — grid of numbered feature cards. Each card shows a large
 * ordinal number, a heading, a description, and a "Learn more" link. No images.
 * The ordinal is generated automatically from the card's position.
 *
 * Expected authored structure (one row per card, single column):
 *   [ heading, description paragraph(s), link ]
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row, index) => {
    const li = document.createElement('li');

    // Auto-generated ordinal marker.
    const ordinal = document.createElement('span');
    ordinal.className = 'cards-numbered-ordinal';
    ordinal.textContent = String(index + 1);
    li.append(ordinal);

    while (row.firstElementChild) {
      const div = row.firstElementChild;
      div.className = 'cards-numbered-body';
      li.append(div);
    }
    ul.append(li);
  });
  block.replaceChildren(ul);
}
