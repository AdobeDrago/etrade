import {
  DEMO_FOLDER, FIELDS, MAX_XML_BYTES, SAMPLE_XML, demoPath, loadProduct,
  parseProductXml, productXml, saveProduct, validateProduct,
} from './model.js';
import { currentPagePath, loadPageXml } from './page-xml.js';
import mountPageImport from './page-import.js';

export default function mountXmlTools(doc, { download } = {}) {
  const byId = (id) => doc.getElementById(id);
  const inputs = FIELDS.map((key) => doc.querySelector(`[data-field="${key}"]`));
  let sdk;
  let product;
  let snapshot;
  let busy = false;
  let revision = 0;
  let pageExport;
  let pageDirty = false;
  let connectionRevision = 0;

  function currentPath() {
    try { return currentPagePath(sdk?.context); } catch { return undefined; }
  }

  function status(message, error = false) {
    byId('status').textContent = message;
    byId('status').classList.toggle('error', error);
  }

  const pageImporter = mountPageImport(doc, { download, onStatus: status });

  function links(path) {
    const { org, repo } = sdk.context;
    const edit = new URL('https://da.live/form');
    edit.hash = `/${org}/${repo}${path}`;
    byId('edit-link').href = edit.href;
    const base = 'https://da-sc.adobeaem.workers.dev';
    byId('preview-link').href = `${base}/preview/${org}/${repo}${path}`;
    byId('live-link').href = `${base}/live/${org}/${repo}${path}`;
    byId('saved-links').hidden = false;
  }

  function render() {
    byId('fields').disabled = busy || !product;
    byId('sample').disabled = busy;
    byId('import').disabled = busy;
    byId('file').disabled = busy;
    byId('xml-input').disabled = busy;
    byId('document-path').disabled = busy;
    let valid;
    try {
      const values = Object.fromEntries(inputs.map((input) => [input.dataset.field, input.value]));
      valid = product && validateProduct(values);
    } catch (error) {
      byId('field-status').textContent = error.message;
    }
    byId('download').disabled = busy || !valid;
    byId('save').disabled = busy || !valid || !sdk;
    byId('load').disabled = busy || !sdk;
    byId('page-path').disabled = busy;
    byId('export-page').disabled = busy || !sdk;
    byId('export-current-page').disabled = busy || !currentPath();
    byId('download-page').disabled = busy || !pageExport;
    byId('product-preview').hidden = !valid;
    byId('preview-empty').hidden = Boolean(valid);
    byId('xml-output').value = valid ? productXml(valid) : '';
    if (valid) {
      byId('field-status').textContent = 'Fields are valid. Edits update the preview and XML immediately.';
      byId('preview-name').textContent = valid.name;
      byId('preview-rate').textContent = valid.rate;
      byId('preview-date').textContent = `Effective ${valid.effectiveDate}`;
      byId('preview-disclosure').textContent = valid.disclosure;
    }
    return valid;
  }

  function fill(next) {
    product = next;
    inputs.forEach((input) => { input.value = next?.[input.dataset.field] || ''; });
    if (!next) byId('field-status').textContent = 'Import valid XML to enable editing.';
    render();
  }

  function importXml() {
    revision += 1;
    try {
      const next = parseProductXml(byId('xml-input').value);
      fill(next);
      if (!snapshot) byId('document-path').value = `${DEMO_FOLDER}${next.id}`;
      status('XML imported. Edit the fields, download XML, or save the product in DA.');
    } catch (error) {
      fill(undefined);
      status(error.message, true);
    }
  }

  byId('sample').addEventListener('click', () => {
    byId('xml-input').value = SAMPLE_XML;
    importXml();
  });
  byId('import').addEventListener('click', importXml);
  byId('file').addEventListener('change', async () => {
    const file = byId('file').files?.[0];
    if (!file) return;
    revision += 1;
    const current = revision;
    try {
      if (file.size > MAX_XML_BYTES) throw new Error('Choose an XML file smaller than 250 KB.');
      const text = await file.text();
      if (current !== revision) return;
      byId('xml-input').value = text;
      importXml();
    } catch (error) {
      if (current !== revision) return;
      fill(undefined);
      status(error.message, true);
    }
  });
  byId('xml-input').addEventListener('input', () => { revision += 1; });
  byId('fields').addEventListener('input', () => { revision += 1; render(); });
  byId('document-path').addEventListener('input', () => { byId('saved-links').hidden = true; });
  byId('download').addEventListener('click', () => {
    const value = render();
    if (!value) return;
    download(productXml(value), `${value.id}.xml`);
    status('XML downloaded from the current fields. Save and publish in DA separately to update delivered content.');
  });

  async function operate(action) {
    if (busy || !sdk) return;
    const connection = sdk;
    const connectedAt = connectionRevision;
    const value = render();
    busy = true;
    revision += 1;
    render();
    status(action === 'save' ? 'Saving the product and checking its schema in DA…' : 'Loading the saved DA document…');
    try {
      const path = demoPath(byId('document-path').value.trim());
      const result = action === 'save'
        ? await saveProduct(connection.context, path, value, connection.actions.daFetch, snapshot)
        : await loadProduct(connection.context, path, connection.actions.daFetch);
      if (connectedAt !== connectionRevision) return;
      snapshot = result;
      fill(result.product);
      byId('xml-input').value = productXml(result.product);
      links(path);
      status(action === 'save'
        ? 'Saved in DA. Open the SC editor to review, then use Send → Preview / Publish. The JSON links become available after those steps.'
        : 'Saved DA content loaded. Edit the fields and save, or download XML.');
    } catch (error) {
      if (connectedAt === connectionRevision) status(error.message, true);
    } finally {
      busy = false;
      render();
    }
  }

  byId('save').addEventListener('click', () => operate('save'));
  byId('load').addEventListener('click', () => operate('load'));
  byId('page-path').addEventListener('input', () => {
    pageDirty = true;
    pageExport = undefined;
    byId('page-xml-output').value = '';
    byId('page-export-result').hidden = true;
    byId('page-export-status').textContent = 'Load the saved page to create its XML export.';
    render();
  });
  byId('export-current-page').addEventListener('click', () => {
    if (busy || !currentPath()) return;
    byId('page-path').value = currentPath();
    pageDirty = false;
    byId('export-page').click();
  });
  byId('export-page').addEventListener('click', async () => {
    if (busy || !sdk) return;
    const connection = sdk;
    const connectedAt = connectionRevision;
    busy = true;
    pageExport = undefined;
    byId('page-export-result').hidden = true;
    byId('page-export-status').textContent = 'Reading the saved page from DA…';
    render();
    try {
      const result = await loadPageXml(connection.context, byId('page-path').value, connection.actions.daFetch);
      if (connectedAt !== connectionRevision) return;
      pageExport = result;
      byId('page-xml-output').value = pageExport.xml;
      byId('page-export-result').hidden = false;
      byId('page-export-status').textContent = `Loaded ${pageExport.path}. Download its XML below. The original page is unchanged.`;
    } catch (error) {
      if (connectedAt === connectionRevision) byId('page-export-status').textContent = error.message;
    } finally { busy = false; render(); }
  });
  byId('download-page').addEventListener('click', () => {
    if (pageExport && !busy) download(pageExport.xml, pageExport.filename);
  });
  render();
  return {
    connect(connection) {
      if (!connection?.actions?.daFetch || !/^[a-z0-9-]+$/i.test(connection.context?.org || '')
        || !/^[a-z0-9-]+$/i.test(connection.context?.repo || '')) throw new Error('DA did not provide a valid site connection.');
      connectionRevision += 1;
      snapshot = undefined;
      pageExport = undefined;
      byId('saved-links').hidden = true;
      byId('page-export-result').hidden = true;
      byId('page-xml-output').value = '';
      sdk = connection;
      pageImporter.connect(connection);
      if (!pageDirty && typeof sdk.context.path === 'string' && sdk.context.path.startsWith('/')) {
        byId('page-path').value = sdk.context.path;
      }
      byId('connection').textContent = `Connected · ${sdk.context.org}/${sdk.context.repo}`;
      byId('save-help').textContent = 'Save a demo document, then open its SC editor to review and publish. Your current page is unchanged.';
      byId('page-export-status').textContent = currentPath()
        ? `Editing ${currentPath()}. Export this page, or enter another saved page path.`
        : 'Enter a saved page path, then prepare its XML export.';
      status('Connected to DA. Export a saved page or review an XML file to import.');
      render();
    },
    connectionError(message) { status(message, true); },
  };
}
