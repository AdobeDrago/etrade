import mountXmlTools from './controller.js';

function download(content, filename, type = 'application/xml;charset=utf-8') {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

const controller = mountXmlTools(document, { download });
const standalone = window.parent === window || new URLSearchParams(window.location.search).get('demo') === '1';
if (!standalone) {
  (async () => {
    try {
      // DA owns authentication and refresh; no credentials are stored by the plugin.
      // eslint-disable-next-line import/no-unresolved, import/extensions
      const { default: sdk } = await import('https://da.live/nx/utils/sdk.js');
      controller.connect(await sdk);
    } catch {
      controller.connectionError('Could not connect to DA. Reopen XML Tools from the Library. Import, editing, and XML download remain available.');
    }
  })();
}
