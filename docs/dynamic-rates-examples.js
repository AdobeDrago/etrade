const fallback = 'Fallback: 1.11';
const savings = ['Mode: api', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', fallback];
const checking = ['Mode: api', 'Product: 4240', 'Field: advertisedAPY'];
const cd = ['Mode: api', 'Product: 3500', 'Field: disclosureAPY'];

/** Shared authored examples keep the setup pack and working showcase consistent. */
export const rateExamples = [
  {
    id: 'static',
    title: '01. Ordinary authored card',
    block: 'cards-product',
    copy: '<h4>Authored text stays authored</h4><p>No marker or rate settings are added to this card.</p>',
    settings: [],
    expected: [],
    description: 'An ordinary card makes no rate request and keeps its authored content.',
  },
  {
    id: 'manual',
    title: '02. Manual rate',
    block: 'cards-product',
    copy: '<h4>{{rate}}% APY</h4>',
    settings: [['Mode: manual', 'Override: 3.90']],
    expected: ['3.90'],
    source: 'manual',
    description: 'The Override value supplies the rate. No request is made for this binding.',
  },
  {
    id: 'hybrid-override',
    title: '03. Hybrid with override',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 4.10', fallback]],
    expected: ['4.10'],
    source: 'override',
    description: 'A populated Override wins over the API and fallback.',
  },
  {
    id: 'zero',
    title: '04. Hybrid zero override',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: 0', fallback]],
    expected: ['0.00'],
    source: 'override',
    description: 'Zero is a real override, not an empty value.',
  },
  {
    id: 'savings-advertised',
    title: '05. Savings advertised APY',
    block: 'cards-product',
    copy: '<h4>{{rate}}% APY</h4>',
    settings: [savings],
    expected: ['3.75'],
    source: 'api',
    description: 'Product 3100; advertisedAPY from the tier containing balance 0.',
  },
  {
    id: 'savings-disclosure',
    title: '06. Savings disclosure APY',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: api', 'Product: 3100', 'Field: disclosureAPY', 'Balance: 5000', fallback]],
    expected: ['3.85'],
    source: 'api',
    description: 'The exact disclosureAPY field is selected; product order does not matter.',
  },
  {
    id: 'savings-interest',
    title: '07. Savings interest rate',
    block: 'cards-pricing',
    copy: '<p>{{rate}}%</p>',
    settings: [['Mode: api', 'Product: 3100', 'Field: finalRate', 'Balance: 0', fallback]],
    expected: ['3.68'],
    source: 'api',
    description: 'finalRate is the interest rate. Its label must not say APY.',
  },
  {
    id: 'checking-low',
    title: '08. Checking lower tier',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...checking, 'Balance: 9999.99', fallback]],
    expected: ['0.05'],
    source: 'api',
    description: 'The lower tier includes its upper boundary, 9999.99.',
  },
  {
    id: 'checking-high',
    title: '09. Checking higher tier',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...checking, 'Balance: 10000', fallback]],
    expected: ['2.00'],
    source: 'api',
    description: 'Balance 10000 selects the next tier.',
  },
  {
    id: 'checking-open',
    title: '10. Checking open-ended tier',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...checking, 'Balance: 1000000', fallback]],
    expected: ['2.00'],
    source: 'api',
    description: 'A zero upper limit in the response means the highest tier has no upper ceiling.',
  },
  {
    id: 'cd-six',
    title: '11. Six-month CD',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...cd, 'Term: 6M', fallback]],
    expected: ['4.20'],
    source: 'api',
    description: 'Product 3500; select disclosureAPY by durationCode 6M.',
  },
  {
    id: 'cd-twelve',
    title: '12. Twelve-month CD',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...cd, 'Term: 12M', fallback]],
    expected: ['4.40'],
    source: 'api',
    description: 'Changing only Term selects a different duration, independently of response order.',
  },
  {
    id: 'cd-interest',
    title: '13. CD interest-rate precision',
    block: 'cards-pricing',
    copy: '<p>{{rate}}%</p>',
    settings: [['Mode: api', 'Product: 3500', 'Field: finalRate', 'Term: 12M', fallback]],
    expected: ['4.3062'],
    source: 'api',
    description: 'The finalRate precision is preserved; this value is not APY.',
  },
  {
    id: 'cd-range',
    title: '14. CD minimum and maximum',
    block: 'cards-account',
    copy: '<p>{{rate:minimum}}%–{{rate:maximum}}% APY</p>',
    settings: [
      ['Name: minimum', 'Mode: api', 'Product: 3500', 'Field: minDisclosureAPY', fallback],
      ['Name: maximum', 'Mode: api', 'Product: 3500', 'Field: maxDisclosureAPY', fallback],
    ],
    expected: ['4.20', '4.40'],
    source: 'api',
    description: 'Two named bindings use the supplied calculatedFields. Neither uses Term or Balance.',
  },
  {
    id: 'hybrid-empty',
    title: '15. Hybrid with empty override',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override:', fallback]],
    expected: ['3.75'],
    source: 'api',
    description: 'An empty Override resumes API selection and fallback handling.',
  },
  {
    id: 'api-override',
    title: '16. API mode ignores Override',
    block: 'cards-product',
    copy: '<h4>{{rate}}% APY</h4>',
    settings: [[...savings, 'Override: 4.10']],
    expected: ['3.75'],
    source: 'api',
    description: 'In api mode, Override is ignored. Change Mode to hybrid to activate that override.',
  },
  {
    id: 'named-repeat',
    title: '17. Named and repeated base rate',
    block: 'cards-product',
    copy: '<h4>Authored promotional example: 4.25% APY<sup>1</sup></h4><p>Base rate: <strong>{{rate:base}}</strong>% APY<sup>2</sup>.</p><p>Repeated base: {{rate:base}}%.</p><p><a href="https://us.etrade.com/bank/premium-savings-account">Learn more</a></p>',
    settings: [['Name: base', ...savings]],
    expected: ['3.75', '3.75'],
    source: 'api',
    description: 'Only named markers change. Promotional text, bold formatting, superscripts and the CTA are preserved.',
  },
  {
    id: 'missing-term-fallback',
    title: '18. Missing CD term with fallback',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...cd, 'Term: 3M', fallback]],
    expected: ['1.11'],
    source: 'fallback',
    error: 'missing-tier',
    description: '3M is not in the supplied response. The explicit fallback is displayed.',
  },
  {
    id: 'missing-term-empty',
    title: '19. Missing CD term without fallback',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [[...cd, 'Term: 3M']],
    expected: ['—'],
    source: 'unavailable',
    error: 'missing-tier',
    description: 'No matching term and no fallback produces —, with an accessible unavailable label.',
  },
  {
    id: 'invalid-settings',
    title: '20. Invalid authored override',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: hybrid', 'Product: 3100', 'Field: advertisedAPY', 'Balance: 0', 'Override: not-a-number', fallback]],
    expected: ['1.11'],
    source: 'fallback',
    error: 'invalid-settings',
    description: 'Invalid author controls fail safely without requesting data for this binding.',
  },
  {
    id: 'missing-settings',
    title: '21. Marker without settings',
    block: 'cards-product',
    copy: '<h4>{{rate}}% APY</h4>',
    settings: [],
    expected: ['—'],
    source: 'unavailable',
    error: 'invalid-settings',
    description: 'A missing settings cell never guesses a product or leaves a raw marker visible.',
  },
  {
    id: 'duplicate-settings',
    title: '22. Duplicate binding names',
    block: 'cards-account',
    copy: '<p>{{rate}}% APY</p>',
    settings: [['Mode: manual', 'Override: 1'], ['Mode: manual', 'Override: 2']],
    expected: ['—'],
    source: 'unavailable',
    error: 'invalid-settings',
    description: 'Two settings cells using the default name rate are ambiguous. Give each a unique Name and matching marker.',
  },
];

/** A short authoring page contrasts fetched values with ordinary authored copy. */
export const comparisonSections = [
  {
    heading: 'Dynamic rates — populated from the demo JSON',
    description: 'These three cards read their rates from the JSON endpoint. Without a dummy balance, their sample values are 3.75%, 2.00% and 4.40%.',
    examples: [
      {
        id: 'dynamic-savings',
        title: 'DYNAMIC · Premium Savings',
        block: 'cards-product',
        copy: '<h4>{{rate}}% APY</h4><p>Savings advertised APY from the demo JSON. Authored default balance: $0.</p>',
        settings: [savings],
        expected: ['3.75'],
        source: 'api',
      },
      {
        id: 'dynamic-checking',
        title: 'DYNAMIC · Max-Rate Checking',
        block: 'cards-product',
        copy: '<h4>{{rate}}% APY</h4><p>Checking advertised APY from the demo JSON. Authored default balance: $10,000.</p>',
        settings: [[...checking, 'Balance: 10000', fallback]],
        expected: ['2.00'],
        source: 'api',
      },
      {
        id: 'dynamic-cd',
        title: 'DYNAMIC · 12-month CD',
        block: 'cards-product',
        copy: '<h4>{{rate}}% APY</h4><p>Fetched from the demo JSON: disclosure APY for the 12-month term.</p>',
        settings: [[...cd, 'Term: 12M', fallback]],
        expected: ['4.40'],
        source: 'api',
      },
    ],
  },
  {
    heading: 'Manual rates — fixed values authored on this page',
    description: 'These three cards contain ordinary authored text. Their deliberately different rates stay at 6.50%, 7.50% and 8.50%, even when the JSON changes or is unavailable.',
    examples: [
      {
        id: 'authored-savings',
        title: 'MANUAL · Premium Savings',
        block: 'cards-product',
        copy: '<h4>6.50% APY</h4><p>Fixed demo value entered by the author. Edit this text to change it.</p>',
        settings: [],
        expected: [],
        authoredRate: '6.50',
      },
      {
        id: 'authored-checking',
        title: 'MANUAL · Max-Rate Checking',
        block: 'cards-product',
        copy: '<h4>7.50% APY</h4><p>Fixed demo value entered by the author. Edit this text to change it.</p>',
        settings: [],
        expected: [],
        authoredRate: '7.50',
      },
      {
        id: 'authored-cd',
        title: 'MANUAL · 12-month CD',
        block: 'cards-product',
        copy: '<h4>8.50% APY</h4><p>Fixed demo value entered by the author. Edit this text to change it.</p>',
        settings: [],
        expected: [],
        authoredRate: '8.50',
      },
    ],
  },
];

export const scenarios = {
  direct: { source: 'direct', endpoint: '/test/fixtures/bank-rates.json', label: 'Direct GET — sample rates' },
  aggregate: { source: 'aggregate', endpoint: '/test/fixtures/bank-rates-aggregate.json', label: 'Aggregate POST — sample rates' },
  failure: { source: 'direct', endpoint: '/test/fixtures/unavailable', label: 'HTTP failure — authored fallback' },
  invalid: { source: 'direct', endpoint: '/test/fixtures/invalid-json', label: 'Invalid JSON — authored fallback' },
  timeout: { source: 'direct', endpoint: '/test/fixtures/timeout', label: 'Timeout — authored fallback after five seconds' },
  manual: { source: 'direct', endpoint: '/test/fixtures/unavailable', label: 'Manual-only — zero requests' },
  'live-direct': {
    source: 'direct',
    endpoint: 'https://us.etrade.com/phx/pros/apicontent/init/bankRates',
    label: 'Live E*TRADE — direct GET',
    live: true,
  },
  'live-aggregate': {
    source: 'aggregate',
    endpoint: 'https://us.etrade.com/phx/pros/aggregate',
    label: 'Live E*TRADE — aggregate POST',
    live: true,
  },
  'published-sample': { source: 'direct', endpoint: '/phx/pros/apicontent/init/bankRates.json', label: 'Published JSON — sample rates' },
  'published-aggregate-sample': { source: 'direct', endpoint: '/phx/pros/aggregate.json', label: 'Published JSON — aggregate response sample' },
};

export function exampleContent(doc, example) {
  const cell = doc.createElement('div');
  // Static authored examples only; API data never supplies HTML.
  cell.innerHTML = `<h3>${example.title}</h3>${example.copy}`;
  return cell;
}

export function settingsContent(doc, lines) {
  const cell = doc.createElement('div');
  ['Rate settings', ...lines].forEach((line) => {
    const paragraph = doc.createElement('p');
    paragraph.textContent = line;
    cell.append(paragraph);
  });
  return cell;
}

export function exampleTable(doc, example) {
  const table = doc.createElement('table');
  const body = table.createTBody();
  const name = body.insertRow().insertCell();
  name.colSpan = 1 + example.settings.length;
  name.textContent = example.block;
  const row = body.insertRow();
  row.insertCell().append(...exampleContent(doc, example).childNodes);
  example.settings.forEach((lines) => {
    row.insertCell().append(...settingsContent(doc, lines).childNodes);
  });
  return table;
}

export function metadataTable(doc, scenario) {
  const table = doc.createElement('table');
  const body = table.createTBody();
  const title = body.insertRow().insertCell();
  title.colSpan = 2;
  title.textContent = 'Metadata';
  [['Bank rates source', scenario.source], ['Bank rates endpoint', scenario.endpoint]].forEach(([key, value]) => {
    const row = body.insertRow();
    row.insertCell().textContent = key;
    row.insertCell().textContent = value;
  });
  return table;
}
