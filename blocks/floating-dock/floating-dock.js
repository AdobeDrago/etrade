const ICON_PATHS = {
  offer: 'M21.41 11.41l-8.83-8.83A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17c0 .53.21 1.04.59 1.41l8.83 8.83a2 2 0 0 0 2.83 0l7.17-7.17a2 2 0 0 0-.01-2.83ZM5.5 7A1.5 1.5 0 1 1 5.5 4a1.5 1.5 0 0 1 0 3Z',
  login: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z',
  toggle: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6Z',
};

function createIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('floating-dock-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', ICON_PATHS[type]);
  svg.append(path);
  return svg;
}

function getActionType(link, cell) {
  const roleCell = cell?.parentElement.firstElementChild;
  const role = roleCell?.querySelector('a') ? '' : roleCell?.textContent.trim().toLowerCase();
  if (['offer', 'login', 'primary'].includes(role)) return role;
  if (role) return 'secondary';
  const content = `${link.textContent} ${link.getAttribute('href')}`;
  if (/local_offer|limited time offer|stickyCTA_LTO/i.test(content)) return 'offer';
  if (/\bperson\b|log[ -]?(on|in)|stickyCTA_logon/i.test(content)) return 'login';
  if (/open (an? |a brokerage )?account|stickyCTA_openaccount/i.test(content)) return 'primary';
  return 'secondary';
}

/** Decorates either an authored link table or the imported home-page dock. */
export default function decorate(block) {
  const bar = document.createElement('nav');
  bar.className = 'floating-dock-bar';
  bar.setAttribute('aria-label', block.getAttribute('aria-label') || 'Account quick links');
  const secondary = document.createElement('div');
  secondary.className = 'floating-dock-secondary';
  let primary;

  block.querySelectorAll('a[href]').forEach((source) => {
    const type = getActionType(source, source.closest('div'));
    const label = source.textContent.replace(/\b(local_offer|person)\b/g, '').trim()
      || source.getAttribute('aria-label')?.trim();
    if (!label || !source.getAttribute('href').trim()) return;
    const link = source.cloneNode(false);
    link.className = 'floating-dock-link';
    link.removeAttribute('role');
    link.removeAttribute('tabindex');
    link.removeAttribute('id');
    if (/\b(local_offer|person)\b/.test(link.title)) link.title = label;
    if (link.target === '_blank') link.rel = `${link.rel} noopener noreferrer`.trim();
    if (type === 'offer' || type === 'login') link.append(createIcon(type), ' ');
    link.append(label);
    if (type === 'primary' && !primary) {
      primary = link;
      link.classList.add('floating-dock-primary');
    } else {
      secondary.append(link);
    }
  });

  block.replaceChildren();
  if (!primary && !secondary.childElementCount) {
    block.hidden = true;
    return;
  }
  if (secondary.childElementCount) bar.append(secondary);
  if (primary) bar.append(primary);
  block.append(bar);

  if (primary && secondary.childElementCount) {
    const mobile = window.matchMedia('(width < 768px)');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'floating-dock-toggle';
    secondary.id = `floating-dock-actions-${crypto.randomUUID()}`;
    toggle.setAttribute('aria-controls', secondary.id);
    toggle.append(createIcon('toggle'));
    bar.append(toggle);
    let expanded = false;

    const update = () => {
      secondary.hidden = mobile.matches && !expanded;
      toggle.hidden = !mobile.matches;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'Close account quick links' : 'Show account quick links');
      bar.classList.toggle('is-expanded', mobile.matches && expanded);
    };
    const close = (restoreFocus = false) => {
      if (!expanded) return;
      if (restoreFocus) toggle.focus();
      expanded = false;
      update();
    };
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      update();
      if (expanded) secondary.querySelector('a').focus();
    });
    bar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        close(true);
      }
    });
    bar.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !bar.contains(event.relatedTarget)) close();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!bar.contains(event.target)) close();
    });
    mobile.addEventListener('change', () => {
      if (mobile.matches && secondary.contains(document.activeElement)) primary.focus();
      if (!mobile.matches && document.activeElement === toggle) primary.focus();
      expanded = false;
      update();
    });
    update();
  } else {
    bar.classList.add('floating-dock-simple');
  }

  // Reserve space after the footer so its last link can scroll clear of the dock.
  const reserve = document.createElement('div');
  reserve.className = 'floating-dock-reserve';
  reserve.setAttribute('aria-hidden', 'true');
  document.body.append(reserve);
  const observer = new ResizeObserver(() => {
    const { height } = bar.getBoundingClientRect();
    const bottom = parseFloat(getComputedStyle(bar).bottom) || 0;
    bar.style.setProperty('--floating-dock-height', `${height}px`);
    reserve.style.height = `${height + bottom + 16}px`;
  });
  observer.observe(bar);
  document.addEventListener('focusin', (event) => {
    if (!block.isConnected || bar.contains(event.target)) return;
    const focused = event.target.getBoundingClientRect();
    const dock = bar.getBoundingClientRect();
    const panel = secondary.hidden ? dock : secondary.getBoundingClientRect();
    const top = Math.min(dock.top, panel.top);
    if (focused.bottom > top && focused.top < dock.bottom
      && focused.right > dock.left && focused.left < dock.right) {
      event.target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
}
