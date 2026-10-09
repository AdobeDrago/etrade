import decorateProduct from '../blocks/cards-product/cards-product.js';
import decorateAccount from '../blocks/cards-account/cards-account.js';
import decoratePricing from '../blocks/cards-pricing/cards-pricing.js';
import { rateDecimal } from '../scripts/bank-rates.js';
import { DEMO_BALANCE_KEY, readDemoBalance } from '../scripts/demo-balance.js';
import {
  rateExamples, scenarios, comparisonSections, exampleContent, settingsContent,
} from './dynamic-rates-examples.js';

const requested = new URLSearchParams(window.location.search).get('scenario') || 'direct';
const comparison = new URLSearchParams(window.location.search).get('pack') === 'comparison';
const scenario = Object.hasOwn(scenarios, requested) ? requested : 'direct';
const selected = scenarios[scenario];
const balanceForm = document.getElementById('demo-balance-form');
const balanceInput = document.getElementById('demo-balance');
const balanceStatus = document.getElementById('balance-status');
const demoBalance = readDemoBalance();
balanceInput.value = demoBalance ?? '';
balanceStatus.textContent = demoBalance === null
  ? 'Using each card’s authored balance.'
  : `Dummy balance: $${Number(demoBalance).toLocaleString()}. Savings and checking API cards use this balance.`;
function saveBalance(value) {
  try {
    if (value === null) localStorage.removeItem(DEMO_BALANCE_KEY);
    else localStorage.setItem(DEMO_BALANCE_KEY, value);
    window.location.reload();
  } catch {
    balanceStatus.textContent = 'Browser storage is unavailable. Cards use their authored balance.';
  }
}
balanceInput.addEventListener('input', () => balanceInput.setCustomValidity(''));
balanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const balance = rateDecimal(balanceInput.value);
  if (balanceInput.value && balance === null) {
    balanceInput.setCustomValidity('Enter a non-negative decimal balance.');
    balanceInput.reportValidity();
    return;
  }
  saveBalance(balance);
});
document.getElementById('clear-balance').addEventListener('click', () => saveBalance(null));
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

const examples = comparison
  ? comparisonSections.flatMap((section) => section.examples) : rateExamples;
const manualExamples = examples.filter((example) => (comparison
  ? !example.settings.length
  : ['static', 'manual', 'hybrid-override', 'zero'].includes(example.id)));
const samples = scenario === 'manual'
  ? manualExamples
  : examples.filter((example) => !selected.live || !example.error);
const failed = ['failure', 'invalid', 'timeout'].includes(scenario);
const connectionErrors = { failure: 'http-status', invalid: 'invalid-json', timeout: 'timeout' };
const decorators = {
  'cards-product': decorateProduct,
  'cards-account': decorateAccount,
  'cards-pricing': decoratePricing,
};
const container = document.getElementById('demo-cards');
const sectionTargets = new Map();
if (comparison) {
  document.querySelector('h1').textContent = 'Dynamic JSON rates and manual authored rates';
  comparisonSections.forEach((section, index) => {
    if (index) container.append(document.createElement('hr'));
    const target = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = section.heading;
    const description = document.createElement('p');
    description.textContent = section.description;
    target.append(heading, description);
    container.append(target);
    section.examples.forEach((example) => sectionTargets.set(example.id, target));
  });
}
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
  (sectionTargets.get(example.id) || container).append(panel);
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
  const dummyValue = expectedSource === 'api' && markers.some((marker) => marker.dataset.rateBalanceSource === 'demo');
  const variableValue = liveValue || dummyValue;
  const valuesMatch = variableValue
    ? markers.length === example.expected.length && actual.every((value) => /^\d+\.\d{2,}$/.test(value))
    : JSON.stringify(actual) === JSON.stringify(expected);
  const matches = valuesMatch
    && (!example.authoredRate || block.textContent.includes(`${example.authoredRate}% APY`))
    && markers.every((marker) => marker.dataset.rateSource === expectedSource
      && marker.dataset.rateError === expectedError
      && (expectedSource !== 'api' || Number.isFinite(Date.parse(marker.dataset.rateFetchedAt))));
  panel.dataset.check = matches ? 'passed' : 'failed';
  const sources = [...new Set(markers.map((marker) => marker.dataset.rateSource))];
  const errors = [...new Set(markers.map((marker) => marker.dataset.rateError).filter(Boolean))];
  let expectedLabel = liveValue ? 'live API value' : expected.join(' / ') || example.authoredRate || 'authored text';
  if (dummyValue) expectedLabel = `API value for dummy balance ${demoBalance}`;
  const balances = [...new Set(markers.filter((marker) => marker.dataset.rateBalance !== undefined)
    .map((marker) => `${marker.dataset.rateBalance} (${marker.dataset.rateBalanceSource})`))];
  status.textContent = `${matches ? 'PASS' : 'FAIL'} · Expected: ${expectedLabel} · Displayed: ${actual.join(' / ') || example.authoredRate || 'authored text'} · Source: ${sources.join(' / ') || 'authored'}${balances.length ? ` · Balance: ${balances.join(' / ')}` : ''}${errors.length ? ` · Reason: ${errors.join(' / ')}` : ''}`;
});
await Promise.all(pending);
const failures = document.querySelectorAll('[data-check="failed"]').length;
const expectedRequests = scenario === 'manual' ? 0 : 1;
const requestCheck = requestCount === expectedRequests;
const liveStatus = selected.live ? `Live connection ${!failures && requestCheck ? 'succeeded' : 'failed'}. ` : '';
document.getElementById('demo-summary').textContent = `${liveStatus}${samples.length - failures}/${samples.length} examples match. Rate requests: ${requestCount}.${requestCheck ? '' : ` FAIL: expected ${expectedRequests} requests.`} Connection: ${selected.label}.`;
document.body.dataset.demoPassed = String(!failures && requestCheck);
document.body.dataset.demoReady = 'true';
