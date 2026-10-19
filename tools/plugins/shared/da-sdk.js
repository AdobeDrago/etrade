/** Connect authoring tools through Adobe's SDK, with a bounded, actionable failure. */
export default async function connectDA({
  timeout = 12000,
  loadSDK = () => import('https://da.live/nx/utils/sdk.js'), // eslint-disable-line import/no-unresolved
} = {}) {
  if (window.parent === window) throw new Error('Open this tool from the DA Library to connect to your page.');
  let timer;
  try {
    const sdk = await Promise.race([
      loadSDK().then((module) => module.default),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('DA connection timed out. Sign in to DA, check the Library path and editor ref, then reload the plugin.')), timeout);
      }),
    ]);
    if (!sdk?.context?.org || !sdk.context.repo || !sdk.context.path
      || typeof sdk.actions?.daFetch !== 'function') {
      throw new Error('DA did not provide a page context. Reopen this tool through the DA Library.');
    }
    return sdk;
  } catch (error) {
    throw new Error(`Could not connect to DA. ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
