import { decorateSections, decorateBlocks, loadBlock } from '../scripts/aem.js';

const examples = await (await fetch('/docs/remaining-block-examples.json')).json();
const select = document.querySelector('#block-example');
const main = document.querySelector('main');
const authorTable = document.querySelector('#author-table');
const status = document.querySelector('#copy-status');
examples.forEach((example, index) => {
  const option = document.createElement('option');
  option.value = index;
  option.textContent = example.title;
  select.append(option);
});
let revision = 0;
async function showExample() {
  revision += 1;
  const request = revision;
  const example = examples[Number(select.value)];
  authorTable.innerHTML = example.table;
  const table = authorTable.querySelector('table');
  const block = document.createElement('div');
  block.className = `${example.name}${table.querySelector('th').textContent.includes('promo') ? ' promo' : ''}`;
  [...table.querySelectorAll('tbody > tr')].forEach((row) => {
    const blockRow = document.createElement('div');
    [...row.cells].forEach((cell) => {
      const value = document.createElement('div');
      value.append(...[...cell.childNodes].map((node) => node.cloneNode(true)));
      blockRow.append(value);
    });
    block.append(blockRow);
  });
  // The component preview keeps the live snapshot's numbers. Copyable authoring
  // uses the migrated a–z IDs; production resolves numbers from the footer set.
  authorTable.querySelectorAll('sup').forEach((sup) => {
    if (!/^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/.test(sup.textContent.trim())) return;
    const numbers = sup.textContent.trim().split(/\s*,\s*/).map(Number);
    if (numbers.some((number) => number > 26)) return;
    sup.textContent = numbers.map((number) => String.fromCharCode(96 + number)).join(',');
  });
  const section = document.createElement('div');
  section.append(block);
  main.replaceChildren(section);
  decorateSections(main);
  decorateBlocks(main);
  await loadBlock(block);
  if (revision !== request) return;
  main.querySelector('.section').dataset.sectionStatus = 'loaded';
  main.querySelector('.section').style.display = '';
  document.querySelector('#live-source').href = example.source;
  status.textContent = '';
  const url = new URL(window.location.href);
  url.searchParams.set('example', select.value);
  window.history.replaceState(null, '', url);
}
const requested = new URL(window.location.href).searchParams.get('example');
if ([...select.options].some((option) => option.value === requested)) select.value = requested;
select.addEventListener('change', showExample);
await showExample();

document.querySelector('#copy-block').addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([authorTable.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([authorTable.textContent], { type: 'text/plain' }),
    })]);
    status.textContent = 'Copied. Paste into the DA page.';
  } catch {
    status.textContent = 'Open the authoring table below and copy it manually.';
  }
});
