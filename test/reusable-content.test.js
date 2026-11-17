/* eslint-env node */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { parseHTML } from 'linkedom';
import {
  cardRecord, newCardBlock, appendCardRow, fragmentReference,
} from '../tools/plugins/reusable-content/model.js';
import mountPicker from '../tools/plugins/reusable-content/reusable-content.js';
import { catalogFiles, createDirectory } from '../tools/plugins/reusable-content/source.js';

const { document } = parseHTML('<html></html>');
const record = cardRecord('/cards/product/featured', {
  metadata: { schemaName: 'card-product' },
  data: { id: 'featured', title: 'Featured <card>', description: 'Shared product' },
});

function parse(html) {
  const el = document.createElement('template');
  el.innerHTML = html;
  return el.content;
}

test('a card opens in the block specified by its schema and inserts a shared link as the only cell', () => {
  const [name, row] = parse(newCardBlock(document, record)).querySelectorAll('tr');
  assert.equal(name.textContent, 'cards-product');
  assert.equal(row.children.length, 1);
  const link = row.querySelector('a');
  assert.equal(link.getAttribute('href'), '/cards/product/featured');
  assert.equal(link.textContent, 'Featured <card>');
  assert.equal(row.querySelector('card'), null);
});

test('a row appends to the matching selected block while preserving the original block and guarding the write', () => {
  const html = '<main><div><div data-block-index="2" class="cards-product other"><div><div>Other</div></div></div><div data-block-index="22" class="cards-product featured"><div><div><h3>Keep me</h3></div><div>Rate settings</div></div></div></div></main>';
  const snapshot = { html, editable: true, selection: { blockIndex: 1 } };
  const next = appendCardRow(document, snapshot, record);
  assert.deepEqual(next.expected, { html, blockIndex: 1 });
  const block = parse(next.html).querySelector('.cards-product.featured');
  assert.equal(block.children.length, 2);
  assert.equal(block.firstElementChild.innerHTML, '<div><h3>Keep me</h3></div><div>Rate settings</div>');
  assert.equal(block.lastElementChild.querySelector('a').getAttribute('href'), '/cards/product/featured');
  const differentFamily = html.replace('cards-product featured', 'cards-account featured');
  assert.equal(appendCardRow(document, { ...snapshot, html: differentFamily }, record), null);
  assert.equal(appendCardRow(document, { ...snapshot, editable: false }, record), null);
});

test('non-card records and unsafe card paths cannot generate insertable card entries', () => {
  const data = { id: 'x', title: 'X' };
  assert.throws(() => cardRecord('/cards/product/../private', { metadata: { schemaName: 'card-product' }, data }));
  assert.throws(() => cardRecord('/cards/product/featured', { metadata: { schemaName: 'disclosure-set' }, data }));
  assert.throws(() => cardRecord('/cards/product/featured', { metadata: { schemaName: 'card-product' }, data: { title: 'X' } }));
});

test('HTML fragments still insert a single shared preview reference', () => {
  const html = fragmentReference(document, { org: 'adobedrago', repo: 'etrade' }, '/components/fragments/promo');
  const link = parse(html).querySelector('a.fragment');
  assert.equal(link.getAttribute('href'), 'https://main--etrade--adobedrago.aem.page/components/fragments/promo');
});

const context = { org: 'adobedrago', repo: 'etrade', view: 'edit' };

function sourceList(url) {
  const { pathname } = new URL(url);
  const path = pathname.replace('/adobedrago/sites/etrade/source', '');
  const entries = new Map([
    ['/', ['cards/', 'components/']],
    ['/cards/', ['product/']],
    ['/cards/product/', ['featured.html', 'data.json']],
    ['/components/', ['fragments/']],
    ['/components/fragments/', ['offer.html']],
  ]);
  return Response.json(entries.get(path).map((name) => ({
    name,
    'content-type': name.endsWith('/') ? 'application/folder' : 'text/html',
  })));
}

test('the catalog separates Structured Cards from HTML fragments and skips non-document files', async () => {
  const list = createDirectory(context, sourceList);
  const [cards, fragments] = await Promise.all([
    catalogFiles(list, 'card'),
    catalogFiles(list, 'fragment'),
  ]);
  assert.deepEqual(cards, ['/cards/product/featured']);
  assert.deepEqual(fragments, ['/components/fragments/offer']);
});

test('the AEM source catalog sends the DA token in the content-source authorization header', async () => {
  const list = createDirectory(context, (url, options) => {
    if (url.startsWith('https://api.aem.live/')
      && options.headers['x-content-source-authorization'] === 'Bearer example-da-token') {
      return sourceList(url);
    }
    if (url.startsWith('https://admin.da.live/')) return Response.json([]);
    return new Response(null, { status: 401 });
  }, 'example-da-token');
  assert.deepEqual(await catalogFiles(list, 'card'), ['/cards/product/featured']);
});

test('an empty AEM source response does not hide records from the DA source', async () => {
  const list = createDirectory(context, (url) => {
    if (url.startsWith('https://api.aem.live/')) return Response.json([]);
    const path = new URL(url).pathname.replace('/list/adobedrago/etrade', '');
    const entries = {
      '': [{ name: 'cards' }],
      '/cards': [{ name: 'product' }],
      '/cards/product': [{ name: 'featured', ext: 'html' }],
    };
    return Response.json(entries[path] || []);
  });
  assert.deepEqual(await catalogFiles(list, 'card'), ['/cards/product/featured']);
});

async function waitUntil(predicate) {
  const end = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < end, 'Timed out waiting for the picker');
    // eslint-disable-next-line no-await-in-loop -- The catalog and preview update asynchronously.
    await delay(10);
  }
}

test('selecting a card enables the correct action as the editor selection moves', async () => {
  const html = await readFile(new URL('../tools/plugins/reusable-content/reusable-content.html', import.meta.url), 'utf8');
  const { document: doc, window } = parseHTML(html);
  const writes = [];
  let update;
  const sdk = {
    context: { ...context, view: 'canvas' },
    capabilities: { liveDocument: 1, sendHTMLReplace: 1 },
    actions: {
      daFetch: sourceList,
      subscribeLiveDocument(callback) { update = callback; },
      sendHTML(markup, options) {
        writes.push({ markup, options });
        return options ? { ok: false, error: 'stale' } : undefined;
      },
    },
  };
  function fetchCard(url) {
    assert.equal(url, 'https://da-sc.adobeaem.workers.dev/preview/adobedrago/etrade/cards/product/featured');
    return Response.json({
      metadata: { schemaName: 'card-product' },
      data: {
        id: 'featured',
        title: 'Featured',
        description: 'One shared card',
        image: { src: './media_featured.png', alt: 'A preview of the account dashboard' },
      },
    });
  }
  await mountPicker(doc, sdk, fetchCard);
  doc.querySelector('[data-kind="card"]').click();
  await waitUntil(() => doc.querySelector('#results button'));
  doc.querySelector('#results button').click();
  await waitUntil(() => !doc.getElementById('card').hidden);
  const image = doc.querySelector('#card img');
  assert.equal(image.getAttribute('src'), 'https://main--etrade--adobedrago.aem.page/cards/product/media_featured.png');
  assert.equal(image.getAttribute('alt'), 'A preview of the account dashboard');
  image.dispatchEvent(new window.Event('error'));
  assert.equal(doc.querySelector('#card img'), null);
  assert.equal(doc.getElementById('card').hidden, false);
  const append = doc.getElementById('append-card');
  const create = doc.getElementById('create-card');
  const current = '<main><div><div class="cards-product" data-block-index="2"><div><div>Existing card</div></div></div></div></main>';
  update({ html: current, editable: true, selection: { blockIndex: 0 } });
  assert.equal(append.disabled, false);
  assert.equal(create.disabled, true);
  append.click();
  await waitUntil(() => doc.getElementById('status').textContent.includes('could not add'));
  assert.equal(writes[0].options.replace, true);
  assert.deepEqual(writes[0].options.expected, { html: current, blockIndex: 0 });
  const inserted = parse(writes[0].markup).querySelector('a');
  assert.equal(inserted.getAttribute('href'), '/cards/product/featured');

  update({ html: current, editable: true, selection: { blockIndex: null } });
  assert.equal(append.disabled, true);
  assert.equal(create.disabled, false);
  create.click();
  assert.equal(writes[1].options, undefined);
  assert.equal(parse(writes[1].markup).querySelector('tr').textContent, 'cards-product');

  const search = doc.getElementById('search');
  search.value = '/cards/product/another.html';
  search.dispatchEvent(new window.Event('input'));
  assert.equal(doc.querySelector('#results button').textContent, 'Preview /cards/product/another');
});
