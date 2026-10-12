import { decorateAction, standaloneAction } from '../../scripts/actions.js';
import { authoredRows, element } from '../../scripts/market-ui.js';

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
  [login, copy].forEach((content) => {
    let first = true;
    content.querySelectorAll('p').forEach((paragraph) => {
      const link = standaloneAction(paragraph);
      if (!link) return;
      paragraph.classList.add('etrade-actions');
      decorateAction(link, first ? 'primary' : 'secondary', 'welcome-hero');
      first = false;
    });
  });
  // Identity integration can mount in this slot while the authored login link remains usable.
  login.dataset.loginSlot = 'true';
  block.replaceChildren();
  // One image spans the entire hero, behind both campaign copy and the login panel.
  if (image) block.append(image);
  if (copy.childNodes.length) block.append(campaign);
  if (login.childNodes.length) block.append(login);
  block.dispatchEvent(new CustomEvent('welcome:login-ready', { bubbles: true, detail: { slot: login } }));
}
