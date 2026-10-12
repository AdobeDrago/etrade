/* eslint-env node, es2022 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { DOMParser, parseHTML } from 'linkedom';
import {
  auditReferences, orderedEntries, pageDisclosurePath, parseSetSource,
  referenceMarkup, reorderedSource, resolveSetPath, saveOrder, sourceUrl, validateSet,
} from '../tools/plugins/disclosure-manager/model.js';

// linkedom needs an explicit html wrapper; browser DOMParser adds one automatically.
class BrowserParser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html>${html}</html>`, type);
  }
}
globalThis.DOMParser = BrowserParser;

const context = {
  org: 'adobedrago', repo: 'etrade', path: '/home', view: 'edit',
};
const path = '/disclosures/sets/homepage';
const entries = [
  { disclosureId: 'offer', fragment: '/disclosures/fragments/offer' },
  { disclosureId: 'fees', fragment: '/disclosures/fragments/fees' },
];

// DA Structured Content's real self-reference format, including extra authored data.
const source = `<body><header></header><main><div>
  <div class="da-form"><div><div><h3>x-schema-name</h3></div><div><p>disclosure-set</p></div></div>
    <div><div>customMetadata</div><div>keep me</div></div></div>
  <div class="disclosure-set">
    <div><div><h3 id="id">id</h3></div><div><p>homepage</p></div></div>
    <div><div><h3>introduction</h3></div><div><ul><li>self://#introduction-intro</li></ul></div></div>
    <div><div><h3>disclosures</h3></div><div><ul>
      <li><p>self://#disclosures-offer</p></li>
      <li>self://#disclosures-fees</li>
    </ul></div></div>
    <div><div>closing</div><div><ul><li>self://#closing-end</li></ul></div></div>
    <div><div>extra</div><div><p>Preserve &amp; protect this field</p></div></div>
  </div>
  <div class="introduction introduction-intro"><div><div>fragment</div><div>/disclosures/fragments/intro</div></div></div>
  <div class="disclosures disclosures-offer">
    <div><div><h3>disclosureId</h3></div><div><p>offer</p></div></div>
    <div><div>fragment</div><div>/disclosures/fragments/offer</div></div>
    <div><div>unknown</div><div><strong>Keep rich markup</strong></div></div>
  </div>
  <div class="disclosures disclosures-fees">
    <div><div>disclosureId</div><div>fees</div></div>
    <div><div>fragment</div><div>/disclosures/fragments/fees</div></div>
  </div>
  <div class="closing closing-end"><div><div>fragment</div><div>/disclosures/fragments/end</div></div></div>
</div></main><div class="da-metadata"><div>Preserve DA metadata</div></div><footer></footer></body>`;

test('page metadata supports backend blocks, authoring tables, and authored links', () => {
  assert.equal(pageDisclosurePath(`<body><main><div class="metadata"><div><div> Disclosures </div><div><p>${path}</p></div></div></div></main></body>`), path);
  assert.equal(pageDisclosurePath(`<table><tr><th colspan="2">Metadata</th></tr><tr><td>Disclosures</td><td><a href="${path}">Homepage set</a></td></tr></table>`), path);
  assert.equal(pageDisclosurePath('<html><head><meta name="disclosures" content="/set.json"></head><body></body></html>'), '/set.json');
  assert.equal(pageDisclosurePath('<body><main><p>No metadata</p></main></body>'), undefined);
});

test('set URLs resolve to same-site source paths and reject foreign and unsafe sources', () => {
  [path, `${path}.html`, `https://demo--etrade--adobedrago.aem.page${path}`,
    `https://main--etrade--adobedrago.aem.live${path}`,
    `https://da-sc.adobeaem.workers.dev/preview/adobedrago/etrade${path}`]
    .forEach((value) => assert.equal(resolveSetPath(value, context), path));
  assert.equal(resolveSetPath('/sets/example.json', context), '/sets/example.json');
  [undefined, '/homepage-disclosures', 'https://evil.example/set.json',
    'https://da-sc.adobeaem.workers.dev/preview/other/site/set', `${path}?x=1`, `${path}#anchor`]
    .forEach((value) => assert.throws(() => resolveSetPath(value, context)));
  ['/../private', '/nested/../private', '//evil.example/private', '/legal?other',
    '/legal#anchor', '/legal%2fother', '/legal//other', '/legal\\other', '/legal with spaces']
    .forEach((value) => assert.throws(() => sourceUrl(context, value)));
  assert.throws(() => sourceUrl({ org: 'org/other', repo: 'repo' }, path));
  assert.equal(sourceUrl(context, path), `https://admin.da.live/source/adobedrago/etrade${path}.html`);
});

test('HTML reordering preserves all other blocks, metadata, attributes and rich content', () => {
  const model = parseSetSource(source, path);
  assert.deepEqual(model.data.disclosures, entries);
  assert.deepEqual(validateSet(model), []);
  const html = reorderedSource(model, [1, 0]);
  assert.deepEqual(parseSetSource(html, path).data.disclosures, [...entries].reverse());
  const doc = new BrowserParser().parseFromString(html, 'text/html');
  const original = new BrowserParser().parseFromString(source, 'text/html');
  ['.da-form', '.introduction', '.closing', '.disclosures-offer', '.disclosures-fees', '.da-metadata']
    .forEach((selector) => {
      const actual = doc.querySelector(selector).outerHTML;
      const expected = original.querySelector(selector).outerHTML;
      assert.equal(actual, expected);
    });
  assert.ok(doc.querySelector('#id'));
  assert.match(html, /Preserve &amp; protect this field/);
  assert.equal(model.source, source);
  assert.deepEqual(model.data.disclosures, entries);
});

test('JSON reordering preserves schema envelope and unknown fields', () => {
  const payload = {
    metadata: { schemaName: 'disclosure-set', extra: true },
    data: {
      id: 'homepage',
      introduction: [{ fragment: '/intro' }],
      disclosures: entries,
      closing: [{ fragment: '/closing' }],
      extra: { nested: ['keep'] },
    },
  };
  const model = parseSetSource(JSON.stringify(payload), '/set.json');
  const reordered = JSON.parse(reorderedSource(model, [1, 0]));
  assert.deepEqual(reordered, {
    ...payload, data: { ...payload.data, disclosures: [...entries].reverse() },
  });
  assert.deepEqual(model.payload, payload);
  const bare = parseSetSource(JSON.stringify({ disclosures: entries, extra: true }), '/set.json');
  assert.equal(JSON.parse(reorderedSource(bare, [1, 0])).extra, true);
});

test('invalid IDs, duplicates, legacy numbers and incomplete orders cannot be saved', () => {
  const model = parseSetSource(JSON.stringify({
    disclosures: [
      ...entries, entries[0], { number: 4, fragment: '/legacy' },
      { disclosureId: 'a-b', fragment: '/bad' }, { disclosureId: 'bad', fragment: '/a/../b' },
    ],
  }), '/set.json');
  assert.equal(validateSet(model).length, 4);
  assert.throws(() => reorderedSource(model, [0, 1, 2, 3, 4, 5]), /Fix/);
  const valid = parseSetSource(source, path);
  [[0], [0, 0], [0, 2], [0, 0.5]].forEach((order) => {
    assert.throws(() => orderedEntries(valid, order));
  });
  const missing = source.replace('self://#disclosures-offer', 'self://#missing');
  assert.throws(() => parseSetSource(missing, path), /resolved/);
  assert.throws(() => parseSetSource(source.replace('<p>disclosure-set</p>', '<p>other-schema</p>'), path), /schema/);
});

test('audit follows stable IDs across repeated, grouped, late, and reordered references', () => {
  const html = `<body><main><p><sup>offer</sup><sup>fees,offer</sup>
    <a href="#disclosure-offer"><sup>offer</sup></a>
    <sup><a href="#disclosure-fees">fees</a></sup>
    <sup>missing</sup><sup>fees,missing</sup><sup>1</sup>
    <sup><a href="https://example.com">other</a></sup>
    <a href="#disclosure-offer">Claim <sup>offer</sup></a></p>
    <div class="disclosures"><sup>legal</sup></div></main></body>`;
  const audit = auditReferences(html, entries);
  assert.equal(audit.references, 5);
  assert.equal(audit.issues.filter((issue) => issue.type === 'error').length, 4);
  assert.equal(audit.issues.filter((issue) => issue.type === 'warn').length, 0);
  const changed = auditReferences(html, [...entries].reverse());
  assert.match(changed.issues[0].message, /2 \(#disclosure-offer\)/);
  const unknown = auditReferences('<body><main><sup>missing</sup></main></body>', entries);
  assert.equal(unknown.issues.filter((issue) => issue.type === 'warn').length, 2);
  assert.equal(referenceMarkup(['fees', 'offer', 'fees'], entries), '<sup>fees,offer</sup>');
  assert.throws(() => referenceMarkup(['missing'], entries));
  assert.throws(() => referenceMarkup(['offer<script>'], entries));
});

test('save uses the authenticated multipart Source API and leaves the page alone', async () => {
  const model = parseSetSource(source, path);
  const requests = [];
  const request = async (url, options = {}) => {
    requests.push({ url, options });
    return new Response(options.method === 'POST' ? '' : source);
  };
  const saved = await saveOrder(context, model, [1, 0], request);
  assert.deepEqual(saved.data.disclosures, [...entries].reverse());
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(new URL(requests[0].url).pathname, new URL(sourceUrl(context, path)).pathname);
  assert.ok(new URL(requests[0].url).searchParams.has('nocache'));
  assert.equal(requests[1].url, sourceUrl(context, path));
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.body.get('data').type, 'text/html');
  assert.deepEqual(parseSetSource(await requests[1].options.body.get('data').text(), path).data.disclosures, [...entries].reverse());
});

test('changed sources and failed saves keep the original snapshot and never report success', async () => {
  const model = parseSetSource(source, path);
  let writes = 0;
  await assert.rejects(saveOrder(context, model, [1, 0], async (url, options = {}) => {
    if (options.method) writes += 1;
    return new Response(source.replace('keep me', 'changed'));
  }), /changed since loading/);
  assert.equal(writes, 0);
  await assert.rejects(saveOrder(context, model, [1, 0], async (url, options = {}) => (
    new Response(options.method ? '' : source, { status: options.method ? 403 : 200 })
  )), /403/);
  assert.equal(model.source, source);
  assert.deepEqual(model.data.disclosures, entries);
});

async function uiHarness() {
  const base = new URL('../', import.meta.url);
  const entry = '/tools/plugins/disclosure-manager/disclosure-manager.js';
  const html = await readFile(new URL(`.${entry.replace(/\.js$/, '.html')}`, base), 'utf8');
  const { document, window } = parseHTML(html);
  window.location = new URL('http://localhost:3000/tools/plugins/disclosure-manager/disclosure-manager.html?demo=1');
  const contextVm = vm.createContext({
    document,
    window,
    DOMParser: BrowserParser,
    URL,
    URLSearchParams,
    Response,
    FormData,
    Blob,
    structuredClone,
    console,
  });
  const modules = new Map();
  const moduleFor = async (pathname) => {
    if (modules.has(pathname)) return modules.get(pathname);
    const code = await readFile(new URL(`.${pathname}`, base), 'utf8');
    const module = new vm.SourceTextModule(code, {
      context: contextVm,
      identifier: `http://localhost:3000${pathname}`,
      importModuleDynamically: async (specifier, parent) => {
        const child = await moduleFor(new URL(specifier, parent.identifier).pathname);
        await child.evaluate();
        return child;
      },
    });
    modules.set(pathname, module);
    await module.link((specifier) => moduleFor(new URL(specifier, module.identifier).pathname));
    return module;
  };
  const controller = await moduleFor(entry);
  await controller.evaluate();
  await controller.namespace.default;
  return { document, window };
}

async function until(check) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    // Each poll depends on the asynchronous UI operation completing.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, 10); });
  }
  assert.fail('The UI did not finish its operation.');
}

test('demo UI loads, audits, reorders, saves, inserts grouped IDs, and refreshes without DA', async () => {
  const { document, window } = await uiHarness();
  const byId = (id) => document.getElementById(id);
  const list = byId('disclosure-list');
  assert.match(byId('status').textContent, /Loaded 4/);
  assert.equal(list.children.length, 4);
  assert.equal(list.children[0].draggable, true);
  assert.match(byId('audit-summary').textContent, /4 matching reference\(s\) · 1 error/);
  const select = (position) => {
    const checkbox = list.children[position].querySelector('input');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change'));
  };
  select(1);
  select(0);
  assert.equal(byId('insert').disabled, false);
  list.children[0].querySelector('button[aria-label="Move offer down"]').click();
  assert.equal(list.children[0].querySelector('.entry-id').textContent, 'fees');
  assert.equal(byId('save').disabled, false);
  assert.equal(byId('insert').disabled, true);
  assert.match(byId('audit-summary').textContent, /Proposed order/);
  byId('save').click();
  await until(() => /Demo order saved/.test(byId('status').textContent));
  assert.equal(byId('save').disabled, true);
  assert.equal(byId('insert').disabled, false);
  byId('insert').click();
  assert.match(byId('demo-reference').textContent, /<sup>fees,offer<\/sup>/);
  byId('refresh').click();
  await until(() => /Loaded 4/.test(byId('status').textContent));
  assert.equal(list.children[0].querySelector('.entry-id').textContent, 'fees');
  document.querySelector('[data-panel="audit"]').click();
  assert.equal(byId('audit').hidden, false);
  assert.equal(byId('manage').hidden, true);
  assert.ok(byId('audit-output').querySelector('.error'));
});
