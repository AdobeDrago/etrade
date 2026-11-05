import startOneTrust from './onetrust.js';
import decorateLinkActions, { PRIVACY_ACTION } from './link-actions.js';

/** Open the real preference center, loading OneTrust on the first request if needed. */
const bound = new WeakSet();

export default function bindPrivacyChoices(root) {
  decorateLinkActions(root);
  const selector = `a[data-link-action="${PRIVACY_ACTION}"]`;
  const links = [...root.querySelectorAll(selector)];
  if (root.matches?.(selector)) links.unshift(root);
  links.forEach((link) => {
    if (bound.has(link)) return;
    bound.add(link);
    link.addEventListener('click', (event) => {
      if (link.dataset.linkAction !== PRIVACY_ACTION) return;
      if (window.etradeOneTrust) {
        event.preventDefault();
        window.etradeOneTrust.openPreferences();
        return;
      }
      if (typeof window.OneTrust?.ToggleInfoDisplay === 'function') {
        event.preventDefault();
        window.OneTrust.ToggleInfoDisplay();
        return;
      }
      // Existing consent integrations can claim the request before OneTrust is loaded.
      const request = new CustomEvent('privacy:open', { bubbles: true, cancelable: true });
      event.preventDefault();
      if (link.dispatchEvent(request)) startOneTrust().openPreferences();
    });
  });
}
