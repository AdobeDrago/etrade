/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { parseSetSource } from '../tools/plugins/disclosure-manager/model.js';
import { numberedDisclosureSchema, renumberPlan, rewriteDisclosureReferences } from '../tools/plugins/disclosure-manager/renumber.js';

class Parser {
  // eslint-disable-next-line class-methods-use-this
  parseFromString(html, type) {
    return new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html>${html}</html>`, type);
  }
}
globalThis.DOMParser = Parser;
const parse = (html) => new Parser().parseFromString(html, 'text/html');
const entries = ['1', '2', '3'].map((disclosureId) => ({ disclosureId, fragment: `/terms/${disclosureId}`, extra: 'keep' }));
const model = () => parseSetSource(JSON.stringify({ metadata: { custom: true }, data: { id: 'homepage', disclosures: entries, extra: 42 } }), '/disclosures/sets/homepage.json');

test('a rotation renumbers source identities and preserves the complete JSON envelope', () => {
  const original = model();
  const plan = renumberPlan(original, [2, 0, 1]);
  assert.deepEqual([...plan.mapping], [['3', '1'], ['1', '2'], ['2', '3']]);
  assert.deepEqual(JSON.parse(plan.setSource).data.disclosures.map((item) => [item.disclosureId, item.fragment, item.extra]), [['1', '/terms/3', 'keep'], ['2', '/terms/1', 'keep'], ['3', '/terms/2', 'keep']]);
  assert.equal(JSON.parse(plan.setSource).metadata.custom, true);
  assert.equal(JSON.parse(plan.setSource).data.extra, 42);
  assert.equal(original.data.disclosures[0].disclosureId, '1');
  assert.throws(() => renumberPlan(original, [0, 0, 1]), /order/i);
  assert.throws(() => renumberPlan(parseSetSource('{"id":"homepage","disclosures":[]}', '/set.json'), []), /empty|disclosure/i);
});

test('a single pass rotates repeated, grouped and linked citations without touching prose', () => {
  const plan = renumberPlan(model(), [2, 0, 1]);
  const source = '<body><main><p data-preserve="yes">Rate 1.23%, $3, 2026. <sup><strong>1</strong>, <em>3</em></sup> <sup>1</sup> <sup>homepage-2</sup> <sup>other-1</sup> <sup>™</sup> <sup><a href="https://other.example">1</a></sup> <a href="#disclosure-homepage-1">Offer terms</a> <sup><a href="#disclosure-homepage-2">2</a></sup></p><div class="metadata"><p>Keep<sup>1</sup></p></div></main></body>';
  const result = rewriteDisclosureReferences(source, plan);
  assert.deepEqual(result.issues, []);
  const doc = parse(result.source);
  assert.deepEqual([...doc.querySelectorAll('main > p sup')].map((sup) => sup.textContent), ['2, 1', '2', 'homepage-3', 'other-1', '™', '1', '3']);
  assert.equal(doc.querySelector('strong').textContent, '2');
  assert.equal(doc.querySelector('em').textContent, '1');
  assert.match(doc.querySelector('p').textContent, /Rate 1.23%, \$3, 2026/);
  assert.equal(doc.querySelector('p').dataset.preserve, 'yes');
  assert.equal(doc.querySelector('.metadata sup').textContent, '1');
  assert.equal(doc.querySelector('a[href="#disclosure-homepage-2"]').textContent, 'Offer terms');
  assert.equal(doc.querySelector('sup a[href="#disclosure-homepage-3"]').textContent, '3');
});

test('structured HTML migration preserves self references and changes only identity cells', () => {
  const source = '<body><header></header><main><div><div class="da-form"><div><div>x-schema-name</div><div>disclosure-set</div></div></div><div class="disclosure-set"><div><div>id</div><div>homepage</div></div><div><div>disclosures</div><div><ul><li>self://#disclosures/0</li><li>self://#disclosures/1</li></ul></div></div></div><div class="disclosures disclosures-0"><div><div>disclosureId</div><div><p>a</p></div></div><div><div>fragment</div><div>/one</div></div><div><div>custom</div><div><strong>Keep</strong></div></div></div><div class="disclosures disclosures-1"><div><div>disclosureId</div><div>b</div></div><div><div>fragment</div><div>/two</div></div></div></div></main><footer></footer></body>';
  const plan = renumberPlan(parseSetSource(source, '/disclosures/sets/homepage'), [1, 0]);
  const updated = parseSetSource(plan.setSource, '/disclosures/sets/homepage');
  assert.equal(updated.data.id, 'homepage');
  assert.deepEqual(updated.data.disclosures.map((item) => [item.disclosureId, item.fragment]), [['1', '/two'], ['2', '/one']]);
  assert.match(plan.setSource, /self:\/\/#disclosures\/1/);
  assert.match(plan.setSource, /<strong>Keep<\/strong>/);
  assert.equal(parse(plan.setSource).querySelector('.disclosures-0 p').textContent, '2');
});

test('migration reports ambiguous numeric markers until their positional intent is confirmed', () => {
  const old = parseSetSource(JSON.stringify({ id: 'homepage', disclosures: [{ disclosureId: 'a', fragment: '/one' }, { disclosureId: 'b', fragment: '/two' }] }), '/set.json');
  const plan = renumberPlan(old, [1, 0]);
  const source = '<body><main><p><sup>a,b</sup> <sup>1</sup></p></main></body>';
  assert.match(rewriteDisclosureReferences(source, plan).issues[0].message, /numeric|positional/i);
  const confirmed = rewriteDisclosureReferences(source, plan, { confirmNumeric: true });
  assert.deepEqual(confirmed.issues, []);
  assert.deepEqual([...parse(confirmed.source).querySelectorAll('sup')].map((sup) => sup.textContent), ['2,1', '2']);
});

test('explicit structured reference fields change while financial values remain intact', () => {
  const plan = renumberPlan(model(), [1, 0, 2]);
  const source = JSON.stringify({
    data: {
      disclosureIds: ['1', '3'], description: '1.23% for 3 months', bodyHtml: '<p>Offer<sup>2</sup></p>', amount: 123, disclosureCustom: '1',
    },
  });
  assert.match(rewriteDisclosureReferences(source, plan).issues[0].message, /unsupported/i);
  const supported = JSON.parse(source);
  delete supported.data.disclosureCustom;
  const result = rewriteDisclosureReferences(JSON.stringify(supported), plan);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(JSON.parse(result.source).data.disclosureIds, ['2', '3']);
  assert.match(JSON.parse(result.source).data.bodyHtml, /<sup>1<\/sup>/);
  assert.equal(JSON.parse(result.source).data.amount, 123);
  assert.equal(JSON.parse(result.source).data.description, '1.23% for 3 months');
});

test('schema transition preserves fragment choices and accepts old and numeric identities', () => {
  const schema = {
    title: 'Disclosure set', properties: { disclosures: { items: { properties: { disclosureId: { type: 'string', title: 'Identifier', pattern: '^[a-z][a-z0-9]*$' }, fragment: { $ref: '#/$defs/Fragment' } } } } }, $defs: { Fragment: { enum: ['/one', '/two'], enumNames: ['One', 'Two'] } }, custom: true,
  };
  const changed = numberedDisclosureSchema(schema);
  assert.deepEqual(changed.$defs, schema.$defs);
  assert.equal(changed.custom, true);
  const pattern = new RegExp(changed.properties.disclosures.items.properties.disclosureId.pattern);
  ['a', 'disc1', '1', '123'].forEach((id) => assert.equal(pattern.test(id), true));
  ['0', '01', 'A', 'a-b'].forEach((id) => assert.equal(pattern.test(id), false));
  assert.equal(schema.properties.disclosures.items.properties.disclosureId.title, 'Identifier');
});

test('DA structured reference arrays are rewritten without changing unrelated property cells', () => {
  const plan = renumberPlan(model(), [1, 0, 2]);
  const source = '<body><main><div><div class="da-form"><div><div>x-schema-name</div><div>card</div></div></div><div class="card"><div><div>disclosureIds</div><div><ul><li><p>1</p></li><li>3</li></ul></div></div><div><div>amount</div><div>123</div></div></div></div></main></body>';
  const result = rewriteDisclosureReferences(source, plan);
  assert.deepEqual(result.issues, []);
  assert.deepEqual([...parse(result.source).querySelectorAll('li')].map((li) => li.textContent), ['2', '3']);
  assert.match(result.source, /<div>123<\/div>/);
  const unsupported = source.replace('disclosureIds', 'disclosureCustom');
  assert.match(rewriteDisclosureReferences(unsupported, plan).issues[0].message, /unsupported/i);
});
