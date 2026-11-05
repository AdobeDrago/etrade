import startOneTrust from './onetrust.js';

/** A review-only opt-in, separate from performance and simulated-consent controls. */
export function cookieBannerRequested(href) {
  const url = new URL(href);
  const preview = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || /^[a-z0-9-]+--etrade--adobedrago\.aem\.page$/i.test(url.hostname);
  const values = url.searchParams.getAll('cookiebanner');
  return preview && values.length === 1 && ['true', '1'].includes(values[0]);
}

export default function startCookieBanner(doc = document, win = window, start = startOneTrust) {
  if (!cookieBannerRequested(win.location.href)) return null;
  // Reopen the preview banner on a fresh load without changing OptanonConsent or its groups.
  doc.cookie = 'OptanonAlertBoxClosed=; Max-Age=0; Path=/';
  return start(doc, win);
}
