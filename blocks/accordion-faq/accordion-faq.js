import decorateCardRates from '../../scripts/card-rates.js';

let accordionCount = 0;
const themeLayouts = new WeakMap();
let themeObserver;

function watchPageTheme(block, update) {
  themeLayouts.set(block, update);
  if (themeObserver || typeof MutationObserver === 'undefined') return;
  themeObserver = new MutationObserver((mutations) => {
    // Fragments decorate off-document and can discard their section on insertion.
    const changed = mutations.some((mutation) => mutation.type === 'attributes'
      || [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
        node.nodeType === Node.ELEMENT_NODE
        && (node.matches('.accordion-faq') || node.querySelector('.accordion-faq'))
      )));
    if (!changed) return;
    document.querySelectorAll('.accordion-faq').forEach((accordion) => {
      themeLayouts.get(accordion)?.();
    });
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-page-theme', 'data-section-family'],
    childList: true,
    subtree: true,
  });
}

function takeAdjacentContent(block) {
  const wrapper = block.closest('.accordion-faq-wrapper');
  const section = wrapper?.parentElement;
  if (section?.hasAttribute('data-section-grid')) {
    const siblings = [...section.children];
    const preceding = siblings.slice(0, siblings.indexOf(wrapper));
    const sectionHeading = preceding.flatMap((node) => (node.matches('.default-content-wrapper')
      ? [...node.children] : [])).findLast((node) => node.matches('h1, h2, h3, h4, h5, h6'));
    return { sectionHeading };
  }
  const previous = wrapper?.previousElementSibling;
  const next = wrapper?.nextElementSibling;
  const before = previous?.matches('.default-content-wrapper') ? [...previous.children] : [];
  const heading = before.findLast((node) => node.matches('h1, h2, h3, h4, h5, h6'));
  const trailing = heading && before.slice(before.indexOf(heading) + 1);
  // DA may place the shared action before or after the FAQ table.
  let paragraph = next?.matches('.default-content-wrapper') ? next.firstElementChild : null;
  if (trailing?.length === 1 && trailing[0].matches('p')) [paragraph] = trailing;
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
    if (next && !next.children.length) next.remove();
  }
  if (heading?.matches('h1, h2, h3, h4, h5, h6')) {
    const introduction = document.createElement('div');
    introduction.className = 'accordion-faq-introduction';
    trailing.filter((node) => node.parentElement === previous)
      .forEach((node) => introduction.append(node));
    heading.classList.add('accordion-faq-heading');
    heading.remove();
    if (!previous.children.length) previous.remove();
    return {
      heading, introduction, action, auxiliary,
    };
  }
  return { action, auxiliary };
}

function answerContent(cells) {
  const content = document.createElement('div');
  content.className = 'accordion-faq-item-content';
  let paragraph;
  cells.forEach((cell) => {
    [...cell.childNodes].forEach((node) => {
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

function disclosureIcon(flat) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('accordion-faq-item-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', flat ? 'M5 11h14v2H5z' : 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z');
  icon.append(path);
  if (flat) {
    const vertical = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    vertical.classList.add('accordion-faq-icon-vertical');
    vertical.setAttribute('d', 'M11 5h2v14h-2z');
    icon.append(vertical);
  }
  return icon;
}

/** One authored question/answer row per item. No FAQ copy is supplied by the block. */
export default async function decorate(block) {
  // Keep the original marker nodes so asynchronous rate updates reach the rendered answers.
  const rates = decorateCardRates(block, { contentStart: 1, settingsStart: 2 });
  accordionCount += 1;
  const prefix = `accordion-faq-${accordionCount}`;
  const rows = [...block.children];
  // Preserve content authored with the former variant name.
  if (block.classList.contains('pricing')) block.classList.add('flat');
  const authoredFlat = block.classList.contains('flat');
  const usesFlatLayout = () => authoredFlat
    || (block.closest('.section[data-section-family]')?.dataset.sectionFamily
      || document.documentElement.dataset.pageTheme) === 'purple';
  const flat = usesFlatLayout();
  const {
    heading, sectionHeading, introduction, action, auxiliary,
  } = takeAdjacentContent(block);
  const labelHeading = heading || sectionHeading;
  const level = labelHeading ? Math.min(Number(labelHeading.tagName.slice(1)) + 1, 6) : 3;
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
    content.querySelectorAll('table').forEach((table) => {
      const scroll = document.createElement('div');
      scroll.className = 'accordion-faq-table';
      scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', `${title} table`);
      table.replaceWith(scroll);
      scroll.append(table);
    });
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
    button.append(disclosureIcon(flat), text);
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
  if (introduction?.children.length) block.append(introduction);
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

  let currentLayout;
  function updateLayout() {
    const nextFlat = usesFlatLayout();
    const layout = nextFlat ? 'flat' : 'cards';
    if (layout === currentLayout) return;
    currentLayout = layout;
    block.dataset.faqLayout = layout;
    items.forEach(({ button }) => {
      button.querySelector('.accordion-faq-item-icon').replaceWith(disclosureIcon(nextFlat));
    });
    if (action) {
      if (nextFlat && toggle.parentElement === block) toggle.before(action);
      else block.append(action);
    }
    if (auxiliary) block.append(auxiliary);
  }
  updateLayout();
  watchPageTheme(block, updateLayout);
  await rates;
}
