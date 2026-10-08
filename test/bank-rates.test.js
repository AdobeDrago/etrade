/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createBankRateRequest, formatBankRate, loadBankRates, normalizeBankRates, selectBankRate,
} from '../scripts/bank-rates.js';
import parseRateSettings from '../scripts/rate-settings.js';

const direct = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url)));
const aggregate = JSON.parse(await readFile(new URL('./fixtures/bank-rates-aggregate.json', import.meta.url)));
const base = 'https://et-dynamic--etrade--adobedrago.aem.page/home';

test('direct and aggregate samples resolve to the same product data', () => {
  assert.deepEqual(normalizeBankRates(aggregate), normalizeBankRates(direct));
});

test('aggregate responses select index 0 regardless of response order', () => {
  const payload = { responses: [{ index: 1, status: 200, body: '{}' }, ...aggregate.responses] };
  assert.deepEqual(normalizeBankRates(payload), normalizeBankRates(direct));
  assert.throws(() => normalizeBankRates({ responses: [payload.responses[0]] }), { code: 'aggregate-response' });
  assert.throws(() => normalizeBankRates({ responses: [...aggregate.responses, ...aggregate.responses] }), { code: 'aggregate-response' });
});

test('aggregate subrequest failures and invalid string bodies are rejected', () => {
  [403, 500].forEach((status) => {
    assert.throws(() => normalizeBankRates({ responses: [{ ...aggregate.responses[0], status }] }), { code: 'aggregate-status' });
  });
  ['not json', direct, null].forEach((body) => {
    assert.throws(() => normalizeBankRates({ responses: [{ index: 0, status: 200, body }] }), { code: 'aggregate-body' });
  });
});

test('API errors and missing product lists are rejected', () => {
  [null, {}, { ...direct, errors: ['unavailable'] }, { ...direct, errors: {} }].forEach((payload) => {
    assert.throws(() => normalizeBankRates(payload), { code: 'invalid-response' });
  });
});

test('stable product codes work when product order changes', () => {
  const data = normalizeBankRates(structuredClone(direct));
  data.products.reverse();
  assert.equal(selectBankRate(data, { product: '3100', field: 'advertisedAPY', balance: '0' }), '3.75');
});

test('checking tiers include boundaries and the open-ended zero-high tier', () => {
  const data = normalizeBankRates(direct);
  ['0', '9999.99'].forEach((balance) => {
    assert.equal(selectBankRate(data, { product: '4240', field: 'advertisedAPY', balance }), '0.05');
  });
  ['10000', '500000', '1000000'].forEach((balance) => {
    assert.equal(selectBankRate(data, { product: '4240', field: 'advertisedAPY', balance }), '2.00');
  });
  assert.equal(selectBankRate(data, { product: '4240', field: 'finalRate', balance: '10000' }), '1.98');
});

test('CD term selection is independent of order and sequence', () => {
  const data = normalizeBankRates(structuredClone(direct));
  data.products.find((product) => product.productType === '3500').rates.reverse();
  assert.equal(selectBankRate(data, { product: '3500', field: 'disclosureAPY', term: '6M' }), '4.20');
  assert.equal(selectBankRate(data, { product: '3500', field: 'finalRate', term: '12M' }), '4.3062');
  assert.equal(selectBankRate(data, { product: '3500', field: 'minDisclosureAPY' }), '4.20');
  assert.equal(selectBankRate(data, { product: '3500', field: 'maxDisclosureAPY' }), '4.40');
});

test('missing fields, tiers and duplicate products never invent a rate', () => {
  const data = normalizeBankRates(direct);
  assert.throws(() => selectBankRate(data, { product: '9999', field: 'advertisedAPY', balance: '0' }), { code: 'missing-product' });
  assert.throws(() => selectBankRate(data, { product: '3500', field: 'advertisedAPY', term: '12M' }), { code: 'missing-value' });
  assert.throws(() => selectBankRate(data, { product: '3500', field: 'disclosureAPY', term: '3M' }), { code: 'missing-tier' });
  assert.throws(() => selectBankRate(data, { product: '4240', field: 'advertisedAPY' }), { code: 'missing-tier' });
  assert.throws(() => selectBankRate({ products: [...data.products, data.products[0]] }, { product: '3100', field: 'advertisedAPY', balance: '0' }), { code: 'missing-product' });
});

test('zero is valid and formatting preserves final-rate precision', () => {
  assert.equal(formatBankRate(0), '0.00');
  assert.equal(formatBankRate('4.3062'), '4.3062');
  assert.equal(formatBankRate('4.4'), '4.40');
  ['', null, undefined, NaN, Infinity, '-1', '3.75%', '1e2'].forEach((value) => {
    assert.throws(() => formatBankRate(value), { code: 'invalid-value' });
  });
});

test('author controls validate modes, explicit zero, CD terms and manual-only settings', () => {
  assert.equal(parseRateSettings(['Mode: manual', 'Override: 0']).valid, true);
  const hybrid = parseRateSettings(['Name: Base', 'Mode: HYBRID', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 0', 'Fallback: 3.75']);
  assert.equal(hybrid.valid, true);
  assert.equal(hybrid.name, 'base');
  assert.equal(hybrid.override, '0');
  assert.equal(parseRateSettings(['Mode: api', 'Product: 3500', 'Field: disclosureAPY', 'Term: 12m']).term, '12M');
  assert.equal(parseRateSettings(['Mode: api', 'Product: 3500', 'Field: maxDisclosureAPY']).valid, true);
  assert.equal(parseRateSettings(['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: ignored']).valid, true);
});

test('malformed rate entries do not prevent selecting a valid tier', () => {
  const data = normalizeBankRates(structuredClone(direct));
  data.products[0].rates.unshift(null, {}, 'invalid');
  assert.equal(selectBankRate(data, { product: '3100', field: 'advertisedAPY', balance: '0' }), '3.75');
});

test('ambiguous or malformed author controls fail without guessing', () => {
  [
    ['Mode: manual'], ['Mode: api', 'Product: 3100', 'Field: advertisedAPY'],
    ['Mode: api', 'Product: 3500', 'Field: disclosureAPY'],
    ['Mode: api', 'Product: 3500', 'Field: maxDisclosureAPY', 'Term: 12M'],
    ['Mode: api', 'Product: 3500', 'Field: advertisedAPY', 'Term: 12M'],
    ['Mode: manual', 'Override: nope'], ['Mode: manual', 'Override: 1', 'Mode: api'],
    ['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: bad'],
    ['Mode: manual', 'Override: 1', 'Unknown: value'],
  ].forEach((lines) => assert.equal(parseRateSettings(lines).valid, false));
});

test('requests use guest GET or the supplied aggregate POST contract', () => {
  const get = createBankRateRequest({}, base);
  assert.equal(get.init.method, 'GET');
  assert.equal(get.init.credentials, 'omit');
  const post = createBankRateRequest({ source: 'aggregate' }, base);
  assert.equal(post.init.method, 'POST');
  assert.deepEqual(JSON.parse(post.init.body), [{
    id: '0', api_id: 'webapipros', method: 'GET', path: '/phx/apicontent/init/bankRates', body: '',
  }]);
  assert.equal(createBankRateRequest({ endpoint: '/approved/rates' }, base).url, 'https://et-dynamic--etrade--adobedrago.aem.page/approved/rates');
  ['https://other.example/rates', 'data:text/plain,not-an-api', 'https://name:secret@us.etrade.com/phx/pros/apicontent/init/bankRates'].forEach((endpoint) => {
    assert.throws(() => createBankRateRequest({ endpoint }, base), { code: 'invalid-endpoint' });
  });
});

test('concurrent cards share a single request, including a failed response', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => direct };
  };
  try {
    const options = { source: 'direct' };
    const [first, second] = await Promise.all([loadBankRates(options), loadBankRates(options)]);
    assert.equal(calls, 1);
    assert.equal(first, second);
    assert.ok(first.fetchedAt);
    globalThis.fetch = async () => { calls += 1; return { ok: false, status: 403 }; };
    const failed = { source: 'aggregate' };
    await assert.rejects(loadBankRates(failed), { code: 'http-status' });
    await assert.rejects(loadBankRates(failed), { code: 'http-status' });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('network, non-JSON and invalid aggregate envelopes fail predictably', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  globalThis.location = { href: base };
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(loadBankRates({ endpoint: '/test/network' }), { code: 'network' });
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML response'); } });
    await assert.rejects(loadBankRates({ endpoint: '/test/non-json' }), { code: 'invalid-json' });
    globalThis.fetch = async () => ({ ok: true, json: async () => direct });
    await assert.rejects(loadBankRates({ source: 'aggregate', endpoint: '/test/wrong-envelope' }), { code: 'aggregate-response' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

test('a stalled request is aborted after the bounded timeout', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  globalThis.location = { href: base };
  globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  });
  try {
    await assert.rejects(loadBankRates({ endpoint: '/test/stalled' }), { code: 'timeout' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});
