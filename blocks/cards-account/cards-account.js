/**
 * cards-account — grid of account cards, each with a top accent bar, an account
 * name, a short label/description, and one or two CTA links. No images.
 *
 * Expected authored structure (one row per card, single column):
 *   [ heading (account name), label/description paragraph(s), CTA link(s) ]
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      div.className = 'cards-account-body';
    });

    // Group CTA links into an actions row.
    const body = li.querySelector('.cards-account-body') || li;
    const ctaParagraphs = [...body.querySelectorAll(':scope > p')].filter((p) => p.querySelector('a'));
    if (ctaParagraphs.length) {
      const actions = document.createElement('div');
      actions.className = 'cards-account-actions';
      ctaParagraphs[0].before(actions);
      ctaParagraphs.forEach((p) => actions.append(p));
    }

    ul.append(li);
  });
  block.replaceChildren(ul);
}
