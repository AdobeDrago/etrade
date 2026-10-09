/* eslint-env node, es2021 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  marketNumber, marketDate, marketRequest, marketJSON, loadMarket,
  normalizeQuotes, normalizePoints, normalizeChart, normalizeTopFive, quoteURL,
} from '../scripts/market-data.js';

const base = 'https://et-dynamic--etrade--adobedrago.aem.page/home/welcome-back';
const sample = JSON.parse(await readFile(new URL('./fixtures/market-data.json', import.meta.url), 'utf8'));

test('numbers reject blanks, missing values, units and non-finite values; zero survives', () => {
  [null, undefined, '', ' ', '2%', true, {}, NaN, Infinity, 'Infinity', '1e3'].forEach((value) => {
    assert.equal(marketNumber(value), null);
  });
  assert.equal(marketNumber(0), 0);
  assert.equal(marketNumber('-0.25'), -0.25);
  assert.equal(marketDate(null), null);
  assert.equal(marketDate('bad-date'), null);
  assert.equal(marketDate('2026-10-09T13:30:00Z'), Date.parse('2026-10-09T13:30:00Z'));
});

test('observed service requests preserve methods/bodies and accept same-origin proxy only', () => {
  const body = { indexes: 'DJIND' };
  const request = marketRequest('chart', body, {}, base);
  assert.equal(request.url, 'https://us.etrade.com/phx/pros/apicontent/market/chart');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.deepEqual(JSON.parse(request.init.body), body);
  assert.equal(marketRequest('top5/TopETFs', undefined, { base: '/api/market/' }, base).init.method, 'GET');
  [
    'https://example.com/market/', 'https://user:secret@us.etrade.com/phx/pros/apicontent/market/',
    '/api/market/?secret=1', '/api/market/#secret', '/api/market', 'data:text/html,invalid',
  ].forEach((url) => assert.throws(() => marketRequest('quote', {}, { base: url }, base)));
  assert.throws(() => marketRequest('../private', {}, {}, base));
});

test('quotes match valid unique symbols; no malformed quote can appear as zero', () => {
  const data = structuredClone(sample.quote);
  data.quoteData.push({ product: { symbol: 'BAD' }, intraday: { lastTrade: '' } });
  data.quoteData.push(data.quoteData[0]);
  data.quoteData.push({ product: { symbol: '<script>' }, intraday: { lastTrade: 1 } });
  const quotes = normalizeQuotes(data);
  assert.equal(quotes.filter((q) => q.symbol === 'DJIND').length, 1);
  assert.equal(quotes.some((q) => q.symbol === 'BAD'), false);
  assert.equal(quotes.find((q) => q.symbol === 'TNX').price, 4.2);
  assert.equal(quotes.find((q) => q.symbol === 'SPX').change, 0);
  assert.throws(() => normalizeQuotes({}), { code: 'invalid-quotes' });
});

test('chart points are sorted, deduplicated and filtered by latest Eastern day', () => {
  const old = Date.parse('2026-10-08T20:00:00Z');
  const current = Date.parse('2026-10-09T13:30:00Z');
  const input = [
    { stockDate: current + 300000, highValue: 43 },
    { stockDate: old, highValue: 41 },
    { stockDate: current, highValue: 42 },
    { stockDate: current, highValue: 42.5 },
    { stockDate: current + 600000, highValue: null },
    { stockDate: 'bad', highValue: 999 },
  ];
  assert.deepEqual(normalizePoints(input, { treasury: true }), [
    { time: current, value: 4.25 }, { time: current + 300000, value: 4.3 },
  ]);
  assert.equal(normalizePoints(input, { latestDay: false }).length, 3);
  assert.throws(() => normalizeChart({ data: [{ dataPoints: [] }] }, 'DJIND'), { code: 'empty-chart' });
  assert.throws(() => normalizeChart({ data: [{}, {}] }, 'DJIND'), { code: 'invalid-chart' });
  assert.equal(normalizeChart(sample.charts.TNX, 'TNX')[0].value, 4.2);
});

test('all top-five groups normalize; bad values and duplicates are omitted', () => {
  Object.entries(sample.topFive).forEach(([group, payload]) => {
    const quotes = normalizeTopFive(payload, group);
    assert.equal(quotes.length, 5);
    assert.ok(quotes.every((q) => q.points.length === 12));
  });
  const payload = structuredClone(sample.topFive.TopETFs);
  payload.top5Response.data[0].priceLast = null;
  payload.top5Response.data[2].symbol = payload.top5Response.data[1].symbol;
  const quotes = normalizeTopFive(payload, 'TopETFs');
  assert.equal(quotes.length, 3);
  assert.equal(quotes[0].symbol, 'VTI');
  assert.equal(quotes[0].points[0].value, 280.4);
  assert.throws(() => normalizeTopFive({ top5Response: { data: [] } }, 'TopETFs'));
  assert.equal(new URL(quoteURL('BRK.B')).searchParams.get('sym'), 'BRK.B');
});

test('requests share results; Refresh refetches; failures remain retryable', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"quoteData":[]}');
  };
  try {
    await Promise.all([marketJSON('https://example.test/shared'), marketJSON('https://example.test/shared')]);
    assert.equal(calls, 1);
    await marketJSON('https://example.test/shared');
    assert.equal(calls, 1);
    await marketJSON('https://example.test/shared', {}, true);
    assert.equal(calls, 2);
    globalThis.fetch = async () => { throw new Error('Offline'); };
    await assert.rejects(marketJSON('https://example.test/retry'), { code: 'network-or-response' });
    globalThis.fetch = async () => new Response('{}');
    await marketJSON('https://example.test/retry');
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(marketJSON('https://example.test/status'), { code: 'http-503' });
    globalThis.fetch = async () => new Response('not json');
    await assert.rejects(marketJSON('https://example.test/json'), { code: 'network-or-response' });
  } finally {
    globalThis.fetch = original;
  }
});

test('sample feeds are local-only and never become live fallbacks', async () => {
  const originalLocation = globalThis.location;
  const originalFetch = globalThis.fetch;
  const settings = { sample: '/test/fixtures/market-data.json' };
  try {
    globalThis.location = new URL(base);
    await assert.rejects(loadMarket('chart', { indexes: 'DJIND' }, { settings }), { code: 'invalid-sample' });
    globalThis.location = new URL('http://127.0.0.1:3020/docs/welcome-back-demo.html');
    globalThis.fetch = async () => new Response(JSON.stringify(sample));
    const result = await loadMarket('chart', { indexes: 'DJIND' }, { settings });
    assert.equal(result.sample, true);
    assert.equal(normalizeChart(result.payload, 'DJIND').length, 12);
    await assert.rejects(loadMarket('chart', {}, { settings: { sample: 'https://example.test/sample.json' } }), { code: 'invalid-sample' });
    await assert.rejects(loadMarket('chart', {}, { settings: { sample: '/docs/sample.json' } }), { code: 'invalid-sample' });
  } finally {
    globalThis.location = originalLocation;
    globalThis.fetch = originalFetch;
  }
});
