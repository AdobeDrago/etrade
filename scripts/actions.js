/** Normalize authored actions, including imported duplicate arrow links. */
function label(text) {
  return text.replace(/\barrow_forward\b:?/g, '')
    .replace(/\s*[→:]\s*$/, '').replace(/\s+/g, ' ').trim();
}

export function standaloneAction(paragraph) {
  const links = [...paragraph.querySelectorAll('a[href]')];
  const [link] = links;
  if (!link || paragraph.querySelector('img, picture') || !label(link.textContent)) return null;
  if (/^(?:https?:\/\/|www\.|[\w-]+\.(?:com|org|net)\/)/i.test(link.textContent.trim())) return null;
  const icons = links.slice(1).every((other) => other.getAttribute('href') === link.getAttribute('href')
    && /^\s*:?(?:arrow_forward|→)[:\s]*$/.test(other.textContent));
  if (!icons || label(paragraph.textContent) !== label(link.textContent)) return null;
  link.textContent = label(link.textContent);
  links.slice(1).forEach((other) => other.remove());
  if (/arrow_forward/.test(link.title)) link.title = link.textContent;
  return link;
}

export function decorateAction(link, kind, prefix) {
  const variant = kind || 'secondary';
  link.classList.remove('button', 'primary', 'secondary', 'accent');
  link.classList.add('etrade-action', `etrade-action-${variant}`);
  if (prefix) link.classList.add(`${prefix}-${variant}`);
  link.removeAttribute('role');
  if (link.target === '_blank') link.rel = [...new Set([...link.relList, 'noopener', 'noreferrer'])].join(' ');
  link.querySelectorAll('.etrade-action-icon').forEach((icon) => icon.remove());
  if (variant === 'secondary') {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('etrade-action-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const path = document.createElementNS(icon.namespaceURI, 'path');
    path.setAttribute('d', 'm12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z');
    icon.append(path);
    link.append(icon);
  }
  return link;
}

export function groupActions(content, prefix, primaryKind = 'primary') {
  const actions = document.createElement('div');
  actions.className = `etrade-actions ${prefix}-actions`;
  [...content.querySelectorAll(':scope > p')].forEach((paragraph) => {
    const link = standaloneAction(paragraph);
    if (!link) return;
    if (!actions.children.length) paragraph.before(actions);
    decorateAction(link, actions.children.length ? 'secondary' : primaryKind, prefix);
    actions.append(link);
    paragraph.remove();
  });
  return actions;
}
