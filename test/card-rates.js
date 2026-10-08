import decorateAccount from '../blocks/cards-account/cards-account.js';
import decorateProduct from '../blocks/cards-product/cards-product.js';
import decoratePricing from '../blocks/cards-pricing/cards-pricing.js';

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

document.getElementById('summary').textContent = `${results.filter(Boolean).length}/${results.length} checks passed.`;
document.body.dataset.testsPassed = String(results.every(Boolean));
document.body.dataset.testsReady = 'true';
