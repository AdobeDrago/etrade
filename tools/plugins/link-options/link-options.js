import mountLinkOptions from './controller.js';

async function init() {
  const controller = mountLinkOptions(document);
  const demo = new URLSearchParams(window.location.search).get('demo') === '1';
  if (demo) {
    document.getElementById('demo-notice').hidden = false;
    controller.fill({
      href: '/home?campaign=fall', label: 'Explore accounts', target: '_self', enabled: true, key: 'home-link', category: 'C0004',
    });
    return;
  }
  if (window.parent === window) return;
  // Read-only selection access. Native DA editing remains responsible for save and undo.
  // eslint-disable-next-line import/no-unresolved
  const { default: DA_SDK } = await import('https://da.live/nx/utils/sdk.js');
  let timer;
  const sdk = await Promise.race([
    DA_SDK,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('DA did not connect. You can still paste a destination URL below.')), 15000);
    }),
  ]).finally(() => clearTimeout(timer));
  await controller.connect(sdk);
}

export default init().catch(() => {
  document.getElementById('status').textContent = 'DA selection access is unavailable. Paste a destination URL below to configure it.';
});
