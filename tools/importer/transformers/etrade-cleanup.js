/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: E*TRADE site-wide cleanup.
 * All selectors verified against migration-work/cleaned.html.
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // OneTrust cookie consent / preference-center overlays (found: #onetrust-consent-sdk,
    // #onetrust-pc-sdk, #ot-fltr-modal, .onetrust-pc-dark-filter). Removed pre-parse so they
    // never interfere with block matching.
    WebImporter.DOMUtils.remove(element, [
      '#onetrust-consent-sdk',
      '#ot-fltr-modal',
      '.onetrust-pc-dark-filter',
      '[class*="onetrust"]',
      '[id^="ot-"]',
    ]);
  }

  if (hookName === TransformHook.afterTransform) {
    // Non-authorable site chrome and tracking artifacts (verified in cleaned.html):
    // header (lines 3-823, contains both <nav>s), footer (2132-2791), skip link,
    // and post-footer device/tracking elements (#host-info, #flash-object-div,
    // #RSADevicePrint, #DeviceTokenFSO), plus iframes/scripts/links/styles/noscript.
    WebImporter.DOMUtils.remove(element, [
      'header',
      'footer',
      'nav',
      '.skip-navigation',
      '#host-info',
      '#flash-object-div',
      '#RSADevicePrint',
      '#DeviceTokenFSO',
      'iframe',
      'noscript',
      'script',
      'link',
      'style',
    ]);

    // Strip inline event/tracking attributes left on authorable content.
    element.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('onclick');
      el.removeAttribute('data-track');
      el.removeAttribute('data-tracking');
    });
  }
}
