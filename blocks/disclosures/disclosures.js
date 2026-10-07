import { loadFragment } from '../fragment/fragment.js';

export default async function decorate(block) {
  const reference = block.querySelector(':scope > div > div > a[href], :scope > div > div > p > a[href]');
  const isReference = reference && block.textContent.trim() === reference.textContent.trim();
  if (block.children.length === 1 && isReference) {
    try {
      const fragment = await loadFragment(new URL(reference.href).pathname);
      const content = fragment?.querySelector('.disclosures');
      block.replaceChildren(...(content ? [...content.childNodes] : []));
      block.hidden = !content;
    } catch { block.hidden = true; }
    return;
  }
  const intro = document.createElement('div');
  intro.className = 'disclosures-intro';
  const closing = document.createElement('div');
  closing.className = 'disclosures-closing';
  const list = document.createElement('ol');
  list.className = 'disclosures-items';
  [...block.children].forEach((row) => {
    const [key, ...cells] = row.children;
    if (!key || !cells.length) return;
    const label = key.textContent.trim();
    const content = document.createElement(/^\d+$/.test(label) ? 'li' : 'div');
    cells.forEach((cell) => content.append(...cell.childNodes));
    if (!content.textContent.trim() && !content.querySelector('img, picture, .icon')) return;
    content.querySelectorAll('a').forEach((link) => link.classList.remove('button', 'primary', 'secondary', 'accent'));
    if (/^\d+$/.test(label)) {
      content.id = `disclosure-${Number(label)}`;
      content.value = Number(label);
      content.tabIndex = -1;
      list.append(content);
    } else if (/^closing$/i.test(label)) closing.append(content);
    else {
      if (/^notice$/i.test(label)) content.className = 'disclosures-notice';
      if (/^logo$/i.test(label)) {
        content.className = 'disclosures-logo';
        const icon = content.querySelector('.icon');
        const name = content.textContent.trim();
        if (icon && name) {
          icon.setAttribute('role', 'img');
          icon.setAttribute('aria-label', name);
          content.replaceChildren(icon);
        }
      }
      intro.append(content);
    }
  });
  block.replaceChildren();
  if (intro.children.length) block.append(intro);
  if (list.children.length) block.append(list);
  if (closing.children.length) block.append(closing);
  block.hidden = !block.children.length;
}
