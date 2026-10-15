import decorateAccount from '../blocks/cards-account/cards-account.js';
import decorateProduct from '../blocks/cards-product/cards-product.js';
import decoratePricing from '../blocks/cards-pricing/cards-pricing.js';
import { DEMO_BALANCE_KEY } from '../scripts/demo-balance.js';

const results = [];
function check(name, condition) {
  results.push(condition);
  const line = document.createElement('li');
  line.textContent = `${condition ? 'PASS' : 'FAIL'}: ${name}`;
  document.getElementById('results').append(line);
}

function block(name, rows) {
  const element = document.createElement('div');
  element.className = `${name} block`;
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      // Fixed authored test markup; no API response is inserted as HTML.
      cell.innerHTML = html;
      row.append(cell);
    });
    element.append(row);
  });
  document.getElementById('cards').append(element);
  return element;
}

function settings(lines) {
  return ['Rate settings', ...lines].map((line) => `<p>${line}</p>`).join('');
}

async function runChecks() {
  const manual = settings(['Mode: manual', 'Override: 0']);
  const empty = block('cards-account', [['<p> </p>', ''], [manual]]);
  await decorateAccount(empty);
  check('Empty and settings-only account rows do not leave blank cards', empty.hidden && !empty.querySelector('li'));

  const account = block('cards-account', [[
    '<h3>Savings</h3><p>Read <a href="#claim">the disclosure</a><sup>1</sup>.</p>',
    '',
    settings(['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0']),
    '<p><strong>{{rate}}</strong>% APY</p><p><a href="#learn">Learn more</a></p>',
    '<p><a href="#open">Open an account</a></p>',
  ]]);
  await decorateAccount(account);
  const accountRate = account.querySelector('[data-rate-name]');
  check('Additional account cells share one body and action group', account.querySelectorAll('.cards-account-body').length === 1
    && account.querySelectorAll('.cards-account-actions p').length === 2);
  check('API values populate extra content cells and preserve bold formatting', accountRate.textContent === '3.75'
    && accountRate.dataset.rateSource === 'api' && accountRate.parentElement.tagName === 'STRONG');
  check('Inline disclosure links and superscripts remain in account copy', account.querySelector('a[href="#claim"]').closest('p').parentElement.className === 'cards-account-body'
    && account.querySelector('sup').textContent === '1');
  check('Settings cells are removed before account decoration', !account.textContent.includes('Rate settings'));

  const separate = block('cards-account', [
    ['<h3>First</h3><p>{{rate}}%</p>', settings(['Mode: manual', 'Override: 1'])],
    ['<h3>Second</h3><p>{{rate}}%</p>', settings(['Mode: manual', 'Override: 2'])],
  ]);
  await decorateAccount(separate);
  check('Default binding names are independent between card rows', [...separate.querySelectorAll('[data-rate-name]')].map((marker) => marker.textContent).join(',') === '1.00,2.00');

  const formatted = block('cards-product', [[
    '<h3>Authored offer</h3><h4>4.25% APY<sup>2</sup></h4><p>{{RATE:BASE}}% and {{rate:base}}%</p><pre>{{rate}}</pre>',
    '<p>Rate settings<br> Name: BASE<br> Mode: manual<br> Override: 0</p>',
  ]]);
  await decorateProduct(formatted);
  check('Line-break settings, uppercase names and repeated markers resolve zero', [...formatted.querySelectorAll('[data-rate-name]')].map((marker) => marker.textContent).join(',') === '0.00,0.00');
  check('Promotional text, code samples and legal references stay authored', formatted.querySelector('h4').textContent === '4.25% APY2'
    && formatted.querySelector('pre').textContent === '{{rate}}');

  const missing = block('cards-pricing', [['<p>{{rate}}%</p><h3>Missing settings</h3>']]);
  await decoratePricing(missing);
  const unavailable = missing.querySelector('[data-rate-name]');
  check('Unresolved pricing values keep numeric styling and an accessible label', missing.querySelector('li').classList.contains('cards-pricing-has-value')
    && unavailable.textContent === '—' && unavailable.dataset.rateError === 'invalid-settings'
    && unavailable.getAttribute('aria-label') === 'Rate currently unavailable');

  const ordinary = block('cards-account', [['<h3>Ordinary card</h3><p>Existing account copy.</p><p><a href="#details">Learn more</a></p>']]);
  await decorateAccount(ordinary);
  check('Unconfigured account cards keep content and standalone actions', !ordinary.querySelector('[data-rate-name]')
    && ordinary.textContent.includes('Existing account copy.') && ordinary.querySelector('.cards-account-actions a'));

  const placeholderSettings = ['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Fallback: -.--'];
  const placeholderSuccess = block('cards-product', [[
    '<h3>Savings with placeholder</h3><h4>{{rate}}% APY</h4>', settings(placeholderSettings),
  ]]);
  await decorateProduct(placeholderSuccess);
  const successRate = placeholderSuccess.querySelector('[data-rate-name]');
  check('Placeholder fallback allows successful API values to replace it', successRate.textContent === '3.75'
    && successRate.dataset.rateSource === 'api' && !successRate.dataset.rateError && !successRate.hasAttribute('aria-label'));

  const placeholderMissing = block('cards-account', [[
    '<h3>Unavailable CD term</h3><p>{{rate}}% APY</p>',
    settings(['Mode: api', 'Product: 3500', 'Field: disclosureAPY', 'Term: 3M', 'Fallback: -.--']),
  ]]);
  await decorateAccount(placeholderMissing);
  const missingRate = placeholderMissing.querySelector('[data-rate-name]');
  check('Missing API rate uses the authored placeholder', missingRate.textContent === '-.--'
    && missingRate.dataset.rateSource === 'fallback' && missingRate.dataset.rateError === 'missing-tier');

  document.querySelector('meta[name="bank-rates-endpoint"]').content = '/test/fixtures/unavailable';
  const placeholderFailure = block('cards-pricing', [[
    '<p>{{rate}}%</p><h3>Unavailable request</h3><p>See terms<sup>2</sup>.</p>', settings(placeholderSettings),
  ]]);
  let failedRate;
  placeholderFailure.addEventListener('bank-rates:updated', (event) => { failedRate = event.detail; });
  await decoratePricing(placeholderFailure);
  const failureRate = placeholderFailure.querySelector('[data-rate-name]');
  check('Failed requests preserve placeholder styling, labels and legal references', failureRate.textContent === '-.--'
    && failureRate.parentElement.textContent === '-.--%' && failureRate.dataset.rateSource === 'fallback'
    && failureRate.dataset.rateError === 'http-status' && failureRate.getAttribute('aria-label') === 'Rate currently unavailable'
    && placeholderFailure.querySelector('li').classList.contains('cards-pricing-has-value')
    && placeholderFailure.querySelector('sup').textContent === '2');
  check('Placeholder updates report an unavailable value and explicit display text', failedRate.value === null
    && failedRate.display === '-.--' && failedRate.source === 'fallback');

  const zeroFallback = block('cards-product', [[
    '<h3>Zero fallback</h3><h4>{{rate}}% APY</h4>',
    settings(['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Fallback: 0']),
  ]]);
  await decorateProduct(zeroFallback);
  const zeroRate = zeroFallback.querySelector('[data-rate-name]');
  check('Numeric zero fallbacks remain valid numbers', zeroRate.textContent === '0.00'
    && zeroRate.dataset.rateSource === 'fallback' && !zeroRate.hasAttribute('aria-label'));

  document.querySelector('meta[name="bank-rates-endpoint"]').content = '/test/fixtures/bank-rates.json';
  localStorage.setItem(DEMO_BALANCE_KEY, '100000');
  let demoUpdate;
  const decorators = { 'cards-product': decorateProduct, 'cards-account': decorateAccount, 'cards-pricing': decoratePricing };
  await Promise.all(Object.entries(decorators).map(async ([name, decorate]) => {
    const demo = block(name, [
      ['<h3>Savings</h3><p>{{rate}}% APY</p>', settings(placeholderSettings)],
      ['<h3>Checking</h3><p>{{rate}}% APY</p>', settings(['Mode: api', 'Product: 4240', 'Field: advertisedAPY', 'Balance: 0'])],
      ['<h3>Interest</h3><p>{{rate}}%</p>', settings(['Mode: api', 'Product: 3100', 'Field: finalRate', 'Balance: 0'])],
    ]);
    demo.addEventListener('bank-rates:updated', (event) => { demoUpdate = event.detail; });
    await decorate(demo);
    const markers = [...demo.querySelectorAll('[data-rate-name]')];
    check(`${name} selects updated savings, checking and interest values from localStorage`, markers.map((marker) => marker.textContent).join(',') === '4.15,2.00,4.07'
      && markers.every((marker) => marker.dataset.rateBalance === '100000'
        && marker.dataset.rateBalanceSource === 'demo' && marker.dataset.rateSource === 'api'));
  }));
  check('Rate events report both the dummy and authored balance', demoUpdate.balance === '100000'
    && demoUpdate.authoredBalance === '0' && demoUpdate.balanceSource === 'demo');

  const priorities = block('cards-account', [
    ['<h3>Hybrid API</h3><p>{{rate}}%</p>', settings(['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override:'])],
    ['<h3>Manual</h3><p>{{rate}}%</p>', settings(['Mode: manual', 'Override: 5.55'])],
    ['<h3>Hybrid override</h3><p>{{rate}}%</p>', settings(['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 6.66'])],
    ['<h3>CD</h3><p>{{rate}}%</p>', settings(['Mode: api', 'Product: 3500', 'Field: disclosureAPY', 'Term: 6M'])],
    ['<h3>Static</h3><p>7.77% APY</p>'],
  ]);
  await decorateAccount(priorities);
  check('Dummy balance applies to empty hybrid overrides and preserves manual, populated overrides, CDs and static copy', [...priorities.querySelectorAll('[data-rate-name]')].map((marker) => marker.textContent).join(',') === '4.15,5.55,6.66,4.20'
    && priorities.textContent.includes('7.77% APY'));

  const authoredHigh = ['Mode: api', 'Product: 4240', 'Field: advertisedAPY', 'Balance: 10000'];
  localStorage.setItem(DEMO_BALANCE_KEY, '0');
  const zeroBalance = block('cards-product', [['<h3>Zero balance</h3><p>{{rate}}%</p>', settings(authoredHigh)]]);
  await decorateProduct(zeroBalance);
  check('Dummy zero balance selects the lower checking tier over an authored high balance', zeroBalance.querySelector('[data-rate-name]').textContent === '0.05'
    && zeroBalance.querySelector('[data-rate-name]').dataset.rateBalanceSource === 'demo');

  localStorage.setItem(DEMO_BALANCE_KEY, 'not-a-balance');
  const invalidBalance = block('cards-product', [['<h3>Invalid dummy</h3><p>{{rate}}%</p>', settings(authoredHigh)]]);
  await decorateProduct(invalidBalance);
  check('Invalid dummy balance falls back to the authored balance', invalidBalance.querySelector('[data-rate-name]').textContent === '2.00'
    && invalidBalance.querySelector('[data-rate-name]').dataset.rateBalanceSource === 'authored');

  localStorage.setItem(DEMO_BALANCE_KEY, '100000');
  const invalidAuthor = block('cards-product', [[
    '<h3>Missing authored balance</h3><p>{{rate}}%</p>',
    settings(['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Fallback: -.--']),
  ]]);
  await decorateProduct(invalidAuthor);
  check('Dummy balance does not bypass required author settings', invalidAuthor.querySelector('[data-rate-name]').textContent === '-.--'
    && invalidAuthor.querySelector('[data-rate-name]').dataset.rateError === 'invalid-settings');

  localStorage.removeItem(DEMO_BALANCE_KEY);
  const restored = block('cards-product', [['<h3>Restored</h3><p>{{rate}}%</p>', settings(placeholderSettings)]]);
  await decorateProduct(restored);
  check('Clearing localStorage restores authored tier selection', restored.querySelector('[data-rate-name]').textContent === '3.75'
    && restored.querySelector('[data-rate-name]').dataset.rateBalanceSource === 'authored');
}

const storedBalance = localStorage.getItem(DEMO_BALANCE_KEY);
try {
  localStorage.removeItem(DEMO_BALANCE_KEY);
  await runChecks();
} finally {
  if (storedBalance === null) localStorage.removeItem(DEMO_BALANCE_KEY);
  else localStorage.setItem(DEMO_BALANCE_KEY, storedBalance);
}

document.getElementById('summary').textContent = `${results.filter(Boolean).length}/${results.length} checks passed.`;
document.body.dataset.testsPassed = String(results.every(Boolean));
document.body.dataset.testsReady = 'true';
