import {
  MAX_PAGE_XML_BYTES, currentPagePath, loadCurrentPage, pagePath, pagePreview, parsePageXml,
  replaceCurrentPage, samplePageXml, saveImportedPage,
} from './page-xml.js';

export default function mountPageImport(doc, { download, onStatus } = {}) {
  const byId = (id) => doc.getElementById(id);
  let sdk;
  let imported;
  let busy = false;
  let revision = 0;
  let pendingOverwrite;
  const dialog = byId('page-overwrite-dialog');

  function currentPath() {
    try { return currentPagePath(sdk?.context); } catch { return undefined; }
  }

  const importsToCurrent = () => byId('page-import-target').value === 'current';

  function status(message, error = false) {
    byId('page-import-status').textContent = message;
    byId('page-import-status').classList.toggle('error', error);
    onStatus?.(message, error);
  }

  function render() {
    const locked = busy || Boolean(pendingOverwrite);
    ['page-sample', 'import-page', 'page-file', 'page-xml-input', 'page-destination', 'page-import-target'].forEach((id) => { byId(id).disabled = locked; });
    const current = importsToCurrent();
    byId('new-page-options').hidden = current;
    byId('current-page-options').hidden = !current;
    byId('create-page').hidden = current;
    byId('create-page').disabled = locked || current || !sdk || !imported;
    byId('import-current-page').hidden = !current;
    byId('import-current-page').disabled = locked || !current || !currentPath() || !imported;
    byId('current-page-path').textContent = currentPath() || 'Unavailable outside a DA page editor';
    byId('download-html').disabled = locked || !imported;
    byId('page-import-result').hidden = !imported;
  }

  function closeConfirmation() {
    pendingOverwrite = undefined;
    if (dialog.open) dialog.close();
  }

  function clear() {
    closeConfirmation();
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
      status('XML page imported. Review the content, then choose a new DA page or the current page, or download its HTML.');
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
  byId('page-import-target').addEventListener('change', () => {
    closeConfirmation();
    byId('page-import-links').hidden = true;
    render();
  });
  byId('page-destination').addEventListener('input', () => { byId('page-import-links').hidden = true; });
  byId('download-html').addEventListener('click', () => {
    if (busy || !imported) return;
    try {
      const path = importsToCurrent() ? currentPath() || imported.originalPath
        : pagePath(byId('page-destination').value);
      download(imported.source, `${path.slice(1).replaceAll('/', '--')}.html`, 'text/html;charset=utf-8');
      status('DA page HTML downloaded. Connect through DA to create an editable page.');
    } catch (error) { status(error.message, true); }
  });
  byId('create-page').addEventListener('click', async () => {
    if (busy || pendingOverwrite || importsToCurrent() || !sdk || !imported) return;
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

  byId('import-current-page').addEventListener('click', async () => {
    if (busy || pendingOverwrite || !importsToCurrent() || !currentPath() || !imported) return;
    busy = true;
    revision += 1;
    const current = revision;
    byId('page-import-links').hidden = true;
    render();
    status('Checking the current DA page before confirming the import…');
    try {
      const snapshot = await loadCurrentPage(sdk.context, sdk.actions.daFetch);
      if (revision !== current) return;
      pendingOverwrite = { snapshot, imported };
      byId('page-overwrite-path').textContent = snapshot.path;
      dialog.showModal();
      status('Confirm the overwrite to import onto the current page, or cancel to keep its existing content.');
    } catch (error) {
      closeConfirmation();
      status(error.message, true);
    } finally {
      busy = false;
      render();
    }
  });
  function cancelOverwrite() {
    closeConfirmation();
    status('Import cancelled. The current page is unchanged.');
    render();
    byId('import-current-page').focus?.();
  }

  byId('cancel-page-overwrite').addEventListener('click', cancelOverwrite);
  dialog.addEventListener('cancel', cancelOverwrite);
  byId('confirm-page-overwrite').addEventListener('click', async () => {
    if (busy || !pendingOverwrite || !sdk) return;
    const { snapshot, imported: content } = pendingOverwrite;
    busy = true;
    revision += 1;
    closeConfirmation();
    render();
    status('Importing content onto the current DA page…');
    try {
      const result = await replaceCurrentPage(sdk.context, content, sdk.actions.daFetch, snapshot);
      const { org, repo } = sdk.context;
      byId('page-import-edit').href = `https://da.live/canvas#/${org}/${repo}${result.path}`;
      byId('page-import-links').hidden = false;
      status(`Imported content onto ${result.path} in DA. Review the page, then use Send → Preview / Publish.`);
    } catch (error) { status(error.message, true); } finally {
      busy = false;
      render();
    }
  });

  render();
  return {
    connect(connection) {
      revision += 1;
      closeConfirmation();
      sdk = connection;
      byId('page-import-connection').textContent = 'Connected to DA. Create a new page, or import onto the current page after confirming the overwrite.';
      render();
    },
  };
}
