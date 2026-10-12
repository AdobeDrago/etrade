import { decorateAction, standaloneAction } from '../../scripts/actions.js';
import { authoredRows, element } from '../../scripts/market-ui.js';

let loginCount = 0;

function loginIcon(kind) {
  const paths = {
    eye: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2ZM9 6a3 3 0 0 1 6 0v2H9Zm4 10v2h-2v-2a2 2 0 1 1 2 0Z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('welcome-hero-login-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[kind]);
  svg.append(path);
  return svg;
}

function decorateLogin(login) {
  const action = [...login.querySelectorAll('p')].map(standaloneAction)
    .find((link) => link && /^log\s*on$/i.test(link.textContent.trim()));
  if (!action) return false;

  loginCount += 1;
  const prefix = `welcome-hero-login-${loginCount}`;
  const heading = login.querySelector('h1, h2') || element('h2');
  heading.textContent = 'Log on';
  if (!heading.parentElement) login.prepend(heading);
  login.querySelectorAll('p').forEach((paragraph) => {
    if (!paragraph.querySelector('a')
      && paragraph.textContent.trim() === 'Log on to access your E*TRADE accounts.') paragraph.remove();
  });

  const form = element('form', 'welcome-hero-form');
  form.action = action.href;
  form.setAttribute('aria-label', 'E*TRADE log on');
  // Preserve the existing sign-in handoff; credentials stay out of requests and storage.
  form.innerHTML = `
    <div class="welcome-hero-field">
      <label for="${prefix}-user">User ID</label>
      <input id="${prefix}-user" type="text" autocomplete="off" autocapitalize="none" spellcheck="false">
    </div>
    <div class="welcome-hero-field">
      <div class="welcome-hero-password-label">
        <label for="${prefix}-password">Password</label>
        <button class="welcome-hero-show-password" type="button" aria-controls="${prefix}-password" aria-pressed="false"><span>Show</span></button>
      </div>
      <input id="${prefix}-password" type="password" autocomplete="off">
    </div>
    <div class="welcome-hero-options">
      <label><input type="checkbox"><span>Remember User ID</span></label>
      <div class="welcome-hero-security-option">
        <label><input type="checkbox"><span>Use security code</span></label>
        <button class="welcome-hero-security-info" type="button" aria-label="About security codes" aria-expanded="false" aria-controls="${prefix}-security-info">i</button>
      </div>
    </div>
    <p id="${prefix}-security-info" class="welcome-hero-security-help" hidden>Use the security code from your authenticator when you log on at E*TRADE.</p>
    <div class="welcome-hero-logon-row">
      <div class="welcome-hero-destination">
        <label for="${prefix}-destination">Go To:</label>
        <div class="welcome-hero-select"><select id="${prefix}-destination"><option>Accounts</option><option>Portfolios</option><option>Stock Trade</option><option>Options Trade</option><option>Markets</option></select></div>
      </div>
      <button class="welcome-hero-primary welcome-hero-submit" type="submit">Log on</button>
    </div>`;
  const password = form.querySelector('input[type="password"]');
  const show = form.querySelector('.welcome-hero-show-password');
  show.prepend(loginIcon('eye'));
  show.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    show.querySelector('span').textContent = visible ? 'Hide' : 'Show';
    show.setAttribute('aria-pressed', String(visible));
  });
  const info = form.querySelector('.welcome-hero-security-info');
  const help = form.querySelector('.welcome-hero-security-help');
  info.addEventListener('click', () => {
    help.hidden = !help.hidden;
    info.setAttribute('aria-expanded', String(!help.hidden));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    form.querySelectorAll('input').forEach((input) => { input.value = ''; });
    window.location.assign(form.action);
  });
  action.closest('p').replaceWith(form);

  const links = [...login.querySelectorAll('a[href]')];
  const security = links.find((link) => /^security center$/i.test(link.textContent.trim()));
  const language = links.find((link) => link.textContent.trim() === '中文') || element('a', '', '中文');
  if (!language.hasAttribute('href')) language.href = 'https://us.etrade.com/e/t/user/login?lang=zh_CN';
  language.setAttribute('lang', 'zh');
  language.setAttribute('aria-label', '中文 — Chinese log on');
  const footer = element('div', 'welcome-hero-login-footer');
  if (security) {
    const paragraph = security.closest('p');
    security.prepend(loginIcon('lock'));
    footer.append(security);
    if (paragraph && !paragraph.textContent.trim()) paragraph.remove();
  }
  const languageParagraph = language.closest('p');
  footer.append(language);
  if (languageParagraph && !languageParagraph.textContent.trim()) languageParagraph.remove();
  login.append(footer);
  return true;
}

export default function decorate(block) {
  const rows = authoredRows(block);
  const login = rows.get('login') || element('div');
  const campaign = rows.get('campaign') || element('div');
  login.className = 'welcome-hero-login';
  campaign.className = 'welcome-hero-campaign';
  const media = rows.get('image');
  const image = media?.querySelector('picture, img');
  if (image) {
    const img = image.matches('img') ? image : image.querySelector('img');
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
    image.classList.add('welcome-hero-image');
    block.classList.add('has-image');
  }
  const copy = element('div', 'welcome-hero-copy');
  [...campaign.childNodes].forEach((node) => copy.append(node));
  campaign.append(copy);
  const contentAreas = decorateLogin(login) ? [copy] : [login, copy];
  contentAreas.forEach((content) => {
    let first = true;
    content.querySelectorAll('p').forEach((paragraph) => {
      const link = standaloneAction(paragraph);
      if (!link) return;
      paragraph.classList.add('etrade-actions');
      decorateAction(link, first ? 'primary' : 'secondary', 'welcome-hero');
      first = false;
    });
  });
  // Identity integration can replace this presentation form in the same slot.
  login.dataset.loginSlot = 'true';
  block.replaceChildren();
  // One image spans the entire hero, behind both campaign copy and the login panel.
  if (image) block.append(image);
  if (copy.childNodes.length) block.append(campaign);
  if (login.childNodes.length) block.append(login);
  block.dispatchEvent(new CustomEvent('welcome:login-ready', { bubbles: true, detail: { slot: login } }));
}
