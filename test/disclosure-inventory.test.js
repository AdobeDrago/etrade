/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { parseSetSource } from '../tools/plugins/disclosure-manager/model.js';
import { planAffectedSources } from '../tools/plugins/disclosure-manager/inventory.js';

class Parser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html>${html}</html>`, type);
  }
}
globalThis.DOMParser = Parser;
const context = { org: 'adobedrago', repo: 'etrade', path: '/home' };
const path = '/disclosures/sets/homepage.json';
const source = JSON.stringify({ id: 'homepage', disclosures: [{ disclosureId: '1', fragment: '/terms/one' }, { disclosureId: '2', fragment: '/terms/two' }] });
const page = (set, content) => `<body><main>${content}<div class="metadata"><div><div>Disclosures</div><div>${set}</div></div></div></main></body>`;
const loadModel = () => parseSetSource(source, path);
const review = (request) => planAffectedSources(context, loadModel(), [1, 0], request);
const fragment = (value) => `<div class="fragment"><div><div><a href="${value}">${value}</a></div></div></div>`;

function fixture(extra = []) {
  const sources = new Map([
    [path, source], ['/terms/one', '<body><main><p>One</p></main></body>'], ['/terms/two', '<body><main><p>Two</p></main></body>'],
    ['/home', page(path, `<p>Offer<sup>1</sup></p>${fragment('/copy/shared')}<a href="/ordinary">Ordinary link</a>`)],
    ['/drafts/other', page(path, fragment('/copy/shared'))],
    ['/copy/shared', `<body><main><p>Shared<sup>2,1</sup></p>${fragment('/copy/nested')}</main></body>`],
    ['/copy/nested', `<body><main><p>Nested<sup>1</sup></p>${fragment('/copy/shared')}</main></body>`],
    ['/ordinary', '<body><main><p>Ordinary<sup>1</sup></p></main></body>'],
    ...extra,
  ]);
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://admin.da.live');
    const site = '/adobedrago/etrade';
    if (parsed.pathname.startsWith(`/list${site}`)) {
      const folder = parsed.pathname.slice(`/list${site}`.length);
      const children = new Map();
      [...sources.keys()].forEach((key) => {
        if (!key.startsWith(`${folder}/`)) return;
        const relative = key.slice(folder.length + 1);
        const [name] = relative.split('/');
        if (relative.includes('/')) children.set(name, { path: `${site}${folder}/${name}`, name });
        else {
          const ext = key.endsWith('.json') ? 'json' : 'html';
          children.set(name, { path: `${site}${key}${ext === 'html' ? '.html' : ''}`, name, ext });
        }
      });
      return Response.json([...children.values()]);
    }
    const key = parsed.pathname.slice(`/source${site}`.length).replace(/\.html$/, '');
    return new Response(sources.get(key) || '', { status: sources.has(key) ? 200 : 404 });
  };
  return { sources, calls, request };
}

test('inventory includes every matching page and nested fragment once, including drafts and cycles', async () => {
  const server = fixture();
  const result = await review(server.request);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.writes.map((item) => item.path).sort(), ['/copy/nested', '/copy/shared', '/home', path].sort());
  assert.equal(result.writes.at(-1).path, path);
  assert.equal(result.scanned, server.sources.size);
  assert.ok(result.affectedPages.includes('/drafts/other'));
  assert.ok(result.affectedPages.includes('/home'));
  assert.equal(result.writes.some((item) => item.path === '/ordinary'), false);
  assert.match(result.writes.find((item) => item.path === '/copy/shared').target, /<sup>1,2<\/sup>/);
  assert.ok(result.inventory.directories.some((item) => item.path === '/drafts'));
});

test('shared unqualified citations consumed by another set block the batch', async () => {
  const server = fixture([['/other', page('/disclosures/sets/other.json', fragment('/copy/shared'))], ['/disclosures/sets/other.json', JSON.stringify({ id: 'other', disclosures: [{ disclosureId: '1', fragment: '/terms/one' }] })]]);
  const result = await review(server.request);
  assert.ok(result.issues.some((issue) => /shared|another set/i.test(issue.message) && issue.message.includes('/other')));
});

test('automatically embedded fragment links participate in renumbering and shared-set checks', async () => {
  const server = fixture([['/fragments/offer', '<body><main><p>Claim<sup>1</sup></p></main></body>']]);
  const embedded = '<p><a href="/fragments/offer">Offer</a></p>';
  server.sources.set('/home', page(path, embedded));
  const result = await review(server.request);
  assert.deepEqual(result.issues, []);
  assert.match(result.writes.find((item) => item.path === '/fragments/offer')?.target || '', /<sup>2<\/sup>/);
  server.sources.set('/other', page('/disclosures/sets/other.json', embedded));
  const conflict = await review(server.request);
  assert.ok(conflict.issues.some((item) => /Shared source.*\/fragments\/offer/.test(item.message)));
});

test('incomplete enumeration, unsafe returned paths and missing embedded sources block saving', async () => {
  const server = fixture();
  const failed = await review(async (url) => (
    url.includes('/list/adobedrago/etrade/drafts') ? new Response('', { status: 403 }) : server.request(url)
  ));
  assert.match(failed.issues[0].message, /403|enumerat/i);
  const unsafe = await review(async (url) => (
    url.includes('/list/') ? Response.json([{ path: '/other/site/private.html', ext: 'html' }]) : server.request(url)
  ));
  assert.match(unsafe.issues[0].message, /site|path/i);
  server.sources.delete('/copy/nested');
  const missing = await review(server.request);
  assert.ok(missing.issues.some((issue) => issue.message.includes('/copy/nested')));
});

test('an invalid fragment on an unrelated page does not abort a complete consumer review', async () => {
  const server = fixture([['/unrelated', page('/disclosures/sets/other.json', fragment('/broken/'))]]);
  const result = await review(server.request);
  assert.deepEqual(result.issues, []);
  assert.ok(result.affectedPages.includes('/home'));
  assert.match(result.writes.find((item) => item.path === '/home').target, /<sup>2<\/sup>/);
  assert.equal(result.writes.some((item) => item.path === '/unrelated'), false);
  assert.equal(result.scanned, server.sources.size);
});

test('an affected page reports its invalid reference without losing the consumer graph', async () => {
  const server = fixture();
  server.sources.set('/home', page(path, `${fragment('/broken/')}<p>Claim<sup>1</sup></p>`));
  const result = await review(server.request);
  assert.ok(result.affectedPages.includes('/home'));
  assert.ok(result.issues.some((item) => item.message.includes('/home') && item.message.includes('/broken/')));
});

test('an invalid reference cannot conceal another consumer of shared citations', async () => {
  const server = fixture([['/unrelated', page('/disclosures/sets/other.json', `${fragment('/broken/')} ${fragment('/copy/shared')}`)]]);
  const result = await review(server.request);
  assert.ok(result.issues.some((item) => /Shared source.*\/copy\/shared/.test(item.message) && item.message.includes('/unrelated')));
});

test('structured content dependencies and explicit citation fields are part of the affected graph', async () => {
  const server = fixture([['/cards/offer.json', JSON.stringify({ data: { bodyFragment: '/copy/nested', disclosureIds: ['1'], amount: 123 } })]]);
  server.sources.set('/home', page(path, fragment('/cards/offer.json')));
  const result = await review(server.request);
  assert.deepEqual(result.issues, []);
  const card = JSON.parse(result.writes.find((item) => item.path === '/cards/offer.json').target);
  assert.deepEqual(card.data.disclosureIds, ['2']);
  assert.equal(card.data.amount, 123);
});

test('a changed set snapshot and an empty required fragment prevent a reviewed plan', async () => {
  const server = fixture();
  server.sources.set(path, `${source} `);
  const changed = await review(server.request);
  assert.match(changed.issues[0].message, /changed/i);
  server.sources.set(path, source);
  server.sources.set('/terms/one', '<body><main></main></body>');
  const empty = await review(server.request);
  assert.ok(empty.issues.some((issue) => /empty/i.test(issue.message)));
});

test('structured form migration requires a numeric-capable live schema before any source writes', async () => {
  const api = fixture();
  const formPath = '/disclosures/sets/qa';
  const fields = ['a', 'b'].map((id, index) => `<div class="disclosures disclosures-${index}"><div><div>disclosureId</div><div>${id}</div></div><div><div>fragment</div><div>/terms/${index ? 'two' : 'one'}</div></div></div>`).join('');
  const formSource = `<body><main><div><div class="da-form"><div><div>x-schema-name</div><div>disclosure-set</div></div></div><div class="disclosure-set"><div><div>id</div><div>qa</div></div><div><div>disclosures</div><div><ul><li>self://#disclosures/0</li><li>self://#disclosures/1</li></ul></div></div></div>${fields}</div></main></body>`;
  api.sources.set(formPath, formSource);
  api.sources.set('/qa-page', page(formPath, '<p>Claim<sup>a</sup></p>'));
  const schemaPath = '/.da/forms/schemas/disclosure-set';
  const schema = (pattern) => `<body><main><pre><code>${JSON.stringify({ properties: { disclosures: { items: { properties: { disclosureId: { type: 'string', pattern } } } } } })}</code></pre></main></body>`;
  api.sources.set(schemaPath, schema('^[a-z][a-z0-9]*$'));
  const model = parseSetSource(formSource, formPath);
  const blocked = await planAffectedSources(context, model, [1, 0], api.request);
  assert.ok(blocked.issues.some((issue) => /schema/i.test(issue.message)));
  api.sources.set(schemaPath, schema('^(?:[a-z][a-z0-9]*|[1-9][0-9]*)$'));
  const allowed = await planAffectedSources(context, model, [1, 0], api.request);
  assert.deepEqual(allowed.issues, []);
  assert.ok(allowed.guards.some((guard) => guard.path === schemaPath));
});
