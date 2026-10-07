/** Bind authored privacy links to an installed CMP, preserving their fallback URL. */
const bound = new WeakSet();

export default function bindPrivacyChoices(root) {
  root.querySelectorAll('a:has(.icon-privacy-options)').forEach((link) => {
    if (bound.has(link)) return;
    bound.add(link);
    link.addEventListener('click', (event) => {
      if (typeof window.OneTrust?.ToggleInfoDisplay === 'function') {
        event.preventDefault();
        window.OneTrust.ToggleInfoDisplay();
        return;
      }
      // Other consent managers can handle this event and cancel the fallback navigation.
      const request = new CustomEvent('privacy:open', { bubbles: true, cancelable: true });
      if (!link.dispatchEvent(request)) event.preventDefault();
    });
  });
}
