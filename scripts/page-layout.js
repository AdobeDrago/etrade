import { groupActions } from './actions.js';

const pages = new Map([
  ['/home', 'homepage'],
  ['/home/welcome-back', 'welcome-back'],
  ['/what-we-offer/our-accounts', 'our-accounts'],
  ['/what-we-offer/our-accounts/brokerage-account', 'brokerage'],
  ['/planning', 'planning'],
  ['/why-etrade', 'why-etrade'],
]);

/** Keep layout consistent when older authored pages omit Template metadata. */
export default function decoratePageLayout() {
  const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  const page = pages.get(path);
  if (!page) return;
  document.body.classList.add('etrade-page', page);
  // Empty importer placeholders otherwise break standalone action grouping.
  document.querySelectorAll('main img[src="about:error"][alt=""]').forEach((image) => image.remove());
}

/** Keep navigation between implemented pages on the current EDS environment. */
export function localizePageLinks(root) {
  if (!document.body.classList.contains('etrade-page')) return;
  root.querySelectorAll('a[href]').forEach((link) => {
    let url;
    try { url = new URL(link.href, window.location.href); } catch { return; }
    const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    if (url.hostname === 'us.etrade.com' && pages.has(path)) {
      link.href = `${path}${url.search}${url.hash}`;
    }
  });
}

/** The live pricing introduction shares a row with its copy and authored actions. */
export function decoratePricingIntroductions(main) {
  main.querySelectorAll('.section:has(.cards-pricing) > .default-content-wrapper').forEach((intro) => {
    const heading = intro.querySelector(':scope > h2');
    if (!heading || intro.classList.contains('pricing-intro')) return;
    const copy = document.createElement('div');
    copy.className = 'pricing-intro-copy';
    [...intro.childNodes].filter((node) => node !== heading).forEach((node) => copy.append(node));
    groupActions(copy, 'pricing-intro');
    intro.classList.add('pricing-intro');
    intro.append(copy);
  });
}

/** Normalize shared section actions after block decorators have claimed their own content. */
export function decoratePageActions(main) {
  main.querySelectorAll('.default-content-wrapper').forEach((content) => {
    const section = content.closest('.section');
    let kind = 'primary';
    if (section?.querySelector('.cards-award')) kind = 'secondary';
    if (section?.querySelector('.cards-icon.planning')) kind = 'outline';
    groupActions(content, 'page-intro', kind);
  });
}
