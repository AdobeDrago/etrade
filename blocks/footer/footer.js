import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import bindPrivacyChoices from '../../scripts/privacy.js';
import { loadFragment } from '../fragment/fragment.js';

const ROLES = new Set(['brand', 'contact', 'social', 'column']);

function cleanLinks(content) {
  content.querySelectorAll('a[href]').forEach((link) => {
    link.classList.remove('button', 'primary', 'secondary', 'accent');
    if (link.getAttribute('target') === '_blank') {
      link.rel = [...new Set([...link.relList, 'noopener', 'noreferrer'])].join(' ');
    }
  });
  content.querySelectorAll('.button-wrapper').forEach((paragraph) => {
    paragraph.classList.remove('button-wrapper');
  });
}

function normalizeHeading(content, level) {
  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) return;
  const replacement = document.createElement(`h${level}`);
  [...heading.attributes].forEach(({ name, value }) => replacement.setAttribute(name, value));
  replacement.append(...heading.childNodes);
  heading.replaceWith(replacement);
}

function createSocialLinks(content) {
  const list = document.createElement('ul');
  list.className = 'footer-social';
  content.querySelectorAll('a[href]').forEach((source) => {
    const icon = source.querySelector('.icon, picture, img, svg');
    const label = source.getAttribute('aria-label')?.trim()
      || source.textContent.trim()
      || source.querySelector('img')?.getAttribute('alt')?.trim();
    // Icon-only links must have an authored accessible name.
    if (!label) return;
    const item = document.createElement('li');
    const link = source.cloneNode(false);
    if (icon) {
      link.classList.add('footer-social-icon');
      const image = icon.cloneNode(true);
      image.setAttribute('aria-hidden', 'true');
      image.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      if (image.tagName === 'IMG') image.alt = '';
      link.append(image);
    }
    const text = document.createElement('span');
    text.className = 'footer-social-label';
    text.textContent = label;
    link.append(text);
    item.append(link);
    list.append(item);
  });
  cleanLinks(list);
  return list.children.length ? list : null;
}

function renderAuthoredRows(block) {
  const contact = document.createElement('div');
  contact.className = 'footer-contact';
  const navigation = document.createElement('nav');
  navigation.className = 'footer-navigation';
  navigation.setAttribute('aria-label', 'Footer navigation');
  const social = [];

  [...block.children].forEach((row) => {
    const [key, ...cells] = row.children;
    const role = key?.textContent.trim().toLowerCase();
    if (!ROLES.has(role) || !cells.length) return;
    const content = document.createElement('div');
    cells.forEach((cell) => content.append(...cell.cloneNode(true).childNodes));
    if (!content.textContent.trim() && !content.querySelector('img, picture, .icon')) return;
    cleanLinks(content);
    if (role === 'social') {
      const links = createSocialLinks(content);
      if (links) social.push(links);
    } else if (role === 'column') {
      content.className = 'footer-column';
      normalizeHeading(content, 3);
      navigation.append(content);
    } else {
      content.className = `footer-${role}-content`;
      normalizeHeading(content, 2);
      contact.append(content);
    }
  });

  social.forEach((list) => contact.append(list));
  const shell = document.createElement('div');
  shell.className = 'footer-inner';
  if (contact.children.length) shell.append(contact);
  if (navigation.children.length) shell.append(navigation);
  if (!shell.children.length) return null;
  if (!contact.children.length) shell.classList.add('footer-without-contact');
  decorateIcons(shell);
  return shell;
}

/** Decorate authored Footer rows, or load the global footer fragment. */
export default async function decorate(block) {
  let content;
  if (block.textContent.trim() || block.querySelector('img, picture, .icon')) {
    content = renderAuthoredRows(block);
  } else if (block.closest('body > footer')) {
    const metadata = getMetadata('footer');
    let path = '/footer';
    if (metadata) {
      try {
        path = new URL(metadata, window.location.href).pathname;
      } catch {
        // Invalid metadata leaves the standard authored fragment path in place.
      }
    }
    try {
      const fragment = await loadFragment(path);
      // Only the authored Footer block is consumed. Disclosures remain separate.
      content = fragment?.querySelector('.footer > .footer-inner');
    } catch {
      // Missing or unavailable authored content must not create fallback copy.
    }
  }
  block.replaceChildren(...(content ? [content] : []));
  block.hidden = !content;
  bindPrivacyChoices(block);
}
