import decorateProduct from '../blocks/cards-product/cards-product.js';
import decorateAccount from '../blocks/cards-account/cards-account.js';
import decoratePricing from '../blocks/cards-pricing/cards-pricing.js';
import {
  rateExamples, scenarios, exampleContent, settingsContent,
} from './dynamic-rates-examples.js';

const requested = new URLSearchParams(window.location.search).get('scenario') || 'direct';
const scenario = Object.hasOwn(scenarios, requested) ? requested : 'direct';
const selected = scenarios[scenario];
const connection = document.getElementById('connection');
connection.replaceChildren();
Object.entries(scenarios).forEach(([key, config]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = config.label;
  connection.append(option);
});
connection.value = scenario;
connection.addEventListener('change', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('scenario', connection.value);
  window.location.assign(url);
});
document.querySelector('meta[name="bank-rates-source"]').content = selected.source;
document.querySelector('meta[name="bank-rates-endpoint"]').content = selected.endpoint;
if (selected.live) {
  document.querySelector('.notice').textContent = 'Live endpoint test. API cards request current data from E*TRADE. Manual overrides and fallbacks are test values. Success requires source api; a fallback does not count as a working connection.';
}

let requestCount = 0;
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, options) => {
  if (String(input) === new URL(selected.endpoint, window.location.href).href) requestCount += 1;
  return fetchOriginal(input, options);
};

const samples = scenario === 'manual'
  ? rateExamples.filter((example) => ['static', 'manual', 'hybrid-override', 'zero'].includes(example.id))
  : rateExamples.filter((example) => !selected.live || !example.error);
const failed = ['failure', 'invalid', 'timeout'].includes(scenario);
const connectionErrors = { failure: 'http-status', invalid: 'invalid-json', timeout: 'timeout' };
const decorators = {
  'cards-product': decorateProduct,
  'cards-account': decorateAccount,
  'cards-pricing': decoratePricing,
};
const container = document.getElementById('demo-cards');
const pending = samples.map(async (example) => {
  const panel = document.createElement('section');
  panel.dataset.demoPanel = example.id;
  const block = document.createElement('div');
  block.className = `${example.block} block`;
  const row = document.createElement('div');
  row.append(exampleContent(document, example));
  example.settings.forEach((lines) => row.append(settingsContent(document, lines)));
  block.append(row);
  const status = document.createElement('div');
  status.className = 'review-status';
  panel.append(block, status);
  container.append(panel);
  await decorators[example.block](block);
  const markers = [...block.querySelectorAll('[data-rate-name]')];
  const connectionFailed = failed && (example.source === 'api' || example.error === 'missing-tier');
  const hasFallback = example.settings.some((lines) => lines.includes('Fallback: 1.11'));
  const expected = connectionFailed
    ? example.expected.map(() => (hasFallback ? '1.11' : '—'))
    : example.expected;
  const failureSource = hasFallback ? 'fallback' : 'unavailable';
  const expectedSource = connectionFailed ? failureSource : example.source;
  const expectedError = connectionFailed ? connectionErrors[scenario] : example.error;
  const actual = markers.map((marker) => marker.textContent);
  const liveValue = selected.live && example.source === 'api';
  const valuesMatch = liveValue
    ? markers.length === example.expected.length && actual.every((value) => /^\d+\.\d{2,}$/.test(value))
    : JSON.stringify(actual) === JSON.stringify(expected);
  const matches = valuesMatch
    && markers.every((marker) => marker.dataset.rateSource === expectedSource
      && marker.dataset.rateError === expectedError
      && (expectedSource !== 'api' || Number.isFinite(Date.parse(marker.dataset.rateFetchedAt))));
  panel.dataset.check = matches ? 'passed' : 'failed';
  const sources = [...new Set(markers.map((marker) => marker.dataset.rateSource))];
  const errors = [...new Set(markers.map((marker) => marker.dataset.rateError).filter(Boolean))];
  status.textContent = `${matches ? 'PASS' : 'FAIL'} · Expected: ${liveValue ? 'live API value' : expected.join(' / ') || 'authored text'} · Displayed: ${actual.join(' / ') || 'authored text'} · Source: ${sources.join(' / ') || 'authored'}${errors.length ? ` · Reason: ${errors.join(' / ')}` : ''}`;
});
await Promise.all(pending);
const failures = document.querySelectorAll('[data-check="failed"]').length;
const expectedRequests = scenario === 'manual' ? 0 : 1;
const requestCheck = requestCount === expectedRequests;
const liveStatus = selected.live ? `Live connection ${!failures && requestCheck ? 'succeeded' : 'failed'}. ` : '';
document.getElementById('demo-summary').textContent = `${liveStatus}${samples.length - failures}/${samples.length} examples match. Rate requests: ${requestCount}.${requestCheck ? '' : ` FAIL: expected ${expectedRequests} requests.`} Connection: ${selected.label}.`;
document.body.dataset.demoPassed = String(!failures && requestCheck);
document.body.dataset.demoReady = 'true';
