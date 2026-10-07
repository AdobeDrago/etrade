let accordionCount = 0;

function takeAdjacentContent(block) {
  const wrapper = block.closest('.accordion-faq-wrapper');
  const previous = wrapper?.previousElementSibling;
  const next = wrapper?.nextElementSibling;
  const heading = previous?.matches('.default-content-wrapper')
    ? previous.lastElementChild : null;
  const paragraph = next?.matches('.default-content-wrapper') ? next.firstElementChild : null;
  const link = paragraph?.matches('p') ? paragraph.querySelector('a[href]') : null;
  let action;
  let auxiliary;
  const images = paragraph ? [...paragraph.querySelectorAll('img')] : [];
  const onlyTrackingImages = images.every((img) => img.getAttribute('width') === '1'
    && img.getAttribute('height') === '1' && !link?.contains(img));
  if (link && paragraph.querySelectorAll('a').length === 1 && link.textContent.trim()
    && onlyTrackingImages
    && paragraph.textContent.trim() === link.textContent.trim()) {
    action = document.createElement('p');
    action.className = 'accordion-faq-action';
    action.append(link);
    link.classList.remove('button', 'primary', 'secondary', 'accent');
    if (images.length) {
      auxiliary = paragraph;
      auxiliary.classList.add('accordion-faq-auxiliary');
      auxiliary.setAttribute('aria-hidden', 'true');
      auxiliary.remove();
    } else paragraph.remove();
    if (!next.children.length) next.remove();
  }
  if (heading?.matches('h1, h2, h3, h4, h5, h6')) {
    heading.classList.add('accordion-faq-heading');
    heading.remove();
    if (!previous.children.length) previous.remove();
    return { heading, action, auxiliary };
  }
  return { action, auxiliary };
}

function answerContent(cells) {
  const content = document.createElement('div');
  content.className = 'accordion-faq-item-content';
  let paragraph;
  cells.forEach((cell) => {
    [...cell.cloneNode(true).childNodes].forEach((node) => {
      if (node.nodeType === Node.COMMENT_NODE) return;
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim() && !paragraph) return;
      if (node.nodeType === Node.ELEMENT_NODE
        && node.matches('p, div, h1, h2, h3, h4, h5, h6, ul, ol, table, figure, blockquote, pre')) {
        paragraph = null;
        content.append(node);
      } else {
        if (!paragraph) {
          paragraph = document.createElement('p');
          content.append(paragraph);
        }
        paragraph.append(node);
      }
    });
    paragraph = null;
  });
  return content;
}

function chevron() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('accordion-faq-item-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z');
  icon.append(path);
  return icon;
}

/** One authored question/answer row per item. No FAQ copy is supplied by the block. */
export default function decorate(block) {
  accordionCount += 1;
  const prefix = `accordion-faq-${accordionCount}`;
  const rows = [...block.children];
  const { heading, action, auxiliary } = takeAdjacentContent(block);
  const level = heading ? Math.min(Number(heading.tagName.slice(1)) + 1, 6) : 3;
  const items = [];
  const group = document.createElement('div');
  group.className = 'accordion-faq-items';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'accordion-faq-expand-all';

  function updateToggle() {
    const allOpen = items.every(({ button }) => button.getAttribute('aria-expanded') === 'true');
    toggle.textContent = allOpen ? 'Collapse all' : 'Expand all';
    toggle.setAttribute('aria-expanded', String(allOpen));
  }

  function setOpen(item, open) {
    item.element.classList.toggle('is-open', open);
    item.button.setAttribute('aria-expanded', String(open));
    item.panel.setAttribute('aria-hidden', String(!open));
    item.panel.inert = !open;
  }

  rows.forEach((row) => {
    const [question, ...answers] = row.children;
    const title = question?.textContent.replace(/\s+/g, ' ').trim();
    if (!title || !answers.length) return;
    const content = answerContent(answers);
    if (!content.textContent.trim() && !content.querySelector('img, picture, video, audio, iframe')) return;
    const index = items.length + 1;
    const element = document.createElement('div');
    element.className = 'accordion-faq-item';
    const label = document.createElement(`h${level}`);
    label.className = 'accordion-faq-item-heading';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'accordion-faq-item-label';
    button.id = `${prefix}-question-${index}`;
    button.setAttribute('aria-controls', `${prefix}-answer-${index}`);
    const text = document.createElement('span');
    text.className = 'accordion-faq-item-text';
    text.textContent = title;
    button.append(chevron(), text);
    label.append(button);
    const panel = document.createElement('div');
    panel.className = 'accordion-faq-item-body';
    panel.id = `${prefix}-answer-${index}`;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', button.id);
    panel.append(content);
    element.append(label, panel);
    const item = { element, button, panel };
    setOpen(item, false);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      if (open) items.forEach((other) => setOpen(other, false));
      setOpen(item, open);
      updateToggle();
    });
    items.push(item);
    group.append(element);
  });

  block.replaceChildren();
  if (heading) block.append(heading);
  if (items.length) {
    toggle.setAttribute('aria-controls', items.map(({ panel }) => panel.id).join(' '));
    toggle.addEventListener('click', () => {
      const open = items.some(({ button }) => button.getAttribute('aria-expanded') !== 'true');
      items.forEach((item) => setOpen(item, open));
      updateToggle();
    });
    updateToggle();
    block.append(toggle, group);
  }
  if (action) block.append(action);
  if (auxiliary) block.append(auxiliary);
  block.hidden = !block.children.length;
}
