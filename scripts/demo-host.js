/** Demo tools are restricted to local development and the exact demo preview. */
export default function isDemoHelperHost(hostname = '') {
  return ['localhost', '127.0.0.1', '[::1]', 'demo--etrade--adobedrago.aem.page']
    .includes(hostname.toLowerCase());
}
