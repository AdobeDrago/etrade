import {
  rateExamples, scenarios, exampleTable, metadataTable,
} from './dynamic-rates-examples.js';

function authoringPack(target, examples, scenario) {
  const heading = document.createElement('h1');
  heading.textContent = 'Dynamic rates — authored test page';
  const notice = document.createElement('p');
  notice.textContent = 'TEST CONTENT — sample rates, not live rates. Fallback 1.11% is deliberately different from API values.';
  target.append(heading, notice);
  examples.forEach((example) => {
    target.append(exampleTable(document, example), document.createElement('p'));
  });
  target.append(metadataTable(document, scenario));
}
authoringPack(document.getElementById('authored-pack'), rateExamples, scenarios.direct);
const manual = rateExamples.filter((example) => ['static', 'manual', 'hybrid-override', 'zero'].includes(example.id));
authoringPack(document.getElementById('manual-pack'), manual, scenarios.manual);
Object.entries(scenarios).forEach(([key, scenario]) => {
  document.getElementById(`metadata-${key}`)?.append(metadataTable(document, scenario));
});
const expected = document.querySelector('#expected-cases tbody');
rateExamples.forEach((example) => {
  const row = expected.insertRow();
  [example.title, example.expected.join(' / ') || 'Authored text', example.source || 'authored', example.description].forEach((value) => {
    row.insertCell().textContent = value;
  });
});

document.querySelectorAll('button[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const table = document.getElementById(button.dataset.copy);
    const status = button.nextElementSibling;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([table.outerHTML], { type: 'text/html' }),
        'text/plain': new Blob([table.innerText], { type: 'text/plain' }),
      })]);
      status.textContent = 'Copied. Paste into your document.';
    } catch {
      const details = table.closest('details');
      if (details) details.open = true;
      const range = document.createRange();
      range.selectNodeContents(table);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Table selected. Copy it using your keyboard.';
    }
  });
});
