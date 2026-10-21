import {
  MAX_PAGE_XML_BYTES, pagePath, pagePreview, parsePageXml, samplePageXml, saveImportedPage,
} from './page-xml.js';

export default function mountPageImport(doc, { download, onStatus } = {}) {
  const byId = (id) => doc.getElementById(id);
  let sdk;
  let imported;
  let busy = false;
  let revision = 0;

  function status(message, error = false) {
    byId('page-import-status').textContent = message;
    byId('page-import-status').classList.toggle('error', error);
    onStatus?.(message, error);
  }

  function render() {
    ['page-sample', 'import-page', 'page-file', 'page-xml-input', 'page-destination'].forEach((id) => { byId(id).disabled = busy; });
    byId('create-page').disabled = busy || !sdk || !imported;
    byId('download-html').disabled = busy || !imported;
    byId('page-import-result').hidden = !imported;
  }

  function clear() {
    imported = undefined;
    byId('page-import-links').hidden = true;
    byId('page-preview').removeAttribute('srcdoc');
    byId('page-html-output').value = '';
    render();
  }

  function importXml() {
    revision += 1;
    clear();
    try {
      imported = parsePageXml(byId('page-xml-input').value);
      byId('page-import-summary').textContent = `${imported.title} · ${imported.sections} section(s) · ${imported.blocks} block(s) · ${imported.format}`;
      byId('page-preview').setAttribute('srcdoc', pagePreview(imported.source));
      byId('page-html-output').value = imported.source;
      const name = imported.originalPath.split('/').pop();
      byId('page-destination').value = `/xml-demo/pages/${name}-copy`;
      status('XML page imported. Review the content, then create a new DA page or download its HTML.');
    } catch (error) {
      status(error.message, true);
    }
    render();
  }

  byId('page-sample').addEventListener('click', () => {
    byId('page-xml-input').value = samplePageXml();
    importXml();
  });
  byId('import-page').addEventListener('click', importXml);
  byId('page-xml-input').addEventListener('input', () => {
    revision += 1;
    clear();
    status('XML changed. Import it again to refresh the page preview.');
  });
  byId('page-file').addEventListener('change', async () => {
    const file = byId('page-file').files?.[0];
    if (!file) return;
    revision += 1;
    const current = revision;
    clear();
    try {
      if (file.size > MAX_PAGE_XML_BYTES) throw new Error('Choose a page XML file smaller than 12 MB.');
      const xml = await file.text();
      if (revision !== current) return;
      byId('page-xml-input').value = xml;
      importXml();
    } catch (error) {
      if (revision === current) status(error.message, true);
    }
  });
  byId('page-destination').addEventListener('input', () => { byId('page-import-links').hidden = true; });
  byId('download-html').addEventListener('click', () => {
    if (busy || !imported) return;
    try {
      const path = pagePath(byId('page-destination').value);
      download(imported.source, `${path.slice(1).replaceAll('/', '--')}.html`, 'text/html;charset=utf-8');
      status('DA page HTML downloaded. Connect through DA to create an editable page.');
    } catch (error) { status(error.message, true); }
  });
  byId('create-page').addEventListener('click', async () => {
    if (busy || !sdk || !imported) return;
    busy = true;
    revision += 1;
    render();
    status('Checking the new destination and creating the page in DA…');
    try {
      const result = await saveImportedPage(sdk.context, byId('page-destination').value, imported, sdk.actions.daFetch);
      const { org, repo } = sdk.context;
      byId('page-import-edit').href = `https://da.live/canvas#/${org}/${repo}${result.path}`;
      byId('page-import-links').hidden = false;
      status(`Created ${result.path} in DA. Open it to edit, then use Send → Preview / Publish.`);
    } catch (error) { status(error.message, true); } finally {
      busy = false;
      render();
    }
  });

  render();
  return {
    connect(connection) {
      sdk = connection;
      byId('page-import-connection').textContent = 'Connected to DA. Imported pages are created at the destination you choose.';
      render();
    },
  };
}
