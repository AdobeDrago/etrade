/** Normalize authored actions, including imported duplicate arrow links. */
function label(text) {
  return text.replace(/\barrow_forward\b:?/g, '')
    .replace(/\s*[→:>]\s*$/, '').replace(/\s+/g, ' ').trim();
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
  link.classList.remove(
    'button',
    'primary',
    'secondary',
    'accent',
    'etrade-action-primary',
    'etrade-action-secondary',
    'etrade-action-outline',
  );
  link.classList.add('etrade-action', `etrade-action-${variant}`);
  if (prefix) link.classList.add(`${prefix}-${variant}`);
  link.removeAttribute('role');
  if (link.target === '_blank') link.rel = [...new Set([...link.relList, 'noopener', 'noreferrer'])].join(' ');
  link.querySelectorAll('.etrade-action-icon').forEach((icon) => icon.remove());
  link.querySelectorAll('.etrade-action-lock').forEach((icon) => icon.remove());
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
  if (/^https:\/\/us\.etrade\.com\/etx\/pxy\//.test(link.getAttribute('href'))
    && /^calculate now$/i.test(link.textContent.trim())) {
    const lock = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lock.classList.add('etrade-action-lock');
    lock.setAttribute('viewBox', '0 0 24 24');
    lock.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(lock.namespaceURI, 'path');
    path.setAttribute('d', 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM9 6a3 3 0 0 1 6 0v2H9Zm4 10v2h-2v-2a2 2 0 1 1 2 0Z');
    lock.append(path);
    link.append(lock);
  }
  return link;
}

export function groupActions(content, prefix, primaryKind = 'primary') {
  // Imports may serialize standalone actions as bare anchors or formatted links.
  [...content.children].forEach((node) => {
    if (!node.matches('a, strong, b, em')) return;
    const probe = document.createElement('p');
    probe.append(node.cloneNode(true));
    if (!standaloneAction(probe)) return;
    const paragraph = document.createElement('p');
    node.replaceWith(paragraph);
    paragraph.append(node);
  });
  [...content.querySelectorAll(':scope > br')].forEach((br) => {
    if (br.previousElementSibling?.matches('p') && br.nextElementSibling?.matches('p')
      && standaloneAction(br.previousElementSibling) && standaloneAction(br.nextElementSibling)) {
      br.remove();
    }
  });
  const actions = document.createElement('div');
  actions.className = `etrade-actions ${prefix}-actions`;
  [...content.querySelectorAll(':scope > p')].forEach((paragraph) => {
    const link = standaloneAction(paragraph);
    if (!link) return;
    if (!actions.children.length) paragraph.before(actions);
    // Explicit author formatting wins over the automatic first/next action treatment.
    let kind = actions.children.length ? 'secondary' : primaryKind;
    if (link.classList.contains('button')) {
      kind = link.classList.contains('secondary') ? 'outline' : 'primary';
    }
    decorateAction(link, kind, prefix);
    actions.append(link);
    paragraph.remove();
  });
  return actions;
}
