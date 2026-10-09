/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createBankRateRequest, formatBankRate, loadBankRates, normalizeBankRates, selectBankRate,
} from '../scripts/bank-rates.js';
import parseRateSettings from '../scripts/rate-settings.js';
import applyDemoBalance, { DEMO_BALANCE_KEY, readDemoBalance } from '../scripts/demo-balance.js';

const direct = JSON.parse(await readFile(new URL('./fixtures/bank-rates.json', import.meta.url)));
const aggregate = JSON.parse(await readFile(new URL('./fixtures/bank-rates-aggregate.json', import.meta.url)));
const servedDirect = JSON.parse(await readFile(new URL('../phx/pros/apicontent/init/bankRates.json', import.meta.url)));
const servedAggregate = JSON.parse(await readFile(new URL('../phx/pros/aggregate.json', import.meta.url)));
const base = 'https://et-dynamic--etrade--adobedrago.aem.page/home';

test('direct and aggregate samples resolve to the same product data', () => {
  assert.deepEqual(normalizeBankRates(aggregate), normalizeBankRates(direct));
  assert.deepEqual(normalizeBankRates(servedDirect), normalizeBankRates(direct));
  assert.deepEqual(normalizeBankRates(servedAggregate), normalizeBankRates(direct));
});

test('dummy savings tiers visibly change at each balance boundary', () => {
  const data = normalizeBankRates(direct);
  const cases = [
    ['0', '3.75'], ['4999.99', '3.75'], ['5000', '3.85'], ['49999.99', '3.85'],
    ['50000', '4.00'], ['99999.99', '4.00'], ['100000', '4.15'], ['499999.99', '4.15'],
    ['500000', '4.25'], ['1000000', '4.25'],
  ];
  cases.forEach(([balance, expected]) => {
    ['advertisedAPY', 'disclosureAPY'].forEach((field) => {
      assert.equal(selectBankRate(data, { product: '3100', field, balance }), expected);
    });
  });
  assert.equal(selectBankRate(data, { product: '3100', field: 'finalRate', balance: '100000' }), '4.07');
});

function demoWindow(value, hostname = 'localhost') {
  return {
    location: { hostname },
    localStorage: {
      getItem: (key) => {
        assert.equal(key, DEMO_BALANCE_KEY);
        return value;
      },
    },
  };
}

test('localStorage balances are limited to development and preview hosts', () => {
  ['localhost', '127.0.0.1', '[::1]', 'et-dynamic--etrade--adobedrago.aem.page'].forEach((hostname) => {
    assert.equal(readDemoBalance(demoWindow('100000', hostname)), '100000');
  });
  ['us.etrade.com', 'main--etrade--adobedrago.aem.live', 'aem.page.example.com'].forEach((hostname) => {
    assert.equal(readDemoBalance(demoWindow('100000', hostname)), null);
  });
  assert.equal(readDemoBalance(null), null);
});

test('missing, invalid or blocked localStorage keeps the authored balance; zero is valid', () => {
  [null, '', '-1', '100,000', '$100000', '1e5', 'NaN', 'Infinity', '{}'].forEach((value) => {
    assert.equal(readDemoBalance(demoWindow(value)), null);
  });
  assert.equal(readDemoBalance(demoWindow(' 0 ')), '0');
  assert.equal(readDemoBalance(demoWindow('9999.99')), '9999.99');
  const denied = { location: { hostname: 'localhost' }, get localStorage() { throw new Error('Denied'); } };
  assert.equal(readDemoBalance(denied), null);
  const settings = parseRateSettings(['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 5000']);
  assert.equal(applyDemoBalance(settings, demoWindow('bad')), settings);
  assert.equal(applyDemoBalance(settings, denied), settings);
});

test('dummy balance selects API tiers without mutating authored settings or overriding manual values', () => {
  const win = demoWindow('100000');
  const data = normalizeBankRates(direct);
  ['api', 'hybrid'].forEach((mode) => {
    ['3100', '4240'].forEach((product) => {
      const settings = parseRateSettings([`Mode: ${mode}`, `Product: ${product}`, 'Field: advertisedAPY', 'Balance: 0']);
      const effective = applyDemoBalance(settings, win);
      assert.equal(settings.balance, '0');
      assert.equal(effective.authoredBalance, '0');
      assert.equal(effective.balanceSource, 'demo');
      assert.equal(effective.balance, '100000');
      assert.equal(selectBankRate(data, effective), product === '3100' ? '4.15' : '2.00');
      assert.equal(applyDemoBalance(settings, demoWindow('100000', 'us.etrade.com')), settings);
    });
  });
  [
    ['Mode: manual', 'Override: 1'],
    ['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 0'],
    ['Mode: api', 'Product: 3500', 'Field: disclosureAPY', 'Term: 12M'],
    ['Mode: api', 'Product: 3100', 'Field: advertisedAPY'],
  ].forEach((lines) => {
    const settings = parseRateSettings(lines);
    assert.equal(applyDemoBalance(settings, win), settings);
  });
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
  ['', null, undefined, NaN, Infinity, '-1', '-.--', '3.75%', '1e2'].forEach((value) => {
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

test('authored unavailable fallback permits API and hybrid rate lookups without becoming a number', () => {
  ['api', 'hybrid'].forEach((mode) => {
    const settings = parseRateSettings([
      `Mode: ${mode}`, 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Fallback: -.--',
    ]);
    assert.equal(settings.valid, true);
    assert.equal(settings.fallback, null);
    assert.equal(settings.fallbackText, '-.--');
  });
});

test('placeholder fallback preserves numeric override and fallback validation', () => {
  assert.equal(parseRateSettings(['Mode: manual', 'Override: -.--', 'Fallback: -.--']).valid, false);
  const manual = parseRateSettings(['Mode: manual', 'Override: 0', 'Fallback: -.--']);
  assert.equal(manual.valid, true);
  assert.equal(manual.override, '0');
  const numeric = parseRateSettings(['Mode: manual', 'Override: 1', 'Fallback: 0']);
  assert.equal(numeric.valid, true);
  assert.equal(numeric.fallback, '0');
  assert.equal(numeric.fallbackText, null);
  ['not-a-number', '3.75%', '-1'].forEach((fallback) => {
    assert.equal(parseRateSettings(['Mode: manual', 'Override: 1', `Fallback: ${fallback}`]).valid, false);
  });
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
