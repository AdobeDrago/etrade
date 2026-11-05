import startOneTrust from './onetrust.js';

const banners = new WeakMap();

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
  if (banners.has(doc)) return banners.get(doc);

  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `${win.hlx?.codeBasePath || ''}/styles/cookie-banner.css`;
  doc.head.append(stylesheet);

  const banner = doc.createElement('aside');
  banner.className = 'cookie-banner-demo';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-labelledby', 'cookie-banner-demo-title');
  const copy = doc.createElement('div');
  const label = doc.createElement('p');
  label.className = 'cookie-banner-demo-label';
  label.textContent = 'Demo cookie banner';
  const title = doc.createElement('h2');
  title.id = 'cookie-banner-demo-title';
  title.textContent = 'Manage your cookie preferences';
  const description = doc.createElement('p');
  description.textContent = 'This banner is a preview. Cookie Preferences opens the real settings for this site. Dismissing this demo does not change your cookie choices.';
  const status = doc.createElement('p');
  status.className = 'cookie-banner-demo-status';
  status.setAttribute('role', 'status');
  copy.append(label, title, description, status);

  const actions = doc.createElement('div');
  actions.className = 'cookie-banner-demo-actions';
  const preferences = doc.createElement('button');
  preferences.type = 'button';
  preferences.dataset.cookiePreferences = '';
  preferences.textContent = 'Cookie Preferences';
  preferences.setAttribute('aria-haspopup', 'dialog');
  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.dataset.cookieDismiss = '';
  dismiss.textContent = 'Dismiss demo banner';
  actions.append(preferences, dismiss);
  banner.append(copy, actions);
  doc.body.append(banner);

  const controller = start(doc, win);
  banners.set(doc, controller);
  let requested = false;
  let unsubscribe;
  const close = () => { banner.remove(); unsubscribe?.(); };
  function update(state) {
    if (state.canOpenPreferences) {
      if (requested) close();
      else {
        preferences.disabled = false;
        status.textContent = '';
      }
    } else if (['error', 'invalid', 'conflict'].includes(state.sdkStatus) || state.timedOut) {
      status.textContent = 'Cookie Preferences is unavailable. Reload this preview to try again.';
      preferences.disabled = true;
    }
  }
  unsubscribe = controller.subscribe(update);
  update(controller.snapshot());
  preferences.addEventListener('click', () => {
    requested = true;
    status.textContent = 'Opening Cookie Preferences…';
    preferences.disabled = true;
    controller.openPreferences();
    update(controller.snapshot());
  });
  dismiss.addEventListener('click', close);
  return controller;
}
