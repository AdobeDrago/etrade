/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser, parseHTML } from 'linkedom';
import {
  SAMPLE_XML, SCHEMA, SCHEMA_NAME, demoPath, loadProduct, parseProductXml,
  productFromSource, productSource, productXml, saveProduct, validateProduct,
} from '../tools/plugins/xml-tools/model.js';
import mountXmlTools from '../tools/plugins/xml-tools/controller.js';
import {
  loadPageXml, pagePath, pagePreview, pageXml, parsePageXml, samplePageXml, saveImportedPage,
} from '../tools/plugins/xml-tools/page-xml.js';

class BrowserParser {
  // linkedom needs the HTML wrapper supplied by browser DOMParser.
  // eslint-disable-next-line class-methods-use-this
  parseFromString(value, type) {
    return new DOMParser().parseFromString(type === 'text/html' && !/<html[\s>]/i.test(value) ? `<html>${value}</html>` : value, type);
  }
}
globalThis.DOMParser = BrowserParser;
const context = { org: 'adobedrago', repo: 'etrade' };
const path = '/xml-demo/products/sample-cash';
const schemaPath = `/.da/forms/schemas/${SCHEMA_NAME}`;
const example = parseProductXml(SAMPLE_XML);
const html = await readFile(new URL('../tools/plugins/xml-tools/xml-tools.html', import.meta.url), 'utf8');

function service(initial = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  const request = async (url, options = {}) => {
    const key = new URL(url).pathname.replace('/source/adobedrago/etrade', '').replace(/\.html$/, '');
    if (options.method === 'POST') {
      const file = options.body.get('data');
      assert.equal(file.type, 'text/html');
      const source = await file.text();
      writes.push({ key, source });
      files.set(key, source);
      return new Response('', { status: 200 });
    }
    return files.has(key) ? new Response(files.get(key)) : new Response('', { status: 404 });
  };
  return { files, writes, request };
}

test('XML upload survives editable fields, HTML storage, and XML export with escaped text', () => {
  const product = { ...example, name: 'Cash & savings <demo>', disclosure: 'Quotes " and apostrophes \' plus <script>alert(1)</script>.' };
  const xml = productXml(product);
  assert.match(xml, /Cash &amp; savings &lt;demo&gt;/);
  assert.deepEqual(parseProductXml(xml), product);
  const source = productSource(product);
  assert.deepEqual(productFromSource(source), product);
  assert.equal(new BrowserParser().parseFromString(source, 'text/html').querySelector('script'), null);
});

test('import rejects unsupported XML structures instead of silently dropping data', () => {
  ['', '<other/>', SAMPLE_XML.replace('<product>', '<product xmlns="urn:other">'),
    SAMPLE_XML.replace('</product>', '<extra>lost</extra></product>'),
    SAMPLE_XML.replace('</product>', '<id>duplicate</id></product>'),
    SAMPLE_XML.replace('Sample cash account', '<strong>Nested</strong>'),
    SAMPLE_XML.replace('<name>', '<name lang="en">'),
    SAMPLE_XML.replace('<product>', '<product>Unexpected text'),
    `<!DOCTYPE product [<!ENTITY external SYSTEM "file:///etc/passwd">]>${SAMPLE_XML}`,
    ' '.repeat(250001) + SAMPLE_XML,
  ].forEach((value) => assert.throws(() => parseProductXml(value)));
});

test('required fields, actual calendar dates, path-safe IDs and XML characters are validated', () => {
  [{ ...example, name: '' }, { ...example, rate: '' }, { ...example, id: '../home' },
    { ...example, effectiveDate: '2026-02-30' }, { ...example, effectiveDate: '2026-2-3' },
    { ...example, disclosure: String.fromCharCode(0) }, { ...example, disclosure: '\ud800' },
  ].forEach((value) => assert.throws(() => validateProduct(value)));
  assert.equal(validateProduct({ ...example, disclosure: 'Unicode ✓ 😀' }).disclosure, 'Unicode ✓ 😀');
});

test('DA requests are confined to the connected site and demo folder', async () => {
  ['/home', '/xml-demo/products/../home', '/xml-demo/products/a.html',
    '/xml-demo/products/a?x=1', '//other/a', '/xml-demo/products/a%2fb',
  ].forEach((value) => assert.throws(() => demoPath(value)));
  await assert.rejects(loadProduct({ ...context, org: 'other/site' }, path, () => assert.fail('Unsafe request')), /connection|Library/);
});

test('first save installs a dedicated SC schema and creates an editable document', async () => {
  const mock = service();
  const snapshot = await saveProduct(context, path, example, mock.request);
  assert.deepEqual(mock.writes.map((item) => item.key), [schemaPath, path]);
  const schemaDoc = new BrowserParser().parseFromString(mock.files.get(schemaPath), 'text/html');
  assert.deepEqual(JSON.parse(schemaDoc.querySelector('code').textContent), SCHEMA);
  assert.deepEqual(await loadProduct(context, path, mock.request), snapshot);
  const changed = { ...example, rate: '4.25%' };
  await saveProduct(context, path, changed, mock.request, snapshot);
  assert.equal(mock.writes.length, 3);
  assert.deepEqual(productFromSource(mock.files.get(path)), changed);
});

test('existing content and concurrent edits cannot be overwritten without loading the saved version', async () => {
  const mock = service({ [path]: productSource(example) });
  await assert.rejects(saveProduct(context, path, example, mock.request), /Load saved/);
  assert.equal(mock.writes.length, 0);
  const snapshot = await loadProduct(context, path, mock.request);
  mock.files.set(path, productSource({ ...example, name: 'Edited by another author' }));
  await assert.rejects(saveProduct(context, path, example, mock.request, snapshot), /changed/);
  assert.equal(mock.writes.length, 0);
});

test('schema mismatch and permission failures prevent document writes', async () => {
  const mock = service({ [schemaPath]: '<body><main><pre><code>{}</code></pre></main></body>' });
  await assert.rejects(saveProduct(context, path, example, mock.request), /schema in DA differs/);
  assert.equal(mock.writes.length, 0);
  await assert.rejects(saveProduct(context, path, example, async () => new Response('', { status: 403 })), /403/);
  assert.equal(mock.writes.length, 0);
});

test('failed schema creation does not write the product and failed product save is reported', async () => {
  const mock = service();
  const request = async (url, options) => (options?.method === 'POST'
    ? new Response('', { status: 500 }) : mock.request(url, options));
  await assert.rejects(saveProduct(context, path, example, request), /500/);
  assert.equal(mock.writes.length, 0);
});

test('standalone UI edits and exports XML, clears invalid imports, and never enables DA writes', () => {
  const { document, window } = parseHTML(html);
  const downloads = [];
  mountXmlTools(document, { download: (...args) => downloads.push(args) });
  document.getElementById('sample').click();
  assert.equal(document.getElementById('preview-rate').textContent, '4.10%');
  const rate = document.getElementById('product-rate');
  rate.value = '4.50%';
  rate.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.getElementById('download').click();
  assert.match(downloads[0][0], /<rate>4.50%<\/rate>/);
  assert.equal(downloads[0][1], 'sample-cash.xml');
  assert.equal(document.getElementById('save').disabled, true);
  assert.equal(document.getElementById('load').disabled, true);
  document.getElementById('xml-input').value = '<other/>';
  document.getElementById('import').click();
  assert.equal(document.getElementById('download').disabled, true);
  assert.equal(document.getElementById('product-preview').hidden, true);
});

test('connected UI saves through DA and links to SC editing and preview/live JSON', async () => {
  const { document } = parseHTML(html);
  const mock = service();
  const controller = mountXmlTools(document, { download: () => {} });
  controller.connect({ context, actions: { daFetch: mock.request } });
  document.getElementById('sample').click();
  document.getElementById('save').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.match(document.getElementById('status').textContent, /Saved in DA/);
  assert.equal(mock.writes.length, 2);
  assert.equal(document.getElementById('saved-links').hidden, false);
  assert.equal(document.getElementById('edit-link').href, `https://da.live/form#/adobedrago/etrade${path}`);
  assert.match(document.getElementById('preview-link').href, /\/preview\/adobedrago\/etrade\/xml-demo\/products\/sample-cash$/);
  assert.match(document.getElementById('live-link').href, /\/live\/adobedrago\/etrade\/xml-demo\/products\/sample-cash$/);
});

const pageSource = '<body><header></header><main><div><h1>Cash &amp; savings</h1><table><tbody><tr><td>Hero (Dark)</td></tr><tr><td><p>Offer &lt;demo&gt;</p><a href="/home?@tracking=hero&amp;x=1">Home</a></td></tr></tbody></table></div><div><div class="cards-product"><div><div>Card</div></div></div></div></main><footer></footer></body>';

test('general page XML preserves the complete saved source, rich markup and section inventory', () => {
  const xml = pageXml(pageSource, context, '/home');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  assert.equal(doc.documentElement.tagName, 'da-page');
  assert.equal(doc.documentElement.getAttribute('path'), '/home');
  assert.equal(doc.querySelector('source-html').textContent, pageSource);
  assert.equal(doc.querySelectorAll('section').length, 2);
  assert.equal(doc.querySelector('block').getAttribute('name'), 'Hero (Dark)');
  assert.equal(doc.querySelectorAll('block')[1].getAttribute('name'), 'cards-product');
  assert.match(doc.querySelector('block html').textContent, /@tracking=hero/);
  assert.throws(() => pageXml('<body>No main</body>', context, '/home'), /no main/);
  assert.throws(() => pageXml(`${pageSource}\u0001`, context, '/home'), /XML 1.0/);
});

test('page export confines reads to the connected site and never writes source', async () => {
  ['', '/', '//other/home', '/a/../home', '/a/./home', '/home?x=1', '/home#x', '/a%2fb', '/a\\b', 'https://other/home'].forEach((value) => assert.throws(() => pagePath(value)));
  assert.equal(pagePath('/what-we-offer/accounts.html'), '/what-we-offer/accounts');
  let calls = 0;
  const result = await loadPageXml(context, '/home', async (url, options) => {
    calls += 1;
    assert.equal(new URL(url).pathname, '/source/adobedrago/etrade/home.html');
    assert.equal(options.method, undefined);
    return new Response(pageSource);
  });
  assert.equal(calls, 1);
  assert.equal(result.filename, 'home.xml');
  await assert.rejects(loadPageXml({ ...context, org: 'other/site' }, '/home', () => assert.fail('Unsafe request')), /inside DA/);
  await assert.rejects(loadPageXml(context, '/missing', async () => new Response('', { status: 404 })), /404/);
});

test('page export works without importing a product and changing paths invalidates the download', async () => {
  const { document, window } = parseHTML(html);
  const downloads = [];
  const controller = mountXmlTools(document, { download: (...args) => downloads.push(args) });
  assert.equal(document.getElementById('export-page').disabled, true);
  controller.connect({ context, actions: { daFetch: service({ '/home': pageSource }).request } });
  document.getElementById('export-page').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.match(document.getElementById('page-export-status').textContent, /Loaded \/home/);
  document.getElementById('download-page').click();
  assert.match(downloads[0][0], /<da-page/);
  assert.equal(downloads[0][1], 'home.xml');
  const input = document.getElementById('page-path');
  input.value = '/another-page';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.getElementById('download-page').disabled, true);
  assert.equal(document.getElementById('page-export-result').hidden, true);
});

test('page XML imports the original rich source and metadata without changing blocks or link parameters', () => {
  const source = `${pageSource}\r\n<!-- preserve source whitespace -->`;
  const imported = parsePageXml(pageXml(source, context, '/home'));
  assert.equal(imported.source, source);
  assert.equal(imported.originalPath, '/home');
  assert.equal(imported.title, 'Cash & savings');
  assert.equal(imported.sections, 2);
  assert.equal(imported.blocks, 2);
  assert.match(imported.source, /@tracking=hero/);
  const sample = parsePageXml(samplePageXml());
  assert.match(sample.source, /noindex, nofollow/);
  assert.equal(sample.sections, 3);
  assert.equal(sample.blocks, 2);
});

test('XHTML pages import content with sections, rich text and links', () => {
  const xml = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A page</title></head><body><main><div><h1>Heading</h1><p>Content with <strong>emphasis</strong> and <a href="/accounts">a link</a>.</p></div></main></body></html>';
  const imported = parsePageXml(xml);
  assert.equal(imported.format, 'XHTML');
  assert.equal(imported.title, 'A page');
  assert.equal(imported.sections, 1);
  assert.match(imported.source, /<strong>emphasis<\/strong>/);
});

test('page import rejects wrong versions, ambiguous sources, DTDs and executable markup', () => {
  const xml = pageXml(pageSource, context, '/home');
  [SAMPLE_XML, xml.replace('version="1" org=', 'version="2" org='),
    xml.replace('</da-page>', '<source-html>extra</source-html></da-page>'),
    xml.replace('<source-html>', '<source-html><p>nested</p>'),
    xml.replace('path="/home"', 'path="/../home"'),
    `<!DOCTYPE da-page>${xml}`,
    pageXml(pageSource.replace('<h1>', '<script>alert(1)</script><h1>'), context, '/home'),
    pageXml(pageSource.replace('<h1>', '<h1 onclick="alert(1)">'), context, '/home'),
    pageXml(pageSource.replace('/home?@tracking=hero&amp;x=1', 'java&#10;script:alert(1)'), context, '/home'),
    '<html><body>No main content element</body></html>',
  ].forEach((input) => assert.throws(() => parsePageXml(input)));
  assert.match(pagePreview(pageSource), /default-src 'none'/);
  assert.match(pagePreview(pageSource), /Cash &amp; savings/);
});

test('import creates a new page only in the connected site and refuses overwrites or inaccessible targets', async () => {
  const imported = parsePageXml(pageXml(pageSource, { org: 'other', repo: 'site' }, '/home'));
  const destination = '/xml-demo/pages/home-copy';
  const mock = service();
  const saved = await saveImportedPage(context, destination, imported, mock.request);
  assert.equal(saved.path, destination);
  assert.equal(mock.files.get(destination), pageSource);
  assert.deepEqual(mock.writes.map((item) => item.key), [destination]);
  await assert.rejects(saveImportedPage(context, destination, imported, mock.request), /already exists/);
  assert.equal(mock.writes.length, 1);
  await assert.rejects(saveImportedPage(context, '/.da/config', imported, mock.request), /hidden/);
  await assert.rejects(saveImportedPage(context, '/other', imported, async () => new Response('', { status: 403 })), /403/);
  await assert.rejects(saveImportedPage(context, '/other', imported, async (url, options) => new Response('', { status: options?.method ? 500 : 404 })), /500/);
});

test('standalone page import previews and downloads actual page HTML; changed XML invalidates the result', () => {
  const { document, window } = parseHTML(html);
  const downloads = [];
  mountXmlTools(document, { download: (...args) => downloads.push(args) });
  document.getElementById('page-sample').click();
  assert.equal(document.getElementById('page-import-result').hidden, false);
  assert.match(document.getElementById('page-import-summary').textContent, /3 section\(s\)/);
  assert.match(document.getElementById('page-preview').getAttribute('srcdoc'), /Investing with confidence/);
  assert.equal(document.getElementById('page-preview').getAttribute('sandbox'), '');
  assert.equal(document.getElementById('create-page').disabled, true);
  document.getElementById('download-html').click();
  assert.equal(downloads[0][2], 'text/html;charset=utf-8');
  assert.match(downloads[0][0], /<main>/);
  const input = document.getElementById('page-xml-input');
  input.value = '<broken/>';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.getElementById('page-import-result').hidden, true);
  assert.equal(document.getElementById('download-html').disabled, true);
  assert.equal(document.getElementById('page-preview').getAttribute('srcdoc'), null);
});

test('connected page import creates an editable page and exposes its DA editor link', async () => {
  const { document } = parseHTML(html);
  const mock = service();
  const controller = mountXmlTools(document, { download: () => {} });
  controller.connect({ context, actions: { daFetch: mock.request } });
  document.getElementById('page-sample').click();
  document.getElementById('create-page').click();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.match(document.getElementById('page-import-status').textContent, /Created \/xml-demo\/pages\/investing-copy/);
  assert.equal(mock.writes.length, 1);
  assert.equal(document.getElementById('page-import-edit').href, 'https://da.live/canvas#/adobedrago/etrade/xml-demo/pages/investing-copy');
  assert.equal(document.getElementById('page-import-links').hidden, false);
  assert.equal(document.getElementById('create-page').disabled, false);
});
