/** Demo tools are restricted to local development and explicitly named demo previews. */
export default function isDemoHelperHost(hostname = '') {
  return [
    'localhost', '127.0.0.1', '[::1]',
    'demo--etrade--adobedrago.aem.page',
    'demo-controller--etrade--adobedrago.aem.page',
  ]
    .includes(hostname.toLowerCase());
}
